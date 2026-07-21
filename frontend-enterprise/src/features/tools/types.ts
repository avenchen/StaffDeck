import type { EnterpriseAuthUser } from '@/auth';
import type { MCPTransport, MCPDiscoverResponse } from '@/types';

export type ToolPageProps = {
  currentUser?: EnterpriseAuthUser;
  onLogout?: () => void;
};

export const TOOL_PAGE_SIZE = 10;
export const TOOL_FORM_INITIAL_VALUES = {
  tool_type: 'http',
  method: 'POST',
  enabled: true,
  bucket: '未分桶',
  headers: '{}',
  auth: '{}',
  mcp_config: '{}',
  input_schema: '{}',
  output_schema: '{}',
};

export type ToolFormValues = typeof TOOL_FORM_INITIAL_VALUES & {
  name?: string;
  display_name?: string;
  description?: string;
  allowed_skills?: string;
  url?: string;
};

export const TRANSPORT_OPTIONS: { value: MCPTransport; label: string; hint: string }[] = [
  { value: 'streamable_http', label: 'Streamable HTTP', hint: '通过 HTTP(S) 连接远程 MCP Server' },
  { value: 'sse', label: 'SSE', hint: '通过 Server-Sent Events 连接远程 MCP Server' },
  { value: 'stdio', label: 'Stdio（本地命令）', hint: '启动本地进程并通过标准输入输出通信' },
  { value: 'builtin', label: '内置 Demo', hint: '使用内置的 builtin.demo MCP，仅用于演示' },
];

export type McpFormValues = {
  name: string;
  display_name: string;
  description: string;
  bucket: string;
  transport: MCPTransport;
  url: string;
  headers: string;
  command: string;
  args: string;
  env: string;
  cwd: string;
  enabled: boolean;
};

export const MCP_FORM_INITIAL_VALUES: McpFormValues = {
  name: '',
  display_name: '',
  description: '',
  bucket: 'MCP 工具',
  transport: 'streamable_http',
  url: '',
  headers: '{}',
  command: '',
  args: '',
  env: '{}',
  cwd: '',
  enabled: true,
};

export type DiscoveredRow = MCPDiscoverResponse['tools'][number] & { selected: boolean };
