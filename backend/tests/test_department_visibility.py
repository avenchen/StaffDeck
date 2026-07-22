from __future__ import annotations

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.db.models import AgentProfile, Department, Tenant, User
from app.departments.service import (
    AgentVisibilityResolver,
    covering_department_ids,
    descendant_department_ids,
    ensure_root_department,
    set_agent_visibility,
)


def _engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


def _seed_tree(db: Session):
    db.add(Tenant(id="t", name="Demo"))
    root = ensure_root_department(db, "t")            # 全組織
    eng = Department(tenant_id="t", name="研發", parent_id=root.id)
    fe = Department(tenant_id="t", name="前端", parent_id=None)
    sales = Department(tenant_id="t", name="業務", parent_id=root.id)
    db.add(eng); db.add(sales); db.flush()
    fe.parent_id = eng.id
    db.add(fe); db.flush()
    return root, eng, fe, sales


def test_covering_and_descendant_ids():
    engine = _engine()
    with Session(engine) as db:
        root, eng, fe, sales = _seed_tree(db)
        # 前端 is covered by 前端, 研發, 全組織 (ancestors-or-self)
        assert covering_department_ids(db, "t", fe.id) == {fe.id, eng.id, root.id}
        # 研發 subtree includes 前端
        assert descendant_department_ids(db, "t", eng.id) == {eng.id, fe.id}
        assert sales.id not in descendant_department_ids(db, "t", eng.id)


def _user(db, uid, dept_id, role="member"):
    u = User(id=uid, tenant_id="t", username=uid, role=role, password_hash="x", department_id=dept_id)
    db.add(u)
    return u


def _agent(db, aid, **kw):
    a = AgentProfile(id=aid, tenant_id="t", name=aid, **kw)
    db.add(a)
    db.flush()
    return a


def test_visibility_rules():
    engine = _engine()
    with Session(engine) as db:
        root, eng, fe, sales = _seed_tree(db)
        admin = _user(db, "admin", root.id, role="admin")
        fe_user = _user(db, "fe_user", fe.id)
        sales_user = _user(db, "sales_user", sales.id)
        owner = _user(db, "owner", sales.id)
        db.flush()

        # same_department (exact): agent in 研發 -> only users whose dept == 研發
        same = _agent(db, "same", department_id=eng.id, visibility_same_department=True,
                      metadata_json={"owner_user_id": owner.id})
        # department grant on 研發 (subtree) -> 前端 user covered
        dept = _agent(db, "dept", metadata_json={"owner_user_id": owner.id})
        set_agent_visibility(db, dept, department_ids=[eng.id])
        # user grant -> only sales_user
        usr = _agent(db, "usr", metadata_json={"owner_user_id": owner.id})
        set_agent_visibility(db, usr, user_ids=[sales_user.id])
        # open to all
        alla = _agent(db, "alla", visibility_all=True, metadata_json={"owner_user_id": owner.id})
        db.commit()

        def visible(user):
            r = AgentVisibilityResolver(db, "t", user)
            return {a.id for a in (same, dept, usr, alla) if r.visible(a)}

        # admin sees everything
        assert visible(admin) == {"same", "dept", "usr", "alla"}
        # 前端 user: not same(研發 exact), yes dept(研發 subtree), no usr, yes all
        assert visible(fe_user) == {"dept", "alla"}
        # 業務 user: no same, no dept, yes usr(granted), yes all
        assert visible(sales_user) == {"usr", "alla"}
        # owner sees own agents regardless of grants
        assert visible(owner) == {"same", "dept", "usr", "alla"}


def test_same_department_exact_match():
    engine = _engine()
    with Session(engine) as db:
        root, eng, fe, sales = _seed_tree(db)
        eng_user = _user(db, "eng_user", eng.id)
        fe_user = _user(db, "fe_user", fe.id)
        db.flush()
        agent = _agent(db, "a", department_id=eng.id, visibility_same_department=True)
        db.commit()
        # exact: 研發 user sees it, 前端 (sub-team) does NOT via same_department
        assert AgentVisibilityResolver(db, "t", eng_user).visible(agent) is True
        assert AgentVisibilityResolver(db, "t", fe_user).visible(agent) is False
