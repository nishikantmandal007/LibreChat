const BASE = '/mdp/ai-safe';

export const MDP_ENDPOINTS = {
  chat: `${BASE}/chat`,
  detect: `${BASE}/detect`,
  anonymize: `${BASE}/anonymize`,
  deidentify: `${BASE}/deidentify`,
  upload: `${BASE}/upload`,
  voice: `${BASE}/voice`,
  history: `${BASE}/history`,
  agentChat: `${BASE}/agent/chat`,
  sessionRename: `${BASE}/session/rename`,
  sessionDelete: `${BASE}/session/delete`,
  sessionTokenUsage: `${BASE}/session/get-token-usage`,
  anonymizeFile: `${BASE}/anonymize-file`,
  generateImage: `${BASE}/generate-image`,
  image: `${BASE}/image`,
  setModelParams: `${BASE}/set-model-params`,
  getModelParams: `${BASE}/get-model-params`,
  health: `${BASE}/health`,
  supportedFiles: `${BASE}/supported-files`,
  billingDetails: `${BASE}/billing-details`,
};
