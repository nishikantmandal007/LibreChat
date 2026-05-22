import { SystemRoles } from 'librechat-data-provider';
import { useAuthContext, useLocalize } from '~/hooks';
import { AdminSettings } from '~/components/Prompts';
import AutoSendPrompt from '../buttons/AutoSendPrompt';
import PromptSidePanel from './GroupSidePanel';
import FilterPrompts from './FilterPrompts';

export default function PromptsAccordion() {
  const { user } = useAuthContext();
  const localize = useLocalize();
  return (
    <PromptSidePanel className="h-auto border-r-0">
      <div className="flex items-center justify-between pt-2">
        <h2 className="truncate text-lg font-bold text-text-primary">
          {localize('com_ui_prompts')}
        </h2>
      </div>
      <FilterPrompts />
      {user?.role === SystemRoles.ADMIN && <AdminSettings />}
      <AutoSendPrompt />
    </PromptSidePanel>
  );
}
