import React from 'react';
import { render, screen } from '@testing-library/react';
import { RecoilRoot, type MutableSnapshot } from 'recoil';
import Header from '../Header';
import store from '~/store';

const mockUseMediaQuery = jest.fn();
const mockUseGetStartupConfig = jest.fn();
const mockUseHasAccess = jest.fn();

jest.mock('@librechat/client', () => ({
  useMediaQuery: (...args: unknown[]) => mockUseMediaQuery(...args),
}));

jest.mock('~/data-provider', () => ({
  useGetStartupConfig: () => mockUseGetStartupConfig(),
}));

jest.mock('~/hooks', () => ({
  useHasAccess: (...args: unknown[]) => mockUseHasAccess(...args),
}));

jest.mock('../Menus/Endpoints/ModelSelector', () => ({
  __esModule: true,
  default: () => <div data-testid="model-selector" />,
}));

jest.mock('../ExportAndShareMenu', () => ({
  __esModule: true,
  default: ({ isSharedButtonEnabled }: { isSharedButtonEnabled: boolean }) => (
    <div data-testid="export-menu" data-shared={String(isSharedButtonEnabled)} />
  ),
}));

jest.mock('../Menus', () => ({
  OpenSidebar: ({ className }: { className?: string }) => (
    <button className={className} data-testid="open-sidebar" type="button" />
  ),
}));

jest.mock('../Menus/BookmarkMenu', () => ({
  __esModule: true,
  default: () => <div data-testid="bookmark-menu" />,
}));

jest.mock('../TemporaryChat', () => ({
  TemporaryChat: () => <div data-testid="temporary-chat" />,
}));

function renderHeader(sidebarExpanded = false) {
  const initializeState = (snapshot: MutableSnapshot) => {
    snapshot.set(store.sidebarExpanded, sidebarExpanded);
  };

  return render(
    <RecoilRoot initializeState={initializeState}>
      <Header />
    </RecoilRoot>,
  );
}

describe('Header', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGetStartupConfig.mockReturnValue({
      data: {
        interface: {
          modelSelect: true,
          presets: true,
        },
        sharedLinksEnabled: true,
      },
    });
    mockUseHasAccess.mockReturnValue(true);
  });

  it('renders chat controls and right-side actions on desktop', () => {
    mockUseMediaQuery.mockReturnValue(false);

    renderHeader(false);

    expect(screen.getByTestId('model-selector')).toBeInTheDocument();
    expect(screen.getByTestId('bookmark-menu')).toBeInTheDocument();
    expect(screen.getByTestId('export-menu')).toHaveAttribute('data-shared', 'true');
    expect(screen.getByTestId('temporary-chat')).toBeInTheDocument();
  });

  it('hides model/action controls on mobile while the side nav is open', () => {
    mockUseMediaQuery.mockReturnValue(true);

    renderHeader(true);

    expect(screen.getByTestId('open-sidebar')).toBeInTheDocument();
    expect(screen.queryByTestId('model-selector')).not.toBeInTheDocument();
    expect(screen.queryByTestId('export-menu')).not.toBeInTheDocument();
    expect(screen.queryByTestId('temporary-chat')).not.toBeInTheDocument();
  });
});
