import {
  AuditOutlined,
  CheckOutlined,
  CloseOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileAddOutlined,
  FileMarkdownOutlined,
  HistoryOutlined,
  InboxOutlined,
  MoreOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RightOutlined,
  TeamOutlined,
} from '@/icons';
import type { HTMLAttributes, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError, TENANT_ID } from '@/api/client';
import { isEnterpriseAdmin, type EnterpriseAuthUser } from '@/auth';
import AppHeader from '@/components/AppHeader';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { ModelConfigDropdown } from '@/components/ModelConfigDropdown';
import { Paginator } from '@/components/Paginator';
import { ResourceImportDialog } from '@/components/ResourceImportDialog';
import { StatCard } from '@/components/StatCard';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Progress,
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui';
import { Button as UIButton } from '@/components/ui/button';
import { notify } from '@/components/ui/app-toast';
import { cn } from '@/lib/utils';
import { DIALOG_CANCEL_BUTTON_CLASS, DIALOG_FOOTER_CLASS, DIALOG_PRIMARY_BUTTON_CLASS, MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_ITEM_DANGER_CLASS, MOBILE_CARD_CLASS, OUTLINE_ACTION_BUTTON_CLASS, OUTLINE_ACTION_BUTTON_SM_CLASS, SEARCH_COMBO_BUTTON_CLASS, SEARCH_COMBO_CLASS, SEARCH_COMBO_INPUT_CLASS, SELECT_TRIGGER_CLASS } from '@/lib/enterprise-ui';
import {
  clearSharedAgentScope,
  emitAgentScopeChange,
  ENTERPRISE_AGENT_STORAGE_KEY,
  persistSharedAgentScope,
} from '@/lib/agent-scope-storage';
import IconAdd from '@/assets/icons/add.svg?react';
import IconChevronDown from '@/assets/icons/chevron-down.svg?react';
import IconClear from '@/assets/icons/field-clear.svg?react';
import IconFolder from '@/assets/icons/cap-folder.svg?react';
import IconRefresh from '@/assets/icons/refresh.svg?react';
import IconSearch from '@/assets/icons/search.svg?react';
import {
  canManageEmployeeAgent,
  openGalleryAgentId,
  openGalleryImportSourceOptions,
  resourceCreatorName,
  visibleEmployeeAgents,
} from '@/employee';
import { useClientPagination } from '@/hooks/useClientPagination';
import { renderMarkdownBlocks } from '@/pages/chat/chatHelpers';
import { getDateLocale } from '@/i18n';
import type {
  KnowledgeBaseRead,
  KnowledgeBucketRead,
  KnowledgeChunkRead,
  KnowledgeConceptRead,
  KnowledgeDiscoveryRead,
  KnowledgeDocumentRead,
  KnowledgeIngestJobRead,
  KnowledgeSearchResponse,
  AgentProfileRead,
  ModelConfigRead,
} from '@/types';

import { DEFAULT_INGEST_STEPS, IngestStepView, KNOWLEDGE_PAGE_SIZE, KNOWLEDGE_SEARCH_MODEL_STORAGE_KEY, KnowledgeBaseVersionRead, KnowledgePageProps, OkfLintIssue, TERMINAL_KNOWLEDGE_JOB_STATUSES } from './types';

export function resolveKnowledgeAgentScope(
  rows: AgentProfileRead[],
  currentUser: EnterpriseAuthUser | undefined,
  currentAgentId: string,
): string {
  const currentAgent = rows.find((item) => item.id === currentAgentId);
  if (currentAgent) {
    if (!currentAgent.is_overall || isEnterpriseAdmin(currentUser)) return currentAgent.id;
  }
  if (isEnterpriseAdmin(currentUser)) return '';
  return visibleEmployeeAgents(rows, currentUser, { activeOnly: true })[0]?.id || '';
}

export function effectiveKnowledgeAgentId(rows: AgentProfileRead[], agentId: string): string {
  const agent = rows.find((item) => item.id === agentId);
  return agent && !agent.is_overall ? agent.id : '';
}

export function KnowledgeJobCard({
  job,
  cancelling,
  onCancel,
}: {
  job: KnowledgeIngestJobRead;
  cancelling?: boolean;
  onCancel?: (job: KnowledgeIngestJobRead) => void;
}) {
  const steps = ingestSteps(job);
  const metadata = job.metadata || {};
  const stageLabel = stringFromMetadata(metadata.stage_label) || stageLabelFallback(job.stage);
  const stageDetail = stringFromMetadata(metadata.stage_detail);
  const cancellable = ['queued', 'running'].includes(job.status);
  return (
    <div className="knowledge-job">
      <div className="knowledge-job-head">
        <div>
          <strong className="text-[14px] font-semibold text-foreground">{job.filename}</strong>
          <span className="text-[13px] text-[#858b9c]"> · {stageLabel}</span>
        </div>
        <div className="flex shrink-0 items-center gap-[8px]">
          {statusTag(job.status)}
          {cancellable && onCancel && (
            <UIButton
              type="button"
              variant="outline"
              size="sm"
              className={OUTLINE_ACTION_BUTTON_SM_CLASS}
              disabled={cancelling}
              onClick={() => onCancel(job)}
            >
              <CloseOutlined />
              {cancelling ? '取消中' : '取消'}
            </UIButton>
          )}
        </div>
      </div>
      <SmoothProgress job={job} />
      <div className="knowledge-stage-track">
        {steps.map((step) => (
          <div className={`knowledge-stage-step is-${step.status}`} key={step.key}>
            <span />
            <small>{step.label}</small>
          </div>
        ))}
      </div>
      {stageDetail && <span className="knowledge-job-detail text-[13px] text-[#858b9c]">{stageDetail}</span>}
      {job.error && <span className="text-[13px] text-[#d20b0b]">{job.error}</span>}
    </div>
  );
}

export function knowledgeJobSortTime(job: KnowledgeIngestJobRead): number {
  const createdAt = Date.parse(job.created_at || '');
  if (Number.isFinite(createdAt)) return createdAt;
  const updatedAt = Date.parse(job.updated_at || '');
  return Number.isFinite(updatedAt) ? updatedAt : 0;
}

export function SmoothProgress({ job }: { job: KnowledgeIngestJobRead }) {
  const target = Math.max(0, Math.min(100, Math.round((job.progress || 0) * 100)));
  const [displayProgress, setDisplayProgress] = useState(target);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDisplayProgress((current) => {
        if (current === target) return current;
        const diff = target - current;
        const step = Math.max(1, Math.ceil(Math.abs(diff) / 14));
        return current + Math.sign(diff) * Math.min(Math.abs(diff), step);
      });
    }, 80);
    return () => window.clearInterval(timer);
  }, [target]);

  const failed = job.status === 'failed';
  const cancelled = job.status === 'cancelled';
  const cancelling = job.status === 'cancel_requested';
  const indicatorClassName = failed
    ? 'bg-[#d20b0b]'
    : cancelled
      ? 'bg-[#9aa3b2]'
      : cancelling
        ? 'bg-[#d29a0b]'
        : 'bg-gradient-to-r from-[#0f7f74] to-[#16a34a]';
  const valueClassName = failed ? 'text-[#d20b0b]' : 'text-[#858b9c]';
  return (
    <div className="flex items-center gap-[10px]">
      <Progress
        value={displayProgress}
        className="h-[8px] flex-1"
        indicatorClassName={indicatorClassName}
      />
      <span className={cn('text-[12px] tabular-nums', valueClassName)}>
        {displayProgress}%
      </span>
    </div>
  );
}

export function ingestSteps(job: KnowledgeIngestJobRead): IngestStepView[] {
  const raw = (job.metadata || {}).ingest_steps;
  if (Array.isArray(raw)) {
    return raw.map((item, index) => {
      const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const status = record.status === 'running' || record.status === 'done' ? record.status : 'pending';
      return {
        key: String(record.key || `step_${index}`),
        label: String(record.label || DEFAULT_INGEST_STEPS[index]?.label || `階段 ${index + 1}`),
        progress: Number(record.progress || 0),
        status,
      };
    });
  }
  const currentProgress = job.progress || 0;
  if (job.status === 'cancelled' || job.stage === 'cancelled') {
    return DEFAULT_INGEST_STEPS.map((step) => ({
      ...step,
      status: step.progress < currentProgress ? 'done' : 'pending',
    }));
  }
  return DEFAULT_INGEST_STEPS.map((step) => ({
    ...step,
    status:
      job.stage === step.key
        ? 'running'
        : step.progress < currentProgress || job.stage === 'done'
        ? 'done'
        : 'pending',
  }));
}

export function stageLabelFallback(stage: string): string {
  return DEFAULT_INGEST_STEPS.find((item) => item.key === stage)?.label || stage || '處理中';
}

export function stringFromMetadata(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function normalizeMarkdownForDisplay(markdown: string): string {
  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+(#{1,6}\s+)/g, '\n\n$1')
    .trim();
}

export function documentSourceMarkdown(document: KnowledgeDocumentRead, fallback: string): string {
  const metadata = document.metadata || {};
  const rawText = stringFromMetadata(metadata.raw_text) || stringFromMetadata(metadata.content);
  if (rawText.trim()) return rawText;
  const sectionTree = Array.isArray(metadata.section_tree) ? metadata.section_tree : [];
  const sourceBlocks = sectionTree
    .map((node) => {
      if (!isRecord(node)) return '';
      const content = stringFromMetadata(node.content).trim();
      if (content) return content;
      const title = stringFromMetadata(node.title).trim();
      const summary = stringFromMetadata(node.summary).trim();
      if (title && summary) return `## ${title}\n\n${summary}`;
      return title || summary;
    })
    .filter(Boolean);
  return sourceBlocks.length ? sourceBlocks.join('\n\n') : fallback;
}

export type KnowledgeDetailView = 'document' | 'sections' | 'wiki' | 'evidence';
export type KnowledgeContentView = 'sections' | 'wiki' | 'evidence';
export const STRUCTURE_PREVIEW_LIMIT = 8;
export const OKF_PREVIEW_LIMIT = 8;

export type WikiIndexGroup = {
  key: string;
  title: string;
  description: string;
  concepts: KnowledgeConceptRead[];
};

export type KnowledgeOverviewItem = {
  key: string;
  title: string;
  summary: string;
  concept?: KnowledgeConceptRead;
  indexGroup?: WikiIndexGroup;
  bucket?: KnowledgeBucketRead;
};

export function 目錄索引Overview({
  document,
  knowledgeBase,
  buckets,
  okfConcepts,
  onEditDocument,
  onEditBucket,
  onViewConcept,
  onEditConcept,
}: {
  document: KnowledgeDocumentRead;
  knowledgeBase: KnowledgeBaseRead | null;
  buckets: KnowledgeBucketRead[];
  okfConcepts: KnowledgeConceptRead[];
  onEditDocument: (document: KnowledgeDocumentRead) => void;
  onEditBucket: (bucket: KnowledgeBucketRead) => void;
  onViewConcept: (concept: KnowledgeConceptRead) => void;
  onEditConcept: (concept: KnowledgeConceptRead) => void;
}) {
  const [detailView, setDetailView] = useState<KnowledgeDetailView | null>(null);
  const [detailFocusKey, setDetailFocusKey] = useState<string | null>(null);
  const [activeContentView, setActiveContentView] = useState<KnowledgeContentView>('evidence');
  const metadata = document.metadata || {};
  const documentCard = isRecord(metadata.document_card) ? metadata.document_card : {};
  const wikiStructureConcepts = useMemo(() => sortWikiConcepts(okfConcepts), [okfConcepts]);
  const wikiIndexGroups = useMemo(() => buildWikiIndexGroups(wikiStructureConcepts), [wikiStructureConcepts]);
  const previewWikiStructure = wikiIndexGroups.slice(0, STRUCTURE_PREVIEW_LIMIT);
  const previewConcepts = okfConcepts.slice(0, OKF_PREVIEW_LIMIT);
  const documentTitle = String(documentCard.title || document.title || knowledgeBase?.name || document.filename);
  const documentSummary = String(documentCard.summary || '暫無文檔摘要');
  const sourceMarkdown = useMemo(() => documentSourceMarkdown(document, documentSummary), [document, documentSummary]);
  const totalChunkCount = buckets.reduce((sum, bucket) => sum + (bucket.chunk_count || 0), 0) || document.chunk_count || 0;
  const evidenceBuckets = useMemo(
    () => buckets.filter((bucket) => bucket.chunk_count > 0 || bucketContentMarkdown(bucket).trim()),
    [buckets],
  );
  const previewEvidence = useMemo(
    () => previewEvidenceItems(buckets, totalChunkCount, OKF_PREVIEW_LIMIT),
    [buckets, totalChunkCount],
  );
  const openDetail = (view: KnowledgeDetailView, focusKey?: string) => {
    setDetailFocusKey(focusKey || null);
    setDetailView(view);
  };
  const openContentDetail = (view: KnowledgeContentView, focusKey?: string) => {
    if (view === 'sections') {
      openDetail('sections', focusKey);
      return;
    }
    openDetail(view, focusKey);
  };

  useEffect(() => {
    if (!detailView || !detailFocusKey) return;
    const timer = window.setTimeout(() => {
      const targets = Array.from(window.document.querySelectorAll<HTMLElement>('.knowledge-detail-modal .knowledge-detail-target'));
      const target = targets.find((item) => item.dataset.detailKey === detailFocusKey);
      if (!target) return;
      target.scrollIntoView({ block: 'start', behavior: 'auto' });
      target.classList.add('is-focused');
      window.setTimeout(() => target.classList.remove('is-focused'), 1500);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [detailView, detailFocusKey]);

  const overviewContent: Record<
    KnowledgeContentView,
    {
      title: string;
      description: string;
      count: number;
      emptyText: string;
      items: KnowledgeOverviewItem[];
    }
  > = {
    sections: {
      title: '目錄索引',
      description: '按目錄結構組織知識範圍，先看主題，再進入知識圖譜。',
      count: wikiIndexGroups.length,
      emptyText: '暫無目錄索引',
      items: previewWikiStructure.map((group) => ({
        key: group.key,
        title: group.title,
        summary: group.description,
        indexGroup: group,
      })),
    },
    wiki: {
      title: '知識圖譜',
      description: '可讀知識頁，用於長期沉澱、跨文檔綜合和數字員工複製。',
      count: okfConcepts.length,
      emptyText: '暫無知識圖譜',
      items: previewConcepts.map((concept) => ({
        key: concept.id,
        title: concept.title || concept.concept_id,
        summary: `${conceptTypeLabel(concept.concept_type)} · ${concept.description || concept.concept_id}`,
        concept,
      })),
    },
    evidence: {
      title: '引用來源',
      description: '保留切片內容、原文片段和來源路徑，用於回答溯源。',
      count: totalChunkCount,
      emptyText: '暫無引用來源',
      items: previewEvidence,
    },
  };
  const activeContent = overviewContent[activeContentView];

  return (
    <div className="knowledge-pageindex">
      <div className="knowledge-pageindex-card">
        <div className="knowledge-document-card-body">
          <span className="text-[13px] text-[#858b9c]">文檔卡片</span>
          <h5 className="my-[4px] text-[15px] font-semibold text-foreground">{documentTitle}</h5>
          <div className="knowledge-document-card-markdown is-preview">
            <MarkdownPreview markdown={documentSummary} />
          </div>
        </div>
        <div className="knowledge-pageindex-actions">
          <UIButton variant="outline" className={OUTLINE_ACTION_BUTTON_SM_CLASS} onClick={() => openDetail('document')}>
            <EditOutlined />
            詳情
          </UIButton>
        </div>
        <div className="knowledge-document-meta">
          <button type="button" className="knowledge-stat-pill" onClick={() => openDetail('document')}>
            <span>格式</span>
            <strong>{document.file_type || 'unknown'}</strong>
          </button>
          <button
            type="button"
            className={`knowledge-stat-pill ${activeContentView === 'sections' ? 'is-active' : ''}`}
            aria-pressed={activeContentView === 'sections'}
            onClick={() => setActiveContentView('sections')}
          >
            <span>目錄索引</span>
            <strong>{wikiIndexGroups.length}</strong>
          </button>
          <button
            type="button"
            className={`knowledge-stat-pill ${activeContentView === 'wiki' ? 'is-active' : ''}`}
            aria-pressed={activeContentView === 'wiki'}
            onClick={() => setActiveContentView('wiki')}
          >
            <span>知識圖譜</span>
            <strong>{okfConcepts.length}</strong>
          </button>
          <button
            type="button"
            className={`knowledge-stat-pill ${activeContentView === 'evidence' ? 'is-active' : ''}`}
            aria-pressed={activeContentView === 'evidence'}
            onClick={() => setActiveContentView('evidence')}
          >
            <span>引用來源</span>
            <strong>{totalChunkCount}</strong>
          </button>
        </div>
      </div>

      <div className="knowledge-overview-panel">
        <div className="knowledge-overview-panel-head">
          <span>
            <strong>{activeContent.title}</strong>
            <small>{activeContent.description}</small>
          </span>
          <div className="flex items-center gap-[8px]">
            <KTag>{activeContent.count}</KTag>
            <button
              type="button"
              className="text-[13px] text-[#1a71ff] transition-colors hover:text-[#4a8dff]"
              onClick={() => openContentDetail(activeContentView)}
            >
              查看全部
            </button>
          </div>
        </div>
        {activeContentView === 'sections' && (
          <div className="knowledge-layer-explain" aria-label="知識層級說明">
            <span>
              <strong>目錄索引</strong>
              <small>目錄索引，用於按資料、章節、主題逐級展開</small>
            </span>
            <span>
              <strong>知識圖譜</strong>
              <small>最底層可讀知識頁，回答時基於頁面內容並追溯引用來源</small>
            </span>
          </div>
        )}
        <div className="knowledge-mini-list">
          {activeContent.items.length === 0 ? (
            <span className="knowledge-empty-note">{activeContent.emptyText}</span>
          ) : (
            activeContent.items.map((entry) => (
              <button
                type="button"
                className="knowledge-mini-item"
                key={`${activeContentView}-${entry.key}`}
                onClick={() => {
                  if (activeContentView === 'sections' && entry.indexGroup) {
                    openContentDetail('sections', entry.indexGroup.key);
                    return;
                  }
                  if ((activeContentView === 'sections' || activeContentView === 'wiki') && entry.concept) {
                    onViewConcept(entry.concept);
                    return;
                  }
                  if (activeContentView === 'evidence' && entry.bucket) {
                    openContentDetail('evidence', entry.bucket.id);
                    return;
                  }
                  openContentDetail(activeContentView, entry.key);
                }}
                title={
                  activeContentView === 'sections' && entry.indexGroup
                    ? '查看目錄下的知識圖譜'
                    : (activeContentView === 'sections' || activeContentView === 'wiki') && entry.concept
                      ? '查看知識圖譜'
                      : activeContentView === 'evidence'
                        ? '查看引用來源'
                      : '查看詳情'
                }
              >
                <strong>{entry.title}</strong>
                <small>{entry.summary}</small>
              </button>
            ))
          )}
        </div>
      </div>

      <KDialog
        open={Boolean(detailView)}
        title={knowledgeDetailTitle(detailView)}
        width={detailView === 'sections' ? 'min(1240px, calc(100vw - 56px))' : 920}
        className={`knowledge-detail-modal${detailView === 'sections' ? ' knowledge-detail-modal-sections' : ''}`}
        onClose={() => setDetailView(null)}
      >
        {detailView === 'document' && (
          <div className="knowledge-detail-stack">
            <div className="knowledge-detail-header">
              <div>
                <span className="text-[13px] text-[#858b9c]">文檔卡片</span>
                <h4 className="my-[4px] text-[16px] font-semibold text-foreground">{documentTitle}</h4>
              </div>
              <UIButton variant="outline" className={OUTLINE_ACTION_BUTTON_SM_CLASS} onClick={() => onEditDocument(document)}>
                <EditOutlined />
                修改
              </UIButton>
            </div>
            <section className="knowledge-document-md-panel">
              <div className="knowledge-document-md-panel-head">
                <strong>文檔卡片</strong>
                <KTag>{document.file_type || 'unknown'}</KTag>
              </div>
              <div className="knowledge-document-md-scroll is-summary">
                <MarkdownPreview markdown={documentSummary} />
              </div>
            </section>
            <section className="knowledge-document-md-panel">
              <div className="knowledge-document-md-panel-head">
                <strong>原始資料</strong>
                <KTag>{Array.isArray(metadata.section_tree) ? metadata.section_tree.length : 0} 段</KTag>
              </div>
              <div className="knowledge-document-md-scroll is-source">
                <MarkdownPreview markdown={sourceMarkdown || '暫無原始資料'} />
              </div>
            </section>
            <div className="knowledge-evidence-stat is-inline">
              <strong>{document.file_type || 'unknown'}</strong>
              <span>文件格式</span>
            </div>
            <div className="knowledge-document-meta">
              <button type="button" className="knowledge-stat-pill" onClick={() => openDetail('sections')}>
                <span>目錄索引</span>
                <strong>{wikiIndexGroups.length}</strong>
              </button>
              <button type="button" className="knowledge-stat-pill" onClick={() => openDetail('wiki')}>
                <span>知識圖譜</span>
                <strong>{okfConcepts.length}</strong>
              </button>
              <button type="button" className="knowledge-stat-pill" onClick={() => openDetail('evidence')}>
                <span>引用來源</span>
                <strong>{totalChunkCount}</strong>
              </button>
            </div>
          </div>
        )}

        {detailView === 'sections' && (
          <div className="knowledge-wiki-map">
            {wikiIndexGroups.length === 0 ? (
              <EmptyState description="暫無 目錄索引 目錄" />
            ) : (
              wikiIndexGroups.map((group) => (
                <section
                  className="knowledge-wiki-map-card knowledge-index-group knowledge-detail-target"
                  key={group.key}
                  data-detail-key={group.key}
                >
                  <div className="knowledge-index-group-head">
                    <div>
                      <KTag color="green">目錄索引</KTag>
                      <strong>{group.title}</strong>
                      <small>{group.description}</small>
                    </div>
                    <KTag>{group.concepts.length} 頁</KTag>
                  </div>
                  <div className="knowledge-index-page-list">
                    {group.concepts.slice(0, 8).map((concept) => (
                      <button type="button" key={concept.id} onClick={() => onViewConcept(concept)}>
                        <span>{concept.title || concept.concept_id}</span>
                        <small>{conceptTypeLabel(concept.concept_type)} · {concept.description || concept.concept_id}</small>
                      </button>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        )}

        {detailView === 'evidence' && (
          <div className="knowledge-concept-list">
            {evidenceBuckets.length === 0 ? (
              <EmptyState description="暫無引用來源" />
            ) : (
              evidenceBuckets.map((bucket) => {
                const contentMarkdown = bucketContentMarkdown(bucket);
                return (
                  <section
                    className="knowledge-concept-card knowledge-detail-target"
                    key={bucket.id}
                    data-detail-key={bucket.id}
                  >
                    <div className="knowledge-concept-card-head">
                      <div>
                        <div className="flex flex-wrap items-center gap-[8px]">
                          <KTag color="green">引用來源</KTag>
                          {bucketStatusTag(bucket)}
                          <KTag>{bucket.chunk_count} 個切片</KTag>
                        </div>
                        <h5 className="mt-[6px] mb-0 text-[15px] font-semibold text-foreground">
                          {bucket.title || bucket.bucket_key || '引用來源'}
                        </h5>
                      </div>
                      <UIButton
                        variant="outline"
                        size="sm"
                        onClick={() => onEditBucket(bucket)}
                      >
                        <EditOutlined />
                        編輯
                      </UIButton>
                    </div>
                    {bucket.summary ? (
                      <p className="my-[6px] text-[13px] leading-[1.65] text-[#858b9c]">{bucket.summary}</p>
                    ) : null}
                    <KnowledgeBucketLinks bucket={bucket} evidenceOnly />
                    <section className="mt-[12px] rounded-[14px] border border-[#eceef1] bg-white p-[14px]">
                      <MarkdownPreview markdown={contentMarkdown || '暫無可展示的切片正文，可點擊編輯加載完整引用來源。'} />
                    </section>
                  </section>
                );
              })
            )}
          </div>
        )}

        {detailView === 'wiki' && (
          <div className="knowledge-concept-list">
            {okfConcepts.length === 0 ? (
              <EmptyState description="暫無知識圖譜" />
            ) : (
              okfConcepts.map((concept) => (
                <div
                  className="knowledge-concept-card knowledge-detail-target"
                  key={concept.id}
                  data-detail-key={concept.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onViewConcept(concept)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onViewConcept(concept);
                    }
                  }}
                >
                  <div className="knowledge-concept-card-head">
                    <div>
                      <div className="flex flex-wrap items-center gap-[8px]">
                        <KTag color={conceptTypeColor(concept.concept_type)}>{conceptTypeLabel(concept.concept_type)}</KTag>
                        {statusTag(concept.status)}
                      </div>
                      <h5 className="mt-[6px] mb-0 text-[15px] font-semibold text-foreground">{concept.title || concept.concept_id}</h5>
                    </div>
                    <UIButton
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditConcept(concept);
                      }}
                    >
                      <EditOutlined />
                      編輯
                    </UIButton>
                  </div>
                  <p className="my-[6px] text-[13px] text-[#858b9c]">{concept.description || conceptSummary(concept)}</p>
                  <div className="flex flex-wrap items-center gap-[6px]">
                    <KTag>{concept.concept_id}</KTag>
                    <KTag>{concept.links.length} 個鏈接</KTag>
                    <KTag>{concept.citations.length} 個引用</KTag>
                    {concept.document_id ? <KTag>來源文檔 {concept.document_id}</KTag> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </KDialog>
    </div>
  );
}

export function WikiViewerTitle({ concept }: { concept: KnowledgeConceptRead }) {
  return (
    <div className="flex min-w-0 flex-col gap-[4px]">
      <span className="text-[13px] font-semibold text-[#1a71ff]">{conceptTypeLabel(concept.concept_type)}</span>
      <strong className="line-clamp-2 text-[20px] font-semibold leading-[1.35] text-[#18181a]">
        {concept.title || concept.concept_id}
      </strong>
      <small className="font-mono text-[12px] wrap-break-word text-[#858b9c]">{concept.concept_id}</small>
    </div>
  );
}

export function WikiConceptViewer({ concept }: { concept: KnowledgeConceptRead }) {
  const body = stripOkfFrontmatter(concept.content_md || '');
  const tags = Array.isArray(concept.frontmatter?.tags) ? concept.frontmatter.tags : [];
  const citations = Array.isArray(concept.citations) ? concept.citations : [];
  const links = Array.isArray(concept.links) ? concept.links : [];
  const sourceRefs = Array.isArray(concept.source_refs) ? concept.source_refs : [];
  return (
    <div className="flex min-w-0 flex-col gap-[18px]">
      <section className="flex flex-col gap-[10px] rounded-[16px] border border-[#1a71ff]/18 bg-[#f5f8ff] p-[18px]">
        <div className="flex flex-wrap items-center gap-[8px]">
          <KTag color={conceptTypeColor(concept.concept_type)}>{conceptTypeLabel(concept.concept_type)}</KTag>
          {statusTag(concept.status)}
          {tags.slice(0, 5).map((tag) => (
            <KTag key={String(tag)}>{String(tag)}</KTag>
          ))}
        </div>
        <h3 className="text-[20px] font-semibold text-[#18181a]">{concept.title || concept.concept_id}</h3>
        <p className="text-[14px] leading-[1.65] text-[#18181a]">{concept.description || conceptSummary(concept)}</p>
      </section>

      <section className="grid min-w-0 gap-[10px] grid-cols-[repeat(auto-fit,minmax(160px,1fr))]" aria-label="知識圖譜元信息">
        {[
          { label: '頁面路徑', value: concept.concept_id },
          { label: '鏈接', value: `${links.length} 個` },
          { label: '引用', value: `${citations.length} 個` },
          { label: '更新時間', value: formatDateTime(concept.updated_at) },
        ].map((item) => (
          <div
            key={item.label}
            className="flex min-w-0 flex-col gap-[6px] overflow-hidden rounded-[14px] border border-[#eceef1] bg-white px-[14px] py-[13px]"
          >
            <span className="text-[12px] font-semibold text-[#858b9c]">{item.label}</span>
            <strong className="wrap-break-word text-[14px] text-[#18181a]">{item.value}</strong>
          </div>
        ))}
      </section>

      <section className="rounded-[16px] border border-[#eceef1] bg-white p-[18px]">
        <MarkdownPreview markdown={body || '暫無正文'} />
      </section>

      {(links.length > 0 || citations.length > 0 || sourceRefs.length > 0) && (
        <section className="grid min-w-0 grid-cols-1 gap-[10px] xl:grid-cols-3" aria-label="知識鏈接與引用">
          {links.length > 0 && (
            <div className="flex min-w-0 flex-col gap-[10px] overflow-hidden rounded-[14px] border border-[#eceef1] bg-white p-[14px]">
              <strong className="text-[13px] font-semibold text-[#18181a]">關聯頁面</strong>
              <div className="flex max-h-[220px] min-w-0 max-w-full flex-wrap gap-[6px] overflow-x-hidden overflow-y-auto pr-[2px]">
                {links.slice(0, 12).map((item, index) => (
                  <KnowledgeRelationChip key={`link-${index}`}>{recordLabel(item, ['target', 'concept_id', 'id'])}</KnowledgeRelationChip>
                ))}
              </div>
            </div>
          )}
          {citations.length > 0 && (
            <div className="flex min-w-0 flex-col gap-[10px] overflow-hidden rounded-[14px] border border-[#eceef1] bg-white p-[14px]">
              <strong className="text-[13px] font-semibold text-[#18181a]">引用</strong>
              <div className="flex max-h-[220px] min-w-0 max-w-full flex-wrap gap-[6px] overflow-x-hidden overflow-y-auto pr-[2px]">
                {citations.slice(0, 12).map((item, index) => (
                  <KnowledgeRelationChip key={`citation-${index}`}>{recordLabel(item, ['label', 'source', 'uri', 'id'])}</KnowledgeRelationChip>
                ))}
              </div>
            </div>
          )}
          {sourceRefs.length > 0 && (
            <div className="flex min-w-0 flex-col gap-[10px] overflow-hidden rounded-[14px] border border-[#eceef1] bg-white p-[14px]">
              <strong className="text-[13px] font-semibold text-[#18181a]">來源</strong>
              <div className="flex max-h-[220px] min-w-0 max-w-full flex-wrap gap-[6px] overflow-x-hidden overflow-y-auto pr-[2px]">
                {sourceRefs.slice(0, 12).map((item, index) => (
                  <KnowledgeRelationChip key={`source-${index}`}>{recordLabel(item, ['document_id', 'section_id', 'source', 'id'])}</KnowledgeRelationChip>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export function MarkdownPreview({ markdown }: { markdown: string }) {
  const normalized = normalizeMarkdownForDisplay(markdown);
  return (
    <div className="knowledge-markdown-preview">
      {renderMarkdownBlocks(normalized || '暫無內容')}
    </div>
  );
}

export function stripOkfFrontmatter(markdown: string) {
  return markdown.replace(/^---\s*\n[\s\S]*?\n---\s*/, '').trim();
}

export function recordLabel(item: unknown, keys: string[]) {
  if (!isRecord(item)) return String(item || 'unknown');
  for (const key of keys) {
    const value = item[key];
    if (value) return String(value);
  }
  return JSON.stringify(item);
}

export function KnowledgeRelationChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block min-w-0 max-w-full rounded-[6px] bg-[#f2f3f5] px-[8px] py-px text-[12px] font-medium leading-[18px] whitespace-normal wrap-anywhere text-[#5b6273]">
      {children}
    </span>
  );
}

export function KnowledgeBucketLinks({ bucket, evidenceOnly = false }: { bucket: KnowledgeBucketRead; evidenceOnly?: boolean }) {
  const sourceSections = bucketSourceSections(bucket);
  const representativeChunks = bucketRepresentativeChunks(bucket);
  return (
    <div className="knowledge-bucket-link-grid">
      {!evidenceOnly && (
        <>
          <span className="text-[13px] text-[#858b9c]">覆蓋來源</span>
          <div>
            {sourceSections.length === 0 ? (
              <KTag>暫無來源路徑</KTag>
            ) : (
              sourceSections.map((section) => <KTag key={String(section)}>{String(section)}</KTag>)
            )}
          </div>
        </>
      )}
      <span className="text-[13px] text-[#858b9c]">{evidenceOnly ? '引用來源' : '代表引用'}</span>
      <div className="knowledge-evidence-token-list">
        {representativeChunks.length === 0 ? (
          bucket.chunk_count > 0 ? <KTag>{bucket.chunk_count} 個引用來源</KTag> : <KTag>暫無可讀代表來源</KTag>
        ) : (
          representativeChunks.map((chunkId) => <KTag key={String(chunkId)}>{String(chunkId)}</KTag>)
        )}
      </div>
    </div>
  );
}

export function knowledgeDetailTitle(view: KnowledgeDetailView | null) {
  if (view === 'document') return '文檔詳情';
  if (view === 'sections') return '目錄索引 目錄';
  if (view === 'wiki') return '知識圖譜';
  if (view === 'evidence') return '引用來源';
  return '知識詳情';
}

export function bucketSourceSections(bucket: KnowledgeBucketRead) {
  const bucketMeta = bucket.metadata || {};
  if (Array.isArray(bucketMeta.section_paths)) return bucketMeta.section_paths;
  if (Array.isArray(bucketMeta.section_ids)) return bucketMeta.section_ids;
  return [];
}

export function bucketRepresentativeChunks(bucket: KnowledgeBucketRead) {
  const representativeChunks = Array.isArray(bucket.metadata?.representative_chunk_ids)
    ? bucket.metadata.representative_chunk_ids
    : [];
  return representativeChunks
    .map((chunkId) => String(chunkId || '').trim())
    .filter((chunkId) => chunkId.length > 0 && !/^k?chunk_[a-f0-9]{8,}$/i.test(chunkId))
    .slice(0, 12);
}

export function bucketContentMarkdown(bucket: KnowledgeBucketRead): string {
  const metadata = bucket.metadata || {};
  const content = stringFromMetadata(metadata.content).trim();
  if (content) return content;
  const excerpt = stringFromMetadata(metadata.excerpt).trim();
  if (excerpt) return excerpt;
  return bucket.summary || '';
}

export function previewRepresentativeChunkIds(buckets: KnowledgeBucketRead[]) {
  const ids: string[] = [];
  buckets.forEach((bucket) => {
    ids.push(...bucketRepresentativeChunks(bucket));
  });
  return Array.from(new Set(ids)).slice(0, 3);
}

export function previewEvidenceItems(buckets: KnowledgeBucketRead[], chunkCount: number, limit: number) {
  const bucketItems = buckets
    .filter((bucket) => bucket.chunk_count > 0)
    .slice(0, limit)
    .map((bucket) => {
      const sourceSections = bucketSourceSections(bucket)
        .map((section) => String(section))
        .filter(Boolean)
        .slice(0, 2);
      const contentPreview = bucketContentMarkdown(bucket).replace(/\s+/g, ' ').trim().slice(0, 180);
      return {
        key: bucket.id,
        title: bucket.title || bucket.bucket_key || '引用來源',
        summary: contentPreview || (sourceSections.length
          ? `${bucket.chunk_count} 個引用來源，覆蓋 ${sourceSections.join(' / ')}`
          : `${bucket.chunk_count} 個引用來源，已完成桶級映射。`),
        bucket,
      };
    });
  if (bucketItems.length > 0) return bucketItems;

  const representativeChunkIds = previewRepresentativeChunkIds(buckets);
  if (representativeChunkIds.length > 0) {
    return representativeChunkIds.map((chunkId) => ({
      key: chunkId,
      title: chunkId,
      summary: '代表引用來源，可在詳情中查看來源映射。',
    }));
  }

  if (chunkCount > 0) {
    return [
      {
        key: 'chunk-total',
        title: '已入庫引用來源',
        summary: `共 ${chunkCount} 個引用來源，當前暫無可展示的桶級代表來源。`,
      },
    ];
  }

  return [];
}

export function KnowledgeSearchDebug({
  result,
  loading,
  compact = false,
}: {
  result: KnowledgeSearchResponse | null;
  loading: boolean;
  compact?: boolean;
}) {
  if (loading) {
    return <span className="text-[13px] text-[#858b9c]">正在按目錄索引和知識圖譜檢索，並整理引用來源...</span>;
  }
  if (!result) {
    return <EmptyState description="尚未運行檢索" />;
  }
  const selectedConcepts = result.selected_concepts || [];
  const okfCitations = result.okf_citations || [];
  return (
    <div className={`knowledge-search-debug${compact ? ' is-compact' : ''}`}>
      <div className="knowledge-route-trace">
        {(result.route_trace || result.trace || []).map((item, index) => (
          <div className="knowledge-route-step" key={`${String(item.phase || 'phase')}-${index}`}>
            <span>{index + 1}</span>
            <div>
              <strong>{routePhaseLabel(String(item.phase || ''))}</strong>
              <small>{String(item.message || '')}</small>
            </div>
          </div>
        ))}
      </div>
      <Accordion type="multiple" className="flex flex-col gap-[6px]">
        <AccordionItem value="concepts">
          <AccordionTrigger>{`知識圖譜 ${selectedConcepts.length}`}</AccordionTrigger>
          <AccordionContent>
            <pre className="knowledge-json">{JSON.stringify(selectedConcepts, null, 2)}</pre>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="okf-citations">
          <AccordionTrigger>{`知識圖譜引用 ${okfCitations.length}`}</AccordionTrigger>
          <AccordionContent>
            <pre className="knowledge-json">{JSON.stringify(okfCitations, null, 2)}</pre>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="documents">
          <AccordionTrigger>{`文檔 ${result.selected_documents.length}`}</AccordionTrigger>
          <AccordionContent>
            <pre className="knowledge-json">{JSON.stringify(result.selected_documents, null, 2)}</pre>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="sections">
          <AccordionTrigger>{`展開來源 ${result.expanded_sections.length}`}</AccordionTrigger>
          <AccordionContent>
            <pre className="knowledge-json">{JSON.stringify(result.expanded_sections, null, 2)}</pre>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="evidence">
          <AccordionTrigger>{`引用來源包 ${result.evidence_pack.length}`}</AccordionTrigger>
          <AccordionContent>
            <div className="knowledge-evidence-list">
              {result.evidence_pack.map((item) => (
                <div className="knowledge-evidence-item" key={item.chunk_id}>
                  <strong className="text-[13px] font-semibold text-foreground">{item.section_path || item.source_path || item.chunk_id}</strong>
                  <p className="m-0 text-[13px] text-foreground">{item.excerpt}</p>
                  <span className="text-[13px] text-[#858b9c]">{item.confidence_reason}</span>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export function DiscoveryColumn({
  title,
  description,
  items,
  readonly = false,
  onConfirm,
  onReject,
}: {
  title: string;
  description: string;
  items: KnowledgeDiscoveryRead[];
  readonly?: boolean;
  onConfirm: (item: KnowledgeDiscoveryRead) => Promise<void>;
  onReject: (item: KnowledgeDiscoveryRead) => Promise<void>;
}) {
  return (
    <div className="knowledge-discovery-column">
      <div className="knowledge-section-heading">
        <div>
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
        <KTag>{items.length}</KTag>
      </div>
      {items.length === 0 ? (
        <EmptyState description="暫無內容" />
      ) : (
        <div className="knowledge-discovery-list flex flex-col gap-[12px]">
          {items.map((item) => (
            <div className={`knowledge-discovery ${item.suggestion_type}`} key={item.id}>
              <div className="knowledge-discovery-header">
                <div className="flex flex-wrap items-center gap-[8px]">
                  <strong className="text-[14px] font-semibold text-foreground">{item.title}</strong>
                  <KTag>{typeLabel(item.suggestion_type)}</KTag>
                  {statusTag(item.status)}
                </div>
                {!readonly && item.status === 'pending' && (
                  <div className="flex items-center gap-[8px]">
                    <UIButton variant="outline" size="icon" className="size-8 rounded-full" onClick={() => void onConfirm(item)}>
                      <CheckOutlined />
                    </UIButton>
                    <UIButton variant="outline" size="icon" className="size-8 rounded-full" onClick={() => void onReject(item)}>
                      <CloseOutlined />
                    </UIButton>
                  </div>
                )}
              </div>
              {item.reason && <p className="my-[6px] text-[13px] text-[#858b9c]">{item.reason}</p>}
              <Accordion type="single" collapsible>
                <AccordionItem value="payload" className="border-b-0">
                  <AccordionTrigger className="py-[6px]">查看詳情</AccordionTrigger>
                  <AccordionContent>
                    <pre className="knowledge-json">{JSON.stringify(item.payload, null, 2)}</pre>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function routePhaseLabel(phase: string) {
  const map: Record<string, string> = {
    document_route: '選擇知識庫文檔',
    document_route_lexical: '按相關性選擇知識庫文檔',
    okf_concept_route: '選擇知識圖譜',
    okf_only: '僅命中知識圖譜',
    bucket_route: '展開內部索引',
    bucket_route_lexical: '按相關性選擇內部索引',
    section_expand: '讀取來源',
    read_chunks: '讀取引用來源',
    evidence_pack: '整理引用來源包',
    no_documents: '沒有文檔',
    no_buckets: '沒有內部索引',
  };
  return map[phase] || phase || '檢索階段';
}

export function isEmptyDefaultKnowledgeBase(item: KnowledgeBaseRead) {
  const hasRuntimeKnowledge = item.document_count > 0 || item.bucket_count > 0 || item.chunk_count > 0;
  if (!hasRuntimeKnowledge && item.metadata?.created_from_document_upload && !item.metadata?.source_document_id) {
    return true;
  }
  return (
    item.name === '默認知識庫' &&
    item.document_count === 0 &&
    item.bucket_count === 0 &&
    item.chunk_count === 0
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function statusTag(status: string) {
  const map: Record<string, { color: string; label: string }> = {
    active: { color: 'green', label: '已上線' },
    published: { color: 'green', label: '已發佈' },
    archived: { color: 'default', label: '已下線' },
    draft: { color: 'default', label: '草稿' },
    succeeded: { color: 'green', label: '已完成' },
    ready: { color: 'green', label: '達標' },
    confirmed: { color: 'green', label: '已確認' },
    failed: { color: 'red', label: '失敗' },
    pending: { color: 'gold', label: '待處理' },
    running: { color: 'processing', label: '處理中' },
    queued: { color: 'gold', label: '排隊中' },
    cancel_requested: { color: 'gold', label: '取消中' },
    cancelled: { color: 'default', label: '已取消' },
  };
  const item = map[status] || { color: 'gold', label: status };
  return <KTag color={item.color}>{item.label}</KTag>;
}

export function bucketStatusTag(bucket: KnowledgeBucketRead) {
  if (bucket.status === 'ready') return <KTag color="green">達標</KTag>;
  return <KTag color="gold">待補足</KTag>;
}

export const KTAG_TONE_CLASS: Record<string, string> = {
  green: 'bg-[#eafbf0] text-[#018434]',
  red: 'bg-[#fce7e7] text-[#d20b0b]',
  gold: 'bg-[#fff4e0] text-[#c47d09]',
  processing: 'bg-[#e6f0ff] text-[#1a71ff]',
  blue: 'bg-[#e6f0ff] text-[#1a71ff]',
  geekblue: 'bg-[#eceaffe6] text-[#3538cd]',
  cyan: 'bg-[#e0fbff] text-[#0891a5]',
  purple: 'bg-[#f2e9ff] text-[#7a35cd]',
  magenta: 'bg-[#ffe9f4] text-[#c41d7f]',
  default: 'bg-[#f2f3f5] text-[#5b6273]',
};

export function KTag({ color = 'default', children }: { color?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[4px] rounded-[6px] px-[8px] py-px text-[12px] font-medium leading-[18px]',
        KTAG_TONE_CLASS[color] || KTAG_TONE_CLASS.default,
      )}
    >
      {children}
    </span>
  );
}

export function KCard({
  className,
  bodyClassName,
  title,
  extra,
  children,
  ...rest
}: {
  className?: string;
  bodyClassName?: string;
  title?: ReactNode;
  extra?: ReactNode;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, 'title'>) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-[14px] border border-[#eceef1] bg-white',
        className,
      )}
      {...rest}
    >
      {(title || extra) && (
        <div className="flex min-h-[54px] items-center justify-between gap-[12px] border-b border-[#eceef1] px-[20px] py-[10px]">
          <div className="min-w-0 text-[14px] font-medium text-[#18181a]">{title}</div>
          {extra ? <div className="shrink-0 text-[#858b9c]">{extra}</div> : null}
        </div>
      )}
      <div className={cn('p-[20px]', bodyClassName)}>{children}</div>
    </section>
  );
}

export function KDialogCancelButton({
  children = '取消',
  className,
  ...props
}: React.ComponentProps<typeof UIButton>) {
  return (
    <UIButton variant="outline" className={cn(DIALOG_CANCEL_BUTTON_CLASS, className)} {...props}>
      {children}
    </UIButton>
  );
}

export function KDialogPrimaryButton({
  children,
  className,
  ...props
}: React.ComponentProps<typeof UIButton>) {
  return (
    <UIButton className={cn(DIALOG_PRIMARY_BUTTON_CLASS, className)} {...props}>
      {children}
    </UIButton>
  );
}

export function KDialog({
  open,
  title,
  width,
  className,
  footer,
  onClose,
  children,
}: {
  open: boolean;
  title: ReactNode;
  width?: number | string;
  className?: string;
  footer?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        style={width ? { maxWidth: typeof width === 'number' ? `${width}px` : width } : undefined}
        className={cn(
          'flex max-h-[calc(100dvh-4rem)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-[16px] p-0 sm:max-w-[560px]',
          className,
        )}
      >
        <DialogTitle className="px-[24px] py-[16px] text-[16px] font-semibold text-foreground" asChild={typeof title !== 'string'}>
          {typeof title === 'string' ? title : <div>{title}</div>}
        </DialogTitle>
        <div className="min-h-0 flex-1 overflow-y-auto px-[24px] pb-[16px]">{children}</div>
        {footer ? <div className={DIALOG_FOOTER_CLASS}>{footer}</div> : null}
      </DialogContent>
    </Dialog>
  );
}

export function EmptyState({ description }: { description: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-[6px] py-[36px] text-center text-[13px] text-[#858b9c]">
      {description}
    </div>
  );
}

export function FileDropzone({
  accept,
  multiple = false,
  disabled = false,
  onFiles,
  children,
}: {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  children: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const emit = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    onFiles(multiple ? files : files.slice(0, 1));
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-[12px] border border-dashed border-border bg-(--surface-subtle) px-[16px] py-[28px] text-center transition-colors',
        dragActive && 'border-[#1a71ff] bg-[#1a71ff]/5',
        disabled && 'cursor-not-allowed opacity-60',
      )}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        if (!disabled) emit(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          emit(event.target.files);
          event.target.value = '';
        }}
      />
      {children}
    </div>
  );
}

export function conceptPath(conceptId: string) {
  return conceptId
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

export const CONCEPT_TYPE_LABELS = new Map<string, string>([
  ['Source Document', '原始資料'],
  ['Source Section', '資料頁'],
  ['Topic', '主題'],
  ['Playbook', '流程知識'],
  ['Business Rule', '業務規則'],
  ['Query Analysis', '查詢分析'],
]);

export function conceptTypeLabel(type: string) {
  return CONCEPT_TYPE_LABELS.get(type) || type || '概念';
}

export function conceptTypeColor(type: string) {
  const map: Record<string, string> = {
    'Source Document': 'blue',
    'Source Section': 'cyan',
    Topic: 'green',
    Playbook: 'purple',
    'Business Rule': 'gold',
    'Query Analysis': 'magenta',
  };
  return map[type] || 'default';
}

export function sortWikiConcepts(concepts: KnowledgeConceptRead[]) {
  const rank: Record<string, number> = {
    'Source Document': 0,
    'Source Section': 1,
    Topic: 2,
    Playbook: 3,
    'Business Rule': 4,
    'Query Analysis': 5,
  };
  return [...concepts].sort((left, right) => {
    const leftRank = rank[left.concept_type] ?? 99;
    const rightRank = rank[right.concept_type] ?? 99;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return (left.title || left.concept_id).localeCompare(right.title || right.concept_id, getDateLocale());
  });
}

export function buildWikiIndexGroups(concepts: KnowledgeConceptRead[]): WikiIndexGroup[] {
  const groupMap = new Map<string, WikiIndexGroup>();
  concepts.forEach((concept) => {
    const key = wikiIndexGroupKey(concept);
    const existing = groupMap.get(key);
    if (existing) {
      existing.concepts.push(concept);
      existing.description = wikiIndexGroupDescription(existing.concepts);
      return;
    }
    groupMap.set(key, {
      key,
      title: wikiIndexGroupTitle(concept),
      description: wikiIndexGroupDescription([concept]),
      concepts: [concept],
    });
  });
  return Array.from(groupMap.values()).map((group) => ({
    ...group,
    concepts: sortWikiConcepts(group.concepts),
  }));
}

export function wikiIndexGroupKey(concept: KnowledgeConceptRead) {
  const sourceDocument = stringFromMetadata(concept.frontmatter?.source_document);
  if (sourceDocument) return `source:${sourceDocument}`;
  const firstSource = concept.source_refs.find((item) => isRecord(item) && (item.source_document || item.document_id));
  if (isRecord(firstSource)) {
    const label = String(firstSource.source_document || firstSource.document_id || '').trim();
    if (label) return `source:${label}`;
  }
  return `type:${concept.concept_type || '知識圖譜'}`;
}

export function wikiIndexGroupTitle(concept: KnowledgeConceptRead) {
  const sourceDocument = stringFromMetadata(concept.frontmatter?.source_document);
  if (sourceDocument) return sourceDocument.replace(/^sources\//, '');
  const firstSource = concept.source_refs.find((item) => isRecord(item) && (item.source_document || item.document_id));
  if (isRecord(firstSource)) {
    const label = String(firstSource.source_document || firstSource.document_id || '').trim();
    if (label) return label.replace(/^sources\//, '');
  }
  return conceptTypeLabel(concept.concept_type);
}

export function wikiIndexGroupDescription(concepts: KnowledgeConceptRead[]) {
  const types = Array.from(new Set(concepts.map((concept) => conceptTypeLabel(concept.concept_type)).filter(Boolean))).slice(0, 4);
  const samples = concepts
    .map((concept) => concept.title || concept.concept_id)
    .filter(Boolean)
    .slice(0, 3);
  const typeText = types.length ? types.join('、') : '知識圖譜';
  const sampleText = samples.length ? `，包含 ${samples.join(' / ')}` : '';
  return `${concepts.length} 個知識圖譜，覆蓋 ${typeText}${sampleText}`;
}

export function conceptSummary(concept: KnowledgeConceptRead) {
  const body = concept.content_md.replace(/^---[\s\S]*?---\s*/m, '').replace(/[#>*_\-[\]()`]/g, ' ').trim();
  return body.length > 160 ? `${body.slice(0, 160)}...` : body || '暫無摘要';
}

export function okfFrontmatterValue(markdown: string, key: string, fallback = '') {
  const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) return fallback;
  const line = frontmatter[1].split('\n').find((item) => item.trim().startsWith(`${key}:`));
  if (!line) return fallback;
  const raw = line.slice(line.indexOf(':') + 1).trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : String(parsed);
  } catch {
    return raw.replace(/^['"]|['"]$/g, '');
  }
}

export function updateOkfFrontmatterValue(markdown: string, key: string, value: string) {
  const normalizedValue = JSON.stringify(value);
  const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) {
    return `---\n${key}: ${normalizedValue}\n---\n\n${markdown}`;
  }
  const lines = frontmatter[1].split('\n');
  const index = lines.findIndex((line) => line.trim().startsWith(`${key}:`));
  if (index >= 0) {
    lines[index] = `${key}: ${normalizedValue}`;
  } else {
    lines.push(`${key}: ${normalizedValue}`);
  }
  return markdown.replace(/^---\n[\s\S]*?\n---/, `---\n${lines.join('\n')}\n---`);
}

export function formatDateTime(value: string) {
  if (!value) return '未知時間';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(getDateLocale(), {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function typeLabel(type: string) {
  if (type === 'skill') return '技能';
  if (type === 'tool') return '工具';
  return '提示';
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('讀取文件失敗'));
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',').pop() || '' : result);
    };
    reader.readAsDataURL(file);
  });
}
