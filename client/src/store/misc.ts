import { atom, selectorFamily } from 'recoil';
import { TAttachment } from 'librechat-data-provider';
import { atomWithLocalStorage } from './utils';
import { BadgeItem } from '~/common';

const hideBannerHint = atomWithLocalStorage('hideBannerHint', [] as string[]);

const messageAttachmentsMap = atom<Record<string, TAttachment[] | undefined>>({
  key: 'messageAttachmentsMap',
  default: {},
});

/**
 * Selector to get attachments for a specific conversation.
 */
const conversationAttachmentsSelector = selectorFamily<
  Record<string, TAttachment[]>,
  string | undefined
>({
  key: 'conversationAttachments',
  get:
    (conversationId) =>
    ({ get }) => {
      if (!conversationId) {
        return {};
      }

      const attachmentsMap = get(messageAttachmentsMap);
      const result: Record<string, TAttachment[]> = {};

      // Filter to only include attachments for this conversation
      Object.entries(attachmentsMap).forEach(([messageId, attachments]) => {
        if (!attachments || attachments.length === 0) {
          return;
        }

        const relevantAttachments = attachments.filter(
          (attachment) => attachment.conversationId === conversationId,
        );

        if (relevantAttachments.length > 0) {
          result[messageId] = relevantAttachments;
        }
      });

      return result;
    },
});

const queriesEnabled = atom<boolean>({
  key: 'queriesEnabled',
  default: true,
});

const isEditingBadges = atom<boolean>({
  key: 'isEditingBadges',
  default: false,
});

const chatBadges = atomWithLocalStorage<Pick<BadgeItem, 'id'>[]>('chatBadges', [
  // When adding new badges, make sure to add them to useChatBadges.ts as well and add them as last item
  // DO NOT CHANGE THE ORDER OF THE BADGES ALREADY IN THE ARRAY
  { id: '1' },
  // { id: '2' },
]);

const imageGenEnabled = atom<boolean>({
  key: 'imageGenEnabled',
  default: false,
});

const imageGenPinned = atomWithLocalStorage<boolean>('imageGenPinned', false);

const documentExportEnabled = atom<boolean>({
  key: 'documentExportEnabled',
  default: false,
});

const documentExportPinned = atomWithLocalStorage<boolean>('documentExportPinned', false);

const mdpAnonymizationLanguage = atomWithLocalStorage<string>('mdpAnonymizationLanguage', 'de');

const documentCreatorActive = atom<boolean>({
  key: 'documentCreatorActive',
  default: false,
});

const meetingNotesActive = atom<boolean>({
  key: 'meetingNotesActive',
  default: false,
});

export default {
  hideBannerHint,
  messageAttachmentsMap,
  conversationAttachmentsSelector,
  queriesEnabled,
  isEditingBadges,
  chatBadges,
  imageGenEnabled,
  imageGenPinned,
  documentExportEnabled,
  documentExportPinned,
  mdpAnonymizationLanguage,
  documentCreatorActive,
  meetingNotesActive,
};
