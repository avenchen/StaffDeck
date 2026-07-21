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

import { AppSidebarChatProps, AppSidebarManagementProps, AppSidebarProps, CAPABILITY_NAV, ChatSessionFilterOption, IconComponent, NavItem, PRIMARY_NAV, PROFILE_NAV, SIDEBAR_SHELL_CLASS, SYSTEM_NAV, primaryNavItems } from './shared';

// ---------------------------------------------------------------------------
// Chat variant (Figma node 38:5767) — reuses the sidebar shell + brand chrome
// while swapping the body for the "員工會話" session list.
// ---------------------------------------------------------------------------

export function sessionAgentFor(session: ChatSession, agents: AgentProfileRead[]): AgentProfileRead | null {
  if (!session.agent_id) return null;
  return agents.find((agent) => agent.id === session.agent_id) || null;
}

export function sessionTitleFor(session: ChatSession, _agent: AgentProfileRead | null): string {
  if (session.title) return staffdeckDisplayText(session.title);
  return session.id || '新對話';
}

export function sessionSubtitleFor(session: ChatSession, _agent: AgentProfileRead | null): string {
  const recent = (session.last_agent_question || session.summary || '').replace(/^最近回覆[:：]\s*/, '');
  return recent ? staffdeckDisplayText(recent) : '新對話';
}

export function ChatSessionFilter({
  sessionFilter,
  sessionFilterOptions,
  onSessionFilterChange,
  collapsed = false,
}: Pick<AppSidebarChatProps, 'sessionFilter' | 'sessionFilterOptions' | 'onSessionFilterChange'> & {
  collapsed?: boolean;
}) {
  const current = sessionFilterOptions.find((option) => option.value === sessionFilter) || sessionFilterOptions[0];
  const [namePart, countPart] = current
    ? current.label.split('·').map((part) => part.trim())
    : ['全部員工', ''];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {collapsed ? (
          <button
            type="button"
            aria-label="篩選會話"
            className="flex h-[32px] w-full items-center justify-center rounded-[10px] border-[0.5px] border-[#e3e7f1] bg-[#f6f6f6] transition-colors hover:border-[#c9d2e4]"
          >
            <IconSort className="size-[14px]! shrink-0 text-[#858b9c]" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="篩選會話"
            className="flex h-[40px] w-full items-center justify-between rounded-[14px] border-[0.5px] border-[#e3e7f1] bg-[#f6f6f6] px-[20px] py-[10px] text-left transition-colors hover:border-[#c9d2e4]"
          >
            <span className="flex min-w-0 items-center gap-[6px]">
              <span className="truncate text-[14px] text-[#464c5e]">{namePart}</span>
              {countPart && (
                <span className="inline-flex h-[18px] min-w-[30px] items-center justify-center rounded-full bg-white px-[4px] text-[12px] text-[#757f9c]">
                  {countPart}
                </span>
              )}
            </span>
            <IconSort className="size-[14px]! shrink-0 text-[#858b9c]" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={collapsed ? 'center' : 'start'}
        side={collapsed ? 'right' : 'bottom'}
        className={cn(
          'flex max-h-[320px] flex-col gap-[6px] overflow-y-auto rounded-[14px] bg-white p-[6px] shadow-[0px_16px_15px_rgba(0,0,0,0.1)] ring-0',
          collapsed ? 'min-w-[160px]' : 'w-(--radix-dropdown-menu-trigger-width)',
        )}
      >
        {sessionFilterOptions.map((option) => {
          const [optionName, optionCount] = option.label.split('·').map((part) => part.trim());
          const active = option.value === sessionFilter;
          return (
            <DropdownMenuItem
              key={option.value}
              data-active={active}
              onSelect={() => onSessionFilterChange(option.value)}
              className={cn(
                'group/filter flex h-[32px] shrink-0 cursor-pointer items-center gap-[4px] rounded-[14px] px-[12px] py-[4px] transition-colors focus:bg-[#f6f6f6]',
                active ? 'bg-[#f6f6f6]' : 'bg-transparent',
              )}
            >
              <span
                className={cn(
                  'truncate text-[12px] leading-none',
                  active
                    ? 'text-[#18181a]!'
                    : 'text-[#858b9c]!',
                )}
              >
                {optionName}
              </span>
              {optionCount && (
                <span
                  className={cn(
                    'inline-flex h-[14px] items-center justify-center rounded-full px-[8px] text-[10px] leading-none text-[#757f9c]! capitalize',
                    active
                      ? 'bg-white'
                      : 'bg-[#f6f6f6] group-focus/filter:bg-white',
                  )}
                >
                  {optionCount}
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ChatHandoffButton({
  count = 0,
  onOpen,
  collapsed = false,
}: {
  count?: number;
  onOpen?: () => void;
  collapsed?: boolean;
}) {
  if (!onOpen) return null;
  const badge = count > 99 ? '99+' : String(count);

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onOpen}
            aria-label="待回答"
            className="relative flex h-[32px] w-full items-center justify-center rounded-[8px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <IconChatBubble className="size-[16px]!" />
            {count > 0 && (
              <span className="absolute -right-[3px] -top-[4px] inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#f5483b] px-[4px] text-[9px] leading-none text-white ring-[2px] ring-sidebar">
                {badge}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" align="center">
          {count > 0 ? `待回答 ${badge}` : '待回答'}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center justify-between gap-[12px] rounded-[8px] px-[20px] py-[10px] text-left text-[14px] text-[#858b9c] transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      <span className="flex min-w-0 items-center gap-[12px]">
        <IconChatBubble className="size-[16px]! shrink-0" />
        <span className="truncate">待回答</span>
      </span>
      {count > 0 && (
        <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-[6px] text-[11px] leading-none text-[#f5483b] shadow-[0_0_0_0.5px_rgba(245,72,59,0.18)]">
          {badge}
        </span>
      )}
    </button>
  );
}

export function ChatSessionRow({
  session,
  agent,
  active,
  unread,
  onOpenSession,
  onRenameSession,
  onDeleteSession,
}: {
  session: ChatSession;
  agent: AgentProfileRead | null;
  active: boolean;
  unread: boolean;
  onOpenSession: (id: string) => void;
  onRenameSession: (session: ChatSession) => void;
  onDeleteSession: (session: ChatSession) => void;
}) {
  const title = sessionTitleFor(session, agent);
  const subtitle = sessionSubtitleFor(session, agent);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenSession(session.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenSession(session.id);
        }
      }}
      className={cn(
        'group/session relative flex w-full cursor-pointer items-center gap-[6px] rounded-[14px] py-[6px] pl-[8px] pr-[12px] text-left transition-colors',
        active
          ? 'border-[0.5px] border-[#e3e7f1] bg-white shadow-[0px_0px_5px_rgba(0,0,0,0.05)]'
          : 'border-[0.5px] border-transparent hover:bg-[#f4f5f7]',
      )}
    >
      <span className="inline-grid size-[42px] shrink-0 place-items-center overflow-hidden rounded-[12px] bg-[#f1f2f5] text-[#464c5e]">
        {agent ? (
          <EmployeeAvatar agent={agent} size={42} radius={12} />
        ) : (
          <IconChatBubble className="size-[20px]!" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-between self-stretch py-[3px]">
        <span className="truncate text-[14px] leading-none text-[#464c5e] capitalize" title={title}>
          {title}
        </span>
        <span className="truncate text-[12px] leading-none text-[#757f9c]" title={subtitle}>
          {subtitle}
        </span>
      </span>
      {unread && (
        <span className="ml-[2px] size-[7px] shrink-0 rounded-full bg-[#f5483b]" aria-label="未讀回覆" />
      )}
      <span className="ml-auto hidden shrink-0 items-center gap-[6px] group-hover/session:flex">
        <button
          type="button"
          aria-label="重命名會話"
          onClick={(event) => {
            event.stopPropagation();
            onRenameSession(session);
          }}
          className="inline-grid size-[24px] place-items-center rounded-[10px] text-[#858b9c] transition-colors hover:bg-[#e3e7f1] hover:text-[#18181a]"
        >
          <IconEdit className="size-[14px]!" />
        </button>
        <button
          type="button"
          aria-label="刪除會話"
          onClick={(event) => {
            event.stopPropagation();
            onDeleteSession(session);
          }}
          className="inline-grid size-[24px] place-items-center rounded-[10px] text-[#858b9c] transition-colors hover:bg-[#fce7e7] hover:text-[#f5483b]"
        >
          <IconTrash className="size-[14px]!" />
        </button>
      </span>
    </div>
  );
}

export function ChatSessionRowSkeleton() {
  return (
    <div className="flex w-full animate-pulse items-center gap-[6px] rounded-[14px] border-[0.5px] border-transparent px-[8px] py-[6px]">
      <span className="size-[42px] shrink-0 rounded-[12px] bg-[#eef0f4]" />
      <span className="flex min-w-0 flex-1 flex-col gap-[6px] pb-[2px]">
        <span className="h-[12px] w-[60%] rounded-full bg-[#eef0f4]" />
        <span className="h-[10px] w-[40%] rounded-full bg-[#f1f2f5]" />
      </span>
    </div>
  );
}

export function ChatSessionSkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-[2px]">
      {Array.from({ length: rows }).map((_, index) => (
        <ChatSessionRowSkeleton key={index} />
      ))}
    </div>
  );
}

export function ChatFooterActions({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  return (
    <div className="flex items-center justify-center gap-[10px] pb-[20px]">
      <button
        type="button"
        onClick={onOpenAdmin}
        title="管理端"
        className="flex h-[40px] w-[130px] items-center justify-center gap-[6px] rounded-[10px] border-[0.5px] border-[#E3E7F1] bg-[#F6F6F6] px-[20px] py-[4px] text-[14px] text-[#858b9c] transition-opacity hover:opacity-70"
      >
        <IconViewMasonry className="size-[16px]!" />
        <span>管理端</span>
      </button>
      <button
        type="button"
        onClick={onOpenAdmin}
        title="切換到管理端"
        aria-label="切換到管理端"
        className="flex size-[32px] shrink-0 items-center justify-center rounded-[8px] rotate-90 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <IconToggle className="size-[16px]!" />
      </button>
    </div>
  );
}

export function CollapsedChatSidebar({
  sessions,
  sessionsLoading = false,
  agents,
  activeSessionId,
  sessionFilter,
  onSessionFilterChange,
  sessionFilterOptions,
  isSessionUnread,
  onOpenSession,
  onOpenGallery,
  galleryActive = false,
  handoffCount = 0,
  onOpenHandoffs,
  onOpenAdmin,
  onToggle,
}: Pick<
  AppSidebarChatProps,
  'sessions' | 'sessionsLoading' | 'agents' | 'activeSessionId' | 'sessionFilter' | 'onSessionFilterChange' | 'sessionFilterOptions' | 'isSessionUnread' | 'onOpenSession' | 'onOpenGallery' | 'galleryActive' | 'handoffCount' | 'onOpenHandoffs' | 'onOpenAdmin'
> & { onToggle: () => void }) {
  return (
    <div className="flex h-full w-(--sidebar-width-icon) shrink-0 flex-col items-center gap-[32px] px-[20px] py-[10px]">
      <div className="flex w-full flex-col items-center gap-[10px]">
        <button type="button" title="數字員工廣場" onClick={onOpenGallery} className="flex items-center justify-center p-[10px]">
          <BrandLogo markOnly />
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggle}
              aria-label="展開邊欄"
              className="flex size-[16px] items-center justify-center text-sidebar-foreground transition-colors hover:text-sidebar-accent-foreground"
            >
              <IconHeaderCollapse className="size-[16px]! -rotate-90" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" align="center">
            展開邊欄
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-[16px]">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onOpenGallery}
              aria-label="數字員工廣場"
              aria-current={galleryActive ? 'page' : undefined}
              className={cn(
                'flex h-[32px] w-full items-center justify-center rounded-[8px] transition-colors',
                galleryActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <IconGlobe className="size-[16px]!" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" align="center">
            數字員工廣場
          </TooltipContent>
        </Tooltip>

        <ChatHandoffButton count={handoffCount} onOpen={onOpenHandoffs} collapsed />

        <div className="h-px w-full bg-sidebar-border" />

        <ChatSessionFilter
          collapsed
          sessionFilter={sessionFilter}
          sessionFilterOptions={sessionFilterOptions}
          onSessionFilterChange={onSessionFilterChange}
        />

        <span className="text-[10px] leading-none text-[#464c5e]">會話</span>

        <div className="no-scrollbar mx-[-8px] flex min-h-0 w-[calc(100%+16px)] flex-1 flex-col items-center gap-[10px] overflow-y-auto py-[2px]">
          {sessionsLoading
            ? Array.from({ length: 5 }).map((_, index) => (
                <span key={index} className="size-[36px] shrink-0 animate-pulse rounded-[10px] bg-[#eef0f4]" />
              ))
            : sessions.map((session) => {
                const agent = sessionAgentFor(session, agents);
                const active = session.id === activeSessionId;
                const unread = isSessionUnread(session);
                const title = sessionTitleFor(session, agent);
                return (
                  <Tooltip key={session.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onOpenSession(session.id)}
                        aria-label={title}
                        className={cn(
                          'relative flex shrink-0 items-center justify-center overflow-hidden transition-shadow',
                          active
                            ? 'size-[44px] rounded-[14px] border-[0.5px] border-[#464c5e] bg-white shadow-[0px_0px_5px_rgba(0,0,0,0.1)]'
                            : 'size-[36px] rounded-[10px] bg-[#D8D8D8] text-[#464c5e]',
                        )}
                      >
                        {agent ? (
                          <EmployeeAvatar agent={agent} size={active ? 34 : 36} radius={10} />
                        ) : (
                          <IconChatBubble className="size-[18px]!" />
                        )}
                        {unread && (
                          <span className="absolute right-[2px] top-[2px] size-[7px] rounded-full bg-[#f5483b] ring-[1.5px] ring-white" aria-label="未讀回覆" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center">
                      {title}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
        </div>
      </div>

      <div className="flex items-center justify-center pb-[20px]">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onOpenAdmin}
              aria-label="切換到管理端"
              className="flex size-[32px] shrink-0 items-center justify-center rounded-[10px] border-[0.5px] border-[#E3E7F1] bg-[#F6F6F6] text-[#858b9c] transition-opacity hover:opacity-70"
            >
              <IconViewMasonry className="size-[16px]!" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" align="center">
            切換到管理端
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export function ChatSidebarVariant({
  sessions,
  sessionsLoading = false,
  agents,
  activeSessionId,
  sessionFilter,
  onSessionFilterChange,
  sessionFilterOptions,
  isSessionUnread,
  onOpenSession,
  onOpenGallery,
  galleryActive = false,
  handoffCount = 0,
  onOpenHandoffs,
  onRenameSession,
  onDeleteSession,
  onOpenAdmin,
}: AppSidebarChatProps) {
  const { toggleSidebar, state } = useSidebar();
  const collapsed = state === 'collapsed';
  const showSkeleton = sessionsLoading && sessions.length === 0;

  if (collapsed) {
    return (
      <Sidebar collapsible="icon" className={SIDEBAR_SHELL_CLASS}>
        <CollapsedChatSidebar
          sessions={sessions}
          sessionsLoading={showSkeleton}
          agents={agents}
          activeSessionId={activeSessionId}
          sessionFilter={sessionFilter}
          onSessionFilterChange={onSessionFilterChange}
          sessionFilterOptions={sessionFilterOptions}
          isSessionUnread={isSessionUnread}
          onOpenSession={onOpenSession}
          onOpenGallery={onOpenGallery}
          galleryActive={galleryActive}
          handoffCount={handoffCount}
          onOpenHandoffs={onOpenHandoffs}
          onOpenAdmin={onOpenAdmin}
          onToggle={toggleSidebar}
        />
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="icon" className={SIDEBAR_SHELL_CLASS}>
      <div className="flex h-full w-(--sidebar-width) shrink-0 flex-col">
        <SidebarHeader className="gap-[24px] px-[20px] pt-[10px]">
          <div className="flex items-center justify-between">
            <button type="button" title="數字員工廣場" onClick={onOpenGallery}>
              <BrandLogo />
            </button>
            <button
              type="button"
              onClick={toggleSidebar}
              title="收起邊欄"
              aria-label="收起邊欄"
              className="flex size-[28px] shrink-0 items-center justify-center rounded-[8px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <IconHeaderCollapse className="size-[14px]! -rotate-90" />
            </button>
          </div>

          <div className="flex flex-col gap-[16px]">
            <button
              type="button"
              onClick={onOpenGallery}
              aria-current={galleryActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-[12px] rounded-[8px] px-[20px] py-[10px] text-left text-[14px] transition-colors',
                galleryActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-[#858b9c] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <IconGlobe className="size-[16px]! shrink-0" />
              <span className="truncate">數字員工廣場</span>
            </button>
            <ChatHandoffButton count={handoffCount} onOpen={onOpenHandoffs} />
            <div className="h-px w-full bg-sidebar-border" />
            <ChatSessionFilter
              sessionFilter={sessionFilter}
              sessionFilterOptions={sessionFilterOptions}
              onSessionFilterChange={onSessionFilterChange}
            />
            <span className="text-[12px] leading-none text-[#858b9c]">員工會話</span>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-[20px]">
          <div className="flex flex-col gap-[2px] pb-[10px]">
            {showSkeleton ? (
              <ChatSessionSkeletonList />
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center gap-[8px] py-[28px] text-center text-[12px] text-[#a2a8b8]">
                <StaffdeckIcon name="inbox" size={22} />
                <span>暫無歷史會話</span>
              </div>
            ) : (
              <div className="flex flex-col gap-[2px]">
                {sessions.map((session) => (
                  <ChatSessionRow
                    key={session.id}
                    session={session}
                    agent={sessionAgentFor(session, agents)}
                    active={session.id === activeSessionId}
                    unread={isSessionUnread(session)}
                    onOpenSession={onOpenSession}
                    onRenameSession={onRenameSession}
                    onDeleteSession={onDeleteSession}
                  />
                ))}
              </div>
            )}
          </div>
        </SidebarContent>

        <SidebarFooter className="px-[20px]">
          <ChatFooterActions onOpenAdmin={onOpenAdmin} />
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}

