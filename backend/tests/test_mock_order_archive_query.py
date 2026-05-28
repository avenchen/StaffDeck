from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.api.mock import (
    MockOrderAddRequest,
    MockOrderQueryRequest,
    MockProductPurchaseRequest,
    mock_order_add,
    mock_order_archive_query,
    mock_order_query,
    mock_product_purchase,
)


def test_primary_order_query_returns_configured_order() -> None:
    result = mock_order_query(MockOrderQueryRequest(order_id="ORDER-1001"))

    assert result["found"] is True
    assert result["source"] == "primary_order_center"
    assert result["refundable"] is True


def test_primary_order_query_returns_miss_for_unknown_primary_order() -> None:
    result = mock_order_query(MockOrderQueryRequest(order_id="ARCHIVE-1001"))

    assert result["found"] is False
    assert result["miss_reason"] == "source_miss"


def test_archive_order_query_returns_refundable_history_order() -> None:
    result = mock_order_archive_query(MockOrderQueryRequest(order_id="ARCHIVE-1001"))

    assert result["found"] is True
    assert result["source"] == "archive_order_center"
    assert result["refundable"] is True


def test_product_purchase_persists_queryable_order() -> None:
    with _test_session() as db:
        purchase = mock_product_purchase(
            MockProductPurchaseRequest(user_id="user_demo", product_id="A1", quantity=2),
            db,
        )

        result = mock_order_query(MockOrderQueryRequest(order_id=purchase["order_id"]), db)

    assert result["found"] is True
    assert result["source"] == "primary_order_center"
    assert result["order_id"] == purchase["order_id"]
    assert result["product_id"] == "A1"
    assert result["quantity"] == 2
    assert result["payment_status"] == "paid"
    assert result["refundable"] is True


def test_order_add_persists_queryable_order() -> None:
    with _test_session() as db:
        added = mock_order_add(
            MockOrderAddRequest(user_id="user_demo", product_id="A3", quantity=1, status="created"),
            db,
        )

        result = mock_order_query(MockOrderQueryRequest(order_id=added["order_id"]), db)

    assert result["found"] is True
    assert result["order_id"] == added["order_id"]
    assert result["product_id"] == "A3"
    assert result["status"] == "created"


def _test_session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)
