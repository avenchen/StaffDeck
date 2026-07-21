import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { TENANT_ID } from '@/api/client';
import { mcpServersApi } from '@/api/endpoints/tools';
import AppHeader from '@/components/AppHeader';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import {
  Checkbox,
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
import { Field } from '@/components/form/SectionCard';
import { SELECT_TRIGGER_CLASS } from '@/lib/enterprise-ui';
import IconArrowRight from '@/assets/icons/arrow-right.svg?react';
import IconRefresh from '@/assets/icons/refresh.svg?react';
import { StatusBadge } from '@/pages/scheduled-tasks/StatusBadge';
import { currentAgentId, parseArgs, parseJson, sanitizeMcpName, serverToFormValues } from '../lib/toolPayload';
import { SectionCard } from '../components/SectionCard';
import { ToolTypeSwitcher } from '../components/ToolTypeSwitcher';
import { FIELD_LABEL_CLASS, HINT_CLASS, MONO_INPUT_CLASS, PRIMARY_BUTTON_CLASS, RETURN_BUTTON_CLASS } from '../styles';
import {
  MCP_FORM_INITIAL_VALUES,
  TRANSPORT_OPTIONS,
  type DiscoveredRow,
  type McpFormValues,
  type ToolPageProps,
} from '../types';
import type { MCPServerRead, MCPServerConnection, MCPTransport } from '@/types';

export function McpServerNewPage(props: ToolPageProps = {}) {
  return <McpServerEditorPage mode="new" {...props} />;
}

export function McpServerEditPage(props: ToolPageProps = {}) {
  return <McpServerEditorPage mode="edit" {...props} />;
}

function McpServerEditorPage({ mode, currentUser, onLogout }: { mode: 'new' | 'edit' } & ToolPageProps) {
  const [values, setValues] = useState<McpFormValues>({ ...MCP_FORM_INITIAL_VALUES });
  const [server, setServer] = useState<MCPServerRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredRow[]>([]);
  const navigate = useNavigate();
  const { serverId } = useParams();
  const isEdit = mode === 'edit';

  const setField = <K extends keyof McpFormValues>(name: K, value: McpFormValues[K]) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  useEffect(() => {
    if (!isEdit) {
      setValues({ ...MCP_FORM_INITIAL_VALUES });
      setServer(null);
      setDiscovered([]);
      return;
    }
    if (!serverId) return;
    setLoading(true);
    mcpServersApi
      .get(serverId)
      .then((row) => {
        setServer(row);
        setValues(serverToFormValues(row));
      })
      .catch((error) => notify.error(error instanceof Error ? error.message : '加载 MCP 服务器失败'))
      .finally(() => setLoading(false));
  }, [isEdit, serverId]);

  const transportOption = TRANSPORT_OPTIONS.find((item) => item.value === values.transport);
  const isRemote = values.transport === 'streamable_http' || values.transport === 'sse';
  const isStdio = values.transport === 'stdio';

  function buildConnection(): MCPServerConnection | null {
    let headers: Record<string, string>;
    let env: Record<string, string>;
    try {
      headers = parseJson<Record<string, string>>(values.headers, {});
      env = parseJson<Record<string, string>>(values.env, {});
    } catch {
      notify.error('Headers 或 Env 不是合法 JSON');
      return null;
    }
    const args = parseArgs(values.args);
    if (isStdio) {
      return {
        transport: values.transport,
        url: null,
        headers,
        command: String(values.command || '').trim() || null,
        args,
        env,
        cwd: String(values.cwd || '').trim() || null,
      };
    }
    return {
      transport: values.transport,
      url: String(values.url || '').trim() || null,
      headers,
      command: null,
      args,
      env,
      cwd: null,
    };
  }

  function buildPayload(): { payload: Record<string, unknown>; connection: MCPServerConnection } | null {
    const connection = buildConnection();
    if (!connection) return null;
    return {
      connection,
      payload: {
        tenant_id: TENANT_ID,
        name: String(values.name || '').trim(),
        display_name: values.display_name,
        description: values.description,
        bucket: values.bucket || 'MCP 工具',
        connection,
        enabled: values.enabled,
      },
    };
  }

  async function save() {
    if (!String(values.name || '').trim()) {
      notify.error('请填写 MCP 服务器名称');
      return;
    }
    const built = buildPayload();
    if (!built) return;
    setSaving(true);
    try {
      const saved = isEdit && serverId
        ? await mcpServersApi.update(serverId, built.payload)
        : await mcpServersApi.create(built.payload);
      notify.success('已保存');
      setServer(saved);
      setValues(serverToFormValues(saved));
      if (!isEdit) {
        navigate(`/enterprise/tools/mcp/${saved.id}/edit`, { replace: true });
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function discover() {
    const built = buildPayload();
    if (!built) return;
    setDiscovering(true);
    try {
      const response = await mcpServersApi.discover(built.connection, server?.id);
      if (!response.success) {
        notify.error(response.error?.message || '发现工具失败');
        return;
      }
      setDiscovered(response.tools.map((tool) => ({ ...tool, selected: !tool.imported })));
      notify.success(`发现 ${response.tools.length} 个工具`);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '发现工具失败');
    } finally {
      setDiscovering(false);
    }
  }

  async function sync() {
    if (!server) {
      notify.warning('请先保存 MCP 服务器，再同步工具');
      return;
    }
    const selectedNames = discovered.filter((tool) => tool.selected).map((tool) => tool.name);
    if (discovered.length > 0 && selectedNames.length === 0) {
      notify.warning('请至少选择一个要导入的工具');
      return;
    }
    setSyncing(true);
    try {
      const response = await mcpServersApi.sync(
        server.id,
        discovered.length ? selectedNames : null,
        currentAgentId(),
      );
      if (!response.success) {
        notify.error(response.error?.message || '同步失败');
        return;
      }
      notify.success(`同步完成：新增 ${response.imported.length}，更新 ${response.updated.length}`);
      try {
        const refreshed = await mcpServersApi.get(server.id);
        setServer(refreshed);
      } catch {
        // ignore refresh failure
      }
      await discover();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '同步失败');
    } finally {
      setSyncing(false);
    }
  }

  const discoveredColumns: DataTableColumn<DiscoveredRow>[] = [
    {
      key: 'selected',
      title: '',
      width: 40,
      render: (row) => (
        <Checkbox
          checked={row.selected}
          onCheckedChange={(next) =>
            setDiscovered((prev) =>
              prev.map((item) => (item.name === row.name ? { ...item, selected: next === true } : item)),
            )
          }
          aria-label={`选择 ${row.name}`}
        />
      ),
    },
    {
      key: 'name',
      title: '工具',
      width: 220,
      className: 'whitespace-normal',
      render: (row) => (
        <span className="block wrap-break-word font-medium text-[#18181a]" title={row.name}>
          {row.name}
        </span>
      ),
    },
    {
      key: 'description',
      title: '描述',
      className: 'whitespace-normal',
      render: (row) => (
        <span className="block wrap-break-word text-[#858b9c]">{row.description || '暂无描述'}</span>
      ),
    },
    {
      key: 'imported',
      title: '状态',
      width: 96,
      render: (row) => (
        <StatusBadge tone={row.imported ? 'green' : 'gray'}>{row.imported ? '已导入' : '未导入'}</StatusBadge>
      ),
    },
  ];

  return (
    <div className="min-h-full box-border px-[48px] pt-[32px] pb-[43px] max-[900px]:px-[16px]" aria-busy={loading}>
      <AppHeader
        onLogout={onLogout}
        userName={currentUser?.username}
        title={isEdit ? '编辑 MCP 服务器' : '新建工具'}
        description="配置 MCP Server 连接后，可发现其提供的工具并同步为工具集。"
      />
      <div className="mt-[20px] mb-[16px] flex flex-wrap justify-end gap-[16px]">
        <UIButton variant="outline" onClick={() => navigate('/enterprise/tools')} className={RETURN_BUTTON_CLASS}>
          <IconArrowRight className="size-3.5 rotate-180" />
          返回工具
        </UIButton>
        <UIButton disabled={saving} onClick={() => void save()} className={PRIMARY_BUTTON_CLASS}>
          保存
        </UIButton>
      </div>
      {!isEdit && <ToolTypeSwitcher active="mcp" />}
      <div className="grid grid-cols-1 items-start gap-[20px] xl:grid-cols-2">
        <SectionCard title="连接配置" loading={loading && isEdit && !server}>
          <div className="flex flex-col gap-[16px]">
            <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2">
              <Field
                label="名称"
                htmlFor="mcp-name"
                hint={isEdit ? '保存后不可修改名称。' : '作为唯一标识，仅支持字母/数字/下划线；中文将自动转拼音，最长 15 字符。'}
              >
                <Input
                  id="mcp-name"
                  placeholder="my_mcp_server"
                  disabled={isEdit}
                  value={values.name}
                  onChange={(event) => setField('name', sanitizeMcpName(event.target.value))}
                />
              </Field>
              <Field label="展示名称" htmlFor="mcp-display-name">
                <Input
                  id="mcp-display-name"
                  placeholder="我的工具集"
                  value={values.display_name}
                  onChange={(event) => setField('display_name', event.target.value)}
                />
              </Field>
            </div>

            <Field label="描述" htmlFor="mcp-description">
              <Textarea
                id="mcp-description"
                rows={2}
                placeholder="简单说明这个工具集的用途"
                value={values.description}
                onChange={(event) => setField('description', event.target.value)}
              />
            </Field>

            <Field label="分桶" htmlFor="mcp-bucket">
              <Input
                id="mcp-bucket"
                placeholder="MCP 工具"
                value={values.bucket}
                onChange={(event) => setField('bucket', event.target.value)}
              />
            </Field>

            <Field label="连接方式" hint={transportOption?.hint}>
              <UISelect
                value={values.transport}
                onValueChange={(value) => setField('transport', value as MCPTransport)}
              >
                <SelectTrigger className={cn(SELECT_TRIGGER_CLASS, 'w-full')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSPORT_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </UISelect>
            </Field>

            {isRemote && (
              <>
                <Field label="URL" htmlFor="mcp-url">
                  <Input
                    id="mcp-url"
                    placeholder="https://example.com/mcp"
                    value={values.url}
                    onChange={(event) => setField('url', event.target.value)}
                  />
                </Field>
                <Field label="Headers JSON" htmlFor="mcp-headers">
                  <Textarea
                    id="mcp-headers"
                    rows={4}
                    className={MONO_INPUT_CLASS}
                    value={values.headers}
                    onChange={(event) => setField('headers', event.target.value)}
                  />
                </Field>
              </>
            )}

            {isStdio && (
              <>
                <Field label="Command" htmlFor="mcp-command">
                  <Input
                    id="mcp-command"
                    placeholder="python"
                    value={values.command}
                    onChange={(event) => setField('command', event.target.value)}
                  />
                </Field>
                <Field label="Args" htmlFor="mcp-args" hint="每行一个参数。">
                  <Textarea
                    id="mcp-args"
                    rows={4}
                    className={MONO_INPUT_CLASS}
                    placeholder={'-m\nmy_mcp.server\n--port\n8000'}
                    value={values.args}
                    onChange={(event) => setField('args', event.target.value)}
                  />
                </Field>
                <Field label="Env JSON" htmlFor="mcp-env">
                  <Textarea
                    id="mcp-env"
                    rows={4}
                    className={MONO_INPUT_CLASS}
                    value={values.env}
                    onChange={(event) => setField('env', event.target.value)}
                  />
                </Field>
                <Field label="工作目录（cwd）" htmlFor="mcp-cwd">
                  <Input
                    id="mcp-cwd"
                    placeholder="/path/to/workdir"
                    value={values.cwd}
                    onChange={(event) => setField('cwd', event.target.value)}
                  />
                </Field>
              </>
            )}

            <div className="flex items-center justify-between rounded-[12px] border border-[#eceef1] bg-[#fafbfc] px-[14px] py-[12px]">
              <div className="flex flex-col gap-[2px]">
                <span className={FIELD_LABEL_CLASS}>启用工具集</span>
                <span className={HINT_CLASS}>停用后其下工具将无法被员工调用。</span>
              </div>
              <Switch checked={values.enabled} onCheckedChange={(next) => setField('enabled', next)} />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="工具发现（tools/list）"
          bodyClassName="flex flex-col gap-[14px]"
          extra={(
            <div className="flex items-center gap-[8px]">
              <UIButton variant="outline" disabled={discovering} onClick={() => void discover()} className={RETURN_BUTTON_CLASS}>
                <IconRefresh className="size-[14px] shrink-0" />
                发现工具
              </UIButton>
              <UIButton disabled={!server || syncing} onClick={() => void sync()} className={PRIMARY_BUTTON_CLASS}>
                导入/同步
              </UIButton>
            </div>
          )}
        >
          <p className={HINT_CLASS}>
            {server
              ? '点击「发现工具」拉取 tools/list，勾选后「导入/同步」即可生成工具行。'
              : '请先保存 MCP 服务器，才能导入并同步工具。'}
          </p>
          {discovered.length ? (
            <DataTable
              aria-label="发现的工具"
              columns={discoveredColumns}
              data={discovered}
              rowKey={(row) => row.name}
              loading={discovering}
              emptyText="未发现工具"
            />
          ) : (
            <div className="grid min-h-[180px] place-items-center rounded-[12px] border border-dashed border-[#eceef1] p-[20px] text-center text-[13px] text-[#858b9c]">
              点击「发现工具」后，这里会列出该 MCP Server 提供的工具。
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
