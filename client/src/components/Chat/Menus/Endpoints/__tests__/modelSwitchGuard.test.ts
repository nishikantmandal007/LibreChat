import { Constants } from 'librechat-data-provider';
import { isExistingChat, shouldBlockModelSwitch } from '../modelSwitchGuard';

describe('modelSwitchGuard', () => {
  const current = {
    endpoint: 'openAI',
    model: 'gpt-4o',
    modelSpec: '',
  };

  it.each([String(Constants.NEW_CONVO), String(Constants.PENDING_CONVO), null])(
    'allows model selection before a conversation exists (%s)',
    (conversationId) => {
      expect(
        shouldBlockModelSwitch({
          conversationId,
          current,
          next: {
            endpoint: 'anthropic',
            model: 'claude-opus-4-8',
            modelSpec: '',
          },
        }),
      ).toBe(false);
    },
  );

  it('blocks changing the model in an existing conversation', () => {
    expect(
      shouldBlockModelSwitch({
        conversationId: 'conversation-1',
        current,
        next: {
          endpoint: 'anthropic',
          model: 'claude-opus-4-8',
          modelSpec: '',
        },
      }),
    ).toBe(true);
  });

  it('blocks changing the model spec in an existing conversation', () => {
    expect(
      shouldBlockModelSwitch({
        conversationId: 'conversation-1',
        current,
        next: {
          ...current,
          modelSpec: 'another-spec',
        },
      }),
    ).toBe(true);
  });

  it('allows reselecting the current model in an existing conversation', () => {
    expect(
      shouldBlockModelSwitch({
        conversationId: 'conversation-1',
        current,
        next: current,
      }),
    ).toBe(false);
  });

  it('recognizes only persisted conversation IDs as existing chats', () => {
    expect(isExistingChat('conversation-1')).toBe(true);
    expect(isExistingChat(Constants.NEW_CONVO)).toBe(false);
    expect(isExistingChat(Constants.PENDING_CONVO)).toBe(false);
  });
});
