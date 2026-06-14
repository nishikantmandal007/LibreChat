import { useCallback } from 'react';
import { useGetStartupConfig } from '~/data-provider';
import { useLocalize, useAuthContext } from '~/hooks';

export default function Landing({
  centerFormOnLanding: _centerFormOnLanding,
}: {
  centerFormOnLanding: boolean;
}) {
  const { data: startupConfig } = useGetStartupConfig();
  const { user } = useAuthContext();
  const localize = useLocalize();

  const getCustomWelcome = useCallback(() => {
    if (typeof startupConfig?.interface?.customWelcome !== 'string') {
      return null;
    }
    const customWelcome = startupConfig.interface.customWelcome;
    if (user?.name && customWelcome.includes('{{user.name}}')) {
      return customWelcome.replace(/{{user.name}}/g, user.name);
    }
    return customWelcome;
  }, [startupConfig?.interface?.customWelcome, user?.name]);

  const greetingText = getCustomWelcome() ?? localize('com_ui_privacy_hero_quote');

  return (
    <div className="relative mb-0 flex max-h-full w-full flex-col items-center justify-center overflow-visible pb-6 transition-all duration-200">
      <div className="relative z-10 flex flex-col items-center gap-3 p-2 text-center">
        <h1 className="aisafe-hero-quote animate-fadeIn max-w-4xl px-4 text-3xl font-medium italic leading-tight text-text-primary sm:text-5xl">
          {greetingText}
        </h1>
        <div className="animate-fadeIn text-text-secondary/90 max-w-md text-center text-sm font-medium">
          {localize('com_ui_privacy_assistant_tagline')}
        </div>
      </div>
    </div>
  );
}
