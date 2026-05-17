import { mdpClient } from '../client';
import { sendChat } from '../chat';

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
          doc: 'safe-doc-1',
          docs: ['safe-doc-1', 'safe-doc-2'],
        }),
      }),
    );
  });
});
