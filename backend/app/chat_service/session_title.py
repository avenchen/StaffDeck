"""Background session-title summarisation service.

Extracted from the chat controller (app.api.chat) so the fat controller keeps
only request wiring. Runs a best-effort background thread that, once a session
has its first user message, asks the model for a short title and persists it
(falling back to the first user message). app.api.chat re-exports the public
names for its endpoints and for backward-compatible test access.
"""

from __future__ import annotations

import threading
import time

from sqlmodel import Session, select

from app.agents.branching import model_for_agent
from app.db import engine
from app.db.models import AgentEvent, ChatSession, Message
from app.llm import LLMClient, LLMError
from app.observability.spans import bind_span_sink, llm_operation
from app.session.session_events import persist_relay_only_event

SESSION_TITLE_SUMMARY_EVENT = "session_title_summarized"

SESSION_TITLE_PROMPT = """你是任務派發臺的會話標題編輯器。

根據首輪用戶需求和員工回覆，生成一個簡短、可讀、具體的中文標題。

要求：
- 輸出 JSON object，格式為 {"title": "..."}。
- 直接輸出標題 JSON，不輸出分析、候選標題或解釋。
- 標題 4 到 18 箇中文字符優先，最多 24 個字符。
- 不要使用“新任務”“任務記錄”“用戶諮詢”等空泛標題。
- 不要包含標點符號、引號、編號、員工名或用戶稱呼。
- 如果無法判斷，就返回最能概括用戶需求的短語。
"""

_session_title_summary_jobs: set[str] = set()
_session_title_summary_jobs_lock = threading.Lock()


def schedule_session_title_summary(
    tenant_id: str,
    user_id: str,
    session_id: str,
    agent_id: str | None,
) -> None:
    if not session_id:
        return
    job_key = f"{tenant_id}:{user_id}:{session_id}"
    with _session_title_summary_jobs_lock:
        if job_key in _session_title_summary_jobs:
            return
        _session_title_summary_jobs.add(job_key)

    def run() -> None:
        try:
            summarize_session_title_once(tenant_id, user_id, session_id, agent_id)
        finally:
            with _session_title_summary_jobs_lock:
                _session_title_summary_jobs.discard(job_key)

    thread = threading.Thread(
        target=run,
        daemon=True,
    )
    thread.start()


def summarize_session_title_once(
    tenant_id: str,
    user_id: str,
    session_id: str,
    agent_id: str | None,
) -> None:
    try:
        for attempt in range(8):
            messages: list[Message] = []
            model_config = None
            effective_agent_id = agent_id
            with Session(engine) as db:
                session = db.exec(
                    select(ChatSession).where(
                        ChatSession.id == session_id,
                        ChatSession.tenant_id == tenant_id,
                        ChatSession.user_id == user_id,
                    )
                ).first()
                if not session:
                    return
                if (session.title or "").strip():
                    return
                existing = db.exec(
                    select(AgentEvent).where(
                        AgentEvent.tenant_id == tenant_id,
                        AgentEvent.session_id == session_id,
                        AgentEvent.event_type == SESSION_TITLE_SUMMARY_EVENT,
                    )
                ).first()
                if existing:
                    return
                messages = db.exec(
                    select(Message)
                    .where(Message.tenant_id == tenant_id, Message.session_id == session_id)
                    .order_by(Message.created_at)
                    .limit(6)
                ).all()
                if not any(row.role == "user" for row in messages):
                    messages = []
                else:
                    effective_agent_id = agent_id or session.agent_id
                    model_config = model_for_agent(db, tenant_id, effective_agent_id)

            if not messages:
                if attempt < 7:
                    time.sleep(0.25)
                    continue
                return

            payload = {
                "current_title": "",
                "messages": [
                    {"role": row.role, "content": row.content[:1200]}
                    for row in messages
                    if row.role in {"user", "assistant"}
                ],
            }
            title = ""
            title_source = "first_user_fallback"
            if model_config:
                try:
                    title_turn_id = next((row.id for row in messages if row.role == "user"), "")

                    def persist_title_span(
                        event_type: str, event_payload: dict[str, object]
                    ) -> None:
                        traced_payload = dict(event_payload)
                        if title_turn_id:
                            traced_payload.setdefault("turn_id", title_turn_id)
                            traced_payload.setdefault("user_message_id", title_turn_id)
                        with Session(engine) as span_db:
                            persist_relay_only_event(
                                span_db,
                                tenant_id,
                                session_id,
                                event_type,
                                traced_payload,
                            )

                    with bind_span_sink(persist_title_span), llm_operation("session.title"):
                        raw = LLMClient(model_config).generate_json(SESSION_TITLE_PROMPT, payload)
                    title = _normalize_auto_title(str(raw.get("title") or ""))
                    if title:
                        title_source = "first_turn_summary"
                except LLMError:
                    title = ""
            if not title:
                title = _fallback_session_title(messages)
            if not title:
                return

            with Session(engine) as db:
                session = db.exec(
                    select(ChatSession).where(
                        ChatSession.id == session_id,
                        ChatSession.tenant_id == tenant_id,
                        ChatSession.user_id == user_id,
                    )
                ).first()
                if not session:
                    return
                if (session.title or "").strip():
                    return
                existing = db.exec(
                    select(AgentEvent).where(
                        AgentEvent.tenant_id == tenant_id,
                        AgentEvent.session_id == session_id,
                        AgentEvent.event_type == SESSION_TITLE_SUMMARY_EVENT,
                    )
                ).first()
                if existing:
                    return
                session.title = title
                db.add(session)
                db.add(
                    AgentEvent(
                        tenant_id=tenant_id,
                        session_id=session_id,
                        event_type=SESSION_TITLE_SUMMARY_EVENT,
                        payload_json={
                            "title": title,
                            "source": title_source,
                            "agent_id": effective_agent_id,
                        },
                    )
                )
                db.commit()
                return
    except (LLMError, Exception):
        return


def session_title_summary_payload(
    db: Session, tenant_id: str, session_id: str
) -> dict[str, str] | None:
    event = db.exec(
        select(AgentEvent)
        .where(
            AgentEvent.tenant_id == tenant_id,
            AgentEvent.session_id == session_id,
            AgentEvent.event_type == SESSION_TITLE_SUMMARY_EVENT,
        )
        .order_by(AgentEvent.created_at.desc())
        .limit(1)
    ).first()
    payload = event.payload_json if event else None
    title = payload.get("title") if isinstance(payload, dict) else None
    if not isinstance(title, str) or not title.strip():
        return None
    return {"sessionId": session_id, "title": title.strip()}


def _normalize_auto_title(value: str) -> str:
    title = value.strip().strip("\"'“”‘’`")
    for token in ("\n", "\r", "\t", "：", ":", "。", "，", ",", "；", ";"):
        title = title.replace(token, " ")
    title = " ".join(part for part in title.split() if part)
    return title[:24]


def _fallback_session_title(messages: list[Message]) -> str:
    first_user = next((row.content for row in messages if row.role == "user" and row.content.strip()), "")
    if not first_user:
        return ""
    return _normalize_auto_title(first_user)
