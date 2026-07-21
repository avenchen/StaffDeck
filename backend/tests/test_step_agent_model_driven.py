from app.core.step_agent import StepAgent
from app.db.models import ChatSession, Skill, Tool
from app.llm.client import LLMClient
from app.session.session_schema import RouterDecision


def test_step_agent_uses_model_json_for_slots_and_tool(monkeypatch):
    captured = {}

    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        captured["system_prompt"] = system_prompt
        captured["payload"] = payload
        return {
            "reply": None,
            "slot_updates": {"customer_name": "張三", "asset_id": "EQ-9", "issue": "無法啟動"},
            "tool_call": {
                "name": "ticket.create",
                "arguments": {
                    "customer_name": "張三",
                    "asset_id": "EQ-9",
                    "issue": "無法啟動",
                },
            },
            "next_step_id": "reply_ticket",
            "is_step_completed": True,
            "handoff": False,
        }

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)

    result = StepAgent().run(
        "我是張三，設備 EQ-9 無法啟動",
        ChatSession(
            id="session_test",
            tenant_id="tenant_demo",
            active_skill_id="repair_ticket",
            active_step_id="collect_issue",
            awaiting_input_json={
                "skill_id": "repair_ticket",
                "step_id": "collect_issue",
                "expected_fields": ["issue"],
                "question_summary": "請描述設備問題。",
            },
        ),
        _repair_skill(),
        [_ticket_tool()],
        model_config=None,  # type: ignore[arg-type]
        router_decision=RouterDecision(
            decision="start_new_task",
            target_skill_id="repair_ticket",
            user_intent="設備報修",
        ),
        recent_messages=[
            {"role": "user", "content": "我是張三，設備 EQ-9 無法啟動"},
        ],
        memory_context=[
            {
                "kind": "profile",
                "content": "張三",
                "metadata": {"key": "preferred_name"},
            }
        ],
    )

    assert "skill_id" not in captured["payload"]["active_skill"]
    assert "統一執行引擎" in captured["system_prompt"]
    assert "當前 SOP 的最小投影" in captured["payload"]["_agent_stage"]["instructions"]
    assert captured["payload"]["active_skill"]["current_step"]["node_id"] == (
        "collect_issue"
    )
    assert [
        step["node_id"] for step in captured["payload"]["active_skill"]["next_steps"]
    ] == ["reply_ticket"]
    assert "nodes" not in captured["payload"]["active_skill"]
    assert "edges" not in captured["payload"]["active_skill"]
    assert "adjacent_edges" not in captured["payload"]["active_skill"]
    assert "target_steps" not in captured["payload"]["active_skill"]
    assert "active_step" not in captured["payload"]
    assert captured["payload"]["router_decision"] == {
        "decision": "start_new_task",
        "user_intent": "設備報修",
    }
    assert "recent_messages" not in captured["payload"]
    assert captured["payload"]["_agent_stage"]["memory"] == ""
    assert captured["payload"]["awaiting_input"]["question_summary"] == "請描述設備問題。"
    assert "repair_context" in captured["payload"]
    assert captured["payload"]["available_tools"] == [
        {
            "name": "ticket.create",
            "description": "",
            "input_schema": _ticket_tool().input_schema,
        }
    ]
    assert "通用技能規則" not in captured["payload"]["_agent_stage"]["instructions"]
    assert result.slot_updates["asset_id"] == "EQ-9"
    assert result.action == "call_tool"
    assert result.tool_call is not None
    assert result.tool_call.name == "ticket.create"
    assert result.next_step_id == "reply_ticket"


def test_step_agent_compacts_knowledge_continuation_without_duplicate_results(monkeypatch):
    captured = {}

    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        captured["payload"] = payload
        return {"reply": "已找到相關信息", "is_step_completed": True}

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)
    knowledge_result = {
        "query": {"query": "設備故障"},
        "chunks": [{"id": "chunk_1", "content": "重複切片" * 2_000}],
        "expanded_sections": [{"content": "完整目錄樹" * 2_000}],
        "evidence_pack": [
            {
                "chunk_id": "chunk_1",
                "source_path": "維修指南/啟動失敗",
                "content": "檢查電源和保險絲" * 1_000,
            }
        ],
    }

    StepAgent().run(
        "設備無法啟動",
        ChatSession(
            id="session_test",
            tenant_id="tenant_demo",
            knowledge_context_json=[{"evidence_pack": [{"content": "上一輪舊知識"}]}],
        ),
        None,
        [],
        model_config=None,  # type: ignore[arg-type]
        repair_context={
            "reason": "knowledge_continuation",
            "knowledge_results": knowledge_result,
        },
        recent_messages=[{"role": "user", "content": "設備無法啟動"}],
        current_knowledge=[knowledge_result],
    )

    assert "recent_messages" not in captured["payload"]
    assert "knowledge_results" not in captured["payload"]["repair_context"]
    assert captured["payload"]["repair_context"]["knowledge_results_available_in"] == (
        "retrieved_knowledge"
    )
    compacted = captured["payload"]["retrieved_knowledge"][0]
    assert "chunks" not in compacted
    assert "expanded_sections" not in compacted
    assert "selected_documents" not in compacted
    assert "上一輪舊知識" not in str(captured["payload"])
    assert len(compacted["retrieved_knowledge"][0]["content"]) <= 803


def _repair_skill() -> Skill:
    return Skill(
        tenant_id="tenant_demo",
        skill_id="repair_ticket",
        name="設備報修",
        content_json={
            "skill_id": "repair_ticket",
            "name": "設備報修",
            "required_info": ["customer_name", "asset_id", "issue"],
            "nodes": [
                {
                    "node_id": "collect_issue",
                    "type": "collect_info",
                    "name": "收集報修信息",
                    "expected_user_info": ["customer_name", "asset_id", "issue"],
                    "allowed_actions": ["ask_user", "call_tool:ticket.create"],
                },
                {
                    "node_id": "reply_ticket",
                    "type": "response",
                    "name": "反饋工單",
                    "expected_user_info": [],
                    "allowed_actions": ["answer_user"],
                },
            ],
            "edges": [{"source_node_id": "collect_issue", "next_node_id": "reply_ticket"}],
            "start_node_id": "collect_issue",
            "terminal_node_ids": ["reply_ticket"],
        },
        status="published",
    )


def _ticket_tool() -> Tool:
    return Tool(
        tenant_id="tenant_demo",
        name="ticket.create",
        display_name="創建工單",
        method="POST",
        url="http://localhost:8000/api/mock/ticket/create",
        input_schema={
            "type": "object",
            "properties": {
                "customer_name": {"type": "string"},
                "asset_id": {"type": "string"},
                "issue": {"type": "string"},
            },
            "required": ["customer_name", "asset_id", "issue"],
        },
        output_schema={},
        enabled=True,
    )
