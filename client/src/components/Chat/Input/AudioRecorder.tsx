import { memo, useCallback, useRef, useState } from 'react';
import { MicOff } from 'lucide-react';
import { FileSources } from 'librechat-data-provider';
import { useToastContext, TooltipAnchor, ListeningIcon, Spinner } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { useChatFormContext } from '~/Providers';
import { globalAudioId } from '~/common';
import { transcribeAudio } from '~/services/mdp/chat';
import { createSafeFile } from '~/services/mdp/safeFiles';
import { endpointToMayaLLM } from '~/services/mdp/modelConfig';
import { cn } from '~/utils';

import type { TConversation } from 'librechat-data-provider';
import type { FileSetter, ExtendedFile } from '~/common';

/** Transcripts at or below this length are pasted inline; longer ones become attached safe files */
const SHORT_TRANSCRIPT_MAX = 1000;

export default memo(function AudioRecorder({
  disabled,
  ask,
  methods,
  textAreaRef,
  isSubmitting,
  setFiles,
  conversation,
  transcriptionLanguage,
}: {
  disabled: boolean;
  ask: (data: { text: string }) => void;
  methods: ReturnType<typeof useChatFormContext>;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
  isSubmitting: boolean;
  setFiles?: FileSetter;
  conversation?: TConversation | null;
  transcriptionLanguage?: string;
}) {
  const { setValue, getValues, reset } = methods;
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

  /**
   * Attach a long transcript as a safe file so it appears in the file-row
   * and the user can click to open it in the SafeFilePreviewPanel.
   */
  const attachTranscriptAsFile = useCallback(
    async (text: string) => {
      if (!setFiles) {
        return null;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `voice-transcript-${timestamp}.txt`;
      const blob = new Blob([text], { type: 'text/plain' });
      const file = new File([blob], filename, { type: 'text/plain' });
      const rawFileId = crypto.randomUUID();

      // Add a pending entry to the files map immediately so the user sees progress
      const pendingEntry: ExtendedFile = {
        file,
        file_id: rawFileId,
        filename,
        type: 'text/plain',
        size: blob.size,
        progress: 0,
        source: FileSources.local,
        safeFile: {
          status: 'scanning',
          rawFileId,
        },
      };

      setFiles((prev) => new Map(prev).set(rawFileId, pendingEntry));

      try {
        const llmType = endpointToMayaLLM(
          conversation?.endpoint ?? conversation?.endpointType ?? null,
        );
        const safeFileState = await createSafeFile({
          file,
          rawFileId,
          filename,
          mimeType: 'text/plain',
          llmType,
          lang: transcriptionLanguage,
          role: 'transcription',
        });

        const readyEntry: ExtendedFile = {
          ...pendingEntry,
          progress: 100,
          safeFile: {
            ...safeFileState,
            role: 'case_file',
          },
        };

        setFiles((prev) => new Map(prev).set(rawFileId, readyEntry));
        return safeFileState.safeDocId ?? null;
      } catch (err) {
        console.error('[AudioRecorder] Safe file upload failed:', err);
        setFiles((prev) => {
          const next = new Map(prev);
          const existing = next.get(rawFileId);
          if (existing) {
            next.set(rawFileId, {
              ...existing,
              safeFile: { status: 'failed', rawFileId, error: 'Upload failed' },
            });
          }
          return next;
        });
        return null;
      }
    },
    [setFiles, conversation, transcriptionLanguage],
  );

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

        const text = await transcribeAudio(audioBlob, transcriptionLanguage);
        if (!text || text.trim() === '') {
          showToast({ message: 'No speech detected in recording', status: 'warning' });
          return;
        }

        if (text.length <= SHORT_TRANSCRIPT_MAX) {
          const existing = getValues('text') || '';
          const finalText = existing ? `${existing}\n${text}` : text;
          ask({ text: finalText });
          reset({ text: '' });
          showToast({ message: 'Voice transcription added to message', status: 'success' });
        } else {
          // Long transcript: attach as safe .txt file
          if (setFiles) {
            showToast({
              message: `Uploading transcript (${text.length} chars) as safe file…`,
              status: 'info',
            });
            attachTranscriptAsFile(text).then((safeDocId) => {
              if (safeDocId) {
                showToast({
                  message: 'Voice transcript attached as a safe file. Click the file to preview.',
                  status: 'success',
                });
              }
            });
          } else {
            // Fallback: paste full text if setFiles not available
            const existing = getValues('text') || '';
            const finalText = existing ? `${existing}\n${text}` : text;
            setValue('text', finalText, { shouldValidate: true });
            showToast({
              message: `Long transcript (${text.length} chars) pasted into message`,
              status: 'info',
            });
          }
        }

        // Focus back to textarea
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
    [
      getValues,
      setValue,
      showToast,
      localize,
      textAreaRef,
      setFiles,
      attachTranscriptAsFile,
      ask,
      reset,
      transcriptionLanguage,
    ],
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
        // Stop all tracks
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
