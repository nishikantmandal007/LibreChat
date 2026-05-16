import axios from 'axios';
import { EModelEndpoint } from 'librechat-data-provider';

const EMPTY_CONVERSATIONS = { conversations: [], pageNumber: '1', pageSize: 25, pages: 1 };
const EMPTY_MESSAGES: never[] = [];
const EMPTY_ARRAY: never[] = [];
const EMPTY_OBJECT = {};

const MOCK_ENDPOINTS = {
  [EModelEndpoint.openAI]: {
    type: EModelEndpoint.openAI,
    enabled: true,
  },
};

const MOCK_ROUTES: Record<string, unknown> = {
  '/api/config': {
    appTitle: 'Maya AI',
    socialLogins: [],
    emailLoginEnabled: true,
    registrationEnabled: false,
    serverDomain: '',
    emailEnabled: false,
    checkBalance: false,
    showBirthdayIcon: false,
    interface: {},
  },
  '/api/endpoints': MOCK_ENDPOINTS,
  '/api/user': {
    id: 'guest',
    email: 'guest@maya.ai',
    name: 'Guest',
    username: 'guest',
    role: 'USER',
    provider: 'local',
  },
  '/api/banner': '',
  '/api/roles/USER': null,
  '/api/roles/ADMIN': null,
  '/api/presets': EMPTY_ARRAY,
  '/api/prompts': EMPTY_ARRAY,
  '/api/tags': EMPTY_ARRAY,
  '/api/convos/tags': EMPTY_ARRAY,
  '/api/search/enable': { enabled: false },
  '/api/files/config': {
    fileLimit: 10,
    fileSizeLimit: 25,
    totalSizeLimit: 100,
    supportedMimeTypes: [],
    disabled: false,
  },
  '/api/files': EMPTY_ARRAY,
  '/api/balance': undefined,
  '/api/user/terms': { termsAccepted: true },
  '/api/agents': { data: EMPTY_ARRAY, hasNextPage: false },
  '/api/assistants': { data: EMPTY_ARRAY, hasNextPage: false },
  '/api/tools': EMPTY_ARRAY,
  '/api/tools/available': EMPTY_ARRAY,
  '/api/favorites': EMPTY_OBJECT,
  '/api/mcp/servers': EMPTY_ARRAY,
  '/api/mcp/tools': EMPTY_ARRAY,
  '/api/memories': { memories: EMPTY_ARRAY, totalCount: 0 },
  '/api/skills': { skills: EMPTY_ARRAY, totalCount: 0 },
  '/api/active-jobs': { activeJobIds: EMPTY_ARRAY },
  '/api/categories': EMPTY_ARRAY,
};

function findMockResponse(url: string): { matched: boolean; data: unknown } {
  if (url.startsWith('/api/convos') && !url.includes('/tags')) {
    return { matched: true, data: EMPTY_CONVERSATIONS };
  }

  if (url.startsWith('/api/messages')) {
    return { matched: true, data: EMPTY_MESSAGES };
  }

  for (const [route, data] of Object.entries(MOCK_ROUTES)) {
    if (url.startsWith(route)) {
      return { matched: true, data };
    }
  }

  if (url.startsWith('/api/')) {
    return { matched: true, data: EMPTY_OBJECT };
  }

  return { matched: false, data: null };
}

export function installApiInterceptor(): void {
  axios.interceptors.request.use((config) => {
    const url = config.url ?? '';
    const { matched, data } = findMockResponse(url);

    if (matched) {
      config.adapter = () =>
        Promise.resolve({
          data,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        });
    }

    return config;
  });
}
