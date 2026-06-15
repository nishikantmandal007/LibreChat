import { useMemo, useState, useEffect, useContext, useCallback, createContext } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { useNavigate } from 'react-router-dom';
import { SystemRoles, roleDefaults } from 'librechat-data-provider';
import type * as t from 'librechat-data-provider';
import type { ReactNode } from 'react';
import { TAuthConfig, TAuthContext } from '~/common';
import store from '~/store';
import { readMDPSessionAuth, clearMDPSessionAuth } from '~/services/mdp/sessionAuth';
import { ensureMDPSessionFresh } from '~/services/mdp/sessionRefresh';
import { toRouterBasename } from '~/utils/baseHref';

const AuthContext = (import.meta.hot?.data?.__AuthContext ??
  createContext<TAuthContext | undefined>(undefined)) as React.Context<TAuthContext | undefined>;
if (import.meta.hot) {
  import.meta.hot.data.__AuthContext = AuthContext;
}

const GUEST_USER: t.TUser = {
  id: 'guest',
  email: 'guest@maya.ai',
  name: 'Guest',
  username: 'guest',
  role: SystemRoles.USER,
  provider: 'local',
  avatar: '',
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

const AuthContextProvider = ({
  authConfig,
  children,
}: {
  authConfig?: TAuthConfig;
  children: ReactNode;
}) => {
  const [user, setUser] = useRecoilState(store.user);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const setQueriesEnabled = useSetRecoilState<boolean>(store.queriesEnabled);

  const navigate = useNavigate();

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      
      try {
        // Ensure session is fresh (refresh if expired)
        const isFresh = await ensureMDPSessionFresh();
        
        if (!isFresh) {
          setIsAuthenticated(false);
          setQueriesEnabled(false);
          setIsLoading(false);
          return;
        }

        const sessionResult = readMDPSessionAuth();
        
        if (!sessionResult.ok) {
          setIsAuthenticated(false);
          setQueriesEnabled(false);
          setIsLoading(false);
          return;
        }

        const session = sessionResult.session;
        
        // Build LibreChat user from MDP session
        const mdpUser: t.TUser = {
          id: session.userId?.toString() || session.claims.sub,
          email: session.userEmailId || session.claims.preferred_username,
          name: session.fname && session.lname 
            ? `${session.fname} ${session.lname}` 
            : session.userEmailId || session.claims.preferred_username,
          username: session.userEmailId || session.claims.preferred_username,
          role: SystemRoles.USER,
          provider: 'mdp',
          avatar: '',
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        };

        setUser(mdpUser);
        setToken(session.jwtToken);
        setIsAuthenticated(true);
        setQueriesEnabled(true);

        // Redirect from auth pages to chat if authenticated (base-path aware)
        const basename = toRouterBasename(import.meta.env.BASE_URL);
        const rawPath = window.location.pathname;
        const path =
          basename !== '/' && rawPath.startsWith(basename)
            ? rawPath.slice(basename.length) || '/'
            : rawPath;
        if (path === '/login' || path === '/' || path === '/register') {
          navigate('/c/new', { replace: true });
        }
      } catch (err) {
        console.error('Auth initialization failed:', err);
        setIsAuthenticated(false);
        setQueriesEnabled(false);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [setUser, setQueriesEnabled, navigate]);

  const login = useCallback(
    (_data: t.TLoginUser) => {
      navigate('/c/new', { replace: true });
    },
    [navigate],
  );

  const logout = useCallback(
    (_redirect?: string) => {
      clearMDPSessionAuth();
      setUser(GUEST_USER);
      setToken(undefined);
      setIsAuthenticated(false);
      setQueriesEnabled(false);
      navigate('/login', { replace: true });
    },
    [navigate, setUser, setQueriesEnabled],
  );

  const memoedValue = useMemo(
    () => ({
      user,
      token,
      error,
      login,
      logout,
      setError,
      roles: {
        [SystemRoles.USER]: roleDefaults[SystemRoles.USER],
        [SystemRoles.ADMIN]: roleDefaults[SystemRoles.ADMIN],
      },
      isAuthenticated,
      isLoading,
    }),
    [user, error, isAuthenticated, token, login, logout, isLoading],
  );

  return <AuthContext.Provider value={memoedValue}>{children}</AuthContext.Provider>;
};

const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext should be used inside AuthProvider');
  }
  return context;
};

export { AuthContextProvider, useAuthContext, AuthContext };
