import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RecoilRoot } from 'recoil';
import SafeFilePreviewPanel from '../SafeFilePreviewPanel';
import store from '~/store';
import { fetchSafeFileBlob } from '~/services/mdp/safeFiles';

const mockTriggerDownload = jest.fn();

jest.mock('@librechat/client', () => ({
  Button: ({ asChild, children, ...props }: any) => {
    const React = require('react');
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, props);
    }
    return <button {...props}>{children}</button>;
  },
  Spinner: () => <span data-testid="spinner" />,
}));

jest.mock('~/services/mdp/safeFiles', () => ({
  fetchSafeFileBlob: jest.fn(),
}));

jest.mock('~/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
  logger: {
    log: jest.fn(),
    error: jest.fn(),
  },
  triggerDownload: (...args: unknown[]) => mockTriggerDownload(...args),
}));

describe('SafeFilePreviewPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:authenticated-safe-file'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
  });

  it('renders only the authenticated anonymized file content', async () => {
    (fetchSafeFileBlob as jest.Mock).mockResolvedValue({
      text: () => Promise.resolve('Hello <PERSON_1>'),
    });

    render(
      <RecoilRoot
        initializeState={({ set }) => {
          set(store.safeFilePreview, {
            fileId: 'file-1',
            filename: 'customer-record.txt',
            safeFilename: 'customer-record.anonymized.txt',
            status: 'ready',
            mimeType: 'text/plain',
            previewAnonymizedUrl: '/safe-preview/customer-record.txt',
            anonymizedText: 'Hello <PERSON_1>',
            downloadUrl: '/safe-download/customer-record.txt',
          });
        }}
      >
        <SafeFilePreviewPanel />
      </RecoilRoot>,
    );

    expect(screen.getByText('customer-record.anonymized.txt')).toBeInTheDocument();
    expect(screen.getByText('Ready for Safe Chat')).toBeInTheDocument();
    expect(await screen.findByText('Hello <PERSON_1>')).toBeInTheDocument();
    expect(screen.queryByText(/PII/i)).not.toBeInTheDocument();
    expect(screen.queryByText('customer-record.txt')).not.toBeInTheDocument();
    expect(fetchSafeFileBlob).toHaveBeenCalledWith('/safe-preview/customer-record.txt');

    fireEvent.click(screen.getByLabelText('Download anonymized file'));

    await waitFor(() => {
      expect(fetchSafeFileBlob).toHaveBeenLastCalledWith(
        '/safe-download/customer-record.txt?download=1',
      );
    });
    expect(mockTriggerDownload).toHaveBeenCalledWith(
      'blob:authenticated-safe-file',
      'customer-record.anonymized.txt',
    );
  });

  it('renders a PDF safe file as an authenticated file preview instead of extracted text', async () => {
    (fetchSafeFileBlob as jest.Mock).mockResolvedValue(
      new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
    );

    render(
      <RecoilRoot
        initializeState={({ set }) => {
          set(store.safeFilePreview, {
            fileId: 'file-2',
            filename: 'project.pdf',
            safeFilename: 'anonymized_project.pdf',
            status: 'ready',
            mimeType: 'application/pdf',
            previewAnonymizedUrl: '/safe-preview/project.pdf',
            anonymizedText: 'extracted anonymized text',
            downloadUrl: '/safe-download/project.pdf',
          });
        }}
      >
        <SafeFilePreviewPanel />
      </RecoilRoot>,
    );

    const frame = await waitFor(() => {
      const iframe = document.querySelector('iframe');
      expect(iframe).toBeInTheDocument();
      return iframe as HTMLIFrameElement;
    });
    expect(frame).toHaveAttribute('src', 'blob:authenticated-safe-file');
    expect(screen.queryByText('extracted anonymized text')).not.toBeInTheDocument();
    expect(fetchSafeFileBlob).toHaveBeenCalledWith('/safe-preview/project.pdf');
  });
});
