import type { AppSidebarProps } from './sidebar/shared';
import { ChatSidebarVariant, ManagementSidebar } from './sidebar/parts';

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
