import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { Constants } from 'librechat-data-provider';
import { RecoilRoot, type MutableSnapshot } from 'recoil';
import type { TConversation, TMessage, TSubmission } from 'librechat-data-provider';
import useMDPChat from '../useMDPChat';
import { anonymizeText, generateImage, sendChat } from '~/services/mdp';
import { getWorkspaceSkillsByNames } from '~/services/mdp/workspaceStore';
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
  } as TSubmission;
}

describe('useMDPChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        anonymizedValues: { Alice: '<NAME>' },
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
});
