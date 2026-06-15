import type { MDPJwtPayload } from './client';

export const MDP_INFO_STORAGE_KEY = 'info';

/** Shape of `localStorage.info` written by mdp-ui-new after login. */
export interface MDPStorageInfo {
  isPasswordExpired?: boolean;
  jwtToken?: string;
  resetJwtToken?: string;
  refreshToken?: string;
  authentication?: string;
  fname?: string;
  userEmailId?: string;
  lname?: string;
  mob?: string;
  userId?: number;
  isOtpEnable?: boolean;
  userName?: string;
  password?: string;
  token?: string;
  tokenObj?: {
    expiredTimeInSecond: number;
    token: string;
  };
}

export interface MDPSessionAuth {
  jwtToken: string;
  refreshToken?: string;
  userEmailId?: string;
  fname?: string;
  lname?: string;
  userId?: number;
  claims: MDPJwtPayload;
  isExpired: boolean;
  expiresAt: number;
}

export type MDPSessionAuthFailureReason =
  | 'missing'
  | 'invalid_json'
  | 'invalid_shape'
  | 'missing_token'
  | 'invalid_token';

export type MDPSessionAuthResult =
  | { ok: true; session: MDPSessionAuth }
  | { ok: false; reason: MDPSessionAuthFailureReason };

const DEFAULT_EXPIRY_SKEW_MS = 30_000;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === 'boolean';
}

/** Validate parsed JSON matches the expected MDP `info` object shape. */
export function isValidMDPStorageInfo(value: unknown): value is MDPStorageInfo {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const info = value as Record<string, unknown>;

  if (!isOptionalString(info.jwtToken)) return false;
  if (!isOptionalString(info.refreshToken)) return false;
  if (!isOptionalString(info.userEmailId)) return false;
  if (!isOptionalString(info.fname)) return false;
  if (!isOptionalString(info.lname)) return false;
  if (!isOptionalNumber(info.userId)) return false;
  if (!isOptionalBoolean(info.isPasswordExpired)) return false;
  if (!isOptionalString(info.authentication)) return false;
  if (!isOptionalString(info.resetJwtToken)) return false;
  if (!isOptionalString(info.mob)) return false;
  if (!isOptionalBoolean(info.isOtpEnable)) return false;
  if (!isOptionalString(info.userName)) return false;
  if (!isOptionalString(info.password)) return false;
  if (!isOptionalString(info.token)) return false;

  if (info.tokenObj !== undefined) {
    if (!info.tokenObj || typeof info.tokenObj !== 'object' || Array.isArray(info.tokenObj)) {
      return false;
    }
    const tokenObj = info.tokenObj as Record<string, unknown>;
    if (typeof tokenObj.expiredTimeInSecond !== 'number') return false;
    if (typeof tokenObj.token !== 'string') return false;
  }

  return true;
}

export function parseMDPStorageInfo(raw: string | null): MDPStorageInfo | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return isValidMDPStorageInfo(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readMDPStorageInfo(): MDPStorageInfo | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return parseMDPStorageInfo(window.localStorage.getItem(MDP_INFO_STORAGE_KEY));
}

/** Decode a JWT payload without verifying the signature. */
export function decodeMDPJwtClaims(token: string): MDPJwtPayload | null {
  try {
    const segments = token.split('.');
    if (segments.length < 2) {
      return null;
    }

    const base64Url = segments[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const jsonPayload = decodeURIComponent(
      atob(padded)
        .split('')
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(''),
    );

    const parsed: unknown = JSON.parse(jsonPayload);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const claims = parsed as Record<string, unknown>;
    if (!isNonEmptyString(claims.sub)) return null;
    if (!isNonEmptyString(claims.preferred_username)) return null;
    if (!isNonEmptyString(claims.OrganizationId)) return null;
    if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) return null;

    return {
      sub: claims.sub,
      preferred_username: claims.preferred_username,
      OrganizationId: claims.OrganizationId,
      exp: claims.exp,
    };
  } catch {
    return null;
  }
}

export function isJwtExpired(
  claims: Pick<MDPJwtPayload, 'exp'>,
  skewMs: number = DEFAULT_EXPIRY_SKEW_MS,
): boolean {
  return claims.exp * 1000 <= Date.now() + skewMs;
}

export function getMDPSessionAuth(
  info: MDPStorageInfo,
  options?: { skewMs?: number },
): MDPSessionAuthResult {
  if (!isNonEmptyString(info.jwtToken)) {
    return { ok: false, reason: 'missing_token' };
  }

  const claims = decodeMDPJwtClaims(info.jwtToken);
  if (!claims) {
    return { ok: false, reason: 'invalid_token' };
  }

  const skewMs = options?.skewMs ?? DEFAULT_EXPIRY_SKEW_MS;
  const expiresAt = claims.exp * 1000;

  return {
    ok: true,
    session: {
      jwtToken: info.jwtToken,
      refreshToken: info.refreshToken,
      userEmailId: info.userEmailId,
      fname: info.fname,
      lname: info.lname,
      userId: info.userId,
      claims,
      isExpired: isJwtExpired(claims, skewMs),
      expiresAt,
    },
  };
}

export function readMDPSessionAuth(options?: { skewMs?: number }): MDPSessionAuthResult {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ok: false, reason: 'missing' };
  }

  const raw = window.localStorage.getItem(MDP_INFO_STORAGE_KEY);
  if (!raw) {
    return { ok: false, reason: 'missing' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }

  if (!isValidMDPStorageInfo(parsed)) {
    return { ok: false, reason: 'invalid_shape' };
  }

  return getMDPSessionAuth(parsed, options);
}
