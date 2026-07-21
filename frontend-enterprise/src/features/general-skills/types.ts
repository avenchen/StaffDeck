import type { EnterpriseAuthUser } from '@/auth';
import type { GeneralSkillRead } from '@/types';
import type { BadgeTone } from '@/pages/scheduled-tasks/shared';

export const GENERAL_SKILL_PAGE_SIZE = 10;
export const GENERAL_SKILL_RUN_MODEL_STORAGE_KEY = 'general-skill-run-model';

export const STATUS_BADGE: Record<GeneralSkillRead['status'], { tone: BadgeTone; text: string }> = {
  draft: { tone: 'blue', text: '草稿' },
  published: { tone: 'green', text: '已啟用' },
  archived: { tone: 'gray', text: '已停用' },
};

export const EMPTY_SKILL_MARKDOWN = `# 技能說明

在這裡編寫技能文檔。名稱、Slug 和描述由上方表單維護，系統不會從文檔中自動抽取。`;


export const GENERAL_SKILL_RUN_TIMEOUT_MS = 120_000;
export const FOLDER_INPUT_PROPS = {
  webkitdirectory: '',
  directory: '',
} as Record<string, string>;


export type GeneralSkillFile = {
  path: string;
  content: string;
  size?: number;
  mime_type?: string;
};

export type DroppedSkillFile = {
  file: File;
  path: string;
};

export type GeneralSkillImportMode = 'plaza' | 'employee';

export type SkillFileSystemEntry = {
  name: string;
  fullPath: string;
  isFile: boolean;
  isDirectory: boolean;
};

export type SkillFileEntry = SkillFileSystemEntry & {
  file: (success: (file: File) => void, failure?: (error: DOMException) => void) => void;
};

export type SkillDirectoryEntry = SkillFileSystemEntry & {
  createReader: () => {
    readEntries: (
      success: (entries: SkillFileSystemEntry[]) => void,
      failure?: (error: DOMException) => void,
    ) => void;
  };
};

export const PHASE_LABELS: Record<string, string> = {
  skill_loaded: '加載技能',
  planning: '生成執行方案',
  plan_created: '生成代碼',
  attempt_started: '開始運行',
  running_code: '運行代碼',
  stdout_chunk: '運行輸出',
  stderr_chunk: '錯誤輸出',
  code_finished: '讀取運行結果',
  code_timeout: '運行超時',
  reflection_passed: '校驗通過',
  reflection_retrying: '反思修復',
  reflection_stopped: '停止重試',
  repair_planning: '重新生成代碼',
  repair_failed: '修復失敗',
  plan_failed: '生成失敗',
  replying: '生成回覆',
  reply_created: '完成回覆',
  reply_failed: '回覆失敗',
};


export type GeneralSkillPageProps = {
  currentUser?: EnterpriseAuthUser;
  onLogout?: () => void;
};
