import { mdpClient } from '../client';
import { createSafeFile, normalizeSafeFileResponse } from '../safeFiles';

jest.mock('../client', () => ({
  mdpClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedPost = mdpClient.post as jest.Mock;

describe('normalizeSafeFileResponse', () => {
  afterEach(() => {
    mockedPost.mockReset();
  });

  it('builds safe-copy URLs from the safe document id', () => {
    const result = normalizeSafeFileResponse({
      status: 'ready',
      safe_doc_id: 'safe-doc-1',
      raw_file_id: 'raw-file-1',
      safe_filename: 'anonymized_Project_synopsis.pdf',
      mime_type: 'application/pdf',
    });

    expect(result.safeDocId).toBe('safe-doc-1');
    expect(result.safeFileId).toBe('safe-doc-1');
    expect(result.rawFileId).toBe('raw-file-1');
    expect(result.safeFilename).toBe('anonymized_Project_synopsis.pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.downloadUrl).toBe('/mdp/ai-safe/anonymised-upload/safe-doc-1/download');
    expect(result.previewAnonymizedUrl).toBe('/mdp/ai-safe/anonymised-upload/safe-doc-1/download');
  });

  it('does not use the raw uploaded file id for safe-copy downloads', () => {
    const result = normalizeSafeFileResponse({
      status: 'ready',
      safe_doc_id: 'safe-doc-2',
      safe_file_id: 'raw-upload-id',
      file_id: 'raw-upload-id',
    });

    expect(result.safeFileId).toBe('safe-doc-2');
    expect(result.rawFileId).toBe('raw-upload-id');
    expect(result.downloadUrl).toBe('/mdp/ai-safe/anonymised-upload/safe-doc-2/download');
  });
});

describe('createSafeFile', () => {
  afterEach(() => {
    mockedPost.mockReset();
  });

  it('posts the selected anonymization language to the safe file endpoint', async () => {
    mockedPost.mockResolvedValue({
      data: {
        status: 'ready',
        safe_doc_id: 'safe-doc-1',
      },
    });

    await createSafeFile({
      file: new File(['Hallo'], 'report.txt', { type: 'text/plain' }),
      rawFileId: 'raw-file-1',
      filename: 'report.txt',
      llmType: 'openai',
      lang: 'de',
      privacyContextId: 'chat-1',
    });

    const form = mockedPost.mock.calls[0][1] as FormData;

    expect(mockedPost).toHaveBeenCalledWith(
      '/mdp/ai-safe/anonymised-upload',
      expect.any(FormData),
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
    expect(form.get('lang')).toBe('de');
    expect(form.get('privacy_context_id')).toBe('chat-1');
  });

  it('falls back to German for unsupported language values', async () => {
    mockedPost.mockResolvedValue({
      data: {
        status: 'ready',
        safe_doc_id: 'safe-doc-1',
      },
    });

    await createSafeFile({
      file: new File(['Bonjour'], 'report.txt', { type: 'text/plain' }),
      rawFileId: 'raw-file-1',
      filename: 'report.txt',
      llmType: 'openai',
      lang: 'fr',
    });

    const form = mockedPost.mock.calls[0][1] as FormData;

    expect(form.get('lang')).toBe('de');
  });
});
