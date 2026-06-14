import { useEffect, memo } from 'react';
import TagManager from 'react-gtm-module';
import { useGetStartupConfig } from '~/data-provider';
import { useLocalize } from '~/hooks';

const MAYA_DATA_PRIVACY_LABEL = 'MayaDataPrivacy';

function Footer({ className }: { className?: string }) {
  const { data: config } = useGetStartupConfig();
  const localize = useLocalize();

  useEffect(() => {
    if (config?.analyticsGtmId != null && typeof window.google_tag_manager === 'undefined') {
      const tagManagerArgs = {
        gtmId: config.analyticsGtmId,
      };
      TagManager.initialize(tagManagerArgs);
    }
  }, [config?.analyticsGtmId]);

  return (
    <div className="relative w-full">
      <div
        className={
          className ??
          'absolute bottom-0 left-0 right-0 hidden items-center justify-center px-2 py-2 sm:flex md:px-[60px]'
        }
        role="contentinfo"
      >
        <div className="aisafe-footer-links">
          <a href="https://www.mayadataprivacy.com/" target="_blank" rel="noopener noreferrer">
            {MAYA_DATA_PRIVACY_LABEL}
          </a>
          <span className="footer-dot">·</span>
          <a
            href="https://www.mayadataprivacy.com/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            {localize('com_ui_privacy_policy')}
          </a>
        </div>
      </div>
    </div>
  );
}

const MemoizedFooter = memo(Footer);
MemoizedFooter.displayName = 'Footer';

export default MemoizedFooter;
