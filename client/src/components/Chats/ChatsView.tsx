import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Search, SquarePen } from 'lucide-react';
import { Button, Spinner } from '@librechat/client';
import type { TConversation, ConversationListResponse } from 'librechat-data-provider';
import { useConversationsInfiniteQuery } from '~/data-provider';
import { useAuthContext, useLocalize, useNavigateToConvo } from '~/hooks';
import { groupConversationsByDate } from '~/utils';

/** Localize date-group keys produced by `groupConversationsByDate`; raw year strings pass through. */
function useGroupLabel() {
  const localize = useLocalize();
  return useCallback(
    (key: string) => (key.startsWith('com_ui_date_') ? localize(key as Parameters<typeof localize>[0]) : key.trim()),
    [localize],
  );
}

/**
 * Full-page "Chats" view (recents): lists every conversation grouped by date.
 * Clicking a row opens that conversation in-app via the SPA router. The sidebar
 * conversation list continues to work independently.
 */
export default function ChatsView() {
  const localize = useLocalize();
  const navigate = useNavigate();
  const groupLabel = useGroupLabel();
  const { isAuthenticated } = useAuthContext();
  const { navigateToConvo } = useNavigateToConvo();
  const [query, setQuery] = useState('');

  const { data, fetchNextPage, isFetchingNextPage, isLoading } = useConversationsInfiniteQuery(
    { search: query.trim() || undefined },
    { enabled: isAuthenticated, staleTime: 30000, cacheTime: 300000 },
  );

  const conversations = useMemo(
    () => (data ? data.pages.flatMap((page) => page.conversations) : []),
    [data],
  );

  const grouped = useMemo(() => groupConversationsByDate(conversations), [conversations]);

  const hasNextPage = useMemo(() => {
    const pages = data?.pages;
    if (pages && pages.length > 0) {
      const lastPage: ConversationListResponse = pages[pages.length - 1];
      return lastPage.nextCursor !== null;
    }
    return false;
  }, [data?.pages]);

  const openConvo = useCallback(
    (conversation: TConversation) => {
      navigateToConvo(conversation);
    },
    [navigateToConvo],
  );

  return (
    <div className="aisafe-chats-view mx-auto flex h-full w-full max-w-3xl flex-col px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-text-primary">{localize('com_ui_chats')}</h1>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => navigate('/c/new')}
          aria-label={localize('com_ui_new_chat')}
        >
          <SquarePen className="h-4 w-4" aria-hidden="true" />
          <span>{localize('com_ui_new_chat')}</span>
        </Button>
      </div>

      <div className="relative mb-4">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={localize('com_nav_search_placeholder')}
          aria-label={localize('com_nav_search_placeholder')}
          className="w-full rounded-xl border border-border-light bg-surface-secondary py-2.5 pl-9 pr-3 text-sm text-text-primary outline-none focus:border-border-heavy"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : conversations.length === 0 ? (
          <div className="py-10 text-center text-sm text-text-secondary">
            {localize('com_ui_no_results_found')}
          </div>
        ) : (
          grouped.map(([groupName, convos]) => (
            <section key={groupName} className="mb-5">
              <h2 className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-text-secondary">
                {groupLabel(groupName)}
              </h2>
              <ul>
                {convos.map((conversation) => (
                  <li key={conversation.conversationId}>
                    <button
                      type="button"
                      onClick={() => openConvo(conversation)}
                      className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-hover"
                    >
                      <span className="truncate text-sm text-text-primary">
                        {conversation.title || localize('com_ui_untitled')}
                      </span>
                      {conversation.updatedAt && (
                        <span className="shrink-0 text-xs text-text-secondary">
                          {formatDistanceToNow(new Date(conversation.updatedAt), {
                            addSuffix: true,
                          })}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        {hasNextPage && (
          <div className="flex justify-center py-4">
            <Button
              variant="outline"
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              {isFetchingNextPage ? <Spinner /> : localize('com_ui_show_all')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
