from __future__ import annotations

from collections.abc import Mapping
from typing import Any


def slot_has_value(slots: Mapping[str, Any] | None, field: str) -> bool:
    """Single source of truth for "is this slot filled?".

    ``None``, ``""``, ``[]`` and ``{}`` all count as missing — an empty
    collection carries no user-provided information.
    """
    if not isinstance(slots, Mapping):
        return False
    value = slots.get(field)
    if value is None:
        return False
    return value not in ("", [], {})


ROUTER_GENERATED_MESSAGE_SLOT_KEYS = {
    "message_content",
    "user_message",
    "rewritten_message",
    "normalized_message",
    "current_message",
    "source_message",
}


def strip_router_generated_message_slots(slots: Mapping[str, Any] | None) -> dict[str, Any]:
    """Router must not persist rewritten user text as skill slot values."""
    if not isinstance(slots, Mapping):
        return {}
    return {
        str(key): value
        for key, value in slots.items()
        if str(key).strip() not in ROUTER_GENERATED_MESSAGE_SLOT_KEYS
    }
