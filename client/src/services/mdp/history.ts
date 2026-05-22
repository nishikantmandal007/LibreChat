import { v4 as uuidv4 } from 'uuid';
import { mdpClient } from './client';
import { MDP_ENDPOINTS } from './endpoints';
import { MAYA_DEFAULT_ENDPOINT, MAYA_DEFAULT_MODEL } from './modelConfig';
import { formatMayaAssistantText } from './format';
import { getCachedMessageFilesAsync } from './messageFileCache';

import type { TConversation, TMessage } from 'librechat-data-provider';
import type { MDPHistorySession, MDPPromptData } from './types';

function asArray<T>(value: unknown, keys: string[] = []): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(record[key])) {
        return record[key] as T[];
      }
    }
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return {};
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return '';
}

function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function firstRecordArray(...values: unknown[]): Record<string, unknown>[] {
  for (const value of values) {
    const records = parseArray(value).filter(isRecord);
    if (records.length > 0) {
      return records;
    }
  }
  return [];
}

export function toConversation(session: MDPHistorySession): TConversation {
  const now = new Date().toISOString();
  return {
    conversationId: session.session_id,
    title: session.session_name || session.chat_title || 'New Chat',
    endpoint: MAYA_DEFAULT_ENDPOINT,
    model: MAYA_DEFAULT_MODEL,
    modelLabel: 'GPT-4o',
    createdAt: session.created_at || now,
    updatedAt: session.updated_at || now,
  };
}

export async function listSessions(): Promise<TConversation[]> {
  const response = await mdpClient.get<unknown>(MDP_ENDPOINTS.history);
  const sessions = asArray<MDPHistorySession>(response.data, [
    'sessions',
    'history',
    'conversations',
  ]);

  return sessions.map(toConversation);
}

let sessionsCache: { data: TConversation[]; ts: number } | null = null;
const SESSIONS_TTL_MS = 5000;

async function cachedListSessions(): Promise<TConversation[]> {
  if (sessionsCache && Date.now() - sessionsCache.ts < SESSIONS_TTL_MS) {
    return sessionsCache.data;
  }
  const data = await listSessions();
  sessionsCache = { data, ts: Date.now() };
  return data;
}

export function invalidateSessionsCache(): void {
  sessionsCache = null;
}

export async function getSessionConversation(sessionId: string): Promise<TConversation> {
  const sessions = await cachedListSessions();
  const session = sessions.find((convo) => convo.conversationId === sessionId);
  if (session) {
    return session;
  }

  const now = new Date().toISOString();
  return {
    conversationId: sessionId,
    title: 'New Chat',
    endpoint: MAYA_DEFAULT_ENDPOINT,
    model: MAYA_DEFAULT_MODEL,
    modelLabel: 'GPT-4o',
    createdAt: now,
    updatedAt: now,
  };
}

export async function getSessionMessages(sessionId: string): Promise<TMessage[]> {
  const response = await mdpClient.get<unknown>(
    `${MDP_ENDPOINTS.history}/${encodeURIComponent(sessionId)}`,
  );
  const prompts = asArray<MDPPromptData>(response.data, ['prompts', 'messages', 'history']);

  const messages: TMessage[] = [];
  let prevMessageId = '00000000-0000-0000-0000-000000000000';
  const promptOccurrences = new Map<string, number>();

  for (const prompt of prompts) {
    const promptRecord = asRecord(prompt);
    const userMessageId = uuidv4();
    const assistantMessageId = uuidv4();
    const createdAt = firstString(
      prompt.created_at,
      promptRecord.createdAt,
      new Date().toISOString(),
    );
    const originalPrompt = firstString(prompt.original_prompt, promptRecord.originalPrompt);
    const anonymizedPrompt = firstString(prompt.anonymized_prompt, promptRecord.anonymizedPrompt);
    const assistantText = firstString(
      prompt.replaced_response,
      prompt.llm_response,
      promptRecord.response,
    );
    const modelLabel = 'GPT-4o';
    const userText = originalPrompt || anonymizedPrompt;
    const promptSentToLLM = anonymizedPrompt || originalPrompt;
    const promptTextKey = userText.trim();
    const textOccurrence = (promptOccurrences.get(promptTextKey) ?? 0) + 1;
    promptOccurrences.set(promptTextKey, textOccurrence);
    const cachedMessageId = firstString(
      promptRecord.messageId,
      promptRecord.message_id,
      promptRecord.userMessageId,
      promptRecord.user_message_id,
    );
    const files = await getCachedMessageFilesAsync({
      conversationId: sessionId,
      messageId: cachedMessageId,
      text: userText,
      textOccurrence,
    });
    const metadataRecord = asRecord(promptRecord.metadata);
    const citations = firstRecordArray(
      promptRecord.citations,
      promptRecord.sources,
      metadataRecord.citations,
      metadataRecord.sources,
    );

    messages.push({
      messageId: userMessageId,
      conversationId: sessionId,
      parentMessageId: prevMessageId,
      responseMessageId: assistantMessageId,
      sender: 'User',
      text: userText,
      isCreatedByUser: true,
      createdAt,
      updatedAt: createdAt,
      files,
      metadata: promptSentToLLM ? { anonymizedPrompt: promptSentToLLM } : undefined,
    });

    messages.push({
      messageId: assistantMessageId,
      conversationId: sessionId,
      parentMessageId: userMessageId,
      sender: modelLabel,
      text: formatMayaAssistantText({
        responseText: assistantText,
        modelLabel,
      }),
      isCreatedByUser: false,
      createdAt,
      updatedAt: createdAt,
      endpoint: MAYA_DEFAULT_ENDPOINT,
      iconURL: MAYA_DEFAULT_ENDPOINT,
      model: MAYA_DEFAULT_MODEL,
      metadata: citations.length > 0 ? { citations } : undefined,
    });

    prevMessageId = assistantMessageId;
  }

  return messages;
}
