import type { EnterpriseAuthUser } from '@/auth';
import type { GeneralSkillRead } from '@/types';
import type { BadgeTone } from '@/pages/scheduled-tasks/shared';

export const GENERAL_SKILL_PAGE_SIZE = 10;
export const GENERAL_SKILL_RUN_MODEL_STORAGE_KEY = 'general-skill-run-model';

export const STATUS_BADGE: Record<GeneralSkillRead['status'], { tone: BadgeTone; text: string }> = {
  draft: { tone: 'blue', text: '草稿' },
  published: { tone: 'green', text: '已启用' },
  archived: { tone: 'gray', text: '已停用' },
};

export const EMPTY_SKILL_MARKDOWN = `# 技能说明

在这里编写技能文档。名称、Slug 和描述由上方表单维护，系统不会从文档中自动抽取。`;


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
  skill_loaded: '加载技能',
  planning: '生成执行方案',
  plan_created: '生成代码',
  attempt_started: '开始运行',
  running_code: '运行代码',
  stdout_chunk: '运行输出',
  stderr_chunk: '错误输出',
  code_finished: '读取运行结果',
  code_timeout: '运行超时',
  reflection_passed: '校验通过',
  reflection_retrying: '反思修复',
  reflection_stopped: '停止重试',
  repair_planning: '重新生成代码',
  repair_failed: '修复失败',
  plan_failed: '生成失败',
  replying: '生成回复',
  reply_created: '完成回复',
  reply_failed: '回复失败',
};


export type GeneralSkillPageProps = {
  currentUser?: EnterpriseAuthUser;
  onLogout?: () => void;
};
