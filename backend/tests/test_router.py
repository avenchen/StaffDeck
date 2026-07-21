import pytest

from app.core.router import Router
from app.db.models import ChatSession, Skill
from app.llm import LLMClient, LLMError


def test_router_payload_only_exposes_skill_routing_summary(monkeypatch):
    captured = {}

    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        captured["system_prompt"] = system_prompt
        captured["payload"] = payload
        purchase = next(item for item in payload["available_skills"] if item["skill_id"] == "purchase")
        assert purchase == {
            "skill_id": "purchase",
            "name": "購買商品流程",
            "description": "幫助用戶購買商品。",
            "trigger_intents": ["購買", "下單"],
        }
        assert "統一執行引擎" in system_prompt
        assert "不要讓原則10吞掉複合意圖" in payload["_agent_stage"]["instructions"]
        assert "不讀取 SOP 節點圖" in payload["_agent_stage"]["instructions"]
        return {
            "decision": "answer_only",
            "target_skill_id": "price_compare",
            "target_step_id": "collect_products",
            "confidence": 0.92,
            "user_intent": "購買前比價",
            "reason": "用戶提出臨時問題，本輪僅回答，不隱式切換或恢復任務。",
            "clarification_question": "",
        }

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)

    decision = Router().decide(
        "我叫hm，我想買A1，但買之前我想先跟A3比個價",
        ChatSession(
            id="session_test",
            tenant_id="tenant_demo",
            active_skill_id="purchase",
            active_step_id="collect_user_name",
            slots_json={},
        ),
        [_purchase_skill(), _price_compare_skill()],
        model_config=None,  # type: ignore[arg-type]
        memory_context=[{"kind": "profile", "content": "hm", "metadata": {"key": "preferred_name"}}],
    )

    assert decision.decision == "answer_only"
    assert decision.target_skill_id == "price_compare"
    assert decision.target_step_id == "collect_products"
    assert captured["payload"]["current_session"]["active_skill_id"] == "purchase"
    assert captured["payload"]["_agent_stage"]["memory"] == "- hm"
    assert "knowledge_context" not in captured["payload"]["current_session"]
    assert "tenant_id" not in captured["payload"]["current_session"]


def test_router_accepts_ordered_current_turn_task_frames(monkeypatch):
    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        assert "task_frames" in payload["_agent_stage"]["instructions"]
        assert payload["current_session"]["active_skill_id"] == "refund"
        return {
            "decision": "continue_active",
            "target_skill_id": "refund",
            "target_step_id": "confirm_refund_order",
            "confidence": 0.93,
            "user_intent": "確認當前退貨，並在完成後購買 A3",
            "reason": "用戶先確認當前退貨，再提出後續購買任務。",
            "clarification_question": "",
            "task_frames": [
                {
                    "decision": "continue_active",
                    "target_skill_id": "refund",
                    "target_step_id": "confirm_refund_order",
                    "user_intent": "確認當前退貨",
                    "slot_hints": {"order_id": "O1", "refund_type": "退貨"},
                },
                {
                    "decision": "start_new_task",
                    "target_skill_id": "purchase",
                    "target_step_id": "",
                    "confidence": 0.9,
                    "user_intent": "購買 A3",
                    "reason": "用戶說退完後想買一個 A3。",
                    "source_message": "退了吧，退完我想買一個a3",
                    "slot_hints": {"product_id": "A3", "quantity": 1},
                }
            ],
        }

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)

    decision = Router().decide(
        "退了吧，退完我想買一個a3",
        ChatSession(
            id="session_test",
            tenant_id="tenant_demo",
            active_skill_id="refund",
            active_step_id="confirm_refund_order",
            slots_json={"order_id": "O1", "refund_type": "退貨"},
        ),
        [_refund_skill(), _purchase_skill()],
        model_config=None,  # type: ignore[arg-type]
    )

    assert decision.decision == "continue_active"
    assert decision.target_skill_id == "refund"
    assert decision.pending_tasks == []
    assert [task.target_skill_id for task in decision.task_frames] == ["refund", "purchase"]
    assert decision.task_frames[1].target_step_id == "collect_user_name"


def test_router_keeps_general_subtask_with_active_scene(monkeypatch):
    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        assert "general_intent" in payload["_agent_stage"]["instructions"]
        return {
            "decision": "continue_active",
            "target_skill_id": "purchase",
            "confidence": 0.96,
            "user_intent": "購買 A1 並查詢北京天氣",
            "general_intent": "查詢北京當前天氣",
            "reason": "購買由當前流程處理，天氣交給執行階段的通用 Skill。",
            "slot_hints": {"product_id": "A1"},
        }

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)

    decision = Router().decide(
        "我想買 A1，同時看下北京天氣",
        ChatSession(
            id="session_test",
            tenant_id="tenant_demo",
            active_skill_id="purchase",
            active_step_id="collect_user_name",
        ),
        [_purchase_skill()],
        model_config=None,  # type: ignore[arg-type]
    )

    assert decision.decision == "continue_active"
    assert decision.target_skill_id == "purchase"
    assert decision.general_intent == "查詢北京當前天氣"
    assert decision.slot_hints == {"product_id": "A1"}


def test_router_converts_legacy_create_pending_tasks_to_current_turn_frames(monkeypatch):
    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        assert "不會再調用獨立 scheduler" in payload["_agent_stage"]["instructions"]
        return {
            "decision": "create_pending",
            "confidence": 0.95,
            "user_intent": "先購買 A3，再購買 A1",
            "pending_tasks": [
                {
                    "task_id": "task_purchase_a3",
                    "target_skill_id": "purchase",
                    "user_intent": "購買 A3",
                    "slot_hints": {"product_id": "A3"},
                },
                {
                    "task_id": "task_purchase_a1",
                    "target_skill_id": "purchase",
                    "user_intent": "購買 A1",
                    "slot_hints": {"product_id": "A1"},
                },
            ],
        }

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)

    decision = Router().decide(
        "先買 A3，再買 A1",
        ChatSession(id="session_test", tenant_id="tenant_demo"),
        [_purchase_skill()],
        model_config=None,  # type: ignore[arg-type]
    )

    assert decision.decision == "start_new_task"
    assert decision.selected_task_id == "task_purchase_a3"
    assert decision.target_skill_id == "purchase"
    assert decision.slot_hints == {"product_id": "A3"}
    assert decision.pending_tasks == []
    assert [task.task_id for task in decision.task_frames] == [
        "task_purchase_a3",
        "task_purchase_a1",
    ]


def test_router_rejects_noncanonical_answer_alias(monkeypatch):
    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        return {
            "decision": "answer",
            "confidence": 0.8,
            "user_intent": "閒聊問候",
            "reason": "用戶只是問候。",
        }

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)

    with pytest.raises(LLMError, match="invalid JSON schema"):
        Router().decide(
            "你好啊",
            ChatSession(id="session_test", tenant_id="tenant_demo"),
            [_purchase_skill()],
            model_config=None,  # type: ignore[arg-type]
        )


def test_router_rejects_unknown_decision_instead_of_guessing_intent(monkeypatch):
    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        return {
            "decision": "respond_to_user",
            "confidence": 0.2,
            "user_intent": "未知",
        }

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)

    with pytest.raises(LLMError, match="invalid JSON schema"):
        Router().decide(
            "你好啊",
            ChatSession(id="session_test", tenant_id="tenant_demo"),
            [_purchase_skill()],
            model_config=None,  # type: ignore[arg-type]
        )


def test_router_removes_hallucinated_target_skill_from_non_matching_flow(monkeypatch):
    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        assert "不要編造 target_skill_id" in payload["_agent_stage"]["instructions"]
        return {
            "decision": "clarify",
            "target_skill_id": "skill_weather_query",
            "target_step_id": "step_query_weather",
            "confidence": 0.85,
            "user_intent": "查詢海淀區天氣",
            "reason": "模型錯誤地假設存在天氣流程。",
        }

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)

    decision = Router().decide(
        "我想看下海淀區的天氣",
        ChatSession(id="session_test", tenant_id="tenant_demo"),
        [_purchase_skill()],
        model_config=None,  # type: ignore[arg-type]
    )

    assert decision.decision == "clarify"
    assert decision.target_skill_id is None
    assert decision.target_step_id is None


def test_router_strips_generated_message_content_slots(monkeypatch):
    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        assert "禁止填寫 `message_content`" in payload["_agent_stage"]["instructions"]
        return {
            "decision": "continue_active",
            "target_skill_id": "purchase",
            "target_step_id": "collect_user_name",
            "confidence": 0.91,
            "user_intent": "購買 A1",
            "slot_hints": {"message_content": "模型改寫後的整段輸入", "product_id": "A1"},
            "pending_tasks": [
                {
                    "decision": "start_new_task",
                    "target_skill_id": "purchase",
                    "target_step_id": "collect_user_name",
                    "slot_hints": {"message_content": "後續任務改寫", "quantity": 1},
                }
            ],
            "created_tasks": [
                {
                    "decision": "start_new_task",
                    "target_skill_id": "purchase",
                    "target_step_id": "collect_user_name",
                    "slot_hints": {"message_content": "新建任務改寫", "user_name": "hm"},
                }
            ],
            "task_updates": [
                {
                    "task_id": "task_purchase_a3",
                    "slot_hints": {"message_content": "更新任務改寫", "product_id": "A3"},
                }
            ],
        }

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)

    decision = Router().decide(
        "我要買 A1",
        ChatSession(id="session_test", tenant_id="tenant_demo", active_skill_id="purchase"),
        [_purchase_skill()],
        model_config=None,  # type: ignore[arg-type]
    )

    assert decision.slot_hints == {"product_id": "A1"}
    assert decision.pending_tasks[0].slot_hints == {"quantity": 1}
    assert decision.created_tasks == []
    assert decision.task_frames[0].slot_hints == {"product_id": "A1", "user_name": "hm"}
    assert decision.task_updates[0].slot_hints == {"product_id": "A3"}


def _purchase_skill() -> Skill:
    return Skill(
        tenant_id="tenant_demo",
        skill_id="purchase",
        name="購買商品流程",
        description="幫助用戶購買商品。",
        status="published",
        content_json={
            "business_domain": "commerce",
            "trigger_intents": ["購買", "下單"],
            "required_info": ["user_name", "product_id", "quantity"],
            "nodes": [
                {
                    "node_id": "collect_user_name",
                    "type": "collect_info",
                    "name": "收集用戶信息與商品詳情",
                    "instruction": "收集姓名、商品和數量。",
                    "expected_user_info": ["user_name", "product_id", "quantity"],
                    "allowed_actions": ["ask_user", "continue_flow"],
                }
            ],
            "edges": [],
            "start_node_id": "collect_user_name",
            "terminal_node_ids": ["collect_user_name"],
        },
    )


def _price_compare_skill() -> Skill:
    return Skill(
        tenant_id="tenant_demo",
        skill_id="price_compare",
        name="商品比價服務",
        description="比較兩個商品的價格。",
        status="published",
        content_json={
            "business_domain": "commerce",
            "trigger_intents": ["比價", "價格對比"],
            "required_info": ["product_name_1", "product_name_2"],
            "nodes": [
                {
                    "node_id": "collect_products",
                    "type": "collect_info",
                    "name": "收集待比價商品",
                    "instruction": "收集兩個商品名。",
                    "expected_user_info": ["product_name_1", "product_name_2"],
                    "allowed_actions": ["ask_user", "continue_flow"],
                }
            ],
            "edges": [],
            "start_node_id": "collect_products",
            "terminal_node_ids": ["collect_products"],
        },
    )


def _refund_skill() -> Skill:
    return Skill(
        tenant_id="tenant_demo",
        skill_id="refund",
        name="售後退款流程",
        description="處理退貨退款。",
        status="published",
        content_json={
            "business_domain": "after_sales",
            "trigger_intents": ["退貨", "退款"],
            "required_info": ["order_id"],
            "nodes": [
                {
                    "node_id": "confirm_refund_order",
                    "type": "collect_info",
                    "name": "確認售後訂單",
                    "instruction": "確認訂單後繼續。",
                    "expected_user_info": ["order_confirmed"],
                    "allowed_actions": ["ask_user", "continue_flow"],
                }
            ],
            "edges": [],
            "start_node_id": "confirm_refund_order",
            "terminal_node_ids": ["confirm_refund_order"],
        },
    )
