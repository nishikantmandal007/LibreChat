import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import {
  Login,
  VerifyEmail,
  Registration,
  ResetPassword,
  ApiErrorWatcher,
  TwoFactorScreen,
  RequestPasswordReset,
} from '~/components/Auth';
import { MarketplaceProvider } from '~/components/Agents/MarketplaceContext';
import AgentMarketplace from '~/components/Agents/Marketplace';
import { OAuthSuccess, OAuthError } from '~/components/OAuth';
import { AuthContextProvider } from '~/hooks/AuthContext';
import { FEATURES } from '~/config/features';
import RouteErrorBoundary from './RouteErrorBoundary';
import StartupLayout from './Layouts/Startup';
import LoginLayout from './Layouts/Login';
import dashboardRoutes from './Dashboard';
import ShareRoute from './ShareRoute';
import ChatRoute from './ChatRoute';
import Search from './Search';
import Root from './Root';

import type { RouteObject } from 'react-router-dom';

const AuthLayout = () => (
  <AuthContextProvider>
    <Outlet />
    <ApiErrorWatcher />
  </AuthContextProvider>
);

const loadInlinePromptsView = () =>
  import('~/components/Prompts/layouts/InlinePromptsView').then((m) => ({
    Component: m.default,
  }));

const loadSkillsView = () =>
  import('~/components/Skills/layouts/SkillsView').then((m) => ({
    Component: m.default,
  }));

const baseEl = document.querySelector('base');
const baseHref = baseEl?.getAttribute('href') || '/';

const buildProtectedChildren = (): RouteObject[] => {
  const children: RouteObject[] = [
    {
      index: true,
      element: <Navigate to="/c/new" replace={true} />,
    },
    {
      path: 'c/:conversationId?',
      element: <ChatRoute />,
    },
  ];

  if (FEATURES.SEARCH) {
    children.push({
      path: 'search',
      element: <Search />,
    });
  }

  if (FEATURES.PROMPTS) {
    children.push(
      {
        path: 'prompts',
        element: <Navigate to="/prompts/new" replace={true} />,
      },
      {
        path: 'prompts/new',
        lazy: loadInlinePromptsView,
      },
      {
        path: 'prompts/:promptId',
        lazy: loadInlinePromptsView,
      },
    );
  }

  if (FEATURES.SKILLS) {
    children.push(
      {
        path: 'skills',
        lazy: loadSkillsView,
      },
      {
        path: 'skills/:skillId',
        lazy: loadSkillsView,
      },
      {
        path: 'skills/:skillId/edit',
        lazy: loadSkillsView,
      },
    );
  }

  if (FEATURES.MARKETPLACE) {
    children.push(
      {
        path: 'agents',
        element: (
          <MarketplaceProvider>
            <AgentMarketplace />
          </MarketplaceProvider>
        ),
      },
      {
        path: 'agents/:category',
        element: (
          <MarketplaceProvider>
            <AgentMarketplace />
          </MarketplaceProvider>
        ),
      },
    );
  }

  return children;
};

const buildTopLevelRoutes = (): RouteObject[] => {
  const routes: RouteObject[] = [];

  if (FEATURES.SHARE) {
    routes.push({
      path: 'share/:shareId',
      element: <ShareRoute />,
      errorElement: <RouteErrorBoundary />,
    });
  }

  routes.push(
    {
      path: 'oauth',
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: 'success',
          element: <OAuthSuccess />,
        },
        {
          path: 'error',
          element: <OAuthError />,
        },
      ],
    },
    {
      path: '/',
      element: <StartupLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: 'register',
          element: <Registration />,
        },
        {
          path: 'forgot-password',
          element: <RequestPasswordReset />,
        },
        {
          path: 'reset-password',
          element: <ResetPassword />,
        },
      ],
    },
    {
      path: 'verify',
      element: <VerifyEmail />,
      errorElement: <RouteErrorBoundary />,
    },
    {
      element: <AuthLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: '/',
          element: <LoginLayout />,
          children: [
            {
              path: 'login',
              element: <Login />,
            },
            ...(FEATURES.TWO_FACTOR
              ? [
                  {
                    path: 'login/2fa',
                    element: <TwoFactorScreen />,
                  },
                ]
              : []),
          ],
        },
        dashboardRoutes,
        {
          path: '/',
          element: <Root />,
          children: buildProtectedChildren(),
        },
      ],
    },
  );

  return routes;
};

export const router = createBrowserRouter(buildTopLevelRoutes(), { basename: baseHref });
