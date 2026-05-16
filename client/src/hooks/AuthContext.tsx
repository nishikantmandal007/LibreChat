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
import { getCurrentUser, login as mdpLogin, logout as mdpLogout } from '~/services/mdp';
import { TAuthConfig, TAuthContext } from '~/common';
import store from '~/store';

const AuthContext = (import.meta.hot?.data?.__AuthContext ??
  createContext<TAuthContext | undefined>(undefined)) as React.Context<TAuthContext | undefined>;
if (import.meta.hot) {
  import.meta.hot.data.__AuthContext = AuthContext;
}

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
  const setQueriesEnabled = useSetRecoilState<boolean>(store.queriesEnabled);

  const navigate = useNavigate();

  useEffect(() => {
    const mdpUser = getCurrentUser();
    if (mdpUser) {
      const tUser: t.TUser = {
        id: mdpUser.id,
        email: mdpUser.email,
        name: mdpUser.name,
        username: mdpUser.email,
        role: SystemRoles.USER,
        provider: 'local',
        avatar: undefined,
      };
      setUser(tUser);
      setToken('mdp-authenticated');
      setIsAuthenticated(true);
      setQueriesEnabled(true);

      const path = window.location.pathname;
      if (path === '/login' || path === '/' || path === '/register') {
        navigate('/c/new', { replace: true });
      }
    }
  }, [setUser, setQueriesEnabled, navigate]);

  const login = useCallback(
    (data: t.TLoginUser) => {
      const jwtToken = (data as Record<string, string>).token ?? data.password;
      const mdpUser = mdpLogin(jwtToken);

      if (mdpUser) {
        const tUser: t.TUser = {
          id: mdpUser.id,
          email: mdpUser.email,
          name: mdpUser.name,
          username: mdpUser.email,
          role: SystemRoles.USER,
          provider: 'local',
          avatar: undefined,
        };
        setUser(tUser);
        setToken('mdp-authenticated');
        setIsAuthenticated(true);
        setQueriesEnabled(true);
        setError(undefined);
        navigate('/c/new', { replace: true });
      } else {
        setError('Invalid or expired JWT token');
      }
    },
    [setUser, setQueriesEnabled, navigate],
  );

  const logout = useCallback(
    (_redirect?: string) => {
      mdpLogout();
      setUser(undefined);
      setToken(undefined);
      setIsAuthenticated(false);
      setQueriesEnabled(false);
      navigate('/login', { replace: true });
    },
    [setUser, setQueriesEnabled, navigate],
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
