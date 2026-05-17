import { mdpClient } from '../client';
import { uploadFile } from '../files';

jest.mock('../client', () => ({
  mdpClient: {
    post: jest.fn(),
  },
}));

const mockedPost = mdpClient.post as jest.Mock;
const originalCreateObjectURL = URL.createObjectURL;

describe('uploadFile', () => {
  beforeAll(() => {
    URL.createObjectURL = jest.fn(() => 'blob:local-preview');
  });

  afterAll(() => {
    URL.createObjectURL = originalCreateObjectURL;
  });

  afterEach(() => {
    mockedPost.mockReset();
  });

  it('creates only the anonymized safe copy and does not upload the raw file first', async () => {
    mockedPost.mockResolvedValue({
      data: {
        status: 'ready',
        safe_doc_id: 'safe-doc-1',
        download_url: '/mdp/ai-safe/anonymize-file/download/safe-doc-1',
      },
    });

    const form = new FormData();
    form.append('file', new File(['Alice lives in Berlin'], 'notes.txt', { type: 'text/plain' }));
    form.append('file_id', 'temp-file-1');
    form.append('lang', 'de');

    const result = await uploadFile(form);
    const safeForm = mockedPost.mock.calls[0][1] as FormData;

    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(mockedPost).toHaveBeenCalledWith(
      '/mdp/ai-safe/anonymize-file',
      expect.any(FormData),
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
    expect(safeForm.get('safe_chat')).toBe('true');
    expect(safeForm.get('file_id')).toBe('temp-file-1');
    expect(safeForm.get('lang')).toBe('de');
    expect(result.file_id).toBe('safe-doc-1');
    expect(result.safeFile?.safeDocId).toBe('safe-doc-1');
  });
});
