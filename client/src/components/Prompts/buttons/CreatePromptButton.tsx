import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, TooltipAnchor } from '@librechat/client';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import { useHasAccess, useLocalize } from '~/hooks';
import CreatePromptModal from '../forms/CreatePromptModal';

export default function CreatePromptButton() {
  const localize = useLocalize();
  const hasCreateAccess = useHasAccess({
    permissionType: PermissionTypes.PROMPTS,
    permission: Permissions.CREATE,
  });
  const [open, setOpen] = useState(false);

  if (!hasCreateAccess) {
    return null;
  }

  return (
    <>
      <TooltipAnchor
        description={localize('com_ui_create_prompt')}
        side="bottom"
        render={
          <Button
            variant="outline"
            size="icon"
            className="size-9 shrink-0 bg-transparent"
            aria-label={localize('com_ui_create_prompt')}
            onClick={() => setOpen(true)}
          >
            <Plus className="size-4" aria-hidden="true" />
          </Button>
        }
      />
      <CreatePromptModal open={open} onOpenChange={setOpen} />
    </>
  );
}
