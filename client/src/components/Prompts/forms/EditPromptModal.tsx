import { useEffect } from 'react';
import { FileText } from 'lucide-react';
import { useForm, Controller, FormProvider } from 'react-hook-form';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { Button, TextareaAutosize } from '@librechat/client';
import type { TPromptGroup } from 'librechat-data-provider';
import VariablesDropdown from '../editor/VariablesDropdown';
import PromptVariables from '../display/PromptVariables';
import Description from '../fields/Description';
import { useUpdatePromptGroup, useAddPromptToGroup } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface EditPromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: TPromptGroup;
}

type EditFormValues = {
  name: string;
  prompt: string;
  oneliner?: string;
  command?: string;
};

export default function EditPromptModal({ open, onOpenChange, group }: EditPromptModalProps) {
  const localize = useLocalize();

  const methods = useForm<EditFormValues>({
    defaultValues: {
      name: group.name ?? '',
      prompt: group.productionPrompt?.prompt ?? '',
      oneliner: group.oneliner ?? '',
      command: group.command ?? '',
    },
  });

  const {
    watch,
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting, errors, isValid },
  } = methods;

  useEffect(() => {
    if (open) {
      reset({
        name: group.name ?? '',
        prompt: group.productionPrompt?.prompt ?? '',
        oneliner: group.oneliner ?? '',
        command: group.command ?? '',
      });
    }
  }, [open, group, reset]);

  const updateGroup = useUpdatePromptGroup({
    onSuccess: () => onOpenChange(false),
  });

  const addPromptVersion = useAddPromptToGroup({
    onSuccess: () => onOpenChange(false),
  });

  const promptText = watch('prompt');

  const onSubmit = (data: EditFormValues) => {
    const groupId = group._id;
    if (!groupId) {
      return;
    }

    const promptChanged = data.prompt !== (group.productionPrompt?.prompt ?? '');
    if (promptChanged) {
      addPromptVersion.mutate({
        groupId,
        prompt: { type: 'text', prompt: data.prompt },
      });
    }

    const payload: Record<string, string> = {};
    if (data.name !== group.name) {
      payload.name = data.name;
    }
    if ((data.oneliner ?? '') !== (group.oneliner ?? '')) {
      payload.oneliner = data.oneliner ?? '';
    }
    if ((data.command ?? '') !== (group.command ?? '')) {
      payload.command = data.command ?? '';
    }

    if (Object.keys(payload).length > 0) {
      updateGroup.mutate({ id: groupId, payload });
    } else if (!promptChanged) {
      onOpenChange(false);
    }
  };

  const isSaving = isSubmitting || updateGroup.isLoading || addPromptVersion.isLoading;

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
            <DialogPanel className="aisafe-glass-dialog flex h-[680px] w-full max-w-[876px] flex-col overflow-hidden rounded-xl shadow-2xl backdrop-blur-2xl animate-in">
              <DialogTitle
                className="flex shrink-0 items-center justify-between border-b border-white/[0.10] px-6 py-4"
                as="div"
              >
                <h2 className="text-lg font-semibold text-text-primary">
                  {localize('com_ui_edit')} {localize('com_nav_prompt')}
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
                <FormProvider {...methods}>
                  <form onSubmit={handleSubmit(onSubmit)} className="w-full px-4 py-4">
                    <div className="mb-4">
                      <Controller
                        name="name"
                        control={control}
                        rules={{ required: localize('com_ui_prompt_name_required') }}
                        render={({ field }) => (
                          <div className="flex w-full flex-col">
                            <fieldset className="rounded-xl border border-white/[0.15] bg-white/[0.06] backdrop-blur-sm focus-within:border-white/[0.35] dark:border-white/[0.10] dark:bg-white/[0.04] dark:focus-within:border-white/[0.25]">
                              <legend className="ml-2 px-1 text-xs font-medium text-text-secondary">
                                {localize('com_ui_prompt_name')}*
                              </legend>
                              <input
                                {...field}
                                id="edit-prompt-name"
                                type="text"
                                className="-mt-1 w-full border-0 bg-transparent px-2 pb-2 text-xl text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-0"
                                aria-label={localize('com_ui_prompt_name')}
                              />
                            </fieldset>
                            {errors.name && (
                              <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
                            )}
                          </div>
                        )}
                      />
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col">
                        <header className="flex items-center justify-between rounded-t-xl border border-white/[0.12] bg-white/[0.06] p-2 backdrop-blur-md dark:border-white/[0.10] dark:bg-white/[0.04]">
                          <div className="ml-1 flex items-center gap-2">
                            <FileText className="size-4 text-text-secondary" aria-hidden="true" />
                            <h2 className="text-sm font-semibold text-text-primary">
                              {localize('com_ui_prompt_text')}*
                            </h2>
                          </div>
                          <VariablesDropdown fieldName="prompt" />
                        </header>
                        <div className="min-h-28 rounded-b-xl border border-t-0 border-white/[0.12] bg-white/[0.04] p-3 backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.02] sm:p-4">
                          <Controller
                            name="prompt"
                            control={control}
                            rules={{ required: localize('com_ui_prompt_text_required') }}
                            render={({ field }) => (
                              <TextareaAutosize
                                {...field}
                                className="w-full resize-none overflow-y-auto bg-transparent font-mono text-sm leading-relaxed text-text-primary placeholder:text-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary sm:text-base"
                                minRows={4}
                                maxRows={12}
                                placeholder={localize('com_ui_prompt_input')}
                                aria-label={localize('com_ui_prompt_input_field')}
                              />
                            )}
                          />
                        </div>
                      </div>

                      <PromptVariables promptText={promptText} />
                      <Description
                        onValueChange={(value) => methods.setValue('oneliner', value, { shouldDirty: true })}
                        tabIndex={0}
                      />

                      <div className="flex justify-end pb-2">
                        <Button
                          aria-label={localize('com_ui_save')}
                          className={cn('w-full sm:w-auto', (!isDirty || isSaving || !isValid) && 'opacity-50')}
                          type="submit"
                          aria-disabled={!isDirty || isSaving || !isValid || undefined}
                          onClick={(e: React.MouseEvent) => {
                            if (!isDirty || isSaving || !isValid) {
                              e.preventDefault();
                            }
                          }}
                        >
                          {localize('com_ui_save')}
                        </Button>
                      </div>
                    </div>
                  </form>
                </FormProvider>
              </div>
            </DialogPanel>
          </div>
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}
