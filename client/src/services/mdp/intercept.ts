import axios from 'axios';
import { EModelEndpoint, roleDefaults, SystemRoles, Constants } from 'librechat-data-provider';
import {
  listSessions,
  getSessionConversation,
  getSessionMessages,
  invalidateSessionsCache,
} from './history';
import { mdpClient } from './client';
import { MDP_ENDPOINTS } from './endpoints';
import { renameSession, deleteSession } from './session';
import { uploadFile as uploadMayaFile } from './files';
import { MAYA_ENDPOINTS, MAYA_MODELS, MAYA_STARTUP_CONFIG } from './modelConfig';
import { normalizeMdpLanguage } from './language';
import {
  attachWorkspaceBookmarks,
  createWorkspaceBookmark,
  createWorkspacePrompt,
  createWorkspaceSkill,
  createWorkspaceSkillWithBackend,
  deleteWorkspaceBookmark,
  deleteWorkspacePrompt,
  deleteWorkspacePromptGroup,
  deleteWorkspaceSkillWithBackend,
  getWorkspacePromptGroup,
  getWorkspaceSkillWithBackend,
  getWorkspaceSkillStates,
  importWorkspaceSkill,
  listAllWorkspacePromptGroups,
  listWorkspaceBookmarks,
  listWorkspacePromptCategories,
  listWorkspacePromptGroups,
  listWorkspacePrompts,
  listWorkspaceSkillsWithBackend,
  makeWorkspacePromptProduction,
  recordWorkspacePromptUsage,
  setConversationBookmarks,
  updateWorkspaceBookmark,
  updateWorkspacePromptGroup,
  updateWorkspaceSkill,
  updateWorkspaceSkillWithBackend,
  updateWorkspaceSkillStates,
} from './workspaceStore';

import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { MDPChatModelCatalog } from './types';

const EMPTY_ARRAY: never[] = [];
const EMPTY_OBJECT = {};

const GUEST_USER = {
  id: 'guest',
  email: 'guest@aisafe.local',
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
  '/api/files/speech/config/get': {
    speechToText: true,
    engineSTT: 'external',
    languageSTT: 'en',
    autoTranscribeAudio: false,
    autoSendText: -1,
    textToSpeech: true,
    engineTTS: 'browser',
  },
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

function normalizeSpeechText(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }
  if (!data || typeof data !== 'object') {
    return '';
  }

  const value = data as Record<string, unknown>;
  const text = value.text ?? value.transcript ?? value.data;
  if (typeof text === 'string') {
    return text;
  }
  if (text && typeof text === 'object') {
    const nested = text as Record<string, unknown>;
    return typeof nested.transcript === 'string' ? nested.transcript : '';
  }

  return '';
}

async function transcribeSpeech(config: InternalAxiosRequestConfig): Promise<{ text: string }> {
  if (!(config.data instanceof FormData)) {
    throw new Error('Audio request must be multipart form data');
  }

  const audio = config.data.get('audio');
  if (!(audio instanceof Blob)) {
    throw new Error('Audio request is missing an audio file');
  }

  const language = config.data.get('language');
  const response = await mdpClient.post<unknown>(MDP_ENDPOINTS.voice, audio, {
    headers: {
      'Content-Type': audio.type || 'application/octet-stream',
      lang: normalizeMdpLanguage(typeof language === 'string' ? language : null),
      'model-size': 'tiny',
    },
  });

  return { text: normalizeSpeechText(response.data) };
}

async function getMayaModelsConfig(): Promise<unknown> {
  try {
    const response = await mdpClient.get<MDPChatModelCatalog>(MDP_ENDPOINTS.chatModels);
    const catalog = response.data;
    const modelsByEndpoint = catalog.models_by_endpoint;
    const groupedModels = {
      [EModelEndpoint.openAI]: modelsByEndpoint?.[EModelEndpoint.openAI] ?? [],
      [EModelEndpoint.anthropic]: modelsByEndpoint?.[EModelEndpoint.anthropic] ?? [],
    };

    if (
      groupedModels[EModelEndpoint.openAI].length ||
      groupedModels[EModelEndpoint.anthropic].length
    ) {
      return groupedModels;
    }

    for (const model of catalog.models ?? []) {
      if (model.provider === 'anthropic_foundry') {
        groupedModels[EModelEndpoint.anthropic].push(model.key);
      } else if (model.key) {
        groupedModels[EModelEndpoint.openAI].push(model.key);
      }
    }

    if (
      groupedModels[EModelEndpoint.openAI].length ||
      groupedModels[EModelEndpoint.anthropic].length
    ) {
      return groupedModels;
    }
  } catch {
    // Use the static catalogue when the backend is unavailable during local startup.
  }

  return MAYA_MODELS;
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

function handleWorkspaceBookmarkRoute(
  config: InternalAxiosRequestConfig,
  pathname: string,
  method: string,
): { matched: boolean; data: unknown } {
  if (pathname === '/api/tags' && method === 'get') {
    return { matched: true, data: listWorkspaceBookmarks() };
  }

  if (pathname === '/api/tags' && method === 'post') {
    return {
      matched: true,
      data: createWorkspaceBookmark(
        getArg<Parameters<typeof createWorkspaceBookmark>[0]>(config) ?? {},
      ),
    };
  }

  if (pathname.startsWith('/api/tags/convo/') && method === 'put') {
    const conversationId = decodeURIComponent(pathname.replace('/api/tags/convo/', ''));
    const payload = getArg<{ tags?: string[] }>(config);
    return { matched: true, data: setConversationBookmarks(conversationId, payload?.tags ?? []) };
  }

  if (pathname === '/api/convos/tags' || pathname.startsWith('/api/convos/tags/')) {
    return { matched: true, data: listWorkspaceBookmarks() };
  }

  if (pathname.startsWith('/api/tags/')) {
    const tag = decodeURIComponent(pathname.replace('/api/tags/', ''));
    if (tag === 'rebuild') {
      return { matched: true, data: listWorkspaceBookmarks() };
    }
    if (method === 'put' || method === 'patch') {
      return {
        matched: true,
        data: updateWorkspaceBookmark(
          tag,
          getArg<Parameters<typeof updateWorkspaceBookmark>[1]>(config) ?? {},
        ),
      };
    }
    if (method === 'delete') {
      return { matched: true, data: deleteWorkspaceBookmark(tag) };
    }
  }

  return { matched: false, data: null };
}

function handleWorkspacePromptRoute(
  config: InternalAxiosRequestConfig,
  pathname: string,
  method: string,
  searchParams: URLSearchParams,
): { matched: boolean; data: unknown } {
  if (pathname === '/api/categories' && method === 'get') {
    const DEFAULT_CATEGORIES = [
      { value: '', label: 'com_ui_all' },
      { value: 'general', label: 'General' },
      { value: 'code', label: 'Code' },
      { value: 'write', label: 'Writing' },
      { value: 'idea', label: 'Ideas' },
      { value: 'finance', label: 'Finance' },
      { value: 'hr', label: 'HR' },
      { value: 'it', label: 'IT' },
      { value: 'sales', label: 'Sales' },
      { value: 'teach_or_explain', label: 'Education' },
    ];
    const custom = listWorkspacePromptCategories()
      .filter((c: string) => !DEFAULT_CATEGORIES.some((d) => d.value === c))
      .map((c: string) => ({ value: c, label: c, custom: true }));
    return { matched: true, data: [...DEFAULT_CATEGORIES, ...custom] };
  }

  if (pathname === '/api/prompts/all' && method === 'get') {
    return { matched: true, data: listAllWorkspacePromptGroups() };
  }

  if (pathname === '/api/prompts/groups' && method === 'get') {
    return {
      matched: true,
      data: listWorkspacePromptGroups(Object.fromEntries(searchParams.entries())),
    };
  }

  const groupPromptMatch = pathname.match(/^\/api\/prompts\/groups\/([^/]+)\/prompts$/);
  if (groupPromptMatch && method === 'post') {
    const groupId = decodeURIComponent(groupPromptMatch[1]);
    const payload =
      getArg<Parameters<typeof createWorkspacePrompt>[0]>(config) ??
      ({} as Parameters<typeof createWorkspacePrompt>[0]);
    return {
      matched: true,
      data: createWorkspacePrompt({
        ...payload,
        prompt: {
          ...(payload.prompt ?? {}),
          groupId,
        },
      }),
    };
  }

  const groupUseMatch = pathname.match(/^\/api\/prompts\/groups\/([^/]+)\/use$/);
  if (groupUseMatch && method === 'post') {
    return {
      matched: true,
      data: recordWorkspacePromptUsage(decodeURIComponent(groupUseMatch[1])),
    };
  }

  const groupMatch = pathname.match(/^\/api\/prompts\/groups\/([^/]+)$/);
  if (groupMatch) {
    const groupId = decodeURIComponent(groupMatch[1]);
    if (method === 'get') {
      return { matched: true, data: getWorkspacePromptGroup(groupId) };
    }
    if (method === 'patch' || method === 'put') {
      return {
        matched: true,
        data: updateWorkspacePromptGroup(
          groupId,
          getArg<Parameters<typeof updateWorkspacePromptGroup>[1]>(config) ?? {},
        ),
      };
    }
    if (method === 'delete') {
      return { matched: true, data: deleteWorkspacePromptGroup(groupId) };
    }
  }

  if (pathname === '/api/prompts' && method === 'get') {
    return {
      matched: true,
      data: listWorkspacePrompts(searchParams.get('groupId') ?? ''),
    };
  }

  if (pathname === '/api/prompts' && method === 'post') {
    return {
      matched: true,
      data: createWorkspacePrompt(
        getArg<Parameters<typeof createWorkspacePrompt>[0]>(config) ??
          ({} as Parameters<typeof createWorkspacePrompt>[0]),
      ),
    };
  }

  const productionMatch = pathname.match(/^\/api\/prompts\/([^/]+)\/tags\/production$/);
  if (productionMatch && (method === 'patch' || method === 'put')) {
    return {
      matched: true,
      data: makeWorkspacePromptProduction(decodeURIComponent(productionMatch[1])),
    };
  }

  const labelsMatch = pathname.match(/^\/api\/prompts\/([^/]+)\/labels$/);
  if (labelsMatch && (method === 'patch' || method === 'put')) {
    return { matched: true, data: { message: 'Prompt labels updated' } };
  }

  const promptMatch = pathname.match(/^\/api\/prompts\/([^/]+)$/);
  if (promptMatch && method === 'delete') {
    return {
      matched: true,
      data: deleteWorkspacePrompt(
        decodeURIComponent(promptMatch[1]),
        searchParams.get('groupId') ?? '',
      ),
    };
  }

  return { matched: false, data: null };
}

async function handleWorkspaceSkillRoute(
  config: InternalAxiosRequestConfig,
  pathname: string,
  method: string,
  searchParams: URLSearchParams,
): Promise<{ matched: boolean; data: unknown }> {
  if (pathname === '/api/user/settings/skills/active' && method === 'get') {
    return { matched: true, data: getWorkspaceSkillStates() };
  }

  if (pathname === '/api/user/settings/skills/active' && method === 'post') {
    const body = parseBody<{ skillStates?: Record<string, boolean> }>(config.data);
    return { matched: true, data: updateWorkspaceSkillStates(body?.skillStates ?? {}) };
  }

  if (pathname === '/api/skills' && method === 'get') {
    const params: Record<string, string | number | undefined> = Object.fromEntries(
      searchParams.entries(),
    );
    if (params.limit) {
      params.limit = Number(params.limit);
    }
    return {
      matched: true,
      data: await listWorkspaceSkillsWithBackend(
        params as { category?: string; search?: string; limit?: number; cursor?: string },
      ),
    };
  }

  if (pathname === '/api/skills' && method === 'post') {
    const payload =
      getArg<Parameters<typeof createWorkspaceSkill>[0]>(config) ??
      parseBody<Parameters<typeof createWorkspaceSkill>[0]>(config.data) ??
      ({} as Parameters<typeof createWorkspaceSkill>[0]);
    return { matched: true, data: await createWorkspaceSkillWithBackend(payload) };
  }

  if (pathname === '/api/skills/import' && method === 'post') {
    if (!(config.data instanceof FormData)) {
      throw new Error('Skill import request must be multipart form data');
    }
    return { matched: true, data: await importWorkspaceSkill(config.data) };
  }

  const skillMatch = pathname.match(/^\/api\/skills\/([^/]+)$/);
  if (skillMatch) {
    const skillId = decodeURIComponent(skillMatch[1]);
    if (method === 'get') {
      return { matched: true, data: await getWorkspaceSkillWithBackend(skillId) };
    }
    if (method === 'patch' || method === 'put') {
      const payload =
        getArg<Parameters<typeof updateWorkspaceSkill>[1]>(config) ??
        parseBody<Parameters<typeof updateWorkspaceSkill>[1]>(config.data) ??
        ({} as Parameters<typeof updateWorkspaceSkill>[1]);
      return { matched: true, data: await updateWorkspaceSkillWithBackend(skillId, payload) };
    }
    if (method === 'delete') {
      return { matched: true, data: await deleteWorkspaceSkillWithBackend(skillId) };
    }
  }

  return { matched: false, data: null };
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
      conversations: (await listSessions()).map(attachWorkspaceBookmarks),
      nextCursor: null,
    };
  }

  if (pathname.startsWith('/api/convos/gen_title/') && method === 'get') {
    const conversationId = decodeURIComponent(pathname.replace('/api/convos/gen_title/', ''));
    const conversation = await getSessionConversation(conversationId);
    return { title: conversation.title || fallbackTitle(conversationId) };
  }

  if (pathname === '/api/convos/update' && method === 'post') {
    const payload = getArg<{ conversationId?: string; title?: string; tags?: string[] }>(config);
    if (payload?.conversationId) {
      if (payload.title) {
        invalidateSessionsCache();
        await renameSession(payload.conversationId, payload.title);
      }
      if (Array.isArray(payload.tags)) {
        setConversationBookmarks(payload.conversationId, payload.tags);
      }
      const conversation = await getSessionConversation(payload.conversationId);
      return attachWorkspaceBookmarks({
        ...conversation,
        title: payload.title ?? conversation.title,
      });
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

  const bookmarkRoute = handleWorkspaceBookmarkRoute(config, pathname, method);
  if (bookmarkRoute.matched) {
    return bookmarkRoute.data;
  }

  const promptRoute = handleWorkspacePromptRoute(config, pathname, method, searchParams);
  if (promptRoute.matched) {
    return promptRoute.data;
  }

  const skillRoute = await handleWorkspaceSkillRoute(config, pathname, method, searchParams);
  if (skillRoute.matched) {
    return skillRoute.data;
  }

  if (pathname.startsWith('/api/convos/') && method === 'get') {
    const conversationId = decodeURIComponent(pathname.replace('/api/convos/', ''));
    return attachWorkspaceBookmarks(await getSessionConversation(conversationId));
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

  if (pathname === '/api/files/speech/stt' && method === 'post') {
    return transcribeSpeech(config);
  }

  if (pathname.startsWith('/api/files/') && pathname.endsWith('/preview') && method === 'get') {
    const fileId = decodeURIComponent(pathname.split('/')[3] ?? '');
    return { file_id: fileId, status: 'ready' };
  }

  if (pathname === '/api/models' && method === 'get') {
    return getMayaModelsConfig();
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
