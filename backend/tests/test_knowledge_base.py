from __future__ import annotations

import base64
from datetime import timedelta

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.agents.branching import ensure_open_gallery_binding
from app.api.knowledge import list_documents, search_knowledge, update_chunk, update_document
from app.api.knowledge_bases import knowledge_base_read
from app.db.models import (
    AgentProfile,
    KnowledgeBase,
    KnowledgeBaseVersion,
    KnowledgeBucket,
    KnowledgeChunk,
    KnowledgeConcept,
    KnowledgeDiscoverySuggestion,
    KnowledgeDocument,
    KnowledgeIngestJob,
    ModelConfig,
    Skill,
    Tenant,
    Tool,
    User,
    utc_now,
)
from app.knowledge.schema import KnowledgeChunkUpdateRequest, KnowledgeDocumentUpdateRequest, KnowledgeSearchRequest, KnowledgeSearchResponse
from app.knowledge.okf import search_concepts
from app.knowledge.service import IngestPayload, KnowledgeService
from app.observability.spans import bind_span_sink
from app.skills.skill_schema import SkillCard


def test_skill_card_rejects_legacy_steps_and_accepts_graph() -> None:
    with pytest.raises(Exception):
        SkillCard(
            skill_id="skill_test",
            name="測試技能",
            steps=[
                {
                    "step_id": "collect",
                    "name": "收集信息",
                    "instruction": "收集用戶信息",
                    "expected_user_info": ["name"],
                    "allowed_actions": ["ask_user", "continue_flow"],
                }
            ],
        )

    card = SkillCard(
        skill_id="skill_test",
        name="測試技能",
        nodes=[
            {
                "node_id": "collect",
                "type": "collect_info",
                "name": "收集信息",
                "instruction": "收集用戶信息",
                "expected_user_info": ["name"],
                "allowed_actions": ["ask_user", "continue_flow"],
            },
            {
                "node_id": "reply",
                "type": "response",
                "name": "回覆",
                "instruction": "回覆用戶",
                "allowed_actions": ["answer_user"],
            },
        ],
        edges=[{"source_node_id": "collect", "next_node_id": "reply"}],
        start_node_id="collect",
        terminal_node_ids=["reply"],
    )

    assert card.start_node_id == "collect"
    assert card.terminal_node_ids == ["reply"]
    assert [node.node_id for node in card.nodes] == ["collect", "reply"]
    assert card.edges[0].source_node_id == "collect"
    assert card.edges[0].next_node_id == "reply"


def test_knowledge_ingest_creates_document_buckets_and_chunks_without_auto_discovery() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(KnowledgeBase(id="kb_demo", tenant_id="tenant_demo", name="默認知識庫"))
        db.commit()
        service = KnowledgeService(db)
        job = service.create_ingest_job(
            IngestPayload(
                tenant_id="tenant_demo",
                knowledge_base_id="kb_demo",
                filename="policy.md",
                content_base64=_b64("# 售後政策\n用戶可查詢訂單。\n\n# 配送\n根據地址評估配送。"),
            )
        )

        service._run_ingest_job(job.id)  # noqa: SLF001 - exercise persistent job logic synchronously.

        job = db.get(type(job), job.id)
        assert job is not None
        assert job.status == "succeeded"
        assert job.document_id
        document = db.get(KnowledgeDocument, job.document_id)
        assert document is not None
        assert document.metadata_json["document_card"]["title"]
        assert document.metadata_json["section_tree"]
        assert document.metadata_json["chunk_stats"]["total_chunks"] > 0
        assert document.metadata_json["bucket_quality"]
        buckets = db.exec(select(KnowledgeBucket).where(KnowledgeBucket.document_id == job.document_id)).all()
        assert buckets
        assert all(bucket.metadata_json.get("section_ids") for bucket in buckets)
        chunks = db.exec(select(KnowledgeChunk).where(KnowledgeChunk.document_id == job.document_id)).all()
        assert chunks
        assert all(chunk.metadata_json.get("section_path") for chunk in chunks)
        response = service.search(
            KnowledgeSearchRequest(
                tenant_id="tenant_demo",
                knowledge_base_ids=["kb_demo"],
                query="配送怎麼處理",
                mode="debug",
                need_evidence_pack=True,
            )
        )
        phases = [item["phase"] for item in response.route_trace]
        assert "document_route" in phases
        assert "bucket_route" in phases
        assert "section_expand" in phases
        assert "evidence_pack" in phases
        assert response.selected_documents
        assert response.expanded_sections
        assert response.evidence_pack
        assert response.evidence_pack[0]["source_path"]
        assert response.evidence_pack[0]["excerpt"]
        assert response.chunks
        assert db.exec(select(KnowledgeDiscoverySuggestion)).all() == []


def test_knowledge_ingest_cancel_queued_job_clears_embedded_content() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(KnowledgeBase(id="kb_demo", tenant_id="tenant_demo", name="默認知識庫"))
        db.commit()
        service = KnowledgeService(db)
        job = service.create_ingest_job(
            IngestPayload(
                tenant_id="tenant_demo",
                knowledge_base_id="kb_demo",
                filename="policy.md",
                content_base64=_b64("# 售後政策\n用戶可查詢訂單。"),
            )
        )

        cancelled = service.cancel_ingest_job(job.id, "tenant_demo")

        assert cancelled is not None
        assert cancelled.status == "cancelled"
        assert cancelled.stage == "cancelled"
        assert cancelled.finished_at is not None
        assert cancelled.metadata_json["stage_label"] == "已取消"
        assert "content_base64" not in cancelled.metadata_json


def test_knowledge_ingest_cancel_running_job_cleans_partial_artifacts() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(KnowledgeBase(id="kb_demo", tenant_id="tenant_demo", name="默認知識庫"))
        document = KnowledgeDocument(
            id="kdoc_partial",
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            filename="partial.md",
            file_type="md",
            title="半成品",
            status="processing",
        )
        bucket = KnowledgeBucket(
            id="kbucket_partial",
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            document_id=document.id,
            bucket_key="partial",
            title="半成品目錄",
            summary="半成品摘要",
        )
        chunk = KnowledgeChunk(
            id="kchunk_partial",
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            document_id=document.id,
            bucket_id=bucket.id,
            chunk_index=0,
            content="半成品引用",
        )
        concept = KnowledgeConcept(
            id="kconcept_partial",
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            document_id=document.id,
            concept_id="partial",
            concept_type="Source Document",
            title="半成品概念",
            content_md="半成品概念",
        )
        suggestion = KnowledgeDiscoverySuggestion(
            id="kdisc_partial",
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            document_id=document.id,
            bucket_id=bucket.id,
            suggestion_type="warning",
            title="半成品建議",
        )
        job = KnowledgeIngestJob(
            id="kjob_partial",
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            document_id=document.id,
            filename="partial.md",
            status="running",
            stage="chunking",
            progress=0.62,
            metadata_json={"content_base64": _b64("partial"), "stage_label": "生成引用來源"},
        )
        db.add(document)
        db.add(bucket)
        db.add(chunk)
        db.add(concept)
        db.add(suggestion)
        db.add(job)
        db.commit()
        document_id = document.id
        bucket_id = bucket.id
        chunk_id = chunk.id
        concept_id = concept.id
        suggestion_id = suggestion.id
        service = KnowledgeService(db)

        cancelling = service.cancel_ingest_job(job.id, "tenant_demo")
        assert cancelling is not None
        assert cancelling.status == "cancel_requested"

        service._run_ingest_job(job.id)  # noqa: SLF001 - exercise persisted cancellation path.

        cancelled = db.get(KnowledgeIngestJob, job.id)
        assert cancelled is not None
        assert cancelled.status == "cancelled"
        assert cancelled.stage == "cancelled"
        assert cancelled.document_id is None
        assert cancelled.metadata_json["cancelled_document_id"] == document_id
        assert "content_base64" not in cancelled.metadata_json
        assert db.get(KnowledgeDocument, document_id) is None
        assert db.get(KnowledgeBucket, bucket_id) is None
        assert db.get(KnowledgeChunk, chunk_id) is None
        assert db.get(KnowledgeConcept, concept_id) is None
        assert db.get(KnowledgeDiscoverySuggestion, suggestion_id) is None


def test_knowledge_ingest_stale_cancel_request_finalizes_without_worker() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(KnowledgeBase(id="kb_demo", tenant_id="tenant_demo", name="默認知識庫"))
        document = KnowledgeDocument(
            id="kdoc_stale_cancel",
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            filename="stale.md",
            file_type="md",
            title="取消中的半成品",
            status="processing",
        )
        job = KnowledgeIngestJob(
            id="kjob_stale_cancel",
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            document_id=document.id,
            filename="stale.md",
            status="cancel_requested",
            stage="chunking",
            progress=70.0,
            metadata_json={"content_base64": _b64("partial"), "stage_label": "取消中"},
            updated_at=utc_now() - timedelta(seconds=60),
        )
        db.add(document)
        db.add(job)
        db.commit()
        service = KnowledgeService(db)

        finalized = service.finalize_stale_cancel_requested_job(job)

        assert finalized is not None
        assert finalized.status == "cancelled"
        assert finalized.stage == "cancelled"
        assert finalized.document_id is None
        assert finalized.metadata_json["stage_label"] == "已取消"
        assert "content_base64" not in finalized.metadata_json
        assert db.get(KnowledgeDocument, document.id) is None


def test_knowledge_search_without_model_uses_relevance_rank_order() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(KnowledgeBase(id="kb_demo", tenant_id="tenant_demo", name="默認知識庫"))
        document = KnowledgeDocument(
            id="kdoc_frontend",
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            filename="frontend.md",
            file_type="md",
            title="前端規範資料",
            status="ready",
            bucket_count=2,
            chunk_count=2,
            metadata_json={
                "document_card": {
                    "title": "前端規範資料",
                    "summary": "前端編碼規範、Vue 3、組件規範和命名規範。",
                }
            },
        )
        irrelevant = KnowledgeBucket(
            id="kbucket_citation",
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            document_id=document.id,
            bucket_key="citation",
            title="知識引用測試說明",
            summary="回答引用展示規則。",
        )
        frontend = KnowledgeBucket(
            id="kbucket_frontend",
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            document_id=document.id,
            bucket_key="frontend",
            title="前端編碼規範",
            summary="Vue 3、Vite、TypeScript、組件編寫和命名規範。",
        )
        db.add(document)
        db.add(irrelevant)
        db.add(frontend)
        db.add(
            KnowledgeChunk(
                tenant_id="tenant_demo",
                knowledge_base_id="kb_demo",
                document_id=document.id,
                bucket_id=irrelevant.id,
                chunk_index=0,
                content="知識引用展示規則。",
                summary="知識引用展示規則。",
                source_ref="citation.md",
            )
        )
        db.add(
            KnowledgeChunk(
                tenant_id="tenant_demo",
                knowledge_base_id="kb_demo",
                document_id=document.id,
                bucket_id=frontend.id,
                chunk_index=0,
                content="前端規範包括 Vue 3、Vite、TypeScript 和組件編寫規範。",
                summary="前端規範包括 Vue 3、Vite、TypeScript 和組件編寫規範。",
                source_ref="frontend.md",
            )
        )
        db.commit()

        response = KnowledgeService(db).search(
            KnowledgeSearchRequest(
                tenant_id="tenant_demo",
                knowledge_base_ids=["kb_demo"],
                query="前端規範有哪些？",
                mode="chat",
                max_buckets=2,
                need_evidence_pack=True,
            )
        )

        assert [bucket.id for bucket in response.selected_buckets] == ["kbucket_frontend"]


def test_model_driven_document_route_does_not_fall_back_to_lexical_matching(monkeypatch) -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(KnowledgeBase(id="kb_demo", tenant_id="tenant_demo", name="默認知識庫"))
        db.add(
            KnowledgeDocument(
                id="kdoc_frontend",
                tenant_id="tenant_demo",
                knowledge_base_id="kb_demo",
                filename="frontend.md",
                file_type="md",
                title="前端規範資料",
                status="ready",
                metadata_json={"document_card": {"title": "前端規範資料", "summary": "前端編碼規範。"}},
            )
        )
        db.commit()
        monkeypatch.setattr(KnowledgeService, "_select_documents_with_llm", lambda *args, **kwargs: [])

        response = KnowledgeService(db).search(
            KnowledgeSearchRequest(
                tenant_id="tenant_demo",
                knowledge_base_ids=["kb_demo"],
                query="前端規範有哪些？",
                mode="chat",
            ),
            ModelConfig(id="model_route", tenant_id="tenant_demo", name="Route", model="route"),
        )

        assert response.selected_documents == []
        assert any(item.get("phase") == "document_route_no_match" for item in response.route_trace)
        assert all("fallback" not in str(item.get("phase") or "") for item in response.route_trace)


def test_knowledge_search_records_persistent_substep_spans() -> None:
    events: list[tuple[str, dict]] = []
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(KnowledgeBase(id="kb_demo", tenant_id="tenant_demo", name="默認知識庫"))
        document = KnowledgeDocument(
            id="kdoc_frontend",
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            filename="frontend.md",
            file_type="md",
            title="前端規範資料",
            status="ready",
            metadata_json={"document_card": {"title": "前端規範資料", "summary": "前端規範"}},
        )
        bucket = KnowledgeBucket(
            id="kbucket_frontend",
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            document_id=document.id,
            bucket_key="frontend",
            title="前端規範",
            summary="Vue 3 與 TypeScript",
        )
        db.add(document)
        db.add(bucket)
        db.add(
            KnowledgeChunk(
                tenant_id="tenant_demo",
                knowledge_base_id="kb_demo",
                document_id=document.id,
                bucket_id=bucket.id,
                chunk_index=0,
                content="前端規範包括 Vue 3 與 TypeScript。",
                summary="前端規範",
                source_ref="frontend.md",
            )
        )
        db.commit()

        with bind_span_sink(
            lambda event_type, payload: events.append((event_type, payload))
        ):
            response = KnowledgeService(db).search(
                KnowledgeSearchRequest(
                    tenant_id="tenant_demo",
                    knowledge_base_ids=["kb_demo"],
                    query="前端規範",
                    mode="chat",
                    need_evidence_pack=True,
                )
            )

    assert response.chunks
    finished = {
        payload["operation"]: payload
        for event_type, payload in events
        if event_type == "knowledge_span_finished"
    }
    assert {
        "knowledge.search",
        "knowledge.load_concepts",
        "knowledge.route_concepts",
        "knowledge.load_documents",
        "knowledge.route_documents",
        "knowledge.load_buckets",
        "knowledge.route_buckets",
        "knowledge.expand_sections",
        "knowledge.load_chunks",
        "knowledge.rank_chunks",
        "knowledge.build_evidence_pack",
    }.issubset(finished)
    assert finished["knowledge.search"]["duration_ms"] >= 0
    assert finished["knowledge.load_documents"]["candidate_count"] == 1
    assert finished["knowledge.build_evidence_pack"]["evidence_count"] == 1


def test_okf_search_does_not_require_manually_curated_business_terms() -> None:
    concept = KnowledgeConcept(
        tenant_id="tenant_demo",
        knowledge_base_id="kb_demo",
        concept_id="sources/internal-document",
        concept_type="Source Document",
        title="內部文檔說明",
        description="介紹可用文檔及其適用範圍。",
        content_md="# 內部文檔說明\n\n這份文檔記錄服務流程。",
    )

    assert search_concepts("文檔", [concept]) == [concept]


def test_knowledge_search_api_uses_selected_model_config(monkeypatch) -> None:
    captured: dict[str, str | None] = {}

    def fake_search(self, request, model_config=None):  # noqa: ANN001
        captured["model_id"] = model_config.id if model_config else None
        return KnowledgeSearchResponse(route_trace=[{"phase": "ok"}])

    monkeypatch.setattr(KnowledgeService, "search", fake_search)

    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(AgentProfile(id="agent_overall", tenant_id="tenant_demo", name="開放廣場", is_overall=True))
        db.add(KnowledgeBase(id="kb_search", tenant_id="tenant_demo", name="檢索知識庫"))
        db.add(
            ModelConfig(
                id="model_default",
                tenant_id="tenant_demo",
                name="Default model",
                api_key_encrypted="",
                model="default",
                is_default=True,
                enabled=True,
            )
        )
        db.add(
            ModelConfig(
                id="model_selected",
                tenant_id="tenant_demo",
                name="Selected model",
                api_key_encrypted="",
                model="selected",
                enabled=True,
            )
        )
        ensure_open_gallery_binding(db, "tenant_demo", "knowledge_base", "kb_search", "active")
        db.commit()

        search_knowledge(
            KnowledgeSearchRequest(
                tenant_id="tenant_demo",
                query="測試檢索",
                model_config_id="model_selected",
            ),
            db,
            User(id="user_admin", tenant_id="tenant_demo", username="admin", role="admin"),
        )

        assert captured["model_id"] == "model_selected"


def test_knowledge_base_read_keeps_archived_rows_visible_despite_active_versions() -> None:
    row = KnowledgeBase(id="kb_demo", tenant_id="tenant_demo", name="默認知識庫", status="archived")
    version = KnowledgeBaseVersion(
        tenant_id="tenant_demo",
        knowledge_base_id=row.id,
        version="1.0.0",
        name=row.name,
        status="active",
    )

    overall_read = knowledge_base_read(row, {}, version_row=version)
    branch_read = knowledge_base_read(
        row,
        {},
        version_row=version,
        branch_meta={"status": "inactive", "base_version": "1.0.0", "head_version": "1.0.0", "sync_state": "synced"},
    )

    assert overall_read.status == "archived"
    assert branch_read.status == "archived"


def test_list_documents_without_agent_scope_returns_only_open_gallery_documents() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(AgentProfile(id="agent_overall", tenant_id="tenant_demo", name="開放廣場", is_overall=True))
        db.add(KnowledgeBase(id="kb_open", tenant_id="tenant_demo", name="開放知識庫"))
        db.add(KnowledgeBase(id="kb_private", tenant_id="tenant_demo", name="私有知識庫"))
        db.add(
            KnowledgeBaseVersion(
                id="kbv_open",
                tenant_id="tenant_demo",
                knowledge_base_id="kb_open",
                version="1.0.0",
                name="開放知識庫",
            )
        )
        db.add(
            KnowledgeBaseVersion(
                id="kbv_private",
                tenant_id="tenant_demo",
                knowledge_base_id="kb_private",
                version="1.0.0",
                name="私有知識庫",
            )
        )
        db.add(
            KnowledgeDocument(
                id="kdoc_open",
                tenant_id="tenant_demo",
                knowledge_base_id="kb_open",
                knowledge_base_version_id="kbv_open",
                filename="open.md",
                file_type="md",
                title="開放資料",
                status="ready",
            )
        )
        db.add(
            KnowledgeDocument(
                id="kdoc_private",
                tenant_id="tenant_demo",
                knowledge_base_id="kb_private",
                knowledge_base_version_id="kbv_private",
                filename="private.md",
                file_type="md",
                title="私有資料",
                status="ready",
            )
        )
        db.flush()
        ensure_open_gallery_binding(db, "tenant_demo", "knowledge_base", "kb_open", "active")
        db.commit()

        rows = list_documents("tenant_demo", None, None, True, db)

        assert {row.id for row in rows} == {"kdoc_open"}


def test_update_document_syncs_document_card_and_okf_source_concept() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(KnowledgeBase(id="kb_demo", tenant_id="tenant_demo", name="默認知識庫"))
        db.add(
            KnowledgeBaseVersion(
                id="kbv_demo",
                tenant_id="tenant_demo",
                knowledge_base_id="kb_demo",
                version="1.0.0",
                name="默認知識庫",
                status="active",
            )
        )
        document = KnowledgeDocument(
            id="kdoc_demo",
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            knowledge_base_version_id="kbv_demo",
            filename="demo.md",
            file_type="md",
            title="舊標題",
            status="ready",
            bucket_count=1,
            chunk_count=1,
            metadata_json={
                "document_card": {"title": "舊卡片標題", "summary": "文檔摘要"},
                "section_tree": [
                    {
                        "section_id": "intro",
                        "title": "介紹",
                        "path": "介紹",
                        "summary": "舊章節摘要",
                        "content": "舊章節內容",
                    }
                ],
            },
        )
        bucket = KnowledgeBucket(
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            knowledge_base_version_id="kbv_demo",
            document_id=document.id,
            bucket_key="intro",
            title="介紹",
            summary="舊桶摘要",
            token_estimate=10,
            metadata_json={"content": "舊桶內容", "section_ids": ["intro"], "section_paths": ["介紹"]},
        )
        stale_source = KnowledgeConcept(
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            knowledge_base_version_id="kbv_demo",
            document_id=document.id,
            concept_id="sources/old-title",
            concept_type="Source Document",
            title="舊卡片標題",
            description="舊來源",
            content_md="# Old",
        )
        db.add(document)
        db.add(bucket)
        db.add(stale_source)
        db.commit()

        updated = update_document(
            document.id,
            KnowledgeDocumentUpdateRequest(tenant_id="tenant_demo", title="新標題"),
            db,
        )

        assert updated.title == "新標題"
        assert updated.metadata["document_card"]["title"] == "新標題"
        source_concepts = db.exec(
            select(KnowledgeConcept).where(
                KnowledgeConcept.tenant_id == "tenant_demo",
                KnowledgeConcept.document_id == document.id,
                KnowledgeConcept.concept_type == "Source Document",
            )
        ).all()
        assert len(source_concepts) == 1
        assert source_concepts[0].title == "新標題"
        assert source_concepts[0].concept_id != "sources/old-title"


def test_update_chunk_refreshes_bucket_content_and_okf_topic() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(KnowledgeBase(id="kb_demo", tenant_id="tenant_demo", name="默認知識庫"))
        db.add(
            KnowledgeBaseVersion(
                id="kbv_demo",
                tenant_id="tenant_demo",
                knowledge_base_id="kb_demo",
                version="1.0.0",
                name="默認知識庫",
                status="active",
            )
        )
        document = KnowledgeDocument(
            id="kdoc_demo",
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            knowledge_base_version_id="kbv_demo",
            filename="demo.md",
            file_type="md",
            title="測試文檔",
            status="ready",
            bucket_count=1,
            chunk_count=1,
            metadata_json={"document_card": {"title": "測試文檔", "summary": "文檔摘要"}},
        )
        bucket = KnowledgeBucket(
            id="kbucket_demo",
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            knowledge_base_version_id="kbv_demo",
            document_id=document.id,
            bucket_key="refund",
            title="退款規則",
            summary="舊退款規則摘要",
            token_estimate=10,
            metadata_json={"content": "舊退款規則內容"},
        )
        chunk = KnowledgeChunk(
            id="kchunk_demo",
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            knowledge_base_version_id="kbv_demo",
            document_id=document.id,
            bucket_id=bucket.id,
            chunk_index=0,
            content="舊退款規則內容",
            summary="舊摘要",
        )
        db.add(document)
        db.add(bucket)
        db.add(chunk)
        db.commit()

        update_chunk(
            chunk.id,
            KnowledgeChunkUpdateRequest(tenant_id="tenant_demo", content="新退款規則內容", summary="新摘要"),
            db,
        )

        refreshed_bucket = db.get(KnowledgeBucket, bucket.id)
        assert refreshed_bucket is not None
        assert "新退款規則內容" in refreshed_bucket.metadata_json["content"]
        topic = db.exec(
            select(KnowledgeConcept).where(
                KnowledgeConcept.tenant_id == "tenant_demo",
                KnowledgeConcept.document_id == document.id,
                KnowledgeConcept.title == "退款規則",
            )
        ).one()
        assert "新退款規則內容" in topic.content_md


def test_confirm_discovery_is_required_before_tool_or_skill_enters_runtime() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(KnowledgeBase(id="kb_demo", tenant_id="tenant_demo", name="默認知識庫"))
        suggestion = KnowledgeDiscoverySuggestion(
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            document_id="doc_1",
            suggestion_type="tool",
            title="會員權益核對",
            payload_json={
                "name": "member.benefit_reconcile",
                "display_name": "會員權益核對",
                "method": "POST",
                "url": "/api/mock/member/benefit-reconcile",
            },
        )
        db.add(suggestion)
        db.commit()
        db.refresh(suggestion)

        assert db.exec(select(Tool)).all() == []
        result = KnowledgeService(db).confirm_discovery(suggestion)

        assert result["status"] == "created"
        assert db.exec(select(Tool).where(Tool.name == "member.benefit_reconcile")).first()
        assert db.exec(select(Skill)).all() == []


def _b64(text: str) -> str:
    return base64.b64encode(text.encode("utf-8")).decode("ascii")


def _test_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)
