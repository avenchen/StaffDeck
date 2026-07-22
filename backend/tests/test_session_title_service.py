from __future__ import annotations

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.chat_service import session_title
from app.chat_service.session_title import (
    SESSION_TITLE_SUMMARY_EVENT,
    _fallback_session_title,
    _normalize_auto_title,
    session_title_summary_payload,
    summarize_session_title_once,
)
from app.db.models import AgentEvent, ChatSession, Message


def _test_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


def test_normalize_auto_title_strips_punctuation_and_truncates() -> None:
    assert _normalize_auto_title('"北京天氣：查詢"') == "北京天氣 查詢"
    assert len(_normalize_auto_title("字" * 40)) == 24


def test_fallback_session_title_uses_first_user_message() -> None:
    messages = [
        Message(id="m1", tenant_id="t", session_id="s", role="assistant", content="您好"),
        Message(id="m2", tenant_id="t", session_id="s", role="user", content="請幫我退款訂單 123"),
    ]
    assert _fallback_session_title(messages) == "請幫我退款訂單 123"


def test_summarize_falls_back_without_model_config(monkeypatch) -> None:
    engine = _test_engine()
    monkeypatch.setattr(session_title, "engine", engine)
    # No model configured for the agent -> fallback to first user message.
    monkeypatch.setattr(session_title, "model_for_agent", lambda *a, **k: None)
    with Session(engine) as db:
        db.add(ChatSession(id="s1", tenant_id="t", user_id="u"))
        db.add(Message(id="m1", tenant_id="t", session_id="s1", role="user", content="查詢天氣"))
        db.commit()

    summarize_session_title_once("t", "u", "s1", None)

    with Session(engine) as db:
        row = db.get(ChatSession, "s1")
        event = db.exec(
            select(AgentEvent).where(
                AgentEvent.session_id == "s1",
                AgentEvent.event_type == SESSION_TITLE_SUMMARY_EVENT,
            )
        ).first()
        payload = session_title_summary_payload(db, "t", "s1")

    assert row is not None and row.title == "查詢天氣"
    assert event is not None and event.payload_json["source"] == "first_user_fallback"
    assert payload == {"sessionId": "s1", "title": "查詢天氣"}
