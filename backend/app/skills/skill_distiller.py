from __future__ import annotations

import hashlib
import json
import re
from time import sleep
from typing import Any
from urllib.parse import urlparse

from app import paths
from app.db.models import ModelConfig
from app.llm import LLMClient, LLMError
from app.skills.llm_limits import skill_model_config
from app.skills.skill_reflection import reflect_skill_response, reflect_skill_response_stream
from app.skills.skill_schema import SkillDistillRequest, SkillDistillResponse, SkillCard, SkillGraphNode, ToolSuggestion
from app.skills.step_ids import ensure_unique_node_ids, skill_card_with_unique_step_ids


PROMPT_PATH = paths.resource_dir() / "app" / "llm" / "prompts" / "skill_distiller_prompt.md"
STREAM_INTERVAL_SECONDS = 0.035
MODEL_REPAIR_ATTEMPTS = 2
MODEL_TOOL_LIMIT = 48
MODEL_TOOL_CATALOG_CHAR_LIMIT = 12000
MODEL_TOOL_DESCRIPTION_CHAR_LIMIT = 240
MODEL_TOOL_PARAMETER_LIMIT = 12
CLOSED_LOOP_RESPONSE_RULE = (
    "流程必須形成閉環：不得把“請稍候/正在處理/稍後反饋”作為最終回覆；"
    "需要外部事實、外部狀態或外部副作用時必須調用已配置工具或轉人工，並向用戶給出明確結果。"
)
ADAPTIVE_FLOW_RESPONSE_RULE = (
    "步驟是可自適應推進的目標，不是固定問答腳本；已由當前用戶消息、歷史信息或路由意圖滿足的內容"
    "不得重複追問，應直接推進到下一缺失信息、工具調用或最終回覆。"
)
CONFIRMATION_FLOW_RESPONSE_RULE = (
    "涉及外部系統寫入、用戶資產變更、不可逆操作或明確需要確認的處理時，"
    "調用工具或執行處理前必須先讓用戶確認關鍵對象、範圍和操作內容。"
)
TOOL_STEP_INSTRUCTION_SUFFIX = (
    "工具參數滿足時直接調用工具；工具成功後必須基於工具結果進入最終回覆，"
    "不要停留在“請稍候”或“正在處理”。"
)
ADAPTIVE_STEP_INSTRUCTION_SUFFIX = (
    "將本步驟作為目標而不是固定話術；如果用戶當前消息、歷史 slots 或路由意圖已滿足本步驟，"
    "直接寫入對應 slot 並繼續到下一缺失信息、工具調用或最終回覆，不要重複確認。"
)
FINAL_RESPONSE_INSTRUCTION_SUFFIX = "給用戶明確最終回覆；無法閉環時轉人工，不要只說請稍候。"


class SkillDistiller:
    def distill(self, request: SkillDistillRequest, model_config: ModelConfig) -> SkillDistillResponse:
        return self._generate_response(request, model_config)

    def distill_stream(self, request: SkillDistillRequest, model_config: ModelConfig) -> SkillDistillResponse:
        return self._generate_response(request, model_config)

    def stream_text(self, request: SkillDistillRequest, model_config: ModelConfig):
        payload = self._payload(request)
        model_input = self._model_input(request, payload)
        chunks: list[str] = []
        prompt = PROMPT_PATH.read_text(encoding="utf-8")
        client = LLMClient(skill_model_config(model_config))
        try:
            yield {"event": "status", "data": {"text": "模型正在規劃技能結構"}}
            for chunk in client.generate_text_stream(prompt, model_input):
                chunks.append(chunk)
                yield {"event": "chunk", "data": {"content": chunk}}
            yield {"event": "status", "data": {"text": "正在校驗模型輸出結構"}}
            response = self._response_from_text("".join(chunks), request)
        except (LLMError, json.JSONDecodeError, TypeError, ValueError) as exc:
            try:
                yield {"event": "status", "data": {"text": "模型輸出需要修復，正在重試"}}
                response = self._repair_response(client, prompt, payload, "".join(chunks), str(exc), request)
            except (LLMError, json.JSONDecodeError, TypeError, ValueError) as repair_exc:
                try:
                    yield {"event": "status", "data": {"text": "模型修復失敗，改用分段生成"}}
                    response = self._staged_response(client, prompt, payload, request, str(repair_exc))
                except (LLMError, json.JSONDecodeError, TypeError, ValueError) as staged_exc:
                    yield {"event": "status", "data": {"text": "模型多輪生成失敗，使用最低可運行草稿"}}
                    response = self._fallback_response(
                        request, f"模型多輪生成未能完成，已使用最低可運行草稿：{staged_exc}"
                    )
            yield {"event": "chunk_reset", "data": {}}
            for chunk in _chunk_text(_serialize_response_for_stream(response)):
                yield {"event": "chunk", "data": {"content": chunk}}
                sleep(STREAM_INTERVAL_SECONDS)
        yield {"event": "status", "data": {"text": "正在校驗步驟閉環與工具接入"}}
        before_reflection = response.model_dump(mode="json")
        response = yield from reflect_skill_response_stream(
            client=client,
            source_kind="distill",
            source_payload=payload,
            response=response,
            candidate_skill=response.draft_skill,
            current_warnings=response.warnings,
            tool_suggestions=response.tool_suggestions,
            normalize_response=lambda raw: self._normalize_response(raw, request),
        )
        yield {"event": "status", "data": {"text": "正在整理校驗後的技能草稿"}}
        if response.model_dump(mode="json") != before_reflection:
            yield {"event": "chunk_reset", "data": {}}
            for chunk in _chunk_text(_serialize_response_for_stream(response)):
                yield {"event": "chunk", "data": {"content": chunk}}
                sleep(STREAM_INTERVAL_SECONDS)
        yield {"event": "status", "data": {"text": "校驗完成，已完成 Skill Card 結構化"}}
        yield {"event": "complete", "data": response.model_dump(mode="json")}

    def _generate_response(self, request: SkillDistillRequest, model_config: ModelConfig) -> SkillDistillResponse:
        payload = self._payload(request)
        model_input = self._model_input(request, payload)
        prompt = PROMPT_PATH.read_text(encoding="utf-8")
        client = LLMClient(skill_model_config(model_config))
        output = ""
        try:
            output = client.generate_text(prompt, model_input)
            response = self._response_from_text(output, request)
        except (LLMError, json.JSONDecodeError, TypeError, ValueError) as exc:
            try:
                response = self._repair_response(client, prompt, payload, output, str(exc), request)
            except (LLMError, json.JSONDecodeError, TypeError, ValueError) as repair_exc:
                try:
                    response = self._staged_response(client, prompt, payload, request, str(repair_exc))
                except (LLMError, json.JSONDecodeError, TypeError, ValueError) as staged_exc:
                    response = self._fallback_response(
                        request, f"模型多輪生成未能完成，已使用最低可運行草稿：{staged_exc}"
                    )
        return reflect_skill_response(
            client=client,
            source_kind="distill",
            source_payload=payload,
            response=response,
            candidate_skill=response.draft_skill,
            current_warnings=response.warnings,
            tool_suggestions=response.tool_suggestions,
            normalize_response=lambda raw: self._normalize_response(raw, request),
        )

    def _response_from_text(self, text: str, request: SkillDistillRequest) -> SkillDistillResponse:
        raw = _raw_json_from_text(text)
        return self._normalize_response(raw, request)

    def _repair_response(
        self,
        client: LLMClient,
        prompt: str,
        payload: dict[str, Any],
        previous_output: str,
        previous_error: str,
        request: SkillDistillRequest,
    ) -> SkillDistillResponse:
        output = previous_output
        error = previous_error
        for attempt in range(MODEL_REPAIR_ATTEMPTS):
            repair_payload = {
                **payload,
                "previous_output": output,
                "previous_error": error,
                "repair_attempt": attempt + 1,
                "repair_instruction": (
                    "上一次輸出無法解析或未通過 Skill Card graph 校驗。請修復為完整合法 JSON。"
                    "不要解釋，不要使用代碼圍欄。必須保留原始流程中的節點、邊、工具建議和閉環約束。"
                ),
            }
            output = client.generate_text(prompt, repair_payload)
            try:
                return self._response_from_text(output, request)
            except (json.JSONDecodeError, TypeError, ValueError) as exc:
                error = str(exc)
        raise ValueError(error)

    def _staged_response(
        self,
        client: LLMClient,
        prompt: str,
        payload: dict[str, Any],
        request: SkillDistillRequest,
        previous_error: str,
    ) -> SkillDistillResponse:
        outline_text = client.generate_text(
            prompt,
            {
                **payload,
                "generation_mode": "outline_only",
                "previous_error": previous_error,
                "generation_instruction": (
                    "先生成完整但緊湊的 Skill Card graph 大綱。nodes/edges 必須覆蓋原始流程全部節點與條件推進關係，"
                    "每個 instruction 只寫一句目標說明；保留 response_rules、slot_filling_policy、"
                    "interruption_policy 和 tool_mentions。只輸出 JSON。"
                ),
            },
        )
        outline = self._response_from_text(outline_text, request)
        draft_data = outline.draft_skill.model_dump(mode="json")
        warnings = list(outline.warnings)
        tool_mentions = [item.model_dump(mode="json") for item in outline.tool_suggestions]
        nodes = [node for node in draft_data.get("nodes", []) if isinstance(node, dict)]

        for index, node in enumerate(nodes):
            node_text = client.generate_text(
                prompt,
                {
                    **payload,
                    "generation_mode": "expand_node",
                    "current_draft": draft_data,
                    "target_node_index": index,
                    "target_node": node,
                    "generation_instruction": (
                        "只擴寫 target_node。輸出 JSON：{\"node\": {...}, \"warnings\": [], "
                        "\"tool_mentions\": []}。node 必須包含 node_id、type、name、instruction、"
                        "expected_user_info、allowed_actions。不要輸出完整技能。"
                    ),
                },
            )
            try:
                node_raw = _raw_json_from_text(node_text)
                node_data = node_raw.get("node") if isinstance(node_raw.get("node"), dict) else node_raw
                nodes[index] = SkillGraphNode.model_validate(node_data).model_dump(mode="json")
                warnings.extend(str(item) for item in node_raw.get("warnings", []) if str(item).strip())
                if isinstance(node_raw.get("tool_mentions"), list):
                    tool_mentions.extend(item for item in node_raw["tool_mentions"] if isinstance(item, dict))
            except (json.JSONDecodeError, TypeError, ValueError) as exc:
                warnings.append(f"模型未能擴寫節點 {index + 1}，已保留大綱節點：{exc}")

        draft_data["nodes"] = nodes
        reviewed = self._normalize_response(
            {"draft_skill": draft_data, "warnings": warnings, "tool_mentions": tool_mentions},
            request,
        )
        review_text = client.generate_text(
            prompt,
            {
                **payload,
                "generation_mode": "final_review",
                "current_draft": reviewed.draft_skill.model_dump(mode="json"),
                "generation_instruction": (
                    "檢查 current_draft 是否遺漏原始流程、閉環回覆、工具建議或中斷策略。"
                    "如需修正，返回完整 draft_skill；如果無需修正，也返回完整 draft_skill。只輸出 JSON。"
                ),
            },
        )
        try:
            return self._response_from_text(review_text, request)
        except (json.JSONDecodeError, TypeError, ValueError):
            return reviewed

    def _payload(self, request: SkillDistillRequest) -> dict[str, Any]:
        return {
            "title": request.title,
            "business_domain": request.business_domain,
            "raw_content": request.raw_content,
            "available_tools": _compact_available_tools(
                request.available_tools,
                source_text=_request_text(request),
            ),
        }

    def _model_input(
        self,
        request: SkillDistillRequest,
        payload: dict[str, Any] | None = None,
    ) -> str:
        projected = payload or self._payload(request)
        return _distill_model_input(
            title=request.title,
            business_domain=request.business_domain,
            raw_content=request.raw_content,
            available_tools=projected.get("available_tools", []),
            total_tool_count=len(request.available_tools),
        )

    def _normalize_response(self, raw: dict[str, Any], request: SkillDistillRequest) -> SkillDistillResponse:
        draft = raw.get("draft_skill") if isinstance(raw.get("draft_skill"), dict) else raw
        warnings = list(raw.get("warnings") or [])
        fallback = self._fallback_card(request)

        required_info = _string_list(draft.get("required_info"), fallback.required_info)
        nodes = self._normalize_nodes(draft.get("nodes"), fallback.nodes)
        nodes, node_warnings = self._ensure_closed_loop_nodes(nodes, request)
        warnings.extend(node_warnings)
        nodes, unique_node_warnings = ensure_unique_node_ids(nodes)
        warnings.extend(unique_node_warnings)
        edges = self._normalize_edges(draft.get("edges"), nodes, fallback.edges)
        edges = _ensure_linear_reachability(nodes, edges)
        node_id_map = {str(node.get("node_id") or "") for node in nodes}
        start_node_id = _string(draft.get("start_node_id"), fallback.start_node_id)
        if start_node_id not in node_id_map:
            start_node_id = nodes[0]["node_id"]
            warnings.append("模型輸出的 start_node_id 不存在，已改為第一個節點。")
        terminal_node_ids = _string_list(draft.get("terminal_node_ids"), fallback.terminal_node_ids)
        terminal_node_ids = [node_id for node_id in terminal_node_ids if node_id in node_id_map] or [nodes[-1]["node_id"]]
        raw_tool_mentions = raw.get("tool_mentions") if isinstance(raw.get("tool_mentions"), list) else raw.get("tool_suggestions")
        tool_resolutions = _normalize_tool_suggestions(raw_tool_mentions, request, [])
        nodes, missing_tool_names = _remove_unknown_tool_actions(
            nodes,
            request.available_tools,
            _tool_action_names_from_suggestions(tool_resolutions),
        )
        for tool_name in missing_tool_names:
            warnings.append(
                f"技能草稿引用了未配置工具 {tool_name}，已移出 allowed_actions；"
                "如確需該工具，模型必須在 tool_mentions 中提供來自原文的完整工具提及。"
            )
        response_rules = _string_list(draft.get("response_rules"), fallback.response_rules)
        if CLOSED_LOOP_RESPONSE_RULE not in response_rules:
            response_rules.append(CLOSED_LOOP_RESPONSE_RULE)
        if ADAPTIVE_FLOW_RESPONSE_RULE not in response_rules:
            response_rules.append(ADAPTIVE_FLOW_RESPONSE_RULE)
        if _steps_declare_confirmation(nodes) and CONFIRMATION_FLOW_RESPONSE_RULE not in response_rules:
            response_rules.append(CONFIRMATION_FLOW_RESPONSE_RULE)
        normalized = {
            "skill_id": _string(draft.get("skill_id"), fallback.skill_id),
            "name": _string(draft.get("name"), fallback.name),
            "version": _string(draft.get("version"), "1.0.0"),
            "business_domain": _string(draft.get("business_domain"), fallback.business_domain or "general"),
            "description": _string(draft.get("description"), fallback.description),
            "trigger_intents": _string_list(draft.get("trigger_intents"), fallback.trigger_intents),
            "user_utterance_examples": _string_list(
                draft.get("user_utterance_examples"), fallback.user_utterance_examples
            ),
            "goal": _string_list(draft.get("goal"), fallback.goal),
            "required_info": required_info,
            "slot_filling_policy": _slot_filling_policy(
                draft.get("slot_filling_policy"),
                required_info,
                nodes,
                fallback.slot_filling_policy,
            ),
            "response_rules": response_rules,
            "nodes": nodes,
            "edges": edges,
            "start_node_id": start_node_id,
            "terminal_node_ids": terminal_node_ids,
            "interruption_policy": _string_dict(draft.get("interruption_policy"), fallback.interruption_policy),
        }
        draft_skill, card_warnings = skill_card_with_unique_step_ids(SkillCard.model_validate(normalized))
        warnings.extend(card_warnings)
        if missing_tool_names:
            tool_resolutions = _normalize_tool_suggestions(raw_tool_mentions, request, missing_tool_names)
        warnings.extend(_tool_resolution_warnings(tool_resolutions))
        tool_suggestions = [
            item for item in tool_resolutions if item.resolution_status in {"existing", "new_candidate"}
        ]
        response = SkillDistillResponse(
            draft_skill=draft_skill,
            warnings=_compact_warnings(warnings),
            tool_suggestions=tool_suggestions,
        )
        return response

    def _ensure_closed_loop_nodes(
        self, nodes: list[dict[str, Any]], request: SkillDistillRequest
    ) -> tuple[list[dict[str, Any]], list[str]]:
        normalized_nodes = [dict(node) for node in nodes]
        warnings: list[str] = []
        _attach_declared_confirmation_to_tool_steps(normalized_nodes)

        for node in normalized_nodes:
            _ensure_adaptive_step_instruction(node)
            actions = [str(action) for action in node.get("allowed_actions", [])]
            if not any(action.startswith("call_tool:") for action in actions):
                continue
            if "continue_flow" not in actions:
                actions.append("continue_flow")
                node["allowed_actions"] = actions
            _append_instruction_suffix(node, TOOL_STEP_INSTRUCTION_SUFFIX)

        if not _last_step_allows_answer(normalized_nodes):
            normalized_nodes.append(
                {
                    "node_id": _unique_step_id(normalized_nodes, "reply_final_result"),
                    "type": "response",
                    "name": "反饋最終結果",
                    "instruction": (
                        "基於已收集信息和工具結果給用戶明確最終回覆；"
                        "信息不足時追問缺失信息，無法閉環時轉人工，不要只說請稍候；"
                        f"{ADAPTIVE_STEP_INSTRUCTION_SUFFIX}"
                    ),
                    "expected_user_info": [],
                    "allowed_actions": ["answer_user", "handoff_human"],
                }
            )
            warnings.append("原始改寫缺少最終回覆節點，已補充閉環反饋節點。")
        else:
            last_step = normalized_nodes[-1]
            _append_instruction_suffix(last_step, FINAL_RESPONSE_INSTRUCTION_SUFFIX)

        return normalized_nodes, warnings

    def _normalize_nodes(self, value: Any, fallback_nodes: list[SkillGraphNode]) -> list[dict[str, Any]]:
        if not isinstance(value, list):
            return [node.model_dump() for node in fallback_nodes]
        nodes: list[dict[str, Any]] = []
        for index, item in enumerate(value):
            if not isinstance(item, dict):
                continue
            fallback = fallback_nodes[min(index, len(fallback_nodes) - 1)]
            nodes.append(
                {
                    "node_id": _string(item.get("node_id"), fallback.node_id),
                    "type": _string(item.get("type"), fallback.type),
                    "name": _string(item.get("name"), fallback.name),
                    "instruction": _string(item.get("instruction"), fallback.instruction),
                    "optional": bool(item.get("optional", fallback.optional)),
                    "condition": item.get("condition") if isinstance(item.get("condition"), str) else fallback.condition,
                    "expected_user_info": _string_list(
                        item.get("expected_user_info"), fallback.expected_user_info
                    ),
                    "allowed_actions": _normalize_actions(
                        _string_list(item.get("allowed_actions"), fallback.allowed_actions)
                    ),
                    "knowledge_scope": item.get("knowledge_scope") if isinstance(item.get("knowledge_scope"), dict) else fallback.knowledge_scope,
                    "retry_policy": item.get("retry_policy") if isinstance(item.get("retry_policy"), dict) else fallback.retry_policy,
                    "metadata": item.get("metadata") if isinstance(item.get("metadata"), dict) else fallback.metadata,
                }
            )
        return nodes or [node.model_dump() for node in fallback_nodes]

    def _normalize_edges(self, value: Any, nodes: list[dict[str, Any]], fallback_edges: list[Any]) -> list[dict[str, Any]]:
        node_ids = {str(node.get("node_id") or "") for node in nodes}
        edges: list[dict[str, Any]] = []
        if isinstance(value, list):
            for index, item in enumerate(value):
                if not isinstance(item, dict):
                    continue
                source = _string(item.get("source_node_id"), "")
                target = _string(item.get("next_node_id"), "")
                if source not in node_ids or target not in node_ids:
                    continue
                edges.append(
                    {
                        "source_node_id": source,
                        "next_node_id": target,
                        "condition": item.get("condition") if isinstance(item.get("condition"), str) else None,
                        "priority": int(item.get("priority") or index),
                        "label": item.get("label") if isinstance(item.get("label"), str) else None,
                    }
                )
        if edges:
            return edges
        if fallback_edges:
            fallback = []
            for edge in fallback_edges:
                item = edge.model_dump(mode="json") if hasattr(edge, "model_dump") else dict(edge)
                if item.get("source_node_id") in node_ids and item.get("next_node_id") in node_ids:
                    fallback.append(item)
            if fallback:
                return fallback
        return [
            {
                "source_node_id": nodes[index]["node_id"],
                "next_node_id": nodes[index + 1]["node_id"],
                "priority": index,
                "label": "默認推進",
            }
            for index in range(len(nodes) - 1)
        ]

    def _fallback_response(self, request: SkillDistillRequest, warning: str) -> SkillDistillResponse:
        return SkillDistillResponse(draft_skill=self._fallback_card(request), warnings=_compact_warnings([warning]))

    def _fallback_card(self, request: SkillDistillRequest) -> SkillCard:
        title = request.title.strip() or "新技能"
        raw = request.raw_content
        required_info: list[str] = []
        nodes = [
            SkillGraphNode(
                node_id="understand_request",
                type="decision",
                name="理解原始流程",
                instruction=(
                    "根據原始流程文檔理解用戶目標、缺失信息和下一步處理方式；"
                    "不要基於固定話術推進，信息不足時追問，涉及外部事實或外部副作用時轉人工或等待人工補充工具配置；"
                    f"{ADAPTIVE_STEP_INSTRUCTION_SUFFIX}"
                ),
                expected_user_info=[],
                allowed_actions=["ask_user", "continue_flow", "handoff_human"],
            ),
            SkillGraphNode(
                node_id="reply_result",
                type="response",
                name="反饋結果",
                instruction=(
                    "根據已收集的信息和工具結果給用戶明確回覆；信息不足時繼續追問，不要編造事實；"
                    f"{ADAPTIVE_STEP_INSTRUCTION_SUFFIX}"
                ),
                expected_user_info=[],
                allowed_actions=["answer_user", "handoff_human"],
            ),
        ]
        return SkillCard(
            skill_id=_slugify(title, raw),
            name=title,
            version="1.0.0",
            business_domain=request.business_domain or "general",
            description=raw[:120] or "根據原始技能文本生成的流程。",
            trigger_intents=[title],
            user_utterance_examples=[title],
            goal=_infer_goals(raw),
            required_info=required_info,
            slot_filling_policy=_default_slot_filling_policy(required_info),
            response_rules=[
                "信息不足時先追問，不要編造事實。",
                ADAPTIVE_FLOW_RESPONSE_RULE,
            ],
            nodes=nodes,
            edges=[{"source_node_id": "understand_request", "next_node_id": "reply_result", "priority": 0, "label": "默認推進"}],
            start_node_id="understand_request",
            terminal_node_ids=["reply_result"],
            interruption_policy={
                "related_question": "回答相關問題後回到當前流程。",
                "unrelated_business": "可切換新流程並保留當前進度。",
                "chitchat": "簡短回應後引導用戶繼續當前流程。",
                "user_wants_human": "直接轉人工。",
            },
        )


def _steps_have_tool_action(steps: list[dict[str, Any]]) -> bool:
    for step in steps:
        actions = step.get("allowed_actions", [])
        if isinstance(actions, list) and any(str(action).startswith("call_tool:") for action in actions):
            return True
    return False


def _ensure_adaptive_step_instruction(step: dict[str, Any]) -> None:
    _append_instruction_suffix(step, ADAPTIVE_STEP_INSTRUCTION_SUFFIX)


def _append_instruction_suffix(step: dict[str, Any], suffix: str) -> None:
    instruction = str(step.get("instruction") or "")
    if suffix in instruction:
        return
    step["instruction"] = f"{instruction}{suffix}"


def _confirmation_fields(steps: list[dict[str, Any]]) -> list[str]:
    fields: list[str] = []
    for step in steps:
        expected = [str(field) for field in step.get("expected_user_info", [])]
        for field in expected:
            if field.endswith("_confirmed") and field not in fields:
                fields.append(field)
    return fields


def _steps_declare_confirmation(steps: list[dict[str, Any]]) -> bool:
    return bool(_confirmation_fields(steps))


def _attach_declared_confirmation_to_tool_steps(steps: list[dict[str, Any]]) -> None:
    confirmed_fields: list[str] = []
    for step in steps:
        if any(str(action).startswith("call_tool:") for action in step.get("allowed_actions", [])):
            _append_tool_confirmation_instruction(step, confirmed_fields)
        for field in _confirmation_fields([step]):
            if field not in confirmed_fields:
                confirmed_fields.append(field)


def _append_tool_confirmation_instruction(step: dict[str, Any], confirmation_fields: list[str]) -> None:
    if not confirmation_fields:
        return
    field_text = "、".join(f"{field}=true" for field in confirmation_fields)
    _append_instruction_suffix(step, f"調用工具前必須確認字段已滿足：{field_text}。")


def _last_step_allows_answer(steps: list[dict[str, Any]]) -> bool:
    if not steps:
        return False
    actions = [str(action) for action in steps[-1].get("allowed_actions", [])]
    return "answer_user" in actions


def _unique_step_id(steps: list[dict[str, Any]], base: str) -> str:
    existing = {str(step.get("node_id") or "") for step in steps}
    if base not in existing:
        return base
    index = 2
    while f"{base}_{index}" in existing:
        index += 1
    return f"{base}_{index}"


def _ensure_linear_reachability(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if len(nodes) < 2:
        return edges
    existing = {
        (str(edge.get("source_node_id") or ""), str(edge.get("next_node_id") or ""))
        for edge in edges
        if isinstance(edge, dict)
    }
    next_edges = [dict(edge) for edge in edges]
    incoming = {str(edge.get("next_node_id") or "") for edge in next_edges}
    for index in range(1, len(nodes)):
        target = str(nodes[index].get("node_id") or "")
        source = str(nodes[index - 1].get("node_id") or "")
        if not target or not source or target in incoming:
            continue
        pair = (source, target)
        if pair in existing:
            continue
        next_edges.append(
            {
                "source_node_id": source,
                "next_node_id": target,
                "priority": index,
                "label": "默認推進",
            }
        )
        existing.add(pair)
        incoming.add(target)
    return next_edges


def _unique_warnings(warnings: list[str]) -> list[str]:
    deduped: list[str] = []
    for warning in warnings:
        text = str(warning).strip()
        if text and text not in deduped:
            deduped.append(text)
    return deduped


def _compact_warnings(warnings: list[str]) -> list[str]:
    return _unique_warnings([_compact_warning(str(warning)) for warning in warnings if str(warning).strip()])


def _compact_warning(warning: str) -> str:
    text = warning.strip()
    replacements = (
        ("原始改寫未包含工具步驟，已按可用工具補充閉環執行步驟。", "已補充工具執行步驟。"),
        ("原始改寫缺少執行前確認步驟，已補充確認步驟。", "已補充執行前確認步驟。"),
        ("原始改寫缺少最終回覆步驟，已補充閉環反饋步驟。", "已補充最終回覆步驟。"),
        ("模型未生成步驟，已使用規則生成默認步驟。", "已生成默認步驟。"),
    )
    for source, target in replacements:
        if text == source:
            return target
    return text


def _distill_model_input(
    *,
    title: str,
    business_domain: str | None,
    raw_content: str,
    available_tools: Any,
    total_tool_count: int,
) -> str:
    sections = [f"技能標題：{title.strip() or '新SOP'}"]
    if business_domain and business_domain.strip():
        sections.append(f"業務領域：{business_domain.strip()}")
    sections.extend(("原始流程：", raw_content.strip()))

    tools = [item for item in available_tools if isinstance(item, dict)] if isinstance(available_tools, list) else []
    sections.append("可用工具（只選擇與原始流程語義匹配的工具）：")
    if not tools:
        sections.append("無可用工具。流程需要外部接口時，請指出缺少的接口，不要臆造工具。")
        return "\n".join(sections)

    for tool in tools:
        name = str(tool.get("name") or "").strip()
        display_name = str(tool.get("display_name") or "").strip()
        description = str(tool.get("description") or "").strip()
        heading = name
        if display_name and display_name != name:
            heading = f"{name}（{display_name}）"
        line = f"- {heading}"
        if description:
            line += f"：{description}"
        sections.append(line)
        parameter_text = _model_tool_parameter_text(tool.get("input_schema"))
        if parameter_text:
            sections.append(f"  輸入參數：{parameter_text}")
        if tool.get("requires_confirmation") is True:
            sections.append("  調用前需要用戶確認。")

    omitted = max(0, total_tool_count - len(tools))
    if omitted:
        sections.append(f"另有 {omitted} 個與當前流程相關性較低的工具未展開；不得猜測或調用未列出的工具。")
    return "\n".join(sections)


def _compact_available_tools(
    available_tools: list[dict[str, Any]],
    *,
    source_text: str,
) -> list[dict[str, Any]]:
    source_terms = _tool_relevance_terms(source_text)
    ranked: list[tuple[int, int, dict[str, Any]]] = []
    seen_names: set[str] = set()
    for index, tool in enumerate(available_tools):
        if not isinstance(tool, dict):
            continue
        name = str(tool.get("name") or "").strip()
        if not name or name in seen_names:
            continue
        seen_names.add(name)
        description = _limited_text(tool.get("description"), MODEL_TOOL_DESCRIPTION_CHAR_LIMIT)
        projected: dict[str, Any] = {
            "name": name,
            "display_name": _limited_text(tool.get("display_name"), 120),
            "description": description,
            "input_schema": _compact_tool_input_schema(tool.get("input_schema")),
        }
        if tool.get("requires_confirmation") is True:
            projected["requires_confirmation"] = True
        projected = {key: value for key, value in projected.items() if value not in (None, "", [], {})}
        candidate_text = " ".join(
            str(tool.get(key) or "")
            for key in ("name", "display_name", "description", "bucket")
        )
        score = len(source_terms & _tool_relevance_terms(candidate_text))
        lowered_source = source_text.lower()
        for exact in (name, str(tool.get("display_name") or "").strip()):
            if exact and exact.lower() in lowered_source:
                score += 20
        ranked.append((score, index, projected))

    ranked.sort(key=lambda item: (-item[0], item[1]))
    compacted: list[dict[str, Any]] = []
    catalog_chars = 0
    for _score, _index, projected in ranked:
        if len(compacted) >= MODEL_TOOL_LIMIT:
            break
        projected_chars = len(json.dumps(projected, ensure_ascii=False, separators=(",", ":")))
        if compacted and catalog_chars + projected_chars > MODEL_TOOL_CATALOG_CHAR_LIMIT:
            break
        compacted.append(projected)
        catalog_chars += projected_chars
    return compacted


def _compact_tool_input_schema(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    properties = value.get("properties") if isinstance(value.get("properties"), dict) else {}
    required = [str(item) for item in value.get("required", []) if str(item).strip()]
    ordered_names = [*required, *(str(name) for name in properties if str(name) not in required)]
    selected_names = ordered_names[:MODEL_TOOL_PARAMETER_LIMIT]
    compact_properties: dict[str, Any] = {}
    for name in selected_names:
        raw_property = properties.get(name)
        if not isinstance(raw_property, dict):
            raw_property = {}
        item: dict[str, Any] = {
            "type": _limited_text(raw_property.get("type"), 32),
            "description": _limited_text(raw_property.get("description"), 100),
        }
        enum = raw_property.get("enum")
        if isinstance(enum, list) and enum:
            item["enum"] = enum[:8]
        compact_properties[name] = {
            key: item_value
            for key, item_value in item.items()
            if item_value not in (None, "", [], {})
        }
    result: dict[str, Any] = {"type": "object"}
    if compact_properties:
        result["properties"] = compact_properties
    selected_required = [name for name in required if name in selected_names]
    if selected_required:
        result["required"] = selected_required
    return result


def _model_tool_parameter_text(value: Any) -> str:
    if not isinstance(value, dict):
        return ""
    properties = value.get("properties") if isinstance(value.get("properties"), dict) else {}
    required = {str(item) for item in value.get("required", [])}
    parts: list[str] = []
    for name, raw_property in properties.items():
        property_data = raw_property if isinstance(raw_property, dict) else {}
        kind = str(property_data.get("type") or "any")
        marker = "必填" if name in required else "可選"
        description = str(property_data.get("description") or "").strip()
        part = f"{name} ({kind}, {marker})"
        if description:
            part += f" - {description}"
        parts.append(part)
    return "；".join(parts)


def _tool_relevance_terms(value: str) -> set[str]:
    lowered = value.lower()
    terms = {item for item in re.findall(r"[a-z0-9_]+", lowered) if len(item) >= 2}
    for segment in re.findall(r"[\u4e00-\u9fff]{2,}", value):
        for size in (2, 3):
            terms.update(segment[index : index + size] for index in range(len(segment) - size + 1))
    return terms


def _limited_text(value: Any, limit: int) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text[:limit]


def _request_text(request: Any) -> str:
    return f"{_request_title(request)}\n{_request_raw_content(request)}"


def _request_title(request: Any) -> str:
    title = getattr(request, "title", None)
    if isinstance(title, str) and title.strip():
        return title.strip()
    current_skill = getattr(request, "current_skill", None)
    name = getattr(current_skill, "name", None)
    return str(name or "新技能").strip()


def _request_raw_content(request: Any) -> str:
    raw_content = getattr(request, "raw_content", None)
    if isinstance(raw_content, str) and raw_content.strip():
        return raw_content
    instruction = getattr(request, "instruction", None)
    return str(instruction or "")


def _extract_json(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`").strip()
        if stripped.startswith("json"):
            stripped = stripped[4:].strip()
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start >= 0 and end >= start:
        return stripped[start : end + 1]
    return stripped


def _raw_json_from_text(text: str) -> dict[str, Any]:
    raw = json.loads(_extract_json(text))
    if not isinstance(raw, dict):
        raise ValueError("模型輸出不是 JSON object")
    return raw


def _serialize_response_for_stream(response: SkillDistillResponse) -> str:
    return json.dumps(response.model_dump(mode="json"), ensure_ascii=False, indent=2)


def _chunk_text(text: str, size: int = 18):
    for index in range(0, len(text), size):
        yield text[index : index + size]


def _string(value: Any, fallback: str | None = "") -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return fallback or ""


def _string_list(value: Any, fallback: list[str]) -> list[str]:
    if isinstance(value, list):
        items = [str(item).strip() for item in value if str(item).strip()]
        if items:
            return items
    return fallback


def _string_dict(value: Any, fallback: dict[str, str]) -> dict[str, str]:
    if isinstance(value, dict):
        items = {str(key): str(item) for key, item in value.items() if str(key)}
        if items:
            return items
    return fallback


def _slot_filling_policy(
    value: Any,
    required_info: list[str],
    steps: list[dict[str, Any]],
    fallback_policy: dict[str, Any],
) -> dict[str, Any]:
    has_explicit_policy = isinstance(value, dict)
    if has_explicit_policy:
        policy = dict(value)
    else:
        policy = dict(fallback_policy or {})
    expected_infos = set(required_info)
    for step in steps:
        expected_infos.update(str(field) for field in step.get("expected_user_info", []))
    if has_explicit_policy and isinstance(policy.get("target_info"), list):
        expected_infos.update(str(field) for field in policy["target_info"] if str(field).strip())
    default_policy = _default_slot_filling_policy(sorted(expected_infos))
    return {
        **default_policy,
        **policy,
        "enabled": True,
        "multi_slot_per_turn": True,
        "extract_scope": "all_skill_expected_user_info",
        "skip_satisfied_steps": True,
        "target_info": sorted(expected_infos),
    }


def _default_slot_filling_policy(expected_infos: list[str]) -> dict[str, Any]:
    return {
        "enabled": True,
        "multi_slot_per_turn": True,
        "extract_scope": "all_skill_expected_user_info",
        "skip_satisfied_steps": True,
        "description": "每輪用戶消息都應同時抽取所有可識別的信息；如果用戶一次提供多個字段，必須一次性寫入 slot_updates，不要按步驟重複追問。",
        "target_info": expected_infos,
    }


def _normalize_actions(actions: list[str]) -> list[str]:
    normalized: list[str] = []
    for action in actions:
        if action not in normalized:
            normalized.append(action)
    return normalized


def _available_tool_names(available_tools: list[dict[str, Any]]) -> set[str]:
    names: set[str] = set()
    for tool in available_tools:
        if not isinstance(tool, dict):
            continue
        name = str(tool.get("name") or "").strip()
        if name:
            names.add(name)
    return names


def _remove_unknown_tool_actions(
    steps: list[dict[str, Any]],
    available_tools: list[dict[str, Any]],
    retain_tool_names: set[str] | None = None,
) -> tuple[list[dict[str, Any]], list[str]]:
    available_names = _available_tool_names(available_tools)
    retained_names = retain_tool_names or set()
    missing_names: list[str] = []
    if not available_names:
        available_names = set()
    normalized_steps: list[dict[str, Any]] = []
    for step in steps:
        next_step = dict(step)
        actions = []
        for action in next_step.get("allowed_actions", []):
            action_text = str(action)
            if not action_text.startswith("call_tool:"):
                actions.append(action_text)
                continue
            tool_name = action_text.replace("call_tool:", "", 1).strip()
            if tool_name in available_names or tool_name in retained_names:
                actions.append(action_text)
                continue
            if tool_name and tool_name not in missing_names:
                missing_names.append(tool_name)
        next_step["allowed_actions"] = actions
        normalized_steps.append(next_step)
    return normalized_steps, missing_names


def _tool_action_names_from_suggestions(suggestions: list[ToolSuggestion]) -> set[str]:
    names: set[str] = set()
    for suggestion in suggestions:
        if suggestion.resolution_status not in {"existing", "new_candidate"}:
            continue
        if suggestion.name:
            names.add(suggestion.name)
        if suggestion.matched_tool_name:
            names.add(suggestion.matched_tool_name)
    return names


def _normalize_tool_suggestions(
    value: Any, request: Any, missing_tool_names: list[str]
) -> list[ToolSuggestion]:
    suggestions: list[ToolSuggestion] = []
    seen: set[str] = set()

    if isinstance(value, list):
        for item in value:
            if not isinstance(item, dict):
                continue
            suggestion = _tool_mention_to_resolution(item, request)
            if suggestion is None:
                continue
            if suggestion.name in seen:
                continue
            suggestions.append(suggestion)
            seen.add(suggestion.name)

    return suggestions


def _tool_resolution_warnings(suggestions: list[ToolSuggestion]) -> list[str]:
    warnings: list[str] = []
    for suggestion in suggestions:
        if suggestion.resolution_status != "incomplete":
            continue
        label = suggestion.display_name or suggestion.name
        reason = suggestion.missing_reason or "缺少完整接口信息"
        warnings.append(f"模型提到了可能的工具「{label}」，但當前不能新增：{reason}。")
    return warnings


def _tool_mention_to_resolution(item: dict[str, Any], request: Any) -> ToolSuggestion | None:
    name = _string(item.get("name"), "") or _string(item.get("inferred_name"), "")
    display_name = _string(item.get("display_name"), "") or _string(item.get("label"), "")
    description = _string(item.get("description"), "") or _string(item.get("purpose"), "")
    url = _string(item.get("url"), "")
    method = _tool_method(item.get("method"), "POST")
    input_schema = item.get("input_schema")
    output_schema = item.get("output_schema")
    source_excerpt = _string(item.get("source_excerpt"), "") or None
    reason = _string(item.get("reason"), "") or _string(item.get("purpose"), "") or "模型從技能文檔中抽取到該工具提及。"

    matched_tool = _match_available_tool(name, url, request.available_tools)
    if matched_tool is not None:
        matched_name = _string(matched_tool.get("name"), name)
        return ToolSuggestion(
            name=matched_name,
            display_name=_string(matched_tool.get("display_name"), display_name or matched_name),
            description=_string(matched_tool.get("description"), description),
            method=_tool_method(matched_tool.get("method"), method),
            url=_string(matched_tool.get("url"), url),
            input_schema=matched_tool.get("input_schema") if isinstance(matched_tool.get("input_schema"), dict) else {},
            output_schema=matched_tool.get("output_schema") if isinstance(matched_tool.get("output_schema"), dict) else {},
            sample_arguments=item.get("sample_arguments") if isinstance(item.get("sample_arguments"), dict) else {},
            source_excerpt=source_excerpt,
            probe_result=item.get("probe_result") if isinstance(item.get("probe_result"), dict) else None,
            reason="已匹配到現有工具配置。",
            resolution_status="existing",
            matched_tool_id=_string(matched_tool.get("id"), "") or None,
            matched_tool_name=matched_name,
            matched_tool_display_name=_string(matched_tool.get("display_name"), "") or None,
        )

    if not name and not display_name and not url:
        return None

    missing_reasons = _tool_mention_missing_reasons(url, input_schema, output_schema, request)
    if missing_reasons:
        return ToolSuggestion(
            name=name or _tool_name_from_url(url) or display_name or "incomplete_tool",
            display_name=display_name or name or _tool_name_from_url(url) or "未完整配置的工具",
            description=description,
            method=method,
            url=url if _tool_suggestion_url_in_source(url, request) else "",
            input_schema=input_schema if isinstance(input_schema, dict) else {},
            output_schema=output_schema if isinstance(output_schema, dict) else {},
            sample_arguments=item.get("sample_arguments") if isinstance(item.get("sample_arguments"), dict) else {},
            source_excerpt=source_excerpt,
            probe_result=item.get("probe_result") if isinstance(item.get("probe_result"), dict) else None,
            reason=reason,
            resolution_status="incomplete",
            missing_reason="；".join(missing_reasons),
        )

    return ToolSuggestion(
        name=name or _tool_name_from_url(url),
        display_name=display_name or name or _tool_name_from_url(url),
        description=description,
        method=method,
        url=url,
        input_schema=input_schema,
        output_schema=output_schema,
        sample_arguments=item.get("sample_arguments") if isinstance(item.get("sample_arguments"), dict) else {},
        source_excerpt=source_excerpt,
        probe_result=item.get("probe_result") if isinstance(item.get("probe_result"), dict) else None,
        reason=reason,
        resolution_status="new_candidate",
    )


def _tool_mention_missing_reasons(url: str, input_schema: Any, output_schema: Any, request: Any) -> list[str]:
    reasons: list[str] = []
    if not url:
        reasons.append("缺少可訪問接口地址或路徑")
    elif not _tool_suggestion_url_in_source(url, request):
        reasons.append("接口地址未在技能原文或改寫上下文中出現")
    if not isinstance(input_schema, dict) or not input_schema:
        reasons.append("缺少輸入參數結構")
    if not isinstance(output_schema, dict) or not output_schema:
        reasons.append("缺少返回結果結構")
    return reasons


def _match_available_tool(name: str, url: str, available_tools: list[dict[str, Any]]) -> dict[str, Any] | None:
    name_text = name.strip()
    url_candidates = set(_tool_url_candidates(url))
    for tool in available_tools:
        if not isinstance(tool, dict):
            continue
        tool_name = _string(tool.get("name"), "")
        if name_text and tool_name and name_text == tool_name:
            return tool
        tool_url = _string(tool.get("url"), "")
        if tool_url and url_candidates.intersection(_tool_url_candidates(tool_url)):
            return tool
    return None


def _tool_name_from_url(url: str) -> str:
    candidates = _tool_url_candidates(url)
    path = candidates[-1] if candidates else url
    text = path.strip("/").replace("-", "_").replace("/", ".")
    text = re.sub(r"[^A-Za-z0-9_.]+", "_", text).strip("._")
    return text or "tool_candidate"


def _tool_suggestion_url_in_source(url: str, request: Any) -> bool:
    source = _tool_suggestion_source_text(request)
    if not source:
        return False
    return any(candidate in source for candidate in _tool_url_candidates(url))


def _tool_suggestion_source_text(request: Any) -> str:
    parts: list[str] = []
    for attr in ("raw_content", "instruction", "title", "business_domain", "target_label"):
        value = getattr(request, attr, None)
        if isinstance(value, str) and value.strip():
            parts.append(value)
    current_skill = getattr(request, "current_skill", None)
    if current_skill is not None:
        try:
            parts.append(json.dumps(current_skill.model_dump(mode="json"), ensure_ascii=False))
        except (TypeError, ValueError, AttributeError):
            parts.append(str(current_skill))
    conversation = getattr(request, "conversation", None)
    if isinstance(conversation, list):
        for item in conversation[-12:]:
            if isinstance(item, dict):
                content = item.get("content")
                if isinstance(content, str) and content.strip():
                    parts.append(content)
    return "\n".join(parts)


def _tool_url_candidates(url: str) -> list[str]:
    normalized = url.strip().strip("`'\"<>，。；;,")
    if not normalized:
        return []
    candidates = {normalized}
    parsed_source = normalized
    if normalized.startswith("/"):
        parsed_source = f"http://placeholder{normalized}"
    parsed = urlparse(parsed_source)
    if parsed.path and len(parsed.path.strip("/")) >= 3:
        candidates.add(parsed.path.rstrip("/") or parsed.path)
    if not normalized.startswith("/") and "/" in normalized and "://" not in normalized:
        candidates.add(f"/{normalized.lstrip('/')}")
    return sorted({item for item in candidates if len(item.strip("/")) >= 3}, key=len, reverse=True)


def _tool_method(value: Any, fallback: str = "POST") -> str:
    method = str(value or fallback or "POST").upper()
    return method if method in {"GET", "POST", "PUT", "PATCH", "DELETE"} else "POST"


def _infer_goals(raw: str) -> list[str]:
    clauses = [clause.strip() for clause in _split_clauses(raw) if clause.strip()]
    return clauses or ["理解用戶訴求", "收集必要信息", "完成流程處理", "向用戶反饋結果"]


def _split_clauses(text: str) -> list[str]:
    normalized = text.replace("\n", "，").replace("；", "，").replace(";", "，").replace(",", "，").replace("。", "，")
    return [part.strip() for part in normalized.split("，")]


def _slugify(title: str, raw: str) -> str:
    ascii_slug = "".join(char.lower() if char.isalnum() else "_" for char in title if ord(char) < 128)
    ascii_slug = "_".join(part for part in ascii_slug.split("_") if part)
    if ascii_slug:
        return ascii_slug[:48]
    digest = hashlib.md5(f"{title}:{raw}".encode("utf-8"), usedforsecurity=False).hexdigest()[:8]
    return f"skill_{digest}"
