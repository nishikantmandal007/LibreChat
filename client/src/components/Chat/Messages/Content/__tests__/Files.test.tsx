import React from 'react';
import { RecoilRoot, useRecoilValue } from 'recoil';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { TMessage } from 'librechat-data-provider';
import Files from '../Files';
import store from '~/store';

jest.mock('~/components/Chat/Input/Files/FileContainer', () => ({
  __esModule: true,
  default: ({ file, onClick, subtitle }: any) => (
    <button type="button" data-testid={`file-${file.file_id}`} onClick={onClick}>
      <span>{file.filename}</span>
      {subtitle}
    </button>
  ),
}));

jest.mock('../FilePreviewDialog', () => ({
  __esModule: true,
  default: ({ open, fileName }: { open: boolean; fileName: string }) =>
    open ? <div data-testid="file-preview-dialog">{fileName}</div> : null,
}));

jest.mock('../Image', () => ({
  __esModule: true,
  default: ({ altText }: { altText?: string }) => <img alt={altText ?? ''} data-testid="image" />,
}));

function SafeFilePreviewObserver({ onChange }: { onChange: jest.Mock }) {
  const preview = useRecoilValue(store.safeFilePreview);
  React.useEffect(() => {
    onChange(preview);
  }, [onChange, preview]);
  return null;
}

const createMessage = (files: TMessage['files']): TMessage =>
  ({
    messageId: 'message-1',
    conversationId: 'conversation-1',
    parentMessageId: 'root',
    sender: 'User',
    text: 'Summarise this please',
    isCreatedByUser: true,
    files,
  }) as TMessage;

describe('message Files', () => {
  it('opens ready safe PDFs in the right-side safe preview state', async () => {
    const onPreviewChange = jest.fn();
    const message = createMessage([
      {
        file_id: 'safe-doc-1',
        filename: 'Project_synopsis.pdf',
        filepath: '/mdp/ai-safe/anonymize-file/download/safe-doc-1',
        type: 'application/pdf',
        safeFile: {
          status: 'ready',
          safeDocId: 'safe-doc-1',
          safeFilename: 'anonymized_Project_synopsis.pdf',
          mimeType: 'application/pdf',
          previewAnonymizedUrl: '/mdp/ai-safe/anonymize-file/download/safe-doc-1',
          downloadUrl: '/mdp/ai-safe/anonymize-file/download/safe-doc-1',
        },
      } as unknown as NonNullable<TMessage['files']>[number],
    ]);

    render(
      <RecoilRoot>
        <SafeFilePreviewObserver onChange={onPreviewChange} />
        <Files message={message} />
      </RecoilRoot>,
    );

    fireEvent.click(screen.getByTestId('file-safe-doc-1'));

    await waitFor(() => {
      expect(onPreviewChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          fileId: 'safe-doc-1',
          filename: 'Project_synopsis.pdf',
          safeFilename: 'anonymized_Project_synopsis.pdf',
          previewAnonymizedUrl: '/mdp/ai-safe/anonymize-file/download/safe-doc-1',
        }),
      );
    });
    expect(screen.queryByTestId('file-preview-dialog')).not.toBeInTheDocument();
  });

  it('keeps the existing preview dialog for regular non-safe files', () => {
    const message = createMessage([
      {
        file_id: 'plain-file-1',
        filename: 'plain.pdf',
        filepath: '/files/plain.pdf',
        type: 'application/pdf',
      },
    ]);

    render(
      <RecoilRoot>
        <Files message={message} />
      </RecoilRoot>,
    );

    fireEvent.click(screen.getByTestId('file-plain-file-1'));

    expect(screen.getByTestId('file-preview-dialog')).toHaveTextContent('plain.pdf');
  });
});
