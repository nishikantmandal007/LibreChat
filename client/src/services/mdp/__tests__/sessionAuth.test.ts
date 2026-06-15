import {
  decodeMDPJwtClaims,
  getMDPSessionAuth,
  isJwtExpired,
  isValidMDPStorageInfo,
  parseMDPStorageInfo,
  readMDPSessionAuth,
} from '../sessionAuth';

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

const validClaims = {
  sub: 'user-123',
  preferred_username: 'jane.doe@example.com',
  OrganizationId: 'org-456',
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const validToken = makeJwt(validClaims);

const validInfo = {
  jwtToken: validToken,
  refreshToken: 'refresh-token-abc',
  userEmailId: 'jane.doe@example.com',
  fname: 'Jane',
  lname: 'Doe',
  userId: 42,
  isPasswordExpired: false,
};

describe('sessionAuth', () => {
  afterEach(() => {
    localStorage.clear();
  });

  describe('isValidMDPStorageInfo', () => {
    it('accepts a typical MDP info object', () => {
      expect(isValidMDPStorageInfo(validInfo)).toBe(true);
    });

    it('rejects non-objects and malformed fields', () => {
      expect(isValidMDPStorageInfo(null)).toBe(false);
      expect(isValidMDPStorageInfo('jwt')).toBe(false);
      expect(isValidMDPStorageInfo({ jwtToken: 123 })).toBe(false);
      expect(isValidMDPStorageInfo({ jwtToken: 'ok', userId: 'not-a-number' })).toBe(false);
    });
  });

  describe('parseMDPStorageInfo', () => {
    it('parses valid JSON', () => {
      expect(parseMDPStorageInfo(JSON.stringify(validInfo))).toEqual(validInfo);
    });

    it('returns null for missing, invalid JSON, or invalid shape', () => {
      expect(parseMDPStorageInfo(null)).toBeNull();
      expect(parseMDPStorageInfo('{bad json')).toBeNull();
      expect(parseMDPStorageInfo(JSON.stringify({ jwtToken: 1 }))).toBeNull();
    });
  });

  describe('decodeMDPJwtClaims', () => {
    it('decodes a base64url JWT payload', () => {
      expect(decodeMDPJwtClaims(validToken)).toEqual({
        sub: validClaims.sub,
        preferred_username: validClaims.preferred_username,
        OrganizationId: validClaims.OrganizationId,
        exp: validClaims.exp,
      });
    });

    it('returns null for malformed tokens', () => {
      expect(decodeMDPJwtClaims('not-a-jwt')).toBeNull();
      expect(decodeMDPJwtClaims(makeJwt({ exp: 1 }))).toBeNull();
    });
  });

  describe('isJwtExpired', () => {
    it('detects expired tokens with skew', () => {
      const expiredClaims = { exp: Math.floor(Date.now() / 1000) - 10 };
      expect(isJwtExpired(expiredClaims, 0)).toBe(true);
    });

    it('treats soon-to-expire tokens as expired when within skew', () => {
      const soonClaims = { exp: Math.floor((Date.now() + 15_000) / 1000) };
      expect(isJwtExpired(soonClaims, 30_000)).toBe(true);
      expect(isJwtExpired(soonClaims, 0)).toBe(false);
    });
  });

  describe('getMDPSessionAuth', () => {
    it('returns session fields and decoded claims for valid info', () => {
      const result = getMDPSessionAuth(validInfo, { skewMs: 0 });

      expect(result).toEqual({
        ok: true,
        session: {
          jwtToken: validToken,
          refreshToken: 'refresh-token-abc',
          userEmailId: 'jane.doe@example.com',
          fname: 'Jane',
          lname: 'Doe',
          userId: 42,
          claims: {
            sub: 'user-123',
            preferred_username: 'jane.doe@example.com',
            OrganizationId: 'org-456',
            exp: validClaims.exp,
          },
          isExpired: false,
          expiresAt: validClaims.exp * 1000,
        },
      });
    });

    it('flags expired JWTs without rejecting the parse', () => {
      const expiredToken = makeJwt({
        ...validClaims,
        exp: Math.floor(Date.now() / 1000) - 60,
      });

      const result = getMDPSessionAuth({ ...validInfo, jwtToken: expiredToken }, { skewMs: 0 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.session.isExpired).toBe(true);
      }
    });

    it('fails when jwtToken is missing or invalid', () => {
      expect(getMDPSessionAuth({})).toEqual({ ok: false, reason: 'missing_token' });
      expect(getMDPSessionAuth({ jwtToken: 'bad' })).toEqual({
        ok: false,
        reason: 'invalid_token',
      });
    });
  });

  describe('readMDPSessionAuth', () => {
    it('reads from localStorage.info', () => {
      localStorage.setItem('info', JSON.stringify(validInfo));

      const result = readMDPSessionAuth({ skewMs: 0 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.session.jwtToken).toBe(validToken);
        expect(result.session.userEmailId).toBe('jane.doe@example.com');
      }
    });

    it('reports missing and invalid storage states', () => {
      expect(readMDPSessionAuth()).toEqual({ ok: false, reason: 'missing' });

      localStorage.setItem('info', '{not-json');
      expect(readMDPSessionAuth()).toEqual({ ok: false, reason: 'invalid_json' });
    });
  });
});
