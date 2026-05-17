import { normalizeSafeFileResponse } from '../safeFiles';

describe('normalizeSafeFileResponse', () => {
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
    expect(result.downloadUrl).toBe('/mdp/ai-safe/anonymize-file/download/safe-doc-1');
    expect(result.previewAnonymizedUrl).toBe('/mdp/ai-safe/anonymize-file/download/safe-doc-1');
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
    expect(result.downloadUrl).toBe('/mdp/ai-safe/anonymize-file/download/safe-doc-2');
  });
});
