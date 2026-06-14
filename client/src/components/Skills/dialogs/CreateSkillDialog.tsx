import { useForm, FormProvider } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  OGDialog,
  OGDialogContent,
  TextareaAutosize,
  useToastContext,
} from '@librechat/client';
import {
  SKILL_NAME_PATTERN,
  SKILL_NAME_MAX_LENGTH,
  SKILL_DESCRIPTION_MAX_LENGTH,
} from 'librechat-data-provider';
import { useCreateSkillMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface CreateSkillDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  defaultName?: string;
  defaultDescription?: string;
  defaultBody?: string;
}

interface FormValues {
  name: string;
  description: string;
  body: string;
}

export default function CreateSkillDialog({
  isOpen,
  setIsOpen,
  defaultName = '',
  defaultDescription = '',
  defaultBody = '',
}: CreateSkillDialogProps) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { showToast } = useToastContext();

  const methods = useForm<FormValues>({
    defaultValues: { name: defaultName, description: defaultDescription, body: defaultBody },
    mode: 'onChange',
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { isValid, isSubmitting, errors },
  } = methods;

  const createSkill = useCreateSkillMutation({
    onSuccess: (skill) => {
      if (!skill?._id) {
        showToast({ status: 'error', message: localize('com_ui_skill_create_error') });
        return;
      }
      showToast({ status: 'success', message: localize('com_ui_skill_created') });
      setIsOpen(false);
      reset();
      navigate(`/skills/${skill._id}`);
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        localize('com_ui_skill_create_error');
      showToast({ status: 'error', message });
    },
  });

  const onSubmit = (data: FormValues) => {
    if (createSkill.isLoading) {
      return;
    }
    createSkill.mutate({
      name: data.name.trim(),
      description: data.description.trim(),
      body: data.body,
    });
  };

  const handleClose = () => {
    setIsOpen(false);
    reset();
  };

  const submitDisabled = !isValid || isSubmitting || createSkill.isLoading;

  return (
    <OGDialog open={isOpen} onOpenChange={setIsOpen}>
      <OGDialogContent className="w-full max-w-[876px] overflow-hidden">
        <FormProvider {...methods}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex h-[610px] min-w-0 flex-col overflow-hidden p-1 sm:p-2"
          >
            <h2 className="shrink-0 pb-3 text-lg font-bold text-text-primary">
              {localize('com_ui_skill_write_instructions')}
            </h2>

            <div className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-3 sm:gap-4 pr-1">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="create-skill-name" className="text-sm font-medium text-text-secondary">
                  {localize('com_ui_name')}
                </label>
                <input
                  id="create-skill-name"
                  placeholder={localize('com_ui_skill_name_placeholder')}
                  aria-invalid={errors.name ? 'true' : 'false'}
                  autoComplete="off"
                  className="flex h-10 w-full rounded-xl border border-white/[0.15] bg-white/[0.06] px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.10] dark:bg-white/[0.04]"
                  {...register('name', {
                    required: localize('com_ui_skill_name_required'),
                    pattern: {
                      value: SKILL_NAME_PATTERN,
                      message: localize('com_ui_skill_name_invalid'),
                    },
                    maxLength: {
                      value: SKILL_NAME_MAX_LENGTH,
                      message: localize('com_ui_skill_name_too_long', {
                        0: String(SKILL_NAME_MAX_LENGTH),
                      }),
                    },
                  })}
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="create-skill-description"
                  className="text-sm font-medium text-text-secondary"
                >
                  {localize('com_ui_description')}
                </label>
                <TextareaAutosize
                  id="create-skill-description"
                  minRows={2}
                  maxRows={4}
                  placeholder={localize('com_ui_skill_description_placeholder')}
                  aria-label={localize('com_ui_description')}
                  className="w-full resize-none rounded-xl border border-white/[0.15] bg-white/[0.06] px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary dark:border-white/[0.10] dark:bg-white/[0.04]"
                  {...register('description', {
                    required: localize('com_ui_skill_description_required'),
                    maxLength: {
                      value: SKILL_DESCRIPTION_MAX_LENGTH,
                      message: localize('com_ui_skill_description_too_long', {
                        0: String(SKILL_DESCRIPTION_MAX_LENGTH),
                      }),
                    },
                  })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="create-skill-body" className="text-sm font-medium text-text-secondary">
                  {localize('com_ui_skill_instructions')}
                </label>
                <TextareaAutosize
                  id="create-skill-body"
                  minRows={6}
                  maxRows={12}
                  placeholder={localize('com_ui_skill_instructions_placeholder')}
                  aria-label={localize('com_ui_skill_instructions')}
                  className="w-full resize-none rounded-xl border border-white/[0.15] bg-white/[0.06] px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary dark:border-white/[0.10] dark:bg-white/[0.04]"
                  {...register('body')}
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 pt-3">
              <Button type="button" variant="outline" onClick={handleClose}>
                {localize('com_ui_cancel')}
              </Button>
              <Button
                type="submit"
                disabled={submitDisabled}
                className={cn(submitDisabled && 'opacity-50')}
              >
                {localize('com_ui_create')}
              </Button>
            </div>
          </form>
        </FormProvider>
      </OGDialogContent>
    </OGDialog>
  );
}
