import { memo } from 'react';
import AddedConvo from './AddedConvo';
import type { TConversation } from 'librechat-data-provider';
import type { SetterOrUpdater } from 'recoil';

export default memo(function TextareaHeader({
  addedConvo,
  setAddedConvo,
}: {
  addedConvo: TConversation | null;
  setAddedConvo: SetterOrUpdater<TConversation | null>;
}) {
  if (!addedConvo) {
    return null;
  }
  return (
    <div className="glass-surface-subtle m-1.5 flex flex-col divide-y divide-[var(--glass-border)] overflow-hidden rounded-b-lg rounded-t-2xl">
      <AddedConvo addedConvo={addedConvo} setAddedConvo={setAddedConvo} />
    </div>
  );
});
