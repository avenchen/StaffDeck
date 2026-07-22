"""Neutral knowledge-compaction projections.

These helpers project retrieved-knowledge and step-result payloads down to a
compact, token-bounded shape. They live in a leaf module (no dependency on the
``app.core`` or ``app.memory`` packages) so both the turn pipeline (``app.core``)
and memory capture (``app.memory``) can reuse them without a cross-package
import cycle. ``app.core.context_projection`` re-exports them for its callers.
"""

from __future__ import annotations

from typing import Any

KNOWLEDGE_HISTORY_LIMIT = 1
KNOWLEDGE_EVIDENCE_LIMIT = 6
KNOWLEDGE_CONCEPT_LIMIT = 8
KNOWLEDGE_DOCUMENT_LIMIT = 5
RETRIEVED_KNOWLEDGE_LIMIT = 4


def compact_knowledge_context(
    items: list[dict[str, Any]] | None,
    *,
    max_items: int = KNOWLEDGE_HISTORY_LIMIT,
) -> list[dict[str, Any]]:
    if not isinstance(items, list):
        return []
    selected = [item for item in items if isinstance(item, dict)][-max(1, max_items) :]
    return [_compact_knowledge_result(item) for item in selected]


def compact_step_result(payload: dict[str, Any]) -> dict[str, Any]:
    projected = dict(payload)
    projected.pop("knowledge_results", None)
    projected["retrieved_knowledge"] = compact_knowledge_context(
        payload.get("knowledge_results") if isinstance(payload.get("knowledge_results"), list) else []
    )
    return projected


def _compact_knowledge_result(item: dict[str, Any]) -> dict[str, Any]:
    query = item.get("query")
    if isinstance(query, dict):
        query = query.get("query")
    return _without_empty(
        {
            "query": _short_text(query, 500),
            "retrieved_knowledge": _compact_retrieved_knowledge(item),
        }
    )


def _compact_retrieved_knowledge(item: dict[str, Any]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    evidence = _dict_items(item.get("evidence_pack"), KNOWLEDGE_EVIDENCE_LIMIT)
    if not evidence:
        evidence = _dict_items(item.get("chunks"), KNOWLEDGE_EVIDENCE_LIMIT)
    for value in evidence:
        candidates.append(
            {
                "title": _short_text(value.get("title") or value.get("label"), 180),
                "source": _short_text(
                    value.get("section_path")
                    or value.get("source_path")
                    or value.get("source_ref"),
                    300,
                ),
                "summary": _short_text(value.get("summary"), 300),
                "content": _short_text(value.get("content") or value.get("excerpt"), 800),
            }
        )
    for value in _dict_items(item.get("selected_concepts"), KNOWLEDGE_CONCEPT_LIMIT):
        candidates.append(
            {
                "title": _short_text(value.get("title") or value.get("name"), 180),
                "source": _short_text(value.get("source_path") or value.get("concept_id"), 300),
                "summary": _short_text(value.get("summary"), 300),
                "content": _short_text(value.get("content") or value.get("content_md"), 600),
            }
        )
    for value in _dict_items(item.get("selected_documents"), KNOWLEDGE_DOCUMENT_LIMIT):
        candidates.append(
            {
                "title": _short_text(value.get("title") or value.get("filename"), 180),
                "source": _short_text(value.get("filename"), 180),
                "summary": _short_text(value.get("summary"), 600),
            }
        )
    for value in _dict_items(item.get("selected_buckets"), KNOWLEDGE_DOCUMENT_LIMIT):
        candidates.append(
            {
                "title": _short_text(value.get("title"), 180),
                "summary": _short_text(value.get("summary"), 600),
            }
        )
    for value in _dict_items(item.get("okf_citations"), KNOWLEDGE_EVIDENCE_LIMIT):
        candidates.append(
            {
                "title": _short_text(value.get("title") or value.get("label"), 180),
                "source": _short_text(
                    value.get("source_path") or value.get("path") or value.get("uri"),
                    300,
                ),
            }
        )

    compacted: list[dict[str, Any]] = []
    seen: set[str] = set()
    for candidate in candidates:
        projected = _without_empty(candidate)
        identity = "|".join(
            str(projected.get(key) or "")
            for key in ("source", "title", "content", "summary")
        ).strip("|")
        if not identity or identity in seen:
            continue
        seen.add(identity)
        compacted.append(
            {"label": f"檢索到的知識 {len(compacted) + 1}", **projected}
        )
        if len(compacted) >= RETRIEVED_KNOWLEDGE_LIMIT:
            break
    return compacted


def _dict_items(value: object, limit: int) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)][:limit]


def _short_text(value: object, limit: int) -> str:
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    return text[:limit].rstrip() + "..."


def _without_empty(value: dict[str, Any]) -> dict[str, Any]:
    return {
        key: item
        for key, item in value.items()
        if item is not None and item != "" and item != [] and item != {}
    }
