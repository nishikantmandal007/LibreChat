import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys, Constants, EModelEndpoint } from 'librechat-data-provider';
import { useNavigate } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';
import {
  anonymizeText,
  DEFAULT_PII_CHOICES,
  sendChat,
  invalidateSessionsCache,
} from '~/services/mdp';
import { getPromptTextOccurrence, rememberMessageFiles } from '~/services/mdp/messageFileCache';
import { MAYA_DEFAULT_ENDPOINT, MAYA_DEFAULT_MODEL } from '~/services/mdp/modelConfig';
import { getMayaSafeDocIds, getMayaSafeFileState } from '~/utils/mayaSafeFiles';
import store from '~/store';

import type { TSubmission, TMessage, TConversation } from 'librechat-data-provider';

type MDPChatHelpers = {
  setMessages: (messages: TMessage[]) => void;
  getMessages: () => TMessage[] | undefined;
  setConversation: (convo: TConversation) => void;
  setIsSubmitting: (val: boolean) => void;
  newConversation: (params?: { template?: Partial<TConversation> }) => void;
  resetLatestMessage: () => void;
};

const CHARS_PER_TICK = 30;
const TICK_MS = 16;
const NO_PARENT = '00000000-0000-0000-0000-000000000000';

function upsertMessages(
  messages: TMessage[],
  userMessage: TMessage,
  assistantMessage: TMessage,
): TMessage[] {
  let foundUser = false;
  let foundAssistant = false;

  const nextMessages = messages.map((message) => {
    if (message.messageId === userMessage.messageId) {
      foundUser = true;
      return userMessage;
    }
    if (message.messageId === assistantMessage.messageId) {
      foundAssistant = true;
      return assistantMessage;
    }
    return message;
  });

  if (!foundUser) {
    nextMessages.push(userMessage);
  }
  if (!foundAssistant) {
    nextMessages.push(assistantMessage);
  }

  return nextMessages;
}

export default function useMDPChat(
  submission: TSubmission | null,
  chatHelpers: MDPChatHelpers,
  index = 0,
) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setLatestMessage = useSetRecoilState(store.latestMessageFamily(index));
  const processingRef = useRef(false);
  const lastSubmissionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!submission || processingRef.current) {
      return;
    }

    const { setMessages, getMessages, setConversation, setIsSubmitting } = chatHelpers;
    const userText =
      submission.userMessage?.text ??
      ((submission as Record<string, unknown>).text as string) ??
      '';
    const trimmedText = userText.trim();
    const userMessageId = submission.userMessage?.messageId;

    if (!trimmedText || !userMessageId || lastSubmissionIdRef.current === userMessageId) {
      return;
    }

    processingRef.current = true;
    lastSubmissionIdRef.current = userMessageId;

    const processChat = async () => {
      setIsSubmitting(true);

      const sessionId = submission.conversation?.conversationId ?? undefined;
      const normalizedSessionId = sessionId === Constants.NEW_CONVO ? undefined : sessionId;
      const assistantMessageId =
        submission.initialResponse?.messageId ||
        submission.userMessage?.responseMessageId ||
        crypto.randomUUID();
      const submittedFiles = submission.userMessage?.files;
      const promptTextOccurrence = getPromptTextOccurrence(submission.messages, trimmedText) + 1;
      const conversationFiles = submission.messages?.flatMap((message) => message.files ?? []) ?? [];
      const docIds = getMayaSafeDocIds([...conversationFiles, ...(submittedFiles ?? [])]);
      const selectedEndpoint =
        submission.conversation?.endpoint ??
        submission.endpointOption?.endpoint ??
        MAYA_DEFAULT_ENDPOINT;
      const selectedModel =
        submission.conversation?.model ?? submission.endpointOption?.model ?? MAYA_DEFAULT_MODEL;
      const blockedSafeFile = submittedFiles?.find((file) => {
        const safeFile = getMayaSafeFileState(file);
        return safeFile && safeFile.status !== 'ready';
      });

      try {
        if (blockedSafeFile) {
          throw new Error('Wait for the anonymized safe copy before sending this file to chat.');
        }
        const anonymized = await anonymizeText(trimmedText, DEFAULT_PII_CHOICES, 'en');
        const result = await sendChat({
          text: trimmedText,
          sessionId: normalizedSessionId,
          userMessageId,
          assistantMessageId,
          parentMessageId: submission.userMessage?.parentMessageId ?? NO_PARENT,
          anonymizedPrompt: anonymized.anonymized_prompt,
          anonymizedValues: anonymized.anonymized_values,
          detectedValues: anonymized.detected_values,
          choices: DEFAULT_PII_CHOICES,
          docId: docIds[0],
          docIds: docIds.length > 0 ? docIds : undefined,
          files: submittedFiles,
          endpoint: selectedEndpoint,
          model: selectedModel,
        });

        const userMessage: TMessage = {
          ...submission.userMessage,
          ...result.userMessage,
          files: submittedFiles,
          conversationId: result.sessionId,
          responseMessageId: assistantMessageId,
        };
        await rememberMessageFiles({
          conversationId: result.sessionId,
          messageId: userMessageId,
          text: trimmedText,
          textOccurrence: promptTextOccurrence,
          files: submittedFiles,
        });
        const assistantMessage: TMessage = {
          ...submission.initialResponse,
          ...result.assistantMessage,
          messageId: assistantMessageId,
          parentMessageId: userMessageId,
          conversationId: result.sessionId,
          content: undefined,
          unfinished: false,
        };

        const existingMessages = getMessages() ?? [];
        const baseMessages = upsertMessages(existingMessages, userMessage, {
          ...assistantMessage,
          text: '',
        });

        const syncMessages = (messages: TMessage[]) => {
          setMessages(messages);
          queryClient.setQueryData<TMessage[]>([QueryKeys.messages, result.sessionId], messages);
        };

        syncMessages(baseMessages);

        const fullText = assistantMessage.text;
        let charIndex = 0;

        await new Promise<void>((resolve) => {
          const animate = () => {
            charIndex = Math.min(charIndex + CHARS_PER_TICK, fullText.length);
            const partialMsg = { ...assistantMessage, text: fullText.slice(0, charIndex) };
            syncMessages(upsertMessages(baseMessages, userMessage, partialMsg));
            setLatestMessage(partialMsg);

            if (charIndex < fullText.length) {
              setTimeout(animate, TICK_MS);
            } else {
              resolve();
            }
          };
          animate();
        });

        const convo: TConversation = {
          conversationId: result.sessionId,
          title: trimmedText.slice(0, 50) || 'New Chat',
          endpoint: selectedEndpoint as EModelEndpoint,
          model: selectedModel,
          modelLabel: submission.conversation?.modelLabel ?? submission.endpointOption?.modelLabel,
          spec: submission.conversation?.spec ?? submission.endpointOption?.spec,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setConversation(convo);
        queryClient.setQueryData([QueryKeys.conversation, result.sessionId], convo);

        invalidateSessionsCache();
        queryClient.invalidateQueries({ queryKey: [QueryKeys.allConversations] });
        if (!normalizedSessionId && result.sessionId) {
          navigate(`/c/${result.sessionId}`, { replace: true, state: { focusChat: true } });
        }
      } catch (error) {
        const errorMsg: TMessage = {
          messageId: assistantMessageId,
          conversationId: sessionId ?? Constants.NEW_CONVO,
          parentMessageId: userMessageId,
          sender: 'Maya AI',
          text: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`,
          isCreatedByUser: false,
          error: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const existingMessages = getMessages() ?? [];
        const nextMessages = existingMessages.some(
          (message) => message.messageId === errorMsg.messageId,
        )
          ? existingMessages.map((message) =>
              message.messageId === errorMsg.messageId ? errorMsg : message,
            )
          : [...existingMessages, errorMsg];
        setMessages(nextMessages);
        setLatestMessage(errorMsg);
      } finally {
        setIsSubmitting(false);
        processingRef.current = false;
      }
    };

    processChat();
  }, [submission, chatHelpers, queryClient, setLatestMessage, navigate]);
}
