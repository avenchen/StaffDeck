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

function GeneralSkillEditorPage({ mode, currentUser, onLogout }: { mode: 'new' | 'edit' } & GeneralSkillPageProps) {
  const navigate = useNavigate();
  const { slug: routeSlug } = useParams();
  const [rows, setRows] = useState<GeneralSkillRead[]>([]);
  const [markdown, setMarkdown] = useState(EMPTY_SKILL_MARKDOWN);
  const [skillName, setSkillName] = useState('');
  const [skillSlug, setSkillSlug] = useState('');
  const [skillDescription, setSkillDescription] = useState('');
  const [skillHomepage, setSkillHomepage] = useState('');
  const [skillFiles, setSkillFiles] = useState<GeneralSkillFile[]>([
    { path: 'SKILL.md', content: EMPTY_SKILL_MARKDOWN, size: EMPTY_SKILL_MARKDOWN.length, mime_type: 'text/markdown' },
  ]);
  const [selectedSlug, setSelectedSlug] = useState<string>();
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [runResult, setRunResult] = useState<GeneralSkillRunResponse | null>(null);
  const [liveResult, setLiveResult] = useState<Partial<GeneralSkillRunResponse> | null>(null);
  const [modelConfigs, setModelConfigs] = useState<ModelConfigRead[]>([]);
  const [selectedRunModelId, setSelectedRunModelId] = useState(
    () => window.localStorage.getItem(`${GENERAL_SKILL_RUN_MODEL_STORAGE_KEY}:${TENANT_ID}`) || '',
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState('SKILL.md');
  const [editorScroll, setEditorScroll] = useState({ top: 0, left: 0 });
  const [clawhubModalOpen, setClawhubModalOpen] = useState(false);
  const [clawhubSource, setClawhubSource] = useState('');
  const [clawhubLoading, setClawhubLoading] = useState(false);
  const [agentImportOpen, setAgentImportOpen] = useState(false);
  const [agentImportMode, setAgentImportMode] = useState<GeneralSkillImportMode>('plaza');
  const [agentImportLoading, setAgentImportLoading] = useState(false);
  const [agentImportAgents, setAgentImportAgents] = useState<AgentProfileRead[]>([]);
  const [agentImportSourceAgentId, setAgentImportSourceAgentId] = useState('');
  const [agentImportSourceSkills, setAgentImportSourceSkills] = useState<GeneralSkillRead[]>([]);
  const [agentImportSelectedSkillIds, setAgentImportSelectedSkillIds] = useState<string[]>([]);
  const [agentId, setAgentId] = useState(() => window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) || '');
  const [isOverallAgent, setIsOverallAgent] = useState(true);
  const [agents, setAgents] = useState<AgentProfileRead[]>([]);
  const [deleteSkillTarget, setDeleteSkillTarget] = useState<GeneralSkillRead | null>(null);
  const [deleteFileTarget, setDeleteFileTarget] = useState<GeneralSkillFile | null>(null);
  const [renameTarget, setRenameTarget] = useState<GeneralSkillFile | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [importPrepareOpen, setImportPrepareOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const clawhubAbortRef = useRef<AbortController | null>(null);
  const importPrepareActionRef = useRef<null | (() => void | Promise<void>)>(null);

  const selectedSkill = useMemo(
    () => rows.find((row) => row.slug === selectedSlug),
    [rows, selectedSlug],
  );
  const activeResult = runResult || liveResult;
  const selectedFile = useMemo(
    () => skillFiles.find((file) => file.path === selectedFilePath) || skillFiles[0],
    [skillFiles, selectedFilePath],
  );
  const selectedFileLanguage = useMemo(() => languageFromFilePath(selectedFile?.path), [selectedFile?.path]);
  const isNew = mode === 'new';
  const currentAgent = useMemo(() => agents.find((item) => item.id === agentId), [agents, agentId]);
  const canManageCurrentScope = currentAgent
    ? canManageEmployeeAgent(currentAgent, currentUser)
    : isEnterpriseAdmin(currentUser) && isOverallAgent;
  const pageTitle = isNew ? '新建空白技能' : '编辑技能';
  const pageDescription = isOverallAgent
    ? (isNew
      ? '填写技能定义并编辑 SKILL.md，保存后可在右侧运行测试。'
      : '维护技能广场中的技能定义、文件包和运行测试。')
    : (isNew
      ? '为当前数字员工创建技能，填写基本信息并编辑技能文件。'
      : '维护当前数字员工技能的定义、文件包和运行测试。');

  const load = () => {
    const agentSuffix = agentId ? `&agent_id=${encodeURIComponent(agentId)}` : '';
    return api
      .get<GeneralSkillRead[]>(`/api/enterprise/general-skills?tenant_id=${TENANT_ID}${agentSuffix}`)
      .then((items) => {
        setRows(items);
        if (mode === 'edit') {
          const target = items.find((item) => item.slug === routeSlug);
          if (target) {
            editSkill(target);
          } else if (routeSlug) {
            notify.error('未找到要编辑的技能');
          }
        }
      })
      .catch((error) => notify.error(error.message));
  };

  useEffect(() => {
    if (mode === 'new') {
      newSkill();
    }
    void load();
  }, [agentId, mode, routeSlug]);

  useEffect(() => {
    api
      .get<AgentProfileRead[]>(`/api/enterprise/agents?tenant_id=${TENANT_ID}`)
      .then((items) => {
        setAgents(items);
        setIsOverallAgent(Boolean(items.find((item) => item.id === agentId)?.is_overall ?? true));
      })
      .catch(() => setIsOverallAgent(true));
  }, [agentId]);

  useEffect(() => {
    api
      .get<ModelConfigRead[]>(`/api/enterprise/model-configs?tenant_id=${TENANT_ID}`)
      .then((items) => {
        const enabled = items.filter((item) => item.enabled);
        setModelConfigs(enabled);
        setSelectedRunModelId((current) => {
          if (current && enabled.some((item) => item.id === current)) return current;
          const fallback = enabled.find((item) => item.is_default)?.id || enabled[0]?.id || '';
          if (fallback) {
            window.localStorage.setItem(`${GENERAL_SKILL_RUN_MODEL_STORAGE_KEY}:${TENANT_ID}`, fallback);
          }
          return fallback;
        });
      })
      .catch(() => setModelConfigs([]));
  }, []);

  useEffect(() => {
    const onScopeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ agentId?: string }>).detail;
      setAgentId(detail?.agentId || window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) || '');
    };
    window.addEventListener('ultrarag-enterprise-agent-scope-change', onScopeChange);
    return () => window.removeEventListener('ultrarag-enterprise-agent-scope-change', onScopeChange);
  }, []);

  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '');
    folderInputRef.current?.setAttribute('directory', '');
  }, []);

  useEffect(() => {
    if (!skillFiles.length) return;
    if (!skillFiles.some((file) => file.path === selectedFilePath)) {
      const skillFile = skillFiles.find((file) => file.path.split('/').pop()?.toLowerCase() === 'skill.md');
      setSelectedFilePath(skillFile?.path || skillFiles[0].path);
    }
  }, [skillFiles, selectedFilePath]);

  useEffect(() => {
    setEditorScroll({ top: 0, left: 0 });
  }, [selectedFilePath]);

  function hasUnsavedEditingChanges(): boolean {
    if (!editingSlug) return false;
    const original = rows.find((row) => row.slug === editingSlug);
    if (!original) return false;
    const stableSlug = editingSlug || skillSlug;
    return (
      markdown !== original.skill_markdown
      || skillName !== original.name
      || stableSlug !== original.slug
      || skillDescription !== (original.description || '')
      || skillHomepage !== (original.homepage || '')
      || normalizedSkillFiles(skillFiles) !== normalizedSkillFiles(
        original.skill_files?.length ? original.skill_files : [{ path: 'SKILL.md', content: original.skill_markdown }],
      )
    );
  }

  async function importSkill(): Promise<GeneralSkillRead | null> {
    if (!canManageCurrentScope) {
      notify.error('只有管理员可以编辑技能广场内容');
      return null;
    }
    if (!markdown.trim()) {
      notify.warning('请先粘贴或上传 SKILL.md');
      return null;
    }
    setSaving(true);
    try {
      const row = await api.post<GeneralSkillRead>('/api/enterprise/general-skills/import', {
        tenant_id: TENANT_ID,
        agent_id: !isOverallAgent && agentId ? agentId : undefined,
        name: skillName.trim() || undefined,
        slug: editingSlug || skillSlug.trim() || undefined,
        description: skillDescription.trim() || undefined,
        homepage: skillHomepage.trim() || undefined,
        markdown,
        files: skillFiles.length ? skillFiles : [{ path: 'SKILL.md', content: markdown }],
        status: 'published',
        original_slug: editingSlug || undefined,
      });
      notify.success(editingSlug ? `已保存 ${row.name}` : `已新增 ${row.name}`);
      setSelectedSlug(row.slug);
      setEditingSlug(row.slug);
      setMarkdown(row.skill_markdown);
      setSkillName(row.name);
      setSkillSlug(row.slug);
      setSkillDescription(row.description || '');
      setSkillHomepage(row.homepage || '');
      setSkillFiles(row.skill_files?.length ? row.skill_files : [{ path: 'SKILL.md', content: row.skill_markdown }]);
      setSelectedFilePath((row.skill_files?.length ? row.skill_files : [{ path: 'SKILL.md' }])[0].path);
      setRows((current) => {
        const withoutSaved = current.filter((item) => item.id !== row.id && item.slug !== row.slug);
        return [row, ...withoutSaved];
      });
      navigate(`/enterprise/general-skills/${encodeURIComponent(row.slug)}/edit`, { replace: !editingSlug });
      void load();
      return row;
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '保存技能失败');
      return null;
    } finally {
      setSaving(false);
    }
  }

  function newSkill() {
    setMarkdown(EMPTY_SKILL_MARKDOWN);
    setSkillName('');
    setSkillSlug('');
    setSkillDescription('');
    setSkillHomepage('');
    setSkillFiles([{ path: 'SKILL.md', content: EMPTY_SKILL_MARKDOWN, size: EMPTY_SKILL_MARKDOWN.length, mime_type: 'text/markdown' }]);
    setSelectedFilePath('SKILL.md');
    setEditingSlug(null);
    setSelectedSlug(undefined);
    setQuery('');
    setRunResult(null);
    setLiveResult(null);
  }

  function editSkill(row: GeneralSkillRead) {
    setMarkdown(row.skill_markdown);
    setSkillName(row.name);
    setSkillSlug(row.slug);
    setSkillDescription(row.description || '');
    setSkillHomepage(row.homepage || '');
    setSkillFiles(row.skill_files?.length ? row.skill_files : [{ path: 'SKILL.md', content: row.skill_markdown }]);
    setSelectedFilePath((row.skill_files?.length ? row.skill_files : [{ path: 'SKILL.md' }])[0].path);
    setSelectedSlug(row.slug);
    setEditingSlug(row.slug);
    setRunResult(null);
  }

  function replaceRow(row: GeneralSkillRead) {
    setRows((current) => current.map((item) => (item.id === row.id ? row : item)));
    if (editingSlug === row.slug) {
      setSkillName(row.name);
      setSkillSlug(row.slug);
      setSkillDescription(row.description || '');
      setSkillHomepage(row.homepage || '');
      setMarkdown(row.skill_markdown);
      setSkillFiles(row.skill_files?.length ? row.skill_files : [{ path: 'SKILL.md', content: row.skill_markdown }]);
      setSelectedFilePath((row.skill_files?.length ? row.skill_files : [{ path: 'SKILL.md' }])[0].path);
    }
  }

  async function setSkillPublished(row: GeneralSkillRead, published: boolean) {
    if (!canManageCurrentScope) {
      notify.error('只有管理员可以编辑技能广场内容');
      return;
    }
    try {
      const agentSuffix = agentId ? `&agent_id=${encodeURIComponent(agentId)}` : '';
      const next = await api.post<GeneralSkillRead>(
        `/api/enterprise/general-skills/${row.slug}/${published ? 'publish' : 'archive'}?tenant_id=${TENANT_ID}${agentSuffix}`,
      );
      replaceRow(next);
      notify.success(published ? '已启用技能' : '已停用技能');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : published ? '发布失败' : '下线失败');
    }
  }

  async function runDeleteSkill() {
    const row = deleteSkillTarget;
    if (!row) return;
    if (!canManageCurrentScope) {
      notify.error('只有管理员可以编辑技能广场内容');
      return;
    }
    const branchMode = !isOverallAgent;
    try {
      const agentSuffix = agentId ? `&agent_id=${encodeURIComponent(agentId)}` : '';
      await api.delete(`/api/enterprise/general-skills/${row.slug}?tenant_id=${TENANT_ID}${agentSuffix}`);
      const nextRows = rows.filter((item) => item.id !== row.id);
      setRows(nextRows);
      if (selectedSlug === row.slug || editingSlug === row.slug) {
        const next = nextRows[0];
        if (next) {
          setSelectedSlug(next.slug);
          editSkill(next);
        } else {
          setSelectedSlug(undefined);
          newSkill();
        }
      }
      notify.success(branchMode ? '已移除技能' : '已删除技能');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '删除失败');
    } finally {
      setDeleteSkillTarget(null);
    }
  }

  function startImportedDraft() {
    setEditingSlug(null);
    setSelectedSlug(undefined);
    setRunResult(null);
    setLiveResult(null);
  }

  async function withImportPreparation(importAction: () => void | Promise<void>) {
    if (!hasUnsavedEditingChanges()) {
      await importAction();
      return;
    }
    importPrepareActionRef.current = importAction;
    setImportPrepareOpen(true);
  }

  async function confirmImportPrepareSave() {
    const action = importPrepareActionRef.current;
    setImportPrepareOpen(false);
    const saved = await importSkill();
    if (saved && action) await action();
    importPrepareActionRef.current = null;
  }

  async function confirmImportPrepareSkip() {
    const action = importPrepareActionRef.current;
    setImportPrepareOpen(false);
    importPrepareActionRef.current = null;
    if (action) await action();
  }

  function requestImport(kind: 'file' | 'folder') {
    void withImportPreparation(() => {
      if (kind === 'folder') {
        folderInputRef.current?.click();
        return;
      }
      fileInputRef.current?.click();
    });
  }

  function requestClawHubImport() {
    void withImportPreparation(() => {
      clawhubAbortRef.current?.abort();
      clawhubAbortRef.current = null;
      setClawhubLoading(false);
      setClawhubSource('');
      setClawhubModalOpen(true);
    });
  }

  function cancelClawHubImport() {
    clawhubAbortRef.current?.abort();
    clawhubAbortRef.current = null;
    setClawhubLoading(false);
    setClawhubModalOpen(false);
  }

  function requestAgentImport(mode: GeneralSkillImportMode) {
    void withImportPreparation(async () => {
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
          await loadAgentImportSourceSkills(firstSource);
        } else {
          setAgentImportSourceSkills([]);
        }
      } catch (error) {
        notify.error(error instanceof Error ? error.message : '加载员工列表失败');
      }
    });
  }

  async function loadAgentImportSourceSkills(sourceAgentId: string) {
    setAgentImportSourceSkills([]);
    setAgentImportSelectedSkillIds([]);
    if (!sourceAgentId) return;
    try {
      const sourceRows = await api.get<GeneralSkillRead[]>(
        `/api/enterprise/general-skills?tenant_id=${TENANT_ID}&agent_id=${encodeURIComponent(sourceAgentId)}`,
      );
      const existingIds = new Set(rows.map((item) => item.id));
      setAgentImportSourceSkills(sourceRows.filter((item) => item.status === 'published' && !existingIds.has(item.id)));
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '加载来源技能失败');
    }
  }

  async function submitAgentImportSkills() {
    if (!agentId) {
      notify.warning('请先选择一个数字员工');
      return;
    }
    if (!agentImportSourceAgentId) {
      notify.warning(agentImportMode === 'plaza' ? '请选择开放广场' : '请选择复制来源');
      return;
    }
    if (!agentImportSelectedSkillIds.length) {
      notify.warning('请选择要复制的技能');
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
      notify.success(`已复制 ${agentImportSelectedSkillIds.length} 个技能`);
      setAgentImportOpen(false);
      await load();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '复制技能失败');
    } finally {
      setAgentImportLoading(false);
    }
  }

  async function importClawHubSource() {
    if (!clawhubSource.trim()) {
      notify.warning('请输入开源平台地址、GitHub 仓库或 SKILL.md 链接');
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
      setSelectedSlug(row.slug);
      editSkill(row);
      setClawhubModalOpen(false);
      void load();
    } catch (error) {
      if (isAbortError(error)) {
        notify.info('已取消导入');
        return;
      }
      notify.error(error instanceof Error ? error.message : '从开源平台导入失败');
    } finally {
      if (clawhubAbortRef.current === controller) {
        clawhubAbortRef.current = null;
        setClawhubLoading(false);
      }
    }
  }

  async function importSkillPackageFile(file: File) {
    const controller = new AbortController();
    clawhubAbortRef.current?.abort();
    clawhubAbortRef.current = controller;
    setClawhubLoading(true);
    try {
      const contentBase64 = await fileToBase64(file);
      if (controller.signal.aborted) return;
      const row = await api.postWithSignal<GeneralSkillRead>('/api/enterprise/general-skills/import-package', {
        tenant_id: TENANT_ID,
        agent_id: !isOverallAgent && agentId ? agentId : undefined,
        filename: file.name,
        content_base64: contentBase64,
        status: 'published',
      }, controller.signal);
      if (controller.signal.aborted) return;
      notify.success(`已上传 ${row.name}`);
      setRows((current) => [row, ...current.filter((item) => item.id !== row.id && item.slug !== row.slug)]);
      setSelectedSlug(row.slug);
      editSkill(row);
      setClawhubModalOpen(false);
      void load();
    } catch (error) {
      if (isAbortError(error)) {
        notify.info('已取消导入');
        return;
      }
      notify.error(error instanceof Error ? error.message : '上传技能包失败');
    } finally {
      if (clawhubAbortRef.current === controller) {
        clawhubAbortRef.current = null;
        setClawhubLoading(false);
      }
    }
  }

  function updateSelectedFile(text: string) {
    if (!selectedFile) return;
    setSkillFiles((current) => current.map((file) => (
      file.path === selectedFile.path
        ? { ...file, content: text, size: text.length }
        : file
    )));
    if (selectedFile.path.split('/').pop()?.toLowerCase() === 'skill.md') {
      setMarkdown(text);
    }
  }

  function addSkillFile() {
    const base = 'notes.md';
    let candidate = base;
    let index = 2;
    while (skillFiles.some((file) => file.path === candidate)) {
      candidate = `notes-${index}.md`;
      index += 1;
    }
    setSkillFiles((current) => [...current, { path: candidate, content: '', size: 0, mime_type: 'text/markdown' }]);
    setSelectedFilePath(candidate);
  }

  function deleteSelectedFile() {
    if (!selectedFile) return;
    deleteSkillFile(selectedFile);
  }

  function deleteSkillFile(target: GeneralSkillFile) {
    if (target.path.split('/').pop()?.toLowerCase() === 'skill.md') {
      notify.warning('SKILL.md 是技能入口，不能删除');
      return;
    }
    setDeleteFileTarget(target);
  }

  function runDeleteFile() {
    const target = deleteFileTarget;
    if (!target) return;
    setSkillFiles((current) => current.filter((file) => file.path !== target.path));
    setDeleteFileTarget(null);
  }

  function renameSkillFile(target: GeneralSkillFile) {
    setRenameTarget(target);
    setRenameValue(target.path);
  }

  function runRenameFile() {
    const target = renameTarget;
    if (!target) return;
    {
      const nextPath = renameValue;
      {
        const normalized = normalizeSkillFilePath(nextPath);
        if (!normalized) {
          notify.error('文件名不能为空');
          return;
        }
        if (normalized === target.path) {
          setRenameTarget(null);
          return;
        }
        if (skillFiles.some((file) => file.path === normalized)) {
          notify.error('已存在同名文件');
          return;
        }
        setSkillFiles((current) => current.map((file) => (
          file.path === target.path
            ? { ...file, path: normalized }
            : file
        )));
        if (selectedFilePath === target.path) {
          setSelectedFilePath(normalized);
        }
        setRenameTarget(null);
      }
    }
  }

  async function runSkill() {
    const slug = selectedSkill?.slug;
    if (!slug) {
      notify.warning('请先导入技能');
      return;
    }
    if (!query.trim()) {
      notify.warning('请输入测试问题');
      return;
    }
    setLoading(true);
    setRunResult(null);
    setLiveResult({
      skill_slug: slug,
      execution_trace: [],
      generated_code: '',
      stdout: '',
      stderr: '',
      structured_result: {},
      reply: '',
    });
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, GENERAL_SKILL_RUN_TIMEOUT_MS);
    try {
      let completed = false;
      await streamPost(
        `/api/enterprise/general-skills/${slug}/run/stream`,
        {
          tenant_id: TENANT_ID,
          agent_id: agentId || undefined,
          user_id: 'enterprise_demo',
          query,
          model_config_id: selectedRunModelId || undefined,
          max_attempts: 10,
        },
        (item) => {
          if (item.event === 'trace') {
            const traceItem = item.data;
            setLiveResult((current) => {
              const previous = current || { skill_slug: slug, execution_trace: [] };
              const executionTrace = [...(previous.execution_trace || []), traceItem];
              const nextCode = typeof traceItem.code === 'string' && traceItem.code.trim()
                ? traceItem.code
                : previous.generated_code || '';
              const nextStructured = typeof traceItem.structured_result === 'object' && traceItem.structured_result
                ? traceItem.structured_result as Record<string, unknown>
                : previous.structured_result || {};
              const chunk = typeof traceItem.text === 'string' ? traceItem.text : '';
              const phase = typeof traceItem.phase === 'string' ? traceItem.phase : '';
              return {
                ...previous,
                execution_trace: executionTrace,
                generated_code: nextCode,
                stdout: phase === 'stdout_chunk'
                  ? `${previous.stdout || ''}${chunk}`
                  : typeof traceItem.stdout_preview === 'string' ? traceItem.stdout_preview : previous.stdout || '',
                stderr: phase === 'stderr_chunk'
                  ? `${previous.stderr || ''}${chunk}`
                  : typeof traceItem.stderr_preview === 'string' ? traceItem.stderr_preview : previous.stderr || '',
                structured_result: nextStructured,
              };
            });
          }
          if (item.event === 'complete') {
            const result = item.data as unknown as GeneralSkillRunResponse;
            completed = true;
            setRunResult(result);
            setLiveResult(null);
            notify.success('运行完成');
          }
          if (item.event === 'error') {
            const text = typeof item.data.message === 'string' ? item.data.message : '运行失败';
            completed = true;
            setLiveResult((current) => ({
              ...(current || { skill_slug: slug, execution_trace: [] }),
              stderr: text,
              structured_result: { success: false, error: text },
              reply: '运行失败',
            }));
            notify.error(text);
          }
        },
        controller.signal,
      );
      if (!completed) {
        notify.warning('运行流已结束，但未收到最终结果');
      }
    } catch (error) {
      const text = timedOut
        ? '技能运行超时，请检查模型或稍后重试。'
        : error instanceof Error ? error.message : '运行失败';
      setLiveResult((current) => ({
        ...(current || { skill_slug: slug, execution_trace: [] }),
        stderr: text,
        structured_result: { success: false, error: text },
        reply: '运行失败',
      }));
      notify.error(text);
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  async function importSingleFile(target: File) {
    const text = await target.text();
    const nextFile = { path: 'SKILL.md', content: text, size: target.size, mime_type: target.type || 'text/markdown' };
    startImportedDraft();
    setSkillFiles([nextFile]);
    setSelectedFilePath('SKILL.md');
    setMarkdown(text);
    applyMetadata(text, { setSkillName, setSkillSlug, setSkillDescription, setSkillHomepage });
    notify.success(`已读取 ${target.name}`);
  }

  async function importSkillPackage(targets: DroppedSkillFile[]) {
    if (!targets.length) return;
    const nextFiles: GeneralSkillFile[] = [];
    let failedCount = 0;
    for (const { file, path } of targets) {
      try {
        const text = await file.text();
        nextFiles.push({
          path,
          content: text,
          size: file.size,
          mime_type: file.type || undefined,
        });
      } catch {
        failedCount += 1;
      }
    }
    if (!nextFiles.length) {
      notify.error('没有读取到可导入的技能文件');
      return;
    }
    nextFiles.sort((a, b) => a.path.localeCompare(b.path));
    startImportedDraft();
    setSkillFiles(nextFiles);
    const skillFile = nextFiles.find((item) => item.path.split('/').pop()?.toLowerCase() === 'skill.md');
    if (skillFile) {
      setMarkdown(skillFile.content);
      setSelectedFilePath(skillFile.path);
      applyMetadata(skillFile.content, { setSkillName, setSkillSlug, setSkillDescription, setSkillHomepage });
      notify.success(`已读取 ${nextFiles.length} 个文件${failedCount ? `，跳过 ${failedCount} 个无法读取文件` : ''}`);
    } else {
      setSelectedFilePath(nextFiles[0]?.path || 'SKILL.md');
      notify.warning('文件夹中没有找到 SKILL.md');
    }
  }

  async function importFolderFiles(fileList: FileList | null) {
    await importSkillPackage(Array.from(fileList || []).map((file) => ({ file, path: packagePath(file) })));
  }

  async function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const target = event.target.files?.[0];
    if (target) {
      if (isSkillPackageArchive(target)) {
        await importSkillPackageFile(target);
      } else {
        await importSingleFile(target);
      }
    }
    event.target.value = '';
  }

  async function handleFolderInputChange(event: ChangeEvent<HTMLInputElement>) {
    await importFolderFiles(event.target.files);
    event.target.value = '';
  }

  function acceptsFileDrop(event: DragEvent<HTMLElement>): boolean {
    return Array.from(event.dataTransfer.types || []).includes('Files');
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    if (!acceptsFileDrop(event)) return;
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (!acceptsFileDrop(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setDragActive(false);
  }

  async function handleDrop(event: DragEvent<HTMLElement>) {
    if (!acceptsFileDrop(event)) return;
    event.preventDefault();
    setDragActive(false);
    const dropped = await droppedSkillFiles(event.dataTransfer);
    if (!dropped.length) return;
    await withImportPreparation(async () => {
      if (dropped.length === 1 && !dropped[0].path.includes('/')) {
        if (isSkillPackageArchive(dropped[0].file)) {
          await importSkillPackageFile(dropped[0].file);
        } else {
          await importSingleFile(dropped[0].file);
        }
        return;
      }
      await importSkillPackage(dropped);
    });
  }

  const isLiveRunning = loading && !runResult;

  const importMenu = canManageCurrentScope ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <UIButton variant="outline" className={RETURN_BUTTON_CLASS}>
          <UploadOutlined className="size-[14px]!" />
          导入
        </UIButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => requestImport('file')}>选择文件</DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => requestImport('folder')}>选择文件夹</DropdownMenuItem>
        {!isOverallAgent && (
          <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => requestAgentImport('plaza')}>
            <UploadOutlined />
            从广场复制
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => requestClawHubImport()}>
          <GithubOutlined />
          从开源平台导入
        </DropdownMenuItem>
        {!isOverallAgent && (
          <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => requestAgentImport('employee')}>
            <TeamOutlined />
            从数字员工复制技能
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <div
      className="min-h-full box-border px-[48px] pt-[32px] pb-[43px] max-[900px]:px-[16px]"
      aria-busy={loading || saving}
    >
      <AppHeader
        onLogout={onLogout}
        userName={currentUser?.username}
        title={pageTitle}
        description={pageDescription}
      />

      <div className="mt-[20px] mb-[16px] flex flex-wrap justify-end gap-[16px]">
        <UIButton variant="outline" className={RETURN_BUTTON_CLASS} onClick={() => navigate('/enterprise/general-skills')}>
          <IconArrowRight className="size-3.5 rotate-180" />
          返回技能
        </UIButton>
        {!isNew && canManageCurrentScope && (
          <UIButton variant="outline" className={RETURN_BUTTON_CLASS} onClick={() => navigate('/enterprise/general-skills/new')}>
            <PlusOutlined />
            新建技能
          </UIButton>
        )}
        {importMenu}
        {canManageCurrentScope && (
          <UIButton disabled={saving} className={PRIMARY_BUTTON_CLASS} onClick={() => void importSkill()}>
            保存
          </UIButton>
        )}
      </div>

      <div className="grid grid-cols-1 gap-[20px] xl:grid-cols-2 xl:grid-rows-[auto_minmax(0,1fr)] xl:items-stretch">
          <SectionCard title="基本信息">
            <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2">
              <Field label="技能名称">
                <Input
                  value={skillName}
                  onChange={(event) => setSkillName(event.target.value)}
                  disabled={!canManageCurrentScope}
                  placeholder="例如 天气查询、代码审查"
                />
              </Field>
              <Field label="Slug">
                <Input
                  value={skillSlug}
                  onChange={(event) => {
                    if (editingSlug) return;
                    setSkillSlug(event.target.value);
                  }}
                  disabled={!canManageCurrentScope || Boolean(editingSlug)}
                  placeholder={editingSlug ? '创建后不可修改' : '用于路由和接口路径，例如 weather-zh'}
                />
              </Field>
              <Field label="描述">
                <Input
                  value={skillDescription}
                  onChange={(event) => setSkillDescription(event.target.value)}
                  disabled={!canManageCurrentScope}
                  placeholder="用于员工选择技能时的说明"
                />
              </Field>
              <Field label="主页链接">
                <Input
                  value={skillHomepage}
                  onChange={(event) => setSkillHomepage(event.target.value)}
                  disabled={!canManageCurrentScope}
                  placeholder="可选，参考文档或项目主页"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            className="xl:col-start-2 xl:row-start-1"
            title="运行测试"
            extra={(
              <div className="flex flex-wrap items-center justify-end gap-[8px]">
                <ModelConfigDropdown
                  models={modelConfigs}
                  value={selectedRunModelId}
                  onChange={(modelId) => {
                    setSelectedRunModelId(modelId);
                    window.localStorage.setItem(`${GENERAL_SKILL_RUN_MODEL_STORAGE_KEY}:${TENANT_ID}`, modelId);
                  }}
                />
                <UIButton disabled={loading || !selectedSkill?.slug} className={PRIMARY_BUTTON_CLASS} onClick={() => void runSkill()}>
                  <ExperimentOutlined />
                  运行
                </UIButton>
              </div>
            )}
          >
            <div className="flex flex-col gap-[12px]">
              <Field label="选择技能">
                <UISelect value={selectedSkill?.slug} onValueChange={setSelectedSlug}>
                  <SelectTrigger className={cn(SELECT_TRIGGER_CLASS, 'w-full')}>
                    <SelectValue placeholder={isNew && !selectedSkill ? '保存后可选择并测试' : '选择技能'} />
                  </SelectTrigger>
                  <SelectContent>
                    {rows.map((row) => (
                      <SelectItem key={row.slug} value={row.slug}>{`${row.name} / ${row.slug}`}</SelectItem>
                    ))}
                  </SelectContent>
                </UISelect>
              </Field>
              <Field label="测试问题">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="输入要测试的问题"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            className={cn(
              'flex h-full min-h-0 flex-col xl:col-start-1 xl:row-start-2',
              dragActive && SKILL_EDITOR_DRAG_ACTIVE_CLASS,
            )}
            bodyClassName="relative flex min-h-0 flex-1 flex-col p-0"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            title={(
              <span className="flex items-center gap-[8px]">
                <IconProfileFile className="size-[14px] shrink-0 text-[#757f9c]" />
                <span>技能文件</span>
              </span>
            )}
          >
            <input
              ref={fileInputRef}
              className={HIDDEN_FILE_INPUT_CLASS}
              type="file"
              accept=".zip,.md,.markdown,.txt"
              onChange={handleFileInputChange}
              hidden
              aria-hidden="true"
              tabIndex={-1}
            />
            <input
              ref={folderInputRef}
              className={HIDDEN_FILE_INPUT_CLASS}
              type="file"
              multiple
              {...FOLDER_INPUT_PROPS}
              onChange={handleFolderInputChange}
              hidden
              aria-hidden="true"
              tabIndex={-1}
            />
            {dragActive && (
              <div className={SKILL_DROP_HINT_CLASS}>
                <UploadOutlined />
                <span>释放以导入 SKILL.md、zip 技能包或完整技能文件夹</span>
              </div>
            )}
            <div className={SKILL_FILE_EDITOR_CLASS}>
              <aside className={SKILL_FILE_TREE_CLASS}>
                <div className={SKILL_FILE_TREE_HEADER_CLASS}>
                  <IconFolder className="size-[14px] shrink-0 text-[#757f9c]" />
                  <span>文件</span>
                </div>
                <div className={SKILL_FILE_TREE_LIST_CLASS}>
                  {skillFiles.map((file) => (
                    <ContextMenu.Root key={file.path}>
                      <ContextMenu.Trigger asChild>
                        <button
                          type="button"
                          className={skillFileNodeClass(file.path === selectedFile?.path)}
                          onClick={() => setSelectedFilePath(file.path)}
                          onContextMenu={() => setSelectedFilePath(file.path)}
                          title={file.path}
                        >
                          <IconProfileFile className="size-[14px] shrink-0" />
                          <span className="min-w-0 truncate">{file.path}</span>
                        </button>
                      </ContextMenu.Trigger>
                      <ContextMenu.Portal>
                        <ContextMenu.Content className={MENU_CONTENT_CLASS}>
                          <ContextMenu.Item className={MENU_ITEM_CLASS} onSelect={() => renameSkillFile(file)}>
                            <EditOutlined />
                            重命名
                          </ContextMenu.Item>
                          <ContextMenu.Item className={MENU_ITEM_DANGER_CLASS} onSelect={() => deleteSkillFile(file)}>
                            <DeleteOutlined />
                            删除
                          </ContextMenu.Item>
                        </ContextMenu.Content>
                      </ContextMenu.Portal>
                    </ContextMenu.Root>
                  ))}
                </div>
                <div className={SKILL_FILE_TREE_ACTIONS_CLASS}>
                  <UIButton variant="outline" onClick={addSkillFile} className={RETURN_BUTTON_CLASS}>
                    <IconAdd className="size-[14px]" />
                    新建文件
                  </UIButton>
                  <UIButton
                    variant="outline"
                    onClick={deleteSelectedFile}
                    className={DELETE_BUTTON_CLASS}
                  >
                    <IconTrash className="size-[14px]" />
                    删除
                  </UIButton>
                </div>
              </aside>
              <section className={SKILL_FILE_PANE_CLASS}>
                <div className={SKILL_FILE_TAB_CLASS}>
                  <IconProfileFile className="size-[14px] shrink-0 text-[#757f9c]" />
                  <span className="min-w-0 truncate text-[#18181a]">{selectedFile?.path || '未选择文件'}</span>
                </div>
                <div className={SKILL_CODE_EDITOR_CLASS} data-language={selectedFileLanguage}>
                  <pre className={SKILL_CODE_HIGHLIGHT_CLASS} aria-hidden="true">
                    <code
                      className={SKILL_CODE_HIGHLIGHT_CODE_CLASS}
                      style={{
                        transform: `translate(${-editorScroll.left}px, ${-editorScroll.top}px)`,
                      }}
                    >
                      {renderCodeTokens(selectedFile?.content || '\u200b', selectedFileLanguage)}
                    </code>
                  </pre>
                  <textarea
                    className={SKILL_CODE_INPUT_CLASS}
                    value={selectedFile?.content || ''}
                    onChange={(event) => updateSelectedFile(event.target.value)}
                    onScroll={(event) => setEditorScroll({
                      top: event.currentTarget.scrollTop,
                      left: event.currentTarget.scrollLeft,
                    })}
                    spellCheck={false}
                  />
                </div>
              </section>
            </div>
          </SectionCard>

          <SectionCard
            className="flex h-full min-h-0 flex-col xl:col-start-2 xl:row-start-2"
            bodyClassName="flex min-h-0 flex-1 flex-col overflow-auto p-[18px]"
            title={(
              <span className="flex items-center gap-[8px]">
                <IconPlay className="size-[14px] shrink-0 text-[#757f9c]" />
                <span>运行结果</span>
                {activeResult && (
                  isLiveRunning
                    ? <span className="inline-flex items-center gap-[4px] rounded-full bg-[#e6f4ff] px-[8px] py-px text-[12px] font-bold text-[#0958d9]">运行中</span>
                    : resultSucceeded(activeResult)
                    ? <span className="inline-flex items-center gap-[4px] rounded-full bg-[#eafbf0] px-[8px] py-px text-[12px] font-bold text-[#018434]"><CheckCircleOutlined />成功</span>
                    : <span className="inline-flex items-center gap-[4px] rounded-full bg-[#fce7e7] px-[8px] py-px text-[12px] font-bold text-[#d20b0b]"><CloseCircleOutlined />失败</span>
                )}
              </span>
            )}
          >
            {activeResult ? (
              <div className={SKILL_RESULT_LAYOUT_CLASS}>
                {(() => {
                  const traceItems = activeResult.execution_trace || [];
                  const latestCodeIndex = traceItems.reduce(
                    (latest, traceItem, traceIndex) => (traceItemCode(traceItem) ? traceIndex : latest),
                    -1,
                  );
                  return (
                    <>
                <section className={SKILL_REPLY_PANEL_CLASS}>
                  <div className={SKILL_SECTION_LABEL_CLASS}>最终回复</div>
                  <p className={SKILL_REPLY_TEXT_CLASS}>
                    {activeResult.reply || (loading ? '正在运行技能...' : '暂无回复')}
                  </p>
                </section>

                <section>
                  <div className={SKILL_SECTION_LABEL_CLASS}>执行流程</div>
                  <div className={SKILL_TRACE_LIST_CLASS}>
                    {traceItems.map((item, index) => {
                      const phase = typeof item.phase === 'string' ? item.phase : '';
                      const detail = traceDetail(item);
                      const code = traceItemCode(item);
                      const codeTitle = typeof item.attempt === 'number'
                        ? `第 ${item.attempt} 次 Python runner`
                        : 'Python runner';
                      return (
                        <div className={SKILL_TRACE_ITEM_CLASS} key={`${phase || 'phase'}-${index}`}>
                          <div className={SKILL_TRACE_DOT_CLASS} />
                          <div className={SKILL_TRACE_ITEM_BODY_CLASS}>
                            <div className={SKILL_TRACE_TITLE_CLASS}>{PHASE_LABELS[phase] || String(item.message || phase || '执行')}</div>
                            <div className={SKILL_TRACE_MESSAGE_CLASS}>{String(item.message || '')}</div>
                            {detail && (
                              <RunCodePanel
                                className="mt-2"
                                title={phase === 'code_finished' ? '查看执行结果' : phase === 'stdout_chunk' ? '查看运行输出' : '查看详情'}
                                code={detail}
                                language={codeLanguage(detail)}
                                defaultOpen={phase === 'code_finished' || phase === 'code_timeout'}
                              />
                            )}
                            {code && (
                              <details className={cn(SKILL_TRACE_CODE_DETAILS_CLASS, 'mt-[10px]')} open={index === latestCodeIndex}>
                                <summary className={SKILL_TRACE_CODE_SUMMARY_CLASS}>
                                  {codeTitle}
                                  <TraceDisclosureLabel />
                                </summary>
                                <CodeBlock className={SKILL_CODE_BLOCK_CLASS} code={code} language="python" />
                              </details>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <div className={SKILL_SECTION_LABEL_CLASS}>运行输出</div>
                  <div className={SKILL_OUTPUT_STACK_CLASS}>
                    <RunCodePanel
                      title="结构化结果"
                      code={formatJson(activeResult.structured_result) || '无结构化结果'}
                      language="json"
                      defaultOpen
                    />
                    <RunCodePanel
                      title="stdout"
                      code={formatJson(activeResult.stdout) || '无 stdout'}
                      language={codeLanguage(formatJson(activeResult.stdout), 'text')}
                    />
                    <RunCodePanel
                      title="stderr"
                      code={formatJson(activeResult.stderr) || '无 stderr'}
                      language={codeLanguage(formatJson(activeResult.stderr), 'text')}
                    />
                  </div>
                </section>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="flex min-h-[560px] flex-1 flex-col items-center justify-center gap-[8px] text-center text-[13px] text-muted-foreground xl:min-h-0">
                运行后将在这里显示回复、执行流程、代码和输出
              </div>
            )}
          </SectionCard>
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
        title={agentImportMode === 'plaza' ? '从广场复制技能' : '从数字员工复制技能'}
        sourcePlaceholder={agentImportMode === 'plaza' ? '选择开放广场' : '选择复制来源'}
        sources={agentImportMode === 'plaza'
          ? openGalleryImportSourceOptions(agentImportAgents, '开放广场')
          : visibleEmployeeAgents(agentImportAgents, currentUser, { activeOnly: true, excludeAgentId: agentId })
            .map((item) => ({ value: item.id, label: item.name }))}
        sourceId={agentImportSourceAgentId}
        itemsLabel="选择技能"
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
        emptyText="没有可复制的技能"
        note={agentImportMode === 'plaza'
          ? '从开放广场复制可用技能；不会覆盖当前编辑区内容。'
          : '从数字员工复制可用技能；不会覆盖当前编辑区内容。'}
        onSourceChange={(value) => {
          setAgentImportSourceAgentId(value);
          void loadAgentImportSourceSkills(value);
        }}
        onSelectedChange={setAgentImportSelectedSkillIds}
        onClose={() => setAgentImportOpen(false)}
        onSubmit={() => void submitAgentImportSkills()}
      />

      <ConfirmDialog
        open={Boolean(deleteSkillTarget)}
        onOpenChange={(open) => !open && setDeleteSkillTarget(null)}
        title={deleteSkillTarget ? `${isOverallAgent ? '删除' : '移除'}技能「${deleteSkillTarget.name}」？` : ''}
        description={isOverallAgent
          ? '删除后该技能不会再出现在组织技能库中，此操作不可撤销。'
          : '这只会在当前数字员工中隐藏该技能；开放广场和其他数字员工仍然保留。'}
        confirmText={isOverallAgent ? '删除' : '移除'}
        onConfirm={() => void runDeleteSkill()}
      />

      <ConfirmDialog
        open={Boolean(deleteFileTarget)}
        onOpenChange={(open) => !open && setDeleteFileTarget(null)}
        title={deleteFileTarget ? `删除文件「${deleteFileTarget.path}」？` : ''}
        description="删除后需要重新导入或手动新建该文件。"
        confirmText="删除"
        onConfirm={runDeleteFile}
      />

      <Dialog
        open={importPrepareOpen}
        onOpenChange={(open) => { if (!open) { setImportPrepareOpen(false); importPrepareActionRef.current = null; } }}
      >
        <DialogContent aria-describedby={undefined} className="flex w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-[16px] p-0 sm:max-w-[460px]">
          <DialogTitle className="border-b border-border px-[24px] py-[16px] text-[16px] font-semibold text-foreground">
            导入新技能前是否保存当前技能？
          </DialogTitle>
          <p className="px-[24px] py-[16px] text-[13px] leading-[20px] text-[#4f5669]">
            你正在编辑现有技能。导入会进入新建状态，不会覆盖当前技能。
          </p>
          <div className="flex items-center justify-end gap-[8px] bg-background px-[24px] py-[12px]">
            <UIButton
              variant="outline"
              onClick={() => { setImportPrepareOpen(false); importPrepareActionRef.current = null; }}
              className="h-[32px] rounded-[10px] border-[#e3e7f1] bg-white px-[14px] text-[14px] font-normal text-[#464c5e] hover:border-[#e3e7f1] hover:bg-[#f6f6f6] hover:text-[#18181a]"
            >
              取消
            </UIButton>
            <UIButton
              variant="outline"
              onClick={() => void confirmImportPrepareSkip()}
              className="h-[32px] rounded-[10px] border-[#e3e7f1] bg-white px-[14px] text-[14px] font-normal text-[#464c5e] hover:border-[#e3e7f1] hover:bg-[#f6f6f6] hover:text-[#18181a]"
            >
              不保存，继续导入
            </UIButton>
            <UIButton
              onClick={() => void confirmImportPrepareSave()}
              className="h-[32px] rounded-[10px] bg-[#18181a] px-[14px] text-[14px] font-normal text-white hover:bg-[#303030]"
            >
              保存并发布
            </UIButton>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renameTarget)} onOpenChange={(open) => { if (!open) setRenameTarget(null); }}>
        <DialogContent aria-describedby={undefined} className="flex w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-[16px] p-0 sm:max-w-[420px]">
          <DialogTitle className="border-b border-border px-[24px] py-[16px] text-[16px] font-semibold text-foreground">
            重命名文件
          </DialogTitle>
          <div className="px-[24px] py-[16px]">
            <Input
              autoFocus
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  runRenameFile();
                }
              }}
            />
          </div>
          <div className="flex items-center justify-end gap-[8px] bg-background px-[24px] py-[12px]">
            <UIButton
              variant="outline"
              onClick={() => setRenameTarget(null)}
              className="h-[32px] w-[80px] rounded-[10px] border-[#e3e7f1] bg-white px-[12px] text-[14px] font-normal text-[#464c5e] hover:border-[#e3e7f1] hover:bg-[#f6f6f6] hover:text-[#18181a]"
            >
              取消
            </UIButton>
            <UIButton
              onClick={runRenameFile}
              className="h-[32px] w-[80px] rounded-[10px] bg-[#18181a] px-[12px] text-[14px] font-normal text-white hover:bg-[#303030]"
            >
              重命名
            </UIButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function GeneralSkillNewPage(props: GeneralSkillPageProps = {}) {
  return <GeneralSkillEditorPage mode="new" {...props} />;
}

export function GeneralSkillEditPage(props: GeneralSkillPageProps = {}) {
  return <GeneralSkillEditorPage mode="edit" {...props} />;
}
