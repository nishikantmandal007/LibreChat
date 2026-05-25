import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { Constants } from 'librechat-data-provider';
import { RecoilRoot, type MutableSnapshot } from 'recoil';
import type { TConversation, TMessage, TSubmission } from 'librechat-data-provider';
import useMDPChat from '../useMDPChat';
import { anonymizeText, generateImage, sendChat } from '~/services/mdp';
import { getWorkspaceSkillsByNames } from '~/services/mdp/workspaceStore';
import { rememberMessageFiles } from '~/services/mdp/messageFileCache';
import { getMayaPromptOnlyFileText } from '~/utils/mayaSafeFiles';
import store from '~/store';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('~/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('~/services/mdp', () => ({
  anonymizeText: jest.fn(),
  DEFAULT_PII_CHOICES: ['NAME', 'EMAIL'],
  generateImage: jest.fn(),
  invalidateSessionsCache: jest.fn(),
  sendChat: jest.fn(),
}));

jest.mock('~/services/mdp/messageFileCache', () => ({
  getPromptTextOccurrence: jest.fn(() => 0),
  rememberMessageFiles: jest.fn(() => Promise.resolve()),
}));

jest.mock('~/services/mdp/workspaceStore', () => ({
  getWorkspaceSkillsByNames: jest.fn(() => []),
}));

jest.mock('~/utils/mayaSafeFiles', () => ({
  getMayaPromptOnlyFileText: jest.fn(() => ''),
  getMayaSafeDocIds: jest.fn(() => []),
  getMayaSafeFileState: jest.fn(() => null),
}));

type MDPChatHelpers = Parameters<typeof useMDPChat>[1];

function createWrapper(initializeState?: (snapshot: MutableSnapshot) => void) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <RecoilRoot initializeState={initializeState}>{children}</RecoilRoot>
      </QueryClientProvider>
    );
  };
}

function createChatHelpers(initialMessages: TMessage[] = []): MDPChatHelpers {
  let messages = initialMessages;

  return {
    setMessages: jest.fn((nextMessages: TMessage[]) => {
      messages = nextMessages;
    }),
    getMessages: jest.fn(() => messages),
    setConversation: jest.fn(),
    setIsSubmitting: jest.fn(),
    newConversation: jest.fn(),
    resetLatestMessage: jest.fn(),
  };
}

function createSubmission(text: string): TSubmission {
  return {
    userMessage: {
      messageId: 'user-message-1',
      text,
      parentMessageId: '00000000-0000-0000-0000-000000000000',
    } as TMessage,
    initialResponse: {
      messageId: 'assistant-message-1',
    } as TMessage,
    messages: [],
    conversation: {
      conversationId: Constants.NEW_CONVO,
    } as TConversation,
    endpointOption: {
      endpoint: 'openAI',
      model: 'gpt-4o',
      modelLabel: 'GPT-4o',
    },
    isTemporary: false,
  } as TSubmission;
}

describe('useMDPChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getMayaPromptOnlyFileText as jest.Mock).mockReturnValue('');
  });

  it('adds prompt-only transcript text to the effective prompt without changing display text', async () => {
    const helpers = createChatHelpers();
    const submission = createSubmission('Voice transcript attached.');
    submission.userMessage = {
      ...submission.userMessage,
      files: [
        {
          file_id: 'transcript-1',
          filename: 'voice-transcript.txt',
          type: 'text/plain',
          maya_safe_file: {
            status: 'ready',
            localPreviewOnly: true,
            promptText: 'Hello Alice',
          },
        },
      ],
    } as unknown as TMessage;

    (getMayaPromptOnlyFileText as jest.Mock).mockReturnValue('Hello Alice');
    (anonymizeText as jest.Mock).mockResolvedValue({
      anonymized_prompt: 'Voice transcript attached.\n\nHello <NAME>',
      anonymized_values: { Alice: '<NAME>' },
      detected_values: { NAME: ['Alice'] },
    });
    (sendChat as jest.Mock).mockResolvedValue({
      sessionId: 'session-1',
      userMessage: {
        messageId: 'user-message-1',
        text: 'Voice transcript attached.',
      },
      assistantMessage: {
        messageId: 'assistant-message-1',
        text: '',
      },
      rawResponse: {},
    });

    renderHook(() => useMDPChat(submission, helpers), {
      wrapper: createWrapper((snapshot) => {
        snapshot.set(store.mdpAnonymizationLanguage, 'en');
      }),
    });

    await waitFor(() => expect(sendChat).toHaveBeenCalledTimes(1));

    const effectivePrompt = 'Voice transcript attached.\n\nHello Alice';
    expect(anonymizeText).toHaveBeenCalledWith(effectivePrompt, ['NAME', 'EMAIL'], 'en');
    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        text: effectivePrompt,
        displayText: 'Voice transcript attached.',
        docIds: undefined,
      }),
    );
    expect(rememberMessageFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'session-1',
        messageId: 'user-message-1',
        text: 'Voice transcript attached.',
        files: submission.userMessage?.files,
      }),
    );
    expect(rememberMessageFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'session-1',
        messageId: 'user-message-1',
        text: effectivePrompt,
        files: submission.userMessage?.files,
      }),
    );
    expect(rememberMessageFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'session-1',
        messageId: 'user-message-1',
        text: 'Voice transcript attached.\n\nHello <NAME>',
        files: submission.userMessage?.files,
      }),
    );
  });

  it('passes the selected anonymization language through anonymizeText and sendChat', async () => {
    const helpers = createChatHelpers();
    const submission = createSubmission('  Hallo Alice  ');

    (anonymizeText as jest.Mock).mockResolvedValue({
      anonymized_prompt: 'Hallo <NAME>',
      anonymized_values: { Alice: '<NAME>' },
      detected_values: { NAME: ['Alice'] },
    });
    (sendChat as jest.Mock).mockResolvedValue({
      sessionId: 'session-1',
      userMessage: {
        messageId: 'user-message-1',
        text: 'Hallo Alice',
      },
      assistantMessage: {
        messageId: 'assistant-message-1',
        text: '',
      },
      rawResponse: {},
    });

    renderHook(() => useMDPChat(submission, helpers), {
      wrapper: createWrapper((snapshot) => {
        snapshot.set(store.mdpAnonymizationLanguage, 'de');
      }),
    });

    await waitFor(() => expect(sendChat).toHaveBeenCalledTimes(1));

    expect(anonymizeText).toHaveBeenCalledWith('Hallo Alice', ['NAME', 'EMAIL'], 'de');
    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Hallo Alice',
        lang: 'de',
        anonymizedPrompt: 'Hallo <NAME>',
        anonymizedValues: { Alice: ['<NAME>'] },
        detectedValues: { NAME: ['Alice'] },
      }),
    );
  });

  it('routes image generation mode through generateImage without anonymizing chat text', async () => {
    const helpers = createChatHelpers();
    const submission = createSubmission('Draw Alice');

    (generateImage as jest.Mock).mockResolvedValue({
      sessionId: 'image-session-1',
      imagePath: 'https://example.test/generated.png',
    });

    renderHook(() => useMDPChat(submission, helpers), {
      wrapper: createWrapper((snapshot) => {
        snapshot.set(store.imageGenEnabled, true);
      }),
    });

    await waitFor(() => expect(generateImage).toHaveBeenCalledTimes(1));

    expect(generateImage).toHaveBeenCalledWith('Draw Alice', undefined);
    expect(anonymizeText).not.toHaveBeenCalled();
    expect(sendChat).not.toHaveBeenCalled();
    expect(helpers.setConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'image-session-1',
        title: 'Draw Alice',
      }),
    );

    const latestMessages = (helpers.setMessages as jest.Mock).mock.calls.at(-1)?.[0] as TMessage[];
    expect(latestMessages.at(-1)?.text).toBe(
      '![Generated Image](https://example.test/generated.png)',
    );
  });

  it('drains selected skills into the MDP chat payload with skill instructions', async () => {
    const helpers = createChatHelpers();
    const submission = createSubmission('Write a project brief');

    (getWorkspaceSkillsByNames as jest.Mock).mockReturnValue([
      {
        name: 'document-writer',
        description: 'Create structured project documents',
        body: 'Use headings, concise paragraphs, and a short summary.',
      },
    ]);
    (anonymizeText as jest.Mock).mockResolvedValue({
      anonymized_prompt: 'Write a project brief',
      anonymized_values: {},
      detected_values: {},
    });
    (sendChat as jest.Mock).mockResolvedValue({
      sessionId: 'session-1',
      userMessage: {
        messageId: 'user-message-1',
        text: 'Write a project brief',
      },
      assistantMessage: {
        messageId: 'assistant-message-1',
        text: '',
      },
      rawResponse: {},
    });

    renderHook(() => useMDPChat(submission, helpers), {
      wrapper: createWrapper((snapshot) => {
        snapshot.set(store.pendingManualSkillsByConvoId(Constants.NEW_CONVO), ['document-writer']);
      }),
    });

    await waitFor(() => expect(sendChat).toHaveBeenCalledTimes(1));

    expect(getWorkspaceSkillsByNames).toHaveBeenCalledWith(['document-writer']);
    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        manualSkills: ['document-writer'],
        skillInstructions: [
          {
            name: 'document-writer',
            description: 'Create structured project documents',
            body: 'Use headings, concise paragraphs, and a short summary.',
          },
        ],
      }),
    );
  });

  it('passes saved prompt metadata into the MDP chat payload and local messages', async () => {
    const helpers = createChatHelpers();
    const submission = {
      ...createSubmission('Draft the onboarding policy'),
      savedPrompt: {
        groupId: 'prompt-group-1',
        name: 'Onboarding policy',
      },
    } as TSubmission;

    (anonymizeText as jest.Mock).mockResolvedValue({
      anonymized_prompt: 'Draft the onboarding policy',
      anonymized_values: {},
      detected_values: {},
    });
    (sendChat as jest.Mock).mockResolvedValue({
      sessionId: 'session-1',
      userMessage: {
        messageId: 'user-message-1',
        text: 'Draft the onboarding policy',
      },
      assistantMessage: {
        messageId: 'assistant-message-1',
        text: '',
      },
      rawResponse: {},
    });

    renderHook(() => useMDPChat(submission, helpers), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(sendChat).toHaveBeenCalledTimes(1));

    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        savedPrompt: {
          groupId: 'prompt-group-1',
          name: 'Onboarding policy',
          prompt: 'Draft the onboarding policy',
        },
      }),
    );

    const latestMessages = (helpers.setMessages as jest.Mock).mock.calls.at(-1)?.[0] as TMessage[];
    expect(
      latestMessages.find((message) => message.messageId === 'user-message-1')?.savedPrompt,
    ).toEqual({
      groupId: 'prompt-group-1',
      name: 'Onboarding policy',
    });
    expect(
      latestMessages.find((message) => message.messageId === 'assistant-message-1')?.savedPrompt,
    ).toEqual({
      groupId: 'prompt-group-1',
      name: 'Onboarding policy',
    });
  });

  it('attaches the built-in document skill when document export mode is enabled', async () => {
    const helpers = createChatHelpers();
    const submission = createSubmission('Prepare this as a project report');

    (getWorkspaceSkillsByNames as jest.Mock).mockReturnValue([]);
    (anonymizeText as jest.Mock).mockResolvedValue({
      anonymized_prompt: 'Prepare this as a project report',
      anonymized_values: {},
      detected_values: {},
    });
    (sendChat as jest.Mock).mockResolvedValue({
      sessionId: 'session-1',
      userMessage: {
        messageId: 'user-message-1',
        text: 'Prepare this as a project report',
      },
      assistantMessage: {
        messageId: 'assistant-message-1',
        text: '',
      },
      rawResponse: {},
    });

    renderHook(() => useMDPChat(submission, helpers), {
      wrapper: createWrapper((snapshot) => {
        snapshot.set(store.documentExportEnabled, true);
      }),
    });

    await waitFor(() => expect(sendChat).toHaveBeenCalledTimes(1));

    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        manualSkills: ['document_create'],
        skillInstructions: [
          expect.objectContaining({
            name: 'document_create',
            description: 'Create privacy-safe Markdown and downloadable document artifacts.',
          }),
        ],
      }),
    );
  });
});
