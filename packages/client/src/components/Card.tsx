import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/utils';

const cardVariants = cva('rounded-2xl p-6 transition-all duration-200', {
  variants: {
    variant: {
      default: 'glass-surface',
      glass: 'glass-surface',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props} />
  ),
);
Card.displayName = 'Card';

export { Card, cardVariants };
