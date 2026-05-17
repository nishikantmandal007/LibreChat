import { EModelEndpoint } from 'librechat-data-provider';
import type {
  TEndpointsConfig,
  TModelSpec,
  TModelsConfig,
  TStartupConfig,
} from 'librechat-data-provider';

export const MAYA_DEFAULT_ENDPOINT = EModelEndpoint.openAI;
export const MAYA_DEFAULT_MODEL = 'gpt-4o';
export const MAYA_DEFAULT_SPEC = 'maya-openai-gpt-4o';

export const MAYA_ENDPOINTS: TEndpointsConfig = {
  [EModelEndpoint.openAI]: {
    type: EModelEndpoint.openAI,
    enabled: true,
    order: 0,
    modelDisplayLabel: 'OpenAI',
  },
  [EModelEndpoint.anthropic]: {
    type: EModelEndpoint.anthropic,
    enabled: true,
    order: 1,
    modelDisplayLabel: 'Anthropic',
  },
  [EModelEndpoint.google]: {
    type: EModelEndpoint.google,
    enabled: true,
    order: 2,
    modelDisplayLabel: 'Google',
  },
};

export const MAYA_MODELS: TModelsConfig = {
  [EModelEndpoint.openAI]: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'],
  [EModelEndpoint.anthropic]: [
    'claude-sonnet-4-5',
    'claude-haiku-4-5',
    'claude-3-5-sonnet-latest',
  ],
  [EModelEndpoint.google]: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
};

export const MAYA_MODEL_SPECS: TModelSpec[] = [
  {
    name: MAYA_DEFAULT_SPEC,
    label: 'GPT-4o',
    default: true,
    order: 0,
    iconURL: EModelEndpoint.openAI,
    preset: {
      endpoint: EModelEndpoint.openAI,
      model: MAYA_DEFAULT_MODEL,
      modelLabel: 'GPT-4o',
    },
  },
];

export const MAYA_INTERFACE_CONFIG = {
  modelSelect: true,
  parameters: false,
  presets: false,
  agents: false,
  marketplace: {
    use: false,
  },
  temporaryChat: true,
  fileSearch: true,
  fileCitations: true,
};

export const MAYA_STARTUP_CONFIG: TStartupConfig = {
  appTitle: 'Maya AI',
  socialLogins: [],
  discordLoginEnabled: false,
  facebookLoginEnabled: false,
  githubLoginEnabled: false,
  googleLoginEnabled: false,
  openidLoginEnabled: false,
  openidLabel: '',
  openidImageUrl: '',
  openidAutoRedirect: false,
  appleLoginEnabled: false,
  samlLoginEnabled: false,
  samlLabel: '',
  samlImageUrl: '',
  ldap: { enabled: false },
  serverDomain: '',
  emailLoginEnabled: true,
  registrationEnabled: false,
  socialLoginEnabled: false,
  passwordResetEnabled: false,
  emailEnabled: false,
  showBirthdayIcon: false,
  helpAndFaqURL: '',
  modelSpecs: {
    enforce: false,
    prioritize: true,
    list: MAYA_MODEL_SPECS,
    addedEndpoints: [EModelEndpoint.openAI, EModelEndpoint.anthropic, EModelEndpoint.google],
  },
  interface: MAYA_INTERFACE_CONFIG,
  balance: undefined,
  sharedLinksEnabled: false,
  publicSharedLinksEnabled: false,
  allowAccountDeletion: false,
};

export function endpointToMayaLLM(endpoint?: string | null): string {
  switch (endpoint) {
    case EModelEndpoint.anthropic:
      return 'anthropic';
    case EModelEndpoint.google:
      return 'google';
    case EModelEndpoint.openAI:
    default:
      return 'openai';
  }
}
