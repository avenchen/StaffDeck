import { Dialog, DialogContent, DialogTitle } from '@/components/ui';
import { Button as UIButton } from '@/components/ui/button';
import IconSkill from '@/assets/icons/plaza-skill.svg?react';

export function ClawHubDialog({
  open,
  loading,
  source,
  onSourceChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  loading: boolean;
  source: string;
  onSourceChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex w-[calc(100%-2rem)] flex-col gap-[16px] overflow-hidden rounded-[14px] px-[20px] py-[16px] sm:max-w-[560px]"
      >
        <div className="flex items-center gap-[6px] px-[12px] text-[#757f9c]">
          <IconSkill className="size-[14px] shrink-0" />
          <DialogTitle className="text-[14px] font-normal leading-none text-[#757f9c]">
            从开源平台导入技能
          </DialogTitle>
        </div>

        <div className="flex flex-col gap-[12px] px-[12px]">
          <p className="text-[12px] leading-[1.6] text-[#858b9c]">
            支持开源平台地址、GitHub repo/tree/raw SKILL.md 或 owner/repo 形式。本地 zip 或 Markdown 文件请在编辑页使用「导入 &gt; 选择文件」。
          </p>
          <input
            value={source}
            onChange={(event) => onSourceChange(event.target.value)}
            placeholder="例如 alchaincyf/nuwa-skill 或 https://github.com/owner/repo/tree/main/skill"
            className="h-[34px] w-full rounded-[10px] border-[0.5px] border-[#e3e7f1] bg-white px-[12px] text-[12px] text-[#17191f] outline-none transition-colors placeholder:text-[#c0c6d4] focus:border-[#18181a]"
          />
        </div>

        <div className="flex items-center justify-end gap-[8px] px-[12px]">
          <UIButton
            variant="outline"
            disabled={loading}
            onClick={onClose}
            className="h-[32px] w-[80px] rounded-[10px] border-[#e3e7f1] bg-white px-[12px] text-[14px] font-normal text-[#464c5e] hover:border-[#e3e7f1] hover:bg-[#f6f6f6] hover:text-[#18181a]"
          >
            取消
          </UIButton>
          <UIButton
            disabled={loading}
            onClick={onSubmit}
            className="h-[32px] w-[80px] rounded-[10px] bg-[#18181a] px-[12px] text-[14px] font-normal text-white hover:bg-[#303030]"
          >
            新增
          </UIButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
