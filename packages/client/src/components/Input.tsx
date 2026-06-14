import * as React from 'react';
import { cn } from '~/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      className={cn(
        'glass-input flex h-10 w-full rounded-xl px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50',
        className ?? '',
      )}
      ref={ref}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export { Input };
