import { cn } from '~/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-[var(--glass-bg-subtle)] opacity-50 dark:opacity-25',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
