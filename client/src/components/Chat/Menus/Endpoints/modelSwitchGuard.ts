import { Constants } from 'librechat-data-provider';

export type ModelSelection = {
  endpoint?: string | null;
  model?: string | null;
  modelSpec?: string | null;
};

export function isExistingChat(conversationId?: string | null): boolean {
  return Boolean(
    conversationId &&
      conversationId !== Constants.NEW_CONVO &&
      conversationId !== Constants.PENDING_CONVO,
  );
}

export function shouldBlockModelSwitch({
  conversationId,
  current,
  next,
}: {
  conversationId?: string | null;
  current: ModelSelection;
  next: ModelSelection;
}): boolean {
  if (!isExistingChat(conversationId)) {
    return false;
  }

  return (
    (current.endpoint ?? '') !== (next.endpoint ?? '') ||
    (current.model ?? '') !== (next.model ?? '') ||
    (current.modelSpec ?? '') !== (next.modelSpec ?? '')
  );
}
