import { useState, useEffect, useRef } from 'react';
import { PixelCard } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import Image from './Image';

const UPDATE_INTERVAL = 200;
const DURATION = 25000;
const TOTAL_STEPS = DURATION / UPDATE_INTERVAL;
/** Mid-tone palette stays visible on both light and dark backgrounds
 *  (the default PixelCard palette is near-white and vanishes on light theme). */
const PIXEL_COLORS = '#cbd5e1,#94a3b8,#64748b';

function ProgressLabel({ progress }: { progress: number }) {
  const localize = useLocalize();

  let text: string;
  if (progress >= 1) {
    text = localize('com_ui_image_created');
  } else if (progress >= 0.7) {
    text = localize('com_ui_final_touch');
  } else if (progress >= 0.5) {
    text = localize('com_ui_adding_details');
  } else if (progress >= 0.3) {
    text = localize('com_ui_creating_image');
  } else {
    text = localize('com_ui_getting_started');
  }

  return (
    <span
      className={cn(
        'progress-text-content tool-status-text whitespace-nowrap text-sm font-medium',
        progress < 1 && 'shimmer',
      )}
    >
      {text}
    </span>
  );
}

export default function ImageGenCanvas({
  isLoading,
  imageUrl,
}: {
  isLoading: boolean;
  imageUrl: string | null;
}) {
  const [progress, setProgress] = useState(0.1);
  const [showImage, setShowImage] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    let step = 0;
    intervalRef.current = setInterval(() => {
      step++;
      if (step >= TOTAL_STEPS) {
        clearInterval(intervalRef.current!);
        setProgress(0.9);
      } else {
        const ratio = step / TOTAL_STEPS;
        const mapped =
          ratio < 0.8
            ? Math.pow(ratio, 1.1)
            : 0.8 + (1 - Math.pow(1 - (ratio - 0.8) / 0.2, 2)) * 0.2;
        setProgress(0.1 + mapped * 0.8);
      }
    }, UPDATE_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isLoading]);

  useEffect(() => {
    if (imageUrl && imageUrl !== 'loading') {
      setProgress(1);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      const timer = setTimeout(() => setShowImage(true), 400);
      return () => clearTimeout(timer);
    }
  }, [imageUrl]);

  const hasRealImage = imageUrl && imageUrl !== 'loading';

  return (
    <div className="my-2">
      <div className="mb-2 flex h-5 items-center gap-2">
        <ProgressLabel progress={progress} />
      </div>
      <div className="relative w-full max-w-lg">
        {/* Loading animation — fades out once the image is ready */}
        {!(hasRealImage && showImage) && (
          <div
            className="aspect-square w-full transition-opacity duration-500"
            style={{ opacity: showImage ? 0 : 1 }}
          >
            <PixelCard
              variant="default"
              colors={PIXEL_COLORS}
              progress={progress}
              randomness={0.6}
              width="100%"
              height="100%"
            />
          </div>
        )}
        {/* Final image: clickable → DialogImage lightbox (X top-left + download),
            sized by the shared Image component (max-w-lg / max-h-[45vh]). */}
        {hasRealImage && showImage && (
          <Image
            imagePath={imageUrl}
            altText="Generated image"
            className="w-fit border-0 shadow-none"
          />
        )}
      </div>
    </div>
  );
}
