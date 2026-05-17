import { memo, useCallback } from 'react';
import { useSetRecoilState } from 'recoil';
import { FileText } from 'lucide-react';
import { activeSourceState } from '~/store/sources';
import type { TMessage } from 'librechat-data-provider';
import type { SourceCitation } from '~/store/sources';

interface Citation {
  file_name?: string;
  filename?: string;
  page?: number | string;
  chunk_id?: string;
  text?: string;
  source?: string;
}

const SourceCitations = ({ message }: { message: TMessage }) => {
  const setActiveSource = useSetRecoilState(activeSourceState);

  const citations: Citation[] =
    (message.metadata as Record<string, unknown>)?.citations as Citation[] ?? [];

  const handleClick = useCallback(
    (citation: Citation) => {
      const source: SourceCitation = {
        fileName: citation.file_name || citation.filename || citation.source || 'Document',
        page: citation.page,
        text: citation.text,
        chunkId: citation.chunk_id,
      };
      setActiveSource(source);
    },
    [setActiveSource],
  );

  if (citations.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <span className="text-xs font-medium text-text-secondary">Sources</span>
      <div className="flex flex-wrap gap-2">
        {citations.slice(0, 5).map((citation, index) => {
          const name =
            citation.file_name || citation.filename || citation.source || 'Document';
          const page = citation.page != null ? `, p. ${citation.page}` : '';
          return (
            <button
              key={`${name}-${citation.page}-${index}`}
              type="button"
              onClick={() => handleClick(citation)}
              className="flex items-center gap-1.5 rounded-lg border border-border-medium bg-surface-secondary px-2.5 py-1.5 text-xs text-text-primary transition-colors hover:bg-surface-hover"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
              <span className="truncate">
                {index + 1}. {name}
                {page}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default memo(SourceCitations);
