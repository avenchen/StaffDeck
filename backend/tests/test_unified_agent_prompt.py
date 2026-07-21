from types import SimpleNamespace

from app.core.reflection_agent import ReflectionAgent
from app.core.response_generator import ResponseGenerator
from app.core.router import Router
from app.core.step_agent import StepAgent
from app.db.models import ChatSession, GeneralSkill
from app.general_skills.runner import GeneralSkillRunner, GeneralSkillSelector
from app.llm import LLMClient
from app.session.session_schema import StepAgentResult
from app.tools.tool_schema import ToolCall


def test_four_agent_stages_use_identical_system_and_stage_local_user_content(
    monkeypatch,
) -> None:
    systems: dict[str, str] = {}
    payloads: dict[str, dict] = {}

    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        phase = payload["_agent_stage"]["phase"]
        systems[phase] = system_prompt
        payloads[phase] = payload
        if phase == "Router":
            return {"decision": "answer_only", "confidence": 0.9}
        if phase == "Step Agent":
            return {"action": "reply", "reply": "正在處理", "is_step_completed": False}
        if phase == "Reflection":
            return {"action": "pass", "needs_retry": False}
        raise AssertionError(f"unexpected phase: {phase}")

    def fake_generate_text(self, system_prompt, payload):  # noqa: ANN001
        phase = payload["_agent_stage"]["phase"]
        systems[phase] = system_prompt
        payloads[phase] = payload
        return "最終回覆"

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)
    monkeypatch.setattr(LLMClient, "generate_text", fake_generate_text)

    session = ChatSession(id="session_test", tenant_id="tenant_demo")
    context = {
        "messages": [{"role": "user", "content": "當前問題"}],
        "metadata": {"current_turn_time": "2026-07-13T20:45:00+08:00"},
    }
    memory = [{"content": "用戶偏好簡潔回答", "id": "internal_memory_id"}]
    router_decision = Router().decide(
        "當前問題",
        session,
        [],
        model_config=None,  # type: ignore[arg-type]
        conversation_context=context,
        memory_context=memory,
    )
    step_result = StepAgent().run(
        "當前問題",
        session,
        None,
        [],
        model_config=None,  # type: ignore[arg-type]
        router_decision=router_decision,
        conversation_context=context,
        memory_context=memory,
    )
    ReflectionAgent().review(
        "當前問題",
        session,
        None,
        router_decision,
        StepAgentResult(tool_call=ToolCall(name="demo", arguments={})),
        None,
        [],
        [],
        model_config=None,  # type: ignore[arg-type]
        conversation_context=context,
        memory_context=memory,
    )
    ResponseGenerator().generate(
        "當前問題",
        session,
        None,
        router_decision,
        step_result,
        None,
        model_config=None,  # type: ignore[arg-type]
        memory_context=memory,
        conversation_context=context,
    )

    assert set(systems) == {"Router", "Step Agent", "Reflection", "Response Generator"}
    assert len(set(systems.values())) == 1
    assert "統一執行引擎" in next(iter(systems.values()))
    for phase, payload in payloads.items():
        assert payload["_agent_stage"]["memory"] == (
            "- 用戶偏好簡潔回答" if phase == "Router" else ""
        )
        assert payload["_agent_stage"]["turn_time"] == "2026-07-13T20:45:00+08:00"
        assert payload["user_message"] == "當前問題"
        assert "internal_memory_id" not in str(payload)
        assert payload["_agent_stage"]["instructions"]
        assert payload["_agent_stage"]["output_contract"]


def test_general_skill_substages_use_the_same_unified_system_prompt(monkeypatch) -> None:
    systems: dict[str, str] = {}

    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        phase = payload["_agent_stage"]["phase"]
        systems[phase] = system_prompt
        if phase == "Router / General Skill Selector":
            return {
                "use_general_skill": True,
                "selected_slug": "weather-zh",
                "use_knowledge": False,
                "confidence": 0.9,
            }
        if phase == "Step Agent / General Skill Plan":
            return {
                "runtime": "python",
                "code": "print('{}')",
                "rationale": "執行測試",
                "expected_output": "JSON",
            }
        if phase == "Reflection / General Skill Review":
            return {
                "result_sufficient": True,
                "needs_retry": False,
                "terminal": False,
                "reason": "結果可用",
            }
        if phase == "Response Generator / General Skill Reply":
            return {"reply": "執行完成"}
        raise AssertionError(f"unexpected phase: {phase}")

    def fake_execute_plan(  # noqa: ANN001
        self,
        skill,
        query,
        plan,
        user_id,
        trace,
        event_sink=None,
        attempt=1,
    ):
        return '{"success": true}', "", {"success": True}

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)
    monkeypatch.setattr(GeneralSkillRunner, "_execute_plan", fake_execute_plan)

    context = {
        "messages": [{"role": "user", "content": "查詢北京天氣"}],
        "metadata": {"current_turn_time": "2026-07-13T21:10:00+08:00"},
    }
    skill = GeneralSkill(
        tenant_id="tenant_demo",
        slug="weather-zh",
        name="中國城市天氣",
        description="查詢中國城市天氣",
        skill_markdown="# 天氣查詢",
        status="published",
    )
    model_config = SimpleNamespace(
        api_key_encrypted="encrypted",
        base_url="https://example.test/v1",
        model="demo-model",
        temperature=0.2,
        max_output_tokens=8192,
    )

    selection = GeneralSkillSelector().decide(
        "查詢北京天氣",
        [skill],
        model_config=model_config,  # type: ignore[arg-type]
        conversation_context=context,
        memory_context=[],
    )
    assert selection.selected_slug == "weather-zh"
    response = GeneralSkillRunner().run(
        skill,
        "查詢北京天氣",
        model_config=model_config,  # type: ignore[arg-type]
        user_id="user_demo",
        conversation_context=context,
        memory_context=[],
    )

    assert response.reply == "執行完成"
    assert set(systems) == {
        "Router / General Skill Selector",
        "Step Agent / General Skill Plan",
        "Reflection / General Skill Review",
        "Response Generator / General Skill Reply",
    }
    assert len(set(systems.values())) == 1
    assert "統一執行引擎" in next(iter(systems.values()))
