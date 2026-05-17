import type { TMessage } from 'librechat-data-provider';
import {
  clearMessageFileCache,
  getCachedMessageFiles,
  getPromptTextOccurrence,
  rememberMessageFiles,
} from '../messageFileCache';

const makeFiles = (fileId: string): NonNullable<TMessage['files']> => [
  {
    file_id: fileId,
    filename: `${fileId}.pdf`,
  },
];

describe('messageFileCache', () => {
  afterEach(() => {
    clearMessageFileCache();
  });

  it('restores files by prompt text occurrence when refetched messages get new IDs', () => {
    const files = makeFiles('file-1');
    rememberMessageFiles({
      conversationId: 'session-1',
      messageId: 'client-message-id',
      text: 'Summarize this PDF',
      textOccurrence: 1,
      files,
    });

    expect(
      getCachedMessageFiles({
        conversationId: 'session-1',
        messageId: 'history-message-id',
        text: 'Summarize this PDF',
        textOccurrence: 1,
      }),
    ).toEqual(files);
  });

  it('does not attach duplicate prompt files to the wrong occurrence', () => {
    const files = makeFiles('file-2');
    rememberMessageFiles({
      conversationId: 'session-1',
      text: 'Same prompt',
      textOccurrence: 2,
      files,
    });

    expect(
      getCachedMessageFiles({
        conversationId: 'session-1',
        text: 'Same prompt',
        textOccurrence: 1,
      }),
    ).toBeUndefined();
    expect(
      getCachedMessageFiles({
        conversationId: 'session-1',
        text: 'Same prompt',
        textOccurrence: 2,
      }),
    ).toEqual(files);
  });

  it('counts prior user prompts with the same normalized text', () => {
    const messages = [
      { isCreatedByUser: true, text: 'Same prompt' },
      { isCreatedByUser: false, text: 'Same prompt' },
      { isCreatedByUser: true, text: ' Same prompt ' },
    ] as TMessage[];

    expect(getPromptTextOccurrence(messages, 'Same prompt')).toBe(2);
  });
});
