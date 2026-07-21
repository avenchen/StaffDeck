import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { notify } from '@/components/ui/app-toast';
import { getClientTimeZone } from '@/lib/timezone';

import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import {
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@/components/ui';
import { cn } from '@/lib/utils';

import { api, TENANT_ID } from '../../api/client';
import IconArrowRight from '../../assets/icons/arrow-right.svg?react';
import IconAlarm from '../../assets/icons/profile-alarm.svg?react';
import type { EnterpriseAuthUser } from '../../auth';
import type { ScheduledTaskRead } from '../../types';
import {
  ENTERPRISE_AGENT_STORAGE_KEY,
  INITIAL_VALUES,
  WEEKDAY_OPTIONS,
  buildSchedule,
  taskToFormValues,
  type TaskFormValues,
} from './shared';

export type ScheduledTaskPageProps = {
  currentUser?: EnterpriseAuthUser;
  onLogout?: () => void;
};

export function ScheduledTaskNewPage(props: ScheduledTaskPageProps = {}) {
  return <ScheduledTaskEditorPage mode="new" {...props} />;
}

export function ScheduledTaskEditPage(props: ScheduledTaskPageProps = {}) {
  return <ScheduledTaskEditorPage mode="edit" {...props} />;
}

type FormErrors = Partial<Record<'title' | 'prompt' | 'run_at' | 'time' | 'weekdays', string>>;

const CARD_CLASS =
  'rounded-[14px] border border-[#eceef1] bg-white p-[20px]';
const CARD_TITLE_CLASS = 'mb-[16px] text-[14px] font-medium text-[#18181a]';
const FIELD_LABEL_CLASS = 'text-[13px] font-medium text-[#18181a]';
const FIELD_ERROR_CLASS = 'text-[12px] leading-none text-[#d20b0b]';

function ScheduledTaskEditorPage({
  mode,
  currentUser,
  onLogout,
}: { mode: 'new' | 'edit' } & ScheduledTaskPageProps) {
  const [values, setValues] = useState<TaskFormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [agentId, setAgentId] = useState(
    () => window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) || '',
  );
  const navigate = useNavigate();
  const { taskId } = useParams();
  const isEdit = mode === 'edit';
  const scheduleType = values.schedule_type;

  function update<K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    const onScopeChange = (event: Event) => {
      const nextAgentId =
        (event as CustomEvent<{ agentId?: string }>).detail?.agentId ||
        window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) ||
        '';
      setAgentId(nextAgentId);
    };
    window.addEventListener('ultrarag-enterprise-agent-scope-change', onScopeChange);
    return () => window.removeEventListener('ultrarag-enterprise-agent-scope-change', onScopeChange);
  }, []);

  useEffect(() => {
    if (!isEdit) {
      setValues(INITIAL_VALUES);
      return;
    }
    if (!taskId) return;
    setLoading(true);
    api
      .get<ScheduledTaskRead>(`/api/enterprise/scheduled-tasks/${taskId}?tenant_id=${TENANT_ID}`)
      .then((row) => {
        setAgentId(row.agent_id);
        setValues(taskToFormValues(row));
      })
      .catch((error) => notify.error(error instanceof Error ? error.message : '加載定時任務失敗'))
      .finally(() => setLoading(false));
  }, [isEdit, taskId]);

  function validate(): boolean {
    const nextErrors: FormErrors = {};
    if (!values.title.trim()) nextErrors.title = '請填寫任務名稱';
    if (!values.prompt.trim()) nextErrors.prompt = '請填寫任務描述';
    if (values.schedule_type === 'once') {
      if (!values.run_at) nextErrors.run_at = '請選擇執行時間';
    } else if (!values.time) {
      nextErrors.time = '請填寫執行時間';
    }
    if (values.schedule_type === 'weekly' && !values.weekdays.length) {
      nextErrors.weekdays = '請選擇星期';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function save() {
    if (!validate()) return;
    if (!agentId) {
      notify.error('請先選擇員工');
      return;
    }
    const payload = {
      tenant_id: TENANT_ID,
      agent_id: agentId,
      title: values.title.trim(),
      prompt: values.prompt.trim(),
      description: values.description?.trim() || undefined,
      schedule_type: values.schedule_type,
      schedule: buildSchedule(values),
      timezone: getClientTimeZone(),
      status: values.status,
      concurrency_policy: 'forbid',
      misfire_policy: 'coalesce',
      max_runs: values.max_runs || undefined,
    };
    setSaving(true);
    try {
      const saved =
        isEdit && taskId
          ? await api.put<ScheduledTaskRead>(`/api/enterprise/scheduled-tasks/${taskId}`, payload)
          : await api.post<ScheduledTaskRead>('/api/enterprise/scheduled-tasks', payload);
      notify.success('定時任務已保存');
      if (!isEdit) {
        navigate(`/enterprise/scheduled-tasks/${saved.id}/edit`, { replace: true });
      } else {
        setValues(taskToFormValues(saved));
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '保存定時任務失敗');
    } finally {
      setSaving(false);
    }
  }

  function toggleWeekday(day: number, checked: boolean) {
    setValues((prev) => {
      const next = checked
        ? [...prev.weekdays, day]
        : prev.weekdays.filter((item) => item !== day);
      return { ...prev, weekdays: next.sort((a, b) => a - b) };
    });
  }

  return (
    <div
      className="min-h-full box-border px-[48px] pt-[32px] pb-[43px] max-[900px]:px-[16px]"
      aria-busy={loading || saving}
    >
      <AppHeader
        onLogout={onLogout}
        userName={currentUser?.username}
        title={isEdit ? '編輯定時任務' : '新建空白定時任務'}
        description="保存後到點會拉起一個新的執行記錄，並交給當前員工按 SOP、技能、資料和工具執行。"
      />
      <div className="flex justify-end gap-[16px] mt-[20px] mb-[16px]">
        <Button
          variant="outline"
          onClick={() => navigate('/enterprise/scheduled-tasks')}
          className="h-8 gap-1 rounded-[10px] border-[0.5px] border-[#e3e7f1] bg-white px-5 text-[12px] font-normal text-[#757f9c] hover:border-[#cbd3e6] hover:bg-white hover:text-[#18181a]"
        >
          <IconArrowRight className="size-3.5 rotate-180" />
          返回定時任務
        </Button>
        <Button
          onClick={() => void save()}
          disabled={saving}
          className="h-8 gap-1 rounded-[10px] bg-[#18181a] px-5 text-[12px] font-normal text-white hover:bg-[#303030]"
        >
          保存
        </Button>
      </div>

      <div className="grid grid-cols-1 items-start gap-[20px] lg:grid-cols-2">
        <section className={CARD_CLASS}>
          <h3 className={CARD_TITLE_CLASS}>任務說明</h3>
          <div className="flex flex-col gap-[16px]">
            <div className="flex flex-col gap-[6px]">
              <Label htmlFor="task-title" className={FIELD_LABEL_CLASS}>
                任務名稱
              </Label>
              <div className="relative">
                <IconAlarm className="pointer-events-none absolute left-[10px] top-1/2 size-[14px] -translate-y-1/2 text-[#858b9c]" />
                <Input
                  id="task-title"
                  className={cn('pl-[30px]', errors.title && 'border-destructive')}
                  maxLength={80}
                  placeholder="例如：每日交付質量復盤"
                  value={values.title}
                  onChange={(event) => update('title', event.target.value)}
                />
              </div>
              {errors.title && <p className={FIELD_ERROR_CLASS}>{errors.title}</p>}
            </div>

            <div className="flex flex-col gap-[6px]">
              <Label htmlFor="task-prompt" className={FIELD_LABEL_CLASS}>
                每次執行時交給員工的任務
              </Label>
              <Textarea
                id="task-prompt"
                rows={7}
                maxLength={10000}
                className={cn(errors.prompt && 'border-destructive')}
                placeholder="描述員工每次執行時需要做什麼，可以包含拆解要求、輸出格式和注意事項。"
                value={values.prompt}
                onChange={(event) => update('prompt', event.target.value)}
              />
              <div className="flex items-center justify-between">
                {errors.prompt ? (
                  <p className={FIELD_ERROR_CLASS}>{errors.prompt}</p>
                ) : (
                  <span />
                )}
                <span className="text-[12px] leading-none text-[#858b9c]">
                  {values.prompt.length}/10000
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-[6px]">
              <Label htmlFor="task-description" className={FIELD_LABEL_CLASS}>
                內部備註
              </Label>
              <Textarea
                id="task-description"
                rows={3}
                placeholder="可選，用於說明這個定時任務的來源和目的"
                value={values.description || ''}
                onChange={(event) => update('description', event.target.value)}
              />
            </div>
          </div>
        </section>

        <section className={CARD_CLASS}>
          <h3 className={CARD_TITLE_CLASS}>喚醒計劃</h3>
          <div className="flex flex-col gap-[16px]">
            <div className="flex items-center justify-between">
              <Label htmlFor="task-status" className={FIELD_LABEL_CLASS}>
                啟用狀態
              </Label>
              <div className="flex items-center gap-[8px]">
                <Switch
                  id="task-status"
                  checked={values.status !== 'paused'}
                  onCheckedChange={(checked) => update('status', checked ? 'active' : 'paused')}
                />
                <span className="text-[13px] text-[#858b9c]">
                  {values.status !== 'paused' ? '啟用' : '暫停'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-[6px]">
              <Label className={FIELD_LABEL_CLASS}>調度類型</Label>
              <Select
                value={values.schedule_type}
                onValueChange={(value) =>
                  update('schedule_type', value as TaskFormValues['schedule_type'])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">每天</SelectItem>
                  <SelectItem value="weekly">每週</SelectItem>
                  <SelectItem value="monthly">每月</SelectItem>
                  <SelectItem value="once">一次性</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scheduleType === 'once' ? (
              <div className="flex flex-col gap-[6px]">
                <Label htmlFor="task-run-at" className={FIELD_LABEL_CLASS}>
                  執行時間
                </Label>
                <Input
                  id="task-run-at"
                  type="datetime-local"
                  className={cn(errors.run_at && 'border-destructive')}
                  value={values.run_at}
                  onChange={(event) => update('run_at', event.target.value)}
                />
                {errors.run_at && <p className={FIELD_ERROR_CLASS}>{errors.run_at}</p>}
              </div>
            ) : (
              <div className="flex flex-col gap-[6px]">
                <Label htmlFor="task-time" className={FIELD_LABEL_CLASS}>
                  執行時間
                </Label>
                <Input
                  id="task-time"
                  type="time"
                  className={cn(errors.time && 'border-destructive')}
                  value={values.time}
                  onChange={(event) => update('time', event.target.value)}
                />
                {errors.time && <p className={FIELD_ERROR_CLASS}>{errors.time}</p>}
              </div>
            )}

            {scheduleType === 'weekly' && (
              <div className="flex flex-col gap-[8px]">
                <Label className={FIELD_LABEL_CLASS}>執行日期</Label>
                <div className="flex flex-wrap gap-x-[16px] gap-y-[10px]">
                  {WEEKDAY_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-[6px] text-[13px] text-[#18181a]"
                    >
                      <Checkbox
                        checked={values.weekdays.includes(option.value)}
                        onCheckedChange={(checked) =>
                          toggleWeekday(option.value, checked === true)
                        }
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                {errors.weekdays && <p className={FIELD_ERROR_CLASS}>{errors.weekdays}</p>}
              </div>
            )}

            {scheduleType === 'monthly' && (
              <div className="flex flex-col gap-[6px]">
                <Label htmlFor="task-day" className={FIELD_LABEL_CLASS}>
                  每月幾號
                </Label>
                <Input
                  id="task-day"
                  type="number"
                  min={1}
                  max={31}
                  className="w-[120px]"
                  value={values.day_of_month}
                  onChange={(event) => update('day_of_month', Number(event.target.value) || 1)}
                />
              </div>
            )}

            <div className="flex flex-col gap-[6px]">
              <Label htmlFor="task-max-runs" className={FIELD_LABEL_CLASS}>
                最大運行次數
              </Label>
              <Input
                id="task-max-runs"
                type="number"
                min={1}
                placeholder="不填為無限制"
                value={values.max_runs ?? ''}
                onChange={(event) =>
                  update('max_runs', event.target.value ? Number(event.target.value) : undefined)
                }
              />
            </div>

            <div className="rounded-[12px] border border-[#eef0f4] bg-[#fafbfc] px-[14px] py-[12px] text-[13px] leading-[1.6] text-[#858b9c]">
              默認使用 forbid 併發策略：上一輪未結束時跳過本次喚醒，避免同一員工重複處理同一批任務。
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
