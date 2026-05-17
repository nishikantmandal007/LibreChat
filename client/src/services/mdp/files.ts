import { v4 as uuidv4 } from 'uuid';
import { FileSources } from 'librechat-data-provider';
import { mdpClient } from './client';
import { MDP_ENDPOINTS } from './endpoints';
import { createSafeFile } from './safeFiles';

import type { TFileUpload } from 'librechat-data-provider';
import type { MDPFileUploadResponse } from './types';
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
  const uploadForm = new FormData();
  uploadForm.append('file', file, file.name);
  uploadForm.append('file_name', file.name);
  uploadForm.append('file_type', file.type);
  uploadForm.append('llm_type', llmType);

  const localPreviewUrl = URL.createObjectURL(file);

  _onSafeFileProgress?.({
    status: 'uploading',
    previewOriginalUrl: localPreviewUrl,
  });

  const response = await mdpClient.post<MDPFileUploadResponse | string>(MDP_ENDPOINTS.upload, uploadForm, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const raw = response.data;
  const data: MDPFileUploadResponse = typeof raw === 'string' ? { file_id: raw } : (raw ?? {});
  const now = new Date().toISOString();
  const fileId = data.file_id || data.doc_id || tempFileId;
  const filename = data.file_name || data.filename || file.name;
  const filepath = data.filepath || data.file_path || data.url || fileId;

  _onSafeFileProgress?.({
    status: 'scanning',
    rawFileId: data.raw_file_id || fileId,
    previewOriginalUrl: localPreviewUrl,
  });

  await new Promise((r) => setTimeout(r, 400));
  _onSafeFileProgress?.({
    status: 'anonymizing',
    rawFileId: data.raw_file_id || fileId,
    previewOriginalUrl: localPreviewUrl,
  });

  let safeFile: MayaSafeFileState;
  try {
    safeFile = await createSafeFile({
      file,
      rawFileId: data.raw_file_id || fileId,
      rawFilepath: filepath,
      filename,
      mimeType: data.type || file.type,
      llmType,
      localPreviewUrl,
    });
  } catch (error) {
    safeFile = {
      status: 'failed',
      rawFileId: data.raw_file_id || fileId,
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
    file_id: fileId,
    temp_file_id: tempFileId,
    bytes: file.size,
    embedded: false,
    filename,
    filepath,
    object: 'file',
    type: data.type || file.type || 'application/octet-stream',
    usage: 0,
    source: FileSources.local,
    createdAt: now,
    updatedAt: now,
    safeFile: {
      ...safeFile,
      rawFileId: safeFile.rawFileId || data.raw_file_id || fileId,
      previewOriginalUrl: safeFile.previewOriginalUrl || localPreviewUrl,
    },
  };

  return upload;
}
