import { v4 as uuidv4 } from 'uuid';
import { FileSources } from 'librechat-data-provider';
import { createSafeFile } from './safeFiles';
import { normalizeMdpLanguage } from './language';

import type { TFileUpload } from 'librechat-data-provider';
import type { MayaSafeFileState } from '~/common';

type MayaSafeFileUpload = TFileUpload & {
  safeFile?: MayaSafeFileState;
};

type ProgressCallback = (state: MayaSafeFileState) => void;

let _onSafeFileProgress: ProgressCallback | null = null;

export function setSafeFileProgressCallback(cb: ProgressCallback | null): void {
  _onSafeFileProgress = cb;
}

export async function uploadFile(formData: FormData): Promise<TFileUpload> {
  const file = formData.get('file');
  if (!(file instanceof File)) {
    throw new Error('No file was provided for upload');
  }

  const tempFileId = formData.get('file_id')?.toString() || uuidv4();
  const llmType = formData.get('llm_type')?.toString() || 'openai';
  const lang = normalizeMdpLanguage(formData.get('lang')?.toString());
  const role = formData.get('file_role')?.toString();
  const filename = file.name;
  const mimeType = file.type || 'application/octet-stream';
  const localPreviewUrl = URL.createObjectURL(file);

  _onSafeFileProgress?.({
    status: 'uploading',
    rawFileId: tempFileId,
    previewOriginalUrl: localPreviewUrl,
  });

  const now = new Date().toISOString();

  _onSafeFileProgress?.({
    status: 'scanning',
    rawFileId: tempFileId,
    previewOriginalUrl: localPreviewUrl,
  });

  await new Promise((r) => setTimeout(r, 400));
  _onSafeFileProgress?.({
    status: 'anonymizing',
    rawFileId: tempFileId,
    previewOriginalUrl: localPreviewUrl,
  });

  let safeFile: MayaSafeFileState;
  try {
    safeFile = await createSafeFile({
      file,
      rawFileId: tempFileId,
      filename,
      mimeType,
      llmType,
      lang,
      localPreviewUrl,
      role,
    });
  } catch (error) {
    safeFile = {
      status: 'failed',
      rawFileId: tempFileId,
      error: error instanceof Error ? error.message : 'Failed to create an anonymized safe copy.',
    };
  }

  if (safeFile.status !== 'failed') {
    _onSafeFileProgress?.({
      ...safeFile,
      status: 'indexing',
    });
    await new Promise((r) => setTimeout(r, 400));

    _onSafeFileProgress?.({
      ...safeFile,
      status: safeFile.safeDocId || safeFile.status === 'ready' ? 'ready' : safeFile.status,
    });
  }

  _onSafeFileProgress = null;

  const upload: MayaSafeFileUpload = {
    user: 'guest',
    file_id: safeFile.safeDocId || tempFileId,
    temp_file_id: tempFileId,
    bytes: file.size,
    embedded: Boolean(safeFile.safeDocId),
    filename,
    filepath: safeFile.downloadUrl || localPreviewUrl,
    object: 'file',
    type: mimeType,
    usage: 0,
    source: FileSources.local,
    createdAt: now,
    updatedAt: now,
    safeFile: {
      ...safeFile,
      rawFileId: safeFile.rawFileId || tempFileId,
      previewOriginalUrl: safeFile.previewOriginalUrl || localPreviewUrl,
    },
  };

  return upload;
}
