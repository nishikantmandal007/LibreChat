import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'glass-surface rounded-xl text-[var(--glass-text)] font-medium',
        destructive:
          'glass-surface rounded-xl border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/30',
        outline:
          'glass-surface-subtle rounded-xl text-[var(--glass-text)] border-[var(--glass-border-outer)] hover:bg-[var(--glass-bg-hover)]',
        secondary: 'glass-surface-subtle rounded-xl text-[var(--glass-text-secondary)] hover:bg-[var(--glass-bg-hover)]',
        ghost: 'hover:bg-[var(--glass-bg-subtle)] hover:text-accent-foreground rounded-xl',
        link: 'text-primary underline-offset-4 hover:underline',
        // hardcoded text color because of WCAG contrast issues (text-white)
        submit: 'glass-surface rounded-xl border-teal-500/20 bg-teal-500/15 text-teal-300 hover:bg-teal-500/25 hover:border-teal-500/30',
        glass:
          'glass-surface rounded-xl text-[var(--glass-text)] font-medium',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-lg px-3',
        lg: 'h-11 rounded-lg px-8',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        type={asChild ? undefined : type}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
