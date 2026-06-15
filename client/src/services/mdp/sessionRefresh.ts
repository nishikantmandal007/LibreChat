import { requestModifyToken } from './modifyToken';
import {
  clearMDPSessionAuth,
  readMDPSessionAuth,
  updateMDPStoredJwtToken,
} from './sessionAuth';

let refreshInFlight: Promise<string | null> | null = null;

function getDevFallbackToken(): string | null {
  const devToken = import.meta.env.VITE_MDP_JWT_TOKEN;
  return typeof devToken === 'string' && devToken.trim() ? devToken : null;
}

function extractJwtFromModifyTokenResponse(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const record = data as Record<string, unknown>;
  if (typeof record.jwtToken === 'string' && record.jwtToken.trim()) {
    return record.jwtToken;
  }

  if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
    const nested = record.data as Record<string, unknown>;
    if (typeof nested.jwtToken === 'string' && nested.jwtToken.trim()) {
      return nested.jwtToken;
    }
  }

  return null;
}

export async function refreshMDPSessionToken(refreshToken: string): Promise<string> {
  const data = await requestModifyToken(refreshToken);
  const jwtToken = extractJwtFromModifyTokenResponse(data);
  if (!jwtToken) {
    throw new Error('modify-token response did not include jwtToken');
  }

  updateMDPStoredJwtToken(jwtToken);
  return jwtToken;
}

export async function refreshMDPSessionFromStorage(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const sessionResult = readMDPSessionAuth();
    const refreshToken =
      sessionResult.ok && sessionResult.session.refreshToken?.trim()
        ? sessionResult.session.refreshToken
        : null;

    if (!refreshToken) {
      clearMDPSessionAuth();
      return null;
    }

    try {
      return await refreshMDPSessionToken(refreshToken);
    } catch {
      clearMDPSessionAuth();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** Refresh expired JWTs before MDP API calls or app startup. */
export async function ensureMDPSessionFresh(): Promise<boolean> {
  if (getDevFallbackToken() && !readMDPSessionAuth().ok) {
    return true;
  }

  const sessionResult = readMDPSessionAuth();
  if (!sessionResult.ok) {
    return false;
  }

  if (!sessionResult.session.isExpired) {
    return true;
  }

  const refreshedToken = await refreshMDPSessionFromStorage();
  return Boolean(refreshedToken);
}

export function isMDPSessionAuthenticated(): boolean {
  if (getDevFallbackToken() && !readMDPSessionAuth().ok) {
    return true;
  }

  const sessionResult = readMDPSessionAuth();
  return sessionResult.ok && !sessionResult.session.isExpired;
}

export { clearMDPSessionAuth };
