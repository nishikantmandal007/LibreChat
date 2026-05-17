import { memo, useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { X, FileText, BookOpen } from 'lucide-react';
import { activeSourceState } from '~/store/sources';

const SourcePanel = memo(function SourcePanel() {
  const [activeSource, setActiveSource] = useRecoilState(activeSourceState);

  const handleClose = useCallback(() => {
    setActiveSource(null);
  }, [setActiveSource]);

  if (!activeSource) {
    return null;
  }

  return (
    <div className="flex h-full flex-col bg-surface-primary">
      <div className="flex items-center justify-between border-b border-border-medium px-4 py-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <FileText className="h-4 w-4 shrink-0 text-text-secondary" />
          <span className="truncate text-sm font-medium text-text-primary">
            {activeSource.fileName}
          </span>
          {activeSource.page != null && (
            <span className="shrink-0 rounded bg-surface-tertiary px-1.5 py-0.5 text-xs text-text-secondary">
              p. {activeSource.page}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-md p-1 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeSource.text ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap rounded-lg border border-border-light bg-surface-secondary p-4 text-sm leading-relaxed text-text-primary">
              {activeSource.text}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-text-secondary">
            <BookOpen className="h-8 w-8 opacity-50" />
            <p className="text-sm">Source text not available for this citation.</p>
          </div>
        )}
      </div>
    </div>
  );
});

SourcePanel.displayName = 'SourcePanel';

export default SourcePanel;
