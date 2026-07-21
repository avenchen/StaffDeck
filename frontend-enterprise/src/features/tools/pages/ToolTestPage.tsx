import { useNavigate, useParams } from 'react-router-dom';

import { toolsApi } from '@/api/endpoints/tools';
import AppHeader from '@/components/AppHeader';
import { Button as UIButton } from '@/components/ui/button';
import { notify } from '@/components/ui/app-toast';
import { ToolOutlined } from '@/icons';
import IconArrowRight from '@/assets/icons/arrow-right.svg?react';
import IconEdit from '@/assets/icons/edit.svg?react';
import CodeBlock from '@/components/CodeBlock';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatDateTime } from '@/lib/enterprise-ui';
import { StatusBadge } from '@/pages/scheduled-tasks/StatusBadge';
import { currentAgentId, formatJson, schemaPropertyCount, toolTypeLabel } from '../lib/toolPayload';
import { SectionCard } from '../components/SectionCard';
import { SavedToolTestCard } from '../components/SavedToolTestCard';
import { RETURN_BUTTON_CLASS, SUBSECTION_TITLE_CLASS } from '../styles';
import type { ToolPageProps } from '../types';
import type { ToolRead } from '@/types';

export function ToolTestPage({ currentUser, onLogout }: ToolPageProps = {}) {
  const navigate = useNavigate();
  const { toolId } = useParams();

  const { data: tool, loading } = useApiQuery<ToolRead>(
    toolId ? () => toolsApi.get(toolId, currentAgentId()) : null,
    [toolId],
    { onError: (error) => notify.error(error.message || '加載工具失敗') },
  );

  return (
    <div className="min-h-full box-border px-[48px] pt-[32px] pb-[43px] max-[900px]:px-[16px]" aria-busy={loading}>
      <AppHeader
        onLogout={onLogout}
        userName={currentUser?.username}
        title="工具測試"
        description="用測試參數直接調用已保存工具，檢查員工後續調用時的實際返回。"
      />
      <div className="mt-[20px] mb-[16px] flex flex-wrap justify-end gap-[16px]">
        <UIButton variant="outline" onClick={() => navigate('/enterprise/tools')} className={RETURN_BUTTON_CLASS}>
          <IconArrowRight className="size-3.5 rotate-180" />
          返回工具
        </UIButton>
        {tool && (
          <UIButton
            variant="outline"
            onClick={() => navigate(`/enterprise/tools/${tool.id}/edit`)}
            className={RETURN_BUTTON_CLASS}
          >
            <IconEdit className="size-3.5" />
            編輯工具
          </UIButton>
        )}
      </div>
      <div className="grid grid-cols-1 items-start gap-[20px] xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
        <SectionCard title="工具信息" loading={loading && !tool} bodyClassName="flex flex-col gap-[16px]">
          {tool && (
            <>
              <div className="grid grid-cols-[58px_minmax(0,1fr)] items-start gap-[16px] rounded-[14px] border border-[#eceef1] bg-[#fafbfc] p-[16px]">
                <div className="grid size-[58px] place-items-center rounded-[16px] border border-[#eceef1] bg-white text-[24px] text-[#18181a]">
                  <ToolOutlined />
                </div>
                <div className="min-w-0">
                  <span className="text-[12px] font-semibold text-[#1a71ff]">{tool.bucket || '未分桶'}</span>
                  <h4 className="my-[4px] text-[18px] font-semibold wrap-break-word text-[#18181a]">
                    {tool.display_name || tool.name}
                  </h4>
                  <p className="mb-[10px] text-[13px] leading-[1.65] wrap-break-word text-[#858b9c]">
                    {tool.description || '暫無描述'}
                  </p>
                  <div className="flex flex-wrap items-center gap-[6px]">
                    <StatusBadge tone={tool.tool_type === 'mcp' ? 'blue' : 'gray'}>{toolTypeLabel(tool)}</StatusBadge>
                    <StatusBadge tone={tool.enabled ? 'green' : 'gray'}>{tool.enabled ? '已啟用' : '已停用'}</StatusBadge>
                    <StatusBadge tone="gray">{tool.method}</StatusBadge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-[10px] md:grid-cols-4">
                {[
                  { label: '工具 ID', value: tool.name },
                  { label: '輸入字段', value: schemaPropertyCount(tool.input_schema) },
                  { label: '輸出字段', value: schemaPropertyCount(tool.output_schema) },
                  { label: '最近更新', value: formatDateTime(tool.updated_at) },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex min-h-[78px] flex-col gap-[8px] rounded-[12px] border border-[#eceef1] bg-white px-[14px] py-[13px]"
                  >
                    <span className="text-[12px] font-semibold text-[#858b9c]">{item.label}</span>
                    <strong className="text-[14px] leading-[1.35] wrap-break-word text-[#18181a]">
                      {item.value}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-[8px] rounded-[12px] border border-[#eceef1] bg-[#fafbfc] px-[16px] py-[14px]">
                <span className="text-[12px] font-semibold text-[#858b9c]">調用地址</span>
                <code className="block font-mono text-[13px] leading-[1.6] wrap-break-word text-[#18181a]">
                  {tool.method} {tool.url}
                </code>
              </div>

              <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2">
                <div className="flex flex-col gap-[10px]">
                  <span className={SUBSECTION_TITLE_CLASS}>Input Schema</span>
                  <CodeBlock className="max-h-[340px] whitespace-pre-wrap wrap-break-word" code={formatJson(tool.input_schema)} language="json" />
                </div>
                <div className="flex flex-col gap-[10px]">
                  <span className={SUBSECTION_TITLE_CLASS}>Output Schema</span>
                  <CodeBlock className="max-h-[340px] whitespace-pre-wrap wrap-break-word" code={formatJson(tool.output_schema)} language="json" />
                </div>
              </div>
            </>
          )}
        </SectionCard>
        {tool && <SavedToolTestCard tool={tool} standalone />}
      </div>
    </div>
  );
}
