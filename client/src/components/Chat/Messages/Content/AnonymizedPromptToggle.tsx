import { memo } from 'react';
import { ScanText } from 'lucide-react';
import { cn } from '~/utils';

const AnonymizedPromptToggle = ({
  isShowing,
  onToggle,
  piiDetected,
  isLast = false,
}: {
  isShowing: boolean;
  onToggle: () => void;
  piiDetected: boolean;
  isLast?: boolean;
}) => {
  const title = !piiDetected
    ? 'No PII detected'
    : isShowing
      ? 'Show original prompt'
      : 'Show anonymized prompt';

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={isShowing}
      onClick={piiDetected ? onToggle : undefined}
      className={cn(
        'hover-button rounded-lg p-1.5 text-text-secondary-alt',
        'hover:bg-surface-hover hover:text-text-primary',
        'md:group-hover:visible md:group-focus-within:visible md:group-[.final-completion]:visible',
        !isLast && 'md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white',
        piiDetected && 'text-green-500 hover:text-green-400',
        isShowing && 'active bg-surface-hover text-green-400',
      )}
    >
      <ScanText size="19" />
    </button>
  );
};

export default memo(AnonymizedPromptToggle);
