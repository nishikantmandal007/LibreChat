import React from 'react';
import { Button, TrashIcon } from '@librechat/client';
import type { TFile } from 'librechat-data-provider';

type FileListItemProps = {
  file: TFile;
  deleteFile: (id: string | undefined) => void;
  width?: string;
};

export default function FileListItem({ file, deleteFile, width = '400px' }: FileListItemProps) {
  return (
    <div className="glass-surface w-100 my-3 mr-2 flex cursor-pointer flex-row rounded-xl p-4 transition duration-300 ease-in-out hover:bg-[var(--glass-bg-hover)]">
      <div className="flex w-1/2 flex-col justify-around align-middle">
        <strong>{file.filename}</strong>
        <p className="text-sm text-[var(--glass-text-secondary)]">{file.object}</p>
      </div>
      <div className="w-2/6 text-[var(--glass-text-secondary)]">
        <p>({file.bytes / 1000}KB)</p>
        <p className="text-sm">{file.createdAt?.toString()}</p>
      </div>
      <div className="flex w-1/6 justify-around">
        <Button
          className="my-0 ml-3 bg-transparent p-0 text-[var(--glass-text-secondary)] hover:bg-[var(--glass-bg-hover)]"
          onClick={() => deleteFile(file._id)}
        >
          <TrashIcon className="m-0 p-0" />
        </Button>
      </div>
    </div>
  );
}
