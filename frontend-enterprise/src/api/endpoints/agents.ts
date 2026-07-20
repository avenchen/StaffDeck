import { api, TENANT_ID } from '../client';
import { qs } from './shared';
import type { AgentProfileRead } from '@/types';

export type ResourceImportResult = {
  imported: Array<Record<string, unknown>>;
  missing: Array<Record<string, unknown>>;
};

/** Typed endpoints for /api/enterprise/agents. */
export const agentsApi = {
  list: () => api.get<AgentProfileRead[]>(`/api/enterprise/agents${qs({ tenant_id: TENANT_ID })}`),
  importResources: (
    targetAgentId: string,
    body: {
      source_agent_id: string;
      resource_type: 'tool' | 'skill' | 'general_skill' | 'knowledge_base';
      resource_ids: string[];
    },
  ) =>
    api.post<ResourceImportResult>(`/api/enterprise/agents/${targetAgentId}/resources/import`, {
      tenant_id: TENANT_ID,
      ...body,
    }),
};
