import { useMemo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ComponentType, SVGProps } from 'react';
import { cn } from '@/lib/utils';
import EmployeeAvatar from '@/components/EmployeeAvatar';
import BrandLogo from '@/components/BrandLogo';
import StaffdeckIcon from '@/components/StaffdeckIcon';
import { employeeDisplayNameWithCreator, employeeProfile, staffdeckDisplayText } from '@/employee';
import { EnterpriseRoute } from '@/enums/routes';
import type { AgentProfileRead, ChatSession } from '@/types';
import IconPlatform from '@/assets/icons/nav-platform.svg?react';
import IconAgents from '@/assets/icons/nav-agents.svg?react';
import IconFile from '@/assets/icons/profile-file.svg?react';
import IconAlarm from '@/assets/icons/profile-alarm.svg?react';
import IconHistory from '@/assets/icons/profile-history.svg?react';
import IconCalendar from '@/assets/icons/profile-calendar.svg?react';
import IconFolder from '@/assets/icons/cap-folder.svg?react';
import IconMagicWand from '@/assets/icons/cap-magicwand.svg?react';
import IconClipboard from '@/assets/icons/cap-clipboard.svg?react';
import IconBriefcase from '@/assets/icons/cap-briefcase.svg?react';
import IconChat from '@/assets/icons/action-chat.svg?react';
import IconToggle from '@/assets/icons/action-toggle.svg?react';
import IconHeaderCollapse from '@/assets/icons/header-collapse.svg?react';
import IconAccounts from '@/assets/icons/sys-accounts.svg?react';
import IconModels from '@/assets/icons/sys-models.svg?react';
import IconChevronDown from '@/assets/icons/chevron-down.svg?react';
import IconAdd from '@/assets/icons/add.svg?react';
import IconSort from '@/assets/icons/sort.svg?react';
import IconGlobe from '@/assets/icons/globe.svg?react';
import IconViewMasonry from '@/assets/icons/view-masonry.svg?react';
import IconChatBubble from '@/assets/icons/chat.svg?react';
import IconEdit from '@/assets/icons/edit.svg?react';
import IconTrash from '@/assets/icons/trash.svg?react';

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export type NavItem = {
  route: EnterpriseRoute;
  label: string;
  Icon: IconComponent;
};

export const PRIMARY_NAV: NavItem[] = [
  { route: EnterpriseRoute.Platform, label: '开放广场平台', Icon: IconPlatform },
  { route: EnterpriseRoute.Agents, label: '我的数字员工', Icon: IconAgents },
];

export const PROFILE_NAV: NavItem[] = [
  { route: EnterpriseRoute.Dashboard, label: '员工档案', Icon: IconFile },
  { route: EnterpriseRoute.ScheduledTasks, label: '定时任务', Icon: IconAlarm },
  { route: EnterpriseRoute.Memories, label: '记忆', Icon: IconHistory },
  { route: EnterpriseRoute.Feedback, label: '对话日志', Icon: IconCalendar },
];

export const CAPABILITY_NAV: NavItem[] = [
  { route: EnterpriseRoute.Knowledge, label: '知识库', Icon: IconFolder },
  { route: EnterpriseRoute.Wiki, label: '知识 Wiki', Icon: IconGlobe },
  { route: EnterpriseRoute.GeneralSkills, label: '技能', Icon: IconMagicWand },
  { route: EnterpriseRoute.Skills, label: 'SOP', Icon: IconClipboard },
  { route: EnterpriseRoute.Tools, label: '工具', Icon: IconBriefcase },
];

export const SYSTEM_NAV: NavItem[] = [
  { route: EnterpriseRoute.Accounts, label: '账号管理', Icon: IconAccounts },
  { route: EnterpriseRoute.Models, label: '模型配置', Icon: IconModels },
];

export function primaryNavItems(isAdmin: boolean): NavItem[] {
  return isAdmin ? [...PRIMARY_NAV, ...SYSTEM_NAV] : PRIMARY_NAV;
}

export type AppSidebarManagementProps = {
  variant?: 'management';
  selected: string;
  onNavigate: (route: string) => void;
  isAdmin: boolean;
  sidebarAgent?: AgentProfileRead;
  scopeAgents: AgentProfileRead[];
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
  onOpenChat: () => void;
  modelSetupAttention?: boolean;
};

export type ChatSessionFilterOption = { value: string; label: string };

export type AppSidebarChatProps = {
  variant: 'chat';
  /** Sessions already filtered for the sidebar list. */
  sessions: ChatSession[];
  /** Whether the initial session list is still loading. */
  sessionsLoading?: boolean;
  /** Full agent roster, used to resolve per-session avatars/roles. */
  agents: AgentProfileRead[];
  activeSessionId?: string;
  sessionFilter: string;
  onSessionFilterChange: (value: string) => void;
  sessionFilterOptions: ChatSessionFilterOption[];
  isSessionUnread: (session: ChatSession) => boolean;
  onOpenSession: (id: string) => void;
  onOpenGallery: () => void;
  /** Highlights the 数字员工广场 entry as the active menu (chat gallery route). */
  galleryActive?: boolean;
  handoffCount?: number;
  onOpenHandoffs?: () => void;
  onRenameSession: (session: ChatSession) => void;
  onDeleteSession: (session: ChatSession) => void;
  onOpenAdmin: () => void;
};

export type AppSidebarProps = AppSidebarManagementProps | AppSidebarChatProps;

// Shared shell classes so the management + chat sidebars share the same chrome.
export const SIDEBAR_SHELL_CLASS =
  'overflow-hidden border-r border-sidebar-border bg-sidebar backdrop-blur-[9.5px] **:data-[slot=sidebar-inner]:bg-sidebar';
