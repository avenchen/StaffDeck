from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.db import get_session
from app.db.models import MockOrder, utc_now

router = APIRouter(prefix="/api/mock", tags=["mock"])

PRODUCT_CATALOG = {
    "SKU-001": Decimal("99.00"),
    "SKU-002": Decimal("199.00"),
    "SKU-003": Decimal("299.00"),
}

PRIMARY_ORDER_CENTER = {
    "ORDER-1001": {"status": "signed", "signed_days": 3, "refundable": True},
    "ORDER-1002": {"status": "signed", "signed_days": 16, "refundable": False},
}

ARCHIVE_ORDER_CENTER = {
    "ARCHIVE-1001": {
        "status": "signed",
        "signed_days": 4,
        "refundable": True,
        "archive_reason": "订单已归档到历史订单中心",
        "recommendation": "该历史订单签收 4 天，当前可继续发起售后退款审核。",
    }
}


class MockOrderQueryRequest(BaseModel):
    order_id: str


class MockProductPurchaseRequest(BaseModel):
    user_id: str = "user_demo"
    product_id: str
    sku_id: str | None = None
    quantity: int = Field(default=1, ge=1, le=99)
    payment_method: str = "mock_balance"


class MockOrderAddRequest(BaseModel):
    user_id: str = "user_demo"
    order_id: str | None = None
    product_id: str
    sku_id: str | None = None
    quantity: int = Field(default=1, ge=1, le=99)
    status: str = "created"


@router.post("/order/query")
def mock_order_query(
    request: MockOrderQueryRequest, db: Session = Depends(get_session)
) -> dict[str, Any]:
    order_id = _normalize_id(request.order_id)
    dynamic_record = _find_dynamic_order(db, order_id)
    if dynamic_record:
        return _order_hit(order_id, "primary_order_center", dynamic_record)
    record = PRIMARY_ORDER_CENTER.get(order_id)
    if not record:
        return _order_miss(order_id, "primary_order_center")
    return _order_hit(order_id, "primary_order_center", record)


@router.post("/order/archive-query")
def mock_order_archive_query(request: MockOrderQueryRequest) -> dict[str, Any]:
    order_id = _normalize_id(request.order_id)
    record = ARCHIVE_ORDER_CENTER.get(order_id)
    if not record:
        return _order_miss(order_id, "archive_order_center")
    return _order_hit(order_id, "archive_order_center", record)


@router.post("/product/purchase")
def mock_product_purchase(
    request: MockProductPurchaseRequest, db: Session = Depends(get_session)
) -> dict[str, Any]:
    unit_price = _mock_price(request.product_id)
    total_amount = unit_price * Decimal(request.quantity)
    order_id = f"MOCK{uuid4().hex[:10].upper()}"
    result = {
        "order_id": order_id,
        "purchase_id": f"PUR{uuid4().hex[:10].upper()}",
        "user_id": request.user_id,
        "product_id": request.product_id,
        "sku_id": request.sku_id,
        "quantity": request.quantity,
        "unit_price": float(unit_price),
        "total_amount": float(total_amount),
        "currency": "CNY",
        "payment_method": request.payment_method,
        "payment_status": "paid",
        "order_status": "paid",
        "created_at": _now_iso(),
    }
    _upsert_dynamic_order(
        db,
        order_id=order_id,
        user_id=request.user_id,
        product_id=request.product_id,
        sku_id=request.sku_id,
        quantity=request.quantity,
        status="paid",
        payment_status="paid",
        order_status="paid",
        total_amount=float(total_amount),
        currency="CNY",
        metadata={"purchase_id": result["purchase_id"], "payment_method": request.payment_method},
    )
    return result


@router.post("/order/add")
def mock_order_add(
    request: MockOrderAddRequest, db: Session = Depends(get_session)
) -> dict[str, Any]:
    unit_price = _mock_price(request.product_id)
    total_amount = unit_price * Decimal(request.quantity)
    order_id = _normalize_id(request.order_id) if request.order_id else f"ADD{uuid4().hex[:10].upper()}"
    result = {
        "order_id": order_id,
        "user_id": request.user_id,
        "product_id": request.product_id,
        "sku_id": request.sku_id,
        "quantity": request.quantity,
        "unit_price": float(unit_price),
        "total_amount": float(total_amount),
        "currency": "CNY",
        "status": request.status,
        "created_at": _now_iso(),
    }
    _upsert_dynamic_order(
        db,
        order_id=order_id,
        user_id=request.user_id,
        product_id=request.product_id,
        sku_id=request.sku_id,
        quantity=request.quantity,
        status=request.status,
        payment_status=None,
        order_status=request.status,
        total_amount=float(total_amount),
        currency="CNY",
        metadata={},
    )
    return result


def _mock_price(product_id: str) -> Decimal:
    return PRODUCT_CATALOG.get(_normalize_id(product_id), Decimal("129.00"))


def _normalize_id(value: str) -> str:
    return value.strip().upper()


def _order_hit(order_id: str, source: str, record: dict[str, Any]) -> dict[str, Any]:
    return {
        "order_id": order_id,
        "found": True,
        "source": source,
        **record,
    }


def _order_miss(order_id: str, source: str) -> dict[str, Any]:
    return {
        "order_id": order_id,
        "found": False,
        "source": source,
        "results": [],
        "miss_reason": "source_miss",
        "hint": "当前订单中心未命中，可尝试其他已配置的订单查询工具。",
    }


def _find_dynamic_order(db: object, order_id: str) -> dict[str, Any] | None:
    if not isinstance(db, Session):
        return None
    row = db.get(MockOrder, order_id)
    if not row:
        return None
    return {
        "status": row.status,
        "signed_days": row.signed_days,
        "refundable": row.refundable,
        "user_id": row.user_id,
        "product_id": row.product_id,
        "sku_id": row.sku_id,
        "quantity": row.quantity,
        "payment_status": row.payment_status,
        "order_status": row.order_status,
        "total_amount": row.total_amount,
        "currency": row.currency,
        "created_at": row.created_at.isoformat(),
        "recommendation": "该订单已在 mock 订单中心创建，可继续进行订单查询、取消或售后流程。",
        **(row.metadata_json or {}),
    }


def _upsert_dynamic_order(
    db: object,
    *,
    order_id: str,
    user_id: str,
    product_id: str,
    sku_id: str | None,
    quantity: int,
    status: str,
    payment_status: str | None,
    order_status: str | None,
    total_amount: float,
    currency: str,
    metadata: dict[str, Any],
) -> None:
    if not isinstance(db, Session):
        return
    normalized_order_id = _normalize_id(order_id)
    row = db.get(MockOrder, normalized_order_id)
    now = utc_now()
    if not row:
        row = MockOrder(order_id=normalized_order_id, created_at=now)
    row.user_id = user_id
    row.product_id = product_id
    row.sku_id = sku_id
    row.quantity = quantity
    row.status = status
    row.payment_status = payment_status
    row.order_status = order_status
    row.signed_days = 0
    row.refundable = True
    row.total_amount = total_amount
    row.currency = currency
    row.metadata_json = metadata
    row.updated_at = now
    db.add(row)
    db.commit()


def _now_iso() -> str:
    return datetime.now(UTC).replace(tzinfo=None).isoformat()
