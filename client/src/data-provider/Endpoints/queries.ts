import { useRecoilValue } from 'recoil';
import { QueryKeys, dataService } from 'librechat-data-provider';
import { useQuery } from '@tanstack/react-query';
import type { QueryObserverResult, UseQueryOptions } from '@tanstack/react-query';
import type t from 'librechat-data-provider';
import store from '~/store';

export const useGetEndpointsQuery = <TData = t.TEndpointsConfig>(
  config?: UseQueryOptions<t.TEndpointsConfig, unknown, TData>,
): QueryObserverResult<TData> => {
  const queriesEnabled = useRecoilValue<boolean>(store.queriesEnabled);
  return useQuery<t.TEndpointsConfig, unknown, TData>(
    [QueryKeys.endpoints],
    () => dataService.getAIEndpoints(),
    {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      ...config,
      enabled: (config?.enabled ?? true) === true && queriesEnabled,
    },
  );
};

/**
 * Auth-aware query key so unauthenticated (login page) and authenticated
 * (chat page) configs are cached independently, preventing stale
 * unauthenticated config from persisting after login.
 */
export const startupConfigKey = (isAuthenticated: boolean) =>
  [QueryKeys.startupConfig, isAuthenticated] as const;

const MDP_DEFAULT_STARTUP_CONFIG: t.TStartupConfig = {
  appTitle: 'Maya AI',
  socialLogins: [],
  discordLoginEnabled: false,
  facebookLoginEnabled: false,
  githubLoginEnabled: false,
  googleLoginEnabled: false,
  openidLoginEnabled: false,
  openidLabel: '',
  openidImageUrl: '',
  appleLoginEnabled: false,
  samlLoginEnabled: false,
  ldap: { enabled: false },
  serverDomain: '',
  emailLoginEnabled: true,
  registrationEnabled: true,
  socialLoginEnabled: false,
  emailEnabled: false,
  checkBalance: false,
  showBirthdayIcon: false,
  helpAndFaqURL: '',
  modelSpecs: undefined,
  interface: {},
  balance: undefined,
  isFreeTier: false,
};

export const useGetStartupConfig = (
  config?: UseQueryOptions<t.TStartupConfig>,
): QueryObserverResult<t.TStartupConfig> => {
  return useQuery<t.TStartupConfig>(
    startupConfigKey(false),
    () => Promise.resolve(MDP_DEFAULT_STARTUP_CONFIG),
    {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      ...config,
      enabled: config?.enabled ?? true,
    },
  );
};
