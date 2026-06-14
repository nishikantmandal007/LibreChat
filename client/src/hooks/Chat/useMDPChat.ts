import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys, Constants, EModelEndpoint } from 'librechat-data-provider';
import { useNavigate } from 'react-router-dom';
import { useRecoilCallback, useRecoilValue, useSetRecoilState } from 'recoil';
import {
  anonymizeText,
  DEFAULT_PII_CHOICES,
  sendChat,
  generateImage,
  invalidateSessionsCache,
} from '~/services/mdp';
import { getRandomSpinnerVerb } from '~/services/mdp/spinnerVerbs';
import { setConversationModel } from '~/services/mdp/history';
import { getPromptTextOccurrence, rememberMessageFiles } from '~/services/mdp/messageFileCache';
import { normalizeMdpLanguage } from '~/services/mdp/language';
import {
  getModelCatalogItem,
  isImageGenModel,
  MAYA_CHAT_MODEL_LABELS,
  MAYA_DEFAULT_ENDPOINT,
  MAYA_DEFAULT_MODEL,
} from '~/services/mdp/modelConfig';
import { getWorkspaceSkillsByNames } from '~/services/mdp/workspaceStore';
import {
  getMayaPromptOnlyFileText,
  getMayaSafeDocIds,
  getMayaSafeFileState,
} from '~/utils/mayaSafeFiles';
import store, { ephemeralAgentByConvoId } from '~/store';

import type { TSubmission, TMessage, TConversation } from 'librechat-data-provider';

type MDPChatHelpers = {
  setMessages: (messages: TMessage[]) => void;
  getMessages: () => TMessage[] | undefined;
  setConversation: (convo: TConversation) => void;
  setIsSubmitting: (val: boolean) => void;
  newConversation: (params?: { template?: Partial<TConversation> }) => void;
  resetLatestMessage: () => void;
};

const CHARS_PER_TICK = 8;
const TICK_MS = 20;
const NO_PARENT = '00000000-0000-0000-0000-000000000000';
const DOCUMENT_EXPORT_SKILL = {
  name: 'document_create',
  description: 'Create privacy-safe Markdown and downloadable document artifacts.',
  body: 'When this skill is selected, write the response as a polished Markdown document with a clear title, section headings, concise paragraphs, and practical structure. Prefer document-ready wording over casual chat prose. The backend will materialize downloadable safe artifacts from the anonymized response.',
};

const SPINNER_INTERVAL_MS = 3000;

function getDisplayModelName(model?: string | null, fallback?: string | null): string {
  const label = fallback || (model ? MAYA_CHAT_MODEL_LABELS[model] : undefined);
  if (label) {
    return label;
  }
  if (model === MAYA_DEFAULT_MODEL || !model) {
    return MAYA_CHAT_MODEL_LABELS[MAYA_DEFAULT_MODEL] ?? 'GPT-4o';
  }
  return model;
}

function normalizeAnonymizedValues(
  values?: Record<string, string | string[]>,
): Record<string, string[]> | undefined {
  if (!values) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, Array.isArray(value) ? value : [value]]),
  );
}

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
  const recoilImageGenEnabled = useRecoilValue(store.imageGenEnabled);
  const isDocumentExport = useRecoilValue(store.documentExportEnabled);
  const setImageGenPendingUrl = useSetRecoilState(store.imageGenPendingUrl);
  const mdpLanguage = normalizeMdpLanguage(useRecoilValue(store.mdpAnonymizationLanguage));
  const processingRef = useRef(false);
  const lastSubmissionIdRef = useRef<string | null>(null);
  const drainPendingManualSkills = useRecoilCallback(
    ({ snapshot, reset }) =>
      (conversationId: string): string[] => {
        const atom = store.pendingManualSkillsByConvoId(conversationId);
        const loadable = snapshot.getLoadable(atom);
        const skills = loadable.state === 'hasValue' ? (loadable.contents as string[]) : [];
        if (skills.length > 0) {
          reset(atom);
        }
        return skills;
      },
    [],
  );
  const getWebSearchEnabled = useRecoilCallback(
    ({ snapshot }) =>
      (conversationId: string): boolean => {
        const loadable = snapshot.getLoadable(ephemeralAgentByConvoId(conversationId));
        const agent = loadable.state === 'hasValue' ? loadable.contents : null;
        return Boolean(agent?.web_search);
      },
    [],
  );

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
    const submittedFiles = submission.userMessage?.files;
    const promptOnlyFileText = getMayaPromptOnlyFileText(submittedFiles);
    const effectiveText = [trimmedText, promptOnlyFileText].filter(Boolean).join('\n\n').trim();

    if (!effectiveText || !userMessageId || lastSubmissionIdRef.current === userMessageId) {
      return;
    }

    processingRef.current = true;
    lastSubmissionIdRef.current = userMessageId;

    const processChat = async () => {
      setIsSubmitting(true);

      const isTemporaryChat = !!(submission as Record<string, unknown>).isTemporary;
      const sessionId = submission.conversation?.conversationId ?? undefined;
      const normalizedSessionId = sessionId === Constants.NEW_CONVO ? undefined : sessionId;
      const assistantMessageId =
        submission.initialResponse?.messageId ||
        submission.userMessage?.responseMessageId ||
        crypto.randomUUID();
      const promptTextOccurrence = getPromptTextOccurrence(submission.messages, trimmedText) + 1;
      const conversationFiles =
        submission.messages?.flatMap((message) => message.files ?? []) ?? [];
      const docIds = getMayaSafeDocIds([...conversationFiles, ...(submittedFiles ?? [])]);
      const selectedEndpoint =
        submission.conversation?.endpoint ??
        submission.endpointOption?.endpoint ??
        MAYA_DEFAULT_ENDPOINT;
      const selectedModel =
        submission.conversation?.model ?? submission.endpointOption?.model ?? MAYA_DEFAULT_MODEL;
      const isImageGen = recoilImageGenEnabled || isImageGenModel(selectedModel);
      const provisionalConversationId = normalizedSessionId || sessionId || Constants.NEW_CONVO;
      const webSearchEnabled = !isImageGen && getWebSearchEnabled(provisionalConversationId);
      const pendingActivityText = isImageGen ? '' : `*${getRandomSpinnerVerb()}*`;
      let pendingManualSkills: string[] = [];
      if (
        !isImageGen &&
        !submission.manualSkills?.length &&
        !submission.userMessage?.manualSkills?.length
      ) {
        pendingManualSkills = drainPendingManualSkills(provisionalConversationId);
      }
      const manualSkills = isImageGen
        ? []
        : Array.from(
            new Set([
              ...(submission.manualSkills ?? submission.userMessage?.manualSkills ?? []),
              ...pendingManualSkills,
              ...(isDocumentExport ? [DOCUMENT_EXPORT_SKILL.name] : []),
            ]),
          );
      const savedPrompt = submission.savedPrompt ?? submission.userMessage?.savedPrompt;
      const workspaceSkillInstructions =
        manualSkills.length > 0
          ? getWorkspaceSkillsByNames(
              manualSkills.filter((skillName) => skillName !== DOCUMENT_EXPORT_SKILL.name),
            ).map((skill) => ({
              name: skill.name,
              description: skill.description,
              body: skill.body,
            }))
          : [];
      const skillInstructions = [
        ...workspaceSkillInstructions,
        ...(manualSkills.includes(DOCUMENT_EXPORT_SKILL.name) ? [DOCUMENT_EXPORT_SKILL] : []),
      ];
      const chatEndpoint = isImageGen ? MAYA_DEFAULT_ENDPOINT : selectedEndpoint;
      const chatModel = isImageGen ? MAYA_DEFAULT_MODEL : selectedModel;
      const chatModelLabel = isImageGen
        ? undefined
        : (submission.conversation?.modelLabel ?? submission.endpointOption?.modelLabel);
      const assistantSender = getDisplayModelName(chatModel, chatModelLabel);
      const blockedSafeFile = submittedFiles?.find((file) => {
        const safeFile = getMayaSafeFileState(file);
        return safeFile && safeFile.status !== 'ready';
      });

      let spinnerInterval: ReturnType<typeof setInterval> | undefined;
      try {
        const pendingNow = new Date().toISOString();
        const assistantParentId = submission.isRegenerate
          ? (submission.initialResponse?.parentMessageId ?? userMessageId)
          : userMessageId;
        const regenSourceMsg = submission.isRegenerate
          ? (getMessages() ?? []).find(m => m.messageId === assistantParentId)
          : undefined;
        const pendingUserMessage: TMessage = regenSourceMsg ?? {
          ...submission.userMessage,
          messageId: userMessageId,
          conversationId: provisionalConversationId,
          parentMessageId: submission.userMessage?.parentMessageId ?? NO_PARENT,
          responseMessageId: assistantMessageId,
          sender: 'User',
          text: trimmedText,
          isCreatedByUser: true,
          files: submittedFiles,
          manualSkills: manualSkills.length > 0 ? manualSkills : undefined,
          savedPrompt,
          createdAt: pendingNow,
          updatedAt: pendingNow,
        };
        const pendingAssistantMessage: TMessage = {
          ...submission.initialResponse,
          messageId: assistantMessageId,
          conversationId: provisionalConversationId,
          parentMessageId: assistantParentId,
          sender: '',
          text: pendingActivityText,
          isCreatedByUser: false,
          createdAt: pendingNow,
          updatedAt: pendingNow,
          content: undefined,
          unfinished: false,
          endpoint: chatEndpoint,
          iconURL: chatEndpoint,
          model: chatModel,
          manualSkills: manualSkills.length > 0 ? manualSkills : undefined,
          savedPrompt,
        };
        const pendingMessages = upsertMessages(
          getMessages() ?? [],
          pendingUserMessage,
          pendingAssistantMessage,
        );
        setMessages(pendingMessages);
        queryClient.setQueryData<TMessage[]>(
          [QueryKeys.messages, provisionalConversationId],
          pendingMessages,
        );
        setLatestMessage(pendingAssistantMessage);

        if (blockedSafeFile) {
          throw new Error('Wait for the anonymized safe copy before sending this file to chat.');
        }

        if (!isImageGen) {
          spinnerInterval = setInterval(() => {
            const verb = getRandomSpinnerVerb();
            const updatedMsg: TMessage = { ...pendingAssistantMessage, text: `*${verb}*` };
            const msgs = getMessages() ?? [];
            const updated = msgs.map((m) =>
              m.messageId === assistantMessageId ? updatedMsg : m,
            );
            setMessages(updated);
            queryClient.setQueryData<TMessage[]>(
              [QueryKeys.messages, provisionalConversationId],
              updated,
            );
            setLatestMessage(updatedMsg);
          }, SPINNER_INTERVAL_MS);
        }

        if (isImageGen) {
          setImageGenPendingUrl('loading');
          const imgResult = await generateImage(effectiveText, normalizedSessionId);
          const conversationId = imgResult.sessionId || normalizedSessionId || crypto.randomUUID();
          const now = new Date().toISOString();

          const userMessage: TMessage = {
            ...submission.userMessage,
            messageId: userMessageId,
            conversationId,
            parentMessageId: submission.userMessage?.parentMessageId ?? NO_PARENT,
            responseMessageId: assistantMessageId,
            sender: 'User',
            text: trimmedText,
            isCreatedByUser: true,
            files: submittedFiles,
            manualSkills: manualSkills.length > 0 ? manualSkills : undefined,
            savedPrompt,
            createdAt: now,
            updatedAt: now,
          };

          const assistantMessage: TMessage = {
            ...submission.initialResponse,
            messageId: assistantMessageId,
            conversationId,
            parentMessageId: userMessageId,
            sender: '',
            text: `![Generated Image](${imgResult.imagePath})`,
            isCreatedByUser: false,
            createdAt: now,
            updatedAt: now,
            content: undefined,
            unfinished: false,
            endpoint: chatEndpoint,
            iconURL: chatEndpoint,
            model: chatModel,
            manualSkills: manualSkills.length > 0 ? manualSkills : undefined,
            savedPrompt,
          };

          setImageGenPendingUrl(imgResult.imagePath);

          const existingMessages = getMessages() ?? [];
          const finalMessages = upsertMessages(existingMessages, userMessage, assistantMessage);
          setMessages(finalMessages);
          queryClient.setQueryData<TMessage[]>([QueryKeys.messages, conversationId], finalMessages);
          setLatestMessage(assistantMessage);

          setTimeout(() => setImageGenPendingUrl(null), 600);

          const convo: TConversation = {
            conversationId,
            title: trimmedText.slice(0, 50) || 'Image Generation',
            endpoint: chatEndpoint as EModelEndpoint,
            model: chatModel,
            createdAt: now,
            updatedAt: now,
            ...(isTemporaryChat ? { expiredAt: now } : {}),
          };
          setConversation(convo);
          queryClient.setQueryData([QueryKeys.conversation, conversationId], convo);

          if (!isTemporaryChat) {
            invalidateSessionsCache();
            queryClient.invalidateQueries({ queryKey: [QueryKeys.allConversations] });
            if (!normalizedSessionId && conversationId) {
              navigate(`/c/${conversationId}`, { replace: true, state: { focusChat: true } });
            }
          }

          setIsSubmitting(false);
          processingRef.current = false;
          return;
        }

        const anonymized = normalizedSessionId
          ? await anonymizeText(effectiveText, DEFAULT_PII_CHOICES, mdpLanguage, {
              privacyContextId: normalizedSessionId,
            })
          : await anonymizeText(effectiveText, DEFAULT_PII_CHOICES, mdpLanguage);
        const result = await sendChat({
          text: effectiveText,
          displayText: trimmedText,
          sessionId: normalizedSessionId,
          lang: mdpLanguage,
          userMessageId,
          assistantMessageId,
          parentMessageId: submission.userMessage?.parentMessageId ?? NO_PARENT,
          anonymizedPrompt: anonymized.anonymized_prompt,
          anonymizedValues: normalizeAnonymizedValues(anonymized.anonymized_values),
          detectedValues: anonymized.detected_values,
          choices: DEFAULT_PII_CHOICES,
          docId: docIds[0],
          docIds: docIds.length > 0 ? docIds : undefined,
          manualSkills: manualSkills.length > 0 ? manualSkills : undefined,
          skillInstructions: skillInstructions.length > 0 ? skillInstructions : undefined,
          savedPrompt: savedPrompt ? { ...savedPrompt, prompt: effectiveText } : undefined,
          files: submittedFiles,
          endpoint: chatEndpoint,
          model: chatModel,
          webSearchEnabled,
        });

        if (spinnerInterval) {
          clearInterval(spinnerInterval);
          spinnerInterval = undefined;
        }

        const userMessage: TMessage = regenSourceMsg ?? {
          ...submission.userMessage,
          ...result.userMessage,
          files: submittedFiles,
          conversationId: result.sessionId,
          responseMessageId: assistantMessageId,
          manualSkills: manualSkills.length > 0 ? manualSkills : undefined,
          savedPrompt,
        };
        if (submittedFiles?.length && !submission.isRegenerate) {
          const cacheTextKeys = Array.from(
            new Set(
              [trimmedText, effectiveText, anonymized.anonymized_prompt]
                .map((value) => value?.trim())
                .filter((value): value is string => Boolean(value)),
            ),
          );
          await Promise.all(
            cacheTextKeys.map((textKey) =>
              rememberMessageFiles({
                conversationId: result.sessionId,
                messageId: userMessageId,
                text: textKey,
                textOccurrence: textKey === trimmedText ? promptTextOccurrence : undefined,
                files: submittedFiles,
              }),
            ),
          );
        }
        const assistantMessage: TMessage = {
          ...submission.initialResponse,
          ...result.assistantMessage,
          messageId: assistantMessageId,
          parentMessageId: assistantParentId,
          conversationId: result.sessionId,
          content: undefined,
          unfinished: false,
          manualSkills: manualSkills.length > 0 ? manualSkills : undefined,
          savedPrompt,
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
        setIsSubmitting(false);

        const fullText = assistantMessage.text ?? '';
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

        const resolvedModel = result.rawResponse.model_key || chatModel;
        const resolvedCatalog = getModelCatalogItem(resolvedModel);
        const resolvedEndpoint = (resolvedCatalog?.endpoint ?? chatEndpoint) as EModelEndpoint;
        const resolvedLabel = resolvedCatalog?.label ?? chatModelLabel;

        const convo: TConversation = {
          conversationId: result.sessionId,
          title: trimmedText.slice(0, 50) || 'New Chat',
          endpoint: resolvedEndpoint,
          model: resolvedModel,
          modelLabel: resolvedLabel,
          spec: submission.conversation?.spec ?? submission.endpointOption?.spec,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...(isTemporaryChat ? { expiredAt: new Date().toISOString() } : {}),
        };
        setConversation(convo);
        queryClient.setQueryData([QueryKeys.conversation, result.sessionId], convo);
        setConversationModel(
          result.sessionId,
          resolvedModel,
          resolvedEndpoint,
          resolvedLabel ?? resolvedModel,
        );

        if (!isTemporaryChat) {
          invalidateSessionsCache();
          queryClient.invalidateQueries({ queryKey: [QueryKeys.allConversations] });
          if (!normalizedSessionId && result.sessionId) {
            navigate(`/c/${result.sessionId}`, { replace: true, state: { focusChat: true } });
          }
        }
      } catch (error) {
        const errorMsg: TMessage = {
          messageId: assistantMessageId,
          conversationId: sessionId ?? Constants.NEW_CONVO,
          parentMessageId: userMessageId,
          sender: assistantSender,
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
        if (spinnerInterval) {
          clearInterval(spinnerInterval);
        }
        setImageGenPendingUrl(null);
        setIsSubmitting(false);
        processingRef.current = false;
      }
    };

    processChat();
  }, [
    submission,
    chatHelpers,
    queryClient,
    setLatestMessage,
    navigate,
    recoilImageGenEnabled,
    isDocumentExport,
    mdpLanguage,
    drainPendingManualSkills,
    getWebSearchEnabled,
  ]);
}
