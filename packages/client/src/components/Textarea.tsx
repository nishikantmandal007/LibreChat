/* eslint-disable */
import * as React from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { cn } from '~/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'glass-input flex h-20 w-full resize-none rounded-xl px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
