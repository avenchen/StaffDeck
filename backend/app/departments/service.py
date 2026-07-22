"""Department tree + digital-employee visibility.

Leaf domain module (imports only DB models) so it can be reused by the agents
controller, the chat gallery, and permission gates without an import cycle.

Visibility model (composable / additive union) — a user can see an agent if ANY
holds:
  * the user is a tenant admin
  * the user owns the agent (metadata.owner_user_id)
  * agent.visibility_all               (open to everyone in the tenant)
  * agent.visibility_same_department   (user's department == agent's department, exact)
  * a granted department covers the user (subtree-inclusive: the grant is the
    user's department or any ancestor of it)
  * the user is in the agent's granted-users list

Legacy metadata.published_to_gallery is still honoured as visibility_all so data
predating the migration keeps working.
"""

from __future__ import annotations

from collections import defaultdict

from sqlmodel import Session, select

from app.db.models import (
    AgentProfile,
    AgentVisibilityDepartment,
    AgentVisibilityUser,
    Department,
    User,
)

ROOT_DEPARTMENT_NAME = "全組織"

ADMIN_ROLE = "admin"


def _is_admin(user: User) -> bool:
    return user.role == ADMIN_ROLE


def _is_owner(agent: AgentProfile, user: User) -> bool:
    return (agent.metadata_json or {}).get("owner_user_id") == user.id


def _agent_open_to_all(agent: AgentProfile) -> bool:
    if agent.visibility_all:
        return True
    return (agent.metadata_json or {}).get("published_to_gallery") is True


# --- Department tree -------------------------------------------------------

def ensure_root_department(db: Session, tenant_id: str) -> Department:
    """Return the tenant's root department (the whole-org node), creating it once."""
    root = db.exec(
        select(Department).where(
            Department.tenant_id == tenant_id,
            Department.parent_id.is_(None),
        )
    ).first()
    if root is None:
        root = Department(tenant_id=tenant_id, name=ROOT_DEPARTMENT_NAME, parent_id=None)
        db.add(root)
        db.flush()
    return root


def list_departments(db: Session, tenant_id: str) -> list[Department]:
    return db.exec(
        select(Department).where(Department.tenant_id == tenant_id).order_by(Department.name)
    ).all()


def _parent_map(db: Session, tenant_id: str) -> dict[str, str | None]:
    return {
        row.id: row.parent_id
        for row in db.exec(select(Department).where(Department.tenant_id == tenant_id)).all()
    }


def covering_department_ids(db: Session, tenant_id: str, department_id: str | None) -> set[str]:
    """Departments that "cover" the given department: itself and all ancestors.

    A subtree-inclusive department grant D is visible to a user iff D is in this
    set (i.e. D is the user's department or an ancestor of it).
    """
    if not department_id:
        return set()
    parents = _parent_map(db, tenant_id)
    cover: set[str] = set()
    current: str | None = department_id
    while current and current not in cover:
        cover.add(current)
        current = parents.get(current)
    return cover


def descendant_department_ids(db: Session, tenant_id: str, department_id: str) -> set[str]:
    """The department and all of its descendants (subtree)."""
    children: dict[str | None, list[str]] = defaultdict(list)
    for row in db.exec(select(Department).where(Department.tenant_id == tenant_id)).all():
        children[row.parent_id].append(row.id)
    result: set[str] = set()
    stack = [department_id]
    while stack:
        current = stack.pop()
        if current in result:
            continue
        result.add(current)
        stack.extend(children.get(current, []))
    return result


# --- Agent visibility ------------------------------------------------------

class AgentVisibilityResolver:
    """Preloads a user's covering departments and the tenant's visibility grants
    so ``visible(agent)`` is O(1). Build once per request for list endpoints."""

    def __init__(self, db: Session, tenant_id: str, user: User) -> None:
        self.user = user
        self.is_admin = _is_admin(user)
        self._cover = covering_department_ids(db, tenant_id, user.department_id)
        dept_grants: dict[str, set[str]] = defaultdict(set)
        for row in db.exec(
            select(AgentVisibilityDepartment).where(
                AgentVisibilityDepartment.tenant_id == tenant_id
            )
        ).all():
            dept_grants[row.agent_id].add(row.department_id)
        self._dept_grants = dept_grants
        self._user_granted_agent_ids = {
            row.agent_id
            for row in db.exec(
                select(AgentVisibilityUser).where(
                    AgentVisibilityUser.tenant_id == tenant_id,
                    AgentVisibilityUser.user_id == user.id,
                )
            ).all()
        }

    def visible(self, agent: AgentProfile) -> bool:
        if self.is_admin:
            return True
        if _is_owner(agent, self.user):
            return True
        if _agent_open_to_all(agent):
            return True
        if (
            agent.visibility_same_department
            and agent.department_id
            and agent.department_id == self.user.department_id
        ):
            return True
        if self._dept_grants.get(agent.id) and (self._dept_grants[agent.id] & self._cover):
            return True
        if agent.id in self._user_granted_agent_ids:
            return True
        return False


def agent_visible_to_user(db: Session, agent: AgentProfile, user: User) -> bool:
    """Single-agent convenience wrapper around AgentVisibilityResolver."""
    return AgentVisibilityResolver(db, agent.tenant_id, user).visible(agent)


# --- Agent visibility mutation ---------------------------------------------

def get_agent_visibility(db: Session, agent: AgentProfile) -> dict:
    department_ids = [
        row.department_id
        for row in db.exec(
            select(AgentVisibilityDepartment).where(
                AgentVisibilityDepartment.agent_id == agent.id
            )
        ).all()
    ]
    user_ids = [
        row.user_id
        for row in db.exec(
            select(AgentVisibilityUser).where(AgentVisibilityUser.agent_id == agent.id)
        ).all()
    ]
    return {
        "all": bool(agent.visibility_all),
        "same_department": bool(agent.visibility_same_department),
        "department_ids": department_ids,
        "user_ids": user_ids,
    }


def set_agent_visibility(
    db: Session,
    agent: AgentProfile,
    *,
    all: bool | None = None,
    same_department: bool | None = None,
    department_ids: list[str] | None = None,
    user_ids: list[str] | None = None,
) -> None:
    """Replace the agent's visibility grants. Only provided fields are changed;
    department_ids / user_ids fully replace the corresponding grant set."""
    if all is not None:
        agent.visibility_all = all
    if same_department is not None:
        agent.visibility_same_department = same_department
    db.add(agent)

    if department_ids is not None:
        for row in db.exec(
            select(AgentVisibilityDepartment).where(
                AgentVisibilityDepartment.agent_id == agent.id
            )
        ).all():
            db.delete(row)
        for dept_id in dict.fromkeys(department_ids):
            db.add(
                AgentVisibilityDepartment(
                    tenant_id=agent.tenant_id, agent_id=agent.id, department_id=dept_id
                )
            )

    if user_ids is not None:
        for row in db.exec(
            select(AgentVisibilityUser).where(AgentVisibilityUser.agent_id == agent.id)
        ).all():
            db.delete(row)
        for user_id in dict.fromkeys(user_ids):
            db.add(
                AgentVisibilityUser(
                    tenant_id=agent.tenant_id, agent_id=agent.id, user_id=user_id
                )
            )
