import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { Button, Spinner } from '@librechat/client';
import { Download, FileText, X } from 'lucide-react';
import { fetchSafeFileBlob } from '~/services/mdp/safeFiles';
import { cn, logger, triggerDownload } from '~/utils';
import store from '~/store';

function withDownloadFlag(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}download=1`;
}

function filenameExtension(filename: string | undefined): string {
  const normalized = filename?.split('?')[0]?.toLowerCase() ?? '';
  const dotIndex = normalized.lastIndexOf('.');
  return dotIndex >= 0 ? normalized.slice(dotIndex + 1) : '';
}

function isPdfPreview(mimeType: string | undefined, filename: string | undefined): boolean {
  return mimeType?.toLowerCase() === 'application/pdf' || filenameExtension(filename) === 'pdf';
}

function isImagePreview(mimeType: string | undefined, filename: string | undefined): boolean {
  const extension = filenameExtension(filename);
  return (
    mimeType?.toLowerCase().startsWith('image/') === true ||
    ['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp'].includes(extension)
  );
}

function isTextPreview(mimeType: string | undefined, filename: string | undefined): boolean {
  const normalizedMime = mimeType?.toLowerCase() ?? '';
  const extension = filenameExtension(filename);
  return (
    normalizedMime.startsWith('text/') ||
    ['csv', 'json', 'log', 'md', 'txt'].includes(extension) ||
    ['application/json', 'application/xml'].includes(normalizedMime)
  );
}

function getPreviewKind(mimeType: string | undefined, filename: string | undefined) {
  if (isPdfPreview(mimeType, filename)) {
    return 'pdf';
  }
  if (isImagePreview(mimeType, filename)) {
    return 'image';
  }
  if (isTextPreview(mimeType, filename)) {
    return 'text';
  }
  return 'unsupported';
}

export default function SafeFilePreviewPanel() {
  const preview = useRecoilValue(store.safeFilePreview);
  const setSafeFilePreview = useSetRecoilState(store.safeFilePreview);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blobText, setBlobText] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  const displayName =
    preview?.safeFilename ??
    preview?.filename ??
    (preview?.previewOnly ? 'Voice transcript' : 'Anonymized file');
  const inlinePreviewText = preview?.previewText ?? preview?.anonymizedText;
  const previewUrl =
    preview?.previewAnonymizedUrl ?? (inlinePreviewText ? undefined : preview?.downloadUrl);
  const downloadUrl = preview?.downloadUrl ?? preview?.previewAnonymizedUrl;
  const statusText = useMemo(() => {
    if (!preview) {
      return undefined;
    }
    if (preview.statusLabel) {
      return preview.statusLabel;
    }
    if (preview.previewOnly) {
      return 'Prompt-only transcript';
    }
    if (preview.status === 'ready') {
      return 'Ready for Safe Chat';
    }
    return preview.status;
  }, [preview]);
  const previewKind = useMemo(
    () => getPreviewKind(preview?.mimeType, displayName),
    [displayName, preview?.mimeType],
  );
  const downloadHref = useMemo(
    () => (downloadUrl ? withDownloadFlag(downloadUrl) : undefined),
    [downloadUrl],
  );
  const isGeneratedDocx = Boolean(
    preview?.previewOnly && preview?.downloadUrl && filenameExtension(displayName) === 'docx',
  );

  const clearBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setBlobUrl(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    clearBlobUrl();
    setBlobText(null);
    setPreviewError(false);

    if (!preview || !previewUrl || previewKind === 'unsupported') {
      setLoadingPreview(false);
      return () => {
        cancelled = true;
      };
    }

    setLoadingPreview(true);
    fetchSafeFileBlob(previewUrl)
      .then(async (blob) => {
        if (cancelled) {
          return;
        }

        if (previewKind === 'text') {
          const text = await blob.text();
          if (!cancelled) {
            setBlobText(text);
          }
          return;
        }

        const typedBlob =
          previewKind === 'pdf' && !blob.type
            ? new Blob([blob], { type: 'application/pdf' })
            : blob;
        const objectUrl = URL.createObjectURL(typedBlob);
        blobUrlRef.current = objectUrl;
        setBlobUrl(objectUrl);
      })
      .catch((error) => {
        logger.error('[SafeFilePreviewPanel] Failed to load anonymized preview:', error);
        if (!cancelled) {
          setPreviewError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingPreview(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clearBlobUrl, preview, previewKind, previewUrl]);

  useEffect(() => clearBlobUrl, [clearBlobUrl]);

  const handleDownload = useCallback(async () => {
    if (!downloadHref) {
      return;
    }

    try {
      const blob = await fetchSafeFileBlob(downloadHref);
      const objectUrl = URL.createObjectURL(blob);
      triggerDownload(objectUrl, displayName);
    } catch (error) {
      logger.error('[SafeFilePreviewPanel] Failed to download anonymized file:', error);
    }
  }, [displayName, downloadHref]);

  if (!preview) {
    return null;
  }

  const renderPreviewBody = () => {
    const shouldFetchPreview = Boolean(
      previewUrl && previewKind !== 'unsupported' && !previewError,
    );
    const waitingForBlobPreview =
      shouldFetchPreview && !loadingPreview && !blobUrl && !(previewKind === 'text' && blobText);

    if (loadingPreview || waitingForBlobPreview) {
      return (
        <div className="flex h-full items-center justify-center gap-2 p-6 text-sm text-text-secondary">
          <Spinner size={16} />
          <span>{preview.previewOnly ? 'Loading preview...' : 'Loading anonymized file...'}</span>
        </div>
      );
    }

    if (previewError) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-text-secondary">
          {preview.previewOnly
            ? 'Could not load the preview.'
            : 'Could not load the anonymized file preview. Use download to inspect the safe copy.'}
        </div>
      );
    }

    if (previewKind === 'text' && (blobText || (!previewUrl && inlinePreviewText))) {
      return (
        <pre
          key={preview.fileId}
          className="h-full overflow-auto whitespace-pre-wrap break-words bg-surface-primary p-5 font-mono text-sm leading-6 text-text-primary"
        >
          {blobText ?? inlinePreviewText}
        </pre>
      );
    }

    if (!previewUrl && inlinePreviewText) {
      return (
        <pre
          key={preview.fileId}
          className="h-full overflow-auto whitespace-pre-wrap break-words bg-surface-primary p-5 font-mono text-sm leading-6 text-text-primary"
        >
          {inlinePreviewText}
        </pre>
      );
    }

    if (!previewUrl || !blobUrl) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-text-secondary">
          {preview.previewOnly
            ? 'Preview is not available.'
            : 'An anonymized preview is not available for this file.'}
        </div>
      );
    }

    if (previewKind === 'image') {
      return (
        <div className="flex h-full items-center justify-center overflow-auto bg-surface-primary-alt p-4">
          <img
            src={blobUrl}
            alt={displayName}
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        </div>
      );
    }

    if (previewKind === 'pdf') {
      return <iframe src={blobUrl} title={displayName} className="h-full w-full bg-white" />;
    }

    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-text-secondary">
        {preview.previewOnly
          ? 'Preview is not supported for this file type.'
          : 'Preview is not supported for this anonymized file type. Use download to inspect the safe copy.'}
      </div>
    );
  };

  return (
    <section className="flex h-full w-full flex-col bg-surface-primary text-text-primary">
      <header className="flex h-[58px] flex-shrink-0 items-center justify-between gap-3 border-b border-border-light bg-surface-primary-alt px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-hover">
            {preview.previewOnly ? (
              <FileText className="h-5 w-5 text-sky-600" aria-hidden="true" />
            ) : (
              <FileText className="h-5 w-5 text-sky-600" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold" title={displayName}>
              {displayName}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{statusText}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {downloadHref && (
            <Button
              size={isGeneratedDocx ? 'sm' : 'icon'}
              variant="ghost"
              className={cn('h-9', isGeneratedDocx ? 'gap-1.5 px-3' : 'w-9')}
              aria-label={isGeneratedDocx ? 'Download DOCX' : 'Download anonymized file'}
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {isGeneratedDocx && <span>DOCX</span>}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9"
            aria-label="Close anonymized preview"
            onClick={() => setSafeFilePreview(null)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div
        className={cn(
          'min-h-0 flex-1 overflow-hidden',
          inlinePreviewText ? 'bg-surface-primary' : 'bg-surface-primary-alt',
        )}
      >
        {renderPreviewBody()}
      </div>
    </section>
  );
}
