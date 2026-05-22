import React from 'react';
import { RecoilRoot, useRecoilValue } from 'recoil';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { TAttachment } from 'librechat-data-provider';
import Attachment from '../Attachment';
import store from '~/store';

jest.mock('~/hooks', () => ({
  useLocalize:
    () =>
    (key: string): string =>
      key,
  useAttachmentPreviewSync: () => ({ status: 'ready', previewError: undefined, isPolling: false }),
  useExpandCollapse: (isExpanded: boolean) => ({
    style: { display: 'grid', gridTemplateRows: isExpanded ? '1fr' : '0fr' },
    ref: { current: null },
  }),
}));

const mockHandleDownload = jest.fn();
jest.mock('../LogLink', () => ({
  useAttachmentLink: () => ({ handleDownload: mockHandleDownload }),
}));

jest.mock('~/components/Chat/Input/Files/FileContainer', () => ({
  __esModule: true,
  default: ({ file, onClick }: { file: { filename?: string }; onClick?: () => void }) => (
    <button type="button" data-testid="file-container" onClick={onClick}>
      {file.filename ?? ''}
    </button>
  ),
}));

jest.mock('~/components/Chat/Input/Files/FilePreview', () => ({
  __esModule: true,
  default: () => <div data-testid="file-preview" />,
}));

jest.mock('~/components/Chat/Messages/Content/Image', () => ({
  __esModule: true,
  default: ({ altText }: { altText?: string }) => <img alt={altText ?? ''} data-testid="image" />,
}));

jest.mock('~/components/Messages/Content/Mermaid/Mermaid', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => (
    <div data-testid="mermaid-render">{children}</div>
  ),
}));

jest.mock('~/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
  getFileType: () => ({ paths: [], color: '', title: 'Artifact' }),
  logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
  isArtifactRoute: () => false,
}));

function SafeFilePreviewObserver({ onChange }: { onChange: jest.Mock }) {
  const preview = useRecoilValue(store.safeFilePreview);
  React.useEffect(() => {
    onChange(preview);
  }, [onChange, preview]);
  return null;
}

describe('safe file message attachments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens the right-side safe preview panel instead of the legacy download flow', async () => {
    const onPreviewChange = jest.fn();
    const attachment = {
      file_id: 'safe-doc-1',
      filename: 'Project_synopsis.pdf',
      filepath: '/mdp/ai-safe/anonymize-file/download/safe-doc-1',
      type: 'application/pdf',
      maya_safe_file: {
        status: 'ready',
        safeDocId: 'safe-doc-1',
        safeFilename: 'anonymized_Project_synopsis.pdf',
        mimeType: 'application/pdf',
        previewAnonymizedUrl: '/mdp/ai-safe/anonymize-file/download/safe-doc-1',
        downloadUrl: '/mdp/ai-safe/anonymize-file/download/safe-doc-1',
      },
    } as unknown as TAttachment;

    render(
      <RecoilRoot>
        <SafeFilePreviewObserver onChange={onPreviewChange} />
        <Attachment attachment={attachment} />
      </RecoilRoot>,
    );

    fireEvent.click(screen.getByTestId('file-container'));

    await waitFor(() => {
      expect(onPreviewChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          fileId: 'safe-doc-1',
          filename: 'Project_synopsis.pdf',
          safeFilename: 'anonymized_Project_synopsis.pdf',
          mimeType: 'application/pdf',
          previewAnonymizedUrl: '/mdp/ai-safe/anonymize-file/download/safe-doc-1',
          downloadUrl: '/mdp/ai-safe/anonymize-file/download/safe-doc-1',
        }),
      );
    });
    expect(mockHandleDownload).not.toHaveBeenCalled();
  });
});
