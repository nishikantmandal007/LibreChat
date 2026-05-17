import { useCallback, useState } from 'react';
import { easings } from '@react-spring/web';
import { SplitText } from '@librechat/client';
import { useGetStartupConfig } from '~/data-provider';
import { useLocalize, useAuthContext } from '~/hooks';

function getTextSizeClass(text: string | undefined | null) {
  if (!text) {
    return 'text-2xl sm:text-3xl';
  }
  if (text.length < 40) {
    return 'text-3xl sm:text-5xl';
  }
  if (text.length < 70) {
    return 'text-2xl sm:text-3xl';
  }
  return 'text-xl sm:text-2xl';
}

export default function Landing({ centerFormOnLanding }: { centerFormOnLanding: boolean }) {
  const { data: startupConfig } = useGetStartupConfig();
  const { user } = useAuthContext();
  const localize = useLocalize();

  const [textHasMultipleLines, setTextHasMultipleLines] = useState(false);

  const getGreeting = useCallback(() => {
    if (typeof startupConfig?.interface?.customWelcome === 'string') {
      const customWelcome = startupConfig.interface.customWelcome;
      if (user?.name && customWelcome.includes('{{user.name}}')) {
        return customWelcome.replace(/{{user.name}}/g, user.name);
      }
      return customWelcome;
    }

    const hours = new Date().getHours();
    if (hours >= 0 && hours < 5) {
      return localize('com_ui_late_night');
    } else if (hours < 12) {
      return localize('com_ui_good_morning');
    } else if (hours < 17) {
      return localize('com_ui_good_afternoon');
    }
    return localize('com_ui_good_evening');
  }, [localize, startupConfig?.interface?.customWelcome, user?.name]);

  const handleLineCountChange = useCallback((count: number) => {
    setTextHasMultipleLines(count > 1);
  }, []);

  const greetingText =
    typeof startupConfig?.interface?.customWelcome === 'string'
      ? getGreeting()
      : getGreeting() + (user?.name ? ', ' + user.name : '');

  return (
    <div
      className={`flex h-full transform-gpu flex-col items-center justify-center pb-16 transition-all duration-200 ${centerFormOnLanding ? 'max-h-full sm:max-h-0' : 'max-h-full'} mb-0`}
    >
      <div className="flex flex-col items-center gap-0 p-2">
        <div
          className={`flex ${textHasMultipleLines ? 'flex-col' : 'flex-col md:flex-row'} items-center justify-center gap-2`}
        >
          <SplitText
            key={`split-text-${greetingText}${user?.name ? '-user' : ''}`}
            text={greetingText}
            className={`${getTextSizeClass(greetingText)} font-medium text-text-primary`}
            delay={50}
            textAlign="center"
            animationFrom={{ opacity: 0, transform: 'translate3d(0,50px,0)' }}
            animationTo={{ opacity: 1, transform: 'translate3d(0,0,0)' }}
            easing={easings.easeOutCubic}
            threshold={0}
            rootMargin="0px"
            onLineCountChange={handleLineCountChange}
          />
        </div>
        <div className="animate-fadeIn mt-4 max-w-md text-center text-base font-normal text-text-secondary">
          {localize('com_ui_privacy_assistant_tagline')}
        </div>
      </div>
    </div>
  );
}
