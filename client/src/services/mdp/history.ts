import { v4 as uuidv4 } from 'uuid';
import { mdpClient } from './client';
import { MDP_ENDPOINTS } from './endpoints';
import {
  getModelCatalogItem,
  IMAGE_GEN_MODEL_KEY,
  MAYA_CHAT_MODEL_LABELS,
  MAYA_DEFAULT_ENDPOINT,
  MAYA_DEFAULT_MODEL,
} from './modelConfig';
import { formatMayaAssistantText } from './format';
import { getCachedMessageFilesAsync } from './messageFileCache';

import type { EModelEndpoint, TConversation, TMessage } from 'librechat-data-provider';
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

const CONV_MODEL_STORAGE_KEY = 'mdp_conversation_models';

function loadModelCache(): Map<string, { model: string; endpoint: EModelEndpoint; label: string }> {
  const map = new Map<string, { model: string; endpoint: EModelEndpoint; label: string }>();
  try {
    const raw = localStorage.getItem(CONV_MODEL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, { model: string; endpoint: string; label: string }>;
      for (const [k, v] of Object.entries(parsed)) {
        map.set(k, { model: v.model, endpoint: v.endpoint as EModelEndpoint, label: v.label });
      }
    }
  } catch { /* ignore */ }
  return map;
}

function persistModelCache(): void {
  try {
    const obj: Record<string, { model: string; endpoint: string; label: string }> = {};
    for (const [k, v] of conversationModelCache.entries()) {
      obj[k] = { model: v.model, endpoint: v.endpoint, label: v.label };
    }
    localStorage.setItem(CONV_MODEL_STORAGE_KEY, JSON.stringify(obj));
  } catch { /* ignore */ }
}

const conversationModelCache = loadModelCache();

export function setConversationModel(
  conversationId: string,
  model: string,
  endpoint: EModelEndpoint | string,
  label: string,
): void {
  conversationModelCache.set(conversationId, { model, endpoint: endpoint as EModelEndpoint, label });
  persistModelCache();
}

export function toConversation(session: MDPHistorySession): TConversation {
  const now = new Date().toISOString();
  const cached = conversationModelCache.get(session.session_id);
  const catalogItem = cached ? undefined : getModelCatalogItem(MAYA_DEFAULT_MODEL);
  return {
    conversationId: session.session_id,
    title: session.session_name || session.chat_title || 'New Chat',
    endpoint: cached?.endpoint ?? MAYA_DEFAULT_ENDPOINT,
    model: cached?.model ?? MAYA_DEFAULT_MODEL,
    modelLabel: cached?.label ?? catalogItem?.label ?? 'GPT-4o',
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
  const cached = conversationModelCache.get(sessionId);

  if (session) {
    if (cached) {
      return { ...session, model: cached.model, endpoint: cached.endpoint, modelLabel: cached.label };
    }
    return session;
  }

  const catalogItem = cached ? undefined : getModelCatalogItem(MAYA_DEFAULT_MODEL);
  const now = new Date().toISOString();
  return {
    conversationId: sessionId,
    title: 'New Chat',
    endpoint: cached?.endpoint ?? MAYA_DEFAULT_ENDPOINT,
    model: cached?.model ?? MAYA_DEFAULT_MODEL,
    modelLabel: cached?.label ?? catalogItem?.label ?? 'GPT-4o',
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
  let prevUserText: string | null = null;
  let prevUserMessageId: string | null = null;
  const promptOccurrences = new Map<string, number>();

  for (const prompt of prompts) {
    const promptRecord = asRecord(prompt);
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
    /**
     * Image-gen results are persisted by the backend under a chat model_key, but the
     * UI must treat them as the image-gen model so the thread stays borderless, keeps
     * the download action, and shows the "Image Generation" label on every flow
     * (fresh generation and reload from history).
     */
    const isImageResponse = promptRecord.responseType === 'img' || prompt.responseType === 'img';
    const promptModelKey = isImageResponse
      ? IMAGE_GEN_MODEL_KEY
      : firstString(prompt.model_key, promptRecord.model_key as string) || MAYA_DEFAULT_MODEL;
    const promptCatalogItem = getModelCatalogItem(promptModelKey);
    const modelLabel = promptCatalogItem?.label ?? MAYA_CHAT_MODEL_LABELS[promptModelKey] ?? promptModelKey;
    const messageEndpoint = (promptCatalogItem?.endpoint ?? MAYA_DEFAULT_ENDPOINT) as EModelEndpoint;
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

    const isRegeneration = prevUserText !== null && userText.trim() === prevUserText.trim();

    let userMessageId: string;
    if (isRegeneration && prevUserMessageId) {
      userMessageId = prevUserMessageId;
    } else {
      userMessageId = uuidv4();
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
    }

    messages.push({
      messageId: assistantMessageId,
      conversationId: sessionId,
      parentMessageId: userMessageId,
      sender: modelLabel,
      text: isImageResponse
        ? `![Generated Image](${assistantText})`
        : formatMayaAssistantText({
            responseText: assistantText,
            modelLabel,
          }),
      isCreatedByUser: false,
      createdAt,
      updatedAt: createdAt,
      endpoint: messageEndpoint,
      iconURL: messageEndpoint,
      model: promptModelKey,
      metadata: citations.length > 0 ? { citations } : undefined,
    });

    prevMessageId = assistantMessageId;
    prevUserText = userText;
    prevUserMessageId = userMessageId;
  }

  if (prompts.length > 0) {
    const lastPrompt = prompts[prompts.length - 1];
    const lastRecord = asRecord(lastPrompt);
    const lastIsImage = lastRecord.responseType === 'img' || lastPrompt.responseType === 'img';
    const lastModelKey = lastIsImage
      ? IMAGE_GEN_MODEL_KEY
      : firstString(lastPrompt.model_key, lastRecord.model_key as string) || MAYA_DEFAULT_MODEL;
    const lastCatalog = getModelCatalogItem(lastModelKey);
    setConversationModel(
      sessionId,
      lastModelKey,
      lastCatalog?.endpoint ?? MAYA_DEFAULT_ENDPOINT,
      lastCatalog?.label ?? MAYA_CHAT_MODEL_LABELS[lastModelKey] ?? lastModelKey,
    );
  }

  return messages;
}
