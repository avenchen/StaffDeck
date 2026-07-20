import { api, streamPost, TENANT_ID, type StreamEvent } from '../client';
import { qs } from './shared';
import type { KnowledgeBaseRead, KnowledgeChunkRead } from '@/types';

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
};
