from app.core.response_generator import ResponseGenerator
from app.db.models import ChatSession, Skill
from app.llm.client import LLMClient
from app.session.session_schema import RouterDecision, StepAgentResult
from app.tools.tool_schema import ToolError, ToolResult


def test_response_payload_has_single_source_for_each_business_fact() -> None:
    skill = Skill(
        tenant_id="tenant_demo",
        skill_id="medical",
        name="問診",
        status="published",
        content_json={
            "response_rules": ["給出明確建議"],
            "nodes": [
                {
                    "node_id": "collect",
                    "type": "collect_info",
                    "name": "收集症狀",
                    "instruction": "收集仍然缺失的症狀信息。",
                    "expected_user_info": ["symptom", "duration"],
                }
            ],
        },
    )
    decision = RouterDecision(
        decision="continue_active",
        source_message="腹瀉兩天",
        slot_hints={"duration": "兩天"},
    )
    payload = ResponseGenerator()._payload(
        "腹瀉兩天",
        ChatSession(
            id="session_test",
            tenant_id="tenant_demo",
            active_skill_id="medical",
            active_step_id="collect",
            slots_json={"symptom": "腹瀉", "duration": "兩天"},
            awaiting_input_json={"expected_fields": ["age"]},
        ),
        skill,
        decision,
        StepAgentResult(
            reply="請補充年齡",
            slot_updates={"duration": "兩天"},
            is_step_completed=False,
        ),
        None,
    )

    assert payload["current_step"]["instruction"] == "收集仍然缺失的症狀信息。"
    assert payload["slots"] == {"symptom": "腹瀉", "duration": "兩天"}
    assert payload["step_summary"] == {
        "reply": "請補充年齡",
        "is_step_completed": False,
        "handoff": False,
    }
    assert payload["response_rules"] == ["給出明確建議"]
    assert "active_skill" not in payload
    assert "router_decision" not in payload
    assert "session" not in payload
    assert "slot_updates" not in str(payload)
    assert "source_message" not in str(payload)
    assert "awaiting_input" not in str(payload)


def test_multi_task_payload_projects_all_results_for_one_final_reply() -> None:
    generator = ResponseGenerator()
    payload = generator._payload(
        "先查詢額度，再提交報銷",
        ChatSession(id="session_test", tenant_id="tenant_demo"),
        None,
        RouterDecision(decision="start_new_task", user_intent="處理兩個任務"),
        StepAgentResult(),
        None,
        task_results=[
            {
                "task": "查詢額度",
                "slots": {"employee_id": "E-1"},
                "step_result": {
                    "action": "reply",
                    "reply": "剩餘額度 1000 元",
                    "knowledge_results": [],
                    "is_step_completed": True,
                    "handoff": False,
                },
                "tool_result": {"tool_name": "quota.query", "success": True},
            },
            {
                "task": "提交報銷",
                "slots": {"amount": 500},
                "step_result": {
                    "action": "ask_user",
                    "reply": "請補充發票",
                    "knowledge_results": [],
                    "is_step_completed": False,
                    "handoff": False,
                },
                "tool_result": None,
            },
        ],
    )

    assert set(payload) == {"user_message", "conversation_context", "task_results"}
    assert [item["task"] for item in payload["task_results"]] == ["查詢額度", "提交報銷"]
    assert payload["task_results"][0]["step_summary"]["reply"] == "剩餘額度 1000 元"
    assert payload["task_results"][1]["step_summary"]["reply"] == "請補充發票"


def test_clarify_does_not_leak_internal_router_prompt(monkeypatch):
    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_text(self, system_prompt, payload):  # noqa: ANN001
        return "請提供當前用戶消息、會話狀態、技能進度及可用技能列表，以便進行準確的路由決策。"

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_text", fake_generate_text)
    session = ChatSession(
        id="session_test",
        tenant_id="tenant_demo",
        active_skill_id="repair_ticket",
        active_step_id="collect_repair_info",
    )
    decision = RouterDecision(
        decision="clarify",
        clarification_question="請提供當前用戶消息、會話狀態、技能進度及可用技能列表，以便進行準確的路由決策。",
    )
    step_result = StepAgentResult(reply="好的，請描述一下設備問題，我會繼續為您處理。")

    reply = ResponseGenerator().generate(
        message="我想報修設備",
        session=session,
        skill=None,
        router_decision=decision,
        step_result=step_result,
        tool_result=None,
        model_config=None,  # type: ignore[arg-type]
    )

    assert reply == step_result.reply
    assert "技能進度" not in reply
    assert "路由" not in reply


def test_tool_result_reply_is_model_driven(monkeypatch):
    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_text(self, system_prompt, payload):  # noqa: ANN001
        assert payload["tool_result"]["tool_name"] == "ticket.create"
        return "已創建報修工單 T-100，工程師會盡快聯繫您。"

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_text", fake_generate_text)

    reply = ResponseGenerator().generate(
        message="設備壞了",
        session=ChatSession(id="session_test", tenant_id="tenant_demo"),
        skill=None,
        router_decision=RouterDecision(decision="continue_active"),
        step_result=StepAgentResult(),
        tool_result=ToolResult(
            tool_name="ticket.create",
            success=True,
            data={"ticket_id": "T-100", "status": "created"},
        ),
        model_config=None,  # type: ignore[arg-type]
    )

    assert reply == "已創建報修工單 T-100，工程師會盡快聯繫您。"


def test_failed_tool_result_returns_explicit_failure_without_model_call(monkeypatch):
    def forbidden_generate_text(self, system_prompt, payload):  # noqa: ANN001
        raise AssertionError("failed tool replies should not rely on model generation")

    monkeypatch.setattr(LLMClient, "generate_text", forbidden_generate_text)

    reply = ResponseGenerator().generate(
        message="查一下訂單",
        session=ChatSession(id="session_test", tenant_id="tenant_demo"),
        skill=None,
        router_decision=RouterDecision(decision="continue_active"),
        step_result=StepAgentResult(),
        tool_result=ToolResult(
            tool_name="order.query",
            success=False,
            error=ToolError(code="HTTP_ERROR", message="工具返回異常狀態碼：502"),
        ),
        model_config=None,  # type: ignore[arg-type]
    )

    assert reply == "工具調用失敗：order.query（HTTP_ERROR）：工具返回異常狀態碼：502。請檢查工具配置、調用參數或外部服務狀態後重試。"


def test_model_failure_returns_explicit_reason(monkeypatch):
    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_text(self, system_prompt, payload):  # noqa: ANN001
        raise RuntimeError("upstream timeout")

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_text", fake_generate_text)

    reply = ResponseGenerator().generate(
        message="你好",
        session=ChatSession(id="session_test", tenant_id="tenant_demo"),
        skill=None,
        router_decision=RouterDecision(decision="answer_only"),
        step_result=StepAgentResult(reply="你好"),
        tool_result=None,
        model_config=None,  # type: ignore[arg-type]
    )

    assert reply == "模型調用失敗（LLM_ERROR）：upstream timeout。請檢查模型配置、API Key、網絡或模型服務狀態後重試。"


def test_pending_reply_without_tool_result_uses_model_reply(monkeypatch):
    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_text(self, system_prompt, payload):  # noqa: ANN001
        return "好的，正在為您創建訂單，請稍候..."

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_text", fake_generate_text)

    reply = ResponseGenerator().generate(
        message="一個",
        session=ChatSession(
            id="session_test",
            tenant_id="tenant_demo",
            last_agent_question="請問您想購買多少件？",
        ),
        skill=None,
        router_decision=RouterDecision(decision="continue_active"),
        step_result=StepAgentResult(reply="請補充完成當前步驟所需的信息。"),
        tool_result=None,
        model_config=None,  # type: ignore[arg-type]
    )

    assert reply == "好的，正在為您創建訂單，請稍候..."


def test_pending_step_reply_without_tool_result_does_not_fall_back_to_last_question(monkeypatch):
    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_text(self, system_prompt, payload):  # noqa: ANN001
        return "正在處理，請稍等。"

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_text", fake_generate_text)

    reply = ResponseGenerator().generate(
        message="hm",
        session=ChatSession(
            id="session_test",
            tenant_id="tenant_demo",
            last_agent_question="請提供您的訂單號。",
        ),
        skill=None,
        router_decision=RouterDecision(decision="continue_active"),
        step_result=StepAgentResult(reply="正在為您提交，請稍候。"),
        tool_result=None,
        model_config=None,  # type: ignore[arg-type]
    )

    assert reply == "正在處理，請稍等。"
    assert reply != "請提供您的訂單號。"


def test_pending_phrase_in_confirmation_question_is_not_rejected(monkeypatch):
    step_reply = (
        "好的，已為您記錄購買 1 個 A1 的意向。"
        "稍後我會為您處理 iPhone 15 的購買需求。"
        "請問確認為您創建 1 個 A1 的訂單嗎？"
    )

    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_text(self, system_prompt, payload):  # noqa: ANN001
        return step_reply

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_text", fake_generate_text)

    reply = ResponseGenerator().generate(
        message="嗯，我買一個A1吧，然後我還想再買一個iphone15",
        session=ChatSession(
            id="session_test",
            tenant_id="tenant_demo",
            active_skill_id="skill_purchase_001",
            active_step_id="confirm_purchase",
            slots_json={"user_name": "哈", "product_id": "A1", "quantity": 1},
            pending_tasks_json=[
                {
                    "decision": "start_new_task",
                    "target_skill_id": "skill_purchase_001",
                    "target_step_id": "collect_user_name",
                    "slot_hints": {"product_id": "iphone15", "quantity": 1},
                }
            ],
        ),
        skill=None,
        router_decision=RouterDecision(decision="continue_active"),
        step_result=StepAgentResult(reply=step_reply, next_step_id="confirm_purchase"),
        tool_result=None,
        model_config=None,  # type: ignore[arg-type]
    )

    assert reply == step_reply
    assert "具體訴求" not in reply


def test_response_payload_does_not_include_stale_last_question(monkeypatch):
    stale_price_reply = (
        "您好，已為您查詢到 A1 和 A3 的價格信息：\n\n"
        "1. **A1 標準商品**：價格 **129.0 元**\n"
        "2. **A3 高階商品**：價格 **239.0 元**\n\n"
        "請問您是否決定購買 A1？"
    )
    refund_reply = "好的，已為您記錄退款申請。為了繼續處理，請提供您的訂單號。"

    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_text(self, system_prompt, payload):  # noqa: ANN001
        assert "session" not in payload
        assert payload["step_summary"]["reply"] == refund_reply
        return stale_price_reply

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_text", fake_generate_text)

    reply = ResponseGenerator().generate(
        message="確認退款",
        session=ChatSession(
            id="session_test",
            tenant_id="tenant_demo",
            active_skill_id="after_sales_refund",
            active_step_id="process_refund",
            last_agent_question=stale_price_reply,
        ),
        skill=None,
        router_decision=RouterDecision(decision="continue_active"),
        step_result=StepAgentResult(reply=refund_reply, is_step_completed=True),
        tool_result=None,
        model_config=None,  # type: ignore[arg-type]
    )

    assert reply == stale_price_reply


def test_stream_payload_does_not_include_stale_last_question(monkeypatch):
    stale_price_reply = "A1 和 A3 的比價結果如下。請問您是否決定購買 A1？"
    refund_reply = "好的，已為您記錄退款申請。為了繼續處理，請提供您的訂單號。"

    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_text_stream(self, system_prompt, payload):  # noqa: ANN001
        assert "session" not in payload
        yield stale_price_reply[:12]
        yield stale_price_reply[12:]

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_text_stream", fake_generate_text_stream)

    chunks = list(
        ResponseGenerator().generate_stream(
            message="確認退款",
            session=ChatSession(
                id="session_test",
                tenant_id="tenant_demo",
                active_skill_id="after_sales_refund",
                active_step_id="process_refund",
                last_agent_question=stale_price_reply,
            ),
            skill=None,
            router_decision=RouterDecision(decision="continue_active"),
            step_result=StepAgentResult(reply=refund_reply, is_step_completed=True),
            tool_result=None,
            model_config=None,  # type: ignore[arg-type]
        )
    )

    reply = "".join(chunks)
    assert reply == stale_price_reply


def test_stream_reply_with_tool_result_is_model_driven(monkeypatch):
    stale_price_reply = "A1 和 A3 的比價結果如下。請問您是否決定購買 A1？"
    refund_reply = "訂單 MOCKD57272DB0E 的退款申請已提交，當前狀態為處理中。"

    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_text_stream(self, system_prompt, payload):  # noqa: ANN001
        assert payload["tool_result"]["tool_name"] == "order.refund"
        yield stale_price_reply[:12]
        yield stale_price_reply[12:]

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_text_stream", fake_generate_text_stream)

    chunks = list(
        ResponseGenerator().generate_stream(
            message="確認退款",
            session=ChatSession(
                id="session_test",
                tenant_id="tenant_demo",
                active_skill_id="after_sales_refund",
                active_step_id="process_refund",
                last_agent_question=stale_price_reply,
            ),
            skill=None,
            router_decision=RouterDecision(decision="continue_active"),
            step_result=StepAgentResult(reply=refund_reply, is_step_completed=True),
            tool_result=ToolResult(
                tool_name="order.refund",
                success=True,
                data={"order_id": "MOCKD57272DB0E", "refund_status": "processing"},
            ),
            model_config=None,  # type: ignore[arg-type]
        )
    )

    reply = "".join(chunks)
    assert reply == stale_price_reply


def test_stream_failed_tool_result_returns_explicit_failure_without_model_call(monkeypatch):
    def forbidden_generate_text_stream(self, system_prompt, payload):  # noqa: ANN001
        raise AssertionError("failed tool replies should not rely on model generation")

    monkeypatch.setattr(LLMClient, "generate_text_stream", forbidden_generate_text_stream)

    chunks = list(
        ResponseGenerator().generate_stream(
            message="查一下訂單",
            session=ChatSession(id="session_test", tenant_id="tenant_demo"),
            skill=None,
            router_decision=RouterDecision(decision="continue_active"),
            step_result=StepAgentResult(),
            tool_result=ToolResult(
                tool_name="order.query",
                success=False,
                error=ToolError(code="TIMEOUT", message="工具調用超時。"),
            ),
            model_config=None,  # type: ignore[arg-type]
        )
    )

    assert "".join(chunks) == "工具調用失敗：order.query（TIMEOUT）：工具調用超時。請檢查工具配置、調用參數或外部服務狀態後重試。"


def test_stream_model_failure_returns_explicit_reason(monkeypatch):
    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_text_stream(self, system_prompt, payload):  # noqa: ANN001
        raise RuntimeError("connection refused")
        yield ""  # pragma: no cover

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_text_stream", fake_generate_text_stream)

    chunks = list(
        ResponseGenerator().generate_stream(
            message="你好",
            session=ChatSession(id="session_test", tenant_id="tenant_demo"),
            skill=None,
            router_decision=RouterDecision(decision="answer_only"),
            step_result=StepAgentResult(reply="你好"),
            tool_result=None,
            model_config=None,  # type: ignore[arg-type]
        )
    )

    assert "".join(chunks) == "模型調用失敗（LLM_ERROR）：connection refused。請檢查模型配置、API Key、網絡或模型服務狀態後重試。"


def test_stream_pending_reply_without_tool_result_is_model_driven(monkeypatch):
    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_text_stream(self, system_prompt, payload):  # noqa: ANN001
        yield "好的，"
        yield "正在為您創建訂單，請稍候..."

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_text_stream", fake_generate_text_stream)

    chunks = list(
        ResponseGenerator().generate_stream(
            message="一個",
            session=ChatSession(
                id="session_test",
                tenant_id="tenant_demo",
                last_agent_question="請問您想購買多少件？",
            ),
            skill=None,
            router_decision=RouterDecision(decision="continue_active"),
            step_result=StepAgentResult(reply="請補充完成當前步驟所需的信息。"),
            tool_result=None,
            model_config=None,  # type: ignore[arg-type]
        )
    )

    reply = "".join(chunks)
    assert reply == "好的，正在為您創建訂單，請稍候..."


def test_stream_reply_yields_provider_chunks_without_collecting_first(monkeypatch):
    emitted: list[str] = []

    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_text_stream(self, system_prompt, payload):  # noqa: ANN001
        emitted.append("provider_started")
        yield "第一段"
        emitted.append("after_first_chunk")
        yield "第二段"

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_text_stream", fake_generate_text_stream)

    stream = ResponseGenerator().generate_stream(
        message="繼續",
        session=ChatSession(id="session_test", tenant_id="tenant_demo"),
        skill=None,
        router_decision=RouterDecision(decision="answer_only"),
        step_result=StepAgentResult(),
        tool_result=None,
        model_config=None,  # type: ignore[arg-type]
    )

    assert next(stream) == "第一段"
    assert emitted == ["provider_started"]
    assert next(stream) == "第二段"
    assert emitted == ["provider_started", "after_first_chunk"]


def test_completed_step_reply_is_model_driven(monkeypatch):
    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_text(self, system_prompt, payload):  # noqa: ANN001
        assert payload["progress"]["missing_current_step_info"] == []
        assert payload["progress"]["missing_required_info"] == []
        assert payload["progress"]["skill_completion_ready"] is True
        return "請問您的退貨原因是什麼？"

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_text", fake_generate_text)

    reply = ResponseGenerator().generate(
        message="不喜歡",
        session=ChatSession(
            id="session_test",
            tenant_id="tenant_demo",
            active_skill_id="refund",
            active_step_id="collect_refund_reason",
            slots_json={"order_id": "A12345", "refund_reason": "不喜歡"},
            last_agent_question="請問您的退貨原因是什麼？",
        ),
        skill=Skill(
            tenant_id="tenant_demo",
            skill_id="refund",
            name="退款",
            status="published",
            content_json={
                "required_info": ["order_id", "refund_reason"],
                "steps": [
                    {
                        "step_id": "collect_refund_reason",
                        "expected_user_info": ["refund_reason"],
                        "allowed_actions": ["ask_user", "continue_flow"],
                    }
                ],
            },
        ),
        router_decision=RouterDecision(decision="continue_active"),
        step_result=StepAgentResult(
            reply="已記錄退貨原因，正在為您提交退貨申請，請稍候。",
            is_step_completed=True,
            next_step_id="collect_refund_reason",
        ),
        tool_result=None,
        model_config=None,  # type: ignore[arg-type]
    )

    assert reply == "請問您的退貨原因是什麼？"


def test_knowledge_result_does_not_prefer_generic_step_reply(monkeypatch):
    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_text(self, system_prompt, payload):  # noqa: ANN001
        assert payload["retrieved_knowledge"]
        assert payload["knowledge_citation_hints"]
        assert "knowledge_results" not in payload["step_summary"]
        assert "slot_updates" not in payload["step_summary"]
        assert "active_skill" not in payload
        assert "router_decision" not in payload
        assert "session" not in payload
        assert "content" not in payload["knowledge_citation_hints"][0]
        assert len(
            payload["retrieved_knowledge"][0]["retrieved_knowledge"][0]["content"]
        ) <= 803
        return "前端規範包括目錄組織、命名規範和組件編寫規範。[1]"

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_text", fake_generate_text)

    reply = ResponseGenerator().generate(
        message="前端規範有哪些？",
        session=ChatSession(id="session_test", tenant_id="tenant_demo"),
        skill=None,
        router_decision=RouterDecision(decision="answer_only", user_intent="瞭解前端編碼規範"),
        step_result=StepAgentResult(
            reply="請您再補充一下具體訴求，我會繼續幫您處理。",
            knowledge_results=[
                {
                    "source_message": "前端規範有哪些？",
                    "evidence_pack": [
                        {
                            "source_path": "vue3-coding-standards.md / 前端編碼規範 / evidence 1",
                            "excerpt": "前端規範包括目錄組織、命名規範、組件編寫規範。" * 200,
                            "reason": "命中前端規範問題",
                        }
                    ],
                }
            ],
        ),
        tool_result=None,
        model_config=None,  # type: ignore[arg-type]
    )

    assert reply == "前端規範包括目錄組織、命名規範和組件編寫規範。[1]"
def test_response_generator_skips_model_for_simple_step_question(monkeypatch) -> None:
    def fail_generate_text(*_args, **_kwargs):
        raise AssertionError("simple ask_user reply must not call the response model")

    monkeypatch.setattr("app.core.response_generator.LLMClient.generate_text", fail_generate_text)
    reply = ResponseGenerator().generate(
        "我要報銷",
        ChatSession(id="session_test", tenant_id="tenant_demo"),
        None,
        RouterDecision(decision="continue_active"),
        StepAgentResult(action="ask_user", reply="請補充報銷金額。"),
        None,
        model_config=None,  # type: ignore[arg-type]
    )

    assert reply == "請補充報銷金額。"


def test_response_generator_stream_skips_model_for_simple_clarification(monkeypatch) -> None:
    def fail_generate_text_stream(*_args, **_kwargs):
        raise AssertionError("simple clarification must not call the response model")

    monkeypatch.setattr(
        "app.core.response_generator.LLMClient.generate_text_stream",
        fail_generate_text_stream,
    )
    chunks = list(
        ResponseGenerator().generate_stream(
            "我要辦理業務",
            ChatSession(id="session_test", tenant_id="tenant_demo"),
            None,
            RouterDecision(decision="continue_active"),
            StepAgentResult(action="clarify", reply="請說明具體業務類型。"),
            None,
            model_config=None,  # type: ignore[arg-type]
        )
    )

    assert "".join(chunks) == "請說明具體業務類型。"
