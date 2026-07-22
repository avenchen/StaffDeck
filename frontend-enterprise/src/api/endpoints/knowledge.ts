import { api, streamPost, TENANT_ID, type StreamEvent } from '../client';
import { qs } from './shared';
import type {
  KnowledgeBaseRead,
  KnowledgeBucketRead,
  KnowledgeChunkRead,
  KnowledgeConceptRead,
  KnowledgeDiscoveryRead,
  KnowledgeDocumentRead,
  KnowledgeIngestJobRead,
  KnowledgeSearchResponse,
} from '@/types';

export type WikiBucketNode = {
  id: string;
  bucket_key: string;
  title: string;
  summary: string;
  token_estimate: number;
  chunk_count: number;
};

export type WikiDocumentNode = {
  id: string;
  title: string;
  filename: string;
  file_type: string;
  status: string;
  bucket_count: number;
  chunk_count: number;
  buckets: WikiBucketNode[];
};

export type WikiOutline = {
  knowledge_base_id: string;
  name: string;
  description?: string;
  document_count: number;
  bucket_count: number;
  chunk_count: number;
  documents: WikiDocumentNode[];
};

export type WikiCitation = {
  index: number;
  bucket_id?: string;
  document_id?: string;
  title: string;
  snippet: string;
  source_ref?: string;
};

export type WikiAskBody = {
  tenant_id: string;
  agent_id?: string;
  knowledge_base_id?: string;
  query: string;
  model_config_id?: string;
};

/** Typed endpoints for the knowledge-base Wiki view. */
export const knowledgeApi = {
  listBases: (agentId?: string) =>
    api.get<KnowledgeBaseRead[]>(
      `/api/enterprise/knowledge-bases${qs({ tenant_id: TENANT_ID, agent_id: agentId })}`,
    ),
  bucketChunks: (bucketId: string, agentId?: string) =>
    api.get<KnowledgeChunkRead[]>(
      `/api/enterprise/knowledge/buckets/${bucketId}/chunks${qs({
        tenant_id: TENANT_ID,
        agent_id: agentId,
      })}`,
    ),
  wikiOutline: (knowledgeBaseId: string, agentId?: string) =>
    api.get<WikiOutline>(
      `/api/enterprise/knowledge/wiki/${knowledgeBaseId}/outline${qs({
        tenant_id: TENANT_ID,
        agent_id: agentId,
      })}`,
    ),
  askWiki: (body: WikiAskBody, onEvent: (event: StreamEvent) => void, signal?: AbortSignal) =>
    streamPost('/api/enterprise/knowledge/wiki/ask', body, onEvent, signal),

  // --- Ingest jobs -------------------------------------------------------
  getJob: (jobId: string, agentId?: string) =>
    api.get<KnowledgeIngestJobRead>(
      `/api/enterprise/knowledge/jobs/${jobId}${qs({ tenant_id: TENANT_ID, agent_id: agentId })}`,
    ),
  listJobs: (agentId?: string, limit = 8) =>
    api.get<KnowledgeIngestJobRead[]>(
      `/api/enterprise/knowledge/jobs${qs({ tenant_id: TENANT_ID, agent_id: agentId, limit })}`,
    ),
  cancelJob: (jobId: string) =>
    api.post<KnowledgeIngestJobRead>(
      `/api/enterprise/knowledge/jobs/${jobId}/cancel${qs({ tenant_id: TENANT_ID })}`,
    ),
  uploadDocument: (
    body: { tenant_id: string; filename: string; title: string; content_base64: string },
    agentId?: string,
  ) =>
    api.post<KnowledgeIngestJobRead>(
      `/api/enterprise/knowledge/documents${qs({ agent_id: agentId })}`,
      body,
    ),

  // --- Discoveries -------------------------------------------------------
  listDiscoveries: (agentId?: string) =>
    api.get<KnowledgeDiscoveryRead[]>(
      `/api/enterprise/knowledge/discoveries${qs({ tenant_id: TENANT_ID, agent_id: agentId })}`,
    ),
  confirmDiscovery: (discoveryId: string) =>
    api.post(
      `/api/enterprise/knowledge/discoveries/${discoveryId}/confirm${qs({ tenant_id: TENANT_ID })}`,
    ),
  rejectDiscovery: (discoveryId: string) =>
    api.post(
      `/api/enterprise/knowledge/discoveries/${discoveryId}/reject${qs({ tenant_id: TENANT_ID })}`,
    ),

  // --- Documents / buckets / chunks --------------------------------------
  listDocuments: (agentId?: string) =>
    api.get<KnowledgeDocumentRead[]>(
      `/api/enterprise/knowledge/documents${qs({ tenant_id: TENANT_ID, agent_id: agentId })}`,
    ),
  documentBuckets: (documentId: string, agentId?: string) =>
    api.get<KnowledgeBucketRead[]>(
      `/api/enterprise/knowledge/documents/${documentId}/buckets${qs({
        tenant_id: TENANT_ID,
        agent_id: agentId,
      })}`,
    ),
  updateDocument: (documentId: string, body: unknown) =>
    api.put<KnowledgeDocumentRead>(
      `/api/enterprise/knowledge/documents/${documentId}`,
      body,
    ),
  updateBucket: (bucketId: string, body: unknown) =>
    api.put<KnowledgeBucketRead>(`/api/enterprise/knowledge/buckets/${bucketId}`, body),
  updateChunk: (chunkId: string, body: unknown) =>
    api.put<KnowledgeChunkRead>(`/api/enterprise/knowledge/chunks/${chunkId}`, body),
  search: (body: unknown) =>
    api.post<KnowledgeSearchResponse>('/api/enterprise/knowledge/search', body),

  // --- Knowledge bases (OKF, versions, lifecycle) ------------------------
  okfConcepts: (knowledgeBaseId: string, agentId?: string) =>
    api.get<KnowledgeConceptRead[]>(
      `/api/enterprise/knowledge-bases/${knowledgeBaseId}/okf/concepts${qs({
        tenant_id: TENANT_ID,
        agent_id: agentId,
      })}`,
    ),
  updateOkfConcept: (
    knowledgeBaseId: string,
    conceptPath: string,
    body: unknown,
    agentId?: string,
  ) =>
    api.put<KnowledgeConceptRead>(
      `/api/enterprise/knowledge-bases/${knowledgeBaseId}/okf/concepts/${conceptPath}${qs({
        agent_id: agentId,
      })}`,
      body,
    ),
  importOkf: (body: unknown) =>
    api.post('/api/enterprise/knowledge/okf/import', body),
  exportOkf: (knowledgeBaseId: string, agentId?: string) =>
    api.blob(
      `/api/enterprise/knowledge-bases/${knowledgeBaseId}/okf/export${qs({
        tenant_id: TENANT_ID,
        agent_id: agentId,
      })}`,
    ),
  lintOkf: <T>(knowledgeBaseId: string, agentId?: string) =>
    api.post<T>(
      `/api/enterprise/knowledge-bases/${knowledgeBaseId}/okf/lint${qs({
        tenant_id: TENANT_ID,
        agent_id: agentId,
      })}`,
    ),
  updateBase: (knowledgeBaseId: string, body: unknown, agentId?: string) =>
    api.put<KnowledgeBaseRead>(
      `/api/enterprise/knowledge-bases/${knowledgeBaseId}${qs({ agent_id: agentId })}`,
      body,
    ),
  deleteBase: (knowledgeBaseId: string, agentId?: string) =>
    api.delete(
      `/api/enterprise/knowledge-bases/${knowledgeBaseId}${qs({
        tenant_id: TENANT_ID,
        agent_id: agentId,
      })}`,
    ),
  listBaseVersions: <T>(knowledgeBaseId: string, agentId?: string) =>
    api.get<T>(
      `/api/enterprise/knowledge-bases/${knowledgeBaseId}/versions${qs({
        tenant_id: TENANT_ID,
        agent_id: agentId,
      })}`,
    ),
  syncFromOverall: (knowledgeBaseId: string, agentId: string) =>
    api.post(
      `/api/enterprise/knowledge-bases/${knowledgeBaseId}/sync-from-overall${qs({
        tenant_id: TENANT_ID,
        agent_id: agentId,
      })}`,
    ),
  promoteToOverall: (knowledgeBaseId: string, agentId: string) =>
    api.post(
      `/api/enterprise/knowledge-bases/${knowledgeBaseId}/promote-to-overall${qs({
        tenant_id: TENANT_ID,
        agent_id: agentId,
      })}`,
    ),
  rollbackBase: (knowledgeBaseId: string, body: unknown) =>
    api.post<KnowledgeBaseRead>(
      `/api/enterprise/knowledge-bases/${knowledgeBaseId}/rollback`,
      body,
    ),
};
