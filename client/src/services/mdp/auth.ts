import {
  getMDPToken,
  setMDPToken,
  clearMDPToken,
  decodeMDPToken,
} from './client';

import type { MDPJwtPayload } from './client';

export interface MDPUser {
  id: string;
  email: string;
  organizationId: string;
  name: string;
}

export function getCurrentUser(): MDPUser | null {
  const token = getMDPToken();
  if (!token) {
    return null;
  }

  const payload = decodeMDPToken(token);
  if (!payload) {
    return null;
  }

  if (payload.exp * 1000 < Date.now()) {
    clearMDPToken();
    return null;
  }

  const emailUser = payload.preferred_username.split('@')[0] || payload.preferred_username;
  const firstName = emailUser.split('.')[0];
  return {
    id: payload.sub,
    email: payload.preferred_username,
    organizationId: payload.OrganizationId,
    name: firstName.charAt(0).toUpperCase() + firstName.slice(1),
  };
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

export function login(token: string): MDPUser | null {
  setMDPToken(token);
  return getCurrentUser();
}

export function logout(): void {
  clearMDPToken();
}

export { getMDPToken, setMDPToken, clearMDPToken };
export type { MDPJwtPayload };
