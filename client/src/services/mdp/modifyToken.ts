import axios from 'axios';

import { MDP_ENDPOINTS } from './endpoints';

const MDP_API_BASE_URL = import.meta.env.VITE_MDP_API_BASE_URL || '';

export async function requestModifyToken(refreshToken: string): Promise<unknown> {
  const response = await axios.post(
    MDP_ENDPOINTS.modifyToken,
    { token: refreshToken },
    {
      baseURL: MDP_API_BASE_URL,
      headers: { 'Content-Type': 'application/json' },
    },
  );

  return response.data;
}
