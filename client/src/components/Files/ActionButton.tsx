import React from 'react';
import { Button } from '@librechat/client';
import { useLocalize } from '~/hooks';

type ActionButtonProps = {
  onClick: () => void;
};

export default function ActionButton({ onClick }: ActionButtonProps) {
  const localize = useLocalize();
  return (
    <div className="w-32">
      <Button
        className="glass-surface w-full rounded-xl p-0 text-[var(--glass-text)]"
        onClick={onClick}
      >
        {/* Action Button */}
        {localize('com_ui_action_button')}
      </Button>
    </div>
  );
}
