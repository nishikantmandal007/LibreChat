import { useCallback } from 'react';
import { easings } from '@react-spring/web';
import { SplitText } from '@librechat/client';
import type { TranslationKeys } from '~/hooks';
import { useLocalize, useSubmitMessage } from '~/hooks';

const SAMPLE_IMAGES = [
  'assets/imagegen/cosmic.jpg',
  'assets/imagegen/cyberpunk.jpg',
  'assets/imagegen/landscape.jpg',
  'assets/imagegen/abstract.jpg',
  'assets/imagegen/portrait.jpg',
  'assets/imagegen/nature.jpg',
].map((path) => `${import.meta.env.BASE_URL}${path}`);

const STARTER_PROMPT_KEYS: TranslationKeys[] = [
  'com_ui_imagegen_starter_1',
  'com_ui_imagegen_starter_2',
  'com_ui_imagegen_starter_3',
  'com_ui_imagegen_starter_4',
];

export default function ImageGenLanding() {
  const localize = useLocalize();
  const { submitMessage } = useSubmitMessage();

  const handleCardClick = useCallback(
    (prompt: string) => {
      submitMessage({ text: prompt });
    },
    [submitMessage],
  );

  return (
    <div className="imagegen-landing relative flex h-full w-full flex-col items-center overflow-y-auto">
      <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-2 gap-2 p-4 opacity-15">
        {SAMPLE_IMAGES.map((src) => (
          <img
            key={src}
            src={src}
            alt=""
            className="h-full w-full rounded-xl object-cover"
            loading="lazy"
          />
        ))}
      </div>

      <div className="from-surface-primary/80 via-surface-primary/60 to-surface-primary/90 pointer-events-none absolute inset-0 bg-gradient-to-b" />

      <div className="relative z-10 my-auto flex w-full flex-col items-center gap-5 px-4 pb-16 pt-14 sm:gap-6 sm:pb-20 sm:pt-16">
        <SplitText
          text={localize('com_ui_imagegen_hero_title')}
          className="imagegen-hero-title max-w-4xl px-2 text-3xl font-bold leading-[1.16] text-text-primary sm:text-5xl"
          delay={50}
          textAlign="center"
          animationFrom={{ opacity: 0, transform: 'translate3d(0,40px,0)' }}
          animationTo={{ opacity: 1, transform: 'translate3d(0,0,0)' }}
          easing={easings.easeOutCubic}
          threshold={0}
          rootMargin="0px"
        />
        <div className="mt-2 grid w-full max-w-2xl grid-cols-1 gap-3 sm:mt-4 sm:grid-cols-2">
          {STARTER_PROMPT_KEYS.map((key) => {
            const prompt = localize(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleCardClick(prompt)}
                className="bg-surface-primary/70 rounded-xl border border-border-medium px-4 py-3 text-left text-sm text-text-secondary backdrop-blur-sm transition-colors hover:border-border-heavy hover:bg-surface-hover hover:text-text-primary"
              >
                {prompt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
