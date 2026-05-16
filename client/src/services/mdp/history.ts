import { v4 as uuidv4 } from 'uuid';
import { EModelEndpoint } from 'librechat-data-provider';
import { mdpClient } from './client';
import { MDP_ENDPOINTS } from './endpoints';

import type { TConversation, TMessage } from 'librechat-data-provider';
import type { MDPHistorySession, MDPPromptData } from './types';

export async function listSessions(): Promise<TConversation[]> {
  const response = await mdpClient.get<MDPHistorySession[]>(MDP_ENDPOINTS.history);
  const sessions = Array.isArray(response.data) ? response.data : [];

  return sessions.map((session) => ({
    conversationId: session.session_id,
    title: session.session_name || 'New Chat',
    endpoint: EModelEndpoint.openAI,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  }));
}

export async function getSessionMessages(sessionId: string): Promise<TMessage[]> {
  const response = await mdpClient.get<MDPPromptData[]>(MDP_ENDPOINTS.history, {
    params: { chat_id: sessionId },
  });
  const prompts = Array.isArray(response.data) ? response.data : [];

  const messages: TMessage[] = [];
  let prevMessageId = '00000000-0000-0000-0000-000000000000';

  for (const prompt of prompts) {
    const userMessageId = uuidv4();
    const assistantMessageId = uuidv4();

    messages.push({
      messageId: userMessageId,
      conversationId: sessionId,
      parentMessageId: prevMessageId,
      responseMessageId: assistantMessageId,
      sender: 'User',
      text: prompt.original_prompt,
      isCreatedByUser: true,
      createdAt: prompt.created_at,
      updatedAt: prompt.created_at,
    });

    messages.push({
      messageId: assistantMessageId,
      conversationId: sessionId,
      parentMessageId: userMessageId,
      sender: 'Maya AI',
      text: prompt.replaced_response || prompt.llm_response,
      isCreatedByUser: false,
      createdAt: prompt.created_at,
      updatedAt: prompt.created_at,
      model: 'openai',
    });

    prevMessageId = assistantMessageId;
  }

  return messages;
}
