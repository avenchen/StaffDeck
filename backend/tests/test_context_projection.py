from app.core.context_projection import (
    compact_awaiting_input,
    compact_conversation_context,
    compact_knowledge_context,
    compact_memory_context,
    compact_pending_tasks,
    compact_step_skill_context,
    compact_step_result,
)


def test_compact_knowledge_context_keeps_evidence_without_duplicate_payloads() -> None:
    result = {
        "query": {"query": "退款規則"},
        "source_message": "請查詢退款規則",
        "selected_documents": [
            {
                "id": "doc_1",
                "title": "退款規則",
                "summary": "文檔摘要" * 500,
                "outline": ["不應進入控制模型輸入"] * 100,
            }
        ],
        "chunks": [{"id": "chunk_1", "content": "重複切片" * 2_000}],
        "expanded_sections": [{"content": "完整目錄樹" * 2_000}],
        "evidence_pack": [
            {
                "chunk_id": "chunk_1",
                "source_path": "退款規則/時限",
                "summary": "七天內可申請退款",
                "content": "有效證據" * 2_000,
                "excerpt": "不應重複發送" * 2_000,
            }
        ],
    }

    compacted = compact_knowledge_context([result])

    assert len(compacted) == 1
    assert "chunks" not in compacted[0]
    assert "expanded_sections" not in compacted[0]
    assert "selected_documents" not in compacted[0]
    knowledge = compacted[0]["retrieved_knowledge"]
    assert knowledge[0]["label"] == "檢索到的知識 1"
    assert knowledge[1]["label"] == "檢索到的知識 2"
    assert "chunk_id" not in knowledge[0]
    assert len(knowledge[0]["content"]) <= 803
    assert "excerpt" not in knowledge[0]
    assert "outline" not in knowledge[1]
    assert len(knowledge[1]["summary"]) <= 603
    assert result["chunks"][0]["content"].startswith("重複切片")


def test_compact_step_result_only_projects_knowledge_results() -> None:
    payload = {
        "reply": "已找到規則",
        "slot_updates": {"order_id": "A001"},
        "knowledge_results": [
            {
                "evidence_pack": [
                    {"chunk_id": "chunk_1", "content": "證據" * 2_000}
                ]
            }
        ],
    }

    compacted = compact_step_result(payload)

    assert compacted["reply"] == "已找到規則"
    assert compacted["slot_updates"] == {"order_id": "A001"}
    assert "knowledge_results" not in compacted
    assert len(
        compacted["retrieved_knowledge"][0]["retrieved_knowledge"][0]["content"]
    ) <= 803


def test_compact_conversation_context_keeps_recent_history_within_control_budget() -> None:
    context = {
        "messages": [
            {"role": "user" if index % 2 == 0 else "assistant", "content": str(index) * 1_000}
            for index in range(20)
        ]
    }

    compacted = compact_conversation_context(context, token_budget=4_000)

    assert compacted["metadata"]["estimated_tokens"] <= 4_000
    assert compacted["messages"][-1]["content"].startswith("19")
    assert compacted["metadata"]["compacted"] is True


def test_step_skill_context_keeps_only_local_graph_and_complete_instructions() -> None:
    current_instruction = "當前節點業務說明" * 1_000
    target_instruction = "目標節點業務說明" * 1_000
    compacted = compact_step_skill_context(
        {
            "skill_id": "refund",
            "required_info": ["order_id"],
            "response_rules": ["展示退款狀態"],
            "nodes": [
                {
                    "node_id": "collect_order",
                    "type": "collect_info",
                    "instruction": current_instruction,
                    "expected_user_info": ["order_id"],
                    "allowed_actions": ["ask_user"],
                },
                {
                    "node_id": "query_order",
                    "type": "tool",
                    "instruction": target_instruction,
                },
                {"node_id": "unrelated", "instruction": "不得投影"},
            ],
            "edges": [
                {"source_node_id": "collect_order", "next_node_id": "query_order"},
                {"source_node_id": "query_order", "next_node_id": "unrelated"},
            ],
        },
        "collect_order",
    )

    assert compacted is not None
    assert "skill_id" not in compacted
    assert "response_rules" not in compacted
    assert "required_info" not in compacted
    assert compacted["current_step"]["instruction"] == current_instruction
    assert compacted["next_steps"] == [
        {
            "node_id": "query_order",
            "type": "tool",
            "instruction": target_instruction,
        }
    ]
    assert "nodes" not in compacted
    assert "edges" not in compacted
    assert "adjacent_edges" not in compacted
    assert "target_steps" not in compacted
    assert "name" not in str(compacted)
    assert "optional" not in str(compacted)
    assert "retry_policy" not in str(compacted)
    assert "unrelated" not in str(compacted)


def test_step_skill_context_embeds_only_direct_transition_metadata() -> None:
    compacted = compact_step_skill_context(
        {
            "nodes": [
                {"node_id": "current", "instruction": "當前"},
                {"node_id": "approved", "instruction": "通過"},
                {"node_id": "rejected", "instruction": "拒絕"},
                {"node_id": "after_approved", "instruction": "後續節點不得傳入"},
            ],
            "edges": [
                {
                    "source_node_id": "current",
                    "next_node_id": "approved",
                    "condition": "amount <= limit",
                    "label": "未超標",
                    "priority": 1,
                },
                {
                    "source_node_id": "current",
                    "next_node_id": "rejected",
                    "condition": "amount > limit",
                    "label": "超標",
                    "priority": 2,
                },
                {
                    "source_node_id": "approved",
                    "next_node_id": "after_approved",
                    "condition": "always",
                },
            ],
        },
        "current",
    )

    assert compacted is not None
    assert [step["node_id"] for step in compacted["next_steps"]] == [
        "approved",
        "rejected",
    ]
    assert compacted["next_steps"][0]["transition"] == {
        "condition": "amount <= limit",
        "label": "未超標",
    }
    assert compacted["next_steps"][1]["transition"] == {
        "condition": "amount > limit",
        "label": "超標",
    }
    assert "after_approved" not in str(compacted)


def test_compact_memory_context_only_returns_deduplicated_content_text() -> None:
    memory = compact_memory_context(
        [
            {
                "id": "mem_1",
                "tenant_id": "tenant_demo",
                "kind": "profile",
                "content": "32",
                "importance": 0.9,
                "metadata": {"key": "age", "reason": "用戶提供了年齡"},
                "updated_at": "2026-07-13T00:00:00",
            },
            {"id": "mem_2", "kind": "profile", "content": "32"},
            {"id": "mem_3", "kind": "fact", "content": "近期存在腸道不適"},
        ]
    )

    assert memory == "- 32\n- 近期存在腸道不適"
    assert "mem_" not in memory
    assert "updated_at" not in memory


def test_compact_runtime_state_drops_storage_and_audit_metadata() -> None:
    tasks = compact_pending_tasks(
        [
            {
                "task_id": "task_1",
                "tenant_id": "tenant_demo",
                "agent_id": "agent_1",
                "user_id": "user_1",
                "session_id": "session_1",
                "skill_id": "medical_consultation_v1",
                "step_id": "collect_symptoms",
                "slots": {"duration": "兩天"},
                "created_at": "2026-07-13T00:00:00",
                "updated_at": "2026-07-13T00:01:00",
                "source_turn_id": "turn_1",
            }
        ]
    )
    awaiting = compact_awaiting_input(
        {
            "task_id": "task_1",
            "turn_id": "turn_1",
            "skill_id": "medical_consultation_v1",
            "step_id": "collect_symptoms",
            "expected_fields": ["duration"],
            "created_at": "2026-07-13T00:00:00",
        }
    )

    assert tasks == [
        {
            "task_id": "task_1",
            "skill_id": "medical_consultation_v1",
            "step_id": "collect_symptoms",
            "slots": {"duration": "兩天"},
        }
    ]
    assert awaiting == {
        "skill_id": "medical_consultation_v1",
        "step_id": "collect_symptoms",
        "expected_fields": ["duration"],
    }
    serialized = str((tasks, awaiting))
    for field in (
        "tenant_id",
        "agent_id",
        "user_id",
        "session_id",
        "created_at",
        "updated_at",
        "source_turn_id",
    ):
        assert field not in serialized
