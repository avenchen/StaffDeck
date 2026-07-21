import { useEffect, useState } from 'react';

import StaffdeckIcon from '@/components/StaffdeckIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { notify } from '@/components/ui/app-toast';
import { getClientTimeZone } from '@/lib/timezone';
import { cn } from '@/lib/utils';
import type { ScheduledTaskDraftRead, ScheduledTaskRead } from '@/types';

import {
  CHAT_DRAFT_CARD_CLASS,
  CHAT_DRAFT_CARD_CREATED_CLASS,
  CHAT_DRAFT_CREATED_BADGE_CLASS,
  CHAT_DRAFT_EDITOR_CLASS,
  CHAT_DRAFT_EDITOR_FULL_CLASS,
  CHAT_DRAFT_FOOTER_CLASS,
  CHAT_DRAFT_HEADER_CLASS,
  CHAT_DRAFT_ICON_CLASS,
  CHAT_DRAFT_IDENTITY_CLASS,
  CHAT_DRAFT_KICKER_CLASS,
  CHAT_DRAFT_META_GRID_CLASS,
  CHAT_DRAFT_META_ITEM_CLASS,
  CHAT_DRAFT_PROMPT_CLASS,
  CHAT_DRAFT_TITLE_CLASS,
  CHAT_DRAFT_TOP_ACTIONS_CLASS,
} from '../chatPageStyles';
import {
  draftScheduleForType,
  formatDraftSchedule,
  normalizeDraftScheduleType,
  scheduleEditValue,
  scheduleFromEditValue,
  scheduleTypeLabel,
} from '../chatHelpers';

type ScheduledDraftCardProps = {
  draft: ScheduledTaskDraftRead;
  createdTask?: ScheduledTaskRead;
  onConfirm: (draft: ScheduledTaskDraftRead) => void;
  onDismiss: () => void;
};

export default function ScheduledDraftCard({
  draft,
  createdTask,
  onConfirm,
  onDismiss,
}: ScheduledDraftCardProps) {
  const [editing, setEditing] = useState(false);
  const [editableDraft, setEditableDraft] = useState<ScheduledTaskDraftRead>(draft);
  const created = Boolean(createdTask);
  const currentTimezone = getClientTimeZone();
  const displayDraft = createdTask
    ? ({
      ...draft,
      title: createdTask.title,
      prompt: createdTask.prompt,
      description: createdTask.description || draft.description,
      schedule_type: createdTask.schedule_type,
      schedule: createdTask.schedule,
      timezone: createdTask.timezone,
      rrule: createdTask.rrule || draft.rrule,
    } as ScheduledTaskDraftRead)
    : editableDraft;

  useEffect(() => {
    setEditableDraft(draft);
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draft.agent_id,
    draft.title,
    draft.prompt,
    draft.description,
    draft.schedule_type,
    draft.timezone,
    draft.rrule,
    JSON.stringify(draft.schedule || {}),
    createdTask?.id,
  ]);

  const updateDraft = (patch: Partial<ScheduledTaskDraftRead>) => {
    setEditableDraft((current) => ({ ...current, ...patch }));
  };
  const scheduleValue = scheduleEditValue(editableDraft);
  const validateDraft = (nextDraft: ScheduledTaskDraftRead) => {
    if (!nextDraft.title.trim()) {
      notify.warning('請輸入定時任務名稱');
      return false;
    }
    if (!nextDraft.prompt.trim()) {
      notify.warning('請輸入執行內容');
      return false;
    }
    if (!scheduleEditValue(nextDraft).trim()) {
      notify.warning('請輸入執行計劃');
      return false;
    }
    return true;
  };
  const updateScheduleType = (value: ScheduledTaskDraftRead['schedule_type']) => {
    setEditableDraft((current) => {
      const scheduleType = normalizeDraftScheduleType(value);
      const schedule = draftScheduleForType(current.schedule || {}, scheduleType);
      return { ...current, schedule_type: scheduleType, schedule };
    });
  };
  const updateScheduleValue = (value: string) => {
    setEditableDraft((current) => ({ ...current, schedule: scheduleFromEditValue(current, value) }));
  };
  const completeEdit = () => {
    if (!validateDraft(editableDraft)) return;
    setEditing(false);
  };
  const confirmDraft = () => {
    if (created) return;
    if (!validateDraft(editableDraft)) return;
    onConfirm(editableDraft);
  };

  return (
    <div className={cn(CHAT_DRAFT_CARD_CLASS, created && CHAT_DRAFT_CARD_CREATED_CLASS)}>
      <div className={CHAT_DRAFT_HEADER_CLASS}>
        <div className={CHAT_DRAFT_IDENTITY_CLASS}>
          <div className={CHAT_DRAFT_ICON_CLASS}>
            <StaffdeckIcon name={created ? 'check' : 'clock'} size={18} />
          </div>
          <div className="grid min-w-0 gap-[2px]">
            <div className={CHAT_DRAFT_KICKER_CLASS}>{created ? '定時任務已創建' : '定時任務草案'}</div>
            {editing ? (
              <Input
                className="h-[30px]"
                value={editableDraft.title}
                onChange={(event) => updateDraft({ title: event.target.value })}
              />
            ) : (
              <strong className={CHAT_DRAFT_TITLE_CLASS}>{displayDraft.title}</strong>
            )}
          </div>
        </div>
        <div className={CHAT_DRAFT_TOP_ACTIONS_CLASS}>
          {created ? (
            <span className={CHAT_DRAFT_CREATED_BADGE_CLASS}>
              <StaffdeckIcon name="check" size={13} />
              已創建
            </span>
          ) : editing ? (
            <>
              <Button size="sm" onClick={completeEdit}>完成</Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditableDraft(draft);
                  setEditing(false);
                }}
              >
                取消
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <StaffdeckIcon name="edit" size={14} />
                編輯
              </Button>
              <Button size="sm" variant="ghost" onClick={onDismiss}>忽略</Button>
            </>
          )}
        </div>
      </div>
      {editing ? (
        <div className={CHAT_DRAFT_EDITOR_CLASS}>
          <label>
            <span>計劃類型</span>
            <Select value={editableDraft.schedule_type} onValueChange={updateScheduleType}>
              <SelectTrigger className="h-[32px] w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">一次性</SelectItem>
                <SelectItem value="daily">每天</SelectItem>
                <SelectItem value="weekly">每週</SelectItem>
                <SelectItem value="monthly">每月</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label>
            <span>執行計劃</span>
            <Input
              className="h-[32px]"
              value={scheduleValue}
              placeholder={editableDraft.schedule_type === 'once' ? 'YYYY-MM-DDTHH:mm:ss+08:00' : 'HH:mm'}
              onChange={(event) => updateScheduleValue(event.target.value)}
            />
          </label>
          <label>
            <span>時區</span>
            <Input
              className="h-[32px]"
              value={editableDraft.timezone || currentTimezone}
              onChange={(event) => updateDraft({ timezone: event.target.value })}
            />
          </label>
          <label className={CHAT_DRAFT_EDITOR_FULL_CLASS}>
            <span>執行內容</span>
            <Textarea
              rows={3}
              value={editableDraft.prompt}
              onChange={(event) => updateDraft({ prompt: event.target.value })}
            />
          </label>
          <label className={CHAT_DRAFT_EDITOR_FULL_CLASS}>
            <span>說明</span>
            <Textarea
              rows={2}
              value={editableDraft.description || ''}
              placeholder="可補充任務目的、範圍或結果要求"
              onChange={(event) => updateDraft({ description: event.target.value })}
            />
          </label>
        </div>
      ) : (
        <div className="grid gap-[12px]">
          <div className={CHAT_DRAFT_META_GRID_CLASS}>
            <div className={CHAT_DRAFT_META_ITEM_CLASS}>
              <span>計劃</span>
              <strong>{formatDraftSchedule(displayDraft)}</strong>
            </div>
            <div className={CHAT_DRAFT_META_ITEM_CLASS}>
              <span>類型</span>
              <strong>{scheduleTypeLabel(displayDraft.schedule_type)}</strong>
            </div>
            <div className={CHAT_DRAFT_META_ITEM_CLASS}>
              <span>時區</span>
              <strong>{displayDraft.timezone || currentTimezone}</strong>
            </div>
          </div>
          <div className={CHAT_DRAFT_PROMPT_CLASS}>
            <span>執行內容</span>
            <p>{displayDraft.prompt}</p>
          </div>
          {displayDraft.description && (
            <div className={CHAT_DRAFT_PROMPT_CLASS}>
              <span>說明</span>
              <p>{displayDraft.description}</p>
            </div>
          )}
        </div>
      )}
      {!created && (
        <div className={CHAT_DRAFT_FOOTER_CLASS}>
          {editing && <Button size="sm" variant="ghost" onClick={onDismiss}>忽略</Button>}
          <Button size="sm" onClick={confirmDraft}>確認創建</Button>
        </div>
      )}
    </div>
  );
}
