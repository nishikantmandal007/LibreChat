import { mdpClient } from '../client';
import { anonymizeText } from '../anonymization';

jest.mock('../client', () => ({
  mdpClient: {
    post: jest.fn(),
  },
}));

const mockedPost = mdpClient.post as jest.Mock;

describe('anonymizeText', () => {
  afterEach(() => {
    mockedPost.mockReset();
  });

  it('serializes the privacy context id for consistent anonymization', async () => {
    mockedPost.mockResolvedValue({
      data: {
        anonymized_prompt: 'Hello',
        detected_values: {},
        anonymized_values: {},
      },
    });

    await anonymizeText('Hello Alice', ['Names'], 'en', { privacyContextId: 'chat-1' });

    expect(mockedPost).toHaveBeenCalledWith(
      '/mdp/ai-safe/anonymize',
      expect.objectContaining({
        privacy_context_id: 'chat-1',
      }),
    );
  });
});
