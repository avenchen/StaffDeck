import { api } from '../client';
import { qs } from './shared';
import type {
  AgentProfileRead,
  ChatMessage,
  ChatSession,
  ChatSessionEventRead,
  HumanHandoffRead,
  ScheduledTaskRead,
  TurnTraceRead,
  UIConfigRead,
} from '@/types';

/**
 * Typed endpoints for the chat runtime. Unlike the other domains, the chat
 * tenant is the authenticated user's tenant (which may differ from the build's
 * default TENANT_ID), so every call takes an explicit tenantId argument.
 */
export const chatApi = {
  listAgents: (tenantId: string) =>
    api.get<AgentProfileRead[]>(`/api/chat/agents${qs({ tenant_id: tenantId })}`),
  useAgent: (agentId: string, tenantId: string, body: unknown = {}) =>
    api.post<AgentProfileRead>(
      `/api/chat/agents/${agentId}/use${qs({ tenant_id: tenantId })}`,
      body,
    ),

  listSessions: (tenantId: string) =>
    api.get<ChatSession[]>(`/api/chat/sessions${qs({ tenant_id: tenantId })}`),
  sessionMessages: (sessionId: string, tenantId: string) =>
    api.get<ChatMessage[]>(
      `/api/chat/sessions/${sessionId}/messages${qs({ tenant_id: tenantId })}`,
    ),
  sessionTrace: (sessionId: string, tenantId: string) =>
    api.get<TurnTraceRead[]>(
      `/api/chat/sessions/${sessionId}/trace${qs({ tenant_id: tenantId })}`,
    ),
  sessionEvents: (sessionId: string, tenantId: string) =>
    api.get<ChatSessionEventRead[]>(
      `/api/chat/sessions/${sessionId}/events${qs({ tenant_id: tenantId })}`,
    ),
  renameSession: (sessionId: string, body: unknown) =>
    api.put<ChatSession>(`/api/chat/sessions/${sessionId}`, body),
  deleteSession: (sessionId: string, tenantId: string) =>
    api.delete(`/api/chat/sessions/${sessionId}${qs({ tenant_id: tenantId })}`),
  cancelSession: (sessionId: string, body: unknown) =>
    api.postKeepalive(`/api/chat/sessions/${sessionId}/cancel`, body),

  listHandoffs: (tenantId: string) =>
    api.get<HumanHandoffRead[]>(
      `/api/chat/handoffs${qs({ tenant_id: tenantId, status: 'pending' })}`,
    ),
  replyHandoff: (handoffId: string, body: unknown) =>
    api.post<HumanHandoffRead>(`/api/chat/handoffs/${handoffId}/reply`, body),

  uiConfig: (tenantId: string) =>
    api.get<UIConfigRead>(`/api/chat/ui-config${qs({ tenant_id: tenantId })}`),

  setMessageFeedback: (messageId: string, body: unknown) =>
    api.post(`/api/chat/messages/${messageId}/feedback`, body),
  clearMessageFeedback: (messageId: string, tenantId: string) =>
    api.delete(`/api/chat/messages/${messageId}/feedback${qs({ tenant_id: tenantId })}`),

  createScheduledTask: (body: unknown) =>
    api.post<ScheduledTaskRead>('/api/chat/scheduled-tasks', body),
};
