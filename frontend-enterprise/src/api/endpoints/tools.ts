import { api, TENANT_ID } from '../client';
import { qs } from './shared';
import type {
  MCPDiscoverResponse,
  MCPServerConnection,
  MCPServerRead,
  MCPSyncResponse,
  ToolRead,
} from '@/types';

/**
 * Typed endpoints for /api/enterprise/tools.
 *
 * `agentId` is the per-employee resource scope; omit it (or pass '') for the
 * overall gallery scope.
 */
export const toolsApi = {
  list: (agentId?: string) =>
    api.get<ToolRead[]>(`/api/enterprise/tools${qs({ tenant_id: TENANT_ID, agent_id: agentId })}`),
  get: (toolId: string, agentId?: string) =>
    api.get<ToolRead>(
      `/api/enterprise/tools/${toolId}${qs({ tenant_id: TENANT_ID, agent_id: agentId })}`,
    ),
  create: (payload: Record<string, unknown>, agentId?: string) =>
    api.post<ToolRead>(`/api/enterprise/tools${qs({ agent_id: agentId })}`, payload),
  update: (toolId: string, payload: Record<string, unknown>, agentId?: string) =>
    api.put<ToolRead>(`/api/enterprise/tools/${toolId}${qs({ agent_id: agentId })}`, payload),
  remove: (toolId: string, agentId?: string) =>
    api.delete(`/api/enterprise/tools/${toolId}${qs({ tenant_id: TENANT_ID, agent_id: agentId })}`),
  probe: (payload: Record<string, unknown>) =>
    api.post('/api/enterprise/tools/probe', { tenant_id: TENANT_ID, ...payload }),
  test: (toolId: string, args: Record<string, unknown>, agentId?: string) =>
    api.post(`/api/enterprise/tools/${toolId}/test${qs({ agent_id: agentId })}`, {
      tenant_id: TENANT_ID,
      arguments: args,
    }),
};

/** Typed endpoints for /api/enterprise/mcp-servers. */
export const mcpServersApi = {
  list: () => api.get<MCPServerRead[]>(`/api/enterprise/mcp-servers${qs({ tenant_id: TENANT_ID })}`),
  get: (serverId: string) =>
    api.get<MCPServerRead>(`/api/enterprise/mcp-servers/${serverId}${qs({ tenant_id: TENANT_ID })}`),
  create: (payload: Record<string, unknown>) =>
    api.post<MCPServerRead>('/api/enterprise/mcp-servers', payload),
  update: (serverId: string, payload: Record<string, unknown>) =>
    api.put<MCPServerRead>(`/api/enterprise/mcp-servers/${serverId}`, payload),
  remove: (serverId: string, options?: { agentId?: string; removeTools?: boolean }) =>
    api.delete(
      `/api/enterprise/mcp-servers/${serverId}${qs({
        tenant_id: TENANT_ID,
        agent_id: options?.agentId,
        remove_tools: options?.removeTools ? 'true' : undefined,
      })}`,
    ),
  discover: (connection: MCPServerConnection, serverId?: string) =>
    api.post<MCPDiscoverResponse>(
      serverId
        ? `/api/enterprise/mcp-servers/${serverId}/discover`
        : '/api/enterprise/mcp-servers/discover',
      { tenant_id: TENANT_ID, connection },
    ),
  sync: (serverId: string, toolNames: string[] | null, agentId?: string) =>
    api.post<MCPSyncResponse>(
      `/api/enterprise/mcp-servers/${serverId}/sync${qs({ agent_id: agentId })}`,
      { tenant_id: TENANT_ID, tool_names: toolNames },
    ),
};
