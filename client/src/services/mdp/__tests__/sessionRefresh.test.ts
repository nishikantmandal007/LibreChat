import { requestModifyToken } from '../modifyToken';
import {
  ensureMDPSessionFresh,
  isMDPSessionAuthenticated,
  refreshMDPSessionFromStorage,
  refreshMDPSessionToken,
} from '../sessionRefresh';

jest.mock('../modifyToken', () => ({
  requestModifyToken: jest.fn(),
}));

const mockedRequestModifyToken = requestModifyToken as jest.Mock;

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
  userId: 42,
  isPasswordExpired: false,
};

describe('sessionRefresh', () => {
  afterEach(() => {
    localStorage.clear();
    mockedRequestModifyToken.mockReset();
  });

  describe('refreshMDPSessionToken', () => {
    it('updates localStorage.info.jwtToken on success', async () => {
      localStorage.setItem('info', JSON.stringify(validInfo));
      const refreshedToken = makeJwt({
        ...validClaims,
        exp: Math.floor(Date.now() / 1000) + 7200,
      });

      mockedRequestModifyToken.mockResolvedValue({
        success: true,
        data: { jwtToken: refreshedToken },
      });

      const result = await refreshMDPSessionToken('refresh-token-abc');

      expect(mockedRequestModifyToken).toHaveBeenCalledWith('refresh-token-abc');
      expect(result).toBe(refreshedToken);
      expect(JSON.parse(localStorage.getItem('info') ?? '{}').jwtToken).toBe(refreshedToken);
      expect(JSON.parse(localStorage.getItem('info') ?? '{}').refreshToken).toBe('refresh-token-abc');
    });
  });

  describe('refreshMDPSessionFromStorage', () => {
    it('clears auth when refresh fails', async () => {
      localStorage.setItem(
        'info',
        JSON.stringify({
          ...validInfo,
          jwtToken: makeJwt({ ...validClaims, exp: Math.floor(Date.now() / 1000) - 60 }),
        }),
      );

      mockedRequestModifyToken.mockRejectedValue(new Error('refresh failed'));

      const result = await refreshMDPSessionFromStorage();

      expect(result).toBeNull();
      const info = JSON.parse(localStorage.getItem('info') ?? '{}');
      expect(info.jwtToken).toBeUndefined();
      expect(info.refreshToken).toBeUndefined();
    });

    it('refreshes an expired JWT when refresh token is valid', async () => {
      const expiredToken = makeJwt({
        ...validClaims,
        exp: Math.floor(Date.now() / 1000) - 60,
      });
      const refreshedToken = makeJwt({
        ...validClaims,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      localStorage.setItem(
        'info',
        JSON.stringify({
          ...validInfo,
          jwtToken: expiredToken,
        }),
      );

      mockedRequestModifyToken.mockResolvedValue({
        success: true,
        data: { jwtToken: refreshedToken },
      });

      const result = await refreshMDPSessionFromStorage();

      expect(result).toBe(refreshedToken);
      expect(JSON.parse(localStorage.getItem('info') ?? '{}').jwtToken).toBe(refreshedToken);
    });
  });

  describe('ensureMDPSessionFresh', () => {
    it('returns true for a valid non-expired session', async () => {
      localStorage.setItem('info', JSON.stringify(validInfo));

      await expect(ensureMDPSessionFresh()).resolves.toBe(true);
      expect(mockedRequestModifyToken).not.toHaveBeenCalled();
    });

    it('refreshes before accepting an expired session', async () => {
      const expiredToken = makeJwt({
        ...validClaims,
        exp: Math.floor(Date.now() / 1000) - 60,
      });
      const refreshedToken = makeJwt({
        ...validClaims,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      localStorage.setItem(
        'info',
        JSON.stringify({
          ...validInfo,
          jwtToken: expiredToken,
        }),
      );

      mockedRequestModifyToken.mockResolvedValue({
        success: true,
        data: { jwtToken: refreshedToken },
      });

      await expect(ensureMDPSessionFresh()).resolves.toBe(true);
      expect(mockedRequestModifyToken).toHaveBeenCalledWith('refresh-token-abc');
      expect(JSON.parse(localStorage.getItem('info') ?? '{}').jwtToken).toBe(refreshedToken);
    });
  });

  describe('isMDPSessionAuthenticated', () => {
    it('returns false after refresh failure leaves auth cleared', async () => {
      localStorage.setItem(
        'info',
        JSON.stringify({
          ...validInfo,
          jwtToken: makeJwt({ ...validClaims, exp: Math.floor(Date.now() / 1000) - 60 }),
        }),
      );

      mockedRequestModifyToken.mockRejectedValue(new Error('refresh failed'));
      await refreshMDPSessionFromStorage();

      expect(isMDPSessionAuthenticated()).toBe(false);
    });

    it('returns true for a valid session', () => {
      localStorage.setItem('info', JSON.stringify(validInfo));
      expect(isMDPSessionAuthenticated()).toBe(true);
    });
  });
});
