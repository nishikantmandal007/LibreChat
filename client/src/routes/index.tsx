import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { ApiErrorWatcher } from '~/components/Auth';
import { MarketplaceProvider } from '~/components/Agents/MarketplaceContext';
import AgentMarketplace from '~/components/Agents/Marketplace';
import { AuthContextProvider } from '~/hooks/AuthContext';
import { FEATURES } from '~/config/features';
import RouteErrorBoundary from './RouteErrorBoundary';
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
      path: 'login',
      element: <Navigate to="/c/new" replace={true} />,
    },
    {
      path: 'register',
      element: <Navigate to="/c/new" replace={true} />,
    },
    {
      element: <AuthLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
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
