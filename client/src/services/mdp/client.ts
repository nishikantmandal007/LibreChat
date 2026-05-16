import axios from 'axios';

import type { MDPApiResponse } from './types';

const MDP_TOKEN_KEY = 'mdp_jwt_token';

export const mdpClient = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
});

mdpClient.interceptors.request.use((config) => {
  const token =
    localStorage.getItem(MDP_TOKEN_KEY) || import.meta.env.VITE_MDP_JWT_TOKEN;
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
    if (error.response?.status === 401) {
      localStorage.removeItem(MDP_TOKEN_KEY);
      window.location.href = '/login';
    }
    return Promise.reject(error);
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
