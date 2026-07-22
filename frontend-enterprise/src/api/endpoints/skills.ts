import { api, TENANT_ID } from '../client';
import { qs } from './shared';
import type { SkillRead, SkillVersionRead } from '@/types';

/**
 * Typed endpoints for the skill (SOP) domain. Callers pass the active agent id
 * (or undefined for the overall scope); query strings are assembled by qs(),
 * replacing the repeated `agent_id` suffix concatenation across SkillsPage and
 * DistillPage.
 */
export const skillsApi = {
  list: (agentId?: string) =>
    api.get<SkillRead[]>(
      `/api/enterprise/skills${qs({ tenant_id: TENANT_ID, agent_id: agentId })}`,
    ),
  get: (skillId: string, agentId?: string) =>
    api.get<SkillRead>(
      `/api/enterprise/skills/${encodeURIComponent(skillId)}${qs({
        tenant_id: TENANT_ID,
        agent_id: agentId,
      })}`,
    ),
  create: (body: unknown, agentId?: string) =>
    api.post<SkillRead>(`/api/enterprise/skills${qs({ agent_id: agentId })}`, body),
  update: (skillId: string, body: unknown, agentId?: string) =>
    api.put<SkillRead>(
      `/api/enterprise/skills/${encodeURIComponent(skillId)}${qs({ agent_id: agentId })}`,
      body,
    ),
  remove: (skillId: string, agentId?: string) =>
    api.delete(
      `/api/enterprise/skills/${encodeURIComponent(skillId)}${qs({
        tenant_id: TENANT_ID,
        agent_id: agentId,
      })}`,
    ),
  publish: (skillId: string, agentId?: string) =>
    api.post(
      `/api/enterprise/skills/${encodeURIComponent(skillId)}/publish${qs({
        tenant_id: TENANT_ID,
        agent_id: agentId,
      })}`,
    ),
  archive: (skillId: string, agentId?: string) =>
    api.post(
      `/api/enterprise/skills/${encodeURIComponent(skillId)}/archive${qs({
        tenant_id: TENANT_ID,
        agent_id: agentId,
      })}`,
    ),
  markDraft: (skillId: string, agentId?: string) =>
    api.post(
      `/api/enterprise/skills/${encodeURIComponent(skillId)}/draft${qs({
        tenant_id: TENANT_ID,
        agent_id: agentId,
      })}`,
    ),
  listVersions: (skillId: string, agentId?: string) =>
    api.get<SkillVersionRead[]>(
      `/api/enterprise/skills/${encodeURIComponent(skillId)}/versions${qs({
        tenant_id: TENANT_ID,
        agent_id: agentId,
      })}`,
    ),
  getVersion: (skillId: string, version: string, agentId?: string) =>
    api.get<SkillVersionRead>(
      `/api/enterprise/skills/${encodeURIComponent(skillId)}/versions/${encodeURIComponent(
        version,
      )}${qs({ tenant_id: TENANT_ID, agent_id: agentId })}`,
    ),
  deleteVersion: (skillId: string, version: string, agentId?: string) =>
    api.delete(
      `/api/enterprise/skills/${encodeURIComponent(skillId)}/versions/${encodeURIComponent(
        version,
      )}${qs({ tenant_id: TENANT_ID, agent_id: agentId })}`,
    ),
  rollbackVersion: (skillId: string, version: string, agentId?: string) =>
    api.post<SkillRead>(
      `/api/enterprise/skills/${encodeURIComponent(skillId)}/versions/${encodeURIComponent(
        version,
      )}/rollback${qs({ tenant_id: TENANT_ID, agent_id: agentId })}`,
    ),
  syncFromOverall: (agentId: string, skillId: string) =>
    api.post(
      `/api/enterprise/agents/${agentId}/skills/${encodeURIComponent(skillId)}/sync-from-overall${qs(
        { tenant_id: TENANT_ID },
      )}`,
    ),
  cancelJob: (jobId: string) =>
    api.post(`/api/enterprise/skills/jobs/${encodeURIComponent(jobId)}/cancel`),
};
