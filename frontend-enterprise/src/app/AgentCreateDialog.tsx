import type { Dispatch, SetStateAction } from 'react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  Input,
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui';
import { Button as UIButton } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DIALOG_CANCEL_BUTTON_CLASS,
  DIALOG_FOOTER_CLASS,
  DIALOG_PRIMARY_BUTTON_CLASS,
  SELECT_TRIGGER_CLASS,
} from '@/lib/enterprise-ui';
import { employeeDisplayNameWithCreator, employeeProfile } from '@/employee';
import { isGalleryEmployee } from '@/auth';
import type { AgentProfileRead } from '@/types';

import type { AgentCreateFormState } from './appTypes';

type AgentCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: AgentCreateFormState;
  onFormChange: Dispatch<SetStateAction<AgentCreateFormState>>;
  sourceAgents: AgentProfileRead[];
  onSubmit: () => void;
};

/**
 * Presentational "新建數字員工" dialog. All business logic (loading agents,
 * building metadata, persisting) stays in the shell and is passed in via
 * `onSubmit`; this component only owns the form UI.
 */
export default function AgentCreateDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  sourceAgents,
  onSubmit,
}: AgentCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] flex-col gap-0 overflow-hidden rounded-[16px] p-0 sm:max-w-[520px]">
        <DialogTitle className="shrink-0 px-[24px] py-[16px] text-[16px] font-semibold text-foreground">
          新建數字員工
        </DialogTitle>
        <div className="agent-editor-form min-h-0 flex-1 overflow-y-auto px-[24px] pb-[16px]">
          <label>
            創建方式
            <div className="inline-flex w-fit gap-[4px] rounded-[10px] border border-border p-[2px]">
              {[
                { label: "從廣場複製", value: "copy" as const },
                { label: "從空白開始", value: "blank" as const },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "rounded-[8px] px-[14px] py-[5px] text-[13px] font-medium transition-colors",
                    form.sourceMode === option.value
                      ? "bg-[#18181a] text-white"
                      : "text-[#5b6273] hover:text-foreground",
                  )}
                  onClick={() =>
                    onFormChange((prev) => ({
                      ...prev,
                      sourceMode: option.value,
                      copyFromAgentId:
                        option.value === "blank" ? "" : prev.copyFromAgentId,
                    }))
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </label>
          <label>
            職位
            <Input
              value={form.roleName}
              onChange={(event) =>
                onFormChange((prev) => ({
                  ...prev,
                  roleName: event.target.value,
                }))
              }
              placeholder="例如 研發工程師、財務助理"
            />
          </label>
          <div className="grid content-start gap-[6px]">
          {form.sourceMode === "copy" && (
            <label>
              複製來源
              <UISelect
                value={form.copyFromAgentId || undefined}
                onValueChange={(value) =>
                  onFormChange((prev) => {
                    const nextSource = sourceAgents.find(
                      (item) => item.id === value,
                    );
                    return {
                      ...prev,
                      copyFromAgentId: value,
                      roleName:
                        prev.roleName ||
                        (nextSource && !nextSource.is_overall
                          ? employeeProfile(nextSource).roleName
                          : ""),
                    };
                  })
                }
              >
                <SelectTrigger className={cn(SELECT_TRIGGER_CLASS, "w-full")}>
                  <SelectValue placeholder="選擇複製來源" />
                </SelectTrigger>
                <SelectContent>
                  {sourceAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.is_overall
                        ? "開放廣場"
                        : `${employeeDisplayNameWithCreator(agent)} · ${employeeProfile(agent).roleName}${isGalleryEmployee(agent) ? " · 廣場" : ""}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </UISelect>
            </label>
          )}
          {form.sourceMode === "blank" && (
            <div className="agent-definition-note">
              從空白開始創建，不繼承任何已有配置。
            </div>
          )}
          </div>
          <label>
            數字員工姓名
            <Input
              value={form.name}
              onChange={(event) =>
                onFormChange((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
            />
          </label>
          <label>
            崗位描述
            <Textarea
              rows={3}
              value={form.description}
              onChange={(event) =>
                onFormChange((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder="概括這個數字員工的崗位邊界、服務風格和執行重點"
            />
          </label>
        </div>
        <div className={cn(DIALOG_FOOTER_CLASS, "shrink-0 border-t border-border")}>
          <UIButton
            variant="outline"
            className={DIALOG_CANCEL_BUTTON_CLASS}
            onClick={() => onOpenChange(false)}
          >
            取消
          </UIButton>
          <UIButton
            className={DIALOG_PRIMARY_BUTTON_CLASS}
            onClick={() => onSubmit()}
          >
            創建
          </UIButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
