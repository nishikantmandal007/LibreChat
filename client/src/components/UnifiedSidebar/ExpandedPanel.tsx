import { memo, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRecoilValue, useSetRecoilState, useRecoilState } from 'recoil';
import { PanelLeftClose, PanelLeftOpen, Search, SquarePen, FileText } from 'lucide-react';
import { QueryKeys } from 'librechat-data-provider';
import { Button, TooltipAnchor } from '@librechat/client';
import type { NavLink } from '~/common';
import { CLOSE_SIDEBAR_ID } from '~/components/Chat/Menus/OpenSidebar';
import { useActivePanel, resolveActivePanel, DEFAULT_PANEL } from '~/Providers';
import { useLocalize, useNewConvo } from '~/hooks';
import { clearMessagesCache, cn } from '~/utils';
import store from '~/store';
import AccountSettings from '~/components/Nav/AccountSettings';

type NavLayout = 'icon' | 'row';

const rowButtonClass =
  'flex h-12 w-full items-center justify-start gap-3 rounded-xl px-3 text-base font-semibold text-text-primary transition-colors hover:bg-surface-hover';
const iconButtonClass =
  'flex h-11 w-11 items-center justify-center rounded-xl text-text-primary transition-colors hover:bg-surface-hover';
const AISAFE_BRAND_NAME = 'AI Safe';

const NewChatButton = memo(function NewChatButton({
  setActive,
  layout = 'icon',
}: {
  setActive: (id: string) => void;
  layout?: NavLayout;
}) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { newConversation } = useNewConvo();
  const conversation = useRecoilValue(store.conversationByIndex(0));
  const switchToHistory = useRecoilValue(store.newChatSwitchToHistory);
  const setDocumentCreatorActive = useSetRecoilState(store.documentCreatorActive);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setDocumentCreatorActive(false);
        clearMessagesCache(queryClient, conversation?.conversationId);
        queryClient.invalidateQueries([QueryKeys.messages]);
        newConversation();
        if (switchToHistory) {
          setActive(DEFAULT_PANEL);
        }
      }
    },
    [queryClient, conversation?.conversationId, newConversation, switchToHistory, setActive, setDocumentCreatorActive],
  );

  return (
    <TooltipAnchor
      side="right"
      description={localize('com_ui_new_chat')}
      render={
        <a
          href="/c/new"
          data-testid="new-chat-button"
          aria-label={localize('com_ui_new_chat')}
          className={layout === 'row' ? rowButtonClass : iconButtonClass}
          onClick={handleClick}
        >
          <SquarePen className="h-6 w-6 shrink-0" />
          {layout === 'row' && <span>{localize('com_ui_new_chat')}</span>}
        </a>
      }
    />
  );
});

const SearchButton = memo(function SearchButton({
  expanded,
  setActive,
  onExpand,
  layout = 'icon',
}: {
  expanded: boolean;
  setActive: (id: string) => void;
  onExpand?: () => void;
  layout?: NavLayout;
}) {
  const localize = useLocalize();
  const setSearchState = useSetRecoilState(store.search);

  const focusSearch = useCallback(() => {
    window.setTimeout(
      () => {
        document.getElementById('side-nav-search-input')?.focus();
      },
      expanded ? 0 : 320,
    );
  }, [expanded]);

  const handleClick = useCallback(() => {
    setActive(DEFAULT_PANEL);
    setSearchState((prev) => ({
      ...prev,
      enabled: true,
      isSearching: true,
    }));
    if (!expanded) {
      onExpand?.();
    }
    focusSearch();
  }, [expanded, focusSearch, onExpand, setActive, setSearchState]);

  return (
    <TooltipAnchor
      side="right"
      description={localize('com_nav_search_placeholder')}
      render={
        <Button
          size="icon"
          variant="ghost"
          aria-label={localize('com_nav_search_placeholder')}
          className={layout === 'row' ? rowButtonClass : iconButtonClass}
          onClick={handleClick}
        >
          <Search className="h-6 w-6 shrink-0" aria-hidden="true" />
          {layout === 'row' && <span>{localize('com_nav_search_placeholder')}</span>}
        </Button>
      }
    />
  );
});

const NavIconButton = memo(function NavIconButton({
  link,
  isActive,
  expanded,
  setActive,
  onExpand,
  onCollapse,
  layout = 'icon',
}: {
  link: NavLink;
  isActive: boolean;
  expanded: boolean;
  setActive: (id: string) => void;
  onExpand?: () => void;
  onCollapse?: () => void;
  layout?: NavLayout;
}) {
  const localize = useLocalize();
  const label = link.id === DEFAULT_PANEL ? localize('com_ui_chats') : localize(link.title);
  const setDocumentCreatorActive = useSetRecoilState(store.documentCreatorActive);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      setDocumentCreatorActive(false);
      if (link.onClick) {
        link.onClick(e);
        return;
      }
      if (isActive && expanded && layout === 'icon') {
        onCollapse?.();
        return;
      }
      if (!isActive) {
        setActive(link.id);
      }
      if (!expanded) {
        onExpand?.();
      }
    },
    [link, isActive, setActive, expanded, onExpand, onCollapse, layout, setDocumentCreatorActive],
  );

  return (
    <TooltipAnchor
      description={label}
      side="right"
      render={
        <Button
          size="icon"
          variant="ghost"
          aria-label={label}
          aria-pressed={isActive}
          className={cn(
            layout === 'row' ? rowButtonClass : iconButtonClass,
            isActive ? 'bg-surface-active-alt' : '',
          )}
          onClick={handleClick}
        >
          <link.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
          {layout === 'row' && <span>{label}</span>}
        </Button>
      }
    />
  );
});

const SidebarLogoButton = memo(function SidebarLogoButton({
  expanded,
  toggleLabel,
  toggleClick,
}: {
  expanded: boolean;
  toggleLabel: 'com_nav_close_sidebar' | 'com_nav_open_sidebar';
  toggleClick?: () => void;
}) {
  const localize = useLocalize();
  const [hovered, setHovered] = useState(false);
  const HoverIcon = expanded ? PanelLeftClose : PanelLeftOpen;

  return (
    <TooltipAnchor
      side={expanded ? 'bottom' : 'right'}
      description={localize(toggleLabel)}
      render={
        <Button
          id={expanded ? CLOSE_SIDEBAR_ID : undefined}
          data-testid={expanded ? 'close-sidebar-button' : 'open-sidebar-button'}
          size="icon"
          variant="ghost"
          aria-label={localize(toggleLabel)}
          aria-expanded={expanded}
          className="h-11 w-11 rounded-xl transition-colors hover:bg-surface-hover"
          onClick={toggleClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div className="relative h-9 w-9">
            <img
              src="assets/logo.png"
              alt=""
              aria-hidden="true"
              className={cn(
                'aisafe-sidebar-logo absolute inset-0 h-9 w-9 rounded-md object-cover transition-opacity duration-200',
                hovered ? 'opacity-0' : 'opacity-100',
              )}
            />
            <HoverIcon
              className={cn(
                'absolute inset-0 m-auto h-6 w-6 text-text-primary transition-opacity duration-200',
                hovered ? 'opacity-100' : 'opacity-0',
              )}
              aria-hidden="true"
            />
          </div>
        </Button>
      }
    />
  );
});

function ExpandedPanel({
  links,
  expanded = true,
  onCollapse,
  onExpand,
}: {
  links: NavLink[];
  expanded?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
}) {
  const localize = useLocalize();
  const { active, setActive } = useActivePanel();
  const effectiveActive = resolveActivePanel(active, links);
  const [documentCreatorActive, setDocumentCreatorActive] = useRecoilState(store.documentCreatorActive);

  const toggleLabel = expanded ? 'com_nav_close_sidebar' : 'com_nav_open_sidebar';
  const toggleClick = expanded ? onCollapse : onExpand;
  const visibleLinks = links.filter((link) => link.id !== 'hide-panel');

  if (expanded) {
    return (
      <div className="flex w-full flex-shrink-0 flex-col gap-1.5 bg-surface-primary-alt px-3 py-4">
        <div className="mb-5 flex min-h-16 items-center justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center">
              <img
                src="assets/logo.png"
                alt={AISAFE_BRAND_NAME}
                className="aisafe-sidebar-logo h-12 w-12 rounded-xl object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="aisafe-sidebar-wordmark truncate text-[1.55rem] font-extrabold leading-none text-text-primary">
                {AISAFE_BRAND_NAME}
              </div>
            </div>
          </div>
          <TooltipAnchor
            side="bottom"
            description={localize('com_nav_close_sidebar')}
            render={
              <Button
                id={CLOSE_SIDEBAR_ID}
                data-testid="close-sidebar-button"
                size="icon"
                variant="ghost"
                aria-label={localize('com_nav_close_sidebar')}
                aria-expanded={expanded}
                className="h-11 w-11 rounded-xl text-text-primary transition-colors hover:bg-surface-hover"
                onClick={onCollapse}
              >
                <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
              </Button>
            }
          />
        </div>
        <NewChatButton setActive={setActive} layout="row" />
        <SearchButton expanded={expanded} setActive={setActive} onExpand={onExpand} layout="row" />

        {/* Custom Navigation Tabs - Expanded Mode */}
        <div className="mt-3 flex flex-col gap-1 border-t border-border-light pt-3">
          <TooltipAnchor
            side="right"
            description={localize('com_ui_doc_creator')}
            render={
              <Button
                size="icon"
                variant="ghost"
                aria-label={localize('com_ui_doc_creator')}
                className={cn(
                  rowButtonClass,
                  documentCreatorActive ? 'bg-surface-active-alt' : 'opacity-80 hover:opacity-100'
                )}
                onClick={() => setDocumentCreatorActive(true)}
              >
                <FileText className="h-6 w-6 shrink-0" />
                <span>{localize('com_ui_doc_creator')}</span>
              </Button>
            }
          />
        </div>

        <div className="mt-3 flex flex-col gap-1">
          {visibleLinks.map((link) => (
            <NavIconButton
              key={link.id}
              link={link}
              isActive={link.id === effectiveActive}
              expanded={expanded}
              setActive={setActive}
              onExpand={onExpand}
              onCollapse={onCollapse}
              layout="row"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-16 flex-shrink-0 flex-col items-center gap-2 border-r border-border-light bg-surface-primary-alt px-2 py-4">
      <SidebarLogoButton expanded={expanded} toggleLabel={toggleLabel} toggleClick={toggleClick} />
      <div className="mb-1" />
      <NewChatButton setActive={setActive} />
      <SearchButton expanded={expanded} setActive={setActive} onExpand={onExpand} />

      {/* Custom Navigation Tabs - Collapsed Mode */}
      <div className="w-8 border-b border-border-light" />
      <div className="flex flex-col gap-1.5">
        <TooltipAnchor
          side="right"
          description={localize('com_ui_doc_creator')}
          render={
            <Button
              size="icon"
              variant="ghost"
              aria-label={localize('com_ui_doc_creator')}
              className={cn(
                iconButtonClass,
                documentCreatorActive ? 'bg-surface-active-alt' : 'opacity-80 hover:opacity-100'
              )}
              onClick={() => setDocumentCreatorActive(true)}
            >
              <FileText className="h-6 w-6 shrink-0" />
            </Button>
          }
        />
      </div>

      <div className="w-8 border-b border-border-light" />
      <div className="flex flex-col gap-1.5 overflow-y-auto">
        {visibleLinks.map((link) => (
          <NavIconButton
            key={link.id}
            link={link}
            isActive={link.id === effectiveActive}
            expanded={expanded ?? true}
            setActive={setActive}
            onExpand={onExpand}
            onCollapse={onCollapse}
          />
        ))}
      </div>

      <div className="mt-auto">
        <AccountSettings collapsed />
      </div>
    </div>
  );
}

export default memo(ExpandedPanel);
