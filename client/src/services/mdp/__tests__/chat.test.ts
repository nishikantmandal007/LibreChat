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
          lang: 'en',
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

  it('falls back to English for unsupported language values', async () => {
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
          lang: 'en',
        }),
      }),
    );
  });

  it('preserves citations, artifacts, and workflow metadata on assistant messages', async () => {
    mockedPost.mockResolvedValue({
      data: {
        session_id: 'session-1',
        replaced_response: 'Answer',
        llm_response: 'Answer',
        total_tokens: 4,
        anonymized_values: {},
        citations: [{ file_name: 'safe.pdf', page: 1 }],
        artifacts: [
          {
            artifact_id: 'artifact-1',
            filename: 'brief.md',
            format: 'markdown',
            download_url: '/mdp/ai-safe/artifacts/artifact-1/download',
            metadata: { privacy_scope: 'anonymized_response' },
          },
        ],
        workflow: {
          privacy: 'prompt_anonymized',
          rag: 'safe_documents',
          skills: ['document_create'],
          artifact_count: 1,
        },
      },
    });

    const result = await sendChat({
      text: 'Create a brief',
      sessionId: 'session-1',
      manualSkills: ['document_create'],
    });

    expect(result.assistantMessage.metadata).toEqual({
      citations: [{ file_name: 'safe.pdf', page: 1 }],
      artifacts: [
        {
          artifact_id: 'artifact-1',
          filename: 'brief.md',
          format: 'markdown',
          download_url: '/mdp/ai-safe/artifacts/artifact-1/download',
          metadata: { privacy_scope: 'anonymized_response' },
        },
      ],
      workflow: {
        privacy: 'prompt_anonymized',
        rag: 'safe_documents',
        skills: ['document_create'],
        artifact_count: 1,
      },
    });
  });
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
        citations: '\nSource 1\n\n\nSource 2\n',
      }),
    ).toBe('First line.\n\nSecond line.\n\nSource 1\n\nSource 2');
  });
});
