import { useEffect } from 'react';
import { useToastContext } from '@librechat/client';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { EToolResources } from 'librechat-data-provider';
import type { ExtendedFile } from '~/common';
import { useDeleteFilesMutation } from '~/data-provider';
import { logger, getCachedPreview, cn } from '~/utils';
import { useFileDeletion } from '~/hooks/Files';
import {
  getMayaSafeFileStatusLabel,
  isMayaSafeFileProcessing,
  isMayaSafeFileReadyForChat,
} from '~/utils/mayaSafeFiles';
import FileContainer from './FileContainer';
import { useLocalize } from '~/hooks';
import Image from './Image';

export default function FileRow({
  files: _files,
  setFiles,
  abortUpload,
  setFilesLoading,
  assistant_id,
  agent_id,
  tool_resource,
  fileFilter,
  isRTL = false,
  Wrapper,
}: {
  files: Map<string, ExtendedFile> | undefined;
  abortUpload?: () => void;
  setFiles: React.Dispatch<React.SetStateAction<Map<string, ExtendedFile>>>;
  setFilesLoading?: React.Dispatch<React.SetStateAction<boolean>>;
  fileFilter?: (file: ExtendedFile) => boolean;
  assistant_id?: string;
  agent_id?: string;
  tool_resource?: EToolResources;
  isRTL?: boolean;
  Wrapper?: React.FC<{ children: React.ReactNode }>;
}) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const files = Array.from(_files?.values() ?? []).filter((file) =>
    fileFilter ? fileFilter(file) : true,
  );

  const { mutateAsync } = useDeleteFilesMutation({
    onMutate: async () =>
      logger.log(
        'agents',
        'Deleting files: agent_id, assistant_id, tool_resource',
        agent_id,
        assistant_id,
        tool_resource,
      ),
    onSuccess: () => {
      console.log('Files deleted');
    },
    onError: (error) => {
      console.log('Error deleting files:', error);
    },
  });

  const { deleteFile } = useFileDeletion({ mutateAsync, agent_id, assistant_id, tool_resource });

  useEffect(() => {
    if (!setFilesLoading) return;
    if (files.length === 0) {
      setFilesLoading(false);
      return;
    }

    if (files.some((file) => file.progress < 1 || isMayaSafeFileProcessing(file))) {
      setFilesLoading(true);
      return;
    }

    if (files.every((file) => file.progress === 1)) {
      setFilesLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  if (files.length === 0) {
    return null;
  }

  const renderSafeSubtitle = (file: ExtendedFile) => {
    if (!file.safeFile) {
      return undefined;
    }

    const label = getMayaSafeFileStatusLabel(file);
    const isReady = isMayaSafeFileReadyForChat(file);
    const isFailed = file.safeFile.status === 'failed';
    const isProcessing = isMayaSafeFileProcessing(file);
    const Icon = isFailed ? AlertTriangle : isReady ? CheckCircle2 : ShieldCheck;

    return (
      <div
        className={cn(
          'flex items-center gap-1 truncate text-xs',
          isProcessing
            ? 'text-sky-600 dark:text-sky-300'
            : isFailed
              ? 'text-red-600 dark:text-red-300'
              : isReady
                ? 'text-emerald-600'
                : 'text-sky-600',
        )}
        title={label}
      >
        {isProcessing ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
        ) : (
          <Icon className="h-3 w-3 shrink-0" />
        )}
        <span className="truncate">{label}</span>
      </div>
    );
  };

  const renderFiles = () => {
    const rowStyle = isRTL
      ? {
          display: 'flex',
          flexDirection: 'row-reverse',
          flexWrap: 'wrap',
          gap: '4px',
          width: '100%',
          maxWidth: '100%',
        }
      : {
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          width: '100%',
          maxWidth: '100%',
        };

    return (
      <div style={rowStyle as React.CSSProperties}>
        {files
          .reduce(
            (acc, current) => {
              if (!acc.map.has(current.file_id)) {
                acc.map.set(current.file_id, true);
                acc.uniqueFiles.push(current);
              }
              return acc;
            },
            { map: new Map(), uniqueFiles: [] as ExtendedFile[] },
          )
          .uniqueFiles.map((file: ExtendedFile, index: number) => {
            const handleDelete = () => {
              if (abortUpload && file.progress < 1) {
                abortUpload();
              }
              if (file.progress >= 1) {
                showToast({
                  message: localize('com_ui_deleting_file'),
                  status: 'info',
                });
              }
              deleteFile({ file, setFiles });
            };
            const isImage = file.type?.startsWith('image') ?? false;
            const isSafeFile = Boolean(file.safeFile);
            const isProcessingSafeFile = isSafeFile && isMayaSafeFileProcessing(file);

            return (
              <div
                key={index}
                style={{
                  flexBasis: '70px',
                  flexGrow: 0,
                  flexShrink: 0,
                }}
              >
                {isImage && !isSafeFile ? (
                  <Image
                    url={getCachedPreview(file.file_id) ?? file.preview ?? file.filepath}
                    onDelete={handleDelete}
                    progress={file.progress}
                    source={file.source}
                  />
                ) : (
                  <FileContainer
                    file={file}
                    onDelete={handleDelete}
                    subtitle={renderSafeSubtitle(file)}
                    buttonClassName={
                      isProcessingSafeFile
                        ? 'border-border-light bg-surface-hover-alt hover:bg-surface-hover'
                        : isSafeFile && !isMayaSafeFileReadyForChat(file)
                          ? 'border-sky-400/70 bg-sky-50/50 dark:bg-sky-950/20'
                          : undefined
                    }
                  />
                )}
              </div>
            );
          })}
      </div>
    );
  };

  if (Wrapper) {
    return <Wrapper>{renderFiles()}</Wrapper>;
  }

  return renderFiles();
}
