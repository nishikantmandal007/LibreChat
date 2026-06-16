import React, { useMemo } from 'react';
import { useLocalize } from '~/hooks';
import type { TranslationKeys } from '~/hooks';
import { readMDPStorageInfo, decodeMDPJwtClaims } from '~/services/mdp/sessionAuth';

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</span>
      <span className="break-words text-sm text-text-primary">{value}</span>
    </div>
  );
}

/**
 * Read-only account details mirrored from the MayaDataPrivacy parent platform.
 * Everything here comes from the JWT session already in `localStorage.info`
 * (decoded client-side) — no backend/DB call is made.
 */
function MDPAccountInfo() {
  const localize = useLocalize();

  const fields = useMemo(() => {
    const info = readMDPStorageInfo();
    const claims = info?.jwtToken ? decodeMDPJwtClaims(info.jwtToken) : null;

    const firstName = info?.fname ?? '';
    const lastName = info?.lname ?? '';
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || (info?.userName ?? '');

    return {
      email: info?.userEmailId || claims?.preferred_username || '',
      displayName,
      firstName,
      lastName,
      phone: info?.mob ?? '',
      organization: claims?.OrganizationId ?? '',
    };
  }, []);

  const labels: { key: keyof typeof fields; label: TranslationKeys }[] = [
    { key: 'email', label: 'com_auth_email' },
    { key: 'displayName', label: 'com_ui_display_name' },
    { key: 'firstName', label: 'com_ui_first_name' },
    { key: 'lastName', label: 'com_ui_last_name' },
    { key: 'phone', label: 'com_ui_phone' },
    { key: 'organization', label: 'com_ui_organization' },
  ];

  return (
    <div className="flex flex-col gap-5 p-1 text-sm text-text-primary">
      <div>
        <h3 className="text-base font-medium text-text-primary">
          {localize('com_ui_account_info_title')}
        </h3>
        <p className="mt-1 text-sm text-text-secondary">{localize('com_ui_account_info_desc')}</p>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {labels.map(({ key, label }) => (
          <Field key={key} label={localize(label)} value={fields[key]} />
        ))}
      </div>
    </div>
  );
}

export default React.memo(MDPAccountInfo);
