import type { AgentProfileRead, AgentResourceBindingRead, AgentResourceType } from './types';
import {
  isEmployeeOwnedBy,
  isEnterpriseAdmin,
  isGalleryEmployee,
  type EnterpriseAuthUser,
} from './auth';

import avatarAfterSales from './assets/staffdeck/staffdeck-avatar-after-sales.png';
import avatarCommerce from './assets/staffdeck/staffdeck-avatar-commerce.png';
import avatarDefault from './assets/staffdeck/staffdeck-avatar-default.png';
import avatarKnowledge from './assets/staffdeck/staffdeck-avatar-knowledge.png';
import avatarOps from './assets/staffdeck/staffdeck-avatar-ops.png';
import avatarOverall from './assets/staffdeck/staffdeck-avatar-overall.png';
import avatarQuality from './assets/staffdeck/staffdeck-avatar-quality.png';
import avatarService from './assets/staffdeck/staffdeck-avatar-service.png';

export type EmployeeProfile = {
  roleKey: string;
  roleName: string;
  avatarText: string;
  avatarTone: string;
  avatarKind: 'preset' | 'upload';
  avatarPreset: string;
  avatarImage: string;
  onboardedAt: string;
  workStyles: string[];
  expertiseTags: string[];
  workModes: string[];
};

export type EmployeeAvatarPreset = {
  key: string;
  label: string;
  text: string;
  tone: string;
};

export type EmployeeTemplate = {
  key: string;
  roleName: string;
  avatarText: string;
  avatarTone: string;
  avatarPreset: string;
  description: string;
  workStyles: string[];
  expertiseTags: string[];
  workModes: string[];
};

type EmployeeAgentLike = {
  id?: string;
  name?: string;
  is_overall?: boolean;
  metadata?: Record<string, unknown>;
};

export const EMPLOYEE_AVATAR_PRESETS: EmployeeAvatarPreset[] = [
  { key: 'service-orbit', label: '研發員工', text: '研', tone: 'teal' },
  { key: 'after-sales-seal', label: '行政員工', text: '行', tone: 'copper' },
  { key: 'knowledge-node', label: '知識運營員工', text: '知', tone: 'olive' },
  { key: 'commerce-compass', label: '財務員工', text: '財', tone: 'blue' },
  { key: 'ops-grid', label: '人事員工', text: '人', tone: 'ink' },
  { key: 'quality-star', label: '法務員工', text: '法', tone: 'gold' },
];

export const DEFAULT_AVATAR_PRESET = 'service-orbit';

const PRESET_AVATAR_IMAGES: Record<string, string> = {
  'service-orbit': avatarService,
  'after-sales-seal': avatarAfterSales,
  'knowledge-node': avatarKnowledge,
  'commerce-compass': avatarCommerce,
  'ops-grid': avatarOps,
  'quality-star': avatarQuality,
  overall: avatarOverall,
};

type AvatarSource = Pick<EmployeeProfile, 'avatarKind' | 'avatarImage' | 'avatarPreset'>;

export function isUploadedAvatar(profile: AvatarSource): boolean {
  return profile.avatarKind === 'upload' && Boolean(profile.avatarImage);
}

/** Resolve the image URL for an employee avatar (uploaded image or preset illustration). */
export function employeeAvatarImage(profile: AvatarSource): string {
  if (isUploadedAvatar(profile)) return profile.avatarImage;
  return PRESET_AVATAR_IMAGES[profile.avatarPreset || DEFAULT_AVATAR_PRESET] || avatarDefault;
}

export const EMPLOYEE_TEMPLATES: EmployeeTemplate[] = [
  {
    key: 'service-specialist',
    roleName: '研發',
    avatarText: '研',
    avatarTone: 'teal',
    avatarPreset: 'service-orbit',
    description: '負責研發資料查詢、代碼任務拆解、SOP 執行和交付記錄沉澱。',
    workStyles: ['目標明確', '證據優先', '動作可追溯'],
    expertiseTags: ['研發協作', '代碼檢索', 'SOP 執行'],
    workModes: ['理解需求', '檢索資料', '推進執行'],
  },
  {
    key: 'after-sales',
    roleName: '行政',
    avatarText: '行',
    avatarTone: 'copper',
    avatarPreset: 'after-sales-seal',
    description: '負責會議紀要、資料歸檔、跨部門事務跟進和結果同步。',
    workStyles: ['流程推進', '及時追問', '留痕復盤'],
    expertiseTags: ['資料歸檔', '會議紀要', '事務跟進'],
    workModes: ['確認事項', '拆解步驟', '同步結果'],
  },
  {
    key: 'knowledge-operator',
    roleName: '知識運營',
    avatarText: '知',
    avatarTone: 'olive',
    avatarPreset: 'knowledge-node',
    description: '負責知識庫檢索、資料結構化歸檔、信息核對和答案沉澱。',
    workStyles: ['證據優先', '結構清晰', '持續沉澱'],
    expertiseTags: ['知識檢索', '資料歸檔', '信息結構化'],
    workModes: ['查資料', '做歸檔', '給答案'],
  },
  {
    key: 'commerce-guide',
    roleName: '財務',
    avatarText: '財',
    avatarTone: 'blue',
    avatarPreset: 'commerce-compass',
    description: '負責報銷核對、預算口徑、財務資料檢索和風險提示。',
    workStyles: ['證據優先', '口徑統一', '風險剋制'],
    expertiseTags: ['報銷核對', '預算口徑', '數據復盤'],
    workModes: ['查規則', '核憑證', '給結論'],
  },
];

export function staffdeckDisplayText(value: string): string {
  return value;
}

export function isDefaultEmployeeAgent(agent?: EmployeeAgentLike | null): boolean {
  if (!agent || agent.is_overall) return false;
  const metadata = agent.metadata || {};
  return metadata.is_default_employee === true;
}

export function preferredEmployeeAgent<T extends EmployeeAgentLike>(agents: T[]): T | undefined {
  return agents.find(isDefaultEmployeeAgent) || agents.find((item) => !item.is_overall);
}

export type EmployeeVisibilityOptions = {
  activeOnly?: boolean;
  excludeAgentId?: string;
  includeDefault?: boolean;
  includeOverall?: boolean;
};

/**
 * Client-side approximation of a digital employee's visibility for the current
 * user, using the fields present on AgentProfileRead. `all` and same-department
 * (exact) are computable here; department-subtree and specific-user grants are
 * enforced by the server (agents are only returned in the roster when visible),
 * so this treats them as covered by the server-filtered list.
 */
export function isAgentVisibleByFields(
  agent: AgentProfileRead,
  user?: EnterpriseAuthUser | null,
): boolean {
  // The roster endpoint stamps this per requesting-user flag after evaluating
  // the full model (incl. department-subtree and specific-user grants), so trust
  // it when present; otherwise fall back to the client-computable modes.
  if ((agent.metadata as { visible_to_current_user?: boolean })?.visible_to_current_user === true) {
    return true;
  }
  if (agent.visibility_all === true) return true;
  if (
    agent.visibility_same_department === true
    && !!agent.department_id
    && agent.department_id === (user?.department_id ?? null)
  ) {
    return true;
  }
  return false;
}

export function canAccessEmployeeAgent(
  agent: AgentProfileRead,
  user?: EnterpriseAuthUser | null,
  options: EmployeeVisibilityOptions = {},
): boolean {
  if (options.excludeAgentId && agent.id === options.excludeAgentId) return false;
  if (options.activeOnly && agent.status !== 'active') return false;

  const includeOverall = options.includeOverall ?? false;
  if (isEnterpriseAdmin(user)) return includeOverall || !agent.is_overall;
  if (agent.is_overall) return false;

  const includeDefault = options.includeDefault ?? false;
  return (
    (includeDefault && isDefaultEmployeeAgent(agent))
    || isEmployeeOwnedBy(agent, user)
    || isGalleryEmployee(agent)
    || isAgentVisibleByFields(agent, user)
  );
}

export function isEmployeeUsedByCurrentUser(agent: AgentProfileRead): boolean {
  const metadata = agent.metadata || {};
  return metadata.used_by_current_user === true || metadata.chat_used_by_current_user === true;
}

export function canSelectCurrentEmployeeAgent(
  agent: AgentProfileRead,
  user?: EnterpriseAuthUser | null,
  options: EmployeeVisibilityOptions = {},
): boolean {
  if (options.excludeAgentId && agent.id === options.excludeAgentId) return false;
  if (options.activeOnly && agent.status !== 'active') return false;

  const includeOverall = options.includeOverall ?? false;
  if (isEnterpriseAdmin(user)) {
    if (agent.is_overall) return includeOverall;
    if (isGalleryEmployee(agent) && !isEmployeeOwnedBy(agent, user)) {
      return isEmployeeUsedByCurrentUser(agent);
    }
    return true;
  }
  if (agent.is_overall) return false;

  const includeDefault = options.includeDefault ?? false;
  return (
    (includeDefault && isDefaultEmployeeAgent(agent))
    || isEmployeeOwnedBy(agent, user)
    || (isGalleryEmployee(agent) && isEmployeeUsedByCurrentUser(agent))
    || (isAgentVisibleByFields(agent, user) && isEmployeeUsedByCurrentUser(agent))
  );
}

export function canManageEmployeeAgent(
  agent: AgentProfileRead,
  user?: EnterpriseAuthUser | null,
): boolean {
  if (agent.is_overall) return isEnterpriseAdmin(user);
  return isEnterpriseAdmin(user) || isEmployeeOwnedBy(agent, user);
}

export function isMyEmployeeAgent(
  agent: AgentProfileRead,
  user?: EnterpriseAuthUser | null,
): boolean {
  return !agent.is_overall && isEmployeeOwnedBy(agent, user);
}

export function visibleEmployeeAgents(
  rows: AgentProfileRead[],
  user?: EnterpriseAuthUser | null,
  options: EmployeeVisibilityOptions = {},
): AgentProfileRead[] {
  return rows.filter((agent) => canAccessEmployeeAgent(agent, user, options));
}

export function currentEmployeeAgents(
  rows: AgentProfileRead[],
  user?: EnterpriseAuthUser | null,
  options: EmployeeVisibilityOptions = {},
): AgentProfileRead[] {
  return rows.filter((agent) => canSelectCurrentEmployeeAgent(agent, user, options));
}

export function openGalleryAgent(rows: AgentProfileRead[]): AgentProfileRead | undefined {
  return rows.find((agent) => agent.is_overall);
}

export function openGalleryAgentId(rows: AgentProfileRead[]): string {
  return openGalleryAgent(rows)?.id || '';
}

export function openGalleryImportSourceOptions(
  rows: AgentProfileRead[],
  label: string,
): Array<{ value: string; label: string }> {
  const agentId = openGalleryAgentId(rows);
  return agentId ? [{ value: agentId, label }] : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function stringFromMeta(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === 'string' ? value : '';
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function creatorNameFromMetadata(
  metadata?: Record<string, unknown> | null,
  fallback = '',
): string {
  const meta = metadata || {};
  const creator = firstString(
    meta.creator_name,
    meta.created_by,
    meta.created_by_display_name,
    meta.created_by_username,
    meta.owner_display_name,
    meta.owner_username,
    meta.gallery_published_by,
    meta.created_by_user_id,
    meta.owner_user_id,
  );
  if (!creator) return fallback;
  const normalized = creator.trim();
  return normalized || fallback;
}

export function displayNameWithCreator(name: string, creator?: string): string {
  const cleanName = name.trim() || '未命名';
  const cleanCreator = (creator || '').trim();
  if (!cleanCreator) return cleanName;
  return `${cleanName} @${cleanCreator}`;
}

export function employeeProfile(agent?: AgentProfileRead | null): EmployeeProfile {
  const metadata = agent?.metadata || {};
  const template = EMPLOYEE_TEMPLATES.find((item) => item.key === metadata.role_key);
  const preset = EMPLOYEE_AVATAR_PRESETS.find((item) => item.key === metadata.avatar_preset)
    || (template ? EMPLOYEE_AVATAR_PRESETS.find((item) => item.key === template.avatarPreset) : undefined)
    || EMPLOYEE_AVATAR_PRESETS[0];
  const isOverall = Boolean(agent?.is_overall);
  const avatarKind = stringFromMeta(metadata, 'avatar_kind') === 'upload' && stringFromMeta(metadata, 'avatar_image')
    ? 'upload'
    : 'preset';
  return {
    roleKey: stringFromMeta(metadata, 'role_key') || template?.key || '',
    roleName: isOverall ? '開放廣場' : stringFromMeta(metadata, 'role_name') || template?.roleName || '待補充崗位',
    avatarText: isOverall ? '廣' : stringFromMeta(metadata, 'avatar_text') || preset.text || template?.avatarText || '員',
    avatarTone: isOverall ? 'overall' : stringFromMeta(metadata, 'avatar_tone') || preset.tone || template?.avatarTone || 'teal',
    avatarKind: isOverall ? 'preset' : avatarKind,
    avatarPreset: isOverall ? 'overall' : stringFromMeta(metadata, 'avatar_preset') || preset.key,
    avatarImage: isOverall ? '' : stringFromMeta(metadata, 'avatar_image'),
    onboardedAt: stringFromMeta(metadata, 'onboarded_at') || agent?.created_at?.slice(0, 10) || '-',
    workStyles: asStringArray(metadata.work_styles),
    expertiseTags: asStringArray(metadata.expertise_tags),
    workModes: asStringArray(metadata.work_modes),
  };
}

export function employeeDisplayName(agent?: AgentProfileRead | null): string {
  if (!agent) return '數字員工';
  if (agent.is_overall) return '開放廣場';
  return agent.name || '數字員工';
}

export function employeeCreatorName(agent?: AgentProfileRead | null): string {
  return creatorNameFromMetadata(agent?.metadata);
}

export function employeeDisplayNameWithCreator(agent?: AgentProfileRead | null): string {
  return displayNameWithCreator(employeeDisplayName(agent), employeeCreatorName(agent));
}

export function resourceCreatorName(resource?: { metadata?: Record<string, unknown> } | null): string {
  return creatorNameFromMetadata(resource?.metadata);
}

export function resourceDisplayNameWithCreator(
  name: string,
  resource?: { metadata?: Record<string, unknown> } | null,
): string {
  return displayNameWithCreator(name, resourceCreatorName(resource));
}

export function resourceCount(resources: AgentResourceBindingRead[] | undefined, type: AgentResourceBindingRead['resource_type']): number {
  return (resources || []).filter((item) => (
    item.resource_type === type
    && item.status !== 'deleted'
    && item.status !== 'inactive'
  )).length;
}

/** Employees selectable in the chat sidebar: active employees visible to the current user. */
export function visibleChatEmployees(
  rows: AgentProfileRead[],
  user?: EnterpriseAuthUser | null,
): AgentProfileRead[] {
  return currentEmployeeAgents(rows, user, { activeOnly: true });
}

export function agentResourceCount(agent: AgentProfileRead, resourceType: AgentResourceType): number {
  return (agent.resources || []).filter((resource) => (
    resource.resource_type === resourceType
    && resource.status !== 'deleted'
    && resource.status !== 'inactive'
  )).length;
}

export function activeResourceCount(resources: AgentResourceBindingRead[] | undefined): number {
  return (resources || []).filter((item) => item.status === 'active').length;
}

export function employeeMetadataFromTemplate(templateKey: string, currentMetadata: Record<string, unknown> = {}): Record<string, unknown> {
  const template = EMPLOYEE_TEMPLATES.find((item) => item.key === templateKey) || EMPLOYEE_TEMPLATES[0];
  return {
    ...currentMetadata,
    role_key: template.key,
    role_name: template.roleName,
    avatar_text: template.avatarText,
    avatar_tone: template.avatarTone,
    avatar_kind: 'preset',
    avatar_preset: template.avatarPreset,
    onboarded_at: currentMetadata.onboarded_at || new Date().toISOString().slice(0, 10),
    work_styles: template.workStyles,
    expertise_tags: template.expertiseTags,
    work_modes: template.workModes,
  };
}

export function employeeBlankMetadata(currentMetadata: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...currentMetadata,
    blank_onboarding: true,
    role_key: stringFromMeta(currentMetadata, 'role_key'),
    role_name: stringFromMeta(currentMetadata, 'role_name') || '待補充職位',
    avatar_text: stringFromMeta(currentMetadata, 'avatar_text') || '員',
    avatar_tone: stringFromMeta(currentMetadata, 'avatar_tone') || 'teal',
    avatar_kind: stringFromMeta(currentMetadata, 'avatar_kind') || 'preset',
    avatar_preset: stringFromMeta(currentMetadata, 'avatar_preset') || EMPLOYEE_AVATAR_PRESETS[0].key,
    onboarded_at: currentMetadata.onboarded_at || new Date().toISOString().slice(0, 10),
    work_styles: asStringArray(currentMetadata.work_styles),
    expertise_tags: asStringArray(currentMetadata.expertise_tags),
    work_modes: asStringArray(currentMetadata.work_modes),
  };
}
