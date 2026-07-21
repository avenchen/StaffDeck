import type {
  GeneralSkillFile,
  DroppedSkillFile,
  SkillFileSystemEntry,
  SkillFileEntry,
  SkillDirectoryEntry,
} from '../types';
import type { GeneralSkillRunResponse } from '@/types';

export function formatJson(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

export function codeLanguage(value: string, fallback = 'text'): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  try {
    JSON.parse(trimmed);
    return 'json';
  } catch {
    return fallback;
  }
}

export function isSkillPackageArchive(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return name.endsWith('.zip') || type === 'application/zip' || type === 'application/x-zip-compressed';
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      resolve(value.includes(',') ? value.split(',', 2)[1] : value);
    };
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

export function traceDetail(item: Record<string, unknown>): string {
  return [
    item.rationale,
    item.expected_output,
    item.phase === 'code_finished' ? item.stdout_preview : undefined,
    item.phase === 'code_finished' || item.phase === 'code_timeout' ? item.stderr_preview : undefined,
    item.run_id,
  ]
    .filter((value) => typeof value === 'string' && value.trim())
    .map(String)
    .join('\n');
}

export function traceItemCode(item: Record<string, unknown>): string {
  return typeof item.code === 'string' && item.code.trim() ? item.code : '';
}

export function resultSucceeded(result: Partial<GeneralSkillRunResponse> | null): boolean {
  if (!result) return false;
  const success = result.structured_result?.success;
  return success !== false && !result.stderr;
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  return error instanceof Error && error.name === 'AbortError';
}

export function languageFromFilePath(path?: string): string {
  const extension = (path || '').split('.').pop()?.toLowerCase();
  if (extension === 'py') return 'python';
  if (extension === 'json') return 'json';
  if (extension === 'md' || extension === 'markdown') return 'markdown';
  return 'text';
}

export function normalizeSkillFilePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/').trim();
}

export function packagePathFromRaw(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = normalized.split('/').filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join('/') : normalized;
}

export function packagePath(file: File): string {
  return packagePathFromRaw((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name);
}

export function readEntryFile(entry: SkillFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

export function readDirectoryEntries(entry: SkillDirectoryEntry): Promise<SkillFileSystemEntry[]> {
  const reader = entry.createReader();
  const output: SkillFileSystemEntry[] = [];

  return new Promise((resolve, reject) => {
    const readNext = () => {
      reader.readEntries((entries) => {
        if (!entries.length) {
          resolve(output);
          return;
        }
        output.push(...entries);
        readNext();
      }, reject);
    };
    readNext();
  });
}

export async function collectDroppedEntryFiles(entry: SkillFileSystemEntry): Promise<DroppedSkillFile[]> {
  if (entry.isFile) {
    const file = await readEntryFile(entry as SkillFileEntry);
    return [{ file, path: packagePathFromRaw(entry.fullPath || file.name) }];
  }
  if (!entry.isDirectory) return [];
  const entries = await readDirectoryEntries(entry as SkillDirectoryEntry);
  const nested = await Promise.all(entries.map(collectDroppedEntryFiles));
  return nested.flat();
}

export function dataTransferEntry(item: DataTransferItem): SkillFileSystemEntry | null {
  const getter = (item as unknown as { webkitGetAsEntry?: () => unknown }).webkitGetAsEntry;
  const entry = getter?.call(item);
  if (!entry || typeof entry !== 'object') return null;
  return entry as SkillFileSystemEntry;
}

export async function droppedSkillFiles(dataTransfer: DataTransfer): Promise<DroppedSkillFile[]> {
  const entries = Array.from(dataTransfer.items || [])
    .map(dataTransferEntry)
    .filter((entry): entry is SkillFileSystemEntry => Boolean(entry));
  if (entries.length) {
    const nested = await Promise.all(entries.map(collectDroppedEntryFiles));
    return nested.flat();
  }
  return Array.from(dataTransfer.files || []).map((file) => ({ file, path: packagePath(file) }));
}

export function parseMetadata(markdownText: string): Record<string, string> {
  const lines = markdownText.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return {};
  const result: Record<string, string> = {};
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === '---') break;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && value) result[key] = value;
  }
  return result;
}

export function applyMetadata(
  markdownText: string,
  setters: {
    setSkillName: (value: string) => void;
    setSkillSlug: (value: string) => void;
    setSkillDescription: (value: string) => void;
    setSkillHomepage: (value: string) => void;
  },
) {
  const metadata = parseMetadata(markdownText);
  if (metadata.name || metadata.title) setters.setSkillName(metadata.name || metadata.title);
  if (metadata.slug || metadata.id) setters.setSkillSlug(metadata.slug || metadata.id);
  if (metadata.description || metadata.summary) setters.setSkillDescription(metadata.description || metadata.summary);
  if (metadata.homepage || metadata.url) setters.setSkillHomepage(metadata.homepage || metadata.url);
}

export function normalizedSkillFiles(files: GeneralSkillFile[] = []): string {
  return JSON.stringify(
    [...files]
      .map((file) => ({
        path: file.path,
        content: file.content,
        mime_type: file.mime_type || '',
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  );
}
