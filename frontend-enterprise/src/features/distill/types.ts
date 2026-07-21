import type { ModelConfigRead, SkillCard, SkillRead, ToolProbeResponse, ToolRead, ToolSuggestion } from '@/types';
import type { EnterpriseAuthUser } from '@/auth';

export type ChatItem = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: ChatAttachment[];
  outgoingText?: string;
  createdAt?: string;
  thinking?: 'running' | 'done';
  thinkingDetails?: string[];
  thinkingOpen?: boolean;
  warnings?: string[];
  toolSuggestions?: ToolSuggestionItem[];
  actionState?: 'pending' | 'confirmed' | 'rejected';
  snapshotBefore?: DistillHistorySnapshot;
  operations?: DistillHistoryOperation[];
};

export type ChatAttachment = {
  id: string;
  name: string;
  type: string;
};

export type ToolSuggestionItem = ToolSuggestion & {
  status?: 'pending' | 'accepted' | 'created' | 'rejected';
  probeStatus?: 'idle' | 'probing' | 'success' | 'error';
};

export type ProbeToolOptions = {
  sampleArguments?: Record<string, unknown>;
  silent?: boolean;
  allowWhileLoading?: boolean;
};

export type UploadAttachment = {
  id: string;
  name: string;
  status: 'uploading' | 'ready' | 'error';
  text?: string;
  error?: string;
};

export type TargetSelection = {
  path: string;
  label: string;
};
export type ToolDescriptionMap = Record<string, string>;
export type ToolActionStatus = 'existing' | 'pending' | 'accepted' | 'created' | 'rejected' | 'incomplete';
export type ToolStatusMap = Record<string, ToolActionStatus>;

export type ViewMode = 'source' | 'flow';

export type SelectOption = {
  value: string;
  label: string;
};

export const NODE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'collect_info', label: '收集信息' },
  { value: 'decision', label: '條件判斷' },
  { value: 'tool_call', label: '調用工具' },
  { value: 'knowledge_query', label: '檢索知識' },
  { value: 'response', label: '回覆用戶' },
  { value: 'handoff', label: '轉人工' },
  { value: 'subflow', label: '子流程' },
];

export const BASE_ACTION_OPTIONS: SelectOption[] = [
  { value: 'ask_user', label: '詢問用戶' },
  { value: 'continue_flow', label: '繼續流程' },
  { value: 'answer_user', label: '回覆用戶' },
  { value: 'handoff_human', label: '轉人工' },
  { value: 'ask_clarification', label: '澄清問題' },
  { value: 'clarify_user', label: '澄清用戶需求' },
  { value: 'update_memory', label: '更新記憶' },
  { value: 'reflect', label: '反思檢查' },
  { value: 'finish', label: '結束流程' },
  { value: 'stop', label: '停止流程' },
];

export const CONDITION_PRESET_OPTIONS: SelectOption[] = [
  { value: '__always__', label: '總是可進入' },
  { value: 'missing_required_info', label: '缺少任一必填信息' },
  { value: 'missing_slots([])', label: '缺少指定字段' },
  { value: 'all_required_info_collected', label: '必填信息已收集完成' },
  { value: 'tool_success', label: '工具執行成功' },
  { value: 'tool_failed', label: '工具執行失敗' },
  { value: 'user_confirmed', label: '用戶已確認' },
  { value: 'user_rejected', label: '用戶已拒絕' },
  { value: '__custom__', label: '自定義條件' },
];

export const CONDITION_PRESET_TEXT: Record<string, string> = {
  missing_required_info: '還有必填信息沒有收集到時進入',
  'missing_slots([])': '缺少某個指定字段時進入',
  all_required_info_collected: '所有必填信息都收集完成後進入',
  tool_success: '上一步工具調用成功後進入',
  tool_failed: '上一步工具調用失敗後進入',
  user_confirmed: '用戶明確確認後進入',
  user_rejected: '用戶明確拒絕後進入',
};

export const RETRY_STRATEGY_OPTIONS: SelectOption[] = [
  { value: 'ask_user', label: '繼續追問用戶' },
  { value: 'reflect', label: '反思並修正' },
  { value: 'retry_tool', label: '重新調用工具' },
  { value: 'handoff_human', label: '轉人工處理' },
  { value: 'skip', label: '跳過當前節點' },
  { value: 'stop', label: '停止流程' },
];

export type PendingChange = {
  assistantId: string;
  previousDraft: SkillCard;
  nextDraft: SkillCard;
  changedPaths: string[];
};
export type TextDiffPhase = 'mark' | 'type' | 'settled';
export type TextDiffAnimation = {
  key: string;
  path: string;
  field: string;
  prefix: string;
  removed: string;
  inserted: string;
  suffix: string;
  phase: TextDiffPhase;
  progress: number;
};

export type ActiveDistillJob = {
  jobId: string;
  kind: 'distill' | 'rewrite';
  assistantId: string;
  lastSeq: number;
  status?: string;
  createPayload?: { title: string; raw_content: string };
  previousDraft?: SkillCard;
  targets?: string[];
};

export const DEFAULT_TARGET_PATHS: string[] = [];
export const DEFAULT_DISTILL_MESSAGES: ChatItem[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: '請粘貼原始技能說明，或點擊右側某一塊後告訴我需要怎樣改寫。',
  },
];
export const ENTERPRISE_AGENT_STORAGE_KEY = 'ultrarag_enterprise_agent_scope';
export const DISTILL_REWRITE_MODEL_STORAGE_KEY = 'skill-distill-rewrite-model';

export type DistillCacheSnapshot = {
  draft: SkillCard | null;
  loadedSkill: SkillRead | null;
  lastSavedDraft: SkillCard | null;
  messages: ChatItem[];
  input: string;
  selectedPaths: string[];
  highlightedPaths: string[];
  updatingPaths: string[];
  dirtyPaths: string[];
  textDiffs: TextDiffAnimation[];
  pendingChange: PendingChange | null;
  viewMode: ViewMode;
  attachments: UploadAttachment[];
  streamStatus: string;
  activeJob: ActiveDistillJob | null;
};

export type DistillHistoryOperationKind = 'skill_change' | 'version_save' | 'tool_add';

export type DistillHistoryOperation = {
  kind: DistillHistoryOperationKind;
  label: string;
  skillId?: string;
  version?: string;
  toolId?: string;
  toolName?: string;
};

export type DistillHistorySnapshot = {
  draft: SkillCard | null;
  loadedSkill: SkillRead | null;
  lastSavedDraft: SkillCard | null;
  selectedPaths: string[];
  highlightedPaths: string[];
  updatingPaths: string[];
  dirtyPaths: string[];
  textDiffs: TextDiffAnimation[];
  pendingChange: PendingChange | null;
  viewMode: ViewMode;
  tools: ToolRead[];
  attachments: UploadAttachment[];
  streamStatus: string;
};

export type EditingMessage = {
  id: string;
  text: string;
};

export type DistillPageProps = {
  active?: boolean;
  searchParamsOverride?: URLSearchParams;
  currentUser?: EnterpriseAuthUser;
  onLogout?: () => void;
};
