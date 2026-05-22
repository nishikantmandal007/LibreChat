import { memo, useCallback, useRef, useState } from 'react';
import { MicOff } from 'lucide-react';
import { FileSources } from 'librechat-data-provider';
import { useToastContext, TooltipAnchor, ListeningIcon, Spinner } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { useChatFormContext } from '~/Providers';
import { globalAudioId } from '~/common';
import { transcribeAudio } from '~/services/mdp/chat';
import { cn } from '~/utils';

import type { ExtendedFile, FileSetter } from '~/common';

const TRANSCRIPT_PROMPT_NOTE = 'Voice transcript attached.';

function getTranscriptFileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `voice-transcript-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getTranscriptFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `voice-transcript-${timestamp}.txt`;
}

function appendTranscriptPromptNote(currentText: string): string {
  if (!currentText.trim()) {
    return TRANSCRIPT_PROMPT_NOTE;
  }
  if (currentText.includes(TRANSCRIPT_PROMPT_NOTE)) {
    return currentText;
  }
  return `${currentText}\n${TRANSCRIPT_PROMPT_NOTE}`;
}

function createTranscriptPreviewFile(transcript: string): ExtendedFile {
  const fileId = getTranscriptFileId();
  const filename = getTranscriptFilename();
  const file = new File([transcript], filename, { type: 'text/plain' });

  return {
    file,
    file_id: fileId,
    filename,
    type: 'text/plain',
    size: file.size,
    progress: 1,
    source: FileSources.local,
    attached: true,
    embedded: false,
    safeFile: {
      status: 'ready',
      rawFileId: fileId,
      safeFilename: filename,
      mimeType: 'text/plain',
      originalText: transcript,
      promptText: transcript,
      localPreviewOnly: true,
    },
  };
}

export default memo(function AudioRecorder({
  disabled,
  methods,
  textAreaRef,
  isSubmitting,
  setFiles,
  transcriptionLanguage,
}: {
  disabled: boolean;
  methods: ReturnType<typeof useChatFormContext>;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
  isSubmitting: boolean;
  setFiles?: FileSetter;
  transcriptionLanguage?: string;
}) {
  const { setValue, getValues } = methods;
  const localize = useLocalize();
  const { showToast } = useToastContext();

  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const isSubmittingRef = useRef(isSubmitting);
  isSubmittingRef.current = isSubmitting;

  function getBestSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/wav',
    ];
    for (const type of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'audio/webm';
  }

  const handleStopAndTranscribe = useCallback(
    async (audioBlob: Blob) => {
      if (isSubmittingRef.current) {
        showToast({
          message: localize('com_ui_speech_while_submitting'),
          status: 'error',
        });
        return;
      }

      if (audioBlob.size === 0) {
        showToast({ message: 'Recording was too short', status: 'warning' });
        return;
      }

      setIsLoading(true);
      try {
        const globalAudio = document.getElementById(globalAudioId) as HTMLAudioElement | null;
        if (globalAudio) {
          globalAudio.muted = false;
        }

        const text = (await transcribeAudio(audioBlob, transcriptionLanguage)).trim();
        if (!text) {
          showToast({ message: 'No speech detected in recording', status: 'warning' });
          return;
        }

        const transcriptFile = createTranscriptPreviewFile(text);
        setFiles?.((currentFiles) => {
          const nextFiles = new Map(currentFiles);
          nextFiles.set(transcriptFile.file_id, transcriptFile);
          return nextFiles;
        });

        const existing = getValues('text') || '';
        setValue('text', appendTranscriptPromptNote(existing), { shouldValidate: true });
        showToast({ message: 'Voice transcript attached to message', status: 'success' });

        requestAnimationFrame(() => {
          textAreaRef.current?.focus();
        });
      } catch (err) {
        console.error('[AudioRecorder] Transcription failed:', err);
        showToast({
          message: 'Voice transcription failed. Please try again.',
          status: 'error',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [getValues, setValue, showToast, localize, textAreaRef, transcriptionLanguage, setFiles],
  );

  const startRecording = useCallback(async () => {
    if (isListening) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = getBestSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.addEventListener('dataavailable', (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener('stop', () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];
        stream.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
        handleStopAndTranscribe(audioBlob);
      });

      recorder.start(100);
      setIsListening(true);
    } catch {
      showToast({ message: 'Microphone permission not granted', status: 'error' });
    }
  }, [isListening, showToast, handleStopAndTranscribe]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
      return;
    }
    mediaRecorderRef.current.stop();
    setIsListening(false);
  }, []);

  const handleClick = useCallback(() => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isListening, startRecording, stopRecording]);

  const renderIcon = () => {
    if (isListening) {
      return <MicOff className="stroke-red-500" />;
    }
    if (isLoading) {
      return <Spinner className="stroke-text-secondary" />;
    }
    return <ListeningIcon className="stroke-text-secondary" />;
  };

  return (
    <TooltipAnchor
      description={localize('com_ui_use_micrphone')}
      render={
        <button
          id="audio-recorder"
          type="button"
          aria-label={localize('com_ui_use_micrphone')}
          onClick={handleClick}
          disabled={disabled}
          className={cn(
            'flex size-10 items-center justify-center rounded-full p-1 transition-colors hover:bg-surface-hover',
            isListening && 'animate-pulse bg-red-500/10',
          )}
          title={localize('com_ui_use_micrphone')}
          aria-pressed={isListening}
        >
          {renderIcon()}
        </button>
      }
    />
  );
});
