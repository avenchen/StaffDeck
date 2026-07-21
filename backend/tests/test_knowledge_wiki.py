from __future__ import annotations

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.db.models import (
    KnowledgeBase,
    KnowledgeBucket,
    KnowledgeChunk,
    KnowledgeDocument,
    Tenant,
)
from app.knowledge.wiki import WikiService


def _session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _seed_kb(db: Session) -> None:
    db.add(Tenant(id="tenant_demo", name="Demo"))
    db.add(KnowledgeBase(id="kb_demo", tenant_id="tenant_demo", name="售後知識庫", description="售後政策"))
    db.add(
        KnowledgeDocument(
            id="doc1",
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            filename="policy.md",
            file_type="md",
            title="售後政策",
            status="ready",
            bucket_count=1,
            chunk_count=2,
        )
    )
    db.add(
        KnowledgeBucket(
            id="bucket1",
            tenant_id="tenant_demo",
            knowledge_base_id="kb_demo",
            document_id="doc1",
            bucket_key="0001",
            title="退款政策",
            summary="七天內可退款",
            token_estimate=42,
            metadata_json={"chunk_count": 2},
        )
    )
    for idx in range(2):
        db.add(
            KnowledgeChunk(
                id=f"chunk{idx}",
                tenant_id="tenant_demo",
                knowledge_base_id="kb_demo",
                document_id="doc1",
                bucket_id="bucket1",
                chunk_index=idx,
                content=f"退款說明第{idx}段：七天內無理由退款。",
                source_ref=f"policy.md#{idx}",
            )
        )
    db.commit()


def test_wiki_outline_builds_tree() -> None:
    with _session() as db:
        _seed_kb(db)
        outline = WikiService(db).outline("tenant_demo", "kb_demo", version_ids=[])
        assert outline.name == "售後知識庫"
        assert outline.document_count == 1
        assert outline.documents[0].title == "售後政策"
        assert outline.documents[0].buckets[0].title == "退款政策"
        assert outline.documents[0].buckets[0].chunk_count == 2


def test_wiki_outline_missing_kb_raises() -> None:
    with _session() as db:
        _seed_kb(db)
        try:
            WikiService(db).outline("tenant_demo", "kb_missing", version_ids=[])
        except LookupError:
            return
        raise AssertionError("expected LookupError for missing knowledge base")


def test_wiki_ask_without_model_emits_error() -> None:
    with _session() as db:
        _seed_kb(db)
        events = list(
            WikiService(db).ask_stream(
                "tenant_demo", None, "kb_demo", [], "怎麼退款", model_config=None
            )
        )
        assert events[0]["event"] == "error"
        assert "模型" in events[0]["data"]["message"]


def test_wiki_ask_empty_query_emits_error() -> None:
    with _session() as db:
        _seed_kb(db)
        events = list(
            WikiService(db).ask_stream(
                "tenant_demo", None, "kb_demo", [], "   ", model_config=None
            )
        )
        assert events[0]["event"] == "error"
