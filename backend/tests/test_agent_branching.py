from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.agents.branching import (
    copy_overall_scope_to_agent,
    ensure_knowledge_base_version,
    knowledge_version_for_upload,
    require_overall_agent,
    update_branch_skill,
    visible_skill_rows,
)
from app.agents.schema import AgentResourceImportRequest
from app.api.agents import _skill_branch_read, import_agent_resources
from app.db.models import (
    AgentProfile,
    AgentResourceBinding,
    AgentSkillBranch,
    GeneralSkill,
    KnowledgeBase,
    KnowledgeBucket,
    KnowledgeChunk,
    KnowledgeConcept,
    KnowledgeDocument,
    Skill,
    Tenant,
)
from app.knowledge.okf import upsert_concepts


def test_agent_skill_branch_is_copy_on_write_and_reports_branch_state() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(AgentProfile(id="agent_overall", tenant_id="tenant_demo", name="整体智能体", is_overall=True))
        agent = AgentProfile(id="agent_branch", tenant_id="tenant_demo", name="客服分支", is_overall=False)
        skill = Skill(
            tenant_id="tenant_demo",
            skill_id="skill_purchase",
            version="1.0.0",
            name="购买流程",
            business_domain="电商",
            description="购买商品",
            status="published",
            content_json=_graph("购买流程", "1.0.0"),
        )
        db.add(agent)
        db.add(skill)
        db.commit()

        copy_overall_scope_to_agent(db, "tenant_demo", agent)
        db.commit()

        visible = visible_skill_rows(db, "tenant_demo", agent.id)
        assert len(visible) == 1
        branch_read = _skill_branch_read(visible[0])
        assert branch_read["branch_sync_state"] == "synced"
        assert branch_read["branch_head_version"] == "1.0.0"

        update_branch_skill(db, "tenant_demo", agent.id, skill, _graph("分支购买流程", "1.0.0-branch.1"))
        db.commit()

        branch_visible = visible_skill_rows(db, "tenant_demo", agent.id)[0]
        global_skill = db.exec(select(Skill).where(Skill.skill_id == "skill_purchase")).first()
        assert branch_visible.name == "分支购买流程"
        assert global_skill is not None
        assert global_skill.name == "购买流程"
        assert _skill_branch_read(branch_visible)["branch_sync_state"] == "diverged"


def test_non_overall_agent_cannot_delete_global_resources() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(AgentProfile(id="agent_overall", tenant_id="tenant_demo", name="整体智能体", is_overall=True))
        db.add(AgentProfile(id="agent_branch", tenant_id="tenant_demo", name="客服分支", is_overall=False))
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            require_overall_agent(db, "tenant_demo", "agent_branch")

        assert exc_info.value.status_code == 403


def test_management_rows_keep_archived_global_and_inactive_branch_skills() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        db.add(AgentProfile(id="agent_overall", tenant_id="tenant_demo", name="整体智能体", is_overall=True))
        agent = AgentProfile(id="agent_branch", tenant_id="tenant_demo", name="客服分支", is_overall=False)
        global_archived = Skill(
            tenant_id="tenant_demo",
            skill_id="global_archived",
            version="1.0.0",
            name="主干下线技能",
            business_domain="电商",
            description="已下线但仍应管理可见",
            status="archived",
            content_json=_graph("主干下线技能", "1.0.0"),
        )
        branch_skill = Skill(
            tenant_id="tenant_demo",
            skill_id="branch_inactive",
            version="1.0.0",
            name="分支下线技能",
            business_domain="电商",
            description="分支下线但仍应管理可见",
            status="published",
            content_json=_graph("分支下线技能", "1.0.0"),
        )
        db.add(agent)
        db.add(global_archived)
        db.add(branch_skill)
        db.commit()

        copy_overall_scope_to_agent(db, "tenant_demo", agent)
        branch = db.exec(
            select(AgentSkillBranch).where(
                AgentSkillBranch.tenant_id == "tenant_demo",
                AgentSkillBranch.agent_id == agent.id,
                AgentSkillBranch.skill_id == branch_skill.skill_id,
            )
        ).one()
        branch.status = "inactive"
        db.add(branch)
        db.commit()

        overall_ids = {row.skill_id for row in visible_skill_rows(db, "tenant_demo")}
        branch_rows = visible_skill_rows(db, "tenant_demo", agent.id)
        branch_by_id = {row.skill_id: row for row in branch_rows}

        assert "global_archived" in overall_ids
        assert branch_by_id["branch_inactive"].status == "archived"


def test_disabled_open_gallery_resources_cannot_be_learned() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        overall = AgentProfile(id="agent_overall", tenant_id="tenant_demo", name="整体智能体", is_overall=True)
        target = AgentProfile(id="agent_branch", tenant_id="tenant_demo", name="客服分支", is_overall=False)
        db.add(overall)
        db.add(target)
        archived_skill = Skill(
            id="skill_archived",
            tenant_id="tenant_demo",
            skill_id="archived_sop",
            version="1.0.0",
            name="已停用 SOP",
            business_domain="电商",
            description="停用后不可学习",
            status="archived",
            content_json=_graph("已停用 SOP", "1.0.0"),
        )
        archived_general_skill = GeneralSkill(
            id="general_archived",
            tenant_id="tenant_demo",
            slug="archived-general-skill",
            name="已停用通用技能",
            skill_markdown="# 已停用通用技能",
            status="archived",
        )
        archived_knowledge_base = KnowledgeBase(
            id="kb_archived",
            tenant_id="tenant_demo",
            name="已停用业务资料",
            status="archived",
        )
        db.add(archived_skill)
        db.add(archived_general_skill)
        db.add(archived_knowledge_base)
        db.commit()

        for resource_type, resource_id in [
            ("skill", archived_skill.id),
            ("general_skill", archived_general_skill.id),
            ("knowledge_base", archived_knowledge_base.id),
        ]:
            result = import_agent_resources(
                target.id,
                AgentResourceImportRequest(
                    tenant_id="tenant_demo",
                    source_agent_id=overall.id,
                    resource_type=resource_type,  # type: ignore[arg-type]
                    resource_ids=[resource_id],
                ),
                db,
            )

            assert result["imported"] == []
            assert result["missing"] == [{"resource_id": resource_id, "reason": "disabled_in_open_gallery"}]
            assert db.exec(
                select(AgentResourceBinding).where(
                    AgentResourceBinding.tenant_id == "tenant_demo",
                    AgentResourceBinding.agent_id == target.id,
                    AgentResourceBinding.resource_type == resource_type,
                    AgentResourceBinding.resource_id == resource_id,
                )
            ).first() is None

        inherited = AgentProfile(id="agent_inherited", tenant_id="tenant_demo", name="继承分支", is_overall=False)
        db.add(inherited)
        db.flush()
        copy_overall_scope_to_agent(db, "tenant_demo", inherited)

        assert db.exec(select(AgentResourceBinding).where(AgentResourceBinding.agent_id == inherited.id)).all() == []


def test_knowledge_branch_write_clones_existing_wiki_before_appending_concept() -> None:
    with _test_session() as db:
        db.add(Tenant(id="tenant_demo", name="Demo"))
        agent = AgentProfile(id="agent_branch", tenant_id="tenant_demo", name="客服分支", is_overall=False)
        kb = KnowledgeBase(id="kb_demo", tenant_id="tenant_demo", name="业务资料")
        db.add(agent)
        db.add(kb)
        base_version = ensure_knowledge_base_version(db, kb, "1.0.0")
        document = KnowledgeDocument(
            id="doc_base",
            tenant_id="tenant_demo",
            knowledge_base_id=kb.id,
            knowledge_base_version_id=base_version.id,
            filename="policy.md",
            file_type="md",
            title="政策文档",
            status="ready",
            bucket_count=1,
            chunk_count=1,
        )
        bucket = KnowledgeBucket(
            id="bucket_base",
            tenant_id="tenant_demo",
            knowledge_base_id=kb.id,
            knowledge_base_version_id=base_version.id,
            document_id=document.id,
            bucket_key="policy",
            title="政策桶",
            summary="政策摘要",
        )
        chunk = KnowledgeChunk(
            id="chunk_base",
            tenant_id="tenant_demo",
            knowledge_base_id=kb.id,
            knowledge_base_version_id=base_version.id,
            document_id=document.id,
            bucket_id=bucket.id,
            chunk_index=0,
            content="用户取消订单前需要确认当前订单状态。",
        )
        concept = KnowledgeConcept(
            tenant_id="tenant_demo",
            knowledge_base_id=kb.id,
            knowledge_base_version_id=base_version.id,
            document_id=document.id,
            concept_id="playbooks/order-cancel",
            concept_type="Playbook",
            title="订单取消",
            description="订单取消流程",
            content_md='---\ntype: Playbook\ntitle: 订单取消\n---\n\n# Summary\n确认订单状态。',
        )
        db.add(document)
        db.add(bucket)
        db.add(chunk)
        db.add(concept)
        db.commit()

        target_version = knowledge_version_for_upload(db, "tenant_demo", kb.id, agent.id)
        upsert_concepts(
            db,
            "tenant_demo",
            kb.id,
            target_version.id,
            [
                {
                    "concept_id": "topics/new-topic",
                    "content_md": "---\ntype: Topic\ntitle: 新 Wiki 页面\n---\n\n# Summary\n补充新主题。",
                    "document_id": document.id,
                    "status": "active",
                }
            ],
        )

        concepts = db.exec(
            select(KnowledgeConcept).where(KnowledgeConcept.knowledge_base_version_id == target_version.id)
        ).all()
        assert {row.concept_id for row in concepts} == {"playbooks/order-cancel", "topics/new-topic"}
        cloned_documents = db.exec(
            select(KnowledgeDocument).where(KnowledgeDocument.knowledge_base_version_id == target_version.id)
        ).all()
        cloned_buckets = db.exec(
            select(KnowledgeBucket).where(KnowledgeBucket.knowledge_base_version_id == target_version.id)
        ).all()
        cloned_chunks = db.exec(
            select(KnowledgeChunk).where(KnowledgeChunk.knowledge_base_version_id == target_version.id)
        ).all()
        assert len(cloned_documents) == 1
        assert len(cloned_buckets) == 1
        assert len(cloned_chunks) == 1
        assert cloned_documents[0].id != document.id
        assert cloned_buckets[0].document_id == cloned_documents[0].id
        assert cloned_chunks[0].document_id == cloned_documents[0].id
        assert cloned_chunks[0].bucket_id == cloned_buckets[0].id


def _graph(name: str, version: str) -> dict[str, object]:
    return {
        "skill_id": "skill_purchase",
        "version": version,
        "name": name,
        "business_domain": "电商",
        "description": "购买商品",
        "nodes": [
            {
                "node_id": "collect",
                "type": "collect_info",
                "name": "收集信息",
                "instruction": "收集用户信息",
                "expected_user_info": ["user_name"],
                "allowed_actions": ["ask_user", "continue_flow"],
            },
            {
                "node_id": "reply",
                "type": "response",
                "name": "回复用户",
                "instruction": "回复用户",
                "allowed_actions": ["answer_user"],
            },
        ],
        "edges": [{"source_node_id": "collect", "next_node_id": "reply"}],
        "start_node_id": "collect",
        "terminal_node_ids": ["reply"],
    }


def _test_session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)
