import { useNavigate } from 'react-router-dom';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { useLocalize } from '~/hooks';
import CreatePromptForm from './CreatePromptForm';
import { cn } from '~/utils';

interface CreatePromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreatePromptModal({ open, onOpenChange }: CreatePromptModalProps) {
  const localize = useLocalize();
  const navigate = useNavigate();

  const handleSuccess = (groupId: string) => {
    onOpenChange(false);
    navigate(`/prompts/${groupId}`);
  };

  return (
    <Transition appear show={open}>
      <Dialog as="div" className="relative z-50" onClose={() => onOpenChange(false)}>
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70" aria-hidden="true" />
        </TransitionChild>

        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
            <DialogPanel
              className={cn(
                'aisafe-glass-dialog flex h-[680px] w-full max-w-[876px] flex-col overflow-hidden rounded-xl shadow-2xl backdrop-blur-2xl animate-in',
              )}
            >
              <DialogTitle className="flex shrink-0 items-center justify-between border-b border-white/[0.10] px-6 py-4" as="div">
                <h2 className="text-lg font-semibold text-text-primary">
                  {localize('com_ui_create_prompt')}
                </h2>
                <button
                  type="button"
                  className="rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
                  onClick={() => onOpenChange(false)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-text-primary"
                  >
                    <line x1="18" x2="6" y1="6" y2="18" />
                    <line x1="6" x2="18" y1="6" y2="18" />
                  </svg>
                  <span className="sr-only">{localize('com_ui_close')}</span>
                </button>
              </DialogTitle>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <CreatePromptForm onSuccess={handleSuccess} />
              </div>
            </DialogPanel>
          </div>
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}
