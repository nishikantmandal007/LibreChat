import InspirationalQuote from './InspirationalQuote';
import { useLocalize, useAuthContext } from '~/hooks';

export default function Landing({
  centerFormOnLanding: _centerFormOnLanding,
}: {
  centerFormOnLanding: boolean;
}) {
  const { user } = useAuthContext();
  const localize = useLocalize();
  const displayName = user?.name ?? user?.username ?? localize('com_nav_user');
  const hour = new Date().getHours();
  let dayPart = 'Good evening';
  if (hour >= 5 && hour < 12) {
    dayPart = 'Good morning';
  } else if (hour >= 12 && hour < 17) {
    dayPart = 'Good afternoon';
  }
  const greetingText = `${dayPart}, ${displayName}`;

  return (
    <div className="aisafe-landing relative mb-0 flex max-h-full w-full flex-col items-center justify-center overflow-visible pb-6 transition-all duration-200">
      <div className="relative z-10 flex flex-col items-center gap-3 p-2 text-center">
        <h1 className="aisafe-hero-quote animate-fadeIn max-w-4xl px-4 text-3xl font-bold leading-tight text-text-primary sm:text-5xl">
          {greetingText}
        </h1>
        <InspirationalQuote className="animate-fadeIn px-4" />
      </div>
    </div>
  );
}
