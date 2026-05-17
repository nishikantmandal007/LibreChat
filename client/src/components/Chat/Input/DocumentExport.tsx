import React, { memo, useCallback } from 'react';
import { FileText } from 'lucide-react';
import { CheckboxButton } from '@librechat/client';
import { useRecoilState, useRecoilValue } from 'recoil';
import { useLocalize } from '~/hooks';
import store from '~/store';

function DocumentExport() {
  const localize = useLocalize();
  const [documentExportEnabled, setDocumentExportEnabled] = useRecoilState(
    store.documentExportEnabled,
  );
  const isPinned = useRecoilValue(store.documentExportPinned);

  const setValue = useCallback(
    ({ value }: { value: boolean | string }) => {
      setDocumentExportEnabled(value === true);
    },
    [setDocumentExportEnabled],
  );

  return (
    (documentExportEnabled || isPinned) && (
      <CheckboxButton
        className="max-w-fit"
        checked={documentExportEnabled}
        setValue={setValue}
        label={localize('com_ui_document_export')}
        isCheckedClassName="border-emerald-600/40 bg-emerald-500/10 hover:bg-emerald-700/10"
        icon={<FileText className="icon-md" aria-hidden="true" />}
      />
    )
  );
}

export default memo(DocumentExport);
