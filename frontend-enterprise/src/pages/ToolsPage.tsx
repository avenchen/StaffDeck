import { ArrowLeftOutlined, ExperimentOutlined, SaveOutlined, ToolOutlined } from '../icons';
import type { HTMLAttributes, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';

import { api, TENANT_ID } from '../api/client';
import type { EnterpriseAuthUser } from '../auth';
import AppHeader from '@/components/AppHeader';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Paginator } from '@/components/Paginator';
import { StatCard } from '@/components/StatCard';
import {
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
  Switch,
  Textarea,
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
  formatDateTime,
} from '@/lib/enterprise-ui';
import CodeBlock from '../components/CodeBlock';
import IconAdd from '../assets/icons/add.svg?react';
import IconChevronDown from '../assets/icons/chevron-down.svg?react';
import IconClear from '../assets/icons/field-clear.svg?react';
import IconEdit from '../assets/icons/edit.svg?react';
import IconMore from '../assets/icons/more.svg?react';
import IconRefresh from '../assets/icons/refresh.svg?react';
import IconSearch from '../assets/icons/search.svg?react';
import IconTool from '../assets/icons/plaza-tool.svg?react';
import IconTrash from '../assets/icons/trash.svg?react';
import { useClientPagination } from '../hooks/useClientPagination';
import { StatusBadge } from './scheduled-tasks/StatusBadge';
import type { AgentProfileRead, ToolRead } from '../types';

type ToolPageProps = {
  currentUser?: EnterpriseAuthUser;
  onLogout?: () => void;
};

const ENTERPRISE_AGENT_STORAGE_KEY = 'ultrarag_enterprise_agent_scope';
const TOOL_PAGE_SIZE = 10;
const TOOL_FORM_INITIAL_VALUES = {
  tool_type: 'http',
  method: 'POST',
  enabled: true,
  bucket: '未分桶',
  headers: '{}',
  auth: '{}',
  mcp_config: '{}',
  input_schema: '{}',
  output_schema: '{}',
};

type ToolFormValues = typeof TOOL_FORM_INITIAL_VALUES & {
  name?: string;
  display_name?: string;
  description?: string;
  allowed_skills?: string;
  url?: string;
};

export default function ToolsPage({ currentUser, onLogout }: ToolPageProps = {}) {
  const [rows, setRows] = useState<ToolRead[]>([]);
  const [agentId, setAgentId] = useState(() => window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) || '');
  const [isOverallAgent, setIsOverallAgent] = useState(true);
  const [agentScopeLoaded, setAgentScopeLoaded] = useState(false);
  const [bucketFilter, setBucketFilter] = useState('__all__');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ToolRead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const pageTitle = isOverallAgent ? '工具广场' : '工具';
  const listLabel = isOverallAgent ? '工具广场列表' : '员工工具';

  const agentQuery = agentId ? `&agent_id=${encodeURIComponent(agentId)}` : '';
  const load = () => {
    setLoading(true);
    return api
      .get<ToolRead[]>(`/api/enterprise/tools?tenant_id=${TENANT_ID}${agentQuery}`)
      .then(setRows)
      .catch((error) => notify.error(error instanceof Error ? error.message : '加载工具失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentQuery]);

  useEffect(() => {
    const loadAgentScope = async () => {
      try {
        const agents = await api.get<AgentProfileRead[]>(`/api/enterprise/agents?tenant_id=${TENANT_ID}`);
        const selectedAgent = agents.find((agent) => agent.id === agentId) || agents.find((agent) => agent.is_overall) || null;
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
    if (isOverallAgent) {
      notify.warning('请先选择一个数字员工，再从广场复制工具');
    } else {
      handleCreateAction('plaza');
    }
    const next = new URLSearchParams(searchParams);
    next.delete('add');
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
      const agentSuffix = agentId ? `&agent_id=${encodeURIComponent(agentId)}` : '';
      await api.delete(`/api/enterprise/tools/${row.id}?tenant_id=${TENANT_ID}${agentSuffix}`);
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
    if (key === 'plaza') {
      notify.warning('请先选择一个数字员工，再从广场复制工具');
      return;
    }
    if (key === 'employee') {
      notify.info('从数字员工复制工具会在后续版本接入。');
    }
  }

  function renderActions(row: ToolRead) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="工具操作"
          className="ml-auto grid size-7 place-items-center rounded-[8px] text-[#1a71ff] transition-colors outline-none hover:bg-black/5 hover:text-[#4a8dff] focus-visible:bg-black/5 dark:hover:bg-white/10"
        >
          <IconMore className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
          <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => navigate(`/enterprise/tools/${row.id}/edit`)}>
            <IconEdit />
            编辑
          </DropdownMenuItem>
          <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => navigate(`/enterprise/tools/${row.id}/test`)}>
            <FlaskConical />
            测试
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-[2px] bg-[#eef0f4] dark:bg-white/10" />
          <DropdownMenuItem
            variant="destructive"
            className={MENU_ITEM_DANGER_CLASS}
            onSelect={() => setDeleteTarget(row)}
          >
            <IconTrash />
            {isOverallAgent ? '删除' : '移除'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const columns: DataTableColumn<ToolRead>[] = [
    {
      key: 'name',
      title: '工具名称',
      width: 200,
      className: 'text-[#18181a] dark:text-white',
      render: (row) => (
        <div className="flex min-w-0 flex-col gap-[2px]">
          <span className="truncate font-medium leading-[18px] text-[#18181a] dark:text-white" title={row.display_name || row.name}>
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

  const renderMobileCard = (row: ToolRead) => (
    <article className={MOBILE_CARD_CLASS} key={row.id}>
      <div className="flex min-w-0 items-start justify-between gap-[10px]">
        <div className="min-w-0">
          <strong className="block truncate text-[14px] font-semibold text-[#18181a] dark:text-white">
            {row.display_name || row.name}
          </strong>
          <span className="mt-[2px] block truncate text-[12px] text-[#858b9c]">{row.name}</span>
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

  const listEmptyText = isOverallAgent ? '暂无工具，点击「新增」创建一个吧' : '当前员工暂无工具';

  return (
    <div className="min-h-full box-border px-[48px] pt-[32px] pb-[43px] max-[900px]:px-[16px]">
      <AppHeader onLogout={onLogout} userName={currentUser?.username} title={pageTitle} />

      <div className="mt-[20px] mb-[16px] flex items-center justify-end gap-[12px]">
        <UIButton
          variant="outline"
          onClick={() => void load()}
          disabled={loading}
          className="h-[34px] gap-[4px] rounded-[10px] border-[0.5px] border-[#e3e7f1] bg-white px-[20px] text-[12px] font-normal text-[#757f9c] hover:border-[#cbd3e6] hover:bg-white hover:text-[#18181a] dark:border-border dark:bg-(--surface) dark:text-muted-foreground dark:hover:bg-(--surface)"
        >
          <IconRefresh className={cn('size-[14px]', loading && 'animate-spin')} />
          刷新
        </UIButton>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-[34px] items-center gap-[4px] rounded-[10px] bg-[#18181a] px-[20px] text-[12px] font-normal text-white outline-none transition-colors hover:bg-[#303030] dark:bg-white dark:text-[#18181a] dark:hover:bg-white/90">
            <IconAdd className="size-[14px]" />
            新增
            <IconChevronDown className="size-[12px]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => handleCreateAction('blank')}>
              <IconAdd />
              新建空白工具
            </DropdownMenuItem>
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
      </div>

      <div className="flex flex-col gap-[24px] rounded-[20px_20px_0_0] bg-white p-[18px_18px_24px_18px] shadow-[0_-4px_16px_0_rgba(0,0,0,0.05)] dark:bg-(--surface)">
        <div className="flex flex-wrap items-stretch gap-[20px]" aria-label="工具统计">
          <StatCard label="工具总数" value={stats.total} className="basis-[220px]" />
          <StatCard label="已启用" value={stats.enabled} tone="green" className="basis-[220px]" />
          <StatCard label="分桶" value={stats.buckets} className="basis-[220px]" />
        </div>

        <div className="flex flex-col gap-[18px]">
          <div className="flex items-center gap-[6px] px-[12px] text-[#757f9c] dark:text-muted-foreground">
            <IconTool className="size-[14px] shrink-0" />
            <span className="text-[14px] font-normal leading-none">{listLabel}</span>
          </div>

          <div className="flex flex-wrap items-center gap-[16px]">
            <label className="flex h-[34px] w-[300px] items-center gap-[8px] overflow-hidden rounded-[10px] border-[0.5px] border-[#e3e7f1] bg-white px-[12px] transition-colors focus-within:border-[#18181a] max-[900px]:w-full dark:border-border dark:bg-(--surface) dark:focus-within:border-white/40">
              <IconSearch className="size-[14px] shrink-0 text-[#858b9c]" />
              <input
                value={searchText}
                placeholder="搜索工具名称、描述、URL 或分桶"
                onChange={(event) => setSearchText(event.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-[#17191f] outline-none placeholder:text-[#c0c6d4] dark:text-white dark:placeholder:text-muted-foreground"
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
    </div>
  );
}

export function ToolNewPage(props: ToolPageProps = {}) {
  return <ToolEditorPage mode="new" {...props} />;
}

export function ToolEditPage(props: ToolPageProps = {}) {
  return <ToolEditorPage mode="edit" {...props} />;
}

function ToolEditorPage({ mode, currentUser, onLogout }: { mode: 'new' | 'edit' } & ToolPageProps) {
  const [values, setValues] = useState<ToolFormValues>({ ...TOOL_FORM_INITIAL_VALUES });
  const [tool, setTool] = useState<ToolRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [bucketOptions, setBucketOptions] = useState<{ value: string; label: string }[]>([{ value: '未分桶', label: '未分桶' }]);
  const navigate = useNavigate();
  const { toolId } = useParams();
  const isEdit = mode === 'edit';

  const setField = <K extends keyof ToolFormValues>(name: K, value: ToolFormValues[K]) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  useEffect(() => {
    void loadBucketOptions().then(setBucketOptions);
  }, []);

  useEffect(() => {
    if (!isEdit) {
      setValues({ ...TOOL_FORM_INITIAL_VALUES });
      setTool(null);
      return;
    }
    if (!toolId) return;
    setLoading(true);
    const agentQuery = currentAgentQuery();
    api
      .get<ToolRead>(`/api/enterprise/tools/${toolId}?tenant_id=${TENANT_ID}${agentQuery}`)
      .then((row) => {
        setTool(row);
        setValues(toolToFormValues(row));
      })
      .catch((error) => notify.error(error instanceof Error ? error.message : '加载工具失败'))
      .finally(() => setLoading(false));
  }, [isEdit, toolId]);

  async function save() {
    if (!String(values.name || '').trim()) {
      notify.error('请填写工具名称');
      return;
    }
    if (!String(values.url || '').trim()) {
      notify.error(values.tool_type === 'mcp' ? '请填写 MCP URL 标记' : '请填写 URL');
      return;
    }
    if (values.tool_type === 'mcp' && !String(values.mcp_config || '').trim()) {
      notify.error('请填写 MCP Config JSON');
      return;
    }
    const payload = buildToolPayload(values);
    if (!payload) return;
    setLoading(true);
    try {
      const agentQuery = currentAgentQuery();
      const saved = isEdit && toolId
        ? await api.put<ToolRead>(`/api/enterprise/tools/${toolId}${agentQuery ? `?${agentQuery.slice(1)}` : ''}`, payload)
        : await api.post<ToolRead>(`/api/enterprise/tools${agentQuery ? `?${agentQuery.slice(1)}` : ''}`, payload);
      notify.success('已保存');
      setTool(saved);
      setValues(toolToFormValues(saved));
      if (!isEdit) {
        navigate(`/enterprise/tools/${saved.id}/edit`, { replace: true });
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full box-border px-[48px] pt-[32px] pb-[43px] max-[900px]:px-[16px]">
      <AppHeader
        onLogout={onLogout}
        userName={currentUser?.username}
        left={(
          <div>
            <h3 className="mb-[4px] text-[18px] font-semibold text-foreground">{isEdit ? '编辑工具' : '新建空白工具'}</h3>
            <span className="text-[13px] text-muted-foreground">
              {isEdit ? '修改工具定义，并在右侧验证当前配置或已保存版本。' : '填写工具定义后，可先用右侧探测区测试请求与返回结构。'}
            </span>
          </div>
        )}
      />
      <div className="page-title mt-1" style={{ justifyContent: 'flex-end' }}>
        <div className="flex flex-wrap items-center gap-[8px]">
          <UIButton variant="outline" onClick={() => navigate('/enterprise/tools')}>
            <ArrowLeftOutlined />
            返回工具
          </UIButton>
          {isEdit && tool && (
            <UIButton variant="outline" onClick={() => navigate(`/enterprise/tools/${tool.id}/test`)}>
              <ExperimentOutlined />
              打开测试页
            </UIButton>
          )}
          <UIButton disabled={loading} onClick={() => void save()}>
            <SaveOutlined />
            保存
          </UIButton>
        </div>
      </div>
      <div className="grid-2">
        <EditorCard className="editor-card" bodyClassName="p-[18px]" title="工具定义" loading={loading && isEdit && !tool}>
          <ToolFormFields values={values} setField={setField} bucketOptions={bucketOptions} />
        </EditorCard>
        <div className="flex w-full flex-col gap-[16px]">
          <ToolProbeCard values={values} />
          {isEdit && tool && <SavedToolTestCard tool={tool} />}
        </div>
      </div>
    </div>
  );
}

function EditorCard({
  className,
  bodyClassName,
  title,
  extra,
  loading,
  children,
  ...rest
}: {
  className?: string;
  bodyClassName?: string;
  title?: ReactNode;
  extra?: ReactNode;
  loading?: boolean;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, 'title'>) {
  return (
    <div className={cn('ant-card', className)} {...rest}>
      {(title || extra) && (
        <div className="ant-card-head border-b border-border">
          <div className="ant-card-head-wrapper flex min-h-[46px] items-center justify-between gap-[12px] px-[16px]">
            <div className="ant-card-head-title min-w-0">{title}</div>
            {extra ? <div className="ant-card-extra min-w-0">{extra}</div> : null}
          </div>
        </div>
      )}
      <div className={cn('ant-card-body', bodyClassName)}>
        {loading ? (
          <div className="py-[24px] text-center text-[13px] text-[#858b9c] dark:text-muted-foreground">加载中…</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-[6px]">
      <span className="text-[12px] font-medium text-[#464c5e] dark:text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function ToolTestPage({ currentUser, onLogout }: ToolPageProps = {}) {
  const [tool, setTool] = useState<ToolRead | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toolId } = useParams();

  useEffect(() => {
    if (!toolId) return;
    setLoading(true);
    const agentQuery = currentAgentQuery();
    api
      .get<ToolRead>(`/api/enterprise/tools/${toolId}?tenant_id=${TENANT_ID}${agentQuery}`)
      .then(setTool)
      .catch((error) => notify.error(error instanceof Error ? error.message : '加载工具失败'))
      .finally(() => setLoading(false));
  }, [toolId]);

  return (
    <div className="min-h-full box-border px-[48px] pt-[32px] pb-[43px] max-[900px]:px-[16px]">
      <AppHeader
        onLogout={onLogout}
        userName={currentUser?.username}
        left={(
          <div>
            <h3 className="mb-[4px] text-[18px] font-semibold text-foreground">工具测试</h3>
            <span className="text-[13px] text-muted-foreground">
              用测试参数直接调用已保存工具，检查员工后续调用时的实际返回。
            </span>
          </div>
        )}
      />
      <div className="page-title mt-1" style={{ justifyContent: 'flex-end' }}>
        <div className="flex flex-wrap items-center gap-[8px]">
          <UIButton variant="outline" onClick={() => navigate('/enterprise/tools')}>
            <ArrowLeftOutlined />
            返回工具
          </UIButton>
          {tool && (
            <UIButton variant="outline" onClick={() => navigate(`/enterprise/tools/${tool.id}/edit`)}>
              编辑工具
            </UIButton>
          )}
        </div>
      </div>
      <div className="tool-test-layout">
        <EditorCard className="tool-test-overview-card" title="工具信息" loading={loading && !tool}>
          {tool && (
            <div className="tool-test-overview">
              <div className="tool-test-hero">
                <div className="tool-test-icon">
                  <ToolOutlined />
                </div>
                <div className="tool-test-hero-main">
                  <span className="tool-test-eyebrow">{tool.bucket || '未分桶'}</span>
                  <h4 className="m-0 text-[18px] font-semibold text-foreground">{tool.display_name || tool.name}</h4>
                  <p className="mt-[4px] mb-0 text-[13px] text-[#858b9c] dark:text-muted-foreground">{tool.description || '暂无描述'}</p>
                  <div className="mt-[10px] flex flex-wrap items-center gap-[6px]">
                    <ToolTag tone={tool.tool_type === 'mcp' ? 'blue' : 'gray'}>{toolTypeLabel(tool)}</ToolTag>
                    <ToolTag tone={tool.enabled ? 'green' : 'gray'}>{tool.enabled ? '已启用' : '已停用'}</ToolTag>
                    <ToolTag tone="gray">{tool.method}</ToolTag>
                  </div>
                </div>
              </div>
              <div className="tool-test-meta-grid">
                <div>
                  <span>工具 ID</span>
                  <strong>{tool.name}</strong>
                </div>
                <div>
                  <span>输入字段</span>
                  <strong>{schemaPropertyCount(tool.input_schema)}</strong>
                </div>
                <div>
                  <span>输出字段</span>
                  <strong>{schemaPropertyCount(tool.output_schema)}</strong>
                </div>
                <div>
                  <span>最近更新</span>
                  <strong>{formatDateTime(tool.updated_at)}</strong>
                </div>
              </div>
              <div className="tool-test-endpoint">
                <span>调用地址</span>
                <code>{tool.method} {tool.url}</code>
              </div>
              <div className="tool-test-schema-grid">
                <div className="tool-test-schema-panel">
                  <div className="tool-test-section-title">Input Schema</div>
                  <CodeBlock className="tool-test-code" code={formatJson(tool.input_schema)} language="json" />
                </div>
                <div className="tool-test-schema-panel">
                  <div className="tool-test-section-title">Output Schema</div>
                  <CodeBlock className="tool-test-code" code={formatJson(tool.output_schema)} language="json" />
                </div>
              </div>
            </div>
          )}
        </EditorCard>
        {tool && <SavedToolTestCard tool={tool} standalone />}
      </div>
    </div>
  );
}

function ToolFormFields({
  values,
  setField,
  bucketOptions,
}: {
  values: ToolFormValues;
  setField: <K extends keyof ToolFormValues>(name: K, value: ToolFormValues[K]) => void;
  bucketOptions: { value: string; label: string }[];
}) {
  const toolType = values.tool_type || 'http';
  return (
    <div className="flex flex-col gap-[14px]">
      <LabeledField label="工具名称">
        <div className="relative">
          <ToolOutlined className="pointer-events-none absolute left-[10px] top-1/2 -translate-y-1/2 text-[#858b9c]" />
          <Input className="pl-[30px]" value={values.name || ''} onChange={(event) => setField('name', event.target.value)} />
        </div>
      </LabeledField>
      <LabeledField label="展示名称">
        <Input value={values.display_name || ''} onChange={(event) => setField('display_name', event.target.value)} />
      </LabeledField>
      <LabeledField label="工具类型">
        <UISelect value={toolType} onValueChange={(value) => setField('tool_type', value)}>
          <SelectTrigger className={cn(SELECT_TRIGGER_CLASS, 'w-full')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="http">HTTP 接口</SelectItem>
            <SelectItem value="mcp">MCP 服务</SelectItem>
          </SelectContent>
        </UISelect>
      </LabeledField>
      <LabeledField label="工具分桶">
        <Input
          list="tool-bucket-options"
          placeholder="选择或输入分桶"
          value={values.bucket || ''}
          onChange={(event) => setField('bucket', event.target.value)}
        />
        <datalist id="tool-bucket-options">
          {bucketOptions.map((item) => (
            <option key={item.value} value={item.value} />
          ))}
        </datalist>
      </LabeledField>
      <LabeledField label="描述">
        <Textarea rows={2} value={values.description || ''} onChange={(event) => setField('description', event.target.value)} />
      </LabeledField>
      <LabeledField label={toolType === 'mcp' ? 'Method 标记' : 'HTTP Method'}>
        <UISelect value={values.method} onValueChange={(value) => setField('method', value)}>
          <SelectTrigger className={cn(SELECT_TRIGGER_CLASS, 'w-full')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => (
              <SelectItem key={value} value={value}>{value}</SelectItem>
            ))}
          </SelectContent>
        </UISelect>
      </LabeledField>
      <LabeledField label={toolType === 'mcp' ? 'MCP URL 标记' : 'URL'}>
        <Input
          placeholder={toolType === 'mcp' ? 'mcp://builtin.demo/echo' : '/api/mock/order/query'}
          value={values.url || ''}
          onChange={(event) => setField('url', event.target.value)}
        />
      </LabeledField>
      {toolType === 'mcp' ? (
        <LabeledField label="MCP Config JSON">
          <Textarea
            rows={4}
            placeholder={'{\n  "server": "builtin.demo",\n  "tool": "echo"\n}'}
            value={values.mcp_config}
            onChange={(event) => setField('mcp_config', event.target.value)}
          />
        </LabeledField>
      ) : (
        <>
          <LabeledField label="Headers JSON">
            <Textarea rows={4} value={values.headers} onChange={(event) => setField('headers', event.target.value)} />
          </LabeledField>
          <LabeledField label="Auth JSON">
            <Textarea rows={3} value={values.auth} onChange={(event) => setField('auth', event.target.value)} />
          </LabeledField>
        </>
      )}
      <LabeledField label="Input Schema">
        <Textarea rows={5} value={values.input_schema} onChange={(event) => setField('input_schema', event.target.value)} />
      </LabeledField>
      <LabeledField label="Output Schema">
        <Textarea rows={5} value={values.output_schema} onChange={(event) => setField('output_schema', event.target.value)} />
      </LabeledField>
      <LabeledField label="Allowed Skills">
        <Input
          placeholder="skill_id_1,skill_id_2"
          value={values.allowed_skills || ''}
          onChange={(event) => setField('allowed_skills', event.target.value)}
        />
      </LabeledField>
      <label className="flex cursor-pointer items-center gap-[8px]">
        <Switch checked={values.enabled} onCheckedChange={(next) => setField('enabled', next)} />
        <span className="text-[12px] font-medium text-[#464c5e] dark:text-muted-foreground">启用</span>
      </label>
    </div>
  );
}

function ToolProbeCard({ values }: { values: ToolFormValues }) {
  const [sampleJson, setSampleJson] = useState('{}');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const method = values.method || 'POST';
  const isGetMethod = method === 'GET';

  async function probe() {
    if (!String(values.name || '').trim()) {
      notify.error('请填写工具名称');
      return;
    }
    if (!String(values.url || '').trim()) {
      notify.error(values.tool_type === 'mcp' ? '请填写 MCP URL 标记' : '请填写 URL');
      return;
    }
    const payload = buildToolPayload(values);
    if (!payload) return;
    let sampleArguments: Record<string, unknown>;
    try {
      sampleArguments = parseJson(sampleJson, {});
    } catch {
      notify.error('测试参数不是合法 JSON');
      return;
    }
    if (
      payload.tool_type === 'http'
      && payload.method !== 'GET'
      && payload.url.includes('?')
      && Object.keys(sampleArguments).length === 0
    ) {
      notify.error('URL 已包含查询参数时请把 HTTP Method 切换为 GET；POST 会把测试参数作为 JSON Body 发送。');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post('/api/enterprise/tools/probe', {
        tenant_id: TENANT_ID,
        name: payload.name,
        display_name: payload.display_name,
        description: payload.description,
        bucket: payload.bucket,
        tool_type: payload.tool_type,
        method: payload.method,
        url: payload.url,
        headers: payload.headers,
        auth: payload.auth,
        mcp_config: payload.mcp_config,
        input_schema: payload.input_schema,
        output_schema: payload.output_schema,
        sample_arguments: sampleArguments,
      });
      setResult(JSON.stringify(response, null, 2));
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '探测失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <EditorCard
      className="editor-card"
      bodyClassName="p-[18px]"
      title="配置探测"
      extra={(
        <UIButton variant="outline" disabled={loading} onClick={() => void probe()}>
          <ExperimentOutlined />
          探测
        </UIButton>
      )}
    >
      <p className="mb-[8px] text-[13px] text-[#858b9c] dark:text-muted-foreground">
        无需保存，直接用当前配置测试连接。
      </p>
      <div className="tool-test-section-title">
        {isGetMethod ? '测试参数 JSON（拼到 URL Query）' : '测试参数 JSON（作为请求 Body）'}
      </div>
      <p className="tool-probe-hint mb-[8px] text-[13px] text-[#858b9c] dark:text-muted-foreground">
        {isGetMethod
          ? 'GET 会把这里的字段作为查询参数追加到 URL；参数值填写未编码原文，例如 timezone 用 Asia/Shanghai。'
          : '非 GET 请求会把这里的 JSON 作为请求体发送；仅 URL 查询串不会变成请求 Body。'}
      </p>
      <Textarea rows={5} value={sampleJson} onChange={(event) => setSampleJson(event.target.value)} />
      <div className="tool-test-section-title tool-test-result-label">探测结果</div>
      <Textarea className="mt-[12px]" rows={8} value={result} readOnly />
    </EditorCard>
  );
}

function SavedToolTestCard({ tool, standalone = false }: { tool: ToolRead; standalone?: boolean }) {
  const [testJson, setTestJson] = useState(() => JSON.stringify(exampleFromSchema(tool.input_schema), null, 2));
  const [testResult, setTestResult] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTestJson(JSON.stringify(exampleFromSchema(tool.input_schema), null, 2));
    setTestResult('');
  }, [tool.id, tool.input_schema]);

  async function test() {
    let argumentsJson: Record<string, unknown>;
    try {
      argumentsJson = parseJson(testJson, {});
    } catch {
      notify.error('测试参数不是合法 JSON');
      return;
    }
    setLoading(true);
    try {
      const agentQuery = currentAgentQuery();
      const response = await api.post(`/api/enterprise/tools/${tool.id}/test${agentQuery ? `?${agentQuery.slice(1)}` : ''}`, {
        tenant_id: TENANT_ID,
        arguments: argumentsJson,
      });
      setTestResult(JSON.stringify(response, null, 2));
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '调用失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <EditorCard
      className="tool-test-console-card"
      title={(
        <span className="tool-test-card-title">
          <ExperimentOutlined />
          {standalone ? '调用测试' : '已保存工具测试'}
        </span>
      )}
      extra={(
        <UIButton disabled={loading} onClick={() => void test()}>
          <ExperimentOutlined />
          调用
        </UIButton>
      )}
    >
      <div className="tool-test-console-intro">
        <span className="text-[13px] text-[#858b9c] dark:text-muted-foreground">
          调用已保存的「{tool.display_name || tool.name}」，用于验证员工实际可用的工具返回。
        </span>
        <ToolTag tone="gray">{toolTypeLabel(tool)}</ToolTag>
      </div>
      <div className="tool-test-editor-block">
        <div className="tool-test-section-title">测试参数</div>
        <Textarea
          className="tool-test-json-input"
          rows={8}
          value={testJson}
          onChange={(event) => setTestJson(event.target.value)}
        />
      </div>
      <div className="tool-test-editor-block">
        <div className="tool-test-result-head">
          <div className="tool-test-section-title">调用结果</div>
          <ToolTag tone={testResult ? 'green' : 'gray'}>{testResult ? '已返回' : '等待调用'}</ToolTag>
        </div>
        {testResult ? (
          <CodeBlock className="tool-test-result-code" code={testResult} language="json" />
        ) : (
          <div className="tool-test-empty-result">点击调用后，这里会显示工具返回、错误信息和原始 data。</div>
        )}
      </div>
    </EditorCard>
  );
}

function ToolTag({ tone = 'gray', children }: { tone?: 'gray' | 'blue' | 'green'; children: ReactNode }) {
  const toneClass = {
    gray: 'bg-[#f2f3f5] text-[#5b6273] dark:bg-white/10 dark:text-muted-foreground',
    blue: 'bg-[#e6f0ff] text-[#1a71ff] dark:bg-[#1a71ff]/20 dark:text-[#7fb0ff]',
    green: 'bg-[#eafbf0] text-[#018434] dark:bg-[#018434]/20 dark:text-[#4bd07f]',
  }[tone];
  return (
    <span className={cn('inline-flex items-center rounded-[6px] px-[8px] py-[2px] text-[12px] font-medium leading-[18px]', toneClass)}>
      {children}
    </span>
  );
}

async function loadBucketOptions() {
  const rows = await api.get<ToolRead[]>(`/api/enterprise/tools?tenant_id=${TENANT_ID}${currentAgentQuery()}`);
  return Array.from(new Set(['未分桶', ...rows.map((row) => row.bucket || '未分桶')]))
    .map((value) => ({ value, label: value }));
}

function currentAgentQuery() {
  const agentId = window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) || '';
  return agentId ? `&agent_id=${encodeURIComponent(agentId)}` : '';
}

function toolToFormValues(row: ToolRead): ToolFormValues {
  return {
    ...TOOL_FORM_INITIAL_VALUES,
    ...row,
    bucket: row.bucket || '未分桶',
    tool_type: row.tool_type || 'http',
    headers: JSON.stringify(row.headers || {}, null, 2),
    auth: JSON.stringify(row.auth || {}, null, 2),
    mcp_config: JSON.stringify(row.mcp_config || {}, null, 2),
    input_schema: JSON.stringify(row.input_schema || {}, null, 2),
    output_schema: JSON.stringify(row.output_schema || {}, null, 2),
    allowed_skills: (row.allowed_skills || []).join(','),
  };
}

function buildToolPayload(values: ToolFormValues) {
  try {
    return {
      tenant_id: TENANT_ID,
      name: String(values.name || '').trim(),
      display_name: values.display_name,
      description: values.description,
      bucket: values.bucket || '未分桶',
      tool_type: values.tool_type || 'http',
      method: values.method,
      url: String(values.url || '').trim(),
      headers: parseJson(values.headers, {}),
      auth: parseJson(values.auth, {}),
      mcp_config: values.tool_type === 'mcp' ? parseJson(values.mcp_config, {}) : {},
      input_schema: parseJson(values.input_schema, {}),
      output_schema: parseJson(values.output_schema, {}),
      allowed_skills: String(values.allowed_skills || '').split(',').map((item) => item.trim()).filter(Boolean),
      enabled: values.enabled,
    };
  } catch {
    notify.error('JSON 配置格式不正确，请检查 Headers、Auth、Schema 或 MCP Config');
    return null;
  }
}

function buildBucketStats(rows: ToolRead[]) {
  const map = new Map<string, { bucket: string; total: number; enabled: number; disabled: number }>();
  rows.forEach((row) => {
    const bucket = row.bucket || '未分桶';
    const item = map.get(bucket) || { bucket, total: 0, enabled: 0, disabled: 0 };
    item.total += 1;
    if (row.enabled) item.enabled += 1;
    else item.disabled += 1;
    map.set(bucket, item);
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total || a.bucket.localeCompare(b.bucket));
}

function parseJson<T>(value: string, fallback: T): T {
  if (!value) return fallback;
  return JSON.parse(value) as T;
}

function formatJson(value: unknown): string {
  return JSON.stringify(value || {}, null, 2);
}

function schemaPropertyCount(schema: Record<string, unknown>): string {
  const properties = schema.properties && typeof schema.properties === 'object'
    ? schema.properties as Record<string, unknown>
    : {};
  return `${Object.keys(properties).length}`;
}

function toolTypeLabel(tool: ToolRead): string {
  return tool.tool_type === 'mcp' ? 'MCP 服务' : 'HTTP 接口';
}

function exampleFromSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const properties = schema.properties && typeof schema.properties === 'object'
    ? schema.properties as Record<string, Record<string, unknown>>
    : {};
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [key, exampleValue(key, value)]),
  );
}

function exampleValue(key: string, schema: Record<string, unknown>): unknown {
  if (schema.default !== undefined) return schema.default;
  if (schema.example !== undefined) return schema.example;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  if (schema.type === 'integer') return 1;
  if (schema.type === 'number') return 1;
  if (schema.type === 'boolean') return true;
  if (schema.type === 'array') return [];
  if (schema.type === 'object') return {};
  return `sample_${key}`;
}
