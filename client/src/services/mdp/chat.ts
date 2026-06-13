import { v4 as uuidv4 } from 'uuid';
import { mdpClient } from './client';
import { MDP_ENDPOINTS } from './endpoints';
import {
  endpointToMayaLLM,
  getModelCatalogItem,
  MAYA_CHAT_MODEL_LABELS,
  MAYA_DEFAULT_MODEL,
} from './modelConfig';
import { formatMayaAssistantText } from './format';
import { invalidateSessionsCache } from './history';
import { normalizeMdpLanguage } from './language';

import type { TMessage } from 'librechat-data-provider';
import type { FileRole, MDPChatRequest, MDPChatResponse } from './types';

export interface MDPChatSubmission {
  text: string;
  displayText?: string;
  sessionId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  parentMessageId?: string | null;
  lang?: string;
  anonymizedPrompt?: string;
  anonymizedValues?: Record<string, string[]>;
  detectedValues?: Record<string, string[]>;
  choices?: string[];
  docId?: string;
  docIds?: string[];
  manualSkills?: string[];
  savedPrompt?: {
    groupId: string;
    name?: string;
    prompt: string;
  };
  skillInstructions?: Array<{
    name: string;
    description?: string;
    body: string;
  }>;
  fileRoles?: Record<string, FileRole>;
  files?: TMessage['files'];
  endpoint?: string | null;
  model?: string | null;
  webSearchEnabled?: boolean;
}

export interface MDPChatResult {
  sessionId: string;
  userMessage: TMessage;
  assistantMessage: TMessage;
  rawResponse: MDPChatResponse;
}

export interface MDPImageGenResult {
  sessionId: string;
  imagePath: string;
}

type MDPImageGenResponse = {
  session_id?: string;
  image_path?: string;
  chat_id?: string;
  image_url?: string;
};

export { formatMayaAssistantText } from './format';

function normalizeGeneratedImagePath(imagePath: string): string {
  const trimmed = imagePath.trim();
  if (trimmed.startsWith('#') && trimmed.endsWith('#')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export async function generateImage(
  prompt: string,
  sessionId?: string,
  llmType?: string,
): Promise<MDPImageGenResult> {
  const response = await mdpClient.post<MDPImageGenResponse | { data: MDPImageGenResponse }>(
    MDP_ENDPOINTS.generateImage,
    {
      llm_type: llmType || 'openai',
      image_dto: {
        prompt,
        chat_id: sessionId || '',
      },
    },
  );

  const rawData = response.data;
  const data = 'data' in rawData ? rawData.data : rawData;
  const imagePath = normalizeGeneratedImagePath(data.image_path || data.image_url || '');

  if (!imagePath) {
    throw new Error('Image generation response did not include an image URL.');
  }

  return {
    sessionId: data.session_id || data.chat_id || sessionId || '',
    imagePath,
  };
}

export async function sendChat(submission: MDPChatSubmission): Promise<MDPChatResult> {
  const model = submission.model || MAYA_DEFAULT_MODEL;
  const request: MDPChatRequest = {
    llm_type: endpointToMayaLLM(submission.endpoint),
    chat_dto: {
      lang: normalizeMdpLanguage(submission.lang),
      chat_id: submission.sessionId,
      original_prompt: submission.text,
      model_key: model,
      anonymized_prompt: submission.anonymizedPrompt,
      anonymized_values: submission.anonymizedValues,
      detected_values: submission.detectedValues,
      choices: submission.choices,
      doc: submission.docId,
      docs: submission.docIds,
      skill_instructions: submission.skillInstructions,
    },
  };

  const response = await mdpClient.post<MDPChatResponse>(MDP_ENDPOINTS.chat, request);
  const data = response.data;
  const resolvedModel = data.model_key || model;
  const catalogItem = getModelCatalogItem(resolvedModel);
  const modelLabel = catalogItem?.label ?? MAYA_CHAT_MODEL_LABELS[resolvedModel] ?? resolvedModel;
  const responseEndpoint = catalogItem?.endpoint ?? submission.endpoint;
  const responseText = data.replaced_response || data.llm_response || '';

  const now = new Date().toISOString();
  const userMessageId = submission.userMessageId || uuidv4();
  const assistantMessageId = submission.assistantMessageId || uuidv4();

  let conversationId = data.session_id || submission.sessionId || '';
  if (!conversationId) {
    conversationId = uuidv4();
  }
  invalidateSessionsCache();

  const anonymizedPrompt = data.anonymized_prompt || submission.anonymizedPrompt || submission.text;

  const userMessage: TMessage = {
    messageId: userMessageId,
    conversationId,
    parentMessageId: submission.parentMessageId ?? '00000000-0000-0000-0000-000000000000',
    responseMessageId: assistantMessageId,
    sender: 'User',
    text: submission.displayText ?? submission.text,
    isCreatedByUser: true,
    files: submission.files,
    // manualSkills: submission.manualSkills,
    // savedPrompt: submission.savedPrompt
    //   ? { groupId: submission.savedPrompt.groupId, name: submission.savedPrompt.name }
    //   : undefined,
    createdAt: now,
    updatedAt: now,
    metadata: anonymizedPrompt ? { anonymizedPrompt } : undefined,
  };

  // const citationData = data.citations?.filter(Boolean) ?? [];
  // const artifactData = data.artifacts?.filter(Boolean) ?? [];
  // const activityData = data.activity?.filter(Boolean) ?? [];
  // const metadata = {
  //   ...(citationData.length > 0 ? { citations: citationData } : {}),
  //   ...(activityData.length > 0 ? { activity: activityData } : {}),
  //   ...(artifactData.length > 0 ? { artifacts: artifactData } : {}),
  //   ...(data.workflow ? { workflow: data.workflow } : {}),
  // };
  const assistantMessage: TMessage = {
    messageId: assistantMessageId,
    conversationId,
    parentMessageId: userMessageId,
    sender: modelLabel,
    text: formatMayaAssistantText({
      responseText,
    }),
    isCreatedByUser: false,
    createdAt: now,
    updatedAt: now,
    endpoint: responseEndpoint || undefined,
    iconURL: responseEndpoint || undefined,
    model: resolvedModel,
    // manualSkills: submission.manualSkills,
    // savedPrompt: submission.savedPrompt
    //   ? { groupId: submission.savedPrompt.groupId, name: submission.savedPrompt.name }
    //   : undefined,
    // metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };

  return {
    sessionId: conversationId,
    userMessage,
    assistantMessage,
    rawResponse: data,
  };
}

function normalizeTranscriptionText(data: unknown): string {
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

export async function transcribeAudio(audioBlob: Blob, lang?: string): Promise<string> {
  const response = await mdpClient.post<unknown>(MDP_ENDPOINTS.voice, audioBlob, {
    headers: {
      'Content-Type': audioBlob.type || 'application/octet-stream',
      lang: normalizeMdpLanguage(lang),
    },
  });
  const text = normalizeTranscriptionText(response.data);
  if (!text) {
    throw new Error('Audio transcription failed');
  }
  return text;
}
