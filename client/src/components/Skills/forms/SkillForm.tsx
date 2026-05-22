import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Info, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller, FormProvider } from 'react-hook-form';
import { Input, Button, Skeleton, TextareaAutosize, useToastContext } from '@librechat/client';
import {
  InvocationMode,
  SKILL_NAME_PATTERN,
  SKILL_NAME_MAX_LENGTH,
  SKILL_DESCRIPTION_MAX_LENGTH,
} from 'librechat-data-provider';
import type { TSkill, TSkillWarning, TUpdateSkillPayload } from 'librechat-data-provider';
import { useGetSkillQuery, useUpdateSkillMutation } from '~/data-provider';
import { useLocalize, useSkillPermissions } from '~/hooks';
import SkillContentEditor from './SkillContentEditor';
import InvocationModePicker from './InvocationModePicker';
import CategorySelector from './CategorySelector';
import DeleteSkill from '../dialogs/DeleteSkill';
import { ShareSkill } from '../buttons';
import { parseSkillMd } from '../utils/parseSkillMd';
import { cn } from '~/utils';

interface SkillFormValues {
  name: string;
  description: string;
  body: string;
  category: string;
  invocationMode: InvocationMode;
}

interface SkillFormProps {
  skillId: string;
}

function toValues(skill: TSkill | undefined): SkillFormValues | undefined {
  if (!skill) {
    return undefined;
  }
  const parsedBody = parseSkillMd(skill.body ?? '');
  return {
    name: skill.name,
    description: skill.description || parsedBody.description,
    body: skill.body ?? '',
    category: skill.category ?? '',
    // Phase 1: backend doesn't persist invocationMode yet — default to `auto`
    // so the picker has a selection. UI state only; discarded on save until
    // the backend lands the column.
    invocationMode: skill.invocationMode ?? InvocationMode.auto,
  };
}

export default function SkillForm({ skillId }: SkillFormProps) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { showToast } = useToastContext();
  const [warnings, setWarnings] = useState<TSkillWarning[] | null>(null);

  const skillQuery = useGetSkillQuery(skillId);
  const skill = skillQuery.data;
  const permissions = useSkillPermissions(skill);

  const values = useMemo(() => toValues(skill), [skill]);
  const [isEditingContent, setIsEditingContent] = useState(true);

  const methods = useForm<SkillFormValues>({
    defaultValues: {
      name: '',
      description: '',
      body: '',
      category: '',
      invocationMode: InvocationMode.auto,
    },
    values,
    mode: 'onChange',
  });
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isDirty, isValid, isSubmitting, errors },
  } = methods;

  useEffect(() => {
    setWarnings(null);
  }, [skillId]);

  const updateSkill = useUpdateSkillMutation({
    onSuccess: (updated) => {
      showToast({
        status: updated.warnings && updated.warnings.length > 0 ? 'warning' : 'success',
        message: localize('com_ui_skill_updated'),
      });
      setWarnings(updated.warnings ?? null);
      reset(toValues(updated));
    },
    onError: (error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        showToast({ status: 'warning', message: localize('com_ui_skill_update_conflict') });
        skillQuery.refetch();
        return;
      }
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        localize('com_ui_skill_update_error');
      showToast({ status: 'error', message });
    },
  });

  // `useCallback` would be a no-op: `updateSkill` is a React Query mutation
  // result with an unstable identity, and `handleSubmit` doesn't use
  // `onSubmit` as a memo dependency.
  const onSubmit = (data: SkillFormValues) => {
    if (!skill || updateSkill.isLoading) {
      return;
    }
    const trimmedName = data.name.trim();
    if (!SKILL_NAME_PATTERN.test(trimmedName)) {
      setError('name', { message: localize('com_ui_skill_name_invalid') });
      return;
    }
    const payload: TUpdateSkillPayload = {
      name: trimmedName,
      description: data.description.trim(),
      body: data.body,
      category: data.category || undefined,
      // `invocationMode` is deliberately NOT forwarded to the backend: the
      // column doesn't exist yet. Phase 2 will promote it to a first-class
      // payload field.
    };
    updateSkill.mutate({
      id: skill._id,
      expectedVersion: skill.version,
      payload,
    });
  };

  if (skillQuery.isLoading || permissions.isLoading) {
    return (
      <div className="w-full px-4 py-2">
        <Skeleton className="mb-3 h-10 w-72" />
        <Skeleton className="mb-3 h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (skillQuery.isError || !skill) {
    return (
      <div className="w-full px-4 py-6 text-sm text-text-secondary">
        <p className="font-medium text-text-primary">{localize('com_ui_skill_not_found')}</p>
        <p>{localize('com_ui_skill_not_found_description')}</p>
      </div>
    );
  }

  const readOnly = !permissions.canEdit;
  const saveDisabled = !isDirty || !isValid || isSubmitting || updateSkill.isLoading;
  const goBackToSkill = () => navigate(`/skills/${skill._id}`);

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="scrollbar-gutter-stable mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-4 overflow-y-auto px-4 py-4 [scrollbar-color:var(--border-medium)_transparent] [scrollbar-width:thin] sm:px-6 lg:px-8 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-medium [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2"
        aria-label={localize('com_ui_skill_edit_title')}
      >
        <h1 className="sr-only">{localize('com_ui_skill_edit_title')}</h1>

        <div className="bg-presentation/95 sticky top-0 z-20 -mx-4 -mt-4 border-b border-border-light px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-lg border border-border-light bg-surface-primary px-3 py-2 shadow-sm">
            <button
              type="button"
              onClick={goBackToSkill}
              className="flex min-w-0 items-center gap-2 text-left text-sm font-semibold text-text-primary hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{skill.displayTitle ?? skill.name}</span>
            </button>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="outline" onClick={goBackToSkill}>
                {localize('com_ui_cancel')}
              </Button>
              {!readOnly && (
                <Button
                  type="submit"
                  disabled={saveDisabled}
                  aria-disabled={saveDisabled || undefined}
                  className={cn(saveDisabled && 'opacity-50')}
                >
                  {localize('com_ui_save')}
                </Button>
              )}
            </div>
          </div>
        </div>

        <section className="rounded-lg border border-border-light bg-surface-primary p-4 shadow-sm sm:p-5">
          <div className="flex w-full flex-col items-start justify-between gap-3 sm:flex-row sm:items-start">
            <Controller
              name="name"
              control={control}
              rules={{
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
              }}
              render={({ field }) => (
                <div className="relative flex w-full max-w-xl flex-col">
                  <Input
                    {...field}
                    id="skill-name"
                    type="text"
                    readOnly={readOnly}
                    className="peer w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-2xl font-bold text-text-primary shadow-sm"
                    placeholder=" "
                    tabIndex={0}
                    aria-label={localize('com_ui_name')}
                    aria-required="true"
                    aria-invalid={errors.name ? 'true' : 'false'}
                    aria-describedby={errors.name ? 'skill-name-error' : undefined}
                  />
                  <label
                    htmlFor="skill-name"
                    className="pointer-events-none absolute -top-1 left-3 origin-[0] translate-y-3 scale-100 rounded bg-surface-secondary px-1 text-base text-text-secondary transition-transform duration-200 peer-placeholder-shown:translate-y-3 peer-placeholder-shown:scale-100 peer-focus:-translate-y-2 peer-focus:scale-75 peer-focus:text-text-primary peer-[:not(:placeholder-shown)]:-translate-y-2 peer-[:not(:placeholder-shown)]:scale-75"
                  >
                    {localize('com_ui_name')}*
                  </label>
                  <div
                    id="skill-name-error"
                    className={cn(
                      'mt-1 w-56 text-sm text-red-500',
                      errors.name ? 'visible h-auto' : 'invisible h-0',
                    )}
                    role={errors.name ? 'alert' : undefined}
                  >
                    {errors.name ? errors.name.message : ' '}
                  </div>
                </div>
              )}
            />
            <div className="flex shrink-0 items-center gap-2">
              <CategorySelector />
              <ShareSkill skill={skill} />
              {permissions.canDelete && (
                <DeleteSkill
                  skillId={skill._id}
                  skillName={skill.name}
                  onDelete={() => navigate('/skills', { replace: true })}
                />
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            <span className="rounded-md bg-surface-secondary px-2 py-0.5">
              {localize('com_ui_skill_version', { 0: String(skill.version) })}
            </span>
            <span className="rounded-md bg-surface-secondary px-2 py-0.5">{skill.authorName}</span>
          </div>

          {readOnly && (
            <div
              role="note"
              className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-600 dark:text-amber-400"
            >
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{localize('com_ui_skill_no_edit_permission')}</span>
            </div>
          )}

          {warnings && warnings.length > 0 && (
            <div
              role="alert"
              className="mt-4 flex flex-col gap-1 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-600 dark:text-amber-400"
            >
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4" aria-hidden="true" />
                {localize('com_ui_skill_warnings')}
              </div>
              <ul className="ml-6 list-disc">
                {warnings.map((w) => (
                  <li key={`${w.field}:${w.code}`}>{w.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5">
            <Controller
              name="description"
              control={control}
              rules={{
                required: localize('com_ui_skill_description_required'),
                maxLength: {
                  value: SKILL_DESCRIPTION_MAX_LENGTH,
                  message: localize('com_ui_skill_description_too_long', {
                    0: String(SKILL_DESCRIPTION_MAX_LENGTH),
                  }),
                },
              }}
              render={({ field }) => (
                <div className="flex flex-col">
                  <label
                    htmlFor="skill-description"
                    className="mb-1 text-sm font-medium text-text-secondary"
                  >
                    {localize('com_ui_description')}
                    <span className="ml-0.5 text-red-500">*</span>
                  </label>
                  <TextareaAutosize
                    {...field}
                    id="skill-description"
                    readOnly={readOnly}
                    minRows={2}
                    maxRows={6}
                    aria-label={localize('com_ui_description')}
                    aria-invalid={errors.description ? 'true' : 'false'}
                    aria-describedby={errors.description ? 'skill-description-error' : undefined}
                    className="w-full resize-none rounded-xl border border-border-medium bg-transparent p-3 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
                  />
                  <p className="mt-1 text-xs text-text-secondary">
                    {localize('com_ui_skill_description_field_hint')}
                  </p>
                  {errors.description && (
                    <p
                      id="skill-description-error"
                      className="mt-1 text-sm text-red-500"
                      role="alert"
                    >
                      {errors.description.message}
                    </p>
                  )}
                </div>
              )}
            />
          </div>
        </section>

        <section className="bg-surface-secondary/40 rounded-lg border border-border-light p-4 shadow-sm sm:p-5">
          <SkillContentEditor
            name="body"
            isEditing={isEditingContent}
            setIsEditing={setIsEditingContent}
          />
        </section>

        {!readOnly && (
          <div className="bg-presentation/95 sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-border-light px-1 py-3 backdrop-blur">
            <Button type="button" variant="outline" onClick={goBackToSkill}>
              {localize('com_ui_cancel')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => reset(values)}
              disabled={!isDirty}
              className={cn(!isDirty && 'opacity-50')}
            >
              {localize('com_ui_reset')}
            </Button>
            <Button
              type="submit"
              disabled={saveDisabled}
              aria-disabled={saveDisabled || undefined}
              className={cn('w-full sm:w-auto', saveDisabled && 'opacity-50')}
            >
              {localize('com_ui_save')}
            </Button>
          </div>
        )}
      </form>
    </FormProvider>
  );
}
