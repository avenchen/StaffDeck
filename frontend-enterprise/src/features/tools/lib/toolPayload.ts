import { pinyin } from 'pinyin-pro';

import { TENANT_ID } from '@/api/client';
import { toolsApi } from '@/api/endpoints/tools';
import { notify } from '@/components/ui/app-toast';
import { ENTERPRISE_AGENT_STORAGE_KEY } from '@/lib/agent-scope-storage';
import type { ToolRead, MCPServerRead, MCPServerConnection, MCPTransport } from '@/types';
import { TOOL_FORM_INITIAL_VALUES, TRANSPORT_OPTIONS } from '../types';
import type { ToolFormValues, McpFormValues } from '../types';

export async function loadBucketOptions() {
  const rows = await toolsApi.list(currentAgentId());
  return Array.from(new Set(['未分桶', ...rows.map((row) => row.bucket || '未分桶')]))
    .map((value) => ({ value, label: value }));
}

export function currentAgentId(): string {
  return window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) || '';
}

export function toolToFormValues(row: ToolRead): ToolFormValues {
  return {
    ...TOOL_FORM_INITIAL_VALUES,
    ...row,
    bucket: row.bucket || '未分桶',
    tool_type: row.tool_type || 'http',
    headers: JSON.stringify(row.headers || {}, null, 2),
    auth: JSON.stringify(row.auth || {}, null, 2),
    mcp_config: JSON.stringify(row.mcp_config || {}, null, 2),
    input_schema: JSON.stringify(row.input_schema || {}, null, 2),
    output_schema: JSON.stringify(row.output_schema || {}, null, 2),
    allowed_skills: (row.allowed_skills || []).join(','),
  };
}

export function buildToolPayload(values: ToolFormValues) {
  try {
    return {
      tenant_id: TENANT_ID,
      name: String(values.name || '').trim(),
      display_name: values.display_name,
      description: values.description,
      bucket: values.bucket || '未分桶',
      tool_type: values.tool_type || 'http',
      method: values.method,
      url: String(values.url || '').trim(),
      headers: parseJson(values.headers, {}),
      auth: parseJson(values.auth, {}),
      mcp_config: values.tool_type === 'mcp' ? parseJson(values.mcp_config, {}) : {},
      input_schema: parseJson(values.input_schema, {}),
      output_schema: parseJson(values.output_schema, {}),
      allowed_skills: String(values.allowed_skills || '').split(',').map((item) => item.trim()).filter(Boolean),
      enabled: values.enabled,
    };
  } catch {
    notify.error('JSON 配置格式不正确，请检查 Headers、Auth、Schema 或 MCP Config');
    return null;
  }
}

export function buildBucketStats(rows: ToolRead[]) {
  const map = new Map<string, { bucket: string; total: number; enabled: number; disabled: number }>();
  rows.forEach((row) => {
    const bucket = row.bucket || '未分桶';
    const item = map.get(bucket) || { bucket, total: 0, enabled: 0, disabled: 0 };
    item.total += 1;
    if (row.enabled) item.enabled += 1;
    else item.disabled += 1;
    map.set(bucket, item);
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total || a.bucket.localeCompare(b.bucket));
}

export function parseJson<T>(value: string, fallback: T): T {
  if (!value) return fallback;
  return JSON.parse(value) as T;
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value || {}, null, 2);
}

export function schemaPropertyCount(schema: Record<string, unknown>): string {
  const properties = schema.properties && typeof schema.properties === 'object'
    ? schema.properties as Record<string, unknown>
    : {};
  return `${Object.keys(properties).length}`;
}

export function toolTypeLabel(tool: ToolRead): string {
  return tool.tool_type === 'mcp' ? 'MCP 服务' : 'HTTP 接口';
}

export function serverToFormValues(row: MCPServerRead): McpFormValues {
  const connection = row.connection;
  return {
    name: row.name,
    display_name: row.display_name || '',
    description: row.description || '',
    bucket: row.bucket || 'MCP 工具',
    transport: connection.transport,
    url: connection.url || '',
    headers: JSON.stringify(connection.headers || {}, null, 2),
    command: connection.command || '',
    args: (connection.args || []).join('\n'),
    env: JSON.stringify(connection.env || {}, null, 2),
    cwd: connection.cwd || '',
    enabled: row.enabled,
  };
}

export function parseArgs(value: string): string[] {
  const text = String(value || '');
  const parts = text.includes('\n') ? text.split('\n') : text.split(/\s+/);
  return parts.map((item) => item.trim()).filter(Boolean);
}

export function transportLabel(transport: MCPTransport | string): string {
  return TRANSPORT_OPTIONS.find((item) => item.value === transport)?.label || String(transport);
}

/**
 * 规范化 MCP 服务器名称（唯一标识）：
 * 中文自动转拼音（无声调），只保留字母/数字/下划线，其余转下划线，最长 15 字符。
 */
export function sanitizeMcpName(raw: string): string {
  const input = String(raw || '');
  // 含中文时先整体转拼音（不带声调），拼音之间用下划线连接。
  const converted = /[\u4e00-\u9fa5]/.test(input)
    ? pinyin(input, { toneType: 'none', type: 'array', nonZh: 'consecutive' }).join('_')
    : input;
  const normalized = converted
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+/, '');
  return normalized.slice(0, 15);
}

export function serverEndpoint(connection: MCPServerConnection): string {
  if (connection.transport === 'stdio') return connection.command || '—';
  if (connection.transport === 'builtin') return 'builtin.demo';
  return connection.url || '—';
}

export function exampleFromSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const properties = schema.properties && typeof schema.properties === 'object'
    ? schema.properties as Record<string, Record<string, unknown>>
    : {};
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [key, exampleValue(key, value)]),
  );
}

export function exampleValue(key: string, schema: Record<string, unknown>): unknown {
  if (schema.default !== undefined) return schema.default;
  if (schema.example !== undefined) return schema.example;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  if (schema.type === 'integer') return 1;
  if (schema.type === 'number') return 1;
  if (schema.type === 'boolean') return true;
  if (schema.type === 'array') return [];
  if (schema.type === 'object') return {};
  return `sample_${key}`;
}
