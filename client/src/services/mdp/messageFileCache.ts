import type { TMessage } from 'librechat-data-provider';
import {
  clearPersistedMessageFiles,
  loadMessageFilesEntry,
  persistMessageFilesEntry,
} from './browserFileStore';

type MessageFiles = NonNullable<TMessage['files']>;

type CacheWrite = {
  conversationId?: string | null;
  messageId?: string | null;
  text?: string | null;
  textOccurrence?: number;
  files?: TMessage['files'];
};

type CacheRead = Omit<CacheWrite, 'files'>;

type CachedMessageFiles = {
  messageId?: string;
  textKey: string;
  textOccurrence: number;
  files: MessageFiles;
};

const fileCache = new Map<string, CachedMessageFiles[]>();

function normalizeText(text?: string | null): string {
  return (text ?? '').trim();
}

function hasFiles(files?: TMessage['files']): files is MessageFiles {
  return Array.isArray(files) && files.length > 0;
}

function cloneFiles(files: MessageFiles): MessageFiles {
  return JSON.parse(JSON.stringify(files)) as MessageFiles;
}

export function getPromptTextOccurrence(messages: TMessage[] | undefined, text: string): number {
  const textKey = normalizeText(text);
  if (!textKey) {
    return 0;
  }

  return (messages ?? []).filter(
    (message) => message.isCreatedByUser && normalizeText(message.text) === textKey,
  ).length;
}

export async function rememberMessageFiles({
  conversationId,
  messageId,
  text,
  textOccurrence,
  files,
}: CacheWrite): Promise<void> {
  const textKey = normalizeText(text);
  if (!conversationId || !textKey || !hasFiles(files)) {
    return;
  }

  const entries = fileCache.get(conversationId) ?? [];
  const occurrence =
    textOccurrence ?? entries.filter((entry) => entry.textKey === textKey).length + 1;
  const entry: CachedMessageFiles = {
    messageId: messageId ?? undefined,
    textKey,
    textOccurrence: occurrence,
    files: cloneFiles(files),
  };

  const existingIndex = entries.findIndex((candidate) => {
    if (entry.messageId && candidate.messageId === entry.messageId) {
      return true;
    }
    return candidate.textKey === entry.textKey && candidate.textOccurrence === occurrence;
  });

  if (existingIndex >= 0) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }

  fileCache.set(conversationId, entries);
  await persistMessageFilesEntry({
    conversationId,
    messageId: entry.messageId,
    textKey,
    textOccurrence: occurrence,
    files: entry.files,
  }).catch(() => undefined);
}

export function getCachedMessageFiles({
  conversationId,
  messageId,
  text,
  textOccurrence,
}: CacheRead): TMessage['files'] {
  const textKey = normalizeText(text);
  if (!conversationId || !textKey) {
    return undefined;
  }

  const entries = fileCache.get(conversationId);
  if (!entries?.length) {
    return undefined;
  }

  const messageIdMatch = messageId
    ? entries.find((entry) => entry.messageId === messageId)
    : undefined;
  if (messageIdMatch) {
    return cloneFiles(messageIdMatch.files);
  }

  if (textOccurrence != null) {
    const occurrenceMatch = entries.find(
      (entry) => entry.textKey === textKey && entry.textOccurrence === textOccurrence,
    );
    return occurrenceMatch ? cloneFiles(occurrenceMatch.files) : undefined;
  }

  const textMatch = entries.find((entry) => entry.textKey === textKey);

  return textMatch ? cloneFiles(textMatch.files) : undefined;
}

export async function getCachedMessageFilesAsync(read: CacheRead): Promise<TMessage['files']> {
  const memoryFiles = getCachedMessageFiles(read);
  if (memoryFiles?.length) {
    return memoryFiles;
  }

  const textKey = normalizeText(read.text);
  const persisted = await loadMessageFilesEntry({
    conversationId: read.conversationId,
    messageId: read.messageId,
    textKey,
    textOccurrence: read.textOccurrence,
  }).catch(() => undefined);
  if (!persisted?.files?.length) {
    return undefined;
  }

  const entries = fileCache.get(persisted.conversationId) ?? [];
  const existingIndex = entries.findIndex((entry) => {
    if (persisted.messageId && entry.messageId === persisted.messageId) {
      return true;
    }
    return (
      entry.textKey === persisted.textKey &&
      entry.textOccurrence === persisted.textOccurrence
    );
  });
  const memoryEntry: CachedMessageFiles = {
    messageId: persisted.messageId,
    textKey: persisted.textKey,
    textOccurrence: persisted.textOccurrence,
    files: cloneFiles(persisted.files),
  };
  if (existingIndex >= 0) {
    entries[existingIndex] = memoryEntry;
  } else {
    entries.push(memoryEntry);
  }
  fileCache.set(persisted.conversationId, entries);

  return cloneFiles(persisted.files);
}

export function clearMessageFileCache(conversationId?: string): void {
  if (conversationId) {
    fileCache.delete(conversationId);
    void clearPersistedMessageFiles(conversationId).catch(() => undefined);
    return;
  }
  fileCache.clear();
  void clearPersistedMessageFiles().catch(() => undefined);
}
