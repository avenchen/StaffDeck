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

export default function KnowledgeManagePage({}: KnowledgePageProps = {}) {
  const { user: currentUser, logout: onLogout } = useAuth();

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [documents, setDocuments] = useState<KnowledgeDocumentRead[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseRead[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeDocumentRead | null>(null);
  const [buckets, setBuckets] = useState<KnowledgeBucketRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [agentId, setAgentId] = useState(() => window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) || '');
  const [agentScopeLoaded, setAgentScopeLoaded] = useState(false);
  const [agents, setAgents] = useState<AgentProfileRead[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<'plaza' | 'employee'>('plaza');
  const [importSourceAgentId, setImportSourceAgentId] = useState('');
  const [importSourceKnowledgeBases, setImportSourceKnowledgeBases] = useState<KnowledgeBaseRead[]>([]);
  const [importSelectedKnowledgeBaseIds, setImportSelectedKnowledgeBaseIds] = useState<string[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [editingKnowledgeBase, setEditingKnowledgeBase] = useState<KnowledgeBaseRead | null>(null);
  const [deleteKbTarget, setDeleteKbTarget] = useState<KnowledgeBaseRead | null>(null);
  const [knowledgeBaseDraft, setKnowledgeBaseDraft] = useState({ name: '', description: '', status: 'active' });
  const [versionKnowledgeBase, setVersionKnowledgeBase] = useState<KnowledgeBaseRead | null>(null);
  const [knowledgeBaseVersions, setKnowledgeBaseVersions] = useState<KnowledgeBaseVersionRead[]>([]);
  const [editingDocument, setEditingDocument] = useState<KnowledgeDocumentRead | null>(null);
  const [documentDraft, setDocumentDraft] = useState({ title: '', status: 'ready' });
  const [editingBucket, setEditingBucket] = useState<KnowledgeBucketRead | null>(null);
  const [bucketDraft, setBucketDraft] = useState({ title: '', summary: '' });
  const [bucketChunks, setBucketChunks] = useState<KnowledgeChunkRead[]>([]);
  const [chunkDrafts, setChunkDrafts] = useState<Record<string, { content: string; summary: string }>>({});
  const [contentSaving, setContentSaving] = useState(false);
  const [documentSearch, setDocumentSearch] = useState('');
  const [knowledgeBaseFilter, setKnowledgeBaseFilter] = useState('__all__');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<KnowledgeSearchResponse | null>(null);
  const [modelConfigs, setModelConfigs] = useState<ModelConfigRead[]>([]);
  const [selectedSearchModelId, setSelectedSearchModelId] = useState(
    () => window.localStorage.getItem(`${KNOWLEDGE_SEARCH_MODEL_STORAGE_KEY}:${TENANT_ID}`) || '',
  );
  const [okfConcepts, setOkfConcepts] = useState<KnowledgeConceptRead[]>([]);
  const [okfLoading, setOkfLoading] = useState(false);
  const [okfImportOpen, setOkfImportOpen] = useState(false);
  const [okfImporting, setOkfImporting] = useState(false);
  const [okfLintIssues, setOkfLintIssues] = useState<OkfLintIssue[]>([]);
  const [okfLintReportOpen, setOkfLintReportOpen] = useState(false);
  const [okfLintKnowledgeBase, setOkfLintKnowledgeBase] = useState<KnowledgeBaseRead | null>(null);
  const [viewingConcept, setViewingConcept] = useState<KnowledgeConceptRead | null>(null);
  const [editingConcept, setEditingConcept] = useState<KnowledgeConceptRead | null>(null);
  const [conceptDraft, setConceptDraft] = useState('');
  const conceptEditorType = editingConcept
    ? okfFrontmatterValue(conceptDraft, 'type', editingConcept.concept_type || 'Topic')
    : 'Topic';
  const conceptEditorTitle = editingConcept
    ? okfFrontmatterValue(conceptDraft, 'title', editingConcept.title || editingConcept.concept_id)
    : '';
  const conceptEditorDescription = editingConcept
    ? okfFrontmatterValue(conceptDraft, 'description', editingConcept.description || '')
    : '';

  const currentAgent = useMemo(() => agents.find((item) => item.id === agentId), [agents, agentId]);
  const isOverallAgent = !currentAgent || currentAgent.is_overall;
  const canManageCurrentScope = currentAgent
    ? canManageEmployeeAgent(currentAgent, currentUser)
    : isEnterpriseAdmin(currentUser);
  const effectiveAgentId = currentAgent && !currentAgent.is_overall ? agentId : '';
  const visibleKnowledgeBases = useMemo(
    () => knowledgeBases.filter((item) => !isEmptyDefaultKnowledgeBase(item)),
    [knowledgeBases],
  );
  const selectedKnowledgeBase = useMemo(() => {
    if (selectedDocument) {
      return visibleKnowledgeBases.find((item) => item.id === selectedDocument.knowledge_base_id) || null;
    }
    if (knowledgeBaseFilter !== '__all__') {
      return visibleKnowledgeBases.find((item) => item.id === knowledgeBaseFilter) || null;
    }
    return visibleKnowledgeBases[0] || null;
  }, [knowledgeBaseFilter, selectedDocument, visibleKnowledgeBases]);
  const filteredKnowledgeBases = useMemo(() => {
    const query = documentSearch.trim().toLowerCase();
    if (!query) return visibleKnowledgeBases;
    return visibleKnowledgeBases.filter((item) => {
      const searchable = [
        item.name,
        item.description,
        item.status,
        item.version,
        resourceCreatorName(item),
        item.branch_sync_state,
        item.document_count,
        item.bucket_count,
        item.chunk_count,
      ]
        .filter((value) => value !== undefined && value !== null)
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [documentSearch, visibleKnowledgeBases]);

  const pageTitle = isOverallAgent ? '知識庫廣場' : '知識庫';
  const listLabel = isOverallAgent ? '知識庫廣場列表' : '知識庫列表';
  const listEmptyText = isOverallAgent ? '暫無知識庫，點擊「新增」創建一個吧' : '當前員工暫無知識庫';

  const stats = useMemo(() => ({
    total: visibleKnowledgeBases.length,
    active: visibleKnowledgeBases.filter((item) => item.status === 'active' || item.status === 'published').length,
    archived: visibleKnowledgeBases.filter((item) => item.status === 'archived').length,
    documents: visibleKnowledgeBases.reduce((sum, item) => sum + (item.document_count || 0), 0),
  }), [visibleKnowledgeBases]);

  const pagination = useClientPagination(filteredKnowledgeBases, KNOWLEDGE_PAGE_SIZE, documentSearch);

  useEffect(() => {
    void loadAgentScope();
  }, [currentUser?.id]);

  useEffect(() => {
    if (!agentScopeLoaded) return;
    const resolvedAgentId = resolveKnowledgeAgentScope(agents, currentUser, agentId);
    if (resolvedAgentId !== agentId) {
      clearKnowledgeViewState();
      applyResolvedAgentScope(resolvedAgentId);
      return;
    }
    if (!isEnterpriseAdmin(currentUser) && !resolvedAgentId) {
      clearKnowledgeViewState();
      return;
    }
    void refresh(effectiveKnowledgeAgentId(agents, resolvedAgentId));
  }, [agentScopeLoaded, agentId, agents, currentUser?.id]);

  useEffect(() => {
    api
      .get<ModelConfigRead[]>(`/api/enterprise/model-configs?tenant_id=${TENANT_ID}`)
      .then((items) => {
        const enabled = items.filter((item) => item.enabled);
        setModelConfigs(enabled);
        setSelectedSearchModelId((current) => {
          if (current && enabled.some((item) => item.id === current)) return current;
          const fallback = enabled.find((item) => item.is_default)?.id || enabled[0]?.id || '';
          if (fallback) {
            window.localStorage.setItem(`${KNOWLEDGE_SEARCH_MODEL_STORAGE_KEY}:${TENANT_ID}`, fallback);
          }
          return fallback;
        });
      })
      .catch(() => setModelConfigs([]));
  }, []);

  useEffect(() => {
    if (searchParams.get('add') !== 'plaza') return;
    if (agents.length === 0) return;
    const resourceId = searchParams.get('resourceId') || undefined;
    if (isOverallAgent) {
      notify.warning('請先選擇一個數字員工，再從廣場複製知識庫');
    } else {
      void openImportKnowledgeBases('plaza', resourceId);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('add');
    next.delete('resourceId');
    setSearchParams(next, { replace: true });
  }, [agents.length, isOverallAgent, searchParams, setSearchParams]);

  useEffect(() => {
    if (knowledgeBaseFilter !== '__all__' && !visibleKnowledgeBases.some((item) => item.id === knowledgeBaseFilter)) {
      setKnowledgeBaseFilter('__all__');
    }
  }, [visibleKnowledgeBases, knowledgeBaseFilter]);

  useEffect(() => {
    const onScopeChange = (event: Event) => {
      setAgentId((event as CustomEvent<{ agentId?: string }>).detail?.agentId || window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) || '');
    };
    window.addEventListener('ultrarag-enterprise-agent-scope-change', onScopeChange);
    return () => window.removeEventListener('ultrarag-enterprise-agent-scope-change', onScopeChange);
  }, []);

  function applyResolvedAgentScope(nextAgentId: string) {
    if (nextAgentId === agentId) return;
    if (nextAgentId) {
      persistSharedAgentScope(nextAgentId, currentUser?.id);
    } else {
      clearSharedAgentScope(currentUser?.id);
    }
    setAgentId(nextAgentId);
    emitAgentScopeChange(nextAgentId);
  }

  function clearKnowledgeViewState() {
    setDocuments([]);
    setKnowledgeBases([]);
    setSelectedDocument(null);
    setBuckets([]);
    setOkfConcepts([]);
    setOkfLintIssues([]);
    setSearchResult(null);
  }

  async function loadAgentScope() {
    setAgentScopeLoaded(false);
    try {
      const agentRows = await api.get<AgentProfileRead[]>(`/api/enterprise/agents?tenant_id=${TENANT_ID}`);
      setAgents(agentRows);
      const resolvedAgentId = resolveKnowledgeAgentScope(agentRows, currentUser, agentId);
      if (resolvedAgentId !== agentId) {
        clearKnowledgeViewState();
        applyResolvedAgentScope(resolvedAgentId);
      }
      setAgentScopeLoaded(true);
    } catch (error) {
      clearKnowledgeViewState();
      notify.error(error instanceof Error ? error.message : '加載員工失敗');
    }
  }

  async function refresh(scopedAgentId = effectiveAgentId) {
    if (!agentScopeLoaded) return;
    if (!isEnterpriseAdmin(currentUser) && !scopedAgentId) {
      clearKnowledgeViewState();
      return;
    }
    setLoading(true);
    try {
      const [docRows, kbRows] = await Promise.all([
        knowledgeApi.listDocuments(scopedAgentId),
        knowledgeApi.listBases(scopedAgentId),
      ]);
      setDocuments(docRows);
      setKnowledgeBases(kbRows);
      const scopedDocRows =
        knowledgeBaseFilter === '__all__'
          ? docRows
          : docRows.filter((item) => item.knowledge_base_id === knowledgeBaseFilter);
      const current = selectedDocument
        ? scopedDocRows.find((item) => item.id === selectedDocument.id) || scopedDocRows[0] || null
        : scopedDocRows[0] || null;
      setSelectedDocument(current);
      if (current) {
        await loadBuckets(current, false);
      } else {
        setBuckets([]);
        const visibleKbRows = kbRows.filter((item) => !isEmptyDefaultKnowledgeBase(item));
        const fallbackKnowledgeBaseId =
          knowledgeBaseFilter !== '__all__' ? knowledgeBaseFilter : visibleKbRows[0]?.id || '';
        await loadOkfConcepts(fallbackKnowledgeBaseId, false);
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '刷新知識庫失敗');
    } finally {
      setLoading(false);
    }
  }

  async function loadBuckets(document: KnowledgeDocumentRead, select = true) {
    if (select) setSelectedDocument(document);
    setBuckets([]);
    setSearchResult(null);
    try {
      const [rows] = await Promise.all([
        knowledgeApi.documentBuckets(document.id, effectiveAgentId),
        loadOkfConcepts(document.knowledge_base_id, false),
      ]);
      setBuckets(rows);
    } catch (error) {
      setBuckets([]);
      notify.error(error instanceof Error ? error.message : '加載內部索引失敗');
    }
  }

  async function loadOkfConcepts(knowledgeBaseId?: string, showLoading = true) {
    if (!knowledgeBaseId) {
      setOkfConcepts([]);
      setOkfLintIssues([]);
      return;
    }
    if (showLoading) setOkfLoading(true);
    try {
      const rows = await knowledgeApi.okfConcepts(knowledgeBaseId, effectiveAgentId);
      setOkfConcepts(rows);
      setOkfLintIssues([]);
    } catch (error) {
      setOkfConcepts([]);
      if (error instanceof ApiError && error.status === 404) {
        setOkfLintIssues([]);
        return;
      }
      notify.error(error instanceof Error ? error.message : '加載知識圖譜失敗');
    } finally {
      if (showLoading) setOkfLoading(false);
    }
  }

  function selectKnowledgeBase(knowledgeBaseId: string) {
    setKnowledgeBaseFilter(knowledgeBaseId);
    const nextDocument =
      knowledgeBaseId === '__all__'
        ? documents[0] || null
        : documents.find((item) => item.knowledge_base_id === knowledgeBaseId) || null;
    if (nextDocument) {
      void loadBuckets(nextDocument);
      return;
    }
    setSelectedDocument(null);
    setBuckets([]);
    setSearchResult(null);
    void loadOkfConcepts(knowledgeBaseId === '__all__' ? undefined : knowledgeBaseId);
  }

  async function runKnowledgeSearch() {
    const query = searchQuery.trim();
    if (!query) {
      notify.warning('請輸入要調試的知識問題');
      return;
    }
    setSearchLoading(true);
    try {
      const response = await knowledgeApi.search({
        tenant_id: TENANT_ID,
        agent_id: effectiveAgentId || undefined,
        knowledge_base_ids:
          knowledgeBaseFilter !== '__all__'
            ? [knowledgeBaseFilter]
            : selectedDocument?.knowledge_base_id
              ? [selectedDocument.knowledge_base_id]
              : undefined,
        query,
        model_config_id: selectedSearchModelId || undefined,
        mode: 'debug',
        max_depth: 3,
        need_evidence_pack: true,
      });
      setSearchResult(response);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '知識檢索失敗');
    } finally {
      setSearchLoading(false);
    }
  }

  async function openImportKnowledgeBases(mode: 'plaza' | 'employee' = 'plaza', selectedResourceId?: string) {
    try {
      const agentRows = agents.length ? agents : await api.get<AgentProfileRead[]>(`/api/enterprise/agents?tenant_id=${TENANT_ID}`);
      setAgents(agentRows);
      setImportMode(mode);
      const firstSource = mode === 'plaza'
        ? openGalleryAgentId(agentRows)
        : visibleEmployeeAgents(agentRows, currentUser, { activeOnly: true, excludeAgentId: agentId })[0]?.id || '';
      setImportSourceAgentId(firstSource);
      setImportSelectedKnowledgeBaseIds([]);
      setImportOpen(true);
      if (firstSource) {
        const sourceRows = await loadImportSourceKnowledgeBases(firstSource);
        if (selectedResourceId && sourceRows.some((item) => item.id === selectedResourceId)) {
          setImportSelectedKnowledgeBaseIds([selectedResourceId]);
        }
      } else {
        setImportSourceKnowledgeBases([]);
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '加載員工失敗');
    }
  }

  async function loadImportSourceKnowledgeBases(sourceAgentId: string): Promise<KnowledgeBaseRead[]> {
    setImportSourceKnowledgeBases([]);
    setImportSelectedKnowledgeBaseIds([]);
    if (!sourceAgentId) return [];
    try {
      const rows = await knowledgeApi.listBases(sourceAgentId);
      const activeRows = rows.filter((item) => item.status === 'active');
      setImportSourceKnowledgeBases(activeRows);
      return activeRows;
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '加載來源知識庫失敗');
      return [];
    }
  }

  async function submitImportKnowledgeBases() {
    if (!agentId) {
      notify.warning('請先選擇一個數字員工');
      return;
    }
    if (!importSourceAgentId) {
      notify.warning(importMode === 'plaza' ? '請選擇開放廣場' : '請選擇來源員工');
      return;
    }
    if (importSelectedKnowledgeBaseIds.length === 0) {
      notify.warning('請選擇要複製的知識庫');
      return;
    }
    setImportLoading(true);
    try {
      const result = await api.post<{ imported: Array<Record<string, unknown>>; missing: Array<Record<string, unknown>> }>(
        `/api/enterprise/agents/${agentId}/resources/import`,
        {
          tenant_id: TENANT_ID,
          source_agent_id: importSourceAgentId,
          resource_type: 'knowledge_base',
          resource_ids: importSelectedKnowledgeBaseIds,
        },
      );
      const importedCount = result.imported?.length || 0;
      const missingCount = result.missing?.length || 0;
      notify.success(`已複製 ${importedCount} 個知識庫${missingCount ? `，${missingCount} 個未複製` : ''}`);
      setImportOpen(false);
      await refresh();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '複製知識庫失敗');
    } finally {
      setImportLoading(false);
    }
  }

  function handleCreateAction(key: string) {
    if (key === 'blank') {
      navigate('/enterprise/knowledge/new');
      return;
    }
    if (key === 'okf') {
      setOkfImportOpen(true);
      return;
    }
    if (key === 'plaza') {
      void openImportKnowledgeBases('plaza');
      return;
    }
    if (key === 'employee') {
      void openImportKnowledgeBases('employee');
    }
  }

  async function importOkfFile(file: File) {
    setOkfImporting(true);
    try {
      const contentBase64 = await fileToBase64(file);
      await knowledgeApi.importOkf({
        tenant_id: TENANT_ID,
        agent_id: effectiveAgentId || undefined,
        knowledge_base_id: selectedKnowledgeBase?.id,
        filename: file.name,
        content_base64: contentBase64,
      });
      notify.success('已導入知識庫備份包');
      setOkfImportOpen(false);
      await refresh();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '導入知識庫備份包失敗');
    } finally {
      setOkfImporting(false);
    }
  }

  async function exportOkfBundle(targetKnowledgeBase = selectedKnowledgeBase) {
    if (!targetKnowledgeBase) {
      notify.warning('請先選擇知識庫');
      return;
    }
    try {
      const blob = await knowledgeApi.exportOkf(targetKnowledgeBase.id, effectiveAgentId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${targetKnowledgeBase.name || targetKnowledgeBase.id}-okf.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      notify.success('已導出知識庫備份包');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '導出知識庫備份包失敗');
    }
  }

  async function lintOkfBundle(targetKnowledgeBase = selectedKnowledgeBase) {
    if (!targetKnowledgeBase) {
      notify.warning('請先選擇知識庫');
      return;
    }
    if (targetKnowledgeBase.id !== selectedKnowledgeBase?.id) {
      selectKnowledgeBase(targetKnowledgeBase.id);
    }
    setOkfLoading(true);
    try {
      const result = await knowledgeApi.lintOkf<{ status: string; issue_count: number; issues: OkfLintIssue[] }>(
        targetKnowledgeBase.id,
        effectiveAgentId,
      );
      setOkfLintIssues(result.issues || []);
      setOkfLintKnowledgeBase(targetKnowledgeBase);
      setOkfLintReportOpen(true);
      notify.success(result.issue_count ? `發現 ${result.issue_count} 個待處理建議` : '知識圖譜檢查通過');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '知識圖譜檢查失敗');
    } finally {
      setOkfLoading(false);
    }
  }

  function openConceptEditor(row: KnowledgeConceptRead) {
    setEditingConcept(row);
    setConceptDraft(row.content_md || '');
  }

  function openConceptViewer(row: KnowledgeConceptRead) {
    setViewingConcept(row);
  }

  function editViewingConcept() {
    if (!viewingConcept) return;
    const concept = viewingConcept;
    setViewingConcept(null);
    openConceptEditor(concept);
  }

  async function saveConcept() {
    if (!editingConcept || !selectedKnowledgeBase) return;
    try {
      const next = await knowledgeApi.updateOkfConcept(
        selectedKnowledgeBase.id,
        conceptPath(editingConcept.concept_id),
        {
          tenant_id: TENANT_ID,
          document_id: editingConcept.document_id,
          content_md: conceptDraft,
          status: editingConcept.status,
        },
        effectiveAgentId,
      );
      setOkfConcepts((current) => current.map((item) => (item.id === next.id ? next : item)));
      setEditingConcept(null);
      notify.success('已保存知識圖譜');
      await loadOkfConcepts(selectedKnowledgeBase.id, false);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '保存知識圖譜失敗');
    }
  }

  function openEditKnowledgeBase(row: KnowledgeBaseRead) {
    setEditingKnowledgeBase(row);
    setKnowledgeBaseDraft({
      name: row.name,
      description: row.description || '',
      status: row.status === 'archived' ? 'archived' : 'active',
    });
  }

  async function saveKnowledgeBase() {
    if (!editingKnowledgeBase) return;
    try {
      const next = await knowledgeApi.updateBase(
        editingKnowledgeBase.id,
        {
          tenant_id: TENANT_ID,
          name: knowledgeBaseDraft.name,
          description: knowledgeBaseDraft.description,
          status: knowledgeBaseDraft.status,
        },
        effectiveAgentId,
      );
      setKnowledgeBases((current) => current.map((item) => (item.id === next.id ? next : item)));
      setEditingKnowledgeBase(null);
      notify.success('已保存知識庫');
      await refresh();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '保存知識庫失敗');
    }
  }

  async function setKnowledgeBaseStatus(row: KnowledgeBaseRead, active: boolean) {
    try {
      const next = await knowledgeApi.updateBase(
        row.id,
        {
          tenant_id: TENANT_ID,
          status: active ? 'active' : 'archived',
        },
        effectiveAgentId,
      );
      setKnowledgeBases((current) => current.map((item) => (item.id === next.id ? next : item)));
      notify.success(active ? '已上線知識庫' : '已下線知識庫');
      await refresh();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : active ? '上線失敗' : '下線失敗');
    }
  }

  function deleteKnowledgeBase(row: KnowledgeBaseRead) {
    setDeleteKbTarget(row);
  }

  async function runDeleteKnowledgeBase() {
    const row = deleteKbTarget;
    if (!row) return;
    const branchMode = !isOverallAgent;
    try {
      await knowledgeApi.deleteBase(row.id, effectiveAgentId);
      notify.success(branchMode ? '已移除知識庫' : '已刪除知識庫');
      setDeleteKbTarget(null);
      await refresh();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '刪除失敗');
    }
  }

  async function openKnowledgeBaseVersions(row: KnowledgeBaseRead) {
    try {
      const versions = await knowledgeApi.listBaseVersions<KnowledgeBaseVersionRead[]>(
        row.id,
        effectiveAgentId,
      );
      setVersionKnowledgeBase(row);
      setKnowledgeBaseVersions(versions);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '加載版本失敗');
    }
  }

  async function syncKnowledgeBaseFromOverall(row: KnowledgeBaseRead) {
    if (!agentId) {
      notify.warning('請先選擇員工');
      return;
    }
    try {
      await knowledgeApi.syncFromOverall(row.id, agentId);
      notify.success('已從廣場同步');
      await refresh();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '同步失敗');
    }
  }

  async function promoteKnowledgeBaseToOverall(row: KnowledgeBaseRead) {
    if (!agentId) {
      notify.warning('請先選擇員工');
      return;
    }
    try {
      await knowledgeApi.promoteToOverall(row.id, agentId);
      notify.success('已發佈到廣場');
      await refresh();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '推送失敗');
    }
  }

  async function rollbackKnowledgeBaseVersion(version: KnowledgeBaseVersionRead) {
    if (!versionKnowledgeBase || !effectiveAgentId) return;
    try {
      await knowledgeApi.rollbackBase(versionKnowledgeBase.id, {
        tenant_id: TENANT_ID,
        agent_id: effectiveAgentId,
        version: version.version,
      });
      notify.success(`已回滾到 ${version.version}`);
      await openKnowledgeBaseVersions(versionKnowledgeBase);
      await refresh();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '回滾失敗');
    }
  }

  function openEditDocument(row: KnowledgeDocumentRead) {
    setEditingDocument(row);
    setDocumentDraft({
      title: row.title || row.filename,
      status: row.status,
    });
  }

  async function saveDocument() {
    if (!editingDocument) return;
    try {
      const next = await knowledgeApi.updateDocument(editingDocument.id, {
        tenant_id: TENANT_ID,
        title: documentDraft.title,
        status: documentDraft.status,
      });
      setDocuments((current) => current.map((item) => (item.id === next.id ? next : item)));
      setSelectedDocument((current) => (current?.id === next.id ? next : current));
      setEditingDocument(null);
      await loadBuckets(next, false);
      notify.success('已保存文檔');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '保存文檔失敗');
    }
  }

  async function openBucketEditor(row: KnowledgeBucketRead) {
    setEditingBucket(row);
    setBucketDraft({ title: row.title, summary: row.summary });
    try {
      const chunks = await knowledgeApi.bucketChunks(row.id, effectiveAgentId);
      setBucketChunks(chunks);
      setChunkDrafts(
        Object.fromEntries(chunks.map((chunk) => [chunk.id, { content: chunk.content, summary: chunk.summary || '' }])),
      );
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '加載引用來源失敗');
    }
  }

  async function saveBucketAndChunks() {
    if (!editingBucket) return;
    setContentSaving(true);
    try {
      await knowledgeApi.updateBucket(editingBucket.id, {
        tenant_id: TENANT_ID,
        title: bucketDraft.title,
        summary: bucketDraft.summary,
      });
      for (const chunk of bucketChunks) {
        await knowledgeApi.updateChunk(chunk.id, {
          tenant_id: TENANT_ID,
          content: chunkDrafts[chunk.id]?.content ?? chunk.content,
          summary: chunkDrafts[chunk.id]?.summary ?? chunk.summary,
        });
      }
      notify.success('已保存知識內容');
      setEditingBucket(null);
      if (selectedDocument) await loadBuckets(selectedDocument, false);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '保存知識內容失敗');
    } finally {
      setContentSaving(false);
    }
  }

  function renderKnowledgeBaseActions(item: KnowledgeBaseRead) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="知識庫操作"
          className="grid size-7 place-items-center rounded-[8px] text-[#858b9c] transition-colors outline-none hover:bg-black/5 hover:text-[#18181a]"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreOutlined />
        </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
          {canManageCurrentScope && (
            <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => openEditKnowledgeBase(item)}>
              <EditOutlined />
              詳情
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => void openKnowledgeBaseVersions(item)}>
            <HistoryOutlined />
            版本管理
          </DropdownMenuItem>
          <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => void exportOkfBundle(item)}>
            <DownloadOutlined />
            導出知識庫備份包
          </DropdownMenuItem>
          <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={okfLoading} onSelect={() => void lintOkfBundle(item)}>
            <AuditOutlined />
            知識圖譜檢查
          </DropdownMenuItem>
          {!isOverallAgent && (
            <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => void syncKnowledgeBaseFromOverall(item)}>
              從廣場同步
            </DropdownMenuItem>
          )}
          {!isOverallAgent && (
            <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => void promoteKnowledgeBaseToOverall(item)}>
              發佈到廣場
            </DropdownMenuItem>
          )}
          {canManageCurrentScope && (
            <>
              {item.status === 'archived' ? (
                <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => void setKnowledgeBaseStatus(item, true)}>
                  <PlayCircleOutlined />
                  上線
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => void setKnowledgeBaseStatus(item, false)}>
                  <PauseCircleOutlined />
                  下線
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="my-[2px] bg-[#eef0f4]" />
              <DropdownMenuItem variant="destructive" className={MENU_ITEM_DANGER_CLASS} onSelect={() => deleteKnowledgeBase(item)}>
                <DeleteOutlined />
                {isOverallAgent ? '刪除' : '移除'}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const knowledgeBaseColumns: DataTableColumn<KnowledgeBaseRead>[] = [
    {
      key: 'name',
      title: '名稱',
      render: (row) => (
        <div className="min-w-0">
          <strong className="block truncate text-[13px] font-medium text-[#18181a]">{row.name}</strong>
          {row.description ? (
            <span className="mt-[2px] block truncate text-[12px] text-[#858b9c]">{row.description}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'status',
      title: '狀態',
      width: 100,
      render: (row) => statusTag(row.status),
    },
    {
      key: 'creator',
      title: '創建者',
      width: 120,
      render: (row) => (
        <span className="block truncate text-[#858b9c]" title={resourceCreatorName(row)}>
          {resourceCreatorName(row) || '-'}
        </span>
      ),
    },
    {
      key: 'content_stats',
      title: '版本與內容',
      width: 260,
      className: 'whitespace-normal',
      render: (row) => (
        <div className="flex min-w-0 flex-wrap items-center gap-[6px]">
          {row.version ? <KTag>v{row.version}</KTag> : <KTag>無版本</KTag>}
          <KTag>{row.document_count ?? 0} 文檔</KTag>
          <KTag>{row.bucket_count ?? 0} 目錄</KTag>
          <KTag>{row.chunk_count ?? 0} 引用</KTag>
        </div>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 70,
      align: 'right',
      render: (row) => renderKnowledgeBaseActions(row),
    },
  ];

  const renderMobileKnowledgeBaseCard = (item: KnowledgeBaseRead) => (
    <article
      className={cn(
        MOBILE_CARD_CLASS,
        'cursor-pointer',
        selectedKnowledgeBase?.id === item.id && 'ring-2 ring-[#18181a]',
      )}
      key={item.id}
      onClick={() => selectKnowledgeBase(item.id)}
    >
      <div className="flex min-w-0 items-start justify-between gap-[10px]">
        <div className="min-w-0">
          <strong className="block truncate text-[14px] font-semibold text-[#18181a]">{item.name}</strong>
          <span className="mt-[2px] block truncate text-[12px] text-[#858b9c]">{item.description || '未填寫描述'}</span>
          <span className="mt-[2px] block truncate text-[12px] text-[#858b9c]">創建者：{resourceCreatorName(item) || '-'}</span>
        </div>
        <span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          {renderKnowledgeBaseActions(item)}
        </span>
      </div>
      <div className="mt-[10px] flex flex-wrap items-center gap-[6px]">
        {statusTag(item.status)}
        {item.version ? <KTag>v{item.version}</KTag> : null}
        <KTag>{item.document_count} 文檔</KTag>
        <KTag>{item.bucket_count} 目錄</KTag>
        <KTag>{item.chunk_count} 引用</KTag>
      </div>
    </article>
  );

  return (
    <div className="min-h-full box-border px-[48px] pt-[32px] pb-[43px] max-[900px]:px-[16px]" aria-busy={loading}>
      <AppHeader
        onLogout={onLogout}
        userName={currentUser?.username}
        title={pageTitle}
        description={isOverallAgent
          ? '維護知識庫廣場中的知識庫、知識圖譜與檢索調試。'
          : '維護當前數字員工的知識庫、知識圖譜與檢索調試。'}
      />

      <div className="mt-[20px] mb-[16px] flex flex-wrap items-center justify-end gap-[12px]">
        <UIButton
          variant="outline"
          onClick={() => void refresh()}
          disabled={loading}
          className={OUTLINE_ACTION_BUTTON_CLASS}
        >
          <IconRefresh className={cn('size-[14px]', loading && 'animate-spin')} />
          刷新
        </UIButton>
        {canManageCurrentScope && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-[34px] items-center gap-[4px] rounded-[10px] bg-[#18181a] px-[20px] text-[12px] font-normal text-white outline-none transition-colors hover:bg-[#303030]">
              <IconAdd className="size-[14px]" />
              新增
              <IconChevronDown className="size-[12px]" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
              <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => handleCreateAction('blank')}>
                <FileAddOutlined />
                新建知識庫
              </DropdownMenuItem>
              <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => handleCreateAction('okf')}>
                <FileMarkdownOutlined />
                導入知識庫備份包
              </DropdownMenuItem>
              {!isOverallAgent && (
                <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => handleCreateAction('plaza')}>
                  <DownloadOutlined />
                  從廣場複製
                </DropdownMenuItem>
              )}
              {!isOverallAgent && (
                <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => handleCreateAction('employee')}>
                  <TeamOutlined />
                  從數字員工複製
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex flex-col gap-[24px] rounded-[20px_20px_0_0] bg-white p-[18px_18px_24px_18px] shadow-[0_-4px_16px_0_rgba(0,0,0,0.05)]">
        <div className="flex flex-wrap items-stretch gap-[20px]" aria-label="知識庫統計">
          <StatCard label="知識庫總數" value={stats.total} />
          <StatCard label="已上線" value={stats.active} tone="green" />
          <StatCard label="已下線" value={stats.archived} />
          <StatCard label="文檔總數" value={stats.documents} />
        </div>

        <div className="flex flex-col gap-[18px]">
          <div className="flex items-center gap-[6px] px-[12px] text-[#757f9c]">
            <IconFolder className="size-[14px] shrink-0" />
            <span className="text-[14px] font-normal leading-none">{listLabel}</span>
          </div>

          <label className="flex h-[34px] w-[300px] max-w-full items-center gap-[8px] overflow-hidden rounded-[10px] border-[0.5px] border-[#e3e7f1] bg-white px-[12px] transition-colors focus-within:border-[#18181a]">
            <IconSearch className="size-[14px] shrink-0 text-[#858b9c]" />
            <input
              value={documentSearch}
              placeholder="搜索知識庫名稱、描述、狀態或版本"
              onChange={(event) => setDocumentSearch(event.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-[#17191f] outline-none placeholder:text-[#c0c6d4]"
            />
            {documentSearch && (
              <button
                type="button"
                aria-label="清除搜索"
                onClick={() => setDocumentSearch('')}
                className="grid size-[16px] shrink-0 place-items-center text-[#c0c6d4] hover:text-[#858b9c]"
              >
                <IconClear className="size-[14px]" />
              </button>
            )}
          </label>

          <div className="grid gap-[10px] md:hidden">
            {filteredKnowledgeBases.length ? (
              pagination.pagedItems.map(renderMobileKnowledgeBaseCard)
            ) : (
              <div className="py-[40px] text-center text-[13px] text-[#858b9c]">{listEmptyText}</div>
            )}
          </div>

          <div className="hidden md:block">
            <DataTable
              aria-label="知識庫列表"
              columns={knowledgeBaseColumns}
              data={pagination.pagedItems}
              rowKey={(row) => row.id}
              loading={loading}
              emptyText={listEmptyText}
              onRowClick={(row) => selectKnowledgeBase(row.id)}
            />
          </div>

          {filteredKnowledgeBases.length > 0 && (
            <Paginator
              page={pagination.page}
              pageCount={pagination.pageCount}
              onChange={pagination.setPage}
            />
          )}
        </div>
      </div>

      <div className="mt-[16px] flex flex-col gap-[16px]">
        <KCard title="知識圖譜">
          {!selectedDocument ? (
            <EmptyState description="選擇知識庫後查看文檔卡片、知識索引和知識圖譜" />
          ) : (
            <目錄索引Overview
              document={selectedDocument}
              knowledgeBase={selectedKnowledgeBase}
              buckets={buckets}
              okfConcepts={okfConcepts}
              onEditDocument={openEditDocument}
              onEditBucket={openBucketEditor}
              onViewConcept={openConceptViewer}
              onEditConcept={openConceptEditor}
            />
          )}
        </KCard>

        <KCard title="漸進檢索調試">
          <div className="flex w-full flex-col gap-[14px]">
            <div className="flex flex-wrap items-center gap-[10px]">
              <label className={cn(SEARCH_COMBO_CLASS, 'min-w-[280px] flex-1 max-w-[560px]')}>
                <input
                  className={SEARCH_COMBO_INPUT_CLASS}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void runKnowledgeSearch();
                    }
                  }}
                  placeholder="輸入知識問題"
                />
                <button
                  type="button"
                  className={SEARCH_COMBO_BUTTON_CLASS}
                  disabled={searchLoading}
                  onClick={() => void runKnowledgeSearch()}
                >
                  {searchLoading ? '檢索中…' : '檢索'}
                </button>
              </label>
              <ModelConfigDropdown
                models={modelConfigs}
                value={selectedSearchModelId}
                onChange={(modelId) => {
                  setSelectedSearchModelId(modelId);
                  window.localStorage.setItem(`${KNOWLEDGE_SEARCH_MODEL_STORAGE_KEY}:${TENANT_ID}`, modelId);
                }}
                buttonClassName="h-[34px]"
              />
            </div>
            <KnowledgeSearchDebug result={searchResult} loading={searchLoading} />
          </div>
        </KCard>
      </div>

      <ResourceImportDialog
        open={importOpen}
        loading={importLoading}
        icon={<DatabaseOutlined />}
        title={importMode === 'plaza' ? '從廣場複製知識庫' : '從數字員工複製知識庫'}
        sourcePlaceholder={importMode === 'plaza' ? '選擇開放廣場' : '選擇來源員工'}
        sources={importMode === 'plaza'
          ? openGalleryImportSourceOptions(agents, '開放廣場')
          : visibleEmployeeAgents(agents, currentUser, { activeOnly: true, excludeAgentId: agentId })
            .map((item) => ({ value: item.id, label: item.name }))}
        sourceId={importSourceAgentId}
        itemsLabel="選擇知識庫"
        items={importSourceKnowledgeBases.map((item) => ({
          id: item.id,
          label: (
            <>
              {item.name}
              <span className="text-[#858b9c]"> · {item.version || '1.0.0'}</span>
            </>
          ),
        }))}
        selectedIds={importSelectedKnowledgeBaseIds}
        emptyText="沒有可複製的知識庫"
        note={importMode === 'plaza'
          ? '從開放廣場複製可用知識庫；不可複製內容不會出現在列表。'
          : '從數字員工複製可用知識庫；不可見內容不會出現在列表。'}
        submitText="複製"
        onSourceChange={(value) => {
          setImportSourceAgentId(value);
          void loadImportSourceKnowledgeBases(value);
        }}
        onSelectedChange={setImportSelectedKnowledgeBaseIds}
        onClose={() => setImportOpen(false)}
        onSubmit={() => void submitImportKnowledgeBases()}
      />
      <KDialog open={okfImportOpen} title="導入知識庫備份包" onClose={() => setOkfImportOpen(false)}>
        <FileDropzone
          accept=".zip,.md,.markdown"
          disabled={okfImporting}
          onFiles={(files) => files[0] && void importOkfFile(files[0])}
        >
          <FileMarkdownOutlined className="mb-[8px] text-[28px] text-[#1a71ff]" />
          <p className="m-0 text-[14px] font-medium text-foreground">選擇或拖入知識庫備份包（.zip）</p>
          <p className="mt-[4px] mb-0 text-[12px] text-[#858b9c]">導入後會生成知識圖譜、知識索引和引用來源。</p>
        </FileDropzone>
      </KDialog>
      <KDialog
        open={okfLintReportOpen}
        title={okfLintKnowledgeBase ? `知識圖譜檢查：${okfLintKnowledgeBase.name}` : '知識圖譜檢查'}
        width={820}
        onClose={() => setOkfLintReportOpen(false)}
        footer={<KDialogCancelButton onClick={() => setOkfLintReportOpen(false)}>關閉</KDialogCancelButton>}
      >
        <div className="flex flex-col gap-[14px]">
          <p className="text-[13px] leading-[1.6] text-[#858b9c]">
            用於檢查當前知識庫的知識圖譜結構，發現斷鏈、孤立頁、重複主題等問題。檢查結果僅作參考，不會自動修改數據。
          </p>
          {okfLintIssues.length === 0 ? (
            <EmptyState description="知識圖譜檢查通過" />
          ) : (
            <div className="grid gap-[10px] sm:grid-cols-2">
              {okfLintIssues.map((issue, index) => (
                <div
                  className="flex flex-col gap-[6px] rounded-[12px] border border-[#f4d58a] bg-[#fffaf0] p-[12px]"
                  key={`${issue.issue_type || 'issue'}-${issue.concept_id || index}`}
                >
                  <KTag color="gold">{issue.issue_type || 'warning'}</KTag>
                  <strong className="text-[13px] font-semibold wrap-break-word text-[#18181a]">
                    {issue.title || issue.concept_id || '知識圖譜檢查'}
                  </strong>
                  <span className="text-[12px] wrap-break-word text-[#858b9c]">
                    {issue.message || '待處理'}
                  </span>
                  {issue.concept_id ? (
                    <small className="font-mono text-[12px] wrap-break-word text-[#858b9c]">
                      {issue.concept_id}
                    </small>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </KDialog>
      <KDialog
        open={Boolean(viewingConcept)}
        title={viewingConcept ? <WikiViewerTitle concept={viewingConcept} /> : '知識圖譜'}
        width="min(1040px, calc(100vw - 48px))"
        onClose={() => setViewingConcept(null)}
        footer={(
          <>
            <KDialogCancelButton onClick={() => setViewingConcept(null)}>關閉</KDialogCancelButton>
            <KDialogPrimaryButton onClick={editViewingConcept}>
              <EditOutlined />
              編輯知識圖譜
            </KDialogPrimaryButton>
          </>
        )}
      >
        {viewingConcept && <WikiConceptViewer concept={viewingConcept} />}
      </KDialog>
      <KDialog
        open={Boolean(editingConcept)}
        title={
          editingConcept ? (
            <div className="flex min-w-0 flex-col gap-[4px]">
              <span className="text-[13px] font-semibold text-[#858b9c]">編輯知識圖譜</span>
              <strong className="line-clamp-2 text-[20px] font-semibold leading-[1.35] text-[#18181a]">
                {conceptEditorTitle || editingConcept.concept_id}
              </strong>
            </div>
          ) : (
            '編輯知識圖譜'
          )
        }
        width="min(1120px, calc(100vw - 48px))"
        onClose={() => setEditingConcept(null)}
        footer={(
          <>
            <KDialogCancelButton onClick={() => setEditingConcept(null)} />
            <KDialogPrimaryButton onClick={() => void saveConcept()}>保存</KDialogPrimaryButton>
          </>
        )}
      >
        {editingConcept && (
          <div className="grid min-w-0 grid-cols-1 gap-[16px] lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="flex flex-col gap-[16px] rounded-[12px] border border-[#eceef1] bg-[#fafbfc] p-[16px]">
              <div className="inline-flex w-fit items-center gap-[8px] rounded-[10px] border border-[#1a71ff]/25 bg-[#1a71ff]/8 px-[11px] py-[8px] text-[13px] font-medium text-[#1a71ff]">
                <FileMarkdownOutlined />
                <span>{conceptTypeLabel(conceptEditorType)}</span>
              </div>
              <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-[12px] gap-y-[10px]">
                <span className="text-[12px] font-semibold text-[#858b9c]">頁面路徑</span>
                <strong className="text-[13px] wrap-break-word text-[#18181a]">{editingConcept.concept_id}</strong>
                <span className="text-[12px] font-semibold text-[#858b9c]">鏈接</span>
                <strong className="text-[13px] text-[#18181a]">{editingConcept.links.length} 個</strong>
                <span className="text-[12px] font-semibold text-[#858b9c]">引用</span>
                <strong className="text-[13px] text-[#18181a]">{editingConcept.citations.length} 個</strong>
                <span className="text-[12px] font-semibold text-[#858b9c]">更新時間</span>
                <strong className="text-[13px] text-[#18181a]">{formatDateTime(editingConcept.updated_at)}</strong>
              </div>
              <div className="rounded-[12px] border border-[#eceef1] bg-white p-[12px] text-[13px] leading-[1.65] text-[#858b9c]">
                知識圖譜以結構化文本保存，標題和摘要會同步寫入內容。
              </div>
            </aside>
            <section className="flex min-w-0 flex-col gap-[16px]">
              <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.6fr)]">
                <label className="flex flex-col gap-[8px]">
                  <span className="text-[13px] font-semibold text-[#464c5e]">頁面標題</span>
                  <Input
                    value={conceptEditorTitle}
                    onChange={(event) =>
                      setConceptDraft((prev) => updateOkfFrontmatterValue(prev, 'title', event.target.value))
                    }
                    placeholder="知識圖譜標題"
                  />
                </label>
                <label className="flex flex-col gap-[8px]">
                  <span className="text-[13px] font-semibold text-[#464c5e]">頁面類型</span>
                  <UISelect
                    value={conceptEditorType}
                    onValueChange={(value) => setConceptDraft((prev) => updateOkfFrontmatterValue(prev, 'type', value))}
                  >
                    <SelectTrigger className={cn(SELECT_TRIGGER_CLASS, 'w-full')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(CONCEPT_TYPE_LABELS.entries()).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </UISelect>
                </label>
                <label className="flex flex-col gap-[8px] sm:col-span-full">
                  <span className="text-[13px] font-semibold text-[#464c5e]">頁面摘要</span>
                  <Textarea
                    value={conceptEditorDescription}
                    rows={3}
                    onChange={(event) =>
                      setConceptDraft((prev) => updateOkfFrontmatterValue(prev, 'description', event.target.value))
                    }
                    placeholder="說明這個知識圖譜沉澱了什麼知識"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-[8px]">
                <span className="text-[13px] font-semibold text-[#464c5e]">知識圖譜源碼</span>
                <Textarea
                  className="min-h-[420px] resize-y font-mono text-[13px] leading-[1.55]"
                  value={conceptDraft}
                  rows={18}
                  onChange={(event) => setConceptDraft(event.target.value)}
                  spellCheck={false}
                />
              </label>
            </section>
          </div>
        )}
      </KDialog>
      <KDialog
        open={Boolean(editingKnowledgeBase)}
        title="知識庫詳情"
        onClose={() => setEditingKnowledgeBase(null)}
        footer={(
          <>
            <KDialogCancelButton onClick={() => setEditingKnowledgeBase(null)} />
            <KDialogPrimaryButton onClick={() => void saveKnowledgeBase()}>保存</KDialogPrimaryButton>
          </>
        )}
      >
        <div className="flex w-full flex-col gap-[12px]">
          <Input
            value={knowledgeBaseDraft.name}
            onChange={(event) => setKnowledgeBaseDraft((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="知識庫名稱"
          />
          <Textarea
            rows={4}
            value={knowledgeBaseDraft.description}
            onChange={(event) => setKnowledgeBaseDraft((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="知識庫描述"
          />
          <UISelect
            value={knowledgeBaseDraft.status}
            onValueChange={(value) => setKnowledgeBaseDraft((prev) => ({ ...prev, status: value }))}
          >
            <SelectTrigger className={cn(SELECT_TRIGGER_CLASS, 'w-full')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">上線</SelectItem>
              <SelectItem value="archived">下線</SelectItem>
            </SelectContent>
          </UISelect>
        </div>
      </KDialog>
      <KDialog
        open={Boolean(versionKnowledgeBase)}
        title={versionKnowledgeBase ? `版本管理：${versionKnowledgeBase.name}` : '版本管理'}
        width={840}
        onClose={() => setVersionKnowledgeBase(null)}
        footer={<KDialogCancelButton onClick={() => setVersionKnowledgeBase(null)}>關閉</KDialogCancelButton>}
      >
        <DataTable
          aria-label="版本列表"
          rowKey={(row) => row.id}
          data={knowledgeBaseVersions}
          emptyText="暫無版本記錄"
          columns={[
            { key: 'version', title: '版本', render: (row) => row.version },
            { key: 'name', title: '名稱', render: (row) => row.name },
            { key: 'status', title: '狀態', render: (row) => statusTag(String(row.status)) },
            { key: 'is_head', title: 'Head', render: (row) => (row.is_head ? <KTag color="green">當前</KTag> : null) },
            { key: 'updated_at', title: '更新時間', render: (row) => String(row.updated_at).slice(0, 10) },
            {
              key: 'actions',
              title: '操作',
              width: 96,
              render: (row) =>
                !isOverallAgent && !row.is_head ? (
                  <UIButton variant="outline" size="sm" onClick={() => void rollbackKnowledgeBaseVersion(row)}>
                    回滾
                  </UIButton>
                ) : null,
            },
          ] as DataTableColumn<KnowledgeBaseVersionRead>[]}
        />
      </KDialog>
      <KDialog
        open={Boolean(editingDocument)}
        title="編輯文檔"
        onClose={() => setEditingDocument(null)}
        footer={(
          <>
            <KDialogCancelButton onClick={() => setEditingDocument(null)} />
            <KDialogPrimaryButton onClick={() => void saveDocument()}>保存</KDialogPrimaryButton>
          </>
        )}
      >
        <div className="flex w-full flex-col gap-[12px]">
          <Input
            value={documentDraft.title}
            onChange={(event) => setDocumentDraft((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="文檔標題"
          />
          <UISelect
            value={documentDraft.status}
            onValueChange={(value) => setDocumentDraft((prev) => ({ ...prev, status: value }))}
          >
            <SelectTrigger className={cn(SELECT_TRIGGER_CLASS, 'w-full')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ready">可用</SelectItem>
              <SelectItem value="processing">處理中</SelectItem>
              <SelectItem value="failed">失敗</SelectItem>
              <SelectItem value="archived">下線</SelectItem>
            </SelectContent>
          </UISelect>
        </div>
      </KDialog>
      <KDialog
        open={Boolean(editingBucket)}
        title="編輯內部索引與引用來源"
        width={920}
        onClose={() => setEditingBucket(null)}
        footer={(
          <>
            <KDialogCancelButton disabled={contentSaving} onClick={() => setEditingBucket(null)} />
            <KDialogPrimaryButton disabled={contentSaving} onClick={() => void saveBucketAndChunks()}>保存</KDialogPrimaryButton>
          </>
        )}
      >
        <div className="flex w-full flex-col gap-[14px]">
          <Input
            value={bucketDraft.title}
            onChange={(event) => setBucketDraft((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="內部索引標題"
          />
          <Textarea
            rows={4}
            value={bucketDraft.summary}
            onChange={(event) => setBucketDraft((prev) => ({ ...prev, summary: event.target.value }))}
            placeholder="內部索引摘要"
          />
          <div className="flex flex-col gap-[12px]">
            {bucketChunks.map((chunk) => (
              <div
                className="flex flex-col gap-[10px] rounded-[12px] border border-[#eceef1] bg-[#fafbfc] p-[12px]"
                key={chunk.id}
              >
                <div className="flex items-center justify-between gap-[10px]">
                  <strong className="text-[13px] font-semibold text-[#18181a]">引用來源 {chunk.chunk_index + 1}</strong>
                  <KTag>{chunk.source_ref || 'chunk'}</KTag>
                </div>
                <Textarea
                  rows={2}
                  value={chunkDrafts[chunk.id]?.summary || ''}
                  onChange={(event) =>
                    setChunkDrafts((prev) => ({
                      ...prev,
                      [chunk.id]: { ...(prev[chunk.id] || { content: chunk.content, summary: '' }), summary: event.target.value },
                    }))
                  }
                  placeholder="引用來源摘要"
                />
                <Textarea
                  rows={6}
                  value={chunkDrafts[chunk.id]?.content || ''}
                  onChange={(event) =>
                    setChunkDrafts((prev) => ({
                      ...prev,
                      [chunk.id]: { ...(prev[chunk.id] || { content: '', summary: chunk.summary || '' }), content: event.target.value },
                    }))
                  }
                  placeholder="引用來源內容"
                />
              </div>
            ))}
          </div>
        </div>
      </KDialog>

      <ConfirmDialog
        open={Boolean(deleteKbTarget)}
        onOpenChange={(open) => !open && setDeleteKbTarget(null)}
        title={deleteKbTarget ? `${isOverallAgent ? '刪除' : '移除'}知識庫：${deleteKbTarget.name}` : ''}
        description={!isOverallAgent
          ? '這隻會在當前數字員工中隱藏該知識庫；開放廣場和其他數字員工仍然保留。'
          : '開放廣場會永久刪除該知識庫及其文檔、內部索引、引用來源和版本記錄。'}
        confirmText={isOverallAgent ? '刪除' : '移除'}
        onConfirm={() => void runDeleteKnowledgeBase()}
      />
    </div>
  );
}

