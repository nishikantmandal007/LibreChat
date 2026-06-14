import { mdpClient } from '../client';
import { generateImage, sendChat } from '../chat';
import { formatMayaAssistantText } from '../format';

jest.mock('../client', () => ({
  mdpClient: {
    post: jest.fn(),
  },
}));

jest.mock('../history', () => ({
  invalidateSessionsCache: jest.fn(),
}));

const mockedPost = mdpClient.post as jest.Mock;

describe('sendChat', () => {
  afterEach(() => {
    mockedPost.mockReset();
  });

  it('serializes all attached safe document IDs', async () => {
    mockedPost.mockResolvedValue({
      data: {
        session_id: 'session-1',
        replaced_response: 'Answer',
        llm_response: 'Answer',
        total_tokens: 4,
        anonymized_values: {},
      },
    });

    await sendChat({
      text: 'Compare the attached documents',
      sessionId: 'session-1',
      docId: 'safe-doc-1',
      docIds: ['safe-doc-1', 'safe-doc-2'],
    });

    expect(mockedPost).toHaveBeenCalledWith(
      '/mdp/ai-safe/chat',
      expect.objectContaining({
        chat_dto: expect.objectContaining({
          lang: 'de',
          doc: 'safe-doc-1',
          docs: ['safe-doc-1', 'safe-doc-2'],
        }),
      }),
    );
  });

  it('serializes the selected anonymization language', async () => {
    mockedPost.mockResolvedValue({
      data: {
        session_id: 'session-1',
        replaced_response: 'Antwort',
        llm_response: 'Antwort',
        total_tokens: 4,
        anonymized_values: {},
      },
    });

    await sendChat({
      text: 'Fasse dieses Dokument zusammen',
      sessionId: 'session-1',
      lang: 'de',
    });

    expect(mockedPost).toHaveBeenCalledWith(
      '/mdp/ai-safe/chat',
      expect.objectContaining({
        chat_dto: expect.objectContaining({
          lang: 'de',
        }),
      }),
    );
  });

  it('falls back to German for unsupported language values', async () => {
    mockedPost.mockResolvedValue({
      data: {
        session_id: 'session-1',
        replaced_response: 'Answer',
        llm_response: 'Answer',
        total_tokens: 4,
        anonymized_values: {},
      },
    });

    await sendChat({
      text: 'Summarize this',
      sessionId: 'session-1',
      lang: 'fr',
    });

    expect(mockedPost).toHaveBeenCalledWith(
      '/mdp/ai-safe/chat',
      expect.objectContaining({
        chat_dto: expect.objectContaining({
          lang: 'de',
        }),
      }),
    );
  });

  it('passes the selected backend model key through the AI-safe payload', async () => {
    mockedPost.mockResolvedValue({
      data: {
        session_id: 'session-1',
        replaced_response: 'Answer',
        llm_response: 'Answer',
        total_tokens: 4,
        anonymized_values: {},
      },
    });

    const result = await sendChat({
      text: 'Use Claude for this answer',
      sessionId: 'session-1',
      endpoint: 'anthropic',
      model: 'claude-opus-4-8',
    });

    expect(mockedPost).toHaveBeenCalledWith(
      '/mdp/ai-safe/chat',
      expect.objectContaining({
        llm_type: 'openai',
        chat_dto: expect.objectContaining({
          model_key: 'claude-opus-4-8',
        }),
      }),
    );
    expect(result.assistantMessage.model).toBe('claude-opus-4-8');
    expect(result.assistantMessage.sender).toBe('Claude Opus 4.8');
    expect(result.assistantMessage.endpoint).toBe('anthropic');
  });

  // it('serializes saved prompt metadata for backend prompt-aware flows', async () => {
  //   mockedPost.mockResolvedValue({
  //     data: {
  //       session_id: 'session-1',
  //       replaced_response: 'Answer',
  //       llm_response: 'Answer',
  //       total_tokens: 4,
  //       anonymized_values: {},
  //     },
  //   });
  //
  //   const result = await sendChat({
  //     text: 'Draft a policy',
  //     sessionId: 'session-1',
  //     savedPrompt: {
  //       groupId: 'prompt-group-1',
  //       name: 'Policy draft',
  //       prompt: 'Draft a policy',
  //     },
  //   });
  //
  //   expect(mockedPost).toHaveBeenCalledWith(
  //     '/mdp/ai-safe/chat',
  //     expect.objectContaining({
  //       chat_dto: expect.objectContaining({
  //         saved_prompt: {
  //           group_id: 'prompt-group-1',
  //           name: 'Policy draft',
  //           prompt: 'Draft a policy',
  //         },
  //       }),
  //     }),
  //   );
  //   expect(result.userMessage.savedPrompt).toEqual({
  //     groupId: 'prompt-group-1',
  //     name: 'Policy draft',
  //   });
  // });

  it('posts the effective prompt while returning a shorter display text', async () => {
    mockedPost.mockResolvedValue({
      data: {
        session_id: 'session-1',
        replaced_response: 'Answer',
        llm_response: 'Answer',
        total_tokens: 4,
        anonymized_values: {},
      },
    });

    const result = await sendChat({
      text: 'Voice transcript attached.\n\nHello Alice',
      displayText: 'Voice transcript attached.',
      sessionId: 'session-1',
    });

    expect(mockedPost).toHaveBeenCalledWith(
      '/mdp/ai-safe/chat',
      expect.objectContaining({
        chat_dto: expect.objectContaining({
          original_prompt: 'Voice transcript attached.\n\nHello Alice',
        }),
      }),
    );
    expect(result.userMessage.text).toBe('Voice transcript attached.');
  });

  // it('preserves citations, artifacts, and workflow metadata on assistant messages', async () => {
  //   -- removed: citations/activity/workflow no longer sent by backend
  // });

  // it('passes the web search toggle through the AI-safe payload', async () => {
  //   -- removed: web search removed from backend
  // });
});

describe('generateImage', () => {
  afterEach(() => {
    mockedPost.mockReset();
  });

  it('posts the raw prompt to the image generation endpoint', async () => {
    mockedPost.mockResolvedValue({
      data: {
        session_id: 'session-1',
        image_path: '#https://example.com/generated.png#',
      },
    });

    const result = await generateImage('Create an image of Alice', 'session-1');

    expect(mockedPost).toHaveBeenCalledWith('/mdp/ai-safe/generate-image', {
      llm_type: 'openai',
      image_dto: {
        prompt: 'Create an image of Alice',
        chat_id: 'session-1',
      },
    });
    expect(result).toEqual({
      sessionId: 'session-1',
      imagePath: 'https://example.com/generated.png',
    });
  });
});

describe('formatMayaAssistantText', () => {
  it('normalizes spacing without changing assistant content', () => {
    expect(
      formatMayaAssistantText({
        responseText: '  First line.  \n\n\nSecond line.\t\n',
      }),
    ).toBe('First line.\n\nSecond line.');
  });

  // it('formats activity as a collapsed thinking block', () => {
  //   -- removed: activity no longer sent by backend
  // });
});
