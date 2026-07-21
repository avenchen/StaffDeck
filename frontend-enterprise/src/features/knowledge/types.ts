import type { EnterpriseAuthUser } from '@/auth';

export const KNOWLEDGE_PAGE_SIZE = 10;
export const KNOWLEDGE_SEARCH_MODEL_STORAGE_KEY = 'knowledge-search-model';
export const TERMINAL_KNOWLEDGE_JOB_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);

export type KnowledgeBaseVersionRead = {
  id: string;
  version: string;
  name: string;
  description?: string;
  status: string;
  is_head: boolean;
  is_base: boolean;
  updated_at: string;
  created_at: string;
};

export type IngestStepView = {
  key: string;
  label: string;
  progress: number;
  status: 'pending' | 'running' | 'done';
};

export type OkfLintIssue = {
  issue_type?: string;
  title?: string;
  message?: string;
  concept_id?: string;
  concept_type?: string;
  document_id?: string;
};

export const DEFAULT_INGEST_STEPS: IngestStepView[] = [
  { key: 'queued', label: '排隊中', progress: 0, status: 'pending' },
  { key: 'parsing', label: '解析原始資料', progress: 0.08, status: 'pending' },
  { key: 'normalizing', label: '規範化原始資料', progress: 0.16, status: 'pending' },
  { key: 'documenting', label: '寫入文檔頁', progress: 0.24, status: 'pending' },
  { key: 'bucketing', label: '規劃知識圖譜', progress: 0.36, status: 'pending' },
  { key: 'bucket_writing', label: '寫入知識圖譜', progress: 0.48, status: 'pending' },
  { key: 'chunking', label: '生成引用來源', progress: 0.62, status: 'pending' },
  { key: 'summarizing', label: '刷新 目錄索引', progress: 0.74, status: 'pending' },
  { key: 'discovering', label: '發現 SOP/工具', progress: 0.88, status: 'pending' },
  { key: 'done', label: '完成入庫', progress: 1, status: 'pending' },
];

export type KnowledgePageProps = {
  currentUser?: EnterpriseAuthUser;
  onLogout?: () => void;
};
