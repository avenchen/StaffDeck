from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.api.agents import (
    AgentVisibilityUpdateRequest,
    get_agent_visibility_endpoint,
    list_agents,
    update_agent_visibility_endpoint,
)
from app.api.auth import UserCreateRequest, create_user
from app.api.departments import (
    DepartmentCreateRequest,
    DepartmentUpdateRequest,
    create_department,
    delete_department,
    list_departments_endpoint,
    update_department,
)
from app.db.models import AgentProfile, Tenant, User
from app.departments.service import ensure_root_department
from app.security.auth import hash_password


def _engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


def _admin(db):
    user = User(id="admin", tenant_id="t", username="admin", role="admin", password_hash=hash_password("x"))
    db.add(user)
    return user


def _seed(db):
    db.add(Tenant(id="t", name="Demo"))
    admin = _admin(db)
    db.commit()
    return admin


def test_department_crud_and_guards():
    with Session(_engine()) as db:
        admin = _seed(db)
        root = ensure_root_department(db, "t")
        db.commit()

        eng = create_department(DepartmentCreateRequest(tenant_id="t", name="研發"), admin, db)
        fe = create_department(
            DepartmentCreateRequest(tenant_id="t", name="前端", parent_id=eng.id), admin, db
        )
        assert eng.parent_id == root.id
        assert fe.parent_id == eng.id

        rows = list_departments_endpoint("t", admin, db)
        assert {r.name for r in rows} == {"全組織", "研發", "前端"}
        assert next(r for r in rows if r.is_root).name == "全組織"

        # cannot move a department under its own subtree
        with pytest.raises(HTTPException) as exc:
            update_department(eng.id, DepartmentUpdateRequest(tenant_id="t", parent_id=fe.id), admin, db)
        assert exc.value.status_code == 400

        # cannot delete a department that still has children
        with pytest.raises(HTTPException):
            delete_department(eng.id, "t", admin, db)

        # cannot delete root
        with pytest.raises(HTTPException):
            delete_department(root.id, "t", admin, db)

        # leaf delete works
        assert delete_department(fe.id, "t", admin, db) == {"ok": True}


def test_create_user_defaults_to_root_and_accepts_department():
    with Session(_engine()) as db:
        admin = _seed(db)
        root = ensure_root_department(db, "t")
        eng = create_department(DepartmentCreateRequest(tenant_id="t", name="研發"), admin, db)

        default_user = create_user(
            UserCreateRequest(tenant_id="t", username="u1", password="x"), admin, db
        )
        assert default_user.department_id == root.id

        eng_user = create_user(
            UserCreateRequest(tenant_id="t", username="u2", password="x", department_id=eng.id),
            admin,
            db,
        )
        assert eng_user.department_id == eng.id

        with pytest.raises(HTTPException):
            create_user(
                UserCreateRequest(tenant_id="t", username="u3", password="x", department_id="nope"),
                admin,
                db,
            )


def test_agent_visibility_endpoint_and_list_filtering():
    with Session(_engine()) as db:
        admin = _seed(db)
        root = ensure_root_department(db, "t")
        sales = create_department(DepartmentCreateRequest(tenant_id="t", name="業務"), admin, db)
        sales_user = create_user(
            UserCreateRequest(tenant_id="t", username="sales", password="x", department_id=sales.id),
            admin,
            db,
        )
        other_user = create_user(
            UserCreateRequest(tenant_id="t", username="other", password="x"), admin, db
        )
        agent = AgentProfile(
            id="agent_dept", tenant_id="t", name="業務助手",
            metadata_json={"owner_user_id": admin.id},
        )
        db.add(agent)
        db.commit()

        # grant to the 業務 department (subtree-inclusive)
        vis = update_agent_visibility_endpoint(
            "agent_dept",
            AgentVisibilityUpdateRequest(tenant_id="t", department_ids=[sales.id]),
            db,
            admin,
        )
        assert vis.department_ids == [sales.id]
        assert get_agent_visibility_endpoint("agent_dept", "t", db, admin).department_ids == [sales.id]

        sales_row = db.get(User, sales_user.id)
        other_row = db.get(User, other_user.id)
        sales_view = [a for a in list_agents("t", db, sales_row) if a.id == "agent_dept"]
        assert sales_view, "department-visible agent should appear for the granted user"
        # server stamps the per-user visibility flag so pickers are accurate for
        # subtree/user-grant modes the client cannot compute on its own
        assert sales_view[0].metadata.get("visible_to_current_user") is True
        assert not any(a.id == "agent_dept" for a in list_agents("t", db, other_row))

        # invalid user id in visibility list is rejected
        with pytest.raises(HTTPException):
            update_agent_visibility_endpoint(
                "agent_dept",
                AgentVisibilityUpdateRequest(tenant_id="t", user_ids=["ghost"]),
                db,
                admin,
            )
