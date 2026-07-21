from __future__ import annotations

import time
from collections import Counter
from typing import Any

from sqlmodel import Session, select

from app.db.models import AgentEvent, ChatSession, Message, MessageFeedback, ModelConfig, User, utc_now
from app.llm import LLMClient, LLMError
from app.observability.spans import llm_operation


FEEDBACK_BUCKET_LABELS: dict[str, str] = {
    "model_issue": "模型問題",
    "skill_issue": "技能問題",
    "tool_or_system_issue": "工具/系統問題",
    "user_random_or_unclear": "用戶隨意或上下文不足",
    "positive_or_resolved": "正向反饋",
    "needs_model_analysis": "待模型分析",
    "unknown": "未知",
}

ALLOWED_BUCKETS = set(FEEDBACK_BUCKET_LABELS)
FEEDBACK_ANALYSIS_MAX_ATTEMPTS = 3
FEEDBACK_ANALYSIS_RETRY_DELAY_SECONDS = 0.6

FEEDBACK_ANALYSIS_PROMPT = """
你是客服 Agent 質量分析器。請根據用戶反饋、消息上下文和執行軌跡，判斷反饋原因。

你只輸出 JSON，字段：
{
  "bucket": "model_issue | skill_issue | tool_or_system_issue | user_random_or_unclear | positive_or_resolved | unknown",
  "confidence": 0.0,
  "reason": "一句話原因，不超過 80 字",
  "summary": "給運營看的簡短總結，不超過 120 字",
  "evidence": ["最多 3 條依據"],
  "suggested_action": "建議動作，不超過 80 字"
}

分類標準：
- model_issue：模型理解、推理、回覆組織、語氣或事實引用有問題。
- skill_issue：技能定義、步驟、槽位、確認規則或工具編排設計導致問題。
- tool_or_system_issue：工具未配置、調用失敗、系統異常、返回值不足或錯誤。
- user_random_or_unclear：用戶點踩缺少可解釋問題，或上下文不足以判斷。
- positive_or_resolved：點贊或正向確認。
- unknown：仍無法判斷。

不要把執行軌跡逐字複述為原因；要判斷根因。
""".strip()


class FeedbackAnalysisService:
    def __init__(self, db: Session):
        self.db = db

    def analyze_feedback(self, feedback_id: str) -> MessageFeedback | None:
        feedback = self.db.get(MessageFeedback, feedback_id)
        if not feedback:
            return None
        model_config = self._default_model_config(feedback.tenant_id)
        if not model_config:
            return self._mark_needs_model(feedback)

        payload = self._analysis_payload(feedback)
        last_error: LLMError | None = None
        for attempt in range(1, FEEDBACK_ANALYSIS_MAX_ATTEMPTS + 1):
            try:
                with llm_operation("feedback.analyze", attempt=attempt):
                    raw = LLMClient(model_config).generate_json(FEEDBACK_ANALYSIS_PROMPT, payload)
                analysis = _normalize_analysis(raw, feedback.rating)
                self._apply_analysis(feedback, analysis, "analyzed")
                self.db.add(feedback)
                self.db.commit()
                self.db.refresh(feedback)
                return feedback
            except LLMError as exc:
                last_error = exc
                if attempt < FEEDBACK_ANALYSIS_MAX_ATTEMPTS:
                    time.sleep(FEEDBACK_ANALYSIS_RETRY_DELAY_SECONDS * attempt)

        if last_error is None:
            last_error = LLMError("Unknown model analysis failure")
        self._mark_failed(feedback, last_error, FEEDBACK_ANALYSIS_MAX_ATTEMPTS)
        self.db.add(feedback)
        self.db.commit()
        self.db.refresh(feedback)
        return feedback

    def _default_model_config(self, tenant_id: str) -> ModelConfig | None:
        return self.db.exec(
            select(ModelConfig).where(
                ModelConfig.tenant_id == tenant_id,
                ModelConfig.is_default == True,  # noqa: E712
                ModelConfig.enabled == True,  # noqa: E712
            )
        ).first()

    def _mark_needs_model(self, feedback: MessageFeedback) -> MessageFeedback:
        analysis = {
            "bucket": "needs_model_analysis",
            "confidence": 0.0,
            "reason": "沒有可用默認模型，無法完成自動歸因。",
            "summary": "反饋已記錄，等待配置模型後重新分析。",
            "evidence": [],
            "suggested_action": "配置默認模型後重新觸發分析。",
        }
        self._apply_analysis(feedback, analysis, "needs_model")
        self.db.add(feedback)
        self.db.commit()
        self.db.refresh(feedback)
        return feedback

    def _mark_failed(self, feedback: MessageFeedback, exc: LLMError, attempts: int) -> None:
        error_message = str(exc)[:300]
        self._apply_analysis(
            feedback,
            {
                "bucket": "unknown",
                "confidence": None,
                "reason": f"模型分析失敗：{error_message}",
                "summary": "反饋已記錄，後臺分析暫時失敗，可重新分析。",
                "evidence": [],
                "suggested_action": "稍後重新分析。",
                "error_type": "llm_error",
                "retryable": True,
                "attempts": attempts,
            },
            "failed",
        )

    def _apply_analysis(self, feedback: MessageFeedback, analysis: dict[str, Any], status: str) -> None:
        feedback.analysis_status = status
        feedback.analysis_bucket = str(analysis.get("bucket") or "unknown")
        feedback.analysis_reason = str(analysis.get("reason") or "")[:300]
        feedback.analysis_summary = str(analysis.get("summary") or "")[:500]
        confidence = analysis.get("confidence")
        feedback.analysis_confidence = None if confidence is None else _float_in_range(confidence, 0.0, 1.0)
        feedback.analysis_json = analysis
        feedback.analyzed_at = utc_now()
        feedback.updated_at = utc_now()

    def _analysis_payload(self, feedback: MessageFeedback) -> dict[str, Any]:
        message = self.db.get(Message, feedback.message_id)
        chat_session = self.db.get(ChatSession, feedback.session_id)
        user = self.db.get(User, feedback.user_id)
        messages = list(
            self.db.exec(
                select(Message)
                .where(Message.tenant_id == feedback.tenant_id, Message.session_id == feedback.session_id)
                .order_by(Message.created_at)
            ).all()
        )
        target_index = next((index for index, item in enumerate(messages) if item.id == feedback.message_id), -1)
        if target_index >= 0:
            context_messages = messages[max(0, target_index - 6) : target_index + 2]
        else:
            context_messages = messages[-8:]
        events = list(
            self.db.exec(
                select(AgentEvent)
                .where(AgentEvent.tenant_id == feedback.tenant_id, AgentEvent.session_id == feedback.session_id)
                .order_by(AgentEvent.created_at.desc())
                .limit(30)
            ).all()
        )
        return {
            "feedback": {
                "rating": feedback.rating,
                "message_id": feedback.message_id,
                "updated_at": feedback.updated_at.isoformat(),
            },
            "session": {
                "session_id": chat_session.id if chat_session else feedback.session_id,
                "title": chat_session.title if chat_session else None,
                "active_skill_id": chat_session.active_skill_id if chat_session else None,
                "active_step_id": chat_session.active_step_id if chat_session else None,
                "summary": chat_session.summary if chat_session else None,
                "slots": chat_session.slots_json if chat_session else {},
            },
            "user": {
                "user_id": feedback.user_id,
                "username": user.username if user else None,
                "display_name": user.display_name if user else None,
            },
            "target_message": {
                "role": message.role if message else None,
                "content": message.content if message else "",
            },
            "nearby_messages": [
                {
                    "id": item.id,
                    "role": item.role,
                    "content": item.content,
                    "created_at": item.created_at.isoformat(),
                }
                for item in context_messages
            ],
            "recent_agent_events": [
                {
                    "event_type": event.event_type,
                    "payload": event.payload_json,
                    "created_at": event.created_at.isoformat(),
                }
                for event in reversed(events)
            ],
        }


def feedback_analysis_read(row: MessageFeedback) -> dict[str, Any]:
    bucket = row.analysis_bucket or "unknown"
    status = _effective_analysis_status(row)
    confidence = None if status == "failed" else row.analysis_confidence
    return {
        "status": status,
        "bucket": bucket,
        "bucket_label": FEEDBACK_BUCKET_LABELS.get(bucket, bucket),
        "reason": row.analysis_reason,
        "summary": row.analysis_summary,
        "confidence": confidence,
        "metadata": row.analysis_json or {},
        "analyzed_at": row.analyzed_at.isoformat() if row.analyzed_at else None,
    }


def _effective_analysis_status(row: MessageFeedback) -> str:
    if row.analysis_status != "analyzed":
        return row.analysis_status
    metadata = row.analysis_json or {}
    if metadata.get("error_type") or metadata.get("retryable"):
        return "failed"
    return row.analysis_status


def feedback_summary(rows: list[MessageFeedback]) -> dict[str, Any]:
    total = len(rows)
    down_rows = [row for row in rows if row.rating == "down"]
    up_rows = [row for row in rows if row.rating == "up"]
    bucket_counts = Counter(row.analysis_bucket or "unknown" for row in down_rows)
    status_counts = Counter(_effective_analysis_status(row) or "pending" for row in rows)
    top_summaries = [
        {
            "message_id": row.message_id,
            "bucket": row.analysis_bucket or "unknown",
            "bucket_label": FEEDBACK_BUCKET_LABELS.get(row.analysis_bucket or "unknown", row.analysis_bucket or "unknown"),
            "summary": row.analysis_summary,
            "reason": row.analysis_reason,
            "confidence": row.analysis_confidence,
        }
        for row in sorted(down_rows, key=lambda item: item.updated_at, reverse=True)
        if row.analysis_summary or row.analysis_reason
    ][:5]
    return {
        "total_feedback": total,
        "down_count": len(down_rows),
        "up_count": len(up_rows),
        "bucket_counts": [
            {
                "bucket": bucket,
                "label": FEEDBACK_BUCKET_LABELS.get(bucket, bucket),
                "count": count,
            }
            for bucket, count in bucket_counts.most_common()
        ],
        "status_counts": dict(status_counts),
        "summary": _compact_overall_summary(bucket_counts, top_summaries),
        "top_summaries": top_summaries,
    }


def _normalize_analysis(raw: dict[str, Any], rating: str) -> dict[str, Any]:
    bucket = str(raw.get("bucket") or "").strip()
    if rating == "up" and bucket in {"", "unknown", "user_random_or_unclear"}:
        bucket = "positive_or_resolved"
    if bucket not in ALLOWED_BUCKETS:
        bucket = "unknown"
    evidence = raw.get("evidence")
    if not isinstance(evidence, list):
        evidence = []
    return {
        "bucket": bucket,
        "confidence": _float_in_range(raw.get("confidence"), 0.0, 1.0),
        "reason": str(raw.get("reason") or FEEDBACK_BUCKET_LABELS.get(bucket, "未知"))[:300],
        "summary": str(raw.get("summary") or raw.get("reason") or "")[:500],
        "evidence": [str(item)[:200] for item in evidence[:3]],
        "suggested_action": str(raw.get("suggested_action") or "")[:300],
    }


def _compact_overall_summary(bucket_counts: Counter[str], top_summaries: list[dict[str, Any]]) -> str:
    if not bucket_counts:
        return "暫無點踩歸因數據。"
    leader, count = bucket_counts.most_common(1)[0]
    label = FEEDBACK_BUCKET_LABELS.get(leader, leader)
    detail = next((item.get("summary") or item.get("reason") for item in top_summaries if item.get("bucket") == leader), "")
    if detail:
        return f"當前點踩主要集中在「{label}」（{count} 次）：{detail}"
    return f"當前點踩主要集中在「{label}」（{count} 次）。"


def _float_in_range(value: Any, minimum: float, maximum: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = minimum
    return max(minimum, min(maximum, parsed))
