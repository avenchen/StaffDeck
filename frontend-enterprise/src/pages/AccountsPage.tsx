import { useAuth } from '@/app/AuthProvider';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { User } from 'lucide-react';

import AppHeader from '@/components/AppHeader';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { Button as UIButton } from '@/components/ui/button';
import { notify } from '@/components/ui/app-toast';
import { cn } from '@/lib/utils';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_ITEM_DANGER_CLASS, MOBILE_CARD_CLASS, formatDateTime } from '@/lib/enterprise-ui';

import { api, TENANT_ID } from '../api/client';
import { departmentsApi } from '../api/endpoints/departments';
import type { DepartmentRead } from '@/types';
import IconAccounts from '../assets/icons/sys-accounts.svg?react';
import IconAdd from '../assets/icons/add.svg?react';
import IconClear from '../assets/icons/field-clear.svg?react';
import IconEdit from '../assets/icons/edit.svg?react';
import IconMore from '../assets/icons/more.svg?react';
import IconRefresh from '../assets/icons/refresh.svg?react';
import IconSearch from '../assets/icons/search.svg?react';
import IconTrash from '../assets/icons/trash.svg?react';
import type { EnterpriseAuthUser } from '../auth';
import { useClientPagination } from '../hooks/useClientPagination';

type EmployeeAccount = {
  id: string;
  tenant_id: string;
  username: string;
  display_name?: string;
  role: 'admin' | 'member';
  department_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

type AccountDraft = {
  displayName: string;
  password: string;
  role: 'admin' | 'member';
  departmentId: string;
};

type AccountCreateDraft = {
  username: string;
  displayName: string;
  password: string;
  role: 'admin' | 'member';
  departmentId: string;
};

/** Departments ordered as a pre-order tree walk, each labelled with indentation. */
export function orderedDepartmentOptions(
  departments: DepartmentRead[],
): { id: string; label: string; depth: number }[] {
  const children = new Map<string | null | undefined, DepartmentRead[]>();
  for (const dept of departments) {
    const key = dept.parent_id ?? null;
    const list = children.get(key) ?? [];
    list.push(dept);
    children.set(key, list);
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  const out: { id: string; label: string; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const dept of children.get(parentId) ?? []) {
      out.push({ id: dept.id, label: `${'　'.repeat(depth)}${dept.name}`, depth });
      walk(dept.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

const ACCOUNT_PAGE_SIZE = 10;

export default function AccountsPage({}: {
  currentUser?: EnterpriseAuthUser;
  onLogout?: () => void;
} = {}) {
  const { user: currentUser, logout: onLogout } = useAuth();

  const [rows, setRows] = useState<EmployeeAccount[]>([]);
  const [departments, setDepartments] = useState<DepartmentRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [editing, setEditing] = useState<EmployeeAccount | null>(null);
  const [draft, setDraft] = useState<AccountDraft>({ displayName: '', password: '', role: 'member', departmentId: '' });
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<AccountCreateDraft>({
    username: '',
    displayName: '',
    password: '',
    role: 'member',
    departmentId: '',
  });
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const result = await api.get<EmployeeAccount[]>(`/api/auth/users?tenant_id=${TENANT_ID}`);
      setRows(result);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '加載賬號失敗');
    } finally {
      setLoading(false);
    }
  }

  async function loadDepartments() {
    try {
      setDepartments(await departmentsApi.list());
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '加載部門失敗');
    }
  }

  useEffect(() => {
    void load();
    void loadDepartments();
  }, []);

  const departmentOptions = useMemo(() => orderedDepartmentOptions(departments), [departments]);
  const departmentName = useMemo(() => {
    const map = new Map(departments.map((dept) => [dept.id, dept.name]));
    return (id?: string | null) => (id ? map.get(id) || '—' : '—');
  }, [departments]);

  const filteredRows = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) =>
      [row.username, row.display_name || '', row.role === 'admin' ? '管理員' : '普通成員']
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [rows, searchText]);

  const pagination = useClientPagination(filteredRows, ACCOUNT_PAGE_SIZE, searchText);

  function openEdit(row: EmployeeAccount) {
    setEditing(row);
    setDraft({
      displayName: row.display_name || row.username,
      password: '',
      role: row.role,
      departmentId: row.department_id || '',
    });
  }

  function openCreate() {
    const defaultDept = departments.find((dept) => dept.is_root)?.id || departments[0]?.id || '';
    setCreateDraft({ username: '', displayName: '', password: '', role: 'member', departmentId: defaultDept });
    setCreateOpen(true);
  }

  async function saveCreate() {
    const username = createDraft.username.trim();
    const password = createDraft.password.trim();
    if (!username || !password) {
      notify.error('請填寫賬號和密碼');
      return;
    }
    setCreating(true);
    try {
      await api.post('/api/auth/users', {
        tenant_id: TENANT_ID,
        username,
        password,
        display_name: createDraft.displayName.trim() || username,
        role: createDraft.role,
        department_id: createDraft.departmentId || undefined,
      });
      notify.success('賬號已創建');
      setCreateOpen(false);
      await load();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '創建賬號失敗');
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      await api.put(`/api/auth/users/${editing.id}`, {
        tenant_id: TENANT_ID,
        display_name: draft.displayName.trim() || editing.username,
        password: draft.password.trim() || undefined,
        role: draft.role,
        department_id: draft.departmentId || undefined,
      });
      notify.success('賬號已更新');
      setEditing(null);
      await load();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '保存賬號失敗');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    const row = deleteTarget;
    if (!row) return;
    setDeleting(true);
    try {
      await api.delete(`/api/auth/users/${row.id}?tenant_id=${TENANT_ID}`);
      notify.success('賬號已刪除');
      setDeleteTarget(null);
      await load();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '刪除賬號失敗');
    } finally {
      setDeleting(false);
    }
  }

  async function createDepartment(name: string, parentId: string) {
    try {
      await departmentsApi.create({ name, parent_id: parentId || undefined });
      notify.success('部門已新增');
      await loadDepartments();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '新增部門失敗');
    }
  }

  async function renameDepartment(id: string, name: string) {
    try {
      await departmentsApi.update(id, { name });
      await loadDepartments();
      await load();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '重命名部門失敗');
    }
  }

  async function deleteDepartment(id: string) {
    try {
      await departmentsApi.remove(id);
      notify.success('部門已刪除');
      await loadDepartments();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '刪除部門失敗');
    }
  }

  function renderActions(row: EmployeeAccount) {
    const isProtected = row.role === 'admin';
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="賬號操作"
          className="ml-auto grid size-7 place-items-center rounded-[8px] text-[#1a71ff] transition-colors outline-none hover:bg-black/5 hover:text-[#4a8dff] focus-visible:bg-black/5"
        >
          <IconMore className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
          <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => openEdit(row)}>
            <IconEdit />
            編輯
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-[2px] bg-[#eef0f4]" />
          <DropdownMenuItem
            variant="destructive"
            className={MENU_ITEM_DANGER_CLASS}
            disabled={isProtected}
            onSelect={() => setDeleteTarget(row)}
          >
            <IconTrash />
            刪除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const columns: DataTableColumn<EmployeeAccount>[] = [
    {
      key: 'username',
      title: '用戶名',
      width: 220,
      className: 'text-[#18181a]',
      render: (row) => (
        <span className="flex min-w-0 items-center gap-[8px]">
          <span className="grid size-[24px] shrink-0 place-items-center rounded-full bg-[#eef1fb] text-[#7e96dc]">
            <User className="size-[14px]" />
          </span>
          <span className="truncate font-medium">{row.username}</span>
        </span>
      ),
    },
    {
      key: 'display_name',
      title: '顯示名',
      width: 200,
      render: (row) => <span className="block truncate">{row.display_name || row.username}</span>,
    },
    {
      key: 'role',
      title: '角色',
      width: 120,
      render: (row) => <span>{row.role === 'admin' ? '管理員' : '普通成員'}</span>,
    },
    {
      key: 'department',
      title: '部門',
      width: 160,
      render: (row) => <span className="block truncate">{departmentName(row.department_id)}</span>,
    },
    { key: 'created', title: '創建時間', width: 180, render: (row) => formatDateTime(row.created_at) },
    { key: 'updated', title: '最近更新', width: 180, render: (row) => formatDateTime(row.updated_at) },
    {
      key: 'actions',
      title: '操作',
      width: 70,
      align: 'right',
      render: (row) => renderActions(row),
    },
  ];

  const renderMobileCard = (row: EmployeeAccount) => (
    <article className={MOBILE_CARD_CLASS} key={row.id}>
      <div className="flex min-w-0 items-start justify-between gap-[10px]">
        <span className="flex min-w-0 items-center gap-[8px]">
          <span className="grid size-[28px] shrink-0 place-items-center rounded-full bg-[#eef1fb] text-[#7e96dc]">
            <User className="size-[15px]" />
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-[14px] font-semibold text-[#18181a]">{row.username}</strong>
            <span className="mt-[2px] block truncate text-[12px] text-[#858b9c]">{row.display_name || row.username}</span>
          </span>
        </span>
        {renderActions(row)}
      </div>
      <div className="mt-[10px] flex items-center justify-between gap-[10px] text-[12px] text-[#858b9c]">
        <span>創建 {formatDateTime(row.created_at)}</span>
        <span>更新 {formatDateTime(row.updated_at)}</span>
      </div>
    </article>
  );

  return (
    <div className="min-h-full box-border px-[48px] pt-[32px] pb-[43px] max-[900px]:px-[16px]" aria-busy={loading}>
      <AppHeader onLogout={onLogout} userName={currentUser?.username} title="賬號管理" />

      <DepartmentManager
        options={departmentOptions}
        onCreate={(name, parentId) => void createDepartment(name, parentId)}
        onRename={(id, name) => void renameDepartment(id, name)}
        onDelete={(id) => void deleteDepartment(id)}
      />

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
        <UIButton
          onClick={openCreate}
          className="h-[34px] gap-[4px] rounded-[10px] bg-[#18181a] px-[20px] text-[12px] font-normal text-white hover:bg-[#303030]"
        >
          <IconAdd className="size-[14px]" />
          新建賬號
        </UIButton>
      </div>

      <div className="flex flex-col gap-[24px] rounded-[20px_20px_0_0] bg-white p-[18px_18px_24px_18px] shadow-[0_-4px_16px_0_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-[18px]">
          <div className="flex items-center gap-[6px] px-[12px] text-[#757f9c]">
            <IconAccounts className="size-[14px] shrink-0" />
            <span className="text-[14px] font-normal leading-none">賬號列表</span>
          </div>

          <label className="flex h-[34px] w-[300px] items-center gap-[8px] overflow-hidden rounded-[10px] border-[0.5px] border-[#e3e7f1] bg-white px-[12px] transition-colors focus-within:border-[#18181a] max-[900px]:w-full">
            <IconSearch className="size-[14px] shrink-0 text-[#858b9c]" />
            <input
              value={searchText}
              placeholder="搜索用戶名或顯示名"
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

          <div className="grid gap-[10px] md:hidden">
            {filteredRows.length ? (
              pagination.pagedItems.map(renderMobileCard)
            ) : (
              <div className="py-[40px] text-center text-[13px] text-[#858b9c]">暫無賬號</div>
            )}
          </div>

          <div className="hidden md:block">
            <DataTable
              aria-label="賬號列表"
              columns={columns}
              data={pagination.pagedItems}
              rowKey={(row) => row.id}
              loading={loading}
              emptyText="暫無賬號"
            />
          </div>

          {filteredRows.length > 0 && (
            <Paginator
              aria-label="賬號分頁"
              className="mt-0 mb-[6px]"
              page={pagination.page}
              pageCount={pagination.pageCount}
              onChange={pagination.setPage}
            />
          )}
        </div>
      </div>

      <AccountDialog
        open={createOpen}
        title="新建賬號"
        loading={creating}
        submitText="創建"
        username={{ value: createDraft.username, onChange: (value) => setCreateDraft((prev) => ({ ...prev, username: value })) }}
        displayName={createDraft.displayName}
        onDisplayNameChange={(value) => setCreateDraft((prev) => ({ ...prev, displayName: value }))}
        password={createDraft.password}
        onPasswordChange={(value) => setCreateDraft((prev) => ({ ...prev, password: value }))}
        role={createDraft.role}
        onRoleChange={(value) => setCreateDraft((prev) => ({ ...prev, role: value }))}
        departmentOptions={departmentOptions}
        departmentId={createDraft.departmentId}
        onDepartmentChange={(value) => setCreateDraft((prev) => ({ ...prev, departmentId: value }))}
        passwordLabel="初始密碼"
        onClose={() => setCreateOpen(false)}
        onSubmit={() => void saveCreate()}
      />

      <AccountDialog
        open={Boolean(editing)}
        title={editing ? `編輯賬號：${editing.username}` : '編輯賬號'}
        loading={saving}
        submitText="保存"
        username={null}
        displayName={draft.displayName}
        onDisplayNameChange={(value) => setDraft((prev) => ({ ...prev, displayName: value }))}
        password={draft.password}
        onPasswordChange={(value) => setDraft((prev) => ({ ...prev, password: value }))}
        role={draft.role}
        onRoleChange={(value) => setDraft((prev) => ({ ...prev, role: value }))}
        roleDisabled={editing?.id === currentUser?.id}
        departmentOptions={departmentOptions}
        departmentId={draft.departmentId}
        onDepartmentChange={(value) => setDraft((prev) => ({ ...prev, departmentId: value }))}
        passwordLabel="新密碼"
        passwordPlaceholder="不修改請留空"
        onClose={() => setEditing(null)}
        onSubmit={() => void saveEdit()}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        loading={deleting}
        title={deleteTarget ? `刪除賬號「${deleteTarget.username}」？` : ''}
        description="刪除後該賬號無法登錄，但其創建的數字員工仍然保留。"
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function AccountDialog({
  open,
  title,
  loading,
  submitText,
  username,
  displayName,
  onDisplayNameChange,
  password,
  onPasswordChange,
  role,
  onRoleChange,
  roleDisabled = false,
  departmentOptions,
  departmentId,
  onDepartmentChange,
  passwordLabel,
  passwordPlaceholder,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  loading: boolean;
  submitText: string;
  username: { value: string; onChange: (value: string) => void } | null;
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  role: 'admin' | 'member';
  onRoleChange: (value: 'admin' | 'member') => void;
  roleDisabled?: boolean;
  departmentOptions: { id: string; label: string }[];
  departmentId: string;
  onDepartmentChange: (value: string) => void;
  passwordLabel: string;
  passwordPlaceholder?: string;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex w-[calc(100%-2rem)] flex-col gap-[16px] overflow-hidden rounded-[14px] px-[20px] py-[16px] sm:max-w-[440px]"
      >
        <div className="flex items-center gap-[6px] px-[12px] text-[#757f9c]">
          <IconAccounts className="size-[14px] shrink-0" />
          <DialogTitle className="text-[14px] font-normal leading-none text-[#757f9c]">
            {title}
          </DialogTitle>
        </div>

        <div className="flex flex-col gap-[14px] px-[12px]">
          {username && (
            <LabeledField label="用戶名">
              <Input
                value={username.value}
                placeholder="例如 zhang_san"
                onChange={(event) => username.onChange(event.target.value)}
              />
            </LabeledField>
          )}
          <LabeledField label="顯示名">
            <Input
              value={displayName}
              placeholder="例如 張三"
              onChange={(event) => onDisplayNameChange(event.target.value)}
            />
          </LabeledField>
          <LabeledField label={passwordLabel}>
            <Input
              type="password"
              value={password}
              placeholder={passwordPlaceholder}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </LabeledField>
          <LabeledField label="賬號角色">
            <Select
              value={role}
              disabled={roleDisabled}
              onValueChange={(value) => onRoleChange(value as 'admin' | 'member')}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">普通成員</SelectItem>
                <SelectItem value="admin">管理員</SelectItem>
              </SelectContent>
            </Select>
          </LabeledField>
          <LabeledField label="所屬部門">
            <Select value={departmentId} onValueChange={onDepartmentChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="選擇部門" />
              </SelectTrigger>
              <SelectContent>
                {departmentOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </LabeledField>
        </div>

        <div className="flex items-center justify-end gap-[8px] px-[12px]">
          <UIButton
            variant="outline"
            disabled={loading}
            onClick={onClose}
            className="h-[32px] w-[80px] rounded-[10px] border-[#e3e7f1] bg-white px-[12px] text-[14px] font-normal text-[#464c5e] hover:border-[#e3e7f1] hover:bg-[#f6f6f6] hover:text-[#18181a]"
          >
            取消
          </UIButton>
          <UIButton
            disabled={loading}
            onClick={onSubmit}
            className="h-[32px] w-[80px] rounded-[10px] bg-[#18181a] px-[12px] text-[14px] font-normal text-white hover:bg-[#303030]"
          >
            {submitText}
          </UIButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-[6px]">
      <span className="text-[12px] font-medium text-[#464c5e]">{label}</span>
      {children}
    </label>
  );
}

function DepartmentManager({
  options,
  onCreate,
  onRename,
  onDelete,
}: {
  options: { id: string; label: string; depth: number }[];
  onCreate: (name: string, parentId: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [newName, setNewName] = useState('');
  const [parentId, setParentId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingName, setEditingName] = useState('');

  const rootId = options.find((option) => option.depth === 0)?.id || '';
  const effectiveParent = parentId || rootId;

  function submitNew() {
    const name = newName.trim();
    if (!name) {
      notify.error('請輸入部門名稱');
      return;
    }
    onCreate(name, effectiveParent);
    setNewName('');
  }

  function commitRename(id: string) {
    const name = editingName.trim();
    setEditingId('');
    if (name) onRename(id, name);
  }

  return (
    <section className="mt-[20px] rounded-[14px] border border-[#eef0f4] bg-white p-[16px]">
      <div className="mb-[10px] flex items-center gap-[6px] text-[13px] font-semibold text-[#18181a]">
        部門管理
        <span className="text-[12px] font-normal text-[#858b9c]">用戶與數字員工可依部門設定可見範圍</span>
      </div>

      <div className="mb-[12px] flex flex-wrap items-center gap-[8px]">
        <Input
          value={newName}
          placeholder="新部門名稱"
          className="h-[32px] w-[180px]"
          onChange={(event) => setNewName(event.target.value)}
        />
        <Select value={effectiveParent} onValueChange={setParentId}>
          <SelectTrigger className="h-[32px] w-[200px]">
            <SelectValue placeholder="上層部門" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <UIButton
          onClick={submitNew}
          className="h-[32px] gap-[4px] rounded-[10px] bg-[#1a71ff] px-[14px] text-[12px] text-white hover:bg-[#0f5ed7]"
        >
          <IconAdd className="size-[13px]" />
          新增部門
        </UIButton>
      </div>

      <ul className="flex flex-col gap-[2px]">
        {options.map((option) => (
          <li
            key={option.id}
            className="flex items-center gap-[8px] rounded-[8px] px-[8px] py-[6px] hover:bg-[#f6f7fb]"
          >
            {editingId === option.id ? (
              <Input
                autoFocus
                value={editingName}
                className="h-[28px] w-[220px]"
                onChange={(event) => setEditingName(event.target.value)}
                onBlur={() => commitRename(option.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitRename(option.id);
                  if (event.key === 'Escape') setEditingId('');
                }}
              />
            ) : (
              <span className="min-w-0 flex-1 truncate text-[13px] text-[#18181a]">
                {option.label}
                {option.depth === 0 && (
                  <span className="ml-[6px] text-[11px] text-[#858b9c]">（根）</span>
                )}
              </span>
            )}
            <button
              type="button"
              aria-label="重命名"
              className="grid size-[26px] place-items-center rounded-[7px] text-[#757f9c] hover:bg-black/5 hover:text-[#1a71ff]"
              onClick={() => {
                setEditingId(option.id);
                setEditingName(option.label.trim());
              }}
            >
              <IconEdit className="size-[13px]" />
            </button>
            <button
              type="button"
              aria-label="刪除"
              disabled={option.depth === 0}
              className="grid size-[26px] place-items-center rounded-[7px] text-[#757f9c] hover:bg-black/5 hover:text-[#e5484d] disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => onDelete(option.id)}
            >
              <IconTrash className="size-[13px]" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
