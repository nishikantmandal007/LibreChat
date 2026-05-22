import { useState } from 'react';
import { ChevronRight, FileText } from 'lucide-react';
import { Skeleton } from '@librechat/client';
import type { TPromptGroup } from 'librechat-data-provider';
import ChatGroupItem from './ChatGroupItem';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

export default function List({
  groups = [],
  isLoading,
  isChatRoute,
}: {
  groups?: TPromptGroup[];
  isLoading: boolean;
  isChatRoute?: boolean;
}) {
  const localize = useLocalize();
  const [sectionOpen, setSectionOpen] = useState(true);

  return (
    <section className="flex-grow" aria-label={localize('com_ui_prompt_groups')}>
      <div className="flex items-center justify-between px-2 pb-2">
        <button
          type="button"
          onClick={() => setSectionOpen((prev) => !prev)}
          className="flex cursor-pointer items-center gap-1.5"
          aria-expanded={sectionOpen}
        >
          <ChevronRight
            className={cn(
              'size-3 shrink-0 text-text-secondary transition-transform duration-200',
              sectionOpen && 'rotate-90',
            )}
            aria-hidden="true"
          />
          <span className="text-xs text-text-secondary">{localize('com_ui_my_prompts')}</span>
        </button>
      </div>
      {sectionOpen && (
        <div className="flex flex-col gap-px">
          {isLoading &&
            Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          {!isLoading && groups.length === 0 && (
            <div className="my-2 flex flex-col items-center justify-center rounded-lg border border-border-medium bg-transparent p-5 text-center">
              <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-surface-tertiary">
                <FileText className="size-5 text-text-secondary" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-text-primary">
                {localize('com_ui_no_prompts_title')}
              </p>
              <p className="mt-0.5 text-xs text-text-secondary">
                {localize('com_ui_add_first_prompt')}
              </p>
            </div>
          )}
          {groups.map((group) => (
            <ChatGroupItem key={group._id} group={group} isChatRoute={isChatRoute} />
          ))}
        </div>
      )}
    </section>
  );
}
