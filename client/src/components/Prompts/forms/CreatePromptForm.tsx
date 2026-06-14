import { useEffect } from 'react';
import { FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, TextareaAutosize, Input } from '@librechat/client';
import { useForm, Controller, FormProvider } from 'react-hook-form';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import VariablesDropdown from '../editor/VariablesDropdown';
import PromptVariables from '../display/PromptVariables';
import Description from '../fields/Description';
import { usePromptGroupsContext } from '~/Providers';
import { useLocalize, useHasAccess } from '~/hooks';
import Command from '../fields/Command';
import { useCreatePrompt } from '~/data-provider';
import { cn } from '~/utils';

type CreateFormValues = {
  name: string;
  prompt: string;
  type: 'text' | 'chat';
  oneliner?: string;
  command?: string;
};

const defaultPrompt: CreateFormValues = {
  name: '',
  prompt: '',
  type: 'text',
  oneliner: undefined,
  command: undefined,
};

const CreatePromptForm = ({
  defaultValues = defaultPrompt,
  onSuccess,
}: {
  defaultValues?: CreateFormValues;
  onSuccess?: (groupId: string) => void;
}) => {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { hasAccess: hasUseAccess } = usePromptGroupsContext() ?? {};
  const hasCreateAccess = useHasAccess({
    permissionType: PermissionTypes.PROMPTS,
    permission: Permissions.CREATE,
  });
  const hasAccess = hasUseAccess && hasCreateAccess;

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (!hasAccess && !onSuccess) {
      timeoutId = setTimeout(() => {
        navigate('/c/new');
      }, 1000);
    }
    return () => {
      clearTimeout(timeoutId);
    };
  }, [hasAccess, navigate, onSuccess]);

  const methods = useForm({
    defaultValues,
  });

  const {
    watch,
    control,
    handleSubmit,
    formState: { isDirty, isSubmitting, errors, isValid },
  } = methods;

  const createPromptMutation = useCreatePrompt({
    onSuccess: (response) => {
      const groupId = response.prompt.groupId;
      if (onSuccess && groupId) {
        onSuccess(groupId);
      } else {
        navigate(`/prompts/${groupId}`, { replace: true });
      }
    },
  });

  const promptText = watch('prompt');

  const onSubmit = (data: CreateFormValues) => {
    const { name, oneliner, command, ...rest } = data;
    const groupData: { name: string; oneliner?: string; command?: string } = { name };
    if ((oneliner?.length ?? 0) > 0) {
      groupData.oneliner = oneliner;
    }
    if ((command?.length ?? 0) > 0) {
      groupData.command = command;
    }
    createPromptMutation.mutate({
      prompt: rest,
      group: groupData,
    });
  };

  if (!hasAccess) {
    return null;
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="w-full px-4 py-2">
        <h1 className="sr-only">{localize('com_ui_create_prompt_page')}</h1>
        <div className="mb-1 flex flex-col items-center justify-between font-bold sm:text-xl md:mb-0 md:text-2xl">
          <div className="flex w-full flex-col items-center justify-between sm:flex-row">
            <Controller
              name="name"
              control={control}
              rules={{ required: localize('com_ui_prompt_name_required') }}
              render={({ field }) => (
                <div className="mb-1 flex w-full flex-col md:mb-0">
                  <fieldset className="rounded-xl border border-white/[0.15] bg-white/[0.06] backdrop-blur-sm focus-within:border-white/[0.35] dark:border-white/[0.10] dark:bg-white/[0.04] dark:focus-within:border-white/[0.25]">
                    <legend className="ml-2 px-1 text-xs font-medium text-text-secondary">
                      {localize('com_ui_prompt_name')}*
                    </legend>
                    <input
                      {...field}
                      id="prompt-name"
                      type="text"
                      className="-mt-1 w-full border-0 bg-transparent px-2 pb-2 text-xl text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-0"
                      tabIndex={0}
                      aria-label={localize('com_ui_prompt_name')}
                      aria-required="true"
                    />
                  </fieldset>
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
                  )}
                </div>
              )}
            />
          </div>
        </div>
        <div className="flex w-full flex-col gap-4 md:mt-[1.075rem]">
          <div className="flex flex-col">
            <header className="flex items-center justify-between rounded-t-xl border border-white/[0.12] bg-white/[0.06] p-2 backdrop-blur-md dark:border-white/[0.10] dark:bg-white/[0.04]">
              <div className="ml-1 flex items-center gap-2">
                <FileText className="size-4 text-text-secondary" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-text-primary">
                  {localize('com_ui_prompt_text')}*
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <VariablesDropdown fieldName="prompt" />
              </div>
            </header>
            <div className="min-h-32 rounded-b-xl border border-t-0 border-white/[0.12] bg-white/[0.04] p-3 backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.02] sm:p-4">
              <Controller
                name="prompt"
                control={control}
                rules={{ required: localize('com_ui_prompt_text_required') }}
                render={({ field }) => (
                  <div>
                    <TextareaAutosize
                      {...field}
                      className="w-full resize-none overflow-y-auto bg-transparent font-mono text-sm leading-relaxed text-text-primary placeholder:text-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary sm:text-base"
                      minRows={4}
                      maxRows={16}
                      tabIndex={0}
                      placeholder={localize('com_ui_prompt_input')}
                      aria-label={localize('com_ui_prompt_input_field')}
                      aria-required="true"
                    />
                    <div
                      className={cn(
                        'mt-1 text-sm text-red-500',
                        errors.prompt ? 'visible h-auto' : 'invisible h-0',
                      )}
                    >
                      {errors.prompt ? errors.prompt.message : ' '}
                    </div>
                  </div>
                )}
              />
            </div>
          </div>
          <PromptVariables promptText={promptText} />
          <Description
            onValueChange={(value) => methods.setValue('oneliner', value)}
            tabIndex={0}
          />
          <Command onValueChange={(value) => methods.setValue('command', value)} tabIndex={0} />
          <div className="mt-4 flex justify-end">
            <Button
              aria-label={localize('com_ui_create_prompt')}
              className={cn(
                'w-full sm:w-auto',
                (!isDirty || isSubmitting || !isValid) && 'opacity-50',
              )}
              tabIndex={0}
              type="submit"
              aria-disabled={!isDirty || isSubmitting || !isValid || undefined}
              onClick={(e: React.MouseEvent) => {
                if (!isDirty || isSubmitting || !isValid) {
                  e.preventDefault();
                }
              }}
            >
              {localize('com_ui_create_prompt')}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
};

export default CreatePromptForm;
