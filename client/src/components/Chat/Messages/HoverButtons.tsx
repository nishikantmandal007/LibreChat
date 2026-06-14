import React, { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react';
import type { TConversation, TMessage, TFeedback } from 'librechat-data-provider';
import {
  EditIcon,
  Clipboard,
  CheckMark,
  RegenerateIcon,
  VolumeIcon,
  VolumeMuteIcon,
} from '@librechat/client';
import { useGenerationsByLatest, useLocalize } from '~/hooks';
import AnonymizedPromptToggle from '~/components/Chat/Messages/Content/AnonymizedPromptToggle';
import Feedback from './Feedback';
import { cn } from '~/utils';

type THoverButtons = {
  isEditing: boolean;
  enterEdit: (cancel?: boolean) => void;
  copyToClipboard: (setIsCopied: React.Dispatch<React.SetStateAction<boolean>>) => void;
  conversation: TConversation | null;
  isSubmitting: boolean;
  message: TMessage;
  regenerate: () => void;
  handleContinue: (e: React.MouseEvent<HTMLButtonElement>) => void;
  latestMessageId?: string;
  isLast: boolean;
  index: number;
  handleFeedback?: ({ feedback }: { feedback: TFeedback | undefined }) => void;
  showAnonymizedPrompt?: boolean;
  onToggleAnonymizedPrompt?: () => void;
  piiDetected?: boolean;
};

type HoverButtonProps = {
  id?: string;
  onClick: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  title: string;
  icon: React.ReactNode;
  isActive?: boolean;
  isVisible?: boolean;
  isDisabled?: boolean;
  isLast?: boolean;
  className?: string;
  buttonStyle?: string;
};

const extractMessageContent = (message: TMessage): string => {
  if (typeof message.content === 'string') {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (part == null) {
          return '';
        }
        if (typeof part === 'string') {
          return part;
        }
        if ('text' in part) {
          return part.text || '';
        }
        if ('think' in part) {
          const think = part.think;
          if (typeof think === 'string') {
            return think;
          }
          return think && 'text' in think ? think.text || '' : '';
        }
        return '';
      })
      .join('');
  }

  return message.text || '';
};

const HoverButton = memo(
  ({
    id,
    onClick,
    title,
    icon,
    isActive = false,
    isVisible = true,
    isDisabled = false,
    isLast = false,
    className = '',
  }: HoverButtonProps) => {
    const buttonStyle = cn(
      'hover-button rounded-lg p-1.5 text-text-secondary-alt',
      'hover:text-text-primary hover:bg-surface-hover',
      'md:group-hover:visible md:group-focus-within:visible md:group-[.final-completion]:visible',
      !isLast && 'md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100',
      !isVisible && 'opacity-0',
      'focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white focus-visible:outline-none',
      isActive && isVisible && 'active text-text-primary bg-surface-hover',
      className,
    );

    return (
      <button
        id={id}
        className={buttonStyle}
        onClick={onClick}
        type="button"
        title={title}
        disabled={isDisabled}
      >
        {icon}
      </button>
    );
  },
);

HoverButton.displayName = 'HoverButton';

const HoverButtons = ({
  index,
  isEditing,
  enterEdit,
  copyToClipboard,
  conversation,
  isSubmitting,
  message,
  regenerate,
  handleContinue,
  latestMessageId,
  isLast,
  handleFeedback,
  showAnonymizedPrompt = false,
  onToggleAnonymizedPrompt,
  piiDetected = false,
}: THoverButtons) => {
  const localize = useLocalize();
  const [isCopied, setIsCopied] = useState(false);

  const endpoint = useMemo(() => {
    if (!conversation) {
      return '';
    }
    return conversation.endpointType ?? conversation.endpoint;
  }, [conversation]);

  const generationCapabilities = useGenerationsByLatest({
    isEditing,
    isSubmitting,
    error: message.error,
    endpoint: endpoint ?? '',
    messageId: message.messageId,
    searchResult: message.searchResult,
    finish_reason: message.finish_reason,
    isCreatedByUser: message.isCreatedByUser,
    latestMessageId: latestMessageId,
  });

  const {
    hideEditButton,
    regenerateEnabled,
    isEditableEndpoint,
  } = generationCapabilities;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const resumeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearResumeInterval = useCallback(() => {
    if (resumeIntervalRef.current) {
      clearInterval(resumeIntervalRef.current);
      resumeIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth) {
      return;
    }
    voicesRef.current = synth.getVoices();
    const onVoicesChanged = () => { voicesRef.current = synth.getVoices(); };
    synth.addEventListener('voiceschanged', onVoicesChanged);
    return () => {
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      synth.cancel();
      clearResumeInterval();
    };
  }, [clearResumeInterval]);

  const handleSpeak = useCallback(() => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth) {
      return;
    }
    if (isSpeaking) {
      synth.cancel();
      clearResumeInterval();
      setIsSpeaking(false);
      return;
    }
    synth.cancel();
    clearResumeInterval();
    const text = extractMessageContent(message);
    if (!text.trim()) {
      return;
    }
    const voices = voicesRef.current.length > 0 ? voicesRef.current : synth.getVoices();
    const langPrefix = (navigator.language || 'en').split('-')[0];
    const voice = voices.length > 0
      ? (voices.find(v => v.lang.startsWith(langPrefix)) ?? voices[0])
      : null;

    // Chrome silently kills utterances longer than ~200 chars; chunk at sentence boundaries
    const chunks = text.match(/[^.!?]*[.!?]+[\s]?|[^.!?]+$/g) ?? [text];
    const merged: string[] = [];
    let buf = '';
    for (const chunk of chunks) {
      if (buf.length + chunk.length > 200 && buf.length > 0) {
        merged.push(buf);
        buf = chunk;
      } else {
        buf += chunk;
      }
    }
    if (buf) {
      merged.push(buf);
    }

    for (let i = 0; i < merged.length; i++) {
      const utterance = new SpeechSynthesisUtterance(merged[i]);
      if (voice) {
        utterance.voice = voice;
      }
      if (i === merged.length - 1) {
        utterance.onend = () => { clearResumeInterval(); setIsSpeaking(false); };
      }
      utterance.onerror = () => { clearResumeInterval(); setIsSpeaking(false); };
      synth.speak(utterance);
    }
    // Chrome pauses speech after ~15s; keep it alive
    resumeIntervalRef.current = setInterval(() => { synth.resume(); }, 10_000);
    setIsSpeaking(true);
  }, [isSpeaking, message, clearResumeInterval]);

  if (!conversation) {
    return null;
  }

  const { isCreatedByUser, error } = message;

  if (error === true) {
    return (
      <div className="visible flex justify-center self-end lg:justify-start">
        {regenerateEnabled && (
          <HoverButton
            onClick={regenerate}
            title={localize('com_ui_regenerate')}
            icon={<RegenerateIcon size="19" />}
            isLast={isLast}
          />
        )}
      </div>
    );
  }

  const onEdit = () => {
    if (isEditing) {
      return enterEdit(true);
    }
    enterEdit();
  };

  const handleCopy = () => copyToClipboard(setIsCopied);

  const ttsIcon = isSpeaking
    ? <VolumeMuteIcon className="icon-md-heavy h-[18px] w-[18px]" />
    : <VolumeIcon className="icon-md-heavy h-[18px] w-[18px]" />;

  if (isCreatedByUser) {
    return (
      <div className="group visible flex justify-center gap-0.5 self-end focus-within:outline-none lg:justify-start">
        {Boolean(message.text?.trim()) && onToggleAnonymizedPrompt && (
          <AnonymizedPromptToggle
            isShowing={showAnonymizedPrompt}
            onToggle={onToggleAnonymizedPrompt}
            piiDetected={piiDetected}
            isLast={isLast}
          />
        )}
        <HoverButton
          onClick={handleCopy}
          title={
            isCopied ? localize('com_ui_copied_to_clipboard') : localize('com_ui_copy_to_clipboard')
          }
          icon={isCopied ? <CheckMark className="h-[18px] w-[18px]" /> : <Clipboard size="19" />}
          isLast={isLast}
          className="ml-0 flex items-center gap-1.5 text-xs"
        />
        {isEditableEndpoint && (
          <HoverButton
            id={`edit-${message.messageId}`}
            onClick={onEdit}
            title={localize('com_ui_edit')}
            icon={<EditIcon size="19" />}
            isActive={isEditing}
            isVisible={!hideEditButton}
            isDisabled={hideEditButton}
            isLast={isLast}
          />
        )}
      </div>
    );
  }

  return (
    <div className="group visible flex justify-center gap-0.5 self-end focus-within:outline-none lg:justify-start">
      <HoverButton
        onClick={handleSpeak}
        title={isSpeaking ? localize('com_nav_voice_select') : localize('com_nav_voice_select')}
        icon={ttsIcon}
        isActive={isSpeaking}
        isLast={isLast}
      />
      <HoverButton
        onClick={handleCopy}
        title={
          isCopied ? localize('com_ui_copied_to_clipboard') : localize('com_ui_copy_to_clipboard')
        }
        icon={isCopied ? <CheckMark className="h-[18px] w-[18px]" /> : <Clipboard size="19" />}
        isLast={isLast}
        className="ml-0 flex items-center gap-1.5 text-xs"
      />
      {handleFeedback != null && (
        <Feedback handleFeedback={handleFeedback} feedback={message.feedback} isLast={isLast} />
      )}
      {regenerateEnabled && (
        <HoverButton
          onClick={regenerate}
          title={localize('com_ui_regenerate')}
          icon={<RegenerateIcon size="19" />}
          isLast={isLast}
          className="active"
        />
      )}
    </div>
  );
};

export default memo(HoverButtons);
