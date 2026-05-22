import type { TMessage } from 'librechat-data-provider';
import { mdpClient } from '../client';
import { getSessionMessages } from '../history';
import { clearMessageFileCache, rememberMessageFiles } from '../messageFileCache';

jest.mock('../client', () => ({
  mdpClient: {
    get: jest.fn(),
  },
}));

const mockedGet = mdpClient.get as jest.Mock;

describe('getSessionMessages', () => {
  afterEach(() => {
    mockedGet.mockReset();
    clearMessageFileCache();
  });

  it('restores cached files when history refetch reconstructs message IDs', async () => {
    const files: NonNullable<TMessage['files']> = [
      {
        file_id: 'file-1',
        filename: 'report.pdf',
      },
    ];
    rememberMessageFiles({
      conversationId: 'session-1',
      messageId: 'client-message-id',
      text: 'Summarize this PDF',
      textOccurrence: 1,
      files,
    });
    mockedGet.mockResolvedValue({
      data: {
        prompts: [
          {
            original_prompt: 'Summarize this PDF',
            anonymized_prompt: 'Summarize this PDF',
            replaced_response: 'Summary',
            created_at: '2026-05-17T00:00:00.000Z',
          },
        ],
      },
    });

    const messages = await getSessionMessages('session-1');

    expect(messages[0].files).toEqual(files);
    expect(messages[0].metadata).toEqual({ anonymizedPrompt: 'Summarize this PDF' });
  });
  it('preserves citation metadata for source chips when history is reloaded', async () => {
    mockedGet.mockResolvedValue({
      data: {
        prompts: [
          {
            original_prompt: 'Summarize this PDF',
            anonymized_prompt: 'Summarize this PDF',
            replaced_response: 'Summary',
            created_at: '2026-05-17T00:00:00.000Z',
            citations: [{ file_name: 'anonymized_Project_synopsis.pdf', page: 1 }],
          },
        ],
      },
    });

    const messages = await getSessionMessages('session-1');

    expect(messages[1].metadata).toEqual({
      citations: [{ file_name: 'anonymized_Project_synopsis.pdf', page: 1 }],
    });
  });
});
