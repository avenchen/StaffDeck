import { useAuth } from '@/app/AuthProvider';
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
import { knowledgeApi } from '@/api/endpoints/knowledge';
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

import { DEFAULT_INGEST_STEPS, IngestStepView, KNOWLEDGE_PAGE_SIZE, KNOWLEDGE_SEARCH_MODEL_STORAGE_KEY, KnowledgeBaseVersionRead, KnowledgePageProps, OkfLintIssue, TERMINAL_KNOWLEDGE_JOB_STATUSES } from '../types';
import { CONCEPT_TYPE_LABELS, DiscoveryColumn, EmptyState, FileDropzone, KCard, KDialog, KDialogCancelButton, KDialogPrimaryButton, KTAG_TONE_CLASS, KTag, KnowledgeBucketLinks, KnowledgeContentView, KnowledgeDetailView, KnowledgeJobCard, KnowledgeOverviewItem, KnowledgeRelationChip, KnowledgeSearchDebug, MarkdownPreview, OKF_PREVIEW_LIMIT, STRUCTURE_PREVIEW_LIMIT, SmoothProgress, WikiConceptViewer, WikiIndexGroup, WikiViewerTitle, bucketContentMarkdown, bucketRepresentativeChunks, bucketSourceSections, bucketStatusTag, buildWikiIndexGroups, conceptPath, conceptSummary, conceptTypeColor, conceptTypeLabel, documentSourceMarkdown, effectiveKnowledgeAgentId, fileToBase64, formatDateTime, ingestSteps, isEmptyDefaultKnowledgeBase, isRecord, knowledgeDetailTitle, knowledgeJobSortTime, normalizeMarkdownForDisplay, okfFrontmatterValue, previewEvidenceItems, previewRepresentativeChunkIds, recordLabel, resolveKnowledgeAgentScope, routePhaseLabel, sortWikiConcepts, stageLabelFallback, statusTag, stringFromMetadata, stripOkfFrontmatter, typeLabel, updateOkfFrontmatterValue, wikiIndexGroupDescription, wikiIndexGroupKey, wikiIndexGroupTitle, 目錄索引Overview } from '../parts';

export function KnowledgeAddPage({}: KnowledgePageProps = {}) {
  const { user: currentUser, logout: onLogout } = useAuth();

  const navigate = useNavigate();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseRead[]>([]);
  const [jobs, setJobs] = useState<Record<string, KnowledgeIngestJobRead>>({});
  const [agentId, setAgentId] = useState(() => window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) || '');
  const [agentScopeLoaded, setAgentScopeLoaded] = useState(false);
  const [checkedDiscoveryJobIds, setCheckedDiscoveryJobIds] = useState<string[]>([]);
  const [pendingDiscoveries, setPendingDiscoveries] = useState<KnowledgeDiscoveryRead[]>([]);
  const [discoveryModalOpen, setDiscoveryModalOpen] = useState(false);
  const [cancellingJobIds, setCancellingJobIds] = useState<string[]>([]);
  const sortedJobs = useMemo(
    () => Object.values(jobs).sort((left, right) => {
      const diff = knowledgeJobSortTime(right) - knowledgeJobSortTime(left);
      return diff || right.id.localeCompare(left.id);
    }),
    [jobs],
  );
  const activeJobs = useMemo(
    () => sortedJobs.filter((job) => ['queued', 'running', 'cancel_requested'].includes(job.status)),
    [sortedJobs],
  );
  const visibleKnowledgeBases = useMemo(
    () => knowledgeBases.filter((item) => !isEmptyDefaultKnowledgeBase(item)),
    [knowledgeBases],
  );

  useEffect(() => {
    let active = true;
    api
      .get<AgentProfileRead[]>(`/api/enterprise/agents?tenant_id=${TENANT_ID}`)
      .then((agentRows) => {
        if (!active) return;
        const resolvedAgentId = resolveKnowledgeAgentScope(agentRows, currentUser, agentId);
        if (resolvedAgentId !== agentId) {
          if (resolvedAgentId) {
            persistSharedAgentScope(resolvedAgentId, currentUser?.id);
          } else {
            clearSharedAgentScope(currentUser?.id);
          }
          setAgentId(resolvedAgentId);
          emitAgentScopeChange(resolvedAgentId);
        }
        setAgentScopeLoaded(true);
      })
      .catch(() => {
        if (active) setAgentScopeLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!agentScopeLoaded) return;
    void refreshKnowledgeBases();
    void loadRecentJobs();
  }, [agentId, agentScopeLoaded]);

  useEffect(() => {
    const onScopeChange = (event: Event) => {
      setAgentId((event as CustomEvent<{ agentId?: string }>).detail?.agentId || window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) || '');
    };
    window.addEventListener('ultrarag-enterprise-agent-scope-change', onScopeChange);
    return () => window.removeEventListener('ultrarag-enterprise-agent-scope-change', onScopeChange);
  }, []);

  useEffect(() => {
    if (activeJobs.length === 0) return;
    const timer = window.setInterval(() => {
      activeJobs.forEach((job) => {
        void knowledgeApi
          .getJob(job.id, agentId)
          .then((next) => {
            setJobs((prev) => ({ ...prev, [next.id]: next }));
            if (TERMINAL_KNOWLEDGE_JOB_STATUSES.has(next.status)) {
              setCancellingJobIds((current) => current.filter((id) => id !== next.id));
              void refreshKnowledgeBases();
              void loadRecentJobs();
            }
          })
          .catch(() => undefined);
      });
    }, 1400);
    return () => window.clearInterval(timer);
  }, [activeJobs]);

  useEffect(() => {
    sortedJobs
      .filter((job) => job.status === 'succeeded' && !checkedDiscoveryJobIds.includes(job.id))
      .forEach((job) => {
        void loadDiscoveriesForJob(job);
      });
  }, [sortedJobs, checkedDiscoveryJobIds, agentId]);

  async function refreshKnowledgeBases() {
    if (!isEnterpriseAdmin(currentUser) && !agentId) {
      setKnowledgeBases([]);
      return;
    }
    try {
      const rows = await knowledgeApi.listBases(agentId);
      setKnowledgeBases(rows);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '加載知識庫失敗');
    }
  }

  async function loadRecentJobs() {
    if (!isEnterpriseAdmin(currentUser) && !agentId) {
      setJobs({});
      return;
    }
    try {
      const rows = await knowledgeApi.listJobs(agentId, 8);
      setJobs(Object.fromEntries(rows.map((job) => [job.id, job])));
    } catch {
      setJobs({});
    }
  }

  async function uploadFile(file: File) {
    if (!isEnterpriseAdmin(currentUser) && !agentId) {
      notify.warning('請先選擇一個數字員工');
      return;
    }
    try {
      const contentBase64 = await fileToBase64(file);
      const job = await knowledgeApi.uploadDocument(
        {
          tenant_id: TENANT_ID,
          filename: file.name,
          title: file.name.replace(/\.[^.]+$/, ''),
          content_base64: contentBase64,
        },
        agentId,
      );
      setJobs((prev) => ({ ...prev, [job.id]: job }));
      await refreshKnowledgeBases();
      notify.success('已創建知識庫和入庫任務');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '上傳失敗');
    }
  }

  async function cancelJob(job: KnowledgeIngestJobRead) {
    if (!['queued', 'running', 'cancel_requested'].includes(job.status)) return;
    setCancellingJobIds((current) => (current.includes(job.id) ? current : [...current, job.id]));
    try {
      const next = await knowledgeApi.cancelJob(job.id);
      setJobs((prev) => ({ ...prev, [next.id]: next }));
      notify.success(next.status === 'cancelled' ? '已取消入庫任務' : '已發送取消請求');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '取消入庫任務失敗');
    } finally {
      setCancellingJobIds((current) => current.filter((id) => id !== job.id));
    }
  }

  async function loadDiscoveriesForJob(job: KnowledgeIngestJobRead) {
    setCheckedDiscoveryJobIds((prev) => (prev.includes(job.id) ? prev : [...prev, job.id]));
    try {
      const rows = await knowledgeApi.listDiscoveries(agentId);
      const next = rows.filter(
        (item) =>
          item.status === 'pending' &&
          item.suggestion_type !== 'warning' &&
          item.knowledge_base_id === job.knowledge_base_id &&
          (!job.document_id || item.document_id === job.document_id),
      );
      if (next.length === 0) return;
      setPendingDiscoveries((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...next.filter((item) => !seen.has(item.id))];
      });
      setDiscoveryModalOpen(true);
    } catch (error) {
      notify.warning(error instanceof Error ? error.message : '加載知識發現建議失敗');
    }
  }

  async function confirmDiscovery(item: KnowledgeDiscoveryRead) {
    try {
      await knowledgeApi.confirmDiscovery(item.id);
      notify.success('已確認建議');
      setPendingDiscoveries((current) => current.filter((entry) => entry.id !== item.id));
      await refreshKnowledgeBases();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '確認失敗');
    }
  }

  async function rejectDiscovery(item: KnowledgeDiscoveryRead) {
    try {
      await knowledgeApi.rejectDiscovery(item.id);
      notify.success('已拒絕建議');
      setPendingDiscoveries((current) => current.filter((entry) => entry.id !== item.id));
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '拒絕失敗');
    }
  }

  return (
    <div className="knowledge-page knowledge-add-page knowledge-floating-subpage">
      <div className="knowledge-floating-shell">
        <div className="knowledge-floating-head">
          <div>
            <span className="section-kicker">知識庫 / 新建</span>
            <h3 className="my-[4px] text-[20px] font-semibold text-foreground">新建知識庫</h3>
            <span className="text-[13px] text-[#858b9c]">上傳業務文檔後，系統會先生成知識圖譜，再刷新目錄索引、引用來源與自發現建議。</span>
          </div>
            <UIButton variant="outline" onClick={() => navigate('/enterprise/knowledge')}>
              <RightOutlined />
              返回
            </UIButton>
        </div>

        <KCard className="knowledge-upload-card" bodyClassName="flex flex-col gap-[16px]">
          <div className="knowledge-upload-controls">
            <div>
              <strong className="block text-[14px] font-semibold text-foreground">上傳文檔即創建知識庫</strong>
              <span className="text-[13px] text-[#858b9c]">一個文件對應一份獨立知識庫；回到知識庫後可查看文檔卡片、知識索引和知識圖譜。</span>
            </div>
            <UIButton variant="outline" onClick={() => navigate('/enterprise/knowledge')}>管理已有知識庫</UIButton>
          </div>
        {visibleKnowledgeBases.length > 0 && (
          <div className="knowledge-base-target-strip">
            {visibleKnowledgeBases.map((item) => (
              <div
                key={item.id}
                className="knowledge-base-target"
              >
                <span>{item.name}</span>
                <small>
                  {item.document_count} 文檔 / {item.bucket_count} 目錄 / {item.chunk_count} 引用
                </small>
              </div>
            ))}
          </div>
        )}
        <FileDropzone
          multiple
          accept=".doc,.docx,.txt,.md,.markdown,.html,.htm,.pdf"
          onFiles={(files) => files.forEach((file) => void uploadFile(file))}
        >
          <div className="knowledge-upload-inner">
            <InboxOutlined />
            <div>
              <strong>拖拽文檔到這裡，或點擊上傳</strong>
              <span>支持 doc/docx/txt/md/html/pdf；舊版 doc 會提示轉換為 docx。</span>
            </div>
          </div>
        </FileDropzone>
        </KCard>

        <KCard title="入庫任務">
          {sortedJobs.length === 0 ? (
            <EmptyState description="上傳後這裡會顯示原始資料、知識圖譜和引用來源入庫進度" />
          ) : (
            <div className="knowledge-jobs">
              {sortedJobs.map((job) => (
                <KnowledgeJobCard
                  job={job}
                  key={job.id}
                  cancelling={cancellingJobIds.includes(job.id)}
                  onCancel={cancelJob}
                />
              ))}
            </div>
          )}
        </KCard>
      </div>

      <KDialog
        open={discoveryModalOpen && pendingDiscoveries.length > 0}
        title="發現可新增資源"
        width={820}
        className="knowledge-discovery-modal"
        onClose={() => setDiscoveryModalOpen(false)}
      >
        <DiscoveryColumn
          title="可確認建議"
          description="模型從本次上傳的知識中發現了技能或工具草案，確認後才會寫入系統。"
          items={pendingDiscoveries}
          onConfirm={confirmDiscovery}
          onReject={rejectDiscovery}
        />
      </KDialog>
    </div>
  );
}

