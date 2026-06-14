import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '~/utils';

type TagProps = React.ComponentPropsWithoutRef<'div'> & {
  label: string;
  labelClassName?: string;
  CancelButton?: React.ReactNode;
  LabelNode?: React.ReactNode;
  onRemove?: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

const TagPrimitiveRoot = React.forwardRef<HTMLDivElement, TagProps>(
  (
    { CancelButton, LabelNode, label, onRemove, className = '', labelClassName = '', ...props },
    ref,
  ) => (
    <div
      ref={ref}
      {...props}
      className={cn(
        'flex max-h-8 items-center overflow-y-hidden rounded-3xl border border-[var(--glass-border-outer)] bg-[var(--glass-bg)] text-xs text-[var(--glass-text)] backdrop-blur-sm',
        className,
      )}
    >
      <div className={cn('ml-1 whitespace-pre-wrap px-2 py-1', labelClassName)}>
        {LabelNode ? <>{LabelNode} </> : null}
        {label}
      </div>
      {CancelButton
        ? CancelButton
        : onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(e);
              }}
              className="rounded-full bg-[var(--glass-bg-hover)] transition-colors duration-150 hover:bg-[var(--glass-bg-active)]"
              aria-label={`Remove ${label}`}
            >
              <X className="m-[1.5px] p-1" aria-hidden="true" />
            </button>
          )}
    </div>
  ),
);

TagPrimitiveRoot.displayName = 'Tag';

export const Tag = React.memo(TagPrimitiveRoot);
