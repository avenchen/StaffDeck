import { useNavigate } from 'react-router-dom';

import { ApiOutlined, CheckOutlined } from '@/icons';
import { cn } from '@/lib/utils';
import IconTool from '@/assets/icons/plaza-tool.svg?react';
import { FIELD_LABEL_CLASS } from '../styles';

/**
 * 新建工具时顶部的类型切换条：HTTP 工具 / MCP 服务器。
 * 点击即跳转到对应的新建页，体验上像同一个「新建工具」流程里的分支。
 */
export function ToolTypeSwitcher({ active }: { active: 'http' | 'mcp' }) {
  const navigate = useNavigate();
  const options: { value: 'http' | 'mcp'; label: string; hint: string; to: string }[] = [
    { value: 'http', label: 'HTTP 工具', hint: '配置单个 HTTP 接口作为工具', to: '/enterprise/tools/new' },
    { value: 'mcp', label: 'MCP 服务器', hint: '连接 MCP Server，自动发现并同步其工具集', to: '/enterprise/tools/mcp/new' },
  ];
  return (
    <div className="mb-[16px] flex flex-col gap-[8px]">
      <span className={FIELD_LABEL_CLASS}>工具类型</span>
      <div className="flex flex-wrap gap-[10px]">
        {options.map((option) => {
          const isActive = option.value === active;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                if (!isActive) navigate(option.to);
              }}
              className={cn(
                'relative flex min-w-[200px] flex-1 items-start gap-[10px] rounded-[12px] border px-[16px] py-[12px] text-left transition-all',
                isActive
                  ? 'border-[#18181a] bg-[#18181a] shadow-[0_4px_12px_0_rgba(24,24,26,0.18)]'
                  : 'border-[#e3e7f1] bg-white hover:border-[#cbd3e6] hover:bg-[#fafbfc]',
              )}
              aria-pressed={isActive}
            >
              <span
                className={cn(
                  'flex size-[28px] shrink-0 items-center justify-center rounded-[8px]',
                  isActive ? 'bg-white/15 text-white' : 'bg-[#f2f3f7] text-[#757f9c]',
                )}
              >
                {option.value === 'mcp' ? <ApiOutlined className="size-[15px] shrink-0" /> : <IconTool className="size-[15px] shrink-0" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <span className={cn('text-[13px] font-semibold', isActive ? 'text-white' : 'text-[#18181a]')}>
                  {option.label}
                </span>
                <span className={cn('text-[12px] leading-[1.5]', isActive ? 'text-white/70' : 'text-[#858b9c]')}>
                  {option.hint}
                </span>
              </span>
              {isActive && (
                <span className="absolute top-[10px] right-[10px] flex size-[16px] shrink-0 items-center justify-center rounded-full bg-white text-[#18181a]">
                  <CheckOutlined className="size-[10px] shrink-0" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
