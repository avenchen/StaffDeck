"""Wiki view endpoints — browse knowledge as a wiki and ask cited questions.

Kept in its own thin router (not the already-large ``knowledge.py``) per the
minimal-component principle: one file, one concern.
"""

from __future__ import annotations

import json
from collections.abc import Iterator

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from app.agents.branching import visible_knowledge_base_version_ids
from app.db import get_session
from app.db.models import ModelConfig, User
from app.knowledge.wiki import WikiService
from app.knowledge.wiki_schema import WikiAskRequest, WikiOutline
from app.security.auth import get_current_user
from app.security.permissions import require_agent_scope_viewer
from app.security.tenant import ensure_tenant

router = APIRouter(
    prefix="/api/enterprise/knowledge/wiki",
    tags=["enterprise:knowledge-wiki"],
    dependencies=[Depends(get_current_user)],
)


def _resolve_model(db: Session, tenant_id: str, model_config_id: str | None) -> ModelConfig | None:
    if model_config_id:
        model_config = db.get(ModelConfig, model_config_id)
        if not model_config or model_config.tenant_id != tenant_id or not model_config.enabled:
            raise HTTPException(status_code=404, detail="Model config not found")
        return model_config
    return db.exec(
        select(ModelConfig).where(
            ModelConfig.tenant_id == tenant_id,
            ModelConfig.is_default == True,  # noqa: E712
            ModelConfig.enabled == True,  # noqa: E712
        )
    ).first()


@router.get("/{knowledge_base_id}/outline", response_model=WikiOutline)
def get_wiki_outline(
    knowledge_base_id: str,
    tenant_id: str = Query(...),
    agent_id: str | None = Query(default=None),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> WikiOutline:
    require_agent_scope_viewer(tenant_id, agent_id, current_user, db)
    ensure_tenant(db, tenant_id)
    version_ids = visible_knowledge_base_version_ids(db, tenant_id, agent_id)
    try:
        return WikiService(db).outline(tenant_id, knowledge_base_id, version_ids)
    except LookupError:
        raise HTTPException(status_code=404, detail="Knowledge base not found")


@router.post("/ask")
def ask_wiki(
    request: WikiAskRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    require_agent_scope_viewer(request.tenant_id, request.agent_id, current_user, db)
    ensure_tenant(db, request.tenant_id)
    model_config = _resolve_model(db, request.tenant_id, request.model_config_id)
    version_ids = visible_knowledge_base_version_ids(db, request.tenant_id, request.agent_id)

    def event_stream() -> Iterator[str]:
        for item in WikiService(db).ask_stream(
            request.tenant_id,
            request.agent_id,
            request.knowledge_base_id,
            version_ids,
            request.query,
            model_config,
        ):
            payload = json.dumps(item["data"], ensure_ascii=False)
            yield f"event: {item['event']}\ndata: {payload}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
