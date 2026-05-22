import React, { useCallback, useId, useMemo, useRef, useState } from 'react';
import * as Ariakit from '@ariakit/react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';
import {
  Code,
  Download,
  EarthIcon,
  Eye,
  MessageCircle,
  MoreVertical,
  SquarePen,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  DropdownPopup,
  OGDialog,
  OGDialogTemplate,
  TooltipAnchor,
  useToastContext,
} from '@librechat/client';
import {
  Constants,
  SKILL_NAME_PATTERN,
  type TSkill,
  type TUpdateSkillPayload,
} from 'librechat-data-provider';
import type { MenuItemProps } from '~/common';
import { useLocalize, useAuthContext, useSkillPermissions, useSkillActiveState } from '~/hooks';
import { useDeleteSkillMutation, useUpdateSkillMutation } from '~/data-provider';
import { ephemeralAgentByConvoId } from '~/store';
import { SkillToggle } from '../buttons';
import SkillMarkdownRenderer from './SkillMarkdownRenderer';
import { parseFrontmatter } from '../utils';
import { parseSkillMd } from '../utils/parseSkillMd';
import { triggerDownload } from '~/utils/downloadFile';
import store from '~/store';
import { cn } from '~/utils';

interface SkillDetailProps {
  skill: TSkill;
  onEdit?: () => void;
  onDelete?: () => void;
}

const SKIP_KEYS = new Set(['name', 'description']);

function safeSkillFileName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'skill'
  );
}

function buildSkillDownload(skill: TSkill): string {
  if (skill.body?.trim()) {
    return skill.body;
  }

  return [
    '---',
    `name: ${skill.name}`,
    `description: ${skill.description ?? ''}`,
    '---',
    '',
    `# ${skill.displayTitle ?? skill.name}`,
    '',
    skill.description ?? '',
    '',
  ].join('\n');
}

function ViewToggle({
  viewMode,
  setViewMode,
  localize,
}: {
  viewMode: 'rendered' | 'source';
  setViewMode: (mode: 'rendered' | 'source') => void;
  localize: ReturnType<typeof useLocalize>;
}) {
  return (
    <div
      role="group"
      className="inline-flex h-7 rounded-lg bg-surface-tertiary p-0.5 text-sm font-medium"
    >
      <button
        type="button"
        onClick={() => setViewMode('rendered')}
        className={cn(
          'flex items-center justify-center rounded-md px-1.5 transition-colors',
          viewMode === 'rendered'
            ? 'bg-surface-primary text-text-primary shadow-sm'
            : 'text-text-secondary hover:text-text-primary',
        )}
        aria-label={localize('com_ui_skill_view_rendered')}
        aria-pressed={viewMode === 'rendered'}
      >
        <Eye className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => setViewMode('source')}
        className={cn(
          'flex items-center justify-center rounded-md px-1.5 transition-colors',
          viewMode === 'source'
            ? 'bg-surface-primary text-text-primary shadow-sm'
            : 'text-text-secondary hover:text-text-primary',
        )}
        aria-label={localize('com_ui_skill_view_source')}
        aria-pressed={viewMode === 'source'}
      >
        <Code className="size-4" />
      </button>
    </div>
  );
}

export default function SkillDetail({ skill, onEdit, onDelete }: SkillDetailProps) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { showToast } = useToastContext();
  const permissions = useSkillPermissions(skill);
  const { isActive, toggle } = useSkillActiveState();
  const [viewMode, setViewMode] = useState<'rendered' | 'source'>('rendered');
  const [stickyMenuOpen, setStickyMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const stickyMenuId = useId();
  const skillEnabled = isActive(skill);
  const setPendingManualSkills = useSetRecoilState(
    store.pendingManualSkillsByConvoId(Constants.NEW_CONVO),
  );
  const setEphemeralAgent = useSetRecoilState(ephemeralAgentByConvoId(Constants.NEW_CONVO));

  const isPublic = skill.isPublic === true;
  const isShared = skill.author !== user?.id && Boolean(skill.authorName);
  const addedBy = isShared ? skill.authorName : localize('com_ui_you');
  const updatedDate = skill.updatedAt
    ? format(new Date(skill.updatedAt), 'MMM d, yyyy')
    : undefined;
  const triggerMode = skill.userInvocable === false ? 'Auto only' : 'Slash command + auto';

  const { fields: frontmatterFields, body: cleanBody } = useMemo(
    () => parseFrontmatter(skill.body ?? '', SKIP_KEYS),
    [skill.body],
  );
  const parsedSkillBody = useMemo(() => parseSkillMd(skill.body ?? ''), [skill.body]);
  const displayDescription = skill.description || parsedSkillBody.description;

  const replaceSkill = useUpdateSkillMutation({
    onSuccess: () => {
      showToast({ status: 'success', message: localize('com_ui_skill_updated') });
    },
    onError: (error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      const message =
        status === 409
          ? localize('com_ui_skill_update_conflict')
          : ((error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            localize('com_ui_skill_update_error'));
      showToast({ status: status === 409 ? 'warning' : 'error', message });
    },
  });

  const deleteSkill = useDeleteSkillMutation({
    onSuccess: () => {
      showToast({ status: 'success', message: localize('com_ui_skill_deleted') });
      setDeleteOpen(false);
      onDelete?.();
    },
    onError: () => {
      showToast({ status: 'error', message: localize('com_ui_skill_delete_error') });
    },
  });

  const handleTryInChat = useCallback(() => {
    setPendingManualSkills((prev) => (prev.includes(skill.name) ? prev : [...prev, skill.name]));
    setEphemeralAgent((prev) => {
      if (prev?.skills) {
        return prev;
      }
      return { ...(prev || {}), skills: true };
    });
    showToast({
      status: 'success',
      message: `${skill.displayTitle ?? skill.name} is ready in chat`,
    });
    navigate('/c/new', { state: { focusChat: true } });
  }, [
    navigate,
    setEphemeralAgent,
    setPendingManualSkills,
    showToast,
    skill.displayTitle,
    skill.name,
  ]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([buildSkillDownload(skill)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${safeSkillFileName(skill.name)}.md`);
  }, [skill]);

  const handleReplaceClick = useCallback(() => {
    if (!permissions.canEdit || replaceSkill.isLoading) {
      return;
    }
    replaceInputRef.current?.click();
  }, [permissions.canEdit, replaceSkill.isLoading]);

  const handleReplaceFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || !permissions.canEdit || replaceSkill.isLoading) {
        return;
      }

      try {
        const body = await file.text();
        const parsed = parseSkillMd(body);
        const nextName = parsed.name.trim() || skill.name;
        const nextDescription = parsed.description.trim() || skill.description;

        if (!SKILL_NAME_PATTERN.test(nextName)) {
          showToast({ status: 'error', message: localize('com_ui_skill_name_invalid') });
          return;
        }

        const payload: TUpdateSkillPayload = {
          name: nextName,
          description: nextDescription,
          body,
          category: skill.category || undefined,
        };

        replaceSkill.mutate({
          id: skill._id,
          expectedVersion: skill.version,
          payload,
        });
      } catch {
        showToast({ status: 'error', message: localize('com_ui_skill_update_error') });
      }
    },
    [
      localize,
      permissions.canEdit,
      replaceSkill,
      showToast,
      skill._id,
      skill.category,
      skill.description,
      skill.name,
      skill.version,
    ],
  );

  const dropdownItems = useMemo<MenuItemProps[]>(
    () => [
      {
        label: 'Try in chat',
        onClick: handleTryInChat,
        icon: <MessageCircle className="icon-sm mr-2 text-text-primary" aria-hidden="true" />,
      },
      {
        label: localize('com_ui_edit_skill'),
        onClick: onEdit,
        icon: <SquarePen className="icon-sm mr-2 text-text-primary" aria-hidden="true" />,
        show: permissions.canEdit && Boolean(onEdit),
      },
      {
        label: 'Replace',
        onClick: handleReplaceClick,
        icon: <Upload className="icon-sm mr-2 text-text-primary" aria-hidden="true" />,
        show: permissions.canEdit,
        disabled: replaceSkill.isLoading,
      },
      {
        label: localize('com_ui_download'),
        onClick: handleDownload,
        icon: <Download className="icon-sm mr-2 text-text-primary" aria-hidden="true" />,
      },
      {
        id: 'skill-delete-separator',
        separate: true,
        show: permissions.canDelete,
      },
      {
        label: 'Delete',
        onClick: () => setDeleteOpen(true),
        icon: <Trash2 className="icon-sm mr-2 text-red-500" aria-hidden="true" />,
        show: permissions.canDelete,
        className: 'text-red-500 hover:text-red-500',
      },
    ],
    [
      handleDownload,
      handleReplaceClick,
      handleTryInChat,
      localize,
      onEdit,
      permissions.canDelete,
      permissions.canEdit,
      replaceSkill.isLoading,
    ],
  );

  const renderActions = () => (
    <div className="flex shrink-0 items-center gap-2">
      <SkillToggle
        enabled={skillEnabled}
        onChange={() => toggle(skill)}
        ariaLabel={localize('com_ui_skill_toggle_active')}
      />
      <DropdownPopup
        portal={true}
        menuId={stickyMenuId}
        focusLoop={true}
        className="z-[125]"
        unmountOnHide={true}
        isOpen={stickyMenuOpen}
        setIsOpen={setStickyMenuOpen}
        trigger={
          <Ariakit.MenuButton
            aria-label={localize('com_nav_convo_menu_options')}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border-medium bg-surface-secondary text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
          >
            <MoreVertical className="size-4" aria-hidden="true" />
          </Ariakit.MenuButton>
        }
        items={dropdownItems}
      />
    </div>
  );

  return (
    <>
      <article
        className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col overflow-hidden px-4 py-4 sm:px-6 lg:px-8"
        aria-label={skill.name}
      >
        <section className="shrink-0 border-b border-black/5 pb-4 dark:border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-6 flex min-w-0 items-center gap-2">
                <h2 className="truncate text-xl font-bold text-text-primary" title={skill.name}>
                  {skill.displayTitle ?? skill.name}
                </h2>
                {isPublic && (
                  <TooltipAnchor
                    description={localize('com_ui_skill_sr_public')}
                    side="top"
                    render={
                      <EarthIcon
                        className="size-4 shrink-0 text-green-500"
                        aria-label={localize('com_ui_skill_sr_public')}
                      />
                    }
                  />
                )}
              </div>

              <div className="mb-3 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-text-secondary">Added by</div>
                  <div className="mt-1 text-sm font-semibold text-text-primary">{addedBy}</div>
                </div>
                <div>
                  <div className="text-xs text-text-secondary">Last updated</div>
                  <div className="mt-1 text-sm font-semibold text-text-primary">
                    {updatedDate ?? '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-text-secondary">Trigger</div>
                  <div className="mt-1 text-sm font-semibold text-text-primary">{triggerMode}</div>
                </div>
              </div>

              {displayDescription && (
                <div className="max-w-2xl">
                  <div className="text-xs text-text-secondary">Description</div>
                  <p className="mt-1 text-sm leading-6 text-text-primary">{displayDescription}</p>
                </div>
              )}
            </div>
            {renderActions()}
          </div>
        </section>

        <section className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-surface-hover shadow-sm ring-1 ring-black/5 dark:ring-white/10">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/5 px-4 py-3 dark:border-white/10">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Instructions</h3>
              <p className="text-xs text-text-secondary">
                Rendered view for reading, source view for exact SKILL.md content.
              </p>
            </div>
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} localize={localize} />
          </div>

          <div className="scrollbar-gutter-stable min-h-0 flex-1 overflow-y-auto [scrollbar-color:var(--border-medium)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-medium [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2">
            <div className="px-5 py-5">
              {viewMode === 'rendered' && frontmatterFields.length > 0 && (
                <div className="mb-5 grid grid-cols-[max-content_1fr] items-baseline gap-x-8 gap-y-2 border-b border-black/5 pb-5 dark:border-white/10">
                  {frontmatterFields.map(({ key, value }) => (
                    <React.Fragment key={key}>
                      <span className="text-xs text-text-secondary">{key}</span>
                      <span className="min-w-0 break-words text-sm font-medium text-text-primary">
                        {value}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              )}

              {viewMode === 'rendered' ? (
                <SkillMarkdownRenderer content={cleanBody} />
              ) : (
                <pre className="whitespace-pre-wrap rounded-lg bg-surface-secondary p-4 font-mono text-sm leading-relaxed text-text-primary">
                  {skill.body ?? ''}
                </pre>
              )}
            </div>
          </div>
        </section>
      </article>

      <input
        ref={replaceInputRef}
        type="file"
        accept=".md,.txt,text/markdown,text/plain"
        className="hidden"
        onChange={handleReplaceFile}
        aria-hidden="true"
      />

      <OGDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <OGDialogTemplate
          showCloseButton={false}
          title="Delete skill?"
          className="max-w-[450px]"
          main={
            <p className="text-left text-sm text-text-primary">
              {localize('com_ui_skill_delete_confirm', { 0: skill.name })}
            </p>
          }
          selection={{
            selectHandler: () => {
              if (!deleteSkill.isLoading) {
                deleteSkill.mutate({ id: skill._id });
              }
            },
            selectClasses:
              'bg-surface-destructive hover:bg-surface-destructive-hover transition-colors duration-200 text-white',
            selectText: 'Delete',
          }}
        />
      </OGDialog>
    </>
  );
}
