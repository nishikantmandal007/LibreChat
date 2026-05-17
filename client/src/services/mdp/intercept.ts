import axios from 'axios';
import { roleDefaults, SystemRoles, Constants } from 'librechat-data-provider';
import {
  listSessions,
  getSessionConversation,
  getSessionMessages,
  invalidateSessionsCache,
} from './history';
import { renameSession, deleteSession } from './session';
import { uploadFile as uploadMayaFile } from './files';
import { MAYA_ENDPOINTS, MAYA_MODELS, MAYA_STARTUP_CONFIG } from './modelConfig';

import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const EMPTY_ARRAY: never[] = [];
const EMPTY_OBJECT = {};

const GUEST_USER = {
  id: 'guest',
  email: 'guest@maya.ai',
  name: 'Guest',
  username: 'guest',
  role: SystemRoles.USER,
  provider: 'local',
};

const MOCK_ROUTES: Record<string, unknown> = {
  '/api/config': {
    ...MAYA_STARTUP_CONFIG,
  },
  '/api/endpoints': MAYA_ENDPOINTS,
  '/api/models': MAYA_MODELS,
  '/api/user/terms': { termsAccepted: true },
  '/api/user': GUEST_USER,
  '/api/banner': '',
  '/api/roles/USER': roleDefaults[SystemRoles.USER],
  '/api/roles/ADMIN': roleDefaults[SystemRoles.ADMIN],
  '/api/presets': EMPTY_ARRAY,
  '/api/prompts': EMPTY_ARRAY,
  '/api/tags': EMPTY_ARRAY,
  '/api/convos/tags': EMPTY_ARRAY,
  '/api/search/enable': false,
  '/api/files/speech/config/get': { message: 'not_found' },
  '/api/files/speech/tts/voices': EMPTY_ARRAY,
  '/api/files/config': {},
  '/api/files': EMPTY_ARRAY,
  '/api/balance': undefined,
  '/api/agents/chat/active': { activeJobIds: EMPTY_ARRAY },
  '/api/active-jobs': { activeJobIds: EMPTY_ARRAY },
  '/api/agents': { data: EMPTY_ARRAY, hasNextPage: false },
  '/api/assistants': { data: EMPTY_ARRAY, hasNextPage: false },
  '/api/tools/available': EMPTY_ARRAY,
  '/api/tools': EMPTY_ARRAY,
  '/api/favorites': EMPTY_OBJECT,
  '/api/mcp/tools': { servers: {} },
  '/api/mcp/servers': EMPTY_OBJECT,
  '/api/mcp/connection/status': EMPTY_OBJECT,
  '/api/memories': { memories: EMPTY_ARRAY, totalCount: 0 },
  '/api/skills': { skills: EMPTY_ARRAY, totalCount: 0 },
  '/api/categories': EMPTY_ARRAY,
};

function createResponse(
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
): AxiosResponse {
  return {
    data,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    headers: {},
    config,
  };
}

function localPathFromUrl(url: string): string | null {
  let path = url;

  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin) {
      return null;
    }
    path = `${parsed.pathname}${parsed.search}`;
  } catch {
    // Relative path, keep as-is.
  }

  const baseHref = document.querySelector('base')?.getAttribute('href') || '/';
  if (baseHref !== '/' && path.startsWith(baseHref)) {
    path = path.slice(baseHref.length) || '/';
  }

  if (path === '/health') {
    return '/health';
  }

  const apiIndex = path.indexOf('/api/');
  if (apiIndex === -1) {
    return null;
  }

  return path.slice(apiIndex);
}

function parseBody<T>(data: unknown): T | undefined {
  if (data == null || data instanceof FormData) {
    return data as T | undefined;
  }
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as T;
    } catch {
      return undefined;
    }
  }
  return data as T;
}

function getArg<T>(config: InternalAxiosRequestConfig): T | undefined {
  const body = parseBody<Record<string, unknown>>(config.data);
  if (body && typeof body === 'object' && 'arg' in body) {
    return body.arg as T;
  }
  return body as T | undefined;
}

function staticRoute(pathname: string): { matched: boolean; data: unknown } {
  const entries = Object.entries(MOCK_ROUTES).sort((a, b) => b[0].length - a[0].length);
  for (const [route, data] of entries) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return { matched: true, data };
    }
  }
  return { matched: false, data: null };
}

function fallbackTitle(conversationId: string): string {
  if (!conversationId || conversationId === Constants.NEW_CONVO) {
    return 'New Chat';
  }
  return 'New Chat';
}

async function resolveApiData(
  config: InternalAxiosRequestConfig,
  apiPath: string,
): Promise<unknown> {
  const method = (config.method || 'get').toLowerCase();
  const [pathname, rawSearch = ''] = apiPath.split('?');
  const searchParams = new URLSearchParams(rawSearch);

  if (pathname === '/health') {
    return 'ok';
  }

  if (pathname === '/api/convos' && method === 'get') {
    return {
      conversations: await listSessions(),
      nextCursor: null,
    };
  }

  if (pathname.startsWith('/api/convos/gen_title/') && method === 'get') {
    const conversationId = decodeURIComponent(pathname.replace('/api/convos/gen_title/', ''));
    const conversation = await getSessionConversation(conversationId);
    return { title: conversation.title || fallbackTitle(conversationId) };
  }

  if (pathname === '/api/convos/update' && method === 'post') {
    const payload = getArg<{ conversationId?: string; title?: string }>(config);
    if (payload?.conversationId && payload.title) {
      invalidateSessionsCache();
      await renameSession(payload.conversationId, payload.title);
      const conversation = await getSessionConversation(payload.conversationId);
      return { ...conversation, title: payload.title };
    }
    return EMPTY_OBJECT;
  }

  if (pathname === '/api/convos' && method === 'delete') {
    const payload = getArg<{ conversationId?: string }>(config);
    if (payload?.conversationId) {
      invalidateSessionsCache();
      await deleteSession(payload.conversationId);
    }
    return { acknowledged: true, deletedCount: payload?.conversationId ? 1 : 0 };
  }

  if (pathname.startsWith('/api/convos/tags')) {
    return EMPTY_ARRAY;
  }

  if (pathname.startsWith('/api/convos/') && method === 'get') {
    const conversationId = decodeURIComponent(pathname.replace('/api/convos/', ''));
    return getSessionConversation(conversationId);
  }

  if (pathname === '/api/messages' && method === 'get') {
    const conversationId = searchParams.get('conversationId') ?? '';
    return {
      messages: conversationId ? await getSessionMessages(conversationId) : EMPTY_ARRAY,
      nextCursor: null,
    };
  }

  if (pathname.startsWith('/api/messages/') && method === 'get') {
    const [, , ...ids] = pathname.split('/').filter(Boolean);
    if (ids.length === 0) {
      return EMPTY_ARRAY;
    }
    const [conversationId, messageId] = ids;
    const messages = await getSessionMessages(decodeURIComponent(conversationId || ''));
    if (messageId) {
      return (
        messages.find((message) => message.messageId === decodeURIComponent(messageId)) ?? null
      );
    }
    return messages;
  }

  if (pathname.startsWith('/api/messages/') && ['put', 'patch', 'post'].includes(method)) {
    return EMPTY_OBJECT;
  }

  if (
    (pathname === '/api/files' || pathname === '/api/files/images') &&
    method === 'post' &&
    config.data instanceof FormData
  ) {
    return uploadMayaFile(config.data);
  }

  if (pathname.startsWith('/api/files/') && pathname.endsWith('/preview') && method === 'get') {
    const fileId = decodeURIComponent(pathname.split('/')[3] ?? '');
    return { file_id: fileId, status: 'ready' };
  }

  const route = staticRoute(pathname);
  if (route.matched) {
    return route.data;
  }

  if (pathname.startsWith('/api/')) {
    return EMPTY_OBJECT;
  }

  return null;
}

function installFetchInterceptor(): void {
  if (
    (window as typeof window & { __mdpFetchInterceptorInstalled?: boolean })
      .__mdpFetchInterceptorInstalled
  ) {
    return;
  }
  (
    window as typeof window & { __mdpFetchInterceptorInstalled?: boolean }
  ).__mdpFetchInterceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' || input instanceof URL ? input.toString() : input.url;
    const localPath = localPathFromUrl(url);

    if (!localPath?.startsWith('/api/')) {
      return originalFetch(input, init);
    }

    const data = await resolveApiData(
      {
        url,
        method: init?.method || 'get',
        data: init?.body,
        headers: {},
      } as InternalAxiosRequestConfig,
      localPath,
    );

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof window.fetch;
}

export function installApiInterceptor(): void {
  axios.interceptors.request.use((config) => {
    const url = config.url ?? '';
    const localPath = localPathFromUrl(url);

    if (localPath) {
      config.adapter = async () => createResponse(config, await resolveApiData(config, localPath));
    }

    return config;
  });

  installFetchInterceptor();
}
