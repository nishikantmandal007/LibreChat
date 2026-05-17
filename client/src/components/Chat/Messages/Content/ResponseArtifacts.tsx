import { memo } from 'react';
import { Download, FileText } from 'lucide-react';
import { useLocalize } from '~/hooks';
import type { TMessage } from 'librechat-data-provider';

interface ResponseArtifact {
  artifact_id?: string;
  filename?: string;
  format?: string;
  download_url?: string;
  preview_url?: string;
  metadata?: Record<string, unknown>;
}

const formatLabel = (format?: string) => {
  if (!format) {
    return 'Document';
  }
  return format === 'markdown' ? 'Markdown' : format.toUpperCase();
};

const ResponseArtifacts = ({ message }: { message: TMessage }) => {
  const localize = useLocalize();
  const artifacts: ResponseArtifact[] =
    ((message.metadata as Record<string, unknown>)?.artifacts as ResponseArtifact[]) ?? [];

  if (artifacts.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <span className="text-xs font-medium text-text-secondary">
        {localize('com_ui_artifacts')}
      </span>
      <div className="flex flex-wrap gap-2">
        {artifacts.slice(0, 4).map((artifact, index) => {
          const href = artifact.download_url || artifact.preview_url;
          const filename = artifact.filename || `Artifact ${index + 1}`;
          const privacyScope =
            typeof artifact.metadata?.privacy_scope === 'string'
              ? artifact.metadata.privacy_scope
              : 'anonymized_response';

          return (
            <a
              key={artifact.artifact_id || `${filename}-${index}`}
              href={href || '#'}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!href}
              className="flex min-h-9 max-w-full items-center gap-2 rounded-lg border border-border-medium bg-surface-secondary px-2.5 py-1.5 text-xs text-text-primary transition-colors hover:bg-surface-hover aria-disabled:pointer-events-none aria-disabled:opacity-60"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
              <span className="truncate">{filename}</span>
              <span className="shrink-0 rounded-md bg-surface-primary px-1.5 py-0.5 text-[11px] text-text-secondary">
                {formatLabel(artifact.format)}
              </span>
              {privacyScope === 'anonymized_response' && (
                <span className="shrink-0 rounded-md bg-green-50 px-1.5 py-0.5 text-[11px] text-green-700 dark:bg-green-950/40 dark:text-green-300">
                  {localize('com_ui_privacy_safe')}
                </span>
              )}
              <Download className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
            </a>
          );
        })}
      </div>
    </div>
  );
};

export default memo(ResponseArtifacts);
