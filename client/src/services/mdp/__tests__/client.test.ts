import { clearMDPToken, getMDPToken, mdpClient, setMDPToken } from '../client';

describe('mdp client token', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('reads jwtToken from localStorage.info', () => {
    localStorage.setItem('info', JSON.stringify({ jwtToken: 'info-jwt-token' }));

    expect(getMDPToken()).toBe('info-jwt-token');
  });

  it('prefers localStorage.info over legacy mdp_jwt_token', () => {
    localStorage.setItem('info', JSON.stringify({ jwtToken: 'info-jwt-token' }));
    localStorage.setItem('mdp_jwt_token', 'legacy-jwt-token');

    expect(getMDPToken()).toBe('info-jwt-token');
  });

  it('returns null when localStorage.info is absent', () => {
    expect(getMDPToken()).toBeNull();
  });

  it('writes tokens to localStorage.info instead of mdp_jwt_token', () => {
    setMDPToken('updated-jwt');

    expect(localStorage.getItem('mdp_jwt_token')).toBeNull();
    expect(JSON.parse(localStorage.getItem('info') ?? '{}')).toEqual({
      jwtToken: 'updated-jwt',
    });
  });

  it('preserves existing info fields when setting a token', () => {
    localStorage.setItem(
      'info',
      JSON.stringify({
        jwtToken: 'old-jwt',
        userEmailId: 'jane@example.com',
        userId: 42,
      }),
    );

    setMDPToken('new-jwt');

    expect(JSON.parse(localStorage.getItem('info') ?? '{}')).toEqual({
      jwtToken: 'new-jwt',
      userEmailId: 'jane@example.com',
      userId: 42,
    });
  });

  it('clears jwtToken from info without removing other session fields', () => {
    localStorage.setItem(
      'info',
      JSON.stringify({
        jwtToken: 'session-jwt',
        refreshToken: 'refresh-token',
        userId: 7,
      }),
    );

    clearMDPToken();

    expect(localStorage.getItem('mdp_jwt_token')).toBeNull();
    expect(JSON.parse(localStorage.getItem('info') ?? '{}')).toEqual({
      refreshToken: 'refresh-token',
      userId: 7,
    });
  });

  it('attaches Authorization header from localStorage.info on MDP requests', async () => {
    localStorage.setItem('info', JSON.stringify({ jwtToken: 'session-jwt' }));

    const adapter = jest.fn().mockImplementation((config) =>
      Promise.resolve({
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }),
    );

    await mdpClient.get('/mdp/ai-safe/chat', { adapter });

    expect(adapter).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer session-jwt',
        }),
      }),
    );
  });
});
