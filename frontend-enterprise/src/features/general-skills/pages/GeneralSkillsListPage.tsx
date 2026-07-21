import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  GithubOutlined,
  PlusOutlined,
  TeamOutlined,
  UploadOutlined,
} from '@/icons';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Ban, CircleCheck, Copy, Users } from 'lucide-react';
import { ContextMenu } from 'radix-ui';

import { api, streamPost, TENANT_ID } from '@/api/client';
import { isEnterpriseAdmin, type EnterpriseAuthUser } from '@/auth';
import AppHeader from '@/components/AppHeader';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { ModelConfigDropdown } from '@/components/ModelConfigDropdown';
import { Paginator } from '@/components/Paginator';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { Button as UIButton } from '@/components/ui/button';
import { notify } from '@/components/ui/app-toast';
import { cn } from '@/lib/utils';
import {
  Field,
  SectionCard as BaseSectionCard,
  type SectionCardProps,
} from '@/components/form/SectionCard';
import {
  MENU_CONTENT_CLASS,
  MENU_ITEM_CLASS,
  MENU_ITEM_DANGER_CLASS,
  MOBILE_CARD_CLASS,
  SELECT_TRIGGER_CLASS,
  formatDateTime,
} from '@/lib/enterprise-ui';
import { StatCard } from '@/components/StatCard';
import { ResourceImportDialog } from '@/components/ResourceImportDialog';
import CodeBlock, { renderCodeTokens } from '@/components/CodeBlock';
import IconAdd from '@/assets/icons/add.svg?react';
import IconArrowRight from '@/assets/icons/arrow-right.svg?react';
import IconFolder from '@/assets/icons/cap-folder.svg?react';
import IconMagicWand from '@/assets/icons/cap-magicwand.svg?react';
import IconChevronDown from '@/assets/icons/chevron-down.svg?react';
import IconPlay from '@/assets/icons/play.svg?react';
import IconClear from '@/assets/icons/field-clear.svg?react';
import IconEdit from '@/assets/icons/edit.svg?react';
import IconMore from '@/assets/icons/more.svg?react';
import IconRefresh from '@/assets/icons/refresh.svg?react';
import IconProfileFile from '@/assets/icons/profile-file.svg?react';
import IconSearch from '@/assets/icons/search.svg?react';
import IconSkill from '@/assets/icons/plaza-skill.svg?react';
import IconTrash from '@/assets/icons/trash.svg?react';
import {
  canManageEmployeeAgent,
  openGalleryAgentId,
  openGalleryImportSourceOptions,
  resourceCreatorName,
  visibleEmployeeAgents,
} from '@/employee';
import { useClientPagination } from '@/hooks/useClientPagination';
import { StatusBadge } from '@/pages/scheduled-tasks/StatusBadge';
import type { BadgeTone } from '@/pages/scheduled-tasks/shared';
import type { AgentProfileRead, GeneralSkillRead, GeneralSkillRunResponse, ModelConfigRead } from '@/types';

import { ENTERPRISE_AGENT_STORAGE_KEY } from '@/lib/agent-scope-storage';
import { DroppedSkillFile, EMPTY_SKILL_MARKDOWN, FOLDER_INPUT_PROPS, GENERAL_SKILL_PAGE_SIZE, GENERAL_SKILL_RUN_MODEL_STORAGE_KEY, GENERAL_SKILL_RUN_TIMEOUT_MS, GeneralSkillFile, GeneralSkillImportMode, GeneralSkillPageProps, PHASE_LABELS, STATUS_BADGE, SkillDirectoryEntry, SkillFileEntry, SkillFileSystemEntry } from '../types';
import { DELETE_BUTTON_CLASS, EDITOR_ACTION_OUTLINE_CLASS, EDITOR_ACTION_PRIMARY_CLASS, HIDDEN_FILE_INPUT_CLASS, PRIMARY_BUTTON_CLASS, RETURN_BUTTON_CLASS, SECTION_CARD_CLASS, SECTION_CARD_TITLE_CLASS, SKILL_CODE_BLOCK_CLASS, SKILL_CODE_EDITOR_CLASS, SKILL_CODE_HIGHLIGHT_CLASS, SKILL_CODE_HIGHLIGHT_CODE_CLASS, SKILL_CODE_INPUT_CLASS, SKILL_DROP_HINT_CLASS, SKILL_EDITOR_DRAG_ACTIVE_CLASS, SKILL_FILE_EDITOR_CLASS, SKILL_FILE_PANE_CLASS, SKILL_FILE_TAB_CLASS, SKILL_FILE_TREE_ACTIONS_CLASS, SKILL_FILE_TREE_CLASS, SKILL_FILE_TREE_HEADER_CLASS, SKILL_FILE_TREE_LIST_CLASS, SKILL_OUTPUT_STACK_CLASS, SKILL_REPLY_PANEL_CLASS, SKILL_REPLY_TEXT_CLASS, SKILL_RESULT_LAYOUT_CLASS, SKILL_SECTION_LABEL_CLASS, SKILL_TRACE_CODE_DETAILS_CLASS, SKILL_TRACE_CODE_SUMMARY_CLASS, SKILL_TRACE_DOT_CLASS, SKILL_TRACE_ITEM_BODY_CLASS, SKILL_TRACE_ITEM_CLASS, SKILL_TRACE_LIST_CLASS, SKILL_TRACE_MESSAGE_CLASS, SKILL_TRACE_TITLE_CLASS, skillFileNodeClass } from '../styles';
import { applyMetadata, codeLanguage, collectDroppedEntryFiles, dataTransferEntry, droppedSkillFiles, fileToBase64, formatJson, isAbortError, isSkillPackageArchive, languageFromFilePath, normalizeSkillFilePath, normalizedSkillFiles, packagePath, packagePathFromRaw, parseMetadata, readDirectoryEntries, readEntryFile, resultSucceeded, traceDetail, traceItemCode } from '../lib/skillFiles';
import { SectionCard } from '../components/SectionCard';
import { RunCodePanel } from '../components/RunCodePanel';
import { TraceDisclosureLabel } from '../components/TraceDisclosureLabel';
import { ClawHubDialog } from '../components/ClawHubDialog';

export default function GeneralSkillsListPage({ embedded = false, currentUser, onLogout }: { embedded?: boolean } & GeneralSkillPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<GeneralSkillRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | GeneralSkillRead['status']>('all');
  const [agentId, setAgentId] = useState(() => window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) || '');
  const [isOverallAgent, setIsOverallAgent] = useState(true);
  const [agents, setAgents] = useState<AgentProfileRead[]>([]);
  const [clawhubModalOpen, setClawhubModalOpen] = useState(false);
  const [clawhubSource, setClawhubSource] = useState('');
  const [clawhubLoading, setClawhubLoading] = useState(false);
  const clawhubAbortRef = useRef<AbortController | null>(null);
  const [agentImportOpen, setAgentImportOpen] = useState(false);
  const [agentImportMode, setAgentImportMode] = useState<GeneralSkillImportMode>('plaza');
  const [agentImportLoading, setAgentImportLoading] = useState(false);
  const [agentImportAgents, setAgentImportAgents] = useState<AgentProfileRead[]>([]);
  const [agentImportSourceAgentId, setAgentImportSourceAgentId] = useState('');
  const [agentImportSourceSkills, setAgentImportSourceSkills] = useState<GeneralSkillRead[]>([]);
  const [agentImportSelectedSkillIds, setAgentImportSelectedSkillIds] = useState<string[]>([]);
  const [agentScopeLoaded, setAgentScopeLoaded] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GeneralSkillRead | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pageTitle = isOverallAgent ? '技能廣場' : '技能';
  const listLabel = isOverallAgent ? '技能廣場列表' : '技能列表';
  const currentAgent = useMemo(() => agents.find((item) => item.id === agentId), [agents, agentId]);
  const canManageCurrentScope = currentAgent
    ? canManageEmployeeAgent(currentAgent, currentUser)
    : isEnterpriseAdmin(currentUser) && isOverallAgent;

  const load = () => {
    const agentSuffix = agentId ? `&agent_id=${encodeURIComponent(agentId)}` : '';
    setLoading(true);
    return api
      .get<GeneralSkillRead[]>(`/api/enterprise/general-skills?tenant_id=${TENANT_ID}${agentSuffix}`)
      .then(setRows)
      .catch((error) => notify.error(error.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  useEffect(() => {
    api
      .get<AgentProfileRead[]>(`/api/enterprise/agents?tenant_id=${TENANT_ID}`)
      .then((items) => {
        setAgents(items);
        setIsOverallAgent(Boolean(items.find((item) => item.id === agentId)?.is_overall ?? true));
        setAgentScopeLoaded(true);
      })
      .catch(() => {
        setIsOverallAgent(true);
        setAgentScopeLoaded(true);
      });
  }, [agentId]);

  useEffect(() => {
    if (searchParams.get('add') !== 'plaza') return;
    if (!agentScopeLoaded) return;
    const resourceId = searchParams.get('resourceId') || undefined;
    if (isOverallAgent) {
      notify.warning('請先選擇一個數字員工，再從廣場複製技能');
    } else {
      void requestAgentImport('plaza', resourceId);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('add');
    next.delete('resourceId');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentScopeLoaded, isOverallAgent, searchParams, setSearchParams]);

  useEffect(() => {
    const onScopeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ agentId?: string }>).detail;
      setAgentId(detail?.agentId || window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) || '');
    };
    window.addEventListener('ultrarag-enterprise-agent-scope-change', onScopeChange);
    return () => window.removeEventListener('ultrarag-enterprise-agent-scope-change', onScopeChange);
  }, []);

  const filteredRows = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
      const haystack = [
        row.name,
        row.slug,
        row.description,
        row.homepage,
        resourceCreatorName(row),
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus && (!keyword || haystack.includes(keyword));
    });
  }, [rows, searchText, statusFilter]);

  const pagination = useClientPagination(filteredRows, GENERAL_SKILL_PAGE_SIZE, `${searchText}|${statusFilter}`);

  const stats = useMemo(() => ({
    total: rows.length,
    published: rows.filter((row) => row.status === 'published').length,
    draft: rows.filter((row) => row.status === 'draft').length,
    archived: rows.filter((row) => row.status === 'archived').length,
  }), [rows]);

  async function setSkillPublished(row: GeneralSkillRead, published: boolean) {
    try {
      const agentSuffix = agentId ? `&agent_id=${encodeURIComponent(agentId)}` : '';
      const next = await api.post<GeneralSkillRead>(
        `/api/enterprise/general-skills/${row.slug}/${published ? 'publish' : 'archive'}?tenant_id=${TENANT_ID}${agentSuffix}`,
      );
      setRows((current) => current.map((item) => (item.id === next.id ? next : item)));
      notify.success(published ? '已啟用技能' : '已停用技能');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : published ? '啟用失敗' : '停用失敗');
    }
  }

  async function confirmDeleteSkill() {
    const row = deleteTarget;
    if (!row) return;
    const branchMode = !isOverallAgent;
    setDeleting(true);
    try {
      const agentSuffix = agentId ? `&agent_id=${encodeURIComponent(agentId)}` : '';
      await api.delete(`/api/enterprise/general-skills/${row.slug}?tenant_id=${TENANT_ID}${agentSuffix}`);
      setRows((current) => current.filter((item) => item.id !== row.id));
      notify.success(branchMode ? '已移除技能' : '已刪除技能');
      setDeleteTarget(null);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : branchMode ? '移除失敗' : '刪除失敗');
    } finally {
      setDeleting(false);
    }
  }

  function requestClawHubImport() {
    clawhubAbortRef.current?.abort();
    clawhubAbortRef.current = null;
    setClawhubLoading(false);
    setClawhubSource('');
    setClawhubModalOpen(true);
  }

  function cancelClawHubImport() {
    clawhubAbortRef.current?.abort();
    clawhubAbortRef.current = null;
    setClawhubLoading(false);
    setClawhubModalOpen(false);
  }

  async function requestAgentImport(mode: GeneralSkillImportMode, selectedResourceId?: string) {
    try {
      const agents = await api.get<AgentProfileRead[]>(`/api/enterprise/agents?tenant_id=${TENANT_ID}`);
      const firstSource = mode === 'plaza'
        ? openGalleryAgentId(agents)
        : visibleEmployeeAgents(agents, currentUser, { activeOnly: true, excludeAgentId: agentId })[0]?.id || '';
      setAgentImportMode(mode);
      setAgentImportAgents(agents);
      setAgentImportSourceAgentId(firstSource);
      setAgentImportSelectedSkillIds([]);
      setAgentImportOpen(true);
      if (firstSource) {
        const sourceRows = await loadAgentImportSourceSkills(firstSource);
        if (selectedResourceId && sourceRows.some((item) => item.id === selectedResourceId)) {
          setAgentImportSelectedSkillIds([selectedResourceId]);
        }
      } else {
        setAgentImportSourceSkills([]);
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '加載員工列表失敗');
    }
  }

  async function loadAgentImportSourceSkills(sourceAgentId: string): Promise<GeneralSkillRead[]> {
    setAgentImportSourceSkills([]);
    setAgentImportSelectedSkillIds([]);
    if (!sourceAgentId) return [];
    try {
      const sourceRows = await api.get<GeneralSkillRead[]>(
        `/api/enterprise/general-skills?tenant_id=${TENANT_ID}&agent_id=${encodeURIComponent(sourceAgentId)}`,
      );
      const existingIds = new Set(rows.map((item) => item.id));
      const publishedRows = sourceRows.filter((item) => item.status === 'published' && !existingIds.has(item.id));
      setAgentImportSourceSkills(publishedRows);
      return publishedRows;
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '加載來源技能失敗');
      return [];
    }
  }

  async function submitAgentImportSkills() {
    if (!agentId) {
      notify.warning('請先選擇一個數字員工');
      return;
    }
    if (!agentImportSourceAgentId) {
      notify.warning(agentImportMode === 'plaza' ? '請選擇開放廣場' : '請選擇複製來源');
      return;
    }
    if (!agentImportSelectedSkillIds.length) {
      notify.warning('請選擇要複製的技能');
      return;
    }
    setAgentImportLoading(true);
    try {
      await api.post(`/api/enterprise/agents/${encodeURIComponent(agentId)}/resources/import`, {
        tenant_id: TENANT_ID,
        source_agent_id: agentImportSourceAgentId,
        resource_type: 'general_skill',
        resource_ids: agentImportSelectedSkillIds,
      });
      notify.success(`已複製 ${agentImportSelectedSkillIds.length} 個技能`);
      setAgentImportOpen(false);
      await load();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '複製技能失敗');
    } finally {
      setAgentImportLoading(false);
    }
  }

  async function importClawHubSource() {
    if (!clawhubSource.trim()) {
      notify.warning('請輸入開源平臺地址、GitHub 倉庫或 SKILL.md 鏈接');
      return;
    }
    const controller = new AbortController();
    clawhubAbortRef.current?.abort();
    clawhubAbortRef.current = controller;
    setClawhubLoading(true);
    try {
      const row = await api.postWithSignal<GeneralSkillRead>('/api/enterprise/general-skills/import-skillhub', {
        tenant_id: TENANT_ID,
        agent_id: !isOverallAgent && agentId ? agentId : undefined,
        source: clawhubSource.trim(),
        status: 'published',
      }, controller.signal);
      if (controller.signal.aborted) return;
      notify.success(`已新增 ${row.name}`);
      setRows((current) => [row, ...current.filter((item) => item.id !== row.id && item.slug !== row.slug)]);
      setClawhubModalOpen(false);
      navigate(`/enterprise/general-skills/${encodeURIComponent(row.slug)}/edit`);
    } catch (error) {
      if (isAbortError(error)) {
        notify.info('已取消導入');
        return;
      }
      notify.error(error instanceof Error ? error.message : '從開源平臺導入失敗');
    } finally {
      if (clawhubAbortRef.current === controller) {
        clawhubAbortRef.current = null;
        setClawhubLoading(false);
      }
    }
  }

  function renderActions(row: GeneralSkillRead) {
    const published = row.status === 'published';
    if (isOverallAgent && !canManageCurrentScope) {
      return null;
    }
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="技能操作"
          className="ml-auto grid size-7 place-items-center rounded-[8px] text-[#1a71ff] transition-colors outline-none hover:bg-black/5 hover:text-[#4a8dff] focus-visible:bg-black/5"
        >
          <IconMore className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
          <DropdownMenuItem
            className={MENU_ITEM_CLASS}
            onSelect={() => navigate(`/enterprise/general-skills/${encodeURIComponent(row.slug)}/edit`)}
          >
            <IconEdit />
            {isOverallAgent ? '編輯' : '編輯本地版本'}
          </DropdownMenuItem>
          {published ? (
            <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => void setSkillPublished(row, false)}>
              <Ban />
              停用
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => void setSkillPublished(row, true)}>
              <CircleCheck />
              啟用
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="my-[2px] bg-[#eef0f4]" />
          <DropdownMenuItem
            variant="destructive"
            className={MENU_ITEM_DANGER_CLASS}
            onSelect={() => setDeleteTarget(row)}
          >
            <IconTrash />
            {isOverallAgent ? '刪除' : '移除'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const columns: DataTableColumn<GeneralSkillRead>[] = [
    {
      key: 'name',
      title: '名稱',
      width: 200,
      className: 'text-[#18181a]',
      render: (row) => (
        <div className="flex min-w-0 flex-col gap-[2px]">
          <span className="truncate font-medium leading-[18px] text-[#18181a]" title={row.name}>
            {row.name}
          </span>
          <span className="truncate text-[#858b9c]" title={row.slug}>
            {row.slug}
          </span>
        </div>
      ),
    },
    {
      key: 'description',
      title: '描述',
      className: 'whitespace-normal',
      render: (row) => <span className="line-clamp-2 wrap-break-word">{row.description || '暫無描述'}</span>,
    },
    {
      key: 'files',
      title: '文件',
      width: 90,
      render: (row) => `${row.skill_files?.length || 1} 個`,
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
      key: 'status',
      title: '狀態',
      width: 100,
      render: (row) => {
        const preset = STATUS_BADGE[row.status] || { tone: 'gray' as BadgeTone, text: row.status };
        return <StatusBadge tone={preset.tone}>{preset.text}</StatusBadge>;
      },
    },
    {
      key: 'updated',
      title: '更新時間',
      width: 170,
      render: (row) => formatDateTime(row.updated_at),
    },
    {
      key: 'actions',
      title: '操作',
      width: 70,
      align: 'right',
      render: (row) => renderActions(row),
    },
  ];

  const renderMobileCard = (row: GeneralSkillRead) => {
    const preset = STATUS_BADGE[row.status] || { tone: 'gray' as BadgeTone, text: row.status };
    return (
      <article className={MOBILE_CARD_CLASS} key={row.id}>
        <div className="flex min-w-0 items-start justify-between gap-[10px]">
          <div className="min-w-0">
            <strong className="block truncate text-[14px] font-semibold text-[#18181a]">{row.name}</strong>
            <span className="mt-[2px] block truncate text-[12px] text-[#858b9c]">{row.slug}</span>
            <span className="mt-[2px] block truncate text-[12px] text-[#858b9c]">創建者：{resourceCreatorName(row) || '-'}</span>
          </div>
          {renderActions(row)}
        </div>
        {row.description && (
          <p className="mt-[8px] line-clamp-2 text-[12px] leading-[1.55] text-[#858b9c]">{row.description}</p>
        )}
        <div className="mt-[10px] flex items-center justify-between gap-[10px] text-[12px] text-[#858b9c]">
          <StatusBadge tone={preset.tone}>{preset.text}</StatusBadge>
          <span>{row.skill_files?.length || 1} 個文件 · {formatDateTime(row.updated_at)}</span>
        </div>
      </article>
    );
  };

  const listEmptyText = isOverallAgent
    ? canManageCurrentScope ? '暫無技能，點擊「新增」創建一個吧' : '暫無技能'
    : '當前員工暫無技能';

  return (
    <div className={embedded ? undefined : 'min-h-full box-border px-[48px] pt-[32px] pb-[43px] max-[900px]:px-[16px]'}>
      {!embedded && (
        <>
          <AppHeader onLogout={onLogout} userName={currentUser?.username} title={pageTitle} />
          <div className="mt-[20px] mb-[16px] flex items-center justify-end gap-[12px]">
            <UIButton
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
              className="h-[34px] gap-[4px] rounded-[10px] border-[0.5px] border-[#e3e7f1] bg-white px-[20px] text-[12px] font-normal text-[#757f9c] hover:border-[#cbd3e6] hover:bg-white hover:text-[#18181a]"
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
                  <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => navigate('/enterprise/general-skills/new')}>
                    <IconAdd />
                    新建技能
                  </DropdownMenuItem>
                  {!isOverallAgent && (
                    <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => void requestAgentImport('plaza')}>
                      <Copy />
                      從廣場複製
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => requestClawHubImport()}>
                    <GithubOutlined />
                    從開源平臺導入
                  </DropdownMenuItem>
                  {!isOverallAgent && (
                    <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => void requestAgentImport('employee')}>
                      <Users />
                      從數字員工複製
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </>
      )}

      <div className="flex flex-col gap-[24px] rounded-[20px_20px_0_0] bg-[#FFF] p-[18px] shadow-[0_-4px_16px_0_rgba(0,0,0,0.05)]">
        <div className="flex flex-wrap items-stretch gap-[20px]" aria-label="技能統計">
          <StatCard label="技能總數" value={stats.total} />
          <StatCard label="已啟用" value={stats.published} tone="green" />
          <StatCard label="草稿" value={stats.draft} />
          <StatCard label="已停用" value={stats.archived} />
        </div>

        <div className="flex flex-col gap-[18px]">
          <div className="flex items-center gap-[6px] px-[12px] text-[#757f9c]">
            <IconMagicWand className="size-[14px] shrink-0" />
            <span className="text-[14px] font-normal leading-none">{listLabel}</span>
          </div>

          <div className="flex flex-wrap items-center gap-[16px]">
            <label className="flex h-[34px] w-[300px] items-center gap-[8px] overflow-hidden rounded-[10px] border-[0.5px] border-[#e3e7f1] bg-white px-[12px] transition-colors focus-within:border-[#18181a] max-[900px]:w-full">
              <IconSearch className="size-[14px] shrink-0 text-[#858b9c]" />
              <input
                value={searchText}
                placeholder="搜索技能名稱、Slug、描述或主頁"
                onChange={(event) => setSearchText(event.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-[#17191f] outline-none placeholder:text-[#c0c6d4]"
              />
              {searchText && (
                <button
                  type="button"
                  aria-label="清除搜索"
                  onClick={() => setSearchText('')}
                  className="grid size-[16px] shrink-0 place-items-center text-[#c0c6d4] hover:text-[#858b9c]"
                >
                  <IconClear className="size-[14px]" />
                </button>
              )}
            </label>
            <UISelect value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | GeneralSkillRead['status'])}>
              <SelectTrigger className={cn(SELECT_TRIGGER_CLASS, 'w-[130px]')} aria-label="狀態篩選">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                <SelectItem value="published">已啟用</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="archived">已停用</SelectItem>
              </SelectContent>
            </UISelect>
          </div>

          <div className="grid gap-[10px] md:hidden">
            {filteredRows.length ? (
              pagination.pagedItems.map(renderMobileCard)
            ) : (
              <div className="py-[40px] text-center text-[13px] text-[#858b9c]">{listEmptyText}</div>
            )}
          </div>

          <div className="hidden md:block">
            <DataTable
              aria-label="技能列表"
              columns={columns}
              data={pagination.pagedItems}
              rowKey={(row) => row.id}
              loading={loading}
              emptyText={listEmptyText}
            />
          </div>

          {filteredRows.length > 0 && (
            <Paginator
              aria-label="技能分頁"
              className="mt-0 mb-[6px]"
              page={pagination.page}
              pageCount={pagination.pageCount}
              onChange={pagination.setPage}
            />
          )}
        </div>
      </div>

      <ClawHubDialog
        open={clawhubModalOpen}
        loading={clawhubLoading}
        source={clawhubSource}
        onSourceChange={setClawhubSource}
        onClose={cancelClawHubImport}
        onSubmit={() => void importClawHubSource()}
      />

      <ResourceImportDialog
        open={agentImportOpen}
        loading={agentImportLoading}
        icon={<IconSkill className="size-[14px] shrink-0" />}
        title={agentImportMode === 'plaza' ? '從廣場複製技能' : '從數字員工複製技能'}
        sourcePlaceholder={agentImportMode === 'plaza' ? '選擇開放廣場' : '選擇複製來源'}
        sources={agentImportMode === 'plaza'
          ? openGalleryImportSourceOptions(agentImportAgents, '開放廣場')
          : visibleEmployeeAgents(agentImportAgents, currentUser, { activeOnly: true, excludeAgentId: agentId })
            .map((item) => ({ value: item.id, label: item.name }))}
        sourceId={agentImportSourceAgentId}
        itemsLabel="選擇技能"
        items={agentImportSourceSkills.map((item) => ({
          id: item.id,
          label: (
            <>
              {item.name}
              <span className="text-[#858b9c]"> · {item.slug}</span>
            </>
          ),
        }))}
        selectedIds={agentImportSelectedSkillIds}
        emptyText="沒有可複製的技能"
        note={
          agentImportMode === 'plaza'
            ? '從開放廣場複製可用技能；不可複製內容不會出現在列表。'
            : '從數字員工複製可用技能；不可見內容不會出現在列表。'
        }
        onSourceChange={(value) => {
          setAgentImportSourceAgentId(value);
          void loadAgentImportSourceSkills(value);
        }}
        onSelectedChange={setAgentImportSelectedSkillIds}
        onClose={() => setAgentImportOpen(false)}
        onSubmit={() => void submitAgentImportSkills()}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        loading={deleting}
        title={deleteTarget ? `${isOverallAgent ? '刪除' : '移除'}技能「${deleteTarget.name}」？` : ''}
        description={
          isOverallAgent
            ? '刪除後該技能不會再出現在技能廣場中，此操作不可撤銷。'
            : '這隻會在當前數字員工中隱藏該技能；開放廣場和其他數字員工仍然保留。'
        }
        confirmText={isOverallAgent ? '刪除' : '移除'}
        onConfirm={() => void confirmDeleteSkill()}
      />
    </div>
  );
}
