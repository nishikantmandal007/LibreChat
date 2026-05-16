import { mdpClient } from './client';
import { MDP_ENDPOINTS } from './endpoints';

import type { MDPFileUploadResponse } from './types';

export async function uploadFile(file: File): Promise<MDPFileUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('file_name', file.name);
  formData.append('file_type', file.type);
  formData.append('llm_type', 'openai');

  const response = await mdpClient.post<MDPFileUploadResponse>(MDP_ENDPOINTS.upload, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
}
