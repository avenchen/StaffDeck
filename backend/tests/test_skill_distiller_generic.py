import json

from app.skills.skill_distiller import SkillDistiller
from app.skills.skill_schema import SkillDistillRequest


def _normalize(raw: dict, request: SkillDistillRequest):
    return SkillDistiller()._normalize_response(_graph_raw(raw), request)  # noqa: SLF001


def _graph_raw(raw: dict) -> dict:
    converted = dict(raw)
    draft = converted.get("draft_skill") if isinstance(converted.get("draft_skill"), dict) else None
    if draft is None:
        return converted
    draft = dict(draft)
    legacy_steps = draft.pop("steps", None)
    if isinstance(legacy_steps, list):
        nodes = []
        for index, step in enumerate(legacy_steps):
            if not isinstance(step, dict):
                continue
            node_id = str(step.get("step_id") or step.get("node_id") or f"node_{index + 1}")
            actions = [str(action) for action in step.get("allowed_actions", [])]
            nodes.append(
                {
                    "node_id": node_id,
                    "type": "tool_call" if any(action.startswith("call_tool:") for action in actions) else "collect_info",
                    "name": step.get("name") or node_id,
                    "instruction": step.get("instruction") or "",
                    "expected_user_info": step.get("expected_user_info") or [],
                    "allowed_actions": actions,
                }
            )
        draft["nodes"] = nodes
        draft["edges"] = [
            {
                "source_node_id": nodes[index]["node_id"],
                "next_node_id": nodes[index + 1]["node_id"],
                "priority": index,
                "label": "默認推進",
            }
            for index in range(len(nodes) - 1)
        ]
        if nodes:
            draft["start_node_id"] = nodes[0]["node_id"]
            draft["terminal_node_ids"] = [nodes[-1]["node_id"]]
    converted["draft_skill"] = draft
    return converted


def test_fallback_card_is_not_domain_hardcoded_for_commerce_text() -> None:
    request = SkillDistillRequest(
        tenant_id="tenant_demo",
        title="購買商品",
        raw_content="獲取用戶姓名，查詢商品是否存在，生成對應訂單號，反饋給用戶",
        available_tools=[
            {"name": "product.purchase", "input_schema": {"required": ["product_id"]}, "requires_confirmation": True},
            {"name": "order.add", "input_schema": {"required": ["product_id"]}, "requires_confirmation": True},
        ],
    )

    card = SkillDistiller()._fallback_card(request)  # noqa: SLF001

    assert card.skill_id != "purchase_product"
    assert card.required_info == []
    assert all("operation_confirmed" not in node.expected_user_info for node in card.nodes)
    assert all(
        not any(action.startswith("call_tool:") for action in node.allowed_actions)
        for node in card.nodes
    )


def test_model_input_uses_plain_text_and_compacts_available_tools() -> None:
    request = SkillDistillRequest(
        tenant_id="tenant_demo",
        title="新SOP",
        raw_content="差旅報銷申請，收集事由和金額後提交審批。",
        available_tools=[
            {
                "id": "tool_internal_id",
                "name": "expense.submit",
                "display_name": "提交報銷單",
                "description": "提交差旅報銷申請。",
                "method": "POST",
                "url": "http://localhost:5173/api/mock/expense/submit",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "reason": {"type": "string", "description": "報銷事由"},
                        "amount": {"type": "number", "description": "報銷金額"},
                    },
                    "required": ["reason", "amount"],
                },
                "output_schema": {
                    "type": "object",
                    "properties": {"request_id": {"type": "string"}},
                },
            }
        ],
    )
    distiller = SkillDistiller()

    payload = distiller._payload(request)  # noqa: SLF001
    model_input = distiller._model_input(request, payload)  # noqa: SLF001

    projected_tool = payload["available_tools"][0]
    assert set(projected_tool) == {"name", "display_name", "description", "input_schema"}
    assert "output_schema" not in json.dumps(payload, ensure_ascii=False)
    assert "tool_internal_id" not in model_input
    assert "localhost:5173" not in model_input
    assert model_input.startswith("技能標題：新SOP\n原始流程：")
    assert "expense.submit（提交報銷單）" in model_input
    assert "reason (string, 必填)" in model_input
    assert not model_input.lstrip().startswith("{")


def test_slot_policy_targets_model_generated_fields() -> None:
    request = SkillDistillRequest(
        tenant_id="tenant_demo",
        title="設備報修",
        raw_content="收集設備編號和問題描述，創建維修工單",
    )
    raw = {
        "draft_skill": {
            "skill_id": "repair_ticket",
            "name": "設備報修",
            "required_info": ["asset_id"],
            "steps": [
                {
                    "step_id": "collect_repair_info",
                    "name": "收集報修信息",
                    "instruction": "同時抽取設備編號和問題描述。",
                    "expected_user_info": ["asset_id", "issue_desc"],
                    "allowed_actions": ["ask_user", "continue_flow"],
                }
            ],
        }
    }

    response = _normalize(raw, request)

    assert response.draft_skill.slot_filling_policy["target_info"] == ["asset_id", "issue_desc"]


def test_normalize_response_does_not_infer_tool_or_confirmation_from_raw_words() -> None:
    request = SkillDistillRequest(
        tenant_id="tenant_demo",
        title="退款處理",
        raw_content="獲取訂單號，核實訂單是否符合退款條件，處理退款並反饋給用戶",
        available_tools=[
            {
                "name": "order.query",
                "input_schema": {"required": ["order_id"]},
            }
        ],
    )
    raw = {
        "draft_skill": {
            "skill_id": "refund",
            "name": "退款處理",
            "required_info": ["order_id"],
            "steps": [
                {
                    "step_id": "collect_order",
                    "name": "收集訂單",
                    "instruction": "收集訂單號。",
                    "expected_user_info": ["order_id"],
                    "allowed_actions": ["ask_user", "continue_flow"],
                }
            ],
            "response_rules": [],
        }
    }

    response = _normalize(raw, request)
    nodes = response.draft_skill.nodes

    assert all(
        not any(action.startswith("call_tool:") for action in node.allowed_actions)
        for node in nodes
    )
    assert all("operation_confirmed" not in node.expected_user_info for node in nodes)
    assert "answer_user" in nodes[-1].allowed_actions
    assert any("不得把" in rule and "請稍候" in rule for rule in response.draft_skill.response_rules)
    assert any("自適應推進" in rule for rule in response.draft_skill.response_rules)
    assert not any("確認關鍵對象" in rule for rule in response.draft_skill.response_rules)
    assert all("目標而不是固定話術" in node.instruction for node in nodes)


def test_normalize_response_preserves_model_declared_tool_and_confirmation() -> None:
    request = SkillDistillRequest(
        tenant_id="tenant_demo",
        title="退款處理",
        raw_content="獲取訂單號，核實訂單是否符合退款條件，處理退款並反饋給用戶",
        available_tools=[
            {
                "name": "order.query",
                "input_schema": {"required": ["order_id"]},
            }
        ],
    )
    raw = {
        "draft_skill": {
            "skill_id": "refund",
            "name": "退款處理",
            "required_info": ["order_id"],
            "steps": [
                {
                    "step_id": "collect_order",
                    "name": "收集訂單",
                    "instruction": "收集訂單號。",
                    "expected_user_info": ["order_id"],
                    "allowed_actions": ["ask_user", "continue_flow"],
                },
                {
                    "step_id": "confirm_operation",
                    "name": "確認操作",
                    "instruction": "確認關鍵對象和操作內容。",
                    "expected_user_info": ["operation_confirmed"],
                    "allowed_actions": ["ask_user", "continue_flow"],
                },
                {
                    "step_id": "query_order",
                    "name": "查詢訂單",
                    "instruction": "調用工具查詢訂單狀態。",
                    "expected_user_info": [],
                    "allowed_actions": ["continue_flow", "call_tool:order.query"],
                }
            ],
            "response_rules": [],
        }
    }

    response = _normalize(raw, request)
    nodes = response.draft_skill.nodes

    assert any("call_tool:order.query" in node.allowed_actions for node in nodes)
    confirm_index = next(
        index for index, node in enumerate(nodes) if "operation_confirmed" in node.expected_user_info
    )
    tool_index = next(
        index
        for index, node in enumerate(nodes)
        if any(action.startswith("call_tool:") for action in node.allowed_actions)
    )
    assert confirm_index < tool_index
    assert "operation_confirmed=true" in nodes[tool_index].instruction
    assert "answer_user" in nodes[-1].allowed_actions
    assert any("不得把" in rule and "請稍候" in rule for rule in response.draft_skill.response_rules)
    assert any("自適應推進" in rule for rule in response.draft_skill.response_rules)
    assert any("確認關鍵對象" in rule for rule in response.draft_skill.response_rules)
    assert all("目標而不是固定話術" in node.instruction for node in nodes)


def test_normalize_response_makes_duplicate_step_ids_unique() -> None:
    request = SkillDistillRequest(
        tenant_id="tenant_demo",
        title="購買商品",
        raw_content="獲取用戶姓名，生成訂單號，反饋給用戶",
    )
    raw = {
        "draft_skill": {
            "skill_id": "purchase",
            "name": "購買商品",
            "required_info": ["user_name"],
            "steps": [
                {
                    "step_id": "reply_result",
                    "name": "創建訂單",
                    "instruction": "創建訂單。",
                    "expected_user_info": ["user_name"],
                    "allowed_actions": ["continue_flow"],
                },
                {
                    "step_id": "reply_result",
                    "name": "反饋訂單",
                    "instruction": "反饋訂單結果。",
                    "expected_user_info": [],
                    "allowed_actions": ["answer_user"],
                },
            ],
        }
    }

    response = _normalize(raw, request)
    step_ids = [node.node_id for node in response.draft_skill.nodes]

    assert len(step_ids) == len(set(step_ids))
    assert "reply_result" in step_ids
    assert "reply_result_2" in step_ids
    assert any("node_id" in warning for warning in response.warnings)


def test_normalize_response_turns_steps_into_adaptive_goals() -> None:
    request = SkillDistillRequest(
        tenant_id="tenant_demo",
        title="資料審核",
        raw_content="收集姓名和資料編號，審核資料狀態，反饋給用戶",
    )
    raw = {
        "draft_skill": {
            "skill_id": "document_review",
            "name": "資料審核",
            "required_info": ["user_name", "document_id"],
            "steps": [
                {
                    "step_id": "collect_info",
                    "name": "收集信息",
                    "instruction": "詢問用戶姓名和資料編號。",
                    "expected_user_info": ["user_name", "document_id"],
                    "allowed_actions": ["ask_user", "continue_flow"],
                },
                {
                    "step_id": "reply_result",
                    "name": "反饋結果",
                    "instruction": "反饋審核結果。",
                    "expected_user_info": [],
                    "allowed_actions": ["answer_user"],
                },
            ],
            "response_rules": [],
        }
    }

    response = _normalize(raw, request)

    assert response.draft_skill.slot_filling_policy["multi_slot_per_turn"] is True
    assert response.draft_skill.slot_filling_policy["skip_satisfied_steps"] is True
    assert all("目標而不是固定話術" in node.instruction for node in response.draft_skill.nodes)


def test_fallback_card_uses_conservative_adaptive_steps() -> None:
    request = SkillDistillRequest(
        tenant_id="tenant_demo",
        title="預約服務",
        raw_content="獲取用戶姓名，確認預約人數，創建預約記錄並反饋給用戶",
    )

    card = SkillDistiller()._fallback_card(request)  # noqa: SLF001

    assert card.required_info == []
    assert all(
        not any(action.startswith("call_tool:") for action in node.allowed_actions)
        for node in card.nodes
    )
    assert any("目標而不是固定話術" in node.instruction for node in card.nodes)


def test_normalize_response_removes_unknown_actions_without_default_tool_suggestion() -> None:
    request = SkillDistillRequest(
        tenant_id="tenant_demo",
        title="商品比價",
        raw_content="用戶提供兩個商品名稱，調用 product.compare 工具查詢價格並反饋比價結果",
        available_tools=[],
    )
    raw = {
        "draft_skill": {
            "skill_id": "compare_products",
            "name": "商品比價",
            "required_info": ["product_name_1", "product_name_2"],
            "steps": [
                {
                    "step_id": "compare",
                    "name": "查詢比價",
                    "instruction": "調用工具查詢兩個商品價格。",
                    "expected_user_info": ["product_name_1", "product_name_2"],
                    "allowed_actions": ["continue_flow", "call_tool:product.compare"],
                },
                {
                    "step_id": "reply_result",
                    "name": "反饋結果",
                    "instruction": "反饋比價結果。",
                    "expected_user_info": [],
                    "allowed_actions": ["answer_user"],
                },
            ],
            "response_rules": [],
        }
    }

    response = _normalize(raw, request)

    assert all(
        "call_tool:product.compare" not in node.allowed_actions
        for node in response.draft_skill.nodes
    )
    assert response.tool_suggestions == []
    assert any("未配置工具 product.compare" in warning for warning in response.warnings)


def test_normalize_response_resolves_tool_mentions_as_new_candidates() -> None:
    request = SkillDistillRequest(
        tenant_id="tenant_demo",
        title="商品比價",
        raw_content="用戶提供兩個商品名稱，POST /api/mock/product/compare 使用兩個商品名返回比價信息。",
        available_tools=[],
    )
    raw = {
        "draft_skill": {
            "skill_id": "compare_products",
            "name": "商品比價",
            "required_info": ["product_name_1", "product_name_2"],
            "steps": [
                {
                    "step_id": "compare",
                    "name": "查詢比價",
                    "instruction": "調用工具查詢兩個商品價格。",
                    "expected_user_info": ["product_name_1", "product_name_2"],
                    "allowed_actions": ["continue_flow", "call_tool:product.compare"],
                },
                {
                    "step_id": "reply_result",
                    "name": "反饋結果",
                    "instruction": "反饋比價結果。",
                    "expected_user_info": [],
                    "allowed_actions": ["answer_user"],
                },
            ],
            "response_rules": [],
        },
        "tool_mentions": [
            {
                "name": "product.compare",
                "display_name": "商品比價查詢",
                "description": "根據兩個商品名稱查詢價格並返回對比信息。",
                "method": "POST",
                "url": "/api/mock/product/compare",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "product_name_1": {"type": "string"},
                        "product_name_2": {"type": "string"},
                    },
                    "required": ["product_name_1", "product_name_2"],
                },
                "output_schema": {
                    "type": "object",
                    "properties": {"success": {"type": "boolean"}, "data": {"type": "object"}},
                },
                "sample_arguments": {"product_name_1": "A1", "product_name_2": "A3"},
                "source_excerpt": "POST /api/mock/product/compare 使用兩個商品名返回比價信息。",
                "reason": "原始流程需要商品比價能力，但當前沒有對應工具。",
            }
        ],
    }

    response = _normalize(raw, request)

    assert "call_tool:product.compare" in response.draft_skill.nodes[0].allowed_actions
    assert [item.name for item in response.tool_suggestions] == ["product.compare"]
    assert response.tool_suggestions[0].resolution_status == "new_candidate"
    assert response.tool_suggestions[0].input_schema["required"] == ["product_name_1", "product_name_2"]
    assert response.tool_suggestions[0].sample_arguments == {"product_name_1": "A1", "product_name_2": "A3"}
    assert response.tool_suggestions[0].source_excerpt == "POST /api/mock/product/compare 使用兩個商品名返回比價信息。"
    assert not any("未配置工具 product.compare" in warning and "已移出" in warning for warning in response.warnings)


def test_normalize_response_resolves_tool_mentions_as_existing_tools() -> None:
    request = SkillDistillRequest(
        tenant_id="tenant_demo",
        title="商品比價",
        raw_content="用戶提供兩個商品名稱，POST /api/mock/product/compare 使用兩個商品名返回比價信息。",
        available_tools=[
            {
                "id": "tool_1",
                "name": "product.compare",
                "display_name": "商品比價查詢",
                "description": "根據兩個商品名稱查詢價格並返回對比信息。",
                "method": "POST",
                "url": "/api/mock/product/compare",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "product_name_1": {"type": "string"},
                        "product_name_2": {"type": "string"},
                    },
                    "required": ["product_name_1", "product_name_2"],
                },
                "output_schema": {
                    "type": "object",
                    "properties": {"success": {"type": "boolean"}, "data": {"type": "object"}},
                },
            }
        ],
    )
    raw = {
        "draft_skill": {
            "skill_id": "compare_products",
            "name": "商品比價",
            "required_info": ["product_name_1", "product_name_2"],
            "steps": [
                {
                    "step_id": "compare",
                    "name": "查詢比價",
                    "instruction": "調用工具查詢兩個商品價格。",
                    "expected_user_info": ["product_name_1", "product_name_2"],
                    "allowed_actions": ["continue_flow", "call_tool:product.compare"],
                },
                {
                    "step_id": "reply_result",
                    "name": "反饋結果",
                    "instruction": "反饋比價結果。",
                    "expected_user_info": [],
                    "allowed_actions": ["answer_user"],
                },
            ],
            "response_rules": [],
        },
        "tool_mentions": [
            {
                "name": "product.compare",
                "display_name": "商品比價查詢",
                "description": "根據兩個商品名稱查詢價格並返回對比信息。",
                "method": "POST",
                "url": "/api/mock/product/compare",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "product_name_1": {"type": "string"},
                        "product_name_2": {"type": "string"},
                    },
                    "required": ["product_name_1", "product_name_2"],
                },
                "output_schema": {
                    "type": "object",
                    "properties": {"success": {"type": "boolean"}, "data": {"type": "object"}},
                },
                "sample_arguments": {"product_name_1": "A1", "product_name_2": "A3"},
                "source_excerpt": "POST /api/mock/product/compare 使用兩個商品名返回比價信息。",
                "reason": "原始流程明確提到商品比價接口。",
            }
        ],
    }

    response = _normalize(raw, request)

    assert response.tool_suggestions[0].resolution_status == "existing"
    assert response.tool_suggestions[0].matched_tool_name == "product.compare"
    assert response.tool_suggestions[0].matched_tool_id == "tool_1"
    assert response.tool_suggestions[0].url == "/api/mock/product/compare"
    assert "call_tool:product.compare" in response.draft_skill.nodes[0].allowed_actions


def test_normalize_response_drops_tool_suggestion_when_url_not_in_source() -> None:
    request = SkillDistillRequest(
        tenant_id="tenant_demo",
        title="會員權益補發",
        raw_content="核對會員權益差異，必要時補發權益並反饋處理結果。",
        available_tools=[],
    )
    raw = {
        "draft_skill": {
            "skill_id": "member_benefit",
            "name": "會員權益補發",
            "required_info": ["user_id", "order_id"],
            "steps": [
                {
                    "step_id": "issue_benefit",
                    "name": "補發權益",
                    "instruction": "補發會員權益。",
                    "expected_user_info": ["user_id", "order_id"],
                    "allowed_actions": ["call_tool:member.issue_benefit"],
                },
                {
                    "step_id": "reply_result",
                    "name": "反饋結果",
                    "instruction": "反饋處理結果。",
                    "expected_user_info": [],
                    "allowed_actions": ["answer_user"],
                },
            ],
            "response_rules": [],
        },
        "tool_mentions": [
            {
                "name": "member.issue_benefit",
                "display_name": "補發會員權益",
                "description": "補發會員權益。",
                "method": "POST",
                "url": "/api/member/issue-benefit",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "user_id": {"type": "string"},
                        "order_id": {"type": "string"},
                    },
                    "required": ["user_id", "order_id"],
                },
                "output_schema": {
                    "type": "object",
                    "properties": {"success": {"type": "boolean"}},
                },
                "sample_arguments": {"user_id": "user_demo", "order_id": "A12345"},
                "source_excerpt": "補發會員權益。",
                "reason": "文檔描述了補發權益動作。",
            }
        ],
    }

    response = _normalize(raw, request)

    assert all(
        "call_tool:member.issue_benefit" not in node.allowed_actions
        for node in response.draft_skill.nodes
    )
    assert response.tool_suggestions == []
    assert any("未配置工具 member.issue_benefit" in warning for warning in response.warnings)
    assert any("當前不能新增" in warning for warning in response.warnings)


def test_normalize_response_does_not_suggest_tool_from_raw_text_only() -> None:
    request = SkillDistillRequest(
        tenant_id="tenant_demo",
        title="商品比價",
        raw_content="用戶提供兩個商品名稱，使用 product.compare 工具查詢價格並反饋比價結果",
        available_tools=[],
    )
    raw = {
        "draft_skill": {
            "skill_id": "compare_products",
            "name": "商品比價",
            "required_info": ["product_name_1", "product_name_2"],
            "steps": [
                {
                    "step_id": "collect",
                    "name": "收集商品",
                    "instruction": "收集兩個商品名稱。",
                    "expected_user_info": ["product_name_1", "product_name_2"],
                    "allowed_actions": ["ask_user"],
                },
                {
                    "step_id": "reply_result",
                    "name": "反饋結果",
                    "instruction": "反饋比價結果。",
                    "expected_user_info": [],
                    "allowed_actions": ["answer_user"],
                },
            ],
            "response_rules": [],
        }
    }

    response = _normalize(raw, request)

    assert response.tool_suggestions == []


def test_normalize_response_drops_incomplete_model_tool_suggestion() -> None:
    request = SkillDistillRequest(
        tenant_id="tenant_demo",
        title="商品比價",
        raw_content="用戶提供兩個商品名稱，訪問接口查詢價格並反饋比價結果",
        available_tools=[],
    )
    raw = {
        "draft_skill": {
            "skill_id": "compare_products",
            "name": "商品比價",
            "required_info": ["product_name_1", "product_name_2"],
            "steps": [
                {
                    "step_id": "reply_result",
                    "name": "反饋結果",
                    "instruction": "反饋比價結果。",
                    "expected_user_info": [],
                    "allowed_actions": ["answer_user"],
                },
            ],
            "response_rules": [],
        },
        "tool_suggestions": [{"name": "product.compare"}],
    }

    response = _normalize(raw, request)

    assert response.tool_suggestions == []


def test_skill_card_serializes_response_rules_before_nodes() -> None:
    request = SkillDistillRequest(
        tenant_id="tenant_demo",
        title="資料審核",
        raw_content="收集資料編號，審核狀態，反饋給用戶",
    )

    card = SkillDistiller()._fallback_card(request)  # noqa: SLF001
    keys = list(card.model_dump().keys())

    assert "steps" not in keys
    assert keys.index("response_rules") < keys.index("nodes")
