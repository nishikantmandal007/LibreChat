import { v4 as uuidv4 } from 'uuid';
import { mdpClient } from './client';
import { MDP_ENDPOINTS } from './endpoints';

import type { TMessage } from 'librechat-data-provider';
import type { MDPChatRequest, MDPChatResponse } from './types';

export interface MDPChatSubmission {
  text: string;
  sessionId?: string;
  lang?: string;
  anonymizedPrompt?: string;
  anonymizedValues?: Record<string, string>;
  detectedValues?: Record<string, string[]>;
  choices?: string[];
  docId?: string;
}

export interface MDPChatResult {
  sessionId: string;
  userMessage: TMessage;
  assistantMessage: TMessage;
  rawResponse: MDPChatResponse;
}

export async function sendChat(submission: MDPChatSubmission): Promise<MDPChatResult> {
  const request: MDPChatRequest = {
    llm_type: 'openai',
    chat_dto: {
      lang: submission.lang || 'eng',
      chat_id: submission.sessionId,
      original_prompt: submission.text,
      anonymized_prompt: submission.anonymizedPrompt,
      anonymized_values: submission.anonymizedValues,
      detected_values: submission.detectedValues,
      choices: submission.choices,
      doc: submission.docId,
    },
  };

  const response = await mdpClient.post<MDPChatResponse>(MDP_ENDPOINTS.chat, request);
  const data = response.data;

  const now = new Date().toISOString();
  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();

  const userMessage: TMessage = {
    messageId: userMessageId,
    conversationId: data.session_id,
    parentMessageId: '00000000-0000-0000-0000-000000000000',
    responseMessageId: assistantMessageId,
    sender: 'User',
    text: submission.text,
    isCreatedByUser: true,
    createdAt: now,
    updatedAt: now,
  };

  const assistantMessage: TMessage = {
    messageId: assistantMessageId,
    conversationId: data.session_id,
    parentMessageId: userMessageId,
    sender: 'Maya AI',
    text: data.replaced_response || data.llm_response,
    isCreatedByUser: false,
    createdAt: now,
    updatedAt: now,
    model: 'openai',
  };

  return {
    sessionId: data.session_id,
    userMessage,
    assistantMessage,
    rawResponse: data,
  };
}
