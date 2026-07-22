import { api, TENANT_ID } from '../client';
import { qs } from './shared';
import type { AgentVisibilityRead, DepartmentRead } from '@/types';

/** Typed endpoints for departments and per-agent visibility. */
export const departmentsApi = {
  list: () =>
    api.get<DepartmentRead[]>(`/api/enterprise/departments${qs({ tenant_id: TENANT_ID })}`),
  create: (body: { name: string; parent_id?: string | null }) =>
    api.post<DepartmentRead>('/api/enterprise/departments', {
      tenant_id: TENANT_ID,
      ...body,
    }),
  update: (id: string, body: { name?: string; parent_id?: string | null }) =>
    api.put<DepartmentRead>(`/api/enterprise/departments/${id}`, {
      tenant_id: TENANT_ID,
      ...body,
    }),
  remove: (id: string) =>
    api.delete(`/api/enterprise/departments/${id}${qs({ tenant_id: TENANT_ID })}`),

  agentVisibility: (agentId: string) =>
    api.get<AgentVisibilityRead>(
      `/api/enterprise/agents/${agentId}/visibility${qs({ tenant_id: TENANT_ID })}`,
    ),
  setAgentVisibility: (
    agentId: string,
    body: {
      all?: boolean;
      same_department?: boolean;
      department_ids?: string[];
      user_ids?: string[];
    },
  ) =>
    api.put<AgentVisibilityRead>(`/api/enterprise/agents/${agentId}/visibility`, {
      tenant_id: TENANT_ID,
      ...body,
    }),
};
