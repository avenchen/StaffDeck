"""Neutral persistence helper for relay-only chat session events.

Extracted from the chat controller so background services (e.g. session title
summarisation) can persist an ``AgentEvent`` without importing ``app.api.chat``
(which would create an api↔service import cycle). Depends only on the DB model.
"""

from __future__ import annotations

from sqlmodel import Session

from app.db.models import AgentEvent


def persist_relay_only_event(
    db: Session,
    tenant_id: str,
    session_id: str,
    event_type: str,
    payload: dict[str, object],
) -> None:
    db.add(
        AgentEvent(
            tenant_id=tenant_id,
            session_id=session_id,
            event_type=event_type,
            payload_json=payload,
        )
    )
    db.commit()
