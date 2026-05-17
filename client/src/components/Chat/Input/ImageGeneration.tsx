import React, { memo, useCallback } from 'react';
import { ImageIcon } from 'lucide-react';
import { CheckboxButton } from '@librechat/client';
import { useRecoilState, useRecoilValue } from 'recoil';
import { useLocalize } from '~/hooks';
import store from '~/store';

function ImageGeneration() {
  const localize = useLocalize();
  const [imageGenEnabled, setImageGenEnabled] = useRecoilState(store.imageGenEnabled);
  const isPinned = useRecoilValue(store.imageGenPinned);

  const setValue = useCallback(
    ({ value }: { value: boolean | string }) => {
      setImageGenEnabled(value === true);
    },
    [setImageGenEnabled],
  );

  return (
    (imageGenEnabled || isPinned) && (
      <CheckboxButton
        className="max-w-fit"
        checked={imageGenEnabled}
        setValue={setValue}
        label={localize('com_ui_image_gen')}
        isCheckedClassName="border-amber-600/40 bg-amber-500/10 hover:bg-amber-700/10"
        icon={<ImageIcon className="icon-md" aria-hidden="true" />}
      />
    )
  );
}

export default memo(ImageGeneration);
