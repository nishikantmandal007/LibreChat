import { EModelEndpoint } from 'librechat-data-provider';
import type { TEndpointsConfig, TModelsConfig, TStartupConfig } from 'librechat-data-provider';

export const MAYA_DEFAULT_ENDPOINT = EModelEndpoint.openAI;
export const MAYA_DEFAULT_MODEL = 'gpt-4o';
export const IMAGE_GEN_MODEL_KEY = 'image-gen-v1';

export function isImageGenModel(modelKey?: string | null): boolean {
  return modelKey === IMAGE_GEN_MODEL_KEY;
}

export type MayaChatModelCatalogItem = {
  key: string;
  label: string;
  provider: 'openai' | 'anthropic_foundry';
  company: 'OpenAI' | 'Anthropic';
  endpoint: EModelEndpoint;
};

export const MAYA_CHAT_MODEL_CATALOG: MayaChatModelCatalogItem[] = [
  {
    key: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'openai',
    company: 'OpenAI',
    endpoint: EModelEndpoint.openAI,
  },
  {
    key: 'claude-opus-4-8',
    label: 'Claude Opus 4.8',
    provider: 'anthropic_foundry',
    company: 'Anthropic',
    endpoint: EModelEndpoint.anthropic,
  },
  {
    key: IMAGE_GEN_MODEL_KEY,
    label: 'Image Generation',
    provider: 'openai',
    company: 'OpenAI',
    endpoint: EModelEndpoint.openAI,
  },
];

export const MAYA_CHAT_MODELS = MAYA_CHAT_MODEL_CATALOG.map((model) => model.key);
export const MAYA_CHAT_MODEL_LABELS = Object.fromEntries(
  MAYA_CHAT_MODEL_CATALOG.map((model) => [model.key, model.label]),
);

export const MAYA_ENDPOINTS: TEndpointsConfig = {
  [EModelEndpoint.openAI]: {
    type: EModelEndpoint.openAI,
    order: 0,
    modelDisplayLabel: 'OpenAI',
    iconURL: EModelEndpoint.openAI,
  },
  [EModelEndpoint.anthropic]: {
    type: EModelEndpoint.anthropic,
    order: 1,
    modelDisplayLabel: 'Anthropic',
    iconURL: EModelEndpoint.anthropic,
  },
};

export const MAYA_MODELS: TModelsConfig = {
  [EModelEndpoint.openAI]: MAYA_CHAT_MODEL_CATALOG.filter(
    (model) => model.endpoint === EModelEndpoint.openAI,
  ).map((model) => model.key),
  [EModelEndpoint.anthropic]: MAYA_CHAT_MODEL_CATALOG.filter(
    (model) => model.endpoint === EModelEndpoint.anthropic,
  ).map((model) => model.key),
};

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
  appTitle: 'AI Safe',
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
    prioritize: false,
    list: [],
    addedEndpoints: [EModelEndpoint.openAI, EModelEndpoint.anthropic],
  },
  interface: MAYA_INTERFACE_CONFIG,
  balance: undefined,
  sharedLinksEnabled: false,
  publicSharedLinksEnabled: false,
  allowAccountDeletion: false,
};

export function getModelCatalogItem(
  modelKey?: string | null,
): MayaChatModelCatalogItem | undefined {
  if (!modelKey) {
    return undefined;
  }
  return MAYA_CHAT_MODEL_CATALOG.find((item) => item.key === modelKey);
}

export function endpointToMayaLLM(_endpoint?: string | null): string {
  return 'openai';
}
