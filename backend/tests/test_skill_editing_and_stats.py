import json
from io import BytesIO
from zipfile import ZipFile

import pytest
from fastapi import HTTPException
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.api.chat import _active_skill_context_for_assistant_message, _active_skill_for_assistant_message
from app.api.skills import (
    _extract_uploaded_skill_file,
    _skill_stats,
    create_skill,
    draft_skill,
    distill_skill,
    list_skill_versions,
    list_skills,
    publish_skill,
    rollback_skill_version,
    skill_read,
    update_skill,
)
from app.agents.branching import ensure_open_gallery_binding, visible_published_skills
from app.db.models import AgentEvent, AgentProfile, Message, Skill, SkillFeedback, SkillVersion, Tenant, Tool, User
from app.db.models import ModelConfig
from app.skills.skill_distiller import SkillDistiller
from app.skills.skill_editor import SkillEditor
from app.skills.skill_reflection import PROMPT_PATH as SKILL_REFLECTION_PROMPT_PATH
from app.skills.skill_reflection import RUBRIC_LABELS
from app.skills.skill_schema import SkillCard, SkillCreateRequest, SkillDistillRequest, SkillDistillResponse, SkillRewriteRequest, SkillUpdateRequest
from app.security.encryption import encrypt_secret


def _admin_user() -> User:
    return User(id="user_admin", tenant_id="tenant_demo", username="admin", role="admin", password_hash="test")


def _owner_user() -> User:
    return User(id="user_owner", tenant_id="tenant_demo", username="owner", password_hash="test")


def test_skill_editor_only_merges_selected_step() -> None:
    current = _skill_card()
    candidate = _skill_card()
    candidate.name = "不應修改基礎信息"
    candidate.nodes[0].instruction = "新的收集說明"
    candidate.nodes[1].instruction = "不應修改其他步驟"

    response = SkillEditor()._normalize_response(  # noqa: SLF001
        {
            "assistant_message": "已改寫步驟。",
            "draft_skill": candidate.model_dump(),
            "changed_paths": ["nodes.collect_info"],
        },
        SkillRewriteRequest(
            tenant_id="tenant_demo",
            current_skill=current,
            instruction="只優化第一步",
            target_path="nodes.collect_info",
            target_label="步驟 1",
        ),
    )

    assert response.draft_skill.name == current.name
    assert response.draft_skill.nodes[0].instruction == "新的收集說明"
    assert response.draft_skill.nodes[1].instruction == current.nodes[1].instruction


def test_skill_editor_merges_multiple_selected_targets() -> None:
    current = _skill_card()
    candidate = _skill_card()
    candidate.description = "新的描述"
    candidate.nodes[0].instruction = "新的收集說明"
    candidate.nodes[1].instruction = "不應修改第二步"

    response = SkillEditor()._normalize_response(  # noqa: SLF001
        {
            "assistant_message": "已改寫多個區域。",
            "draft_skill": candidate.model_dump(),
        },
        SkillRewriteRequest(
            tenant_id="tenant_demo",
            current_skill=current,
            instruction="優化基礎信息和第一步",
            target_path="basic",
            target_paths=["basic", "nodes.collect_info"],
            target_label="基礎信息、步驟 1",
        ),
    )

    assert response.draft_skill.description == "新的描述"
    assert response.draft_skill.nodes[0].instruction == "新的收集說明"
    assert response.draft_skill.nodes[1].instruction == current.nodes[1].instruction


def test_skill_editor_can_target_node_by_index() -> None:
    current = _skill_card()
    candidate = _skill_card()
    candidate.nodes[0].instruction = "不應修改第一步"
    candidate.nodes[1].instruction = "只修改第二個節點"

    response = SkillEditor()._normalize_response(  # noqa: SLF001
        {
            "assistant_message": "已改寫指定下標節點。",
            "draft_skill": candidate.model_dump(),
        },
        SkillRewriteRequest(
            tenant_id="tenant_demo",
            current_skill=current,
            instruction="只改第二個節點",
            target_path="nodes[1]",
            target_paths=["nodes[1]"],
            target_label="步驟 2",
        ),
    )

    assert response.draft_skill.nodes[0].instruction == current.nodes[0].instruction
    assert response.draft_skill.nodes[1].instruction == "只修改第二個節點"


def test_skill_editor_allows_selected_step_deletion() -> None:
    current = _skill_card()
    candidate_data = current.model_dump(mode="json")
    candidate_data["nodes"] = candidate_data["nodes"][:1]
    candidate_data["edges"] = []
    candidate_data["terminal_node_ids"] = ["collect_info"]
    candidate = SkillCard.model_validate(candidate_data)

    response = SkillEditor()._normalize_response(  # noqa: SLF001
        {
            "assistant_message": "已刪除反饋步驟。",
            "draft_skill": candidate.model_dump(),
        },
        SkillRewriteRequest(
            tenant_id="tenant_demo",
            current_skill=current,
            instruction="刪除第二步",
            target_path="nodes[1]",
            target_paths=["nodes[1]"],
            target_label="步驟 2",
        ),
    )

    assert [step.node_id for step in response.draft_skill.nodes] == ["collect_info"]


def test_skill_editor_allows_selected_step_insertion() -> None:
    current = _skill_card()
    candidate_data = current.model_dump(mode="json")
    candidate_data["nodes"].insert(
        1,
        {
            "node_id": "confirm_purchase",
            "name": "確認購買信息",
            "instruction": "向用戶確認商品和數量。",
            "expected_user_info": ["purchase_confirmed"],
            "allowed_actions": ["ask_user", "continue_flow"],
        },
    )
    candidate = SkillCard.model_validate(candidate_data)

    response = SkillEditor()._normalize_response(  # noqa: SLF001
        {
            "assistant_message": "已新增確認步驟。",
            "draft_skill": candidate.model_dump(),
        },
        SkillRewriteRequest(
            tenant_id="tenant_demo",
            current_skill=current,
            instruction="在第一步後新增確認步驟",
            target_path="nodes[0]",
            target_paths=["nodes[0]"],
            target_label="步驟 1",
        ),
    )

    assert [step.node_id for step in response.draft_skill.nodes] == [
        "collect_info",
        "confirm_purchase",
        "reply_result",
    ]
    assert response.draft_skill.name == current.name


def test_skill_editor_merges_selected_step_id_change() -> None:
    current = _skill_card()
    current.nodes[1].node_id = "create_order"
    current.edges[0].next_node_id = "create_order"
    current.terminal_node_ids = ["create_order"]
    candidate = _skill_card()
    candidate.nodes[1].node_id = "feedback_order_result"
    candidate.edges[0].next_node_id = "feedback_order_result"
    candidate.terminal_node_ids = ["feedback_order_result"]

    response = SkillEditor()._normalize_response(  # noqa: SLF001
        {
            "assistant_message": "已修正步驟 ID。",
            "draft_skill": candidate.model_dump(),
        },
        SkillRewriteRequest(
            tenant_id="tenant_demo",
            current_skill=current,
            instruction="把反饋訂單結果的 step_id 從 create_order 改成 feedback_order_result",
            target_path="nodes[1]",
            target_paths=["nodes[1]"],
            target_label="步驟 2：反饋結果",
        ),
    )

    assert response.draft_skill.nodes[0].node_id == current.nodes[0].node_id
    assert response.draft_skill.nodes[1].node_id == "feedback_order_result"


def test_skill_editor_applies_step_id_corrections_to_final_draft() -> None:
    current = _skill_card()
    candidate = _skill_card()
    candidate.nodes[1].node_id = "feedback_order_result"
    candidate.edges[0].next_node_id = "feedback_order_result"
    candidate.terminal_node_ids = ["feedback_order_result"]

    response = SkillEditor()._normalize_response(  # noqa: SLF001
        {
            "assistant_message": "已修正步驟 ID。",
            "draft_skill": candidate.model_dump(),
        },
        SkillRewriteRequest(
            tenant_id="tenant_demo",
            current_skill=current,
            instruction="把第二個節點 ID 改成 feedback_order_result",
            target_path="nodes[1]",
            target_paths=["nodes[1]"],
            target_label="步驟 2",
        ),
    )

    assert response.draft_skill.nodes[0].node_id == "collect_info"
    assert response.draft_skill.nodes[1].node_id == "feedback_order_result"
    assert "nodes[1]" in response.changed_paths
    assert not response.warnings


def test_skill_editor_applies_patch_response_without_full_draft() -> None:
    current = _skill_card()
    response = SkillEditor()._normalize_response(  # noqa: SLF001
        {
            "assistant_message": "已精簡回覆規則。",
            "patches": [
                {
                    "path": "response_rules",
                    "value": ["信息不足時追問；工具成功後給出明確結果，不編造事實。"],
                }
            ],
            "changed_paths": ["basic"],
        },
        SkillRewriteRequest(
            tenant_id="tenant_demo",
            current_skill=current,
            instruction="回覆規則太長了，精簡一下",
            target_path="basic",
            target_paths=["basic", "nodes[0]", "nodes[1]"],
            target_label="全部區域",
        ),
    )

    assert response.draft_skill.response_rules == ["信息不足時追問；工具成功後給出明確結果，不編造事實。"]
    assert response.draft_skill.nodes[0].instruction == current.nodes[0].instruction


def test_skill_editor_stream_repairs_invalid_json_once(monkeypatch) -> None:
    def fake_stream(self, _system_prompt: str, _payload: dict):  # noqa: ANN001
        assert self.max_output_tokens == 8192
        yield '{"assistant_message": "截斷的輸出", "patches": ['

    def fake_text(self, _system_prompt: str, payload: dict):  # noqa: ANN001
        assert self.max_output_tokens == 8192
        if payload.get("reflection_round"):
            return _reflection_passes_json()
        assert "previous_error" in payload
        return json.dumps(
            {
                "assistant_message": "已精簡回覆規則。",
                "patches": [
                    {
                        "path": "response_rules",
                        "value": ["信息不足時追問；工具成功後給出明確結果，不編造事實。"],
                    }
                ],
            },
            ensure_ascii=False,
        )

    monkeypatch.setattr("app.skills.skill_editor.LLMClient.generate_text_stream", fake_stream)
    monkeypatch.setattr("app.skills.skill_editor.LLMClient.generate_text", fake_text)

    events = list(
        SkillEditor().stream_text(
            SkillRewriteRequest(
                tenant_id="tenant_demo",
                current_skill=_skill_card(),
                instruction="回覆規則太長了，精簡一下",
                target_path="basic",
                target_paths=["basic", "nodes[0]", "nodes[1]"],
                target_label="全部區域",
            ),
            _model_config(),
        )
    )
    status_texts = [event["data"]["text"] for event in events if event["event"] == "status"]
    complete = next(event for event in events if event["event"] == "complete")

    assert "模型輸出需要修復，正在重試一次" in status_texts
    assert "正在校驗改寫範圍與工具接入" in status_texts
    assert any(text.startswith("正在校驗技能結果") for text in status_texts)
    assert "正在整理校驗後的改寫結果" in status_texts
    assert complete["data"]["draft_skill"]["response_rules"] == [
        "信息不足時追問；工具成功後給出明確結果，不編造事實。"
    ]


def test_skill_stats_counts_skill_entry_and_feedback() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        content = _skill_card()
        db.add(
            Skill(
                tenant_id="tenant_demo",
                skill_id="purchase",
                version="1.5.0",
                name="購買商品",
                content_json=content.model_dump(),
                status="published",
            )
        )
        db.add(
            AgentEvent(
                tenant_id="tenant_demo",
                session_id="session_1",
                event_type="skill_started",
                payload_json={"to_skill_id": "purchase", "to_skill_version": "1.5.0"},
            )
        )
        db.add(
            AgentEvent(
                tenant_id="tenant_demo",
                session_id="session_2",
                event_type="skill_started",
                payload_json={"to_skill_id": "purchase", "to_skill_version": "1.5.0"},
            )
        )
        db.add(
            SkillFeedback(
                tenant_id="tenant_demo",
                skill_id="purchase",
                skill_version="1.5.0",
                session_id="session_1",
                message_id="msg_1",
                user_id="user_1",
                rating="up",
            )
        )
        db.add(
            SkillFeedback(
                tenant_id="tenant_demo",
                skill_id="purchase",
                skill_version="1.5.0",
                session_id="session_2",
                message_id="msg_2",
                user_id="user_2",
                rating="down",
            )
        )
        db.commit()

        stats = _skill_stats(db, "tenant_demo")

    assert stats["purchase"]["call_count"] == 2
    assert stats["purchase"]["positive_feedback_count"] == 1
    assert stats["purchase"]["negative_feedback_count"] == 1
    assert stats["purchase"]["positive_rate"] == 0.5
    assert stats["purchase"]["negative_rate"] == 0.5
    assert stats["purchase@1.5.0"]["call_count"] == 2
    assert stats["purchase@1.5.0"]["positive_feedback_count"] == 1
    assert stats["purchase@1.5.0"]["negative_feedback_count"] == 1


def test_skill_stats_count_one_negative_feedback_per_flow() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        content = _skill_card()
        db.add(
            Skill(
                tenant_id="tenant_demo",
                skill_id="purchase",
                version="1.5.0",
                name="購買商品",
                content_json=content.model_dump(),
                status="published",
            )
        )
        db.add(
            AgentEvent(
                tenant_id="tenant_demo",
                session_id="session_1",
                event_type="skill_started",
                payload_json={"to_skill_id": "purchase", "to_skill_version": "1.5.0"},
            )
        )
        for message_id in ["msg_1", "msg_2"]:
            db.add(
                SkillFeedback(
                    tenant_id="tenant_demo",
                    skill_id="purchase",
                    skill_version="1.5.0",
                    session_id="session_1",
                    message_id=message_id,
                    user_id="user_1",
                    rating="down",
                )
            )
        db.commit()

        stats = _skill_stats(db, "tenant_demo")

    assert stats["purchase"]["call_count"] == 1
    assert stats["purchase"]["negative_feedback_count"] == 1
    assert stats["purchase"]["negative_rate"] == 1.0
    assert stats["purchase@1.5.0"]["negative_feedback_count"] == 1


def test_skill_versions_are_snapshotted_with_version_stats() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(AgentProfile(id="agent_overall", tenant_id="tenant_demo", name="開放廣場", is_overall=True))
        content = _skill_card()
        row = Skill(
            tenant_id="tenant_demo",
            skill_id=content.skill_id,
            version="1.5.0",
            name=content.name,
            content_json=content.model_dump(),
            status="draft",
        )
        db.add(row)
        db.flush()
        ensure_open_gallery_binding(db, "tenant_demo", "skill", row.id, "active")
        db.add(
            AgentEvent(
                tenant_id="tenant_demo",
                session_id="session_1",
                event_type="skill_started",
                payload_json={"to_skill_id": content.skill_id, "to_skill_version": "1.5.0"},
            )
        )
        db.commit()

        versions = list_skill_versions(content.skill_id, "tenant_demo", db)

    assert versions[0].version == "1.5.0"
    assert versions[0].call_count == 1


def test_skill_id_cannot_be_modified_after_create() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        content = _skill_card()
        db.add(
            Skill(
                tenant_id="tenant_demo",
                skill_id=content.skill_id,
                version=content.version,
                name=content.name,
                content_json=content.model_dump(),
                status="published",
            )
        )
        db.commit()

        edited_content = content.model_copy(deep=True)
        edited_content.skill_id = "purchase_v2"

        with pytest.raises(HTTPException) as exc_info:
            update_skill(
                content.skill_id,
                SkillUpdateRequest(tenant_id="tenant_demo", content=edited_content, status="published"),
                db=db,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == "SOP skill_id cannot be modified"


def test_skill_can_return_to_draft_without_leaving_runtime_list() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(AgentProfile(id="agent_overall", tenant_id="tenant_demo", name="開放廣場", is_overall=True))
        content = _skill_card()
        row = Skill(
            tenant_id="tenant_demo",
            skill_id=content.skill_id,
            version=content.version,
            name=content.name,
            content_json=content.model_dump(),
            status="published",
        )
        db.add(row)
        db.commit()
        ensure_open_gallery_binding(db, "tenant_demo", "skill", row.id, "active")
        db.commit()

        drafted = draft_skill(content.skill_id, tenant_id="tenant_demo", db=db, current_user=_admin_user())

        assert drafted.status == "draft"
        assert [item.skill_id for item in list_skills("tenant_demo", db)] == [content.skill_id]
        assert visible_published_skills(db, "tenant_demo") == []

        published = publish_skill(content.skill_id, tenant_id="tenant_demo", db=db, current_user=_admin_user())

        assert published.status == "published"
        assert [item.skill_id for item in visible_published_skills(db, "tenant_demo")] == [content.skill_id]


def test_personal_created_skill_uses_agent_owner_as_creator() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        agent = AgentProfile(
            id="agent_owner",
            tenant_id="tenant_demo",
            name="個人員工",
            is_overall=False,
            metadata_json={
                "owner_user_id": "user_owner",
                "owner_username": "owner",
                "owner_display_name": "Owner",
                "created_by_user_id": "user_owner",
                "created_by_username": "owner",
            },
        )
        db.add(agent)
        db.commit()

        created = create_skill(
            SkillCreateRequest(tenant_id="tenant_demo", content=_skill_card(), status="published"),
            agent_id=agent.id,
            db=db,
            current_user=_owner_user(),
        )
        listed = list_skills("tenant_demo", db, agent_id=agent.id)

        assert created.metadata["creator_name"] == "owner"
        assert created.metadata["created_by_username"] == "owner"
        assert listed[0].metadata["creator_name"] == "owner"
        assert listed[0].metadata["created_by_username"] == "owner"


def test_personal_created_skill_binds_explicit_tools_to_its_skill_id() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        agent = AgentProfile(
            id="agent_tool_owner",
            tenant_id="tenant_demo",
            name="個人員工",
            is_overall=False,
            metadata_json={
                "owner_user_id": "user_owner",
                "owner_username": "owner",
            },
        )
        tool = Tool(
            tenant_id="tenant_demo",
            name="product.price_query",
            method="POST",
            url="http://localhost/api/mock/product/price-query",
            allowed_skills_json=["skill_price_compare_001"],
            enabled=True,
        )
        db.add(agent)
        db.add(tool)
        db.commit()

        content = _skill_card().model_copy(deep=True)
        content.skill_id = "price_compare_copy"
        content.nodes[0].allowed_actions = ["call_tool:product.price_query"]
        create_skill(
            SkillCreateRequest(
                tenant_id="tenant_demo",
                content=content,
                status="published",
            ),
            agent_id=agent.id,
            db=db,
            current_user=_owner_user(),
        )

        db.refresh(tool)
        assert tool.allowed_skills_json == [
            "skill_price_compare_001",
            "price_compare_copy",
        ]


def test_personal_created_skill_uses_current_admin_when_owner_missing() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        current_user = User(
            id="user_admin",
            tenant_id="tenant_demo",
            username="admin",
            role="admin",
            display_name="Admin",
            password_hash="test",
        )
        db.add(current_user)
        agent = AgentProfile(
            id="agent_legacy",
            tenant_id="tenant_demo",
            name="舊員工",
            is_overall=False,
            metadata_json={},
        )
        db.add(agent)
        db.commit()

        created = create_skill(
            SkillCreateRequest(tenant_id="tenant_demo", content=_skill_card(), status="published"),
            agent_id=agent.id,
            db=db,
            current_user=current_user,
        )
        listed = list_skills("tenant_demo", db, agent_id=agent.id)

        assert created.metadata["creator_name"] == "admin"
        assert created.metadata["created_by_username"] == "admin"
        assert listed[0].metadata["creator_name"] == "admin"
        assert listed[0].metadata["created_by_username"] == "admin"


def test_unversioned_stats_remain_aggregate_without_guessing_a_version() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(AgentProfile(id="agent_overall", tenant_id="tenant_demo", name="開放廣場", is_overall=True))
        content = _skill_card()
        old_content = content.model_copy(update={"version": "1.0.0"})
        new_content = content.model_copy(update={"version": "1.1.0"})
        row = Skill(
            tenant_id="tenant_demo",
            skill_id=content.skill_id,
            version="1.1.0",
            name=content.name,
            content_json=new_content.model_dump(),
            status="published",
        )
        db.add(row)
        db.flush()
        ensure_open_gallery_binding(db, "tenant_demo", "skill", row.id, "active")
        db.add(
            SkillVersion(
                tenant_id="tenant_demo",
                skill_id=content.skill_id,
                version="1.0.0",
                name=content.name,
                content_json=old_content.model_dump(),
                status="published",
            )
        )
        db.add(
            SkillVersion(
                tenant_id="tenant_demo",
                skill_id=content.skill_id,
                version="1.1.0",
                name=content.name,
                content_json=new_content.model_dump(),
                status="published",
            )
        )
        db.add(
            AgentEvent(
                tenant_id="tenant_demo",
                session_id="session_legacy",
                event_type="skill_started",
                payload_json={"to_skill_id": content.skill_id},
            )
        )
        db.add(
            SkillFeedback(
                tenant_id="tenant_demo",
                skill_id=content.skill_id,
                session_id="session_legacy",
                message_id="msg_legacy",
                user_id="user_legacy",
                rating="down",
            )
        )
        db.commit()

        versions = list_skill_versions(content.skill_id, "tenant_demo", db)
        stats = _skill_stats(db, "tenant_demo")
        versions_by_version = {version.version: version for version in versions}
        current_skill = db.exec(
            select(Skill).where(Skill.tenant_id == "tenant_demo", Skill.skill_id == content.skill_id)
        ).one()
        payload = skill_read(current_skill, stats)

    assert stats[content.skill_id]["call_count"] == 1
    assert stats[content.skill_id]["negative_feedback_count"] == 1
    assert versions_by_version["1.0.0"].call_count == 0
    assert versions_by_version["1.0.0"].negative_feedback_count == 0
    assert versions_by_version["1.0.0"].negative_rate == 0.0
    assert versions_by_version["1.1.0"].call_count == 0
    assert versions_by_version["1.1.0"].negative_feedback_count == 0
    assert versions_by_version["1.1.0"].negative_rate == 0.0
    assert payload.call_count == 0
    assert payload.negative_feedback_count == 0
    assert payload.negative_rate == 0.0


def test_unversioned_stats_do_not_fall_back_to_current_version() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        content = _skill_card()
        db.add(
            Skill(
                tenant_id="tenant_demo",
                skill_id=content.skill_id,
                version="1.0.0",
                name=content.name,
                content_json=content.model_dump(),
                status="published",
            )
        )
        db.add(
            AgentEvent(
                tenant_id="tenant_demo",
                session_id="session_legacy",
                event_type="skill_started",
                payload_json={"to_skill_id": content.skill_id},
            )
        )
        db.add(
            SkillFeedback(
                tenant_id="tenant_demo",
                skill_id=content.skill_id,
                session_id="session_legacy",
                message_id="msg_legacy",
                user_id="user_legacy",
                rating="down",
            )
        )
        db.commit()

        current_skill = db.exec(
            select(Skill).where(Skill.tenant_id == "tenant_demo", Skill.skill_id == content.skill_id)
        ).one()
        stats = _skill_stats(db, "tenant_demo")
        payload = skill_read(current_skill, stats)

    assert stats[content.skill_id]["call_count"] == 1
    assert stats[content.skill_id]["negative_feedback_count"] == 1
    assert payload.call_count == 0
    assert payload.negative_feedback_count == 0
    assert payload.negative_rate == 0.0


def test_rollback_skill_version_restores_content_without_copying_stats() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        old_content = _skill_card()
        old_content.version = "1.0.0"
        old_content.name = "舊版購買"
        new_content = _skill_card()
        new_content.version = "1.1.0"
        new_content.name = "新版購買"
        db.add(
            Skill(
                tenant_id="tenant_demo",
                skill_id=old_content.skill_id,
                version="1.1.0",
                name=new_content.name,
                content_json=new_content.model_dump(),
                status="published",
            )
        )
        db.add(
            SkillVersion(
                tenant_id="tenant_demo",
                skill_id=old_content.skill_id,
                version="1.0.0",
                name=old_content.name,
                content_json=old_content.model_dump(),
                status="published",
            )
        )
        db.add(
            SkillVersion(
                tenant_id="tenant_demo",
                skill_id=old_content.skill_id,
                version="1.1.0",
                name=new_content.name,
                content_json=new_content.model_dump(),
                status="published",
            )
        )
        db.commit()

        payload = rollback_skill_version(
            old_content.skill_id,
            "1.0.0",
            "tenant_demo",
            db,
            current_user=_admin_user(),
        )
        row = db.exec(
            select(Skill).where(
                Skill.tenant_id == "tenant_demo",
                Skill.skill_id == old_content.skill_id,
            )
        ).one()

    assert payload.version == "1.0.0"
    assert payload.name == "舊版購買"
    assert payload.status == "published"
    assert row.content_json["version"] == "1.0.0"
    assert row.content_json["name"] == "舊版購買"


def test_skill_read_uses_current_version_stats_for_skill_list() -> None:
    content = _skill_card()
    row = Skill(
        tenant_id="tenant_demo",
        skill_id="purchase",
        version="1.5.0",
        name="購買商品",
        content_json=content.model_dump(),
        status="published",
    )
    payload = skill_read(
        row,
        {
            "purchase": {
                "call_count": 3,
                "positive_feedback_count": 2,
                "negative_feedback_count": 1,
                "positive_rate": 0.6667,
                "negative_rate": 0.3333,
            },
            "purchase@1.5.0": {
                "call_count": 1,
                "positive_feedback_count": 0,
                "negative_feedback_count": 0,
                "positive_rate": 0.0,
                "negative_rate": 0.0,
            },
        },
    )

    assert payload.call_count == 1
    assert payload.positive_feedback_count == 0
    assert payload.negative_feedback_count == 0


def test_skill_read_includes_total_and_recent_version_ranking_stats() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(AgentProfile(id="agent_overall", tenant_id="tenant_demo", name="整體智能體", is_overall=True))
        content = _skill_card()
        current = content.model_copy(update={"version": "1.3.0"})
        skill = Skill(
            tenant_id="tenant_demo",
            skill_id=content.skill_id,
            version="1.3.0",
            name=content.name,
            content_json=current.model_dump(),
            status="published",
        )
        db.add(skill)
        db.flush()
        ensure_open_gallery_binding(db, "tenant_demo", "skill", skill.id, "active")
        for version in ["1.0.0", "1.1.0", "1.2.0", "1.3.0"]:
            version_content = content.model_copy(update={"version": version})
            db.add(
                SkillVersion(
                    tenant_id="tenant_demo",
                    skill_id=content.skill_id,
                    version=version,
                    name=content.name,
                    content_json=version_content.model_dump(),
                    status="published",
                )
            )
            db.add(
                AgentEvent(
                    tenant_id="tenant_demo",
                    session_id=f"session_{version}",
                    event_type="skill_started",
                    payload_json={"to_skill_id": content.skill_id, "to_skill_version": version},
                )
            )
        db.add(
            SkillFeedback(
                tenant_id="tenant_demo",
                skill_id=content.skill_id,
                skill_version="1.0.0",
                session_id="session_1.0.0",
                message_id="msg_old",
                user_id="user_old",
                rating="down",
            )
        )
        db.add(
            SkillFeedback(
                tenant_id="tenant_demo",
                skill_id=content.skill_id,
                skill_version="1.2.0",
                session_id="session_1.2.0",
                message_id="msg_recent_up",
                user_id="user_recent_up",
                rating="up",
            )
        )
        db.add(
            SkillFeedback(
                tenant_id="tenant_demo",
                skill_id=content.skill_id,
                skill_version="1.3.0",
                session_id="session_1.3.0",
                message_id="msg_recent_down",
                user_id="user_recent_down",
                rating="down",
            )
        )
        db.commit()

        rows = list_skills("tenant_demo", db)

    payload = rows[0]
    assert payload.call_count == 1
    assert payload.total_call_count == 4
    assert payload.total_negative_feedback_count == 2
    assert payload.recent_versions == ["1.3.0", "1.2.0", "1.1.0"]
    assert payload.recent_call_count == 3
    assert payload.recent_positive_feedback_count == 1
    assert payload.recent_negative_feedback_count == 1
    assert payload.recent_positive_rate == 0.3333
    assert payload.recent_negative_rate == 0.3333


def test_message_feedback_attribution_uses_turn_active_skill() -> None:
    with _test_session() as db:
        db.add(Message(id="msg_user", tenant_id="tenant_demo", session_id="session_1", role="user", content="我要退款"))
        assistant = Message(
            id="msg_assistant",
            tenant_id="tenant_demo",
            session_id="session_1",
            role="assistant",
            content="請提供訂單號。",
        )
        db.add(assistant)
        db.add(
            AgentEvent(
                tenant_id="tenant_demo",
                session_id="session_1",
                event_type="user_message_received",
                payload_json={"message_id": "msg_user", "message": "我要退款"},
            )
        )
        db.add(
            AgentEvent(
                tenant_id="tenant_demo",
                session_id="session_1",
                event_type="skill_started",
                payload_json={"to_skill_id": "refund", "to_step_id": "collect_order"},
            )
        )
        db.add(
            AgentEvent(
                tenant_id="tenant_demo",
                session_id="session_1",
                event_type="assistant_message_created",
                payload_json={"message_id": "msg_assistant", "reply": "請提供訂單號。"},
            )
        )
        db.commit()

        skill_id = _active_skill_for_assistant_message(db, "tenant_demo", assistant)
        context = _active_skill_context_for_assistant_message(db, "tenant_demo", assistant)

    assert skill_id == "refund"
    assert context == {"skill_id": "refund", "skill_version": None, "node_id": "collect_order"}


def test_message_feedback_attribution_uses_router_skill_hint_for_legacy_step_event() -> None:
    with _test_session() as db:
        db.add(Message(id="msg_user", tenant_id="tenant_demo", session_id="session_1", role="user", content="繼續下單"))
        assistant = Message(
            id="msg_assistant",
            tenant_id="tenant_demo",
            session_id="session_1",
            role="assistant",
            content="已為您下單。",
        )
        db.add(assistant)
        db.add(
            AgentEvent(
                tenant_id="tenant_demo",
                session_id="session_1",
                event_type="user_message_received",
                payload_json={"message_id": "msg_user", "message": "繼續下單"},
            )
        )
        db.add(
            AgentEvent(
                tenant_id="tenant_demo",
                session_id="session_1",
                event_type="router_decision_created",
                payload_json={
                    "decision": "continue_active",
                    "target_skill_id": "purchase",
                    "target_node_id": "create_order",
                },
            )
        )
        db.add(
            AgentEvent(
                tenant_id="tenant_demo",
                session_id="session_1",
                event_type="skill_step_changed",
                payload_json={"from_step_id": "confirm_purchase", "to_step_id": "create_order"},
            )
        )
        db.add(
            AgentEvent(
                tenant_id="tenant_demo",
                session_id="session_1",
                event_type="assistant_message_created",
                payload_json={"message_id": "msg_assistant", "reply": "已為您下單。"},
            )
        )
        db.commit()

        skill_id = _active_skill_for_assistant_message(db, "tenant_demo", assistant)
        context = _active_skill_context_for_assistant_message(db, "tenant_demo", assistant)

    assert skill_id == "purchase"
    assert context == {"skill_id": "purchase", "skill_version": None, "node_id": "create_order"}


def test_skill_read_preserves_graph_node_ids() -> None:
    content = _skill_card()
    row = Skill(
        tenant_id="tenant_demo",
        skill_id=content.skill_id,
        name=content.name,
        content_json=content.model_dump(),
        status="draft",
    )

    payload = skill_read(row)
    node_ids = [node.node_id for node in payload.content.nodes]

    assert node_ids == ["collect_info", "reply_result"]


def test_skill_distiller_stream_uses_generation_status(monkeypatch) -> None:
    def fake_stream(self, _system_prompt: str, _payload: str):  # noqa: ANN001
        assert self.max_output_tokens == 8192
        assert isinstance(_payload, str)
        assert _payload.startswith("技能標題：商品比價\n原始流程：")
        assert not _payload.lstrip().startswith("{")
        yield """
        {
          "draft_skill": {
            "skill_id": "skill_compare_price",
            "name": "商品比價",
            "version": "1.0.0",
            "business_domain": "ecommerce",
            "description": "比較兩個商品價格。",
            "trigger_intents": ["compare_price"],
            "user_utterance_examples": ["比較 A 和 B"],
            "goal": ["收集兩個商品名稱", "反饋比價結果"],
            "required_info": ["product_name_1", "product_name_2"],
            "slot_filling_policy": {
              "enabled": true,
              "multi_slot_per_turn": true,
              "extract_scope": "all_skill_expected_user_info",
              "skip_satisfied_steps": true,
              "target_info": ["product_name_1", "product_name_2"]
            },
            "nodes": [
              {
                "node_id": "collect_names",
                "name": "收集商品名稱",
                "instruction": "收集兩個商品名稱。",
                "expected_user_info": ["product_name_1", "product_name_2"],
                "allowed_actions": ["ask_user"]
              },
              {
                "node_id": "reply_result",
                "name": "反饋結果",
                "instruction": "反饋明確結果。",
                "expected_user_info": [],
                "allowed_actions": ["answer_user"]
              }
            ],
            "interruption_policy": {},
            "response_rules": []
          },
            "warnings": []
        }
        """

    def fake_text(self, _system_prompt: str, payload: dict):  # noqa: ANN001
        assert self.max_output_tokens == 8192
        assert payload.get("reflection_round") == 1
        return _reflection_passes_json()

    monkeypatch.setattr("app.skills.skill_distiller.LLMClient.generate_text_stream", fake_stream)
    monkeypatch.setattr("app.skills.skill_distiller.LLMClient.generate_text", fake_text)
    events = list(
        SkillDistiller().stream_text(
            SkillDistillRequest(
                tenant_id="tenant_demo",
                title="商品比價",
                raw_content="用戶提供兩個商品的名稱，系統根據商品價格進行比價",
            ),
            _model_config(),
        )
    )
    status_texts = [event["data"]["text"] for event in events if event["event"] == "status"]

    assert "正在改寫技能" not in status_texts
    assert "模型正在規劃技能結構" in status_texts
    assert "正在校驗模型輸出結構" in status_texts
    assert "正在校驗步驟閉環與工具接入" in status_texts
    assert any(text.startswith("正在校驗技能結果") for text in status_texts)
    assert "正在整理校驗後的技能草稿" in status_texts
    assert "校驗完成，已完成 Skill Card 結構化" in status_texts


def test_skill_distiller_stream_reflects_and_repairs_generated_skill(monkeypatch) -> None:
    def fake_stream(self, _system_prompt: str, _payload: dict):  # noqa: ANN001
        assert self.max_output_tokens == 8192
        yield json.dumps(
            {
                "draft_skill": {
                    "skill_id": "skill_purchase",
                    "name": "購買流程",
                    "version": "1.0.0",
                    "business_domain": "ecommerce",
                    "description": "收集商品並反饋。",
                    "trigger_intents": ["buy_product"],
                    "user_utterance_examples": ["我要買 A1"],
                    "goal": ["收集商品", "創建訂單"],
                    "required_info": ["product_id"],
                    "slot_filling_policy": {"enabled": True},
                    "response_rules": [],
                    "nodes": [
                        {
                            "node_id": "collect_product",
                            "name": "收集商品",
                            "instruction": "收集商品。",
                            "expected_user_info": ["product_id"],
                            "allowed_actions": ["ask_user"],
                        }
                    ],
                    "interruption_policy": {},
                },
                "warnings": [],
            },
            ensure_ascii=False,
        )

    def fake_text(self, _system_prompt: str, payload: dict):  # noqa: ANN001
        assert self.max_output_tokens == 8192
        if payload.get("reflection_round") == 1:
            revised = dict(payload["candidate_skill"])
            revised["nodes"] = [
                *revised["nodes"],
                {
                    "node_id": "reply_result",
                    "name": "反饋結果",
                    "instruction": "給用戶明確最終回覆。",
                    "expected_user_info": [],
                    "allowed_actions": ["answer_user"],
                },
            ]
            return json.dumps(
                {
                    "passed": False,
                    "summary": "缺少閉環回覆步驟，已補充。",
                    "rubric_results": [
                        {
                            "name": "closed_loop",
                            "passed": False,
                            "finding": "沒有最終回覆步驟",
                            "origin": "generated_skill",
                        }
                    ],
                    "warnings": [],
                    "source_warnings": [],
                    "draft_skill": revised,
                    "tool_mentions": [],
                },
                ensure_ascii=False,
            )
        if payload.get("reflection_round") == 2:
            return _reflection_passes_json()
        raise AssertionError(f"unexpected payload: {payload}")

    monkeypatch.setattr("app.skills.skill_distiller.LLMClient.generate_text_stream", fake_stream)
    monkeypatch.setattr("app.skills.skill_distiller.LLMClient.generate_text", fake_text)

    events = list(
        SkillDistiller().stream_text(
            SkillDistillRequest(
                tenant_id="tenant_demo",
                title="購買流程",
                raw_content="用戶購買商品後需要得到明確訂單結果",
            ),
            _model_config(),
        )
    )
    status_texts = [event["data"]["text"] for event in events if event["event"] == "status"]
    complete = next(event for event in events if event["event"] == "complete")

    assert any("校驗發現：閉環能力" in text for text in status_texts)
    assert any("校驗未通過，正在應用第 1 輪修正" in text for text in status_texts)
    assert any("校驗通過" in text for text in status_texts)
    assert any(event["event"] == "chunk_reset" for event in events)
    assert [step["node_id"] for step in complete["data"]["draft_skill"]["nodes"]][-1] == "reply_result"


def test_skill_distiller_reflection_checks_tool_call_format_without_rule_fallback(monkeypatch) -> None:
    def fake_stream(self, _system_prompt: str, _payload: dict):  # noqa: ANN001
        assert self.max_output_tokens == 8192
        yield json.dumps(
            {
                "draft_skill": {
                    "skill_id": "skill_price_compare",
                    "name": "商品比價",
                    "version": "1.0.0",
                    "business_domain": "ecommerce",
                    "description": "查詢商品價格並比較。",
                    "trigger_intents": ["compare_price"],
                    "user_utterance_examples": ["比較 A1 和 A3"],
                    "goal": ["查詢價格", "反饋比價結果"],
                    "required_info": ["product_name_1", "product_name_2"],
                    "slot_filling_policy": {"enabled": True},
                    "response_rules": [],
                    "nodes": [
                        {
                            "node_id": "query_price",
                            "name": "查詢價格",
                            "instruction": "當商品名已滿足時調用 product.price_query 工具查詢價格。",
                            "expected_user_info": ["product_name_1", "product_name_2"],
                            "allowed_actions": ["call_tool", "continue_flow"],
                        },
                        {
                            "node_id": "reply_result",
                            "name": "反饋結果",
                            "instruction": "基於工具結果反饋比價結果。",
                            "expected_user_info": [],
                            "allowed_actions": ["answer_user"],
                        },
                    ],
                    "interruption_policy": {},
                },
                "warnings": [],
                "tool_mentions": [],
            },
            ensure_ascii=False,
        )

    def fake_text(self, _system_prompt: str, payload: dict):  # noqa: ANN001
        assert self.max_output_tokens == 8192
        if payload.get("reflection_round") == 1:
            rubric_names = {item["name"] for item in payload["rubrics"]}
            assert "tool_call_format" in rubric_names
            assert payload["candidate_skill"]["nodes"][0]["allowed_actions"] == ["call_tool", "continue_flow"]
            revised = dict(payload["candidate_skill"])
            revised["nodes"] = [dict(step) for step in revised["nodes"]]
            revised["nodes"][0]["allowed_actions"] = ["call_tool:product.price_query", "continue_flow"]
            revised["nodes"][0]["instruction"] = (
                "當商品名已滿足時調用 product.price_query 工具查詢價格；"
                "工具成功後基於返回價格繼續組織最終回覆。"
            )
            return json.dumps(
                {
                    "passed": False,
                    "summary": "工具調用動作缺少具體工具名，已修正。",
                    "rubric_results": [
                        {
                            "name": "tool_call_format",
                            "passed": False,
                            "finding": "allowed_actions 中出現裸 call_tool，必須寫成 call_tool:<tool_name>。",
                            "origin": "generated_skill",
                        }
                    ],
                    "warnings": [],
                    "source_warnings": [],
                    "draft_skill": revised,
                    "tool_mentions": [],
                },
                ensure_ascii=False,
            )
        if payload.get("reflection_round") == 2:
            return _reflection_passes_json()
        raise AssertionError(f"unexpected payload: {payload}")

    monkeypatch.setattr("app.skills.skill_distiller.LLMClient.generate_text_stream", fake_stream)
    monkeypatch.setattr("app.skills.skill_distiller.LLMClient.generate_text", fake_text)

    events = list(
        SkillDistiller().stream_text(
            SkillDistillRequest(
                tenant_id="tenant_demo",
                title="商品比價",
                raw_content="用商品價格查詢工具 product.price_query 查詢兩個商品價格後反饋比價結果。",
                available_tools=[{"name": "product.price_query", "input_schema": {"required": ["product_name"]}}],
            ),
            _model_config(),
        )
    )
    status_texts = [event["data"]["text"] for event in events if event["event"] == "status"]
    complete = next(event for event in events if event["event"] == "complete")

    assert any("校驗發現：工具調用格式" in text for text in status_texts)
    assert complete["data"]["draft_skill"]["nodes"][0]["allowed_actions"] == [
        "call_tool:product.price_query",
        "continue_flow",
    ]


def test_skill_reflection_prompt_keeps_new_candidate_tool_actions() -> None:
    prompt = SKILL_REFLECTION_PROMPT_PATH.read_text(encoding="utf-8")

    assert RUBRIC_LABELS["tool_grounding"] == "工具依據"
    assert "resolution_status 為 existing 或 new_candidate" in prompt
    assert "保留該 action" in prompt
    assert "不得僅因不在 available_tools" in prompt
    assert "tool_suggestions(existing/new_candidate)" in prompt


def test_skill_distiller_stream_repairs_invalid_json_with_model(monkeypatch) -> None:
    def fake_stream(self, _system_prompt: str, _payload: dict):  # noqa: ANN001
        assert self.max_output_tokens == 8192
        yield '{"draft_skill": {"name": "截斷"'

    def fake_text(self, _system_prompt: str, payload: dict):  # noqa: ANN001
        assert self.max_output_tokens == 8192
        if payload.get("reflection_round"):
            return _reflection_passes_json()
        assert payload["repair_attempt"] == 1
        return json.dumps(
            {
                "draft_skill": {
                    "skill_id": "skill_compare_price",
                    "name": "商品比價",
                    "version": "1.0.0",
                    "business_domain": "ecommerce",
                    "description": "比較兩個商品價格。",
                    "trigger_intents": ["compare_price"],
                    "user_utterance_examples": ["比較 A 和 B"],
                    "goal": ["收集兩個商品名稱", "反饋比價結果"],
                    "required_info": ["product_name_1", "product_name_2"],
                    "slot_filling_policy": {
                        "enabled": True,
                        "multi_slot_per_turn": True,
                        "extract_scope": "all_skill_expected_user_info",
                        "skip_satisfied_steps": True,
                        "target_info": ["product_name_1", "product_name_2"],
                    },
                    "response_rules": ["不要編造價格。"],
                    "nodes": [
                        {
                            "node_id": "collect_names",
                            "name": "收集商品名稱",
                            "instruction": "收集兩個商品名稱。",
                            "expected_user_info": ["product_name_1", "product_name_2"],
                            "allowed_actions": ["ask_user"],
                        },
                        {
                            "node_id": "reply_result",
                            "name": "反饋結果",
                            "instruction": "反饋明確結果。",
                            "expected_user_info": [],
                            "allowed_actions": ["answer_user"],
                        },
                    ],
                    "interruption_policy": {},
                },
                "warnings": [],
            },
            ensure_ascii=False,
        )

    monkeypatch.setattr("app.skills.skill_distiller.LLMClient.generate_text_stream", fake_stream)
    monkeypatch.setattr("app.skills.skill_distiller.LLMClient.generate_text", fake_text)

    events = list(
        SkillDistiller().stream_text(
            SkillDistillRequest(
                tenant_id="tenant_demo",
                title="商品比價",
                raw_content="用戶提供兩個商品的名稱，系統根據商品價格進行比價",
            ),
            _model_config(),
        )
    )
    status_texts = [event["data"]["text"] for event in events if event["event"] == "status"]
    complete = next(event for event in events if event["event"] == "complete")

    assert "模型輸出需要修復，正在重試" in status_texts
    assert any(event["event"] == "chunk_reset" for event in events)
    assert complete["data"]["draft_skill"]["name"] == "商品比價"


def test_skill_distiller_stream_uses_staged_generation_after_repair_failure(monkeypatch) -> None:
    def fake_stream(self, _system_prompt: str, _payload: dict):  # noqa: ANN001
        assert self.max_output_tokens == 8192
        yield '{"draft_skill": {"name": "截斷"'

    def fake_text(self, _system_prompt: str, payload: dict):  # noqa: ANN001
        assert self.max_output_tokens == 8192
        if payload.get("reflection_round"):
            return _reflection_passes_json()
        if "repair_instruction" in payload:
            return "still invalid"
        mode = payload.get("generation_mode")
        if mode == "outline_only":
            return json.dumps(
                {
                    "draft_skill": {
                        "skill_id": "skill_compare_price",
                        "name": "商品比價",
                        "version": "1.0.0",
                        "business_domain": "ecommerce",
                        "description": "比較兩個商品價格。",
                        "trigger_intents": ["compare_price"],
                        "user_utterance_examples": ["比較 A 和 B"],
                        "goal": ["收集兩個商品名稱", "反饋比價結果"],
                        "required_info": ["product_name_1", "product_name_2"],
                        "slot_filling_policy": {
                            "enabled": True,
                            "multi_slot_per_turn": True,
                            "extract_scope": "all_skill_expected_user_info",
                            "skip_satisfied_steps": True,
                            "target_info": ["product_name_1", "product_name_2"],
                        },
                        "response_rules": ["不要編造價格。"],
                        "nodes": [
                            {
                                "node_id": "collect_names",
                                "name": "收集商品名稱",
                                "instruction": "收集兩個商品名稱。",
                                "expected_user_info": ["product_name_1", "product_name_2"],
                                "allowed_actions": ["ask_user"],
                            },
                            {
                                "node_id": "reply_result",
                                "name": "反饋結果",
                                "instruction": "反饋結果。",
                                "expected_user_info": [],
                                "allowed_actions": ["answer_user"],
                            },
                        ],
                        "interruption_policy": {},
                    },
                    "warnings": [],
                },
                ensure_ascii=False,
            )
        if mode == "expand_node":
            node = dict(payload["target_node"])
            node["instruction"] = f"擴寫步驟 {payload['target_node_index'] + 1}，支持自適應推進。"
            return json.dumps({"node": node, "warnings": [], "tool_suggestions": []}, ensure_ascii=False)
        if mode == "final_review":
            return json.dumps({"draft_skill": payload["current_draft"], "warnings": []}, ensure_ascii=False)
        raise AssertionError(f"unexpected payload: {payload}")

    monkeypatch.setattr("app.skills.skill_distiller.LLMClient.generate_text_stream", fake_stream)
    monkeypatch.setattr("app.skills.skill_distiller.LLMClient.generate_text", fake_text)

    events = list(
        SkillDistiller().stream_text(
            SkillDistillRequest(
                tenant_id="tenant_demo",
                title="商品比價",
                raw_content="用戶提供兩個商品的名稱，系統根據商品價格進行比價",
            ),
            _model_config(),
        )
    )
    status_texts = [event["data"]["text"] for event in events if event["event"] == "status"]
    complete = next(event for event in events if event["event"] == "complete")
    instructions = [node["instruction"] for node in complete["data"]["draft_skill"]["nodes"]]

    assert "模型修復失敗，改用分段生成" in status_texts
    assert any("擴寫步驟 1" in instruction for instruction in instructions)
    assert any("擴寫步驟 2" in instruction for instruction in instructions)


def test_distill_skill_uses_selected_model_config(monkeypatch) -> None:
    captured: dict[str, str] = {}

    def fake_distill(self, request, model_config):  # noqa: ANN001
        captured["model_id"] = model_config.id
        return SkillDistillResponse(draft_skill=_skill_card())

    monkeypatch.setattr("app.api.skills.SkillDistiller.distill", fake_distill)

    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(
            ModelConfig(
                id="model_default",
                tenant_id="tenant_demo",
                name="默認模型",
                api_key_encrypted="",
                model="default-model",
                is_default=True,
            )
        )
        db.add(
            ModelConfig(
                id="model_selected",
                tenant_id="tenant_demo",
                name="選擇模型",
                api_key_encrypted="",
                model="selected-model",
            )
        )
        db.commit()

        distill_skill(
            SkillDistillRequest(
                tenant_id="tenant_demo",
                title="測試 SOP",
                raw_content="用戶說 hello 時回覆 hi",
                model_config_id="model_selected",
            ),
            db=db,
            current_user=_admin_user(),
        )

    assert captured["model_id"] == "model_selected"


def test_extract_uploaded_skill_file_reads_docx_text() -> None:
    buffer = BytesIO()
    with ZipFile(buffer, "w") as archive:
        archive.writestr(
            "word/document.xml",
            """
            <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
              <w:body>
                <w:p><w:r><w:t>標題：商品比價</w:t></w:r></w:p>
                <w:p><w:r><w:t>用戶提供兩個商品名稱後進行比價。</w:t></w:r></w:p>
              </w:body>
            </w:document>
            """,
        )

    text = _extract_uploaded_skill_file("skill.docx", buffer.getvalue())

    assert "標題：商品比價" in text
    assert "用戶提供兩個商品名稱後進行比價。" in text


def _skill_card() -> SkillCard:
    return SkillCard(
        skill_id="purchase",
        name="購買商品",
        version="1.0.0",
        business_domain="commerce",
        description="購買流程",
        trigger_intents=["購買"],
        user_utterance_examples=["我要買 A1"],
        goal=["完成下單"],
        required_info=["product_id"],
        nodes=[
            {
                "node_id": "collect_info",
                "name": "收集信息",
                "instruction": "收集商品信息",
                "expected_user_info": ["product_id"],
                "allowed_actions": ["ask_user", "continue_flow"],
            },
            {
                "node_id": "reply_result",
                "name": "反饋結果",
                "instruction": "反饋訂單結果",
                "expected_user_info": [],
                "allowed_actions": ["answer_user"],
            },
        ],
        edges=[
            {
                "source_node_id": "collect_info",
                "next_node_id": "reply_result",
                "priority": 0,
                "label": "默認推進",
            }
        ],
        start_node_id="collect_info",
        terminal_node_ids=["reply_result"],
        interruption_policy={},
        response_rules=[],
    )


def _reflection_passes_json() -> str:
    return json.dumps(
        {
            "passed": True,
            "summary": "通過",
            "rubric_results": [
                {"name": "source_alignment", "passed": True, "finding": "", "origin": "generated_skill"},
                {"name": "closed_loop", "passed": True, "finding": "", "origin": "generated_skill"},
                {"name": "adaptive_progression", "passed": True, "finding": "", "origin": "generated_skill"},
                {"name": "tool_grounding", "passed": True, "finding": "", "origin": "generated_skill"},
                {"name": "side_effect_confirmation", "passed": True, "finding": "", "origin": "generated_skill"},
                {"name": "interruption_and_recovery", "passed": True, "finding": "", "origin": "generated_skill"},
            ],
            "warnings": [],
            "source_warnings": [],
            "tool_mentions": [],
        },
        ensure_ascii=False,
    )


def _model_config() -> ModelConfig:
    return ModelConfig(
        tenant_id="tenant_demo",
        name="mock",
        api_key_encrypted=encrypt_secret("mock"),
        model="mock-model",
    )


def _test_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)
