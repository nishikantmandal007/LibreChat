import { atom } from 'recoil';

export interface SourceCitation {
  fileName: string;
  page?: number | string;
  text?: string;
  chunkId?: string;
}

export const activeSourceState = atom<SourceCitation | null>({
  key: 'activeSourceState',
  default: null,
});
