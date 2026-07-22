import { useEffect, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { Button as UIButton } from '@/components/ui/button';
import { notify } from '@/components/ui/app-toast';
import { api, TENANT_ID } from '@/api/client';
import { departmentsApi } from '@/api/endpoints/departments';
import type { AgentProfileRead, DepartmentRead } from '@/types';

const NO_DEPARTMENT = '__none__';

type UserOption = { id: string; label: string };

export default function AgentVisibilityDialog({
  agent,
  open,
  departmentOptions,
  users,
  onClose,
  onSaved,
}: {
  agent: AgentProfileRead | null;
  open: boolean;
  departmentOptions: { id: string; label: string }[];
  users: UserOption[];
  onClose: () => void;
  onSaved: (agent: AgentProfileRead) => void;
}) {
  const [departmentId, setDepartmentId] = useState<string>(NO_DEPARTMENT);
  const [all, setAll] = useState(false);
  const [sameDepartment, setSameDepartment] = useState(false);
  const [deptIds, setDeptIds] = useState<Set<string>>(new Set());
  const [userIds, setUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !agent) return;
    setDepartmentId(agent.department_id || NO_DEPARTMENT);
    setLoading(true);
    departmentsApi
      .agentVisibility(agent.id)
      .then((vis) => {
        setAll(vis.all);
        setSameDepartment(vis.same_department);
        setDeptIds(new Set(vis.department_ids));
        setUserIds(new Set(vis.user_ids));
      })
      .catch((error) => notify.error(error instanceof Error ? error.message : '加載可見性失敗'))
      .finally(() => setLoading(false));
  }, [open, agent]);

  function toggle(set: Set<string>, id: string): Set<string> {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  async function save() {
    if (!agent) return;
    setSaving(true);
    try {
      const updated = await api.put<AgentProfileRead>(`/api/enterprise/agents/${agent.id}`, {
        tenant_id: TENANT_ID,
        department_id: departmentId === NO_DEPARTMENT ? '' : departmentId,
      });
      await departmentsApi.setAgentVisibility(agent.id, {
        all,
        same_department: sameDepartment,
        department_ids: [...deptIds],
        user_ids: [...userIds],
      });
      notify.success('可見性已更新');
      onSaved(updated);
      onClose();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '更新可見性失敗');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[80vh] w-[calc(100%-2rem)] flex-col gap-[14px] overflow-y-auto rounded-[14px] px-[20px] py-[16px] sm:max-w-[480px]"
      >
        <DialogTitle className="text-[14px] font-medium text-[#18181a]">
          可見性設定{agent ? `：${agent.name}` : ''}
        </DialogTitle>

        {loading ? (
          <div className="py-[24px] text-center text-[13px] text-[#858b9c]">加載中…</div>
        ) : (
          <>
            <label className="flex flex-col gap-[6px]">
              <span className="text-[12px] font-medium text-[#464c5e]">所屬部門（可選）</span>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEPARTMENT}>不指定</SelectItem>
                  {departmentOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="flex items-center gap-[8px] text-[13px] text-[#18181a]">
              <input type="checkbox" checked={all} onChange={() => setAll((v) => !v)} />
              開放給全用戶
            </label>
            <label className="flex items-center gap-[8px] text-[13px] text-[#18181a]">
              <input
                type="checkbox"
                checked={sameDepartment}
                onChange={() => setSameDepartment((v) => !v)}
              />
              同部門可見（依所屬部門）
            </label>

            <fieldset className="flex flex-col gap-[6px] rounded-[10px] border border-[#eef0f4] p-[10px]">
              <legend className="px-[4px] text-[12px] font-medium text-[#464c5e]">指定部門（含子部門）</legend>
              <div className="flex max-h-[140px] flex-col gap-[4px] overflow-y-auto">
                {departmentOptions.map((option) => (
                  <label key={option.id} className="flex items-center gap-[8px] text-[13px] text-[#18181a]">
                    <input
                      type="checkbox"
                      checked={deptIds.has(option.id)}
                      onChange={() => setDeptIds((prev) => toggle(prev, option.id))}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {users.length > 0 && (
              <fieldset className="flex flex-col gap-[6px] rounded-[10px] border border-[#eef0f4] p-[10px]">
                <legend className="px-[4px] text-[12px] font-medium text-[#464c5e]">指定用戶</legend>
                <div className="flex max-h-[140px] flex-col gap-[4px] overflow-y-auto">
                  {users.map((option) => (
                    <label key={option.id} className="flex items-center gap-[8px] text-[13px] text-[#18181a]">
                      <input
                        type="checkbox"
                        checked={userIds.has(option.id)}
                        onChange={() => setUserIds((prev) => toggle(prev, option.id))}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="flex items-center justify-end gap-[8px]">
              <UIButton
                variant="outline"
                disabled={saving}
                onClick={onClose}
                className="h-[32px] rounded-[10px] px-[14px] text-[13px]"
              >
                取消
              </UIButton>
              <UIButton
                disabled={saving}
                onClick={() => void save()}
                className="h-[32px] rounded-[10px] bg-[#1a71ff] px-[14px] text-[13px] text-white hover:bg-[#0f5ed7]"
              >
                保存
              </UIButton>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
