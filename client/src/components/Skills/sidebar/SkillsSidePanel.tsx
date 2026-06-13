import { useState, useMemo, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import { useToastContext } from '@librechat/client';
import { useListSkillsQuery, useImportSkillMutation } from '~/data-provider';
import { useDebounce, useHasAccess, useLocalize } from '~/hooks';
import { CreateSkillMenu } from '../buttons';
import SkillListPanel from '../lists/SkillList';
import { cn } from '~/utils';

interface SkillsSidePanelProps {
  className?: string;
}

/**
 * Claude.ai–style skills sidebar panel.
 * Header: "Skills" title + search icon + create menu (+ dropdown).
 * Body: "My Skills" collapsible section with skill list.
 */
const ACCEPTED_EXTENSIONS = /\.(md|skill)$/i;

export default function SkillsSidePanel({ className }: SkillsSidePanelProps) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { showToast } = useToastContext();
  const { skillId: activeSkillId } = useParams();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const debouncedSearch = useDebounce(searchTerm, 250);

  const hasCreateAccess = useHasAccess({
    permissionType: PermissionTypes.SKILLS,
    permission: Permissions.CREATE,
  });

  const listQuery = useListSkillsQuery({ search: debouncedSearch || undefined, limit: 50 });
  const skills = useMemo(() => listQuery.data?.skills ?? [], [listQuery.data]);

  const importMutation = useImportSkillMutation({
    onSuccess: (skill) => {
      if (skill?._id) {
        showToast({ status: 'success', message: localize('com_ui_skill_created') });
        navigate(`/skills/${skill._id}`);
      }
    },
    onError: () => {
      showToast({ status: 'error', message: localize('com_ui_create_skill_upload_error') });
    },
  });

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (!file || !ACCEPTED_EXTENSIONS.test(file.name)) {
        showToast({ status: 'error', message: 'Drop a .md or .skill file' });
        return;
      }
      const formData = new FormData();
      formData.append('file', file, file.name);
      importMutation.mutate(formData);
    },
    [importMutation, showToast],
  );

  const handleCloseSearch = () => {
    setSearchOpen(false);
    setSearchTerm('');
  };

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col overflow-hidden border-r border-border-light',
        isDragging && 'ring-2 ring-inset ring-ring-primary bg-surface-hover/50',
        className,
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Header — title+icons or inline search input */}
      <div className="flex items-center justify-between px-4 py-2">
        {searchOpen ? (
          <>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={localize('com_ui_search')}
                aria-label={localize('com_ui_search_skills')}
                className="h-8 w-full rounded-md border border-border-light bg-transparent pl-8 pr-3 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring-primary"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={handleCloseSearch}
              className="ml-2 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
              aria-label={localize('com_ui_close')}
            >
              <X className="size-4" />
            </button>
          </>
        ) : (
          <>
            <h2 className="truncate text-lg font-bold text-text-primary">
              {localize('com_ui_skills')}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="inline-flex size-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                aria-label={localize('com_ui_search')}
              >
                <Search className="size-4" />
              </button>
              {hasCreateAccess && <CreateSkillMenu />}
            </div>
          </>
        )}
      </div>

      {/* Skill list */}
      <div className="flex-1 overflow-y-auto px-4">
        <SkillListPanel
          skills={skills as unknown as import('librechat-data-provider').TSkill[]}
          isLoading={listQuery.isLoading}
          activeSkillId={activeSkillId}
        />
      </div>
    </div>
  );
}
