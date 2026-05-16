import {
  useMemo,
  useState,
  useEffect,
  useContext,
  useCallback,
  createContext,
} from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { useNavigate } from 'react-router-dom';
import { SystemRoles } from 'librechat-data-provider';
import type * as t from 'librechat-data-provider';
import type { ReactNode } from 'react';
import { TAuthConfig, TAuthContext } from '~/common';
import store from '~/store';

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
  avatar: undefined,
};

const AuthContextProvider = ({
  authConfig,
  children,
}: {
  authConfig?: TAuthConfig;
  children: ReactNode;
}) => {
  const [user, setUser] = useRecoilState(store.user);
  const [token] = useState<string | undefined>('guest-session');
  const [error, setError] = useState<string | undefined>(undefined);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const setQueriesEnabled = useSetRecoilState<boolean>(store.queriesEnabled);

  const navigate = useNavigate();

  useEffect(() => {
    setUser(GUEST_USER);
    setIsAuthenticated(true);
    setQueriesEnabled(true);

    const path = window.location.pathname;
    if (path === '/login' || path === '/' || path === '/register') {
      navigate('/c/new', { replace: true });
    }
  }, [setUser, setQueriesEnabled, navigate]);

  const login = useCallback(
    (_data: t.TLoginUser) => {
      navigate('/c/new', { replace: true });
    },
    [navigate],
  );

  const logout = useCallback(
    (_redirect?: string) => {
      navigate('/c/new', { replace: true });
    },
    [navigate],
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
        [SystemRoles.USER]: null,
        [SystemRoles.ADMIN]: null,
      },
      isAuthenticated,
    }),
    [user, error, isAuthenticated, token, login, logout],
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
