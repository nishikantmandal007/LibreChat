import { forwardRef, ReactNode, Ref } from 'react';
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './Dialog';
import { cn } from '~/utils/';

type SelectionProps = {
  selectHandler?: () => void;
  selectClasses?: string;
  selectText?: string;
};

type DialogTemplateProps = {
  title: string;
  description?: string;
  main?: ReactNode;
  buttons?: ReactNode;
  leftButtons?: ReactNode;
  selection?: SelectionProps;
  className?: string;
  headerClassName?: string;
  footerClassName?: string;
  showCloseButton?: boolean;
  showCancelButton?: boolean;
};

const DialogTemplate = forwardRef((props: DialogTemplateProps, ref: Ref<HTMLDivElement>) => {
  const {
    title,
    description,
    main,
    buttons,
    leftButtons,
    selection,
    className,
    headerClassName,
    footerClassName,
    showCloseButton,
    showCancelButton = true,
  } = props;
  const { selectHandler, selectClasses, selectText } = selection || {};
  const Cancel = 'cancel';

  const defaultSelect =
    'glass-surface text-[var(--glass-text)] transition-all disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <DialogContent
      showCloseButton={showCloseButton}
      ref={ref}
      className={cn('shadow-2xl', className || '')}
      onClick={(e) => e.stopPropagation()}
    >
      <DialogHeader className={cn(headerClassName ?? '')}>
        <DialogTitle className="text-lg font-medium leading-6 text-[var(--glass-text)]">
          {title}
        </DialogTitle>
        {description && (
          <DialogDescription className="text-[var(--glass-text-secondary)]">
            {description}
          </DialogDescription>
        )}
      </DialogHeader>
      <div className="px-6">{main ? main : null}</div>
      <DialogFooter className={footerClassName}>
        <div>{leftButtons ? leftButtons : null}</div>
        <div className="flex h-auto gap-3">
          {showCancelButton && (
            <DialogClose className="border-[var(--glass-border-outer)] hover:bg-[var(--glass-bg-hover)]">
              {Cancel}
            </DialogClose>
          )}
          {buttons ? buttons : null}
          {selection ? (
            <DialogClose
              onClick={selectHandler}
              className={`${
                selectClasses || defaultSelect
              } inline-flex h-10 items-center justify-center rounded-lg border-none px-4 py-2 text-sm`}
            >
              {selectText}
            </DialogClose>
          ) : null}
        </div>
      </DialogFooter>
    </DialogContent>
  );
});

export default DialogTemplate;
