import { v4 as uuidv4 } from 'uuid';
import { mdpClient } from './client';
import { MDP_ENDPOINTS } from './endpoints';
import { endpointToMayaLLM, MAYA_DEFAULT_MODEL } from './modelConfig';
import { formatMayaAssistantText } from './format';
import { invalidateSessionsCache } from './history';

import type { TMessage } from 'librechat-data-provider';
import type { MDPChatRequest, MDPChatResponse } from './types';

export interface MDPChatSubmission {
  text: string;
  sessionId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  parentMessageId?: string | null;
  lang?: string;
  anonymizedPrompt?: string;
  anonymizedValues?: Record<string, string>;
  detectedValues?: Record<string, string[]>;
  choices?: string[];
  docId?: string;
  docIds?: string[];
  files?: TMessage['files'];
  endpoint?: string | null;
  model?: string | null;
}

export interface MDPChatResult {
  sessionId: string;
  userMessage: TMessage;
  assistantMessage: TMessage;
  rawResponse: MDPChatResponse;
}

export { formatMayaAssistantText } from './format';

export async function sendChat(submission: MDPChatSubmission): Promise<MDPChatResult> {
  const model = submission.model || MAYA_DEFAULT_MODEL;
  const request: MDPChatRequest = {
    llm_type: endpointToMayaLLM(submission.endpoint),
    chat_dto: {
      lang: submission.lang || 'eng',
      chat_id: submission.sessionId,
      original_prompt: submission.text,
      anonymized_prompt: submission.anonymizedPrompt,
      anonymized_values: submission.anonymizedValues,
      detected_values: submission.detectedValues,
      choices: submission.choices,
      doc: submission.docId,
      docs: submission.docIds,
    },
  };

  const response = await mdpClient.post<MDPChatResponse>(MDP_ENDPOINTS.chat, request);
  const data = response.data;
  const modelLabel = model === MAYA_DEFAULT_MODEL ? 'GPT-4o' : model;
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
    text: submission.text,
    isCreatedByUser: true,
    files: submission.files,
    createdAt: now,
    updatedAt: now,
    metadata: anonymizedPrompt ? { anonymizedPrompt } : undefined,
  };

  const citationData = data.citations?.filter(Boolean) ?? [];
  const assistantMessage: TMessage = {
    messageId: assistantMessageId,
    conversationId,
    parentMessageId: userMessageId,
    sender: modelLabel,
    text: formatMayaAssistantText({
      responseText,
      modelLabel,
    }),
    isCreatedByUser: false,
    createdAt: now,
    updatedAt: now,
    endpoint: submission.endpoint || undefined,
    iconURL: submission.endpoint || undefined,
    model,
    metadata: citationData.length > 0 ? { citations: citationData } : undefined,
  };

  return {
    sessionId: conversationId,
    userMessage,
    assistantMessage,
    rawResponse: data,
  };
}
