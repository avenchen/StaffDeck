from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.db.models import AgentProfile, Tenant
from app.scheduled_tasks import service as scheduled_service


def test_model_failure_does_not_create_keyword_based_draft(monkeypatch) -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(AgentProfile(id="agent_demo", tenant_id="tenant_demo", name="客服", is_overall=False))
        db.commit()
        monkeypatch.setattr(scheduled_service, "_detect_with_llm", lambda *args, **kwargs: None)

        draft = scheduled_service.detect_scheduled_task_draft(
            db,
            "tenant_demo",
            "agent_demo",
            "user_demo",
            "每週五18點復盤差評對話",
            "session_demo",
        )

        assert draft is None


def test_llm_draft_is_used_without_confidence_fallback(monkeypatch) -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(AgentProfile(id="agent_demo", tenant_id="tenant_demo", name="客服", is_overall=False))
        db.commit()

        monkeypatch.setattr(
            scheduled_service,
            "_detect_with_llm",
            lambda *args, **kwargs: scheduled_service._LLMScheduledTaskDraft(
                should_create=True,
                title="模型解析的一次性任務",
                prompt="到點後檢查 A1 價格並按條件購買",
                schedule_type="once",
                schedule={"run_at": "2026-06-22T14:10:00+08:00"},
                timezone="Asia/Shanghai",
                confidence=0.1,
                reason="模型已給出完整結構",
            ),
        )
        draft = scheduled_service.detect_scheduled_task_draft(
            db,
            "tenant_demo",
            "agent_demo",
            "user_demo",
            "下午2點10分幫我看下A1價格",
            "session_demo",
        )

        assert draft is not None
        assert draft.schedule_type == "once"
        assert draft.schedule["run_at"] == "2026-06-22T14:10:00+08:00"
        assert draft.confidence == 0.1


def test_llm_draft_defaults_to_requested_timezone(monkeypatch) -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(AgentProfile(id="agent_demo", tenant_id="tenant_demo", name="客服", is_overall=False))
        db.commit()

        monkeypatch.setattr(
            scheduled_service,
            "_detect_with_llm",
            lambda *args, **kwargs: scheduled_service._LLMScheduledTaskDraft(
                should_create=True,
                title="模型解析的週期任務",
                prompt="每天提醒喝水",
                schedule_type="daily",
                schedule={"time": "09:00"},
                confidence=0.8,
                reason="模型已給出完整結構",
            ),
        )

        draft = scheduled_service.detect_scheduled_task_draft(
            db,
            "tenant_demo",
            "agent_demo",
            "user_demo",
            "每天9點提醒我喝水",
            "session_demo",
            "America/Los_Angeles",
        )

        assert draft is not None
        assert draft.timezone == "America/Los_Angeles"
        assert draft.schedule == {"time": "09:00"}


def test_llm_negative_result_does_not_fallback(monkeypatch) -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(AgentProfile(id="agent_demo", tenant_id="tenant_demo", name="客服", is_overall=False))
        db.commit()

        monkeypatch.setattr(
            scheduled_service,
            "_detect_with_llm",
            lambda *args, **kwargs: scheduled_service._LLMScheduledTaskDraft(
                should_create=False,
                confidence=0.9,
                reason="不是自動任務",
            ),
        )
        draft = scheduled_service.detect_scheduled_task_draft(
            db,
            "tenant_demo",
            "agent_demo",
            "user_demo",
            "只是普通問題",
            "session_demo",
        )

        assert draft is None


def _test_session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)
