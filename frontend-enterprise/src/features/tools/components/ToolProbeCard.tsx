import { useState } from 'react';

import { toolsApi } from '@/api/endpoints/tools';
import { Textarea } from '@/components/ui';
import { Button as UIButton } from '@/components/ui/button';
import { notify } from '@/components/ui/app-toast';
import { ExperimentOutlined } from '@/icons';
import { buildToolPayload, parseJson } from '../lib/toolPayload';
import { SectionCard } from './SectionCard';
import { HINT_CLASS, MONO_INPUT_CLASS, RETURN_BUTTON_CLASS, SUBSECTION_TITLE_CLASS } from '../styles';
import type { ToolFormValues } from '../types';

export function ToolProbeCard({ values }: { values: ToolFormValues }) {
  const [sampleJson, setSampleJson] = useState('{}');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const method = values.method || 'POST';
  const isGetMethod = method === 'GET';

  async function probe() {
    if (!String(values.name || '').trim()) {
      notify.error('請填寫工具名稱');
      return;
    }
    if (!String(values.url || '').trim()) {
      notify.error('請填寫 URL');
      return;
    }
    const payload = buildToolPayload(values);
    if (!payload) return;
    let sampleArguments: Record<string, unknown>;
    try {
      sampleArguments = parseJson(sampleJson, {});
    } catch {
      notify.error('測試參數不是合法 JSON');
      return;
    }
    if (
      payload.tool_type === 'http'
      && payload.method !== 'GET'
      && payload.url.includes('?')
      && Object.keys(sampleArguments).length === 0
    ) {
      notify.error('URL 已包含查詢參數時請把 HTTP Method 切換為 GET；POST 會把測試參數作為 JSON Body 發送。');
      return;
    }
    setLoading(true);
    try {
      const response = await toolsApi.probe({
        name: payload.name,
        display_name: payload.display_name,
        description: payload.description,
        bucket: payload.bucket,
        tool_type: payload.tool_type,
        method: payload.method,
        url: payload.url,
        headers: payload.headers,
        auth: payload.auth,
        mcp_config: payload.mcp_config,
        input_schema: payload.input_schema,
        output_schema: payload.output_schema,
        sample_arguments: sampleArguments,
      });
      setResult(JSON.stringify(response, null, 2));
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '探測失敗');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard
      title="配置探測"
      bodyClassName="flex flex-col gap-[14px]"
      extra={(
        <UIButton variant="outline" disabled={loading} onClick={() => void probe()} className={RETURN_BUTTON_CLASS}>
          <ExperimentOutlined />
          探測
        </UIButton>
      )}
    >
      <p className={HINT_CLASS}>無需保存，直接用當前配置測試連接。</p>
      <div className="flex flex-col gap-[8px]">
        <span className={SUBSECTION_TITLE_CLASS}>
          {isGetMethod ? '測試參數 JSON（拼到 URL Query）' : '測試參數 JSON（作為請求 Body）'}
        </span>
        <p className={HINT_CLASS}>
          {isGetMethod
            ? 'GET 會把這裡的字段作為查詢參數追加到 URL；參數值填寫未編碼原文，例如 timezone 用 Asia/Shanghai。'
            : '非 GET 請求會把這裡的 JSON 作為請求體發送；僅 URL 查詢串不會變成請求 Body。'}
        </p>
        <Textarea
          rows={5}
          className={MONO_INPUT_CLASS}
          value={sampleJson}
          onChange={(event) => setSampleJson(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-[8px]">
        <span className={SUBSECTION_TITLE_CLASS}>探測結果</span>
        <Textarea rows={8} readOnly className={MONO_INPUT_CLASS} value={result} />
      </div>
    </SectionCard>
  );
}
