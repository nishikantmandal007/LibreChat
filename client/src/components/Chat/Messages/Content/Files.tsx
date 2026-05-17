import { useMemo, useState, useCallback, memo } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { getMayaSafeFileState } from '~/utils/mayaSafeFiles';
import FileContainer from '~/components/Chat/Input/Files/FileContainer';
import FilePreviewDialog from './FilePreviewDialog';
import Image from './Image';

import type { TFile, TMessage } from 'librechat-data-provider';

const Files = ({ message }: { message?: TMessage }) => {
  const imageFiles = useMemo(() => {
    return message?.files?.filter((file) => file.type?.startsWith('image/')) || [];
  }, [message?.files]);

  const otherFiles = useMemo(() => {
    return message?.files?.filter((file) => !file.type?.startsWith('image/')) || [];
  }, [message?.files]);

  const [selectedFile, setSelectedFile] = useState<Partial<TFile> | null>(null);

  const handleClose = useCallback((open: boolean) => {
    if (!open) {
      setSelectedFile(null);
    }
  }, []);

  return (
    <>
      {otherFiles.length > 0 &&
        otherFiles.map((file) => {
          const safeState = getMayaSafeFileState(file);
          return (
            <FileContainer
              key={file.file_id}
              file={file as TFile}
              onClick={() => setSelectedFile(file)}
              subtitle={
                safeState ? (
                  <div className="flex items-center gap-1 truncate text-xs text-emerald-600" title="Safe copy">
                    {safeState.status === 'ready' ? (
                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                    ) : (
                      <ShieldCheck className="h-3 w-3 shrink-0" />
                    )}
                    <span className="truncate">Safe copy</span>
                  </div>
                ) : undefined
              }
              buttonClassName={safeState ? 'border-emerald-400/50 bg-emerald-50/30 dark:bg-emerald-950/20' : undefined}
            />
          );
        })}
      {imageFiles.length > 0 &&
        imageFiles.map((file) => (
          <Image
            key={file.file_id}
            imagePath={file.preview ?? file.filepath ?? ''}
            height={file.height ?? 1920}
            width={file.width ?? 1080}
            altText={file.filename ?? 'Uploaded Image'}
          />
        ))}
      <FilePreviewDialog
        open={selectedFile !== null}
        onOpenChange={handleClose}
        fileName={selectedFile?.filename ?? ''}
        fileId={selectedFile?.file_id}
        fileType={selectedFile?.type ?? undefined}
        fileSize={(selectedFile as TFile)?.bytes}
      />
    </>
  );
};

export default memo(Files);
