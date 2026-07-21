import type { AppSidebarProps } from './sidebar/shared';
import { ManagementSidebar } from './sidebar/management';
import { ChatSidebarVariant } from './sidebar/chat';

export type {
  AppSidebarProps,
  AppSidebarManagementProps,
  AppSidebarChatProps,
  ChatSessionFilterOption,
} from './sidebar/shared';

export default function AppSidebar(props: AppSidebarProps) {
  if (props.variant === 'chat') {
    return <ChatSidebarVariant {...props} />;
  }
  return <ManagementSidebar {...props} />;
}
