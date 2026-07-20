"""Wiki service — a minimal read/browse + LLM-Q&A layer over knowledge data.

It composes existing building blocks:
- outline: aggregates documents and their buckets into a wiki tree.
- ask: reuses ``KnowledgeService.search`` for retrieval, then streams an
  LLM-synthesised answer that cites the retrieved buckets.

The service holds no state beyond its DB session; endpoints own tenancy and
visibility checks before calling it.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from sqlmodel import Session, select

from app.db.models import (
    KnowledgeBase,
    KnowledgeBucket,
    KnowledgeDocument,
    ModelConfig,
)
from app.knowledge.schema import KnowledgeSearchRequest
from app.knowledge.service import KnowledgeService
from app.knowledge.wiki_schema import (
    WikiAnswer,
    WikiBucketNode,
    WikiCitation,
    WikiDocumentNode,
    WikiOutline,
)
from app.llm.client import LLMClient

WIKI_ANSWER_SYSTEM_PROMPT = (
    "你是企業知識庫的 Wiki 助手。只依據提供的「知識片段」回答使用者問題，"
    "不要編造知識片段以外的內容。回答需條理清楚、使用繁體或原文語言，"
    "並在每個引用到的事實後標註來源編號，格式為 [n]（n 對應知識片段編號）。"
    "若知識片段不足以回答，請明確說明目前知識庫沒有相關內容。"
)

MAX_EVIDENCE_ITEMS = 8
SNIPPET_CHARS = 320


class WikiService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ---- browse ------------------------------------------------------------

    def outline(
        self, tenant_id: str, knowledge_base_id: str, version_ids: list[str]
    ) -> WikiOutline:
        kb = self.db.get(KnowledgeBase, knowledge_base_id)
        if kb is None or kb.tenant_id != tenant_id:
            raise LookupError("knowledge base not found")

        documents = self.db.exec(
            select(KnowledgeDocument)
            .where(
                KnowledgeDocument.tenant_id == tenant_id,
                KnowledgeDocument.knowledge_base_id == knowledge_base_id,
            )
            .order_by(KnowledgeDocument.created_at)
        ).all()
        documents = [
            doc
            for doc in documents
            if not version_ids
            or doc.knowledge_base_version_id in version_ids
            or doc.knowledge_base_version_id is None
        ]

        nodes: list[WikiDocumentNode] = []
        total_buckets = 0
        total_chunks = 0
        for doc in documents:
            buckets = self.db.exec(
                select(KnowledgeBucket)
                .where(
                    KnowledgeBucket.tenant_id == tenant_id,
                    KnowledgeBucket.document_id == doc.id,
                )
                .order_by(KnowledgeBucket.bucket_key)
            ).all()
            bucket_nodes = [
                WikiBucketNode(
                    id=bucket.id,
                    bucket_key=bucket.bucket_key,
                    title=bucket.title,
                    summary=bucket.summary,
                    token_estimate=bucket.token_estimate,
                    chunk_count=int((bucket.metadata_json or {}).get("chunk_count") or 0),
                )
                for bucket in buckets
            ]
            total_buckets += len(bucket_nodes)
            total_chunks += doc.chunk_count
            nodes.append(
                WikiDocumentNode(
                    id=doc.id,
                    title=doc.title or doc.filename,
                    filename=doc.filename,
                    file_type=doc.file_type,
                    status=doc.status,
                    bucket_count=doc.bucket_count or len(bucket_nodes),
                    chunk_count=doc.chunk_count,
                    buckets=bucket_nodes,
                )
            )

        return WikiOutline(
            knowledge_base_id=kb.id,
            name=kb.name,
            description=kb.description,
            document_count=len(nodes),
            bucket_count=total_buckets,
            chunk_count=total_chunks,
            documents=nodes,
        )

    # ---- ask ---------------------------------------------------------------

    def _retrieve(
        self,
        tenant_id: str,
        agent_id: str | None,
        knowledge_base_id: str | None,
        version_ids: list[str],
        query: str,
        model_config: ModelConfig | None,
    ) -> tuple[list[WikiCitation], list[dict[str, Any]]]:
        request = KnowledgeSearchRequest(
            tenant_id=tenant_id,
            agent_id=agent_id,
            query=query,
            mode="chat",
            knowledge_base_ids=[knowledge_base_id] if knowledge_base_id else [],
            knowledge_base_version_ids=version_ids,
        )
        result = KnowledgeService(self.db).search(request, model_config)

        bucket_titles = {bucket.id: bucket.title for bucket in result.selected_buckets}
        citations: list[WikiCitation] = []
        for chunk in result.chunks[:MAX_EVIDENCE_ITEMS]:
            snippet = (chunk.content or "").strip().replace("\n", " ")
            if len(snippet) > SNIPPET_CHARS:
                snippet = snippet[:SNIPPET_CHARS] + "…"
            citations.append(
                WikiCitation(
                    index=len(citations) + 1,
                    bucket_id=chunk.bucket_id,
                    document_id=chunk.document_id,
                    title=bucket_titles.get(chunk.bucket_id, "知識片段"),
                    snippet=snippet,
                    source_ref=chunk.source_ref,
                )
            )
        return citations, result.route_trace or result.trace

    def ask_stream(
        self,
        tenant_id: str,
        agent_id: str | None,
        knowledge_base_id: str | None,
        version_ids: list[str],
        query: str,
        model_config: ModelConfig | None,
    ) -> Iterator[dict[str, Any]]:
        query = (query or "").strip()
        if not query:
            yield {"event": "error", "data": {"message": "問題不可為空"}}
            return
        if model_config is None:
            yield {
                "event": "error",
                "data": {"message": "尚未配置可用的模型，請先在「模型配置」中設定預設模型"},
            }
            return

        citations, trace = self._retrieve(
            tenant_id, agent_id, knowledge_base_id, version_ids, query, model_config
        )
        yield {
            "event": "retrieval",
            "data": {
                "citations": [c.model_dump() for c in citations],
                "trace": trace,
            },
        }

        if not citations:
            message = "目前知識庫沒有找到與問題相關的內容。"
            yield {"event": "answer_delta", "data": {"text": message}}
            yield {
                "event": "complete",
                "data": WikiAnswer(answer=message, citations=[], trace=trace).model_dump(),
            }
            return

        evidence = "\n\n".join(
            f"[{c.index}] {c.title}\n{c.snippet}" for c in citations
        )
        user_payload = f"知識片段：\n{evidence}\n\n使用者問題：{query}"

        parts: list[str] = []
        try:
            client = LLMClient(model_config)
            for delta in client.generate_text_stream(WIKI_ANSWER_SYSTEM_PROMPT, user_payload):
                if not delta:
                    continue
                parts.append(delta)
                yield {"event": "answer_delta", "data": {"text": delta}}
        except Exception as exc:  # noqa: BLE001 — surface as a stream error event
            yield {"event": "error", "data": {"message": f"模型回覆失敗：{exc}"}}
            return

        answer = "".join(parts).strip()
        yield {
            "event": "complete",
            "data": WikiAnswer(answer=answer, citations=citations, trace=trace).model_dump(),
        }
