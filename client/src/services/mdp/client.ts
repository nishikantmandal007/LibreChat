import axios from 'axios';

import type { MDPApiResponse } from './types';

const MDP_TOKEN_KEY = 'mdp_jwt_token';
const MDP_API_BASE_URL = import.meta.env.VITE_MDP_API_BASE_URL || '';

export const mdpClient = axios.create({
  baseURL: MDP_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

function getApiErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : 'API request failed';
  }

  const data = error.response?.data;
  if (typeof data === 'string' && data.trim()) {
    return data;
  }
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }
    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error;
    }
  }

  return error.message || 'API request failed';
}

function isJwtAuthFailure(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status;
  if (status !== 401 && status !== 402) {
    return false;
  }

  const data = error.response?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }

  const authError = (data as Record<string, unknown>).error;
  return typeof authError === 'string' && /token|signature|authorization/i.test(authError);
}

mdpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(MDP_TOKEN_KEY) || import.meta.env.VITE_MDP_JWT_TOKEN;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

mdpClient.interceptors.response.use(
  (response) => {
    const data = response.data as MDPApiResponse<unknown>;
    if (data && typeof data.success === 'boolean') {
      if (!data.success) {
        return Promise.reject(new Error(data.message || 'API request failed'));
      }
      response.data = data.data;
    }
    return response;
  },
  (error) => {
    if (isJwtAuthFailure(error) && getMDPToken()) {
      localStorage.removeItem(MDP_TOKEN_KEY);
    }
    return Promise.reject(new Error(getApiErrorMessage(error)));
  },
);

export function setMDPToken(token: string): void {
  localStorage.setItem(MDP_TOKEN_KEY, token);
}

export function getMDPToken(): string | null {
  return localStorage.getItem(MDP_TOKEN_KEY) || import.meta.env.VITE_MDP_JWT_TOKEN || null;
}

export function clearMDPToken(): void {
  localStorage.removeItem(MDP_TOKEN_KEY);
}

export interface MDPJwtPayload {
  preferred_username: string;
  OrganizationId: string;
  sub: string;
  exp: number;
}

export function decodeMDPToken(token: string): MDPJwtPayload | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }
    return JSON.parse(atob(payload)) as MDPJwtPayload;
  } catch {
    return null;
  }
}
