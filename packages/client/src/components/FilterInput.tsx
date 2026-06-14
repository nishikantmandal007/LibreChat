import * as React from 'react';
import { cn } from '~/utils';

export interface FilterInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'placeholder'> {
  /** The label text shown in the floating label */
  label: string;
  /** Unique identifier for the input - used to link label */
  inputId: string;
  /** Container className for custom styling */
  containerClassName?: string;
}

/**
 * A standardized filter/search input component with a floating label
 * that animates up when focused or has a value.
 *
 * @example
 * <FilterInput
 *   inputId="bookmarks-filter"
 *   label={localize('com_ui_bookmarks_filter')}
 *   value={searchQuery}
 *   onChange={(e) => setSearchQuery(e.target.value)}
 * />
 */
const FilterInput = React.forwardRef<HTMLInputElement, FilterInputProps>(
  ({ className, label, inputId, containerClassName, ...props }, ref) => {
    return (
      <div className={cn('relative', containerClassName)}>
        <input
          id={inputId}
          ref={ref}
          placeholder=" "
          aria-label={label}
          className={cn(
            'peer flex h-9 w-full rounded-lg border border-[var(--glass-border-outer)] bg-transparent px-3 py-2 text-sm text-[var(--glass-text)] ring-offset-background placeholder:text-[var(--glass-text-secondary)] focus-visible:outline-none focus-visible:border-[var(--glass-border-hover)] disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          {...props}
        />
        <label
          htmlFor={inputId}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--glass-text-secondary)] transition-all duration-200 peer-focus:top-0 peer-focus:glass-surface-subtle peer-focus:px-1 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:glass-surface-subtle peer-[:not(:placeholder-shown)]:px-1 peer-[:not(:placeholder-shown)]:text-xs"
        >
          {label}
        </label>
      </div>
    );
  },
);

FilterInput.displayName = 'FilterInput';

export { FilterInput };
