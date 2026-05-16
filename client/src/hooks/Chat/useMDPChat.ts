import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys, Constants, EModelEndpoint } from 'librechat-data-provider';
import { useSetRecoilState } from 'recoil';
import { sendChat } from '~/services/mdp';
import store from '~/store';

import type { TSubmission, TMessage, TConversation, ConversationListResponse } from 'librechat-data-provider';

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

export default function useMDPChat(
  submission: TSubmission | null,
  chatHelpers: MDPChatHelpers,
  index = 0,
) {
  const queryClient = useQueryClient();
  const setLatestMessage = useSetRecoilState(store.latestMessageFamily(index));
  const processingRef = useRef(false);

  useEffect(() => {
    if (!submission || processingRef.current) {
      return;
    }

    processingRef.current = true;
    const { setMessages, getMessages, setConversation, setIsSubmitting } = chatHelpers;

    const processChat = async () => {
      setIsSubmitting(true);

      const userText =
        submission.userMessage?.text ??
        (submission as Record<string, unknown>).text as string ??
        '';
      const sessionId = submission.conversation?.conversationId ?? undefined;

      try {
        const result = await sendChat({
          text: userText,
          sessionId: sessionId === Constants.NEW_CONVO ? undefined : sessionId,
        });

        const existingMessages = getMessages() ?? [];
        const updatedMessages = [...existingMessages, result.userMessage];
        setMessages(updatedMessages);

        const assistantMsg = { ...result.assistantMessage, text: '' };
        setMessages([...updatedMessages, assistantMsg]);

        const fullText = result.assistantMessage.text;
        let charIndex = 0;

        await new Promise<void>((resolve) => {
          const animate = () => {
            charIndex = Math.min(charIndex + CHARS_PER_TICK, fullText.length);
            const partialMsg = { ...result.assistantMessage, text: fullText.slice(0, charIndex) };
            setMessages([...updatedMessages, partialMsg]);
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
          title: userText.slice(0, 50) || 'New Chat',
          endpoint: EModelEndpoint.openAI,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setConversation(convo);

        queryClient.invalidateQueries({ queryKey: [QueryKeys.allConversations] });
      } catch (error) {
        const errorMsg: TMessage = {
          messageId: crypto.randomUUID(),
          conversationId: sessionId ?? Constants.NEW_CONVO,
          parentMessageId: '00000000-0000-0000-0000-000000000000',
          sender: 'Maya AI',
          text: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`,
          isCreatedByUser: false,
          error: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const existingMessages = getMessages() ?? [];
        setMessages([...existingMessages, errorMsg]);
      } finally {
        setIsSubmitting(false);
        processingRef.current = false;
      }
    };

    processChat();
  }, [submission, chatHelpers, queryClient, setLatestMessage]);
}
