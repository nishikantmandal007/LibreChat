import type { TFile } from 'librechat-data-provider';
import type { ExtendedFile, MayaSafeFileState, MayaSafeFileStatus } from '~/common';

type FileWithSafeState = Partial<TFile> & {
  safeFile?: MayaSafeFileState;
  maya_safe_file?: MayaSafeFileState;
};

const PROCESSING_STATUSES = new Set<MayaSafeFileStatus>([
  'uploading',
  'scanning',
  'anonymizing',
  'indexing',
]);

export function isMayaSafeFileProcessing(file: Pick<ExtendedFile, 'safeFile'>): boolean {
  return Boolean(file.safeFile && PROCESSING_STATUSES.has(file.safeFile.status));
}

export function isMayaSafeFileReadyForChat(file: Pick<ExtendedFile, 'safeFile'>): boolean {
  if (!file.safeFile) {
    return true;
  }
  return file.safeFile.status === 'ready' && Boolean(file.safeFile.safeDocId);
}

export function hasMayaSafeFileBlocker(files: Map<string, ExtendedFile>): boolean {
  return Array.from(files.values()).some((file) => !isMayaSafeFileReadyForChat(file));
}

export function getMayaSafeFileState(file: unknown): MayaSafeFileState | undefined {
  const record = file as FileWithSafeState | undefined;
  return record?.maya_safe_file ?? record?.safeFile;
}

export function getMayaSafeDocId(file: unknown): string | undefined {
  const state = getMayaSafeFileState(file);
  return state?.status === 'ready' ? state.safeDocId : undefined;
}

export function getMayaSafeDocIds(files: unknown[] | undefined): string[] {
  if (!files) {
    return [];
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const file of files) {
    const docId = getMayaSafeDocId(file);
    if (!docId || seen.has(docId)) {
      continue;
    }
    seen.add(docId);
    ids.push(docId);
  }
  return ids;
}

export function toMayaSafeMessageFile(
  file: ExtendedFile,
): Partial<TFile> & { maya_safe_file?: MayaSafeFileState } {
  return {
    file_id: file.file_id,
    filepath: file.safeFile?.downloadUrl ?? file.filepath,
    type: file.type ?? '',
    height: file.height,
    width: file.width,
    filename: file.filename,
    metadata: file.metadata,
    maya_safe_file: file.safeFile,
  };
}

export function getMayaSafeFileStatusLabel(file: Pick<ExtendedFile, 'safeFile'>): string {
  switch (file.safeFile?.status) {
    case 'uploading':
      return 'Extracting text...';
    case 'scanning':
      return 'Scanning for PII...';
    case 'anonymizing':
      return 'Anonymizing entities...';
    case 'indexing':
      return 'Embedding for RAG...';
    case 'ready':
      return 'Ready for Safe Chat';
    case 'failed':
      return 'Safe copy failed';
    default:
      return 'Preparing...';
  }
}

export function getMayaSafeFileProgress(file: Pick<ExtendedFile, 'safeFile'>): number {
  switch (file.safeFile?.status) {
    case 'uploading':
      return 0.2;
    case 'scanning':
      return 0.4;
    case 'anonymizing':
      return 0.65;
    case 'indexing':
      return 0.8;
    case 'ready':
    case 'failed':
      return 1;
    default:
      return 0.2;
  }
}
