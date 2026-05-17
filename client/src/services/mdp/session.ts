import { mdpClient } from './client';
import { MDP_ENDPOINTS } from './endpoints';

import type { MDPSessionRenameRequest, MDPSessionDeleteRequest } from './types';

export async function renameSession(sessionId: string, name: string): Promise<void> {
  const request: MDPSessionRenameRequest = {
    session_id: sessionId,
    new_name: name,
  };
  await mdpClient.post(MDP_ENDPOINTS.sessionRename, request);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const request: MDPSessionDeleteRequest = {
    session_id: sessionId,
  };
  await mdpClient.post(MDP_ENDPOINTS.sessionDelete, request);
}
