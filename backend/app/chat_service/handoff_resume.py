"""Human-handoff resume service.

Extracted from the chat controller (app.api.chat). When an operator answers a
human-handoff request, this runs a best-effort background turn that feeds the
human reply back into the agent loop, recording resume start/finish/failure
events. app.api.chat re-exports ``resume_human_handoff_async`` for its endpoint.
"""

from __future__ import annotations

import threading

from sqlmodel import Session

from app.core import AgentLoop
from app.db import engine
from app.db.models import AgentEvent, ChatSession, HumanHandoffRequest, utc_now
from app.session.session_schema import ChatTurnRequest


def resume_human_handoff_async(handoff_id: str) -> None:
    thread = threading.Thread(target=resume_human_handoff_worker, args=(handoff_id,), daemon=True)
    thread.start()


def resume_human_handoff_worker(handoff_id: str) -> None:
    try:
        with Session(engine) as db:
            handoff = db.get(HumanHandoffRequest, handoff_id)
            if not handoff or handoff.status != "answered" or not handoff.human_reply:
                return
            chat_session = db.get(ChatSession, handoff.session_id)
            if not chat_session or chat_session.tenant_id != handoff.tenant_id:
                return
            metadata = dict(handoff.metadata_json or {})
            if metadata.get("resume_started_at"):
                return
            now = utc_now()
            metadata["resume_started_at"] = now.isoformat()
            handoff.metadata_json = metadata
            db.add(handoff)
            db.add(
                AgentEvent(
                    tenant_id=handoff.tenant_id,
                    session_id=handoff.session_id,
                    event_type="human_handoff_resume_started",
                    payload_json={
                        "handoff_id": handoff.id,
                        "agent_id": handoff.agent_id,
                        "trigger_skill_id": handoff.trigger_skill_id,
                        "trigger_step_id": handoff.trigger_step_id,
                    },
                    created_at=now,
                )
            )
            db.commit()

            request = ChatTurnRequest(
                tenant_id=handoff.tenant_id,
                session_id=handoff.session_id,
                agent_id=handoff.agent_id or chat_session.agent_id,
                user_id=handoff.requester_user_id or chat_session.user_id or "",
                message=handoff.human_reply,
                channel="human_handoff_resume",
                debug=False,
            )
            AgentLoop(db).handle_turn(request)
            metadata = dict(handoff.metadata_json or {})
            metadata["resume_finished_at"] = utc_now().isoformat()
            handoff.metadata_json = metadata
            db.add(handoff)
            db.commit()
    except Exception as exc:
        with Session(engine) as db:
            handoff = db.get(HumanHandoffRequest, handoff_id)
            if not handoff:
                return
            metadata = dict(handoff.metadata_json or {})
            metadata["resume_failed_at"] = utc_now().isoformat()
            metadata["resume_error"] = str(exc)[:300]
            handoff.status = "failed"
            handoff.metadata_json = metadata
            handoff.updated_at = utc_now()
            db.add(handoff)
            db.add(
                AgentEvent(
                    tenant_id=handoff.tenant_id,
                    session_id=handoff.session_id,
                    event_type="human_handoff_resume_failed",
                    payload_json={"handoff_id": handoff.id, "error": str(exc)[:300]},
                )
            )
            db.commit()
