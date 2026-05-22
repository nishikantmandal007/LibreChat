import { atom } from 'recoil';
import type { MayaSafeFileStatus } from '~/common';

export type SafeFilePreviewState = {
  fileId: string;
  filename?: string;
  safeFilename?: string;
  status: MayaSafeFileStatus;
  mimeType?: string;
  previewAnonymizedUrl?: string;
  anonymizedText?: string;
  previewText?: string;
  statusLabel?: string;
  downloadUrl?: string;
  previewOnly?: boolean;
};

export const safeFilePreview = atom<SafeFilePreviewState | null>({
  key: 'safeFilePreview',
  default: null,
});
