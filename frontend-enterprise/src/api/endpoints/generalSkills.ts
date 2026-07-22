import { api, TENANT_ID } from '../client';
import { qs } from './shared';
import type { GeneralSkillRead } from '@/types';

/**
 * Typed endpoints for the general-skill (skill plaza) domain, shared by the
 * general-skills list and editor pages. Query strings are assembled by qs(),
 * replacing the repeated `agent_id` suffix concatenation.
 */
export const generalSkillsApi = {
  list: (agentId?: string) =>
    api.get<GeneralSkillRead[]>(
      `/api/enterprise/general-skills${qs({ tenant_id: TENANT_ID, agent_id: agentId })}`,
    ),
  setStatus: (slug: string, published: boolean, agentId?: string) =>
    api.post<GeneralSkillRead>(
      `/api/enterprise/general-skills/${slug}/${published ? 'publish' : 'archive'}${qs({
        tenant_id: TENANT_ID,
        agent_id: agentId,
      })}`,
    ),
  remove: (slug: string, agentId?: string) =>
    api.delete(
      `/api/enterprise/general-skills/${slug}${qs({ tenant_id: TENANT_ID, agent_id: agentId })}`,
    ),
  import: (body: unknown) =>
    api.post<GeneralSkillRead>('/api/enterprise/general-skills/import', body),
  importSkillhub: (body: unknown, signal?: AbortSignal) =>
    api.postWithSignal<GeneralSkillRead>(
      '/api/enterprise/general-skills/import-skillhub',
      body,
      signal,
    ),
  importPackage: (body: unknown, signal?: AbortSignal) =>
    api.postWithSignal<GeneralSkillRead>(
      '/api/enterprise/general-skills/import-package',
      body,
      signal,
    ),
};
