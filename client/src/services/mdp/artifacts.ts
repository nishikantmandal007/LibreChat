import { mdpClient } from './client';
import { MDP_ENDPOINTS } from './endpoints';

import type { MDPChatResponse } from './types';

export type MDPArtifact = NonNullable<MDPChatResponse['artifacts']>[number];

export async function fetchArtifactBlob(url: string): Promise<Blob> {
  const response = await mdpClient.get<Blob>(url, { responseType: 'blob' });
  return response.data;
}

export async function exportDocxArtifact({
  contentMarkdown,
  filename,
}: {
  contentMarkdown: string;
  filename: string;
}): Promise<Blob> {
  const response = await mdpClient.post<Blob>(
    `${MDP_ENDPOINTS.artifacts}/export/docx`,
    {
      content_markdown: contentMarkdown,
      filename,
    },
    { responseType: 'blob' },
  );
  return response.data;
}
