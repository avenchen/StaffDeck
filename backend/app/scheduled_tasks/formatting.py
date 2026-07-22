"""Pure presentation helpers for scheduled-task drafts.

Extracted from the chat controller (app.api.chat) so the fat controller keeps
only request wiring. These functions are side-effect free: they turn a draft /
schedule payload into human-readable reply text and trace lines, with no DB,
LLM or engine dependency.
"""

from __future__ import annotations

from typing import Callable

from app.scheduled_tasks.schema import ScheduledTaskDraftRead
from app.scheduled_tasks.service import DEFAULT_TASK_TIME

SCHEDULE_WEEKDAY_LABELS = ("週一", "週二", "週三", "週四", "週五", "週六", "週日")


def scheduled_task_draft_reply(draft: ScheduledTaskDraftRead) -> str:
    lines = [
        "我已按你選擇的定時項目整理成自動任務草案。",
        f"任務：{draft.title}",
        f"計劃：{format_draft_schedule(draft)}",
        f"執行內容：{draft.prompt}",
        "確認下方卡片後才會啟用；確認前不會創建自動任務。",
    ]
    return "\n".join(lines)


def format_draft_schedule(draft: ScheduledTaskDraftRead) -> str:
    return format_scheduled_task_schedule(draft.schedule_type, draft.schedule or {})


def _format_once_schedule(schedule: dict) -> str:
    return f"一次性 {schedule.get('run_at') or '待確認時間'}"


def _format_weekly_schedule(schedule: dict) -> str:
    return f"每週 {_format_weekday_labels(schedule.get('weekdays'))} {schedule.get('time') or DEFAULT_TASK_TIME}"


def _format_monthly_schedule(schedule: dict) -> str:
    return f"每月 {schedule.get('day_of_month') or 1} 號 {schedule.get('time') or DEFAULT_TASK_TIME}"


def _format_daily_schedule(schedule: dict) -> str:
    return f"每天 {schedule.get('time') or DEFAULT_TASK_TIME}"


SCHEDULE_TEXT_FORMATTERS: dict[str, Callable[[dict], str]] = {
    "once": _format_once_schedule,
    "weekly": _format_weekly_schedule,
    "monthly": _format_monthly_schedule,
    "daily": _format_daily_schedule,
}


def format_scheduled_task_schedule(schedule_type: object, schedule_value: object) -> str:
    schedule = schedule_value if isinstance(schedule_value, dict) else {}
    schedule_type_text = str(schedule_type or "daily")
    formatter = SCHEDULE_TEXT_FORMATTERS.get(schedule_type_text, _format_daily_schedule)
    return formatter(schedule)


def _format_weekday_labels(value: object) -> str:
    if not isinstance(value, list):
        return SCHEDULE_WEEKDAY_LABELS[0]
    labels: list[str] = []
    for item in value:
        text = str(item).strip()
        if not text.isdigit():
            continue
        day = int(text)
        if 0 <= day < len(SCHEDULE_WEEKDAY_LABELS):
            labels.append(SCHEDULE_WEEKDAY_LABELS[day])
    return "、".join(labels) or SCHEDULE_WEEKDAY_LABELS[0]


def scheduled_task_trace_detail(payload: dict) -> str | None:
    title = str(payload.get("title") or "").strip()
    schedule = format_scheduled_task_schedule(payload.get("schedule_type"), payload.get("schedule"))
    detail = " · ".join(part for part in (title, schedule, "等待確認後啟用") if part)
    return detail or None


def scheduled_task_trace_lines(payload: dict, *, state: str = "completed") -> list[dict]:
    schedule = format_scheduled_task_schedule(payload.get("schedule_type"), payload.get("schedule"))
    return [
        {
            "id": "scheduled_task_intent",
            "kind": "decision",
            "text": "識別定時任務需求",
            "detail": "用戶選擇了創建定時任務模式",
            "state": "completed",
        },
        {
            "id": "scheduled_task_parse",
            "kind": "decision",
            "text": "解析執行計劃",
            "detail": f"計劃：{schedule}" if schedule else None,
            "state": "completed",
        },
        {
            "id": "scheduled_task_draft",
            "kind": "decision",
            "text": "生成定時任務草案",
            "detail": scheduled_task_trace_detail(payload),
            "state": state,
        },
    ]
