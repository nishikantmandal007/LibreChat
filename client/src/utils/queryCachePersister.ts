import { dehydrate, hydrate, type QueryClient, type DehydratedState } from '@tanstack/react-query';
import { QueryKeys } from 'librechat-data-provider';

/**
 * Lightweight, dependency-free persistence for React Query's cache.
 *
 * Production apps avoid re-hitting the backend on every page reload by serving
 * the last-known-good data from storage while React Query revalidates in the
 * background (stale-while-revalidate). We use v4's built-in `dehydrate`/`hydrate`
 * (no extra packages) and only persist a small allow-list of *stable, non-PII*
 * queries to localStorage.
 *
 * Intentionally NOT persisted: conversations, messages, files/images and user
 * balance. Those are either volatile, large, or sensitive — conversation files
 * and images already have their own IndexedDB cache (`browserFileStore`), and
 * messages keep an in-memory 5-min staleTime.
 */

const STORAGE_KEY = 'mdp_rq_cache_v1';
/** Bump to invalidate every client's persisted cache after a breaking change. */
const CACHE_BUSTER = '1';
/** Drop anything older than this on hydrate so stale data can't linger forever. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
/** Coalesce rapid cache updates into at most one write per interval. */
const WRITE_THROTTLE_MS = 1000;

/** Query-key roots that are safe + worth persisting across reloads. */
const PERSISTED_KEYS: ReadonlySet<string> = new Set<string>([
  QueryKeys.promptGroups,
  QueryKeys.allPromptGroups,
  QueryKeys.prompts,
  QueryKeys.skills,
  QueryKeys.skillStates,
  QueryKeys.startupConfig,
]);

interface PersistedEnvelope {
  buster: string;
  timestamp: number;
  state: DehydratedState;
}

function isAllowed(queryKey: unknown): boolean {
  const root = Array.isArray(queryKey) ? queryKey[0] : queryKey;
  return typeof root === 'string' && PERSISTED_KEYS.has(root);
}

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Restore persisted queries into the client. Call once, before first render. */
export function hydrateQueryClientFromStorage(queryClient: QueryClient): void {
  const storage = safeLocalStorage();
  if (!storage) {
    return;
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const envelope = JSON.parse(raw) as PersistedEnvelope;
    if (
      !envelope ||
      envelope.buster !== CACHE_BUSTER ||
      typeof envelope.timestamp !== 'number' ||
      Date.now() - envelope.timestamp > MAX_AGE_MS
    ) {
      storage.removeItem(STORAGE_KEY);
      return;
    }
    hydrate(queryClient, envelope.state);
  } catch {
    storage.removeItem(STORAGE_KEY);
  }
}

/**
 * Persist allow-listed queries on every cache change (throttled).
 * Returns an unsubscribe function.
 */
export function subscribeQueryClientPersist(queryClient: QueryClient): () => void {
  const storage = safeLocalStorage();
  if (!storage) {
    return () => undefined;
  }

  let timer: ReturnType<typeof setTimeout> | null = null;

  const write = () => {
    timer = null;
    try {
      const state = dehydrate(queryClient, {
        shouldDehydrateQuery: (query) =>
          query.state.status === 'success' && isAllowed(query.queryKey),
      });
      const envelope: PersistedEnvelope = {
        buster: CACHE_BUSTER,
        timestamp: Date.now(),
        state,
      };
      storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    } catch {
      /* quota errors etc. — caching is best-effort, never block the app */
    }
  };

  const unsubscribe = queryClient.getQueryCache().subscribe(() => {
    if (timer != null) {
      return;
    }
    timer = setTimeout(write, WRITE_THROTTLE_MS);
  });

  return () => {
    if (timer != null) {
      clearTimeout(timer);
    }
    unsubscribe();
  };
}

/** Drop the persisted cache. Call on logout so the next user starts clean. */
export function clearPersistedQueryCache(): void {
  const storage = safeLocalStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
