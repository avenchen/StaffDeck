import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';

import { mcpServersApi, toolsApi } from '@/api/endpoints/tools';
import { agentsApi } from '@/api/endpoints/agents';
import { isEnterpriseAdmin } from '@/auth';
import AppHeader from '@/components/AppHeader';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Paginator } from '@/components/Paginator';
import { ResourceImportDialog } from '@/components/ResourceImportDialog';
import { StatCard } from '@/components/StatCard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
  MENU_CONTENT_CLASS,
  MENU_ITEM_CLASS,
  MENU_ITEM_DANGER_CLASS,
  MOBILE_CARD_CLASS,
  SELECT_TRIGGER_CLASS,
} from '@/lib/enterprise-ui';
import { ApiOutlined } from '@/icons';
import IconAdd from '@/assets/icons/add.svg?react';
import IconBriefcase from '@/assets/icons/cap-briefcase.svg?react';
import IconChevronDown from '@/assets/icons/chevron-down.svg?react';
import IconClear from '@/assets/icons/field-clear.svg?react';
import IconEdit from '@/assets/icons/edit.svg?react';
import IconMore from '@/assets/icons/more.svg?react';
import IconRefresh from '@/assets/icons/refresh.svg?react';
import IconSearch from '@/assets/icons/search.svg?react';
import IconTool from '@/assets/icons/plaza-tool.svg?react';
import IconTrash from '@/assets/icons/trash.svg?react';
import {
  canManageEmployeeAgent,
  openGalleryAgentId,
  openGalleryImportSourceOptions,
  resourceCreatorName,
  visibleEmployeeAgents,
} from '@/employee';
import { useClientPagination } from '@/hooks/useClientPagination';
import { ENTERPRISE_AGENT_STORAGE_KEY } from '@/lib/agent-scope-storage';
import { StatusBadge } from '@/pages/scheduled-tasks/StatusBadge';
import type {
  AgentProfileRead,
  ToolRead,
  MCPServerRead,
} from '@/types';
import { buildBucketStats, serverEndpoint, transportLabel } from '../lib/toolPayload';
import { RETURN_BUTTON_CLASS } from '../styles';
import { TOOL_PAGE_SIZE, type ToolPageProps } from '../types';

export default function ToolsListPage({ currentUser, onLogout }: ToolPageProps = {}) {
  const [rows, setRows] = useState<ToolRead[]>([]);
  const [agentId, setAgentId] = useState(() => window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) || '');
  const [isOverallAgent, setIsOverallAgent] = useState(true);
  const [agentScopeLoaded, setAgentScopeLoaded] = useState(false);
  const [bucketFilter, setBucketFilter] = useState('__all__');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<AgentProfileRead[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<'plaza' | 'employee'>('plaza');
  const [importTargetAgentId, setImportTargetAgentId] = useState('');
  const [importSourceAgentId, setImportSourceAgentId] = useState('');
  const [importSourceTools, setImportSourceTools] = useState<ToolRead[]>([]);
  const [importSelectedToolIds, setImportSelectedToolIds] = useState<string[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ToolRead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [servers, setServers] = useState<MCPServerRead[]>([]);
  const [serverDeleteTarget, setServerDeleteTarget] = useState<MCPServerRead | null>(null);
  const [deletingServer, setDeletingServer] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const pageTitle = isOverallAgent ? '工具广场' : '工具';
  const listLabel = isOverallAgent ? '工具广场列表' : '员工工具';
  const currentAgent = useMemo(() => agents.find((item) => item.id === agentId), [agents, agentId]);
  const canManageCurrentScope = currentAgent
    ? canManageEmployeeAgent(currentAgent, currentUser)
    : isEnterpriseAdmin(currentUser) && isOverallAgent;
  const canOpenCreateMenu = canManageCurrentScope;

  const agentQuery = agentId ? `&agent_id=${encodeURIComponent(agentId)}` : '';
  const load = () => {
    if (!agentScopeLoaded) {
      setRows([]);
      return Promise.resolve();
    }
    setLoading(true);
    return Promise.all([
      toolsApi.list(agentId),
      mcpServersApi.list().catch(() => [] as MCPServerRead[]),
    ])
      .then(([toolRows, serverRows]) => {
        setRows(toolRows);
        setServers(serverRows);
      })
      .catch((error) => notify.error(error instanceof Error ? error.message : '加载工具失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!agentScopeLoaded) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentQuery, agentScopeLoaded]);

  useEffect(() => {
    const loadAgentScope = async () => {
      try {
        const agents = await agentsApi.list();
        setAgents(agents);
        const exactSelectedAgent = agents.find((agent) => agent.id === agentId) || null;
        const selectedAgent = exactSelectedAgent || agents.find((agent) => agent.is_overall) || null;
        if (agentId && !exactSelectedAgent) {
          setAgentId(selectedAgent?.id || '');
        }
        setIsOverallAgent(Boolean(selectedAgent?.is_overall));
        setAgentScopeLoaded(true);
      } catch {
        setIsOverallAgent(true);
        setAgentScopeLoaded(true);
      }
    };
    void loadAgentScope();
  }, [agentId]);

  useEffect(() => {
    const onScopeChange = (event: Event) => {
      const nextAgentId = (event as CustomEvent<{ agentId?: string }>).detail?.agentId || window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) || '';
      setAgentId(nextAgentId);
    };
    window.addEventListener('ultrarag-enterprise-agent-scope-change', onScopeChange);
    return () => window.removeEventListener('ultrarag-enterprise-agent-scope-change', onScopeChange);
  }, []);

  useEffect(() => {
    if (searchParams.get('add') !== 'plaza') return;
    if (!agentScopeLoaded) return;
    const resourceId = searchParams.get('resourceId') || undefined;
    void openImportTools('plaza', resourceId);
    const next = new URLSearchParams(searchParams);
    next.delete('add');
    next.delete('resourceId');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentScopeLoaded, isOverallAgent, searchParams, setSearchParams]);

  const visibleRows = useMemo(() => (isOverallAgent ? rows : rows.filter((row) => row.enabled)), [isOverallAgent, rows]);
  const bucketStats = useMemo(() => buildBucketStats(visibleRows), [visibleRows]);
  const bucketSelectOptions = useMemo(
    () => [
      { value: '__all__', label: '全部分桶' },
      ...bucketStats.map((item) => ({ value: item.bucket, label: `${item.bucket} (${item.total})` })),
    ],
    [bucketStats],
  );
  const filteredRows = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    return visibleRows.filter((row) => {
      const bucketMatch = bucketFilter === '__all__' || (row.bucket || '未分桶') === bucketFilter;
      if (!bucketMatch) return false;
      if (!text) return true;
      return [
        row.name,
        row.display_name || '',
        row.description || '',
        row.bucket || '',
        row.url,
        resourceCreatorName(row),
      ].some((value) => value.toLowerCase().includes(text));
    });
  }, [bucketFilter, searchText, visibleRows]);

  const pagination = useClientPagination(filteredRows, TOOL_PAGE_SIZE, `${searchText}|${bucketFilter}|${isOverallAgent}`);

  const stats = useMemo(
    () => ({
      total: visibleRows.length,
      enabled: visibleRows.filter((row) => row.enabled).length,
      buckets: bucketStats.length,
    }),
    [visibleRows, bucketStats],
  );

  async function confirmDelete() {
    const row = deleteTarget;
    if (!row) return;
    setDeleting(true);
    try {
      await toolsApi.remove(row.id, agentId);
      notify.success(isOverallAgent ? '已删除工具' : '已从当前员工移除');
      setDeleteTarget(null);
      await load();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : isOverallAgent ? '删除失败' : '移除失败');
    } finally {
      setDeleting(false);
    }
  }

  function handleCreateAction(key: string) {
    if (key === 'blank') {
      navigate('/enterprise/tools/new');
      return;
    }
    if (key === 'mcp') {
      navigate('/enterprise/tools/mcp/new');
      return;
    }
    if (key === 'plaza') {
      void openImportTools('plaza');
      return;
    }
    if (key === 'employee') {
      void openImportTools('employee');
    }
  }

  async function confirmDeleteServer() {
    const row = serverDeleteTarget;
    if (!row || deletingServer) return;
    setDeletingServer(true);
    try {
      await mcpServersApi.remove(row.id, { agentId, removeTools: true });
      notify.success('已删除');
      setServerDeleteTarget(null);
      void load();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '删除失败');
    } finally {
      setDeletingServer(false);
    }
  }

  async function openImportTools(mode: 'plaza' | 'employee' = 'plaza', selectedResourceId?: string) {
    try {
      const agentRows = agents.length ? agents : await agentsApi.list();
      setAgents(agentRows);
      setImportMode(mode);
      const targetCandidates = importTargetCandidates(agentRows);
      const nextTargetAgentId =
        targetCandidates.find((item) => item.id === agentId)?.id
        || targetCandidates[0]?.id
        || '';
      if (!nextTargetAgentId) {
        notify.warning('请先创建或选择一个数字员工，再复制工具');
        return;
      }
      setImportTargetAgentId(nextTargetAgentId);
      const firstSource = mode === 'plaza'
        ? openGalleryAgentId(agentRows)
        : visibleEmployeeAgents(agentRows, currentUser, { activeOnly: true, excludeAgentId: nextTargetAgentId })[0]?.id || '';
      setImportSourceAgentId(firstSource);
      setImportSelectedToolIds([]);
      setImportOpen(true);
      if (firstSource) {
        const sourceRows = await loadImportSourceTools(firstSource);
        if (selectedResourceId && sourceRows.some((item) => item.id === selectedResourceId)) {
          setImportSelectedToolIds([selectedResourceId]);
        }
      } else {
        setImportSourceTools([]);
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '加载员工失败');
    }
  }

  async function loadImportSourceTools(sourceAgentId: string): Promise<ToolRead[]> {
    setImportSourceTools([]);
    setImportSelectedToolIds([]);
    if (!sourceAgentId) return [];
    try {
      const sourceRows = await toolsApi.list(sourceAgentId);
      const enabledRows = sourceRows.filter((item) => item.enabled);
      setImportSourceTools(enabledRows);
      return enabledRows;
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '加载来源工具失败');
      return [];
    }
  }

  async function submitImportTools() {
    const targetAgentId = importTargetAgentId || (!isOverallAgent ? agentId : '');
    if (!targetAgentId) {
      notify.warning('请选择要复制到的数字员工');
      return;
    }
    if (!importSourceAgentId) {
      notify.warning(importMode === 'plaza' ? '请选择开放广场' : '请选择复制来源员工');
      return;
    }
    if (importSelectedToolIds.length === 0) {
      notify.warning('请选择要复制的工具');
      return;
    }
    setImportLoading(true);
    try {
      const result = await agentsApi.importResources(targetAgentId, {
        source_agent_id: importSourceAgentId,
        resource_type: 'tool',
        resource_ids: importSelectedToolIds,
      });
      const importedCount = result.imported?.length || 0;
      const missingCount = result.missing?.length || 0;
      notify.success(`已复制 ${importedCount} 个工具${missingCount ? `，${missingCount} 个未复制` : ''}`);
      setImportOpen(false);
      if (targetAgentId !== agentId) {
        window.localStorage.setItem(ENTERPRISE_AGENT_STORAGE_KEY, targetAgentId);
        window.dispatchEvent(new CustomEvent('ultrarag-enterprise-agent-scope-change', { detail: { agentId: targetAgentId } }));
        setAgentId(targetAgentId);
      } else {
        await load();
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '复制工具失败');
    } finally {
      setImportLoading(false);
    }
  }

  function importTargetCandidates(agentRows: AgentProfileRead[] = agents): AgentProfileRead[] {
    return agentRows.filter((item) => (
      !item.is_overall
      && item.status === 'active'
      && canManageEmployeeAgent(item, currentUser)
    ));
  }

  function handleImportTargetChange(nextTargetAgentId: string) {
    setImportTargetAgentId(nextTargetAgentId);
    if (importMode !== 'employee' || importSourceAgentId !== nextTargetAgentId) return;
    const nextSource = visibleEmployeeAgents(agents, currentUser, {
      activeOnly: true,
      excludeAgentId: nextTargetAgentId,
    })[0]?.id || '';
    setImportSourceAgentId(nextSource);
    void loadImportSourceTools(nextSource);
  }

  function renderActions(row: ToolRead) {
    const isMcpChild = row.tool_type === 'mcp' && Boolean(row.mcp_server_id);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="工具操作"
          className="ml-auto grid size-7 place-items-center rounded-[8px] text-[#1a71ff] transition-colors outline-none hover:bg-black/5 hover:text-[#4a8dff] focus-visible:bg-black/5"
        >
          <IconMore className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
          {canManageCurrentScope && !isMcpChild && (
            <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => navigate(`/enterprise/tools/${row.id}/edit`)}>
              <IconEdit />
              编辑
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => navigate(`/enterprise/tools/${row.id}/test`)}>
            <FlaskConical />
            测试
          </DropdownMenuItem>
          {canManageCurrentScope && !isMcpChild && (
            <>
              <DropdownMenuSeparator className="my-[2px] bg-[#eef0f4]" />
              <DropdownMenuItem
                variant="destructive"
                className={MENU_ITEM_DANGER_CLASS}
                onSelect={() => setDeleteTarget(row)}
              >
                <IconTrash />
                {isOverallAgent ? '删除' : '移除'}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const columns: DataTableColumn<ToolRead>[] = [
    {
      key: 'name',
      title: '工具名称',
      width: 200,
      className: 'text-[#18181a]',
      render: (row) => (
        <div className="flex min-w-0 flex-col gap-[2px]">
          <span className="truncate font-medium leading-[18px] text-[#18181a]" title={row.display_name || row.name}>
            {row.display_name || row.name}
          </span>
          <span className="truncate text-[#858b9c]" title={row.name}>
            {row.name}
          </span>
        </div>
      ),
    },
    {
      key: 'bucket',
      title: '分桶',
      width: 130,
      render: (row) => <StatusBadge tone="gray">{row.bucket || '未分桶'}</StatusBadge>,
    },
    {
      key: 'type',
      title: '类型',
      width: 90,
      render: (row) => (
        <StatusBadge tone={row.tool_type === 'mcp' ? 'blue' : 'gray'}>{row.tool_type === 'mcp' ? 'MCP' : 'HTTP'}</StatusBadge>
      ),
    },
    {
      key: 'creator',
      title: '创建者',
      width: 120,
      render: (row) => (
        <span className="block truncate text-[#858b9c]" title={resourceCreatorName(row)}>
          {resourceCreatorName(row) || '-'}
        </span>
      ),
    },
    { key: 'method', title: 'Method', width: 96, render: (row) => row.method },
    {
      key: 'url',
      title: 'URL',
      className: 'whitespace-normal',
      render: (row) => <span className="line-clamp-1 wrap-break-word text-[#858b9c]">{row.url}</span>,
    },
    {
      key: 'enabled',
      title: '启用',
      width: 90,
      render: (row) => (
        <StatusBadge tone={row.enabled ? 'green' : 'gray'}>{row.enabled ? '已启用' : '已停用'}</StatusBadge>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 70,
      align: 'right',
      render: (row) => renderActions(row),
    },
  ];

  const serverColumns: DataTableColumn<MCPServerRead>[] = [
    {
      key: 'name',
      title: '名称',
      width: 240,
      render: (row) => (
        <div className="flex min-w-0 flex-col gap-[4px]">
          <span className="flex w-full min-w-0 items-center gap-[6px]">
            <span className="min-w-0 flex-1 truncate font-medium leading-[18px] text-[#18181a]" title={row.display_name || row.name}>
              {row.display_name || row.name}
            </span>
            <span className="shrink-0">
              <StatusBadge tone="blue">工具集</StatusBadge>
            </span>
          </span>
          <span className="truncate text-[#858b9c]" title={row.name}>
            {row.name}
          </span>
        </div>
      ),
    },
    {
      key: 'transport',
      title: '连接方式',
      width: 140,
      render: (row) => <StatusBadge tone="gray">{transportLabel(row.connection.transport)}</StatusBadge>,
    },
    {
      key: 'endpoint',
      title: '端点',
      className: 'whitespace-normal',
      render: (row) => (
        <span className="line-clamp-1 wrap-break-word text-[#858b9c]">{serverEndpoint(row.connection)}</span>
      ),
    },
    {
      key: 'tool_count',
      title: '工具数',
      width: 110,
      render: (row) => <span className="text-[#858b9c]">{row.tool_count} 个工具</span>,
    },
    {
      key: 'enabled',
      title: '启用',
      width: 90,
      render: (row) => (
        <StatusBadge tone={row.enabled ? 'green' : 'gray'}>{row.enabled ? '已启用' : '已停用'}</StatusBadge>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-[8px]">
          <UIButton
            variant="outline"
            size="sm"
            onClick={() => navigate(`/enterprise/tools/mcp/${row.id}/edit`)}
            disabled={!canManageCurrentScope}
            className={RETURN_BUTTON_CLASS}
          >
            <IconRefresh className="size-[14px] shrink-0" />
            发现/同步
          </UIButton>
          {canManageCurrentScope && isOverallAgent && (
            <UIButton
              variant="outline"
              size="sm"
              onClick={() => setServerDeleteTarget(row)}
              className={cn(RETURN_BUTTON_CLASS, 'text-[#e5484d] hover:text-[#e5484d]')}
            >
              删除
            </UIButton>
          )}
        </div>
      ),
    },
  ];

  const renderMobileCard = (row: ToolRead) => (
    <article className={MOBILE_CARD_CLASS} key={row.id}>
      <div className="flex min-w-0 items-start justify-between gap-[10px]">
        <div className="min-w-0">
          <strong className="block truncate text-[14px] font-semibold text-[#18181a]">
            {row.display_name || row.name}
          </strong>
          <span className="mt-[2px] block truncate text-[12px] text-[#858b9c]">{row.name}</span>
          <span className="mt-[2px] block truncate text-[12px] text-[#858b9c]">创建者：{resourceCreatorName(row) || '-'}</span>
        </div>
        {renderActions(row)}
      </div>
      <div className="mt-[8px] flex flex-wrap items-center gap-[6px]">
        <StatusBadge tone="gray">{row.bucket || '未分桶'}</StatusBadge>
        <StatusBadge tone={row.tool_type === 'mcp' ? 'blue' : 'gray'}>{row.tool_type === 'mcp' ? 'MCP' : 'HTTP'}</StatusBadge>
        <StatusBadge tone={row.enabled ? 'green' : 'gray'}>{row.enabled ? '已启用' : '已停用'}</StatusBadge>
      </div>
      <p className="mt-[8px] line-clamp-1 wrap-break-word text-[12px] text-[#858b9c]">
        {row.method} · {row.url}
      </p>
    </article>
  );

  const listEmptyText = isOverallAgent
    ? canManageCurrentScope ? '暂无工具，点击「新增」创建一个吧' : '暂无工具'
    : '当前员工暂无工具';

  return (
    <div className="min-h-full box-border px-[48px] pt-[32px] pb-[43px] max-[900px]:px-[16px]">
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
        {canOpenCreateMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-[34px] items-center gap-[4px] rounded-[10px] bg-[#18181a] px-[20px] text-[12px] font-normal text-white outline-none transition-colors hover:bg-[#303030]">
              <IconAdd className="size-[14px]" />
              新增
              <IconChevronDown className="size-[12px]" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
              {canManageCurrentScope && (
                <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => handleCreateAction('blank')}>
                  <IconAdd />
                  新建空白工具
                </DropdownMenuItem>
              )}
              {!isOverallAgent && (
                <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => handleCreateAction('plaza')}>
                  <IconTool className="size-[14px]" />
                  从广场复制
                </DropdownMenuItem>
              )}
              {!isOverallAgent && (
                <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => handleCreateAction('employee')}>
                  <FlaskConical />
                  从数字员工复制
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex flex-col gap-[24px] rounded-[20px_20px_0_0] bg-white p-[18px_18px_24px_18px] shadow-[0_-4px_16px_0_rgba(0,0,0,0.05)]">
        <div className="flex flex-wrap items-stretch gap-[20px]" aria-label="工具统计">
          <StatCard label="工具总数" value={stats.total} className="basis-[220px]" />
          <StatCard label="已启用" value={stats.enabled} tone="green" className="basis-[220px]" />
          <StatCard label="分桶" value={stats.buckets} className="basis-[220px]" />
        </div>

        {servers.length > 0 && (
          <div className="flex flex-col gap-[18px]">
            <div className="flex items-center gap-[6px] px-[12px] text-[#757f9c]">
              <ApiOutlined className="size-[14px] shrink-0" />
              <span className="text-[14px] font-normal leading-none">MCP 服务器（工具集）</span>
            </div>
            <div className="hidden md:block">
              <DataTable
                aria-label="MCP 服务器列表"
                columns={serverColumns}
                data={servers}
                rowKey={(row) => row.id}
                loading={loading}
                emptyText="暂无 MCP 服务器"
              />
            </div>
            <div className="grid gap-[10px] md:hidden">
              {servers.map((row) => (
                <article className={MOBILE_CARD_CLASS} key={row.id}>
                  <div className="flex min-w-0 items-start justify-between gap-[10px]">
                    <div className="min-w-0">
                      <strong className="block truncate text-[14px] font-semibold text-[#18181a]">
                        {row.display_name || row.name}
                      </strong>
                      <span className="mt-[2px] block truncate text-[12px] text-[#858b9c]">{row.name}</span>
                    </div>
                    <span className="shrink-0">
                      <StatusBadge tone="blue">工具集</StatusBadge>
                    </span>
                  </div>
                  <div className="mt-[8px] flex flex-wrap items-center gap-[6px]">
                    <StatusBadge tone="gray">{transportLabel(row.connection.transport)}</StatusBadge>
                    <StatusBadge tone={row.enabled ? 'green' : 'gray'}>{row.enabled ? '已启用' : '已停用'}</StatusBadge>
                    <StatusBadge tone="gray">{row.tool_count} 个工具</StatusBadge>
                  </div>
                  <p className="mt-[8px] line-clamp-1 wrap-break-word text-[12px] text-[#858b9c]">
                    {serverEndpoint(row.connection)}
                  </p>
                  <div className="mt-[10px] flex items-center gap-[8px]">
                    <UIButton
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/enterprise/tools/mcp/${row.id}/edit`)}
                      className={RETURN_BUTTON_CLASS}
                    >
                      <IconRefresh className="size-[14px] shrink-0" />
                      发现/同步
                    </UIButton>
                    {isOverallAgent && (
                      <UIButton
                        variant="outline"
                        size="sm"
                        onClick={() => setServerDeleteTarget(row)}
                        className={cn(RETURN_BUTTON_CLASS, 'text-[#e5484d] hover:text-[#e5484d]')}
                      >
                        删除
                      </UIButton>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-[18px]">
          <div className="flex items-center gap-[6px] px-[12px] text-[#757f9c]">
            <IconBriefcase className="size-[14px] shrink-0" />
            <span className="text-[14px] font-normal leading-none">{listLabel}</span>
          </div>

          <div className="flex flex-wrap items-center gap-[16px]">
            <label className="flex h-[34px] w-[300px] items-center gap-[8px] overflow-hidden rounded-[10px] border-[0.5px] border-[#e3e7f1] bg-white px-[12px] transition-colors focus-within:border-[#18181a] max-[900px]:w-full">
              <IconSearch className="size-[14px] shrink-0 text-[#858b9c]" />
              <input
                value={searchText}
                placeholder="搜索工具名称、描述、URL 或分桶"
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
            <UISelect value={bucketFilter} onValueChange={setBucketFilter}>
              <SelectTrigger className={cn(SELECT_TRIGGER_CLASS, 'w-[180px]')} aria-label="分桶筛选">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bucketSelectOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
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
              aria-label="工具列表"
              columns={columns}
              data={pagination.pagedItems}
              rowKey={(row) => row.id}
              loading={loading}
              emptyText={listEmptyText}
            />
          </div>

          {filteredRows.length > 0 && (
            <Paginator
              aria-label="工具分页"
              className="mt-0 mb-[6px]"
              page={pagination.page}
              pageCount={pagination.pageCount}
              onChange={pagination.setPage}
            />
          )}
        </div>
      </div>

      <ResourceImportDialog
        open={importOpen}
        loading={importLoading}
        icon={<IconTool className="size-[14px] shrink-0" />}
        title={importMode === 'plaza' ? '从广场复制工具' : '从数字员工复制工具'}
        targetLabel="复制到"
        targetPlaceholder="选择目标员工"
        targets={importTargetCandidates().map((item) => ({ value: item.id, label: item.name }))}
        targetId={importTargetAgentId}
        sourcePlaceholder={importMode === 'plaza' ? '选择开放广场' : '选择复制来源'}
        sources={importMode === 'plaza'
          ? openGalleryImportSourceOptions(agents, '开放广场')
          : visibleEmployeeAgents(agents, currentUser, { activeOnly: true, excludeAgentId: importTargetAgentId })
            .map((item) => ({ value: item.id, label: item.name }))}
        sourceId={importSourceAgentId}
        itemsLabel="选择工具"
        items={importSourceTools.map((item) => ({
          id: item.id,
          label: (
            <>
              {item.display_name || item.name}
              <span className="text-[#858b9c]"> · {item.name}</span>
            </>
          ),
        }))}
        selectedIds={importSelectedToolIds}
        emptyText="没有可复制的工具"
        note={
          importMode === 'plaza'
            ? '从开放广场复制可用工具；复制后会成为当前员工的本地工具绑定。'
            : '从数字员工复制可用工具；不可见内容不会出现在列表。'
        }
        onTargetChange={handleImportTargetChange}
        onSourceChange={(value) => {
          setImportSourceAgentId(value);
          void loadImportSourceTools(value);
        }}
        onSelectedChange={setImportSelectedToolIds}
        onClose={() => setImportOpen(false)}
        onSubmit={() => void submitImportTools()}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        loading={deleting}
        title={deleteTarget ? `${isOverallAgent ? '删除' : '移除'}工具「${deleteTarget.display_name || deleteTarget.name}」？` : ''}
        description={
          isOverallAgent
            ? '删除后，引用该工具的技能将无法继续调用它，操作不可撤销。'
            : '从当前员工移除后，工具广场中的原始工具不会被删除。'
        }
        confirmText={isOverallAgent ? '删除' : '移除'}
        onConfirm={() => void confirmDelete()}
      />

      <ConfirmDialog
        open={Boolean(serverDeleteTarget)}
        onOpenChange={(open) => {
          if (!open) setServerDeleteTarget(null);
        }}
        loading={deletingServer}
        title={serverDeleteTarget ? `删除 MCP 服务器「${serverDeleteTarget.display_name || serverDeleteTarget.name}」？` : ''}
        description={`其下 ${serverDeleteTarget?.tool_count ?? 0} 个已导入工具将一并删除，操作不可撤销。`}
        confirmText="删除"
        onConfirm={() => void confirmDeleteServer()}
      />
    </div>
  );
}
