import { useEffect, useState } from 'react';

import { toolsApi } from '@/api/endpoints/tools';
import { Textarea } from '@/components/ui';
import { Button as UIButton } from '@/components/ui/button';
import { notify } from '@/components/ui/app-toast';
import { ExperimentOutlined } from '@/icons';
import CodeBlock from '@/components/CodeBlock';
import { StatusBadge } from '@/pages/scheduled-tasks/StatusBadge';
import { currentAgentId, exampleFromSchema, parseJson, toolTypeLabel } from '../lib/toolPayload';
import { SectionCard } from './SectionCard';
import { MONO_INPUT_CLASS, PRIMARY_BUTTON_CLASS, SUBSECTION_TITLE_CLASS } from '../styles';
import type { ToolRead } from '@/types';

export function SavedToolTestCard({ tool, standalone = false }: { tool: ToolRead; standalone?: boolean }) {
  const [testJson, setTestJson] = useState(() => JSON.stringify(exampleFromSchema(tool.input_schema), null, 2));
  const [testResult, setTestResult] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTestJson(JSON.stringify(exampleFromSchema(tool.input_schema), null, 2));
    setTestResult('');
  }, [tool.id, tool.input_schema]);

  async function test() {
    let argumentsJson: Record<string, unknown>;
    try {
      argumentsJson = parseJson(testJson, {});
    } catch {
      notify.error('测试参数不是合法 JSON');
      return;
    }
    setLoading(true);
    try {
      const response = await toolsApi.test(tool.id, argumentsJson, currentAgentId());
      setTestResult(JSON.stringify(response, null, 2));
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '调用失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard
      className={standalone ? undefined : 'xl:sticky xl:top-[18px]'}
      bodyClassName="flex flex-col gap-[16px]"
      title={(
        <span className="inline-flex items-center gap-[8px]">
          <ExperimentOutlined />
          {standalone ? '调用测试' : '已保存工具测试'}
        </span>
      )}
      extra={(
        <UIButton disabled={loading} onClick={() => void test()} className={PRIMARY_BUTTON_CLASS}>
          <ExperimentOutlined />
          调用
        </UIButton>
      )}
    >
      <div className="flex items-start justify-between gap-[12px] rounded-[12px] border border-[#eceef1] bg-[#fafbfc] px-[14px] py-[12px]">
        <span className="min-w-0 flex-1 wrap-break-word text-[13px] leading-[1.65] text-[#858b9c]">
          调用已保存的「{tool.display_name || tool.name}」，用于验证员工实际可用的工具返回。
        </span>
        <span className="shrink-0">
          <StatusBadge tone="gray">{toolTypeLabel(tool)}</StatusBadge>
        </span>
      </div>
      <div className="flex flex-col gap-[10px]">
        <span className={SUBSECTION_TITLE_CLASS}>测试参数</span>
        <Textarea
          rows={8}
          className={MONO_INPUT_CLASS}
          value={testJson}
          onChange={(event) => setTestJson(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-[10px]">
        <div className="flex items-center justify-between gap-[10px]">
          <span className={SUBSECTION_TITLE_CLASS}>调用结果</span>
          <StatusBadge tone={testResult ? 'green' : 'gray'}>{testResult ? '已返回' : '等待调用'}</StatusBadge>
        </div>
        {testResult ? (
          <CodeBlock className="max-h-[340px] whitespace-pre-wrap wrap-break-word" code={testResult} language="json" />
        ) : (
          <div className="grid min-h-[180px] place-items-center rounded-[12px] border border-dashed border-[#eceef1] p-[20px] text-center text-[13px] text-[#858b9c]">
            点击调用后，这里会显示工具返回、错误信息和原始 data。
          </div>
        )}
      </div>
    </SectionCard>
  );
}
