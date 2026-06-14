import { memo, useEffect, useState } from 'react';

const QUOTE = 'Privacy is the quiet space where trust, thought, and better work begin.';

function InspirationalQuote({ className = '' }: { className?: string }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    const interval = window.setInterval(() => {
      setVisibleCount((count) => {
        if (count >= QUOTE.length) {
          window.clearInterval(interval);
          return count;
        }
        return count + 1;
      });
    }, 28);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <p className={`aisafe-handwritten-quote ${className}`} aria-label={QUOTE}>
      <span aria-hidden="true">
        {QUOTE.split('').map((character, index) => (
          <span
            key={`${character}-${index}`}
            className={index < visibleCount ? 'quote-character-visible' : 'quote-character'}
          >
            {character}
          </span>
        ))}
      </span>
    </p>
  );
}

export default memo(InspirationalQuote);
