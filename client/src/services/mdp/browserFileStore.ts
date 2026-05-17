import type { TMessage } from 'librechat-data-provider';

type MessageFiles = NonNullable<TMessage['files']>;

export type StoredMessageFilesEntry = {
  id: string;
  conversationId: string;
  messageId?: string;
  textKey: string;
  textOccurrence: number;
  files: MessageFiles;
  updatedAt: number;
};

type StoredSafeFileBlob = {
  id: string;
  url: string;
  blob: Blob;
  mimeType?: string;
  updatedAt: number;
};

const DB_NAME = 'maya-safe-chat-files';
const DB_VERSION = 1;
const MESSAGE_FILES_STORE = 'messageFiles';
const SAFE_FILE_BLOBS_STORE = 'safeFileBlobs';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function canUseIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDB()) {
    return Promise.resolve(null);
  }
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MESSAGE_FILES_STORE)) {
        const store = db.createObjectStore(MESSAGE_FILES_STORE, { keyPath: 'id' });
        store.createIndex('conversationId', 'conversationId', { unique: false });
      }
      if (!db.objectStoreNames.contains(SAFE_FILE_BLOBS_STORE)) {
        db.createObjectStore(SAFE_FILE_BLOBS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function cloneFiles(files: MessageFiles): MessageFiles {
  return JSON.parse(JSON.stringify(files)) as MessageFiles;
}

export function buildMessageFilesEntryId(entry: {
  conversationId: string;
  messageId?: string;
  textKey: string;
  textOccurrence: number;
}): string {
  const messageKey = entry.messageId || 'no-message-id';
  return `${entry.conversationId}::${messageKey}::${entry.textOccurrence}::${entry.textKey}`;
}

export async function persistMessageFilesEntry(
  entry: Omit<StoredMessageFilesEntry, 'id' | 'updatedAt'>,
): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    return;
  }

  const stored: StoredMessageFilesEntry = {
    ...entry,
    id: buildMessageFilesEntryId(entry),
    files: cloneFiles(entry.files),
    updatedAt: Date.now(),
  };
  const transaction = db.transaction(MESSAGE_FILES_STORE, 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore(MESSAGE_FILES_STORE).put(stored);
  await done;
}

export async function loadMessageFilesEntry({
  conversationId,
  messageId,
  textKey,
  textOccurrence,
}: {
  conversationId?: string | null;
  messageId?: string | null;
  textKey?: string | null;
  textOccurrence?: number;
}): Promise<StoredMessageFilesEntry | undefined> {
  if (!conversationId || !textKey) {
    return undefined;
  }

  const db = await openDatabase();
  if (!db) {
    return undefined;
  }

  const transaction = db.transaction(MESSAGE_FILES_STORE, 'readonly');
  const done = transactionDone(transaction);
  const store = transaction.objectStore(MESSAGE_FILES_STORE);
  const index = store.index('conversationId');
  const entries = await requestToPromise<StoredMessageFilesEntry[]>(index.getAll(conversationId));
  await done;

  if (messageId) {
    const messageMatch = entries.find((entry) => entry.messageId === messageId);
    if (messageMatch) {
      return {
        ...messageMatch,
        files: cloneFiles(messageMatch.files),
      };
    }
  }

  if (textOccurrence != null) {
    const occurrenceMatch = entries.find(
      (entry) => entry.textKey === textKey && entry.textOccurrence === textOccurrence,
    );
    return occurrenceMatch
      ? {
          ...occurrenceMatch,
          files: cloneFiles(occurrenceMatch.files),
        }
      : undefined;
  }

  const textMatch = entries.find((entry) => entry.textKey === textKey);
  return textMatch
    ? {
        ...textMatch,
        files: cloneFiles(textMatch.files),
      }
    : undefined;
}

export async function clearPersistedMessageFiles(conversationId?: string): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    return;
  }

  const transaction = db.transaction(MESSAGE_FILES_STORE, 'readwrite');
  const done = transactionDone(transaction);
  const store = transaction.objectStore(MESSAGE_FILES_STORE);
  if (!conversationId) {
    store.clear();
    await done;
    return;
  }

  const index = store.index('conversationId');
  const entries = await requestToPromise<StoredMessageFilesEntry[]>(index.getAll(conversationId));
  entries.forEach((entry) => store.delete(entry.id));
  await done;
}

function buildSafeFileBlobId(url: string): string {
  return `safe-file-blob::${url}`;
}

export async function loadSafeFileBlob(url?: string): Promise<Blob | undefined> {
  if (!url) {
    return undefined;
  }

  const db = await openDatabase();
  if (!db) {
    return undefined;
  }

  const transaction = db.transaction(SAFE_FILE_BLOBS_STORE, 'readonly');
  const done = transactionDone(transaction);
  const store = transaction.objectStore(SAFE_FILE_BLOBS_STORE);
  const stored = await requestToPromise<StoredSafeFileBlob | undefined>(
    store.get(buildSafeFileBlobId(url)),
  );
  await done;

  if (!stored?.blob) {
    return undefined;
  }
  if (stored.blob.type || !stored.mimeType) {
    return stored.blob;
  }
  return new Blob([stored.blob], { type: stored.mimeType });
}

export async function persistSafeFileBlob({
  url,
  blob,
  mimeType,
}: {
  url?: string;
  blob: Blob;
  mimeType?: string;
}): Promise<void> {
  if (!url) {
    return;
  }

  const db = await openDatabase();
  if (!db) {
    return;
  }

  const stored: StoredSafeFileBlob = {
    id: buildSafeFileBlobId(url),
    url,
    blob,
    mimeType,
    updatedAt: Date.now(),
  };
  const transaction = db.transaction(SAFE_FILE_BLOBS_STORE, 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore(SAFE_FILE_BLOBS_STORE).put(stored);
  await done;
}
