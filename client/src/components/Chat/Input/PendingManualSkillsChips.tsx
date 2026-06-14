import { memo, useCallback } from 'react';
import { X } from 'lucide-react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { useLocalize } from '~/hooks';
import store from '~/store';

function PendingManualSkillsChips({ conversationId }: { conversationId: string }) {
  const localize = useLocalize();
  const skills = useRecoilValue(store.pendingManualSkillsByConvoId(conversationId));
  const setSkills = useSetRecoilState(store.pendingManualSkillsByConvoId(conversationId));

  const remove = useCallback(
    (name: string) => {
      setSkills((prev) => prev.filter((s) => s !== name));
    },
    [setSkills],
  );

  if (skills.length === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 px-5 pb-0 pt-3"
      role="list"
      aria-label={localize('com_ui_skills_queued')}
    >
      {skills.map((name) => (
        <span key={name} role="listitem" className="aisafe-inline-skill-chip">
          <span className="max-w-[12rem] truncate">/{name}</span>
          <button
            type="button"
            aria-label={localize('com_ui_remove_skill_var', { 0: name })}
            onClick={() => remove(name)}
            className="skill-remove-btn"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
      ))}
    </div>
  );
}

export default memo(PendingManualSkillsChips);
