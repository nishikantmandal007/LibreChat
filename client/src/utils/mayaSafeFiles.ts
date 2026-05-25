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

function getPromptOnlyText(state: MayaSafeFileState | undefined): string {
  return (state?.promptText ?? state?.anonymizedText ?? state?.originalText ?? '').trim();
}

export function isMayaSafeFileProcessing(file: Pick<ExtendedFile, 'safeFile'>): boolean {
  return Boolean(file.safeFile && PROCESSING_STATUSES.has(file.safeFile.status));
}

export function isMayaSafeFileReadyForChat(file: Pick<ExtendedFile, 'safeFile'>): boolean {
  if (!file.safeFile) {
    return true;
  }
  if (file.safeFile.localPreviewOnly) {
    return file.safeFile.status === 'ready' && Boolean(getPromptOnlyText(file.safeFile));
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
  if (state?.localPreviewOnly) {
    return undefined;
  }
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

export function getMayaPromptOnlyFileText(files: unknown[] | undefined): string {
  if (!files) {
    return '';
  }

  return files
    .map((file) => {
      const state = getMayaSafeFileState(file);
      if (!state?.localPreviewOnly || state.status !== 'ready') {
        return '';
      }
      return getPromptOnlyText(state);
    })
    .filter(Boolean)
    .join('\n\n');
}

export function toMayaSafeMessageFile(
  file: ExtendedFile,
): Partial<TFile> & { maya_safe_file?: MayaSafeFileState } {
  const safeFile = file.safeFile;
  const stableSafeFileId = safeFile?.localPreviewOnly
    ? undefined
    : (safeFile?.safeDocId ?? safeFile?.safeFileId);

  return {
    file_id: stableSafeFileId ?? file.file_id,
    filepath: safeFile?.localPreviewOnly ? file.filepath : (safeFile?.downloadUrl ?? file.filepath),
    type: safeFile?.mimeType ?? file.type ?? '',
    height: file.height,
    width: file.width,
    filename: file.filename,
    metadata: file.metadata,
    maya_safe_file: safeFile,
  };
}

export function getMayaSafeFileStatusLabel(file: Pick<ExtendedFile, 'safeFile'>): string {
  if (file.safeFile?.localPreviewOnly) {
    switch (file.safeFile.status) {
      case 'ready':
        return 'Prompt-only transcript';
      case 'failed':
        return 'Transcript unavailable';
      default:
        return 'Preparing transcript...';
    }
  }

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
