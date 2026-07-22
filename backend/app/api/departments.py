from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import get_session
from app.db.models import Department, User
from app.departments.service import (
    descendant_department_ids,
    ensure_root_department,
    list_departments,
)
from app.security.auth import ensure_current_user_tenant, get_current_user
from app.security.permissions import ensure_tenant_admin
from app.security.tenant import ensure_tenant

router = APIRouter(prefix="/api/enterprise/departments", tags=["enterprise:departments"])


class DepartmentCreateRequest(BaseModel):
    tenant_id: str
    name: str
    parent_id: Optional[str] = None


class DepartmentUpdateRequest(BaseModel):
    tenant_id: str
    name: Optional[str] = None
    parent_id: Optional[str] = None


class DepartmentRead(BaseModel):
    id: str
    tenant_id: str
    name: str
    parent_id: Optional[str] = None
    is_root: bool = False


def _read(row: Department) -> DepartmentRead:
    return DepartmentRead(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        parent_id=row.parent_id,
        is_root=row.parent_id is None,
    )


def _get_in_tenant(db: Session, tenant_id: str, department_id: str) -> Department:
    row = db.get(Department, department_id)
    if not row or row.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Department not found")
    return row


@router.get("", response_model=list[DepartmentRead])
def list_departments_endpoint(
    tenant_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> list[DepartmentRead]:
    ensure_current_user_tenant(tenant_id, current_user)
    ensure_tenant(db, tenant_id)
    ensure_root_department(db, tenant_id)
    db.commit()
    return [_read(row) for row in list_departments(db, tenant_id)]


@router.post("", response_model=DepartmentRead)
def create_department(
    request: DepartmentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> DepartmentRead:
    ensure_tenant_admin(request.tenant_id, current_user)
    ensure_tenant(db, request.tenant_id)
    name = (request.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Department name cannot be empty")
    parent_id = request.parent_id or ensure_root_department(db, request.tenant_id).id
    _get_in_tenant(db, request.tenant_id, parent_id)  # validate parent
    existing = db.exec(
        select(Department).where(
            Department.tenant_id == request.tenant_id,
            Department.parent_id == parent_id,
            Department.name == name,
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Department name already exists under this parent")
    row = Department(tenant_id=request.tenant_id, name=name, parent_id=parent_id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _read(row)


@router.put("/{department_id}", response_model=DepartmentRead)
def update_department(
    department_id: str,
    request: DepartmentUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> DepartmentRead:
    ensure_tenant_admin(request.tenant_id, current_user)
    row = _get_in_tenant(db, request.tenant_id, department_id)
    if request.name is not None:
        name = request.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Department name cannot be empty")
        row.name = name
    if request.parent_id is not None:
        if row.parent_id is None:
            raise HTTPException(status_code=400, detail="Cannot move the root department")
        if request.parent_id == row.id:
            raise HTTPException(status_code=400, detail="A department cannot be its own parent")
        # Prevent cycles: the new parent must not be within this department's subtree.
        if request.parent_id in descendant_department_ids(db, request.tenant_id, row.id):
            raise HTTPException(status_code=400, detail="Cannot move a department under its own subtree")
        _get_in_tenant(db, request.tenant_id, request.parent_id)
        row.parent_id = request.parent_id
    db.add(row)
    db.commit()
    db.refresh(row)
    return _read(row)


@router.delete("/{department_id}")
def delete_department(
    department_id: str,
    tenant_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> dict[str, bool]:
    ensure_tenant_admin(tenant_id, current_user)
    row = _get_in_tenant(db, tenant_id, department_id)
    if row.parent_id is None:
        raise HTTPException(status_code=400, detail="Cannot delete the root department")
    child = db.exec(
        select(Department).where(
            Department.tenant_id == tenant_id, Department.parent_id == department_id
        )
    ).first()
    if child:
        raise HTTPException(status_code=400, detail="Move or remove sub-departments first")
    member = db.exec(
        select(User).where(User.tenant_id == tenant_id, User.department_id == department_id)
    ).first()
    if member:
        raise HTTPException(status_code=400, detail="Reassign members before deleting this department")
    db.delete(row)
    db.commit()
    return {"ok": True}
