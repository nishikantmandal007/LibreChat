import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { Button, ListeningIcon, Spinner, TooltipAnchor } from '@librechat/client';
import {
  AlertTriangle,
  Bot,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  Eye,
  FileText,
  MicOff,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { createSafeFile } from '~/services/mdp/safeFiles';
import { anonymizeText, DEFAULT_PII_CHOICES, listDocumentTemplates } from '~/services/mdp';
import { exportDocxArtifact, fetchArtifactBlob } from '~/services/mdp/artifacts';
import { sendChat, transcribeAudio } from '~/services/mdp/chat';
import {
  MAYA_DEFAULT_ENDPOINT,
  MAYA_DEFAULT_MODEL,
  MAYA_ENDPOINTS,
  MAYA_MODELS,
} from '~/services/mdp/modelConfig';
import { normalizeMdpLanguage } from '~/services/mdp/language';
import { cn, triggerDownload } from '~/utils';
import store from '~/store';

import type { MayaSafeFileState, MayaSafeFileStatus } from '~/common';
import type { DocumentTemplate, MDPArtifact } from '~/services/mdp';
import type { FileRole } from '~/services/mdp/types';

type MeetingTypeKey =
  | 'integration_counseling'
  | 'cooperation_initial'
  | 'cooperation_followup'
  | 'objection_meeting'
  | 'benefits_initial'
  | 'general_case_note';


type AttachedNotesFile = {
  id: string;
  name: string;
  size: number;
  status: MayaSafeFileStatus;
  file: File;
  safeFile?: MayaSafeFileState;
  sourceText: string;
  error?: string;
};

type LocaleText = Record<string, Record<string, string>>;

const TEXT: LocaleText = {
  de: {
    title: 'Meeting Notes',
    subtitle: 'Gespräch aufnehmen oder notieren und daraus eine anonymisierte Fallnotiz erstellen.',
    details: 'Dokumentdaten',
    settings: 'Einstellungen',
    clientCase: 'Kundin / Fallnummer',
    clientName: 'Name Klientin',
    clientNameHint: 'z. B. Müller, Anna',
    caseWorker: 'Fallbearbeitung',
    meetingType: 'Gesprächsart',
    model: 'Modell',
    searchModels: 'Modelle suchen...',
    searchEndpointModels: '{{endpoint}}-Modelle suchen...',
    language: 'Whisper / Ausgabe',
    german: 'Deutsch',
    english: 'English',
    notes: 'Notizen und Transkript',
    notesPlaceholder:
      'Gesprächsnotizen eingeben oder mit dem Mikrofon aufnehmen. Beim Erstellen wird daraus automatisch eine TXT-Datei erzeugt, anonymisiert und für die Zusammenfassung genutzt.',
    record: 'Aufnehmen',
    stop: 'Stoppen',
    transcribing: 'Transkription läuft',
    anonymizing: 'TXT wird anonymisiert',
    ready: 'Bereit',
    failed: 'Fehlgeschlagen',
    preview: 'Vorschau',
    output: 'Ausgabe',
    create: 'Zusammenfassung erstellen',
    creating: 'Zusammenfassung wird erstellt...',
    copy: 'Kopieren',
    copied: 'Kopiert',
    downloadMd: 'Markdown herunterladen',
    regenerate: 'Neu erstellen',
    errorNotes: 'Bitte geben Sie Notizen ein oder nehmen Sie Audio auf.',
    errorFile: 'Die TXT-Datei konnte nicht anonymisiert werden.',
    errorGenerate: 'Meeting Notes konnten nicht erstellt werden.',
    errorGenerateTimeout:
      'Die VM hat nicht rechtzeitig geantwortet. Bitte Backend-Logs pruefen und erneut versuchen.',
    errorTemplate: 'Der Meeting-Notes-Systemprompt konnte nicht geladen werden.',
    newThread: 'new',
    caseHint: 'z. B. Fall 4711-00238',
    workerHint: 'Mustermann, Klaus',
  },
  en: {
    title: 'Meeting Notes',
    subtitle: 'Record or type notes and turn them into an anonymized case-note document.',
    details: 'Document details',
    settings: 'Settings',
    clientCase: 'Client / Case Number',
    clientName: 'Client Name',
    clientNameHint: 'e.g. Thomas, Jasmine',
    caseWorker: 'Case Worker',
    meetingType: 'Meeting Type',
    model: 'Model',
    searchModels: 'Search models...',
    searchEndpointModels: 'Search {{endpoint}} models...',
    language: 'Whisper / Output Language',
    german: 'Deutsch',
    english: 'English',
    notes: 'Notes and Transcript',
    notesPlaceholder:
      'Type meeting notes or use the microphone. When you create the summary, a TXT file is generated automatically, anonymized, and used as the source document.',
    record: 'Record',
    stop: 'Stop',
    transcribing: 'Transcribing',
    anonymizing: 'Anonymizing TXT',
    ready: 'Ready',
    failed: 'Failed',
    preview: 'Preview',
    output: 'Output',
    create: 'Create summary',
    creating: 'Creating summary...',
    copy: 'Copy',
    copied: 'Copied',
    downloadMd: 'Download Markdown',
    regenerate: 'Regenerate',
    errorNotes: 'Add notes or record audio first.',
    errorFile: 'The TXT file could not be anonymized.',
    errorGenerate: 'Meeting notes could not be generated.',
    errorGenerateTimeout:
      'The VM did not return a summary in time. Check backend logs and try again.',
    errorTemplate: 'The Meeting Notes system prompt could not be loaded.',
    newThread: 'new',
    caseHint: 'e.g. Case 4711-00238',
    workerHint: 'Mustermann, Klaus',
  },
};

const MEETING_SUMMARY_TIMEOUT_MS = 180000;

const MEETING_TYPES: Array<{
  key: MeetingTypeKey;
  number: number;
  de: string;
  en: string;
  promptLabel: string;
}> = [
  {
    key: 'integration_counseling',
    number: 1,
    de: 'Beratungsgespräch Integration',
    en: 'Integration advisory meeting',
    promptLabel: 'Beratungsgespräch Integration',
  },
  {
    key: 'cooperation_initial',
    number: 2,
    de: 'Kooperationsvertrag - Erstgespräch',
    en: 'Cooperation agreement - initial meeting',
    promptLabel: 'Kooperationsvertrag - Erstgespräch',
  },
  {
    key: 'cooperation_followup',
    number: 3,
    de: 'Kooperationsvertrag - Folgegespräch',
    en: 'Cooperation agreement - follow-up',
    promptLabel: 'Kooperationsvertrag - Folgegespräch',
  },
  {
    key: 'objection_meeting',
    number: 4,
    de: 'Widerspruchsgespräch',
    en: 'Objection meeting',
    promptLabel: 'Widerspruchsgespräch',
  },
  {
    key: 'benefits_initial',
    number: 5,
    de: 'Erstgespräch Leistungsgewährung',
    en: 'Initial meeting - benefit entitlement assessment',
    promptLabel: 'Erstgespräch Leistungsgewährung',
  },
  {
    key: 'general_case_note',
    number: 6,
    de: 'Aktenvermerk (allgemein)',
    en: 'General case note',
    promptLabel: 'Aktenvermerk (allgemein)',
  },
];

const MEETING_NOTES_TEMPLATE_ID = 'jobcenter_meeting_notes';

function meetingTemplateInstruction(template?: DocumentTemplate | null) {
  if (!template?.body) {
    return null;
  }
  return {
    name: `document_system_${template.id}`,
    description:
      typeof template.description_en === 'string'
        ? template.description_en
        : 'Jobcenter meeting documentation system prompt.',
    body: template.body,
  };
}

const MEETING_MODELS_BY_ENDPOINT = MAYA_MODELS as Record<string, string[]>;
const MEETING_ENDPOINT_OPTIONS = Object.keys(MEETING_MODELS_BY_ENDPOINT);

type OutputLanguage = 'de' | 'en';

function getMeetingEndpointLabel(endpoint: string): string {
  const endpointConfig = (MAYA_ENDPOINTS as Record<string, { modelDisplayLabel?: string }>)[
    endpoint
  ];
  return endpointConfig?.modelDisplayLabel ?? endpoint;
}

function getMeetingEndpointIconText(endpoint: string): string {
  const label = getMeetingEndpointLabel(endpoint).toLowerCase();
  if (label.includes('anthropic')) {
    return 'AI';
  }
  if (label.includes('google')) {
    return 'G';
  }
  return '◎';
}

function getMeetingEndpointModels(endpoint: string): string[] {
  return MEETING_MODELS_BY_ENDPOINT[endpoint] ?? [];
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) {
    return '0 KB';
  }
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function safeFilename(value: string): string {
  const compact = value
    .trim()
    .replace(/[^a-z0-9äöüß._ -]/gi, '')
    .replace(/\s+/g, '_');
  return compact || 'meeting_notes';
}

function getArtifactFormat(artifact: MDPArtifact): string {
  return String(artifact.format ?? artifact.content_type ?? artifact.filename ?? '').toLowerCase();
}

function getDocxArtifact(artifacts: MDPArtifact[]): MDPArtifact | undefined {
  return artifacts.find((artifact) => {
    const format = getArtifactFormat(artifact);
    return format.includes('docx') || format.includes('wordprocessingml');
  });
}

function getMarkdownArtifact(artifacts: MDPArtifact[]): MDPArtifact | undefined {
  return artifacts.find((artifact) => getArtifactFormat(artifact).includes('markdown'));
}

function getPdfPreviewArtifact(artifacts: MDPArtifact[]): MDPArtifact | undefined {
  return artifacts.find((artifact) => getArtifactFormat(artifact).includes('pdf'));
}

function isProcessingStatus(status?: MayaSafeFileStatus): boolean {
  return Boolean(status && ['uploading', 'scanning', 'anonymizing', 'indexing'].includes(status));
}

function buildMeetingPrompt({
  caseNumber,
  caseWorker,
  clientName,
  meetingTypeNumber,
  meetingTypeLabel,
  outputLanguage,
}: {
  caseNumber: string;
  caseWorker: string;
  clientName: string;
  meetingTypeNumber: number;
  meetingTypeLabel: string;
  outputLanguage: OutputLanguage;
}): string {
  const languageInstruction =
    outputLanguage === 'de'
      ? 'Ausgabesprache: Deutsch.'
      : 'Ausgabesprache: English. Keep German legal and Jobcenter terms where they are part of the template.';

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return `Meeting Type: ${meetingTypeNumber} - ${meetingTypeLabel}
Transcript:
The transcript is attached as an anonymized TXT file. Use only that attached document as the transcript source.

Provided context (use these values directly in the output):
- Case Number: ${caseNumber.trim() || '[not provided]'}
- Caseworker: ${caseWorker.trim() || '[not provided]'}
- Client Name: ${clientName.trim() || '[extract from transcript]'}
- Date of Contact: ${dateStr}
- Time of Contact: ${timeStr}
- ${languageInstruction}

Generate the case contact note following the system prompt exactly.`;
}

function makeNotesFileName(meetingTypeLabel: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${safeFilename(meetingTypeLabel)}_${stamp}.txt`;
}

function normalizeAnonymizedValues(
  values: Record<string, string | string[]>,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, Array.isArray(value) ? value : [value]]),
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

function getFriendlyErrorMessage(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : fallback;
  if (message.toLowerCase().includes('too many concurrent jobs')) {
    return 'Another anonymization job is still running. Wait a moment, then create the summary again.';
  }
  return message;
}

export default function MeetingNotes() {
  const { i18n } = useTranslation();
  const [mdpLanguage, setMdpLanguage] = useRecoilState(store.mdpAnonymizationLanguage);
  const setSafeFilePreview = useSetRecoilState(store.safeFilePreview);
  const uiLocale = i18n.language || 'en';
  const lang = uiLocale.startsWith('de') ? 'de' : 'en';
  const t = useCallback((key: string) => TEXT[lang]?.[key] ?? TEXT.en[key] ?? key, [lang]);

  const [caseNumber, setCaseNumber] = useState('');
  const [caseWorker, setCaseWorker] = useState('');
  const [clientName, setClientName] = useState('');
  const [meetingType, setMeetingType] = useState<MeetingTypeKey>('integration_counseling');
  const [meetingTemplate, setMeetingTemplate] = useState<DocumentTemplate | null>(null);
  const [isTemplateLoading, setIsTemplateLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [attachedFile, setAttachedFile] = useState<AttachedNotesFile | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [generatedContent, setGeneratedContent] = useState('');
  const [artifacts, setArtifacts] = useState<MDPArtifact[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>(MAYA_DEFAULT_ENDPOINT);
  const [selectedModel, setSelectedModel] = useState(MAYA_DEFAULT_MODEL);
  const [activeModelEndpoint, setActiveModelEndpoint] = useState<string>(MAYA_DEFAULT_ENDPOINT);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [endpointSearch, setEndpointSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const modelPickerRef = useRef<HTMLDivElement | null>(null);
  const generationInFlightRef = useRef(false);

  const outputLanguage = normalizeMdpLanguage(mdpLanguage);
  const selectedMeetingType = useMemo(
    () => MEETING_TYPES.find((candidate) => candidate.key === meetingType) ?? MEETING_TYPES[0],
    [meetingType],
  );
  const meetingTypeLabel = lang === 'de' ? selectedMeetingType.de : selectedMeetingType.en;
  const promptMeetingTypeLabel = selectedMeetingType.promptLabel;
  const selectedEndpointLabel = getMeetingEndpointLabel(selectedEndpoint);
  const activeEndpointLabel = getMeetingEndpointLabel(activeModelEndpoint);
  const endpointOptions = useMemo(() => {
    const query = endpointSearch.trim().toLowerCase();
    return MEETING_ENDPOINT_OPTIONS.filter((endpoint) => {
      if (!query) {
        return true;
      }
      const label = getMeetingEndpointLabel(endpoint).toLowerCase();
      return label.includes(query) || endpoint.toLowerCase().includes(query);
    });
  }, [endpointSearch]);
  const activeModelOptions = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    return getMeetingEndpointModels(activeModelEndpoint).filter((model) =>
      query ? model.toLowerCase().includes(query) : true,
    );
  }, [activeModelEndpoint, modelSearch]);
  const docxArtifact = useMemo(() => getDocxArtifact(artifacts), [artifacts]);
  const markdownArtifact = useMemo(() => getMarkdownArtifact(artifacts), [artifacts]);
  const hasProcessingFile = isProcessingStatus(attachedFile?.status);

  useEffect(() => {
    let isMounted = true;
    setIsTemplateLoading(true);
    listDocumentTemplates({ department: 'meeting_notes', documentType: meetingType })
      .then((templates) => {
        if (!isMounted) {
          return;
        }
        const nextTemplate =
          templates.find((template) => template.id === MEETING_NOTES_TEMPLATE_ID) ??
          templates[0] ??
          null;
        setMeetingTemplate(nextTemplate);
        if (!nextTemplate?.body) {
          setError(t('errorTemplate'));
        }
      })
      .catch(() => {
        if (isMounted) {
          setMeetingTemplate(null);
          setError(t('errorTemplate'));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsTemplateLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [meetingType, t]);

  useEffect(() => {
    const models = getMeetingEndpointModels(selectedEndpoint);
    if (models.length > 0 && !models.includes(selectedModel)) {
      setSelectedModel(models[0]);
    }
  }, [selectedEndpoint, selectedModel]);

  useEffect(() => {
    if (!modelPickerOpen) {
      return undefined;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (modelPickerRef.current?.contains(event.target as Node)) {
        return;
      }
      setModelPickerOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [modelPickerOpen]);

  const openNotesPreview = useCallback(
    (file: AttachedNotesFile) => {
      if (!file.safeFile) {
        return;
      }
      setSafeFilePreview({
        fileId: file.id,
        filename: file.name,
        safeFilename: file.safeFile.safeFilename ?? file.name,
        status: file.safeFile.status,
        mimeType: file.safeFile.mimeType ?? file.file.type,
        previewAnonymizedUrl: file.safeFile.previewAnonymizedUrl,
        anonymizedText: file.safeFile.anonymizedText,
        downloadUrl: file.safeFile.downloadUrl,
      });
    },
    [setSafeFilePreview],
  );

  const openGeneratedPreview = useCallback(
    (content: string, nextArtifacts: MDPArtifact[], nextSessionId?: string) => {
      if (!content.trim()) {
        return;
      }
      const nextDocxArtifact = getDocxArtifact(nextArtifacts);
      const pdfArtifact = getPdfPreviewArtifact(nextArtifacts);
      const baseName = safeFilename(meetingTypeLabel);
      const previewFilename = pdfArtifact?.filename ?? nextDocxArtifact?.filename ?? `${baseName}.md`;
      setSafeFilePreview({
        fileId: `meeting-notes-${nextDocxArtifact?.artifact_id ?? nextSessionId ?? 'preview'}`,
        filename: previewFilename,
        safeFilename: previewFilename,
        status: 'ready',
        statusLabel: t('ready'),
        mimeType: pdfArtifact ? 'application/pdf' : 'text/markdown',
        previewAnonymizedUrl: pdfArtifact?.inline_url ?? pdfArtifact?.download_url,
        previewText: pdfArtifact ? undefined : content,
        downloadUrl: nextDocxArtifact?.download_url,
        previewOnly: true,
      });
    },
    [meetingTypeLabel, setSafeFilePreview, t],
  );

  const anonymizeNotesFile = useCallback(
    async (textOverride?: string): Promise<AttachedNotesFile> => {
      const sourceText = (textOverride ?? notes).trim();
      if (!sourceText) {
        throw new Error(t('errorNotes'));
      }

      const rawFileId = crypto.randomUUID();
      const filename = makeNotesFileName(meetingTypeLabel);
      const file = new File([sourceText], filename, { type: 'text/plain;charset=utf-8' });
      const pending: AttachedNotesFile = {
        id: rawFileId,
        name: filename,
        size: file.size,
        status: 'uploading',
        file,
        sourceText,
      };
      setAttachedFile(pending);
      setIsAttaching(true);
      setError(null);

      try {
        const role: FileRole = 'transcription';
        const safeFile = await createSafeFile({
          file,
          rawFileId,
          filename,
          mimeType: 'text/plain',
          llmType: 'openai',
          lang: outputLanguage,
          role,
        });
        const ready: AttachedNotesFile = {
          ...pending,
          status: safeFile.status,
          safeFile: { ...safeFile, role },
          error: safeFile.error,
        };
        setAttachedFile(ready);
        return ready;
      } catch (err) {
        const errorMessage = getFriendlyErrorMessage(err, t('errorFile'));
        const failed: AttachedNotesFile = {
          ...pending,
          status: 'failed',
          error: errorMessage,
        };
        setAttachedFile(failed);
        throw new Error(errorMessage);
      } finally {
        setIsAttaching(false);
      }
    },
    [meetingTypeLabel, notes, outputLanguage, t],
  );

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener('stop', async () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsTranscribing(true);
        setError(null);
        try {
          const blob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          });
          const transcript = (await transcribeAudio(blob, outputLanguage)).trim();
          if (!transcript) {
            return;
          }
          setNotes((current) =>
            current.trim() ? `${current.trim()}\n\n${transcript}` : transcript,
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : t('errorFile'));
        } finally {
          setIsTranscribing(false);
        }
      });

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone unavailable');
    }
  }, [outputLanguage, t]);

  const ensureReadyAttachment = useCallback(async (): Promise<AttachedNotesFile> => {
    if (
      attachedFile?.status === 'ready' &&
      attachedFile.safeFile?.safeDocId &&
      attachedFile.sourceText.trim() === notes.trim()
    ) {
      return attachedFile;
    }
    return anonymizeNotesFile();
  }, [anonymizeNotesFile, attachedFile, notes]);

  const handleGenerate = useCallback(async () => {
    if (!notes.trim()) {
      setError(t('errorNotes'));
      return;
    }
    if (hasProcessingFile || isAttaching || isTranscribing) {
      setError(t('anonymizing'));
      return;
    }
    if (generationInFlightRef.current) {
      return;
    }

    generationInFlightRef.current = true;
    setError(null);
    setIsGenerating(true);
    try {
      const readyFile = await ensureReadyAttachment();
      const safeDocId = readyFile.safeFile?.safeDocId;
      if (!safeDocId) {
        throw new Error(t('errorFile'));
      }

      const skillInstruction = meetingTemplateInstruction(meetingTemplate);
      if (!skillInstruction) {
        throw new Error(t('errorTemplate'));
      }

      const prompt = buildMeetingPrompt({
        caseNumber,
        caseWorker,
        clientName,
        meetingTypeNumber: selectedMeetingType.number,
        meetingTypeLabel: promptMeetingTypeLabel,
        outputLanguage,
      });
      const anonymized = await anonymizeText(prompt, DEFAULT_PII_CHOICES, outputLanguage);
      const result = await withTimeout(
        sendChat({
          text: prompt,
          sessionId,
          lang: outputLanguage,
          anonymizedPrompt: anonymized.anonymized_prompt,
          anonymizedValues: normalizeAnonymizedValues(anonymized.anonymized_values),
          detectedValues: anonymized.detected_values,
          choices: DEFAULT_PII_CHOICES,
          docId: safeDocId,
          docIds: [safeDocId],
          fileRoles: { [safeDocId]: 'transcription' },
          manualSkills: [skillInstruction.name],
          skillInstructions: [skillInstruction],
          endpoint: selectedEndpoint,
          model: selectedModel,
          files: [
            {
              file_id: safeDocId,
              filename: readyFile.name,
              type: 'text/plain',
              filepath: readyFile.safeFile?.downloadUrl,
              height: 0,
              width: 0,
            },
          ],
        }),
        MEETING_SUMMARY_TIMEOUT_MS,
        t('errorGenerateTimeout'),
      );

      const responseText =
        result.rawResponse.replaced_response || result.rawResponse.llm_response || '';
      const nextArtifacts = result.rawResponse.artifacts ?? [];
      setSessionId(result.sessionId);
      setGeneratedContent(responseText);
      setArtifacts(nextArtifacts);
      openGeneratedPreview(responseText, nextArtifacts, result.sessionId);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, t('errorGenerate')));
    } finally {
      generationInFlightRef.current = false;
      setIsGenerating(false);
    }
  }, [
    caseNumber,
    caseWorker,
    clientName,
    ensureReadyAttachment,
    hasProcessingFile,
    isAttaching,
    isTranscribing,
    meetingTemplate,
    meetingType,
    notes,
    openGeneratedPreview,
    outputLanguage,
    promptMeetingTypeLabel,
    selectedEndpoint,
    selectedModel,
    sessionId,
    selectedMeetingType.number,
    t,
    ]);

  const handleCopy = useCallback(() => {
    if (!generatedContent) {
      return;
    }
    navigator.clipboard.writeText(generatedContent).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }, [generatedContent]);

  const handlePreviewGenerated = useCallback(() => {
    openGeneratedPreview(generatedContent, artifacts, sessionId);
  }, [artifacts, generatedContent, openGeneratedPreview, sessionId]);

  const handleDownloadMarkdown = useCallback(async () => {
    const filename = `${safeFilename(meetingTypeLabel)}.md`;
    if (markdownArtifact?.download_url) {
      const blob = await fetchArtifactBlob(markdownArtifact.download_url);
      triggerDownload(URL.createObjectURL(blob), markdownArtifact.filename ?? filename);
      return;
    }
    const blob = new Blob([generatedContent], { type: 'text/markdown;charset=utf-8' });
    triggerDownload(URL.createObjectURL(blob), filename);
  }, [generatedContent, markdownArtifact, meetingTypeLabel]);

  const handleDownloadDocx = useCallback(async () => {
    if (!generatedContent) {
      return;
    }
    setIsDownloadingDocx(true);
    const filename = `${safeFilename(meetingTypeLabel)}.docx`;
    try {
      const blob = docxArtifact?.download_url
        ? await fetchArtifactBlob(docxArtifact.download_url)
        : await exportDocxArtifact({ contentMarkdown: generatedContent, filename });
      triggerDownload(URL.createObjectURL(blob), docxArtifact?.filename ?? filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'DOCX export failed');
    } finally {
      setIsDownloadingDocx(false);
    }
  }, [docxArtifact, generatedContent, meetingTypeLabel]);

  const handleResetOutput = useCallback(() => {
    setGeneratedContent('');
    setArtifacts([]);
    setError(null);
  }, []);

  const statusIcon =
    attachedFile?.status === 'failed' ? (
      <AlertTriangle className="h-4 w-4 text-red-600" />
    ) : attachedFile?.status === 'ready' ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
    ) : attachedFile ? (
      <Spinner size={14} />
    ) : null;

  const openModelPicker = useCallback(() => {
    setActiveModelEndpoint(selectedEndpoint);
    setEndpointSearch('');
    setModelSearch('');
    setModelPickerOpen(true);
  }, [selectedEndpoint]);

  const renderModelSelector = () => (
    <div ref={modelPickerRef} className="relative mb-4">
      <button
        type="button"
        onClick={openModelPicker}
        onFocus={openModelPicker}
        onMouseEnter={() => {
          if (!modelPickerOpen) {
            openModelPicker();
          }
        }}
        className="flex h-10 w-full items-center justify-between rounded-md border border-border-light bg-surface-primary-alt px-3 text-left text-sm transition-colors hover:bg-surface-hover"
        aria-expanded={modelPickerOpen}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Bot className="h-4 w-4 shrink-0 text-text-secondary" />
          <span className="truncate font-medium text-text-primary">{selectedModel}</span>
          <span className="hidden truncate text-xs text-text-secondary sm:inline">
            {selectedEndpointLabel}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-text-secondary" />
      </button>

      {modelPickerOpen && (
        <div className="absolute left-0 top-12 z-[70] flex gap-2">
          <div className="w-72 rounded-lg border border-border-light bg-surface-primary p-2 shadow-xl">
            <div className="mb-2 flex h-10 items-center gap-2 rounded-md border border-border-heavy bg-surface-primary-alt px-3">
              <Search className="h-4 w-4 text-text-secondary" />
              <input
                value={endpointSearch}
                onChange={(event) => setEndpointSearch(event.target.value)}
                placeholder={t('searchModels')}
                className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-text-secondary"
              />
            </div>
            <div className="space-y-1">
              {endpointOptions.map((endpoint) => {
                const selected = selectedEndpoint === endpoint;
                const active = activeModelEndpoint === endpoint;
                return (
                  <button
                    key={endpoint}
                    type="button"
                    onClick={() => setActiveModelEndpoint(endpoint)}
                    onMouseEnter={() => setActiveModelEndpoint(endpoint)}
                    className={cn(
                      'flex h-10 w-full items-center justify-between rounded-md px-3 text-left text-sm transition-colors',
                      active ? 'bg-surface-hover text-text-primary' : 'text-text-primary',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex h-5 min-w-5 items-center justify-center text-sm font-semibold">
                        {getMeetingEndpointIconText(endpoint)}
                      </span>
                      <span className="truncate">{getMeetingEndpointLabel(endpoint)}</span>
                    </span>
                    <span className="flex items-center gap-2 text-text-secondary">
                      {selected && <Check className="h-4 w-4" />}
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-72 rounded-lg border border-border-light bg-surface-primary p-2 shadow-xl">
            <div className="mb-2 flex h-10 items-center gap-2 rounded-md border border-border-light bg-surface-primary-alt px-3">
              <Search className="h-4 w-4 text-text-secondary" />
              <input
                value={modelSearch}
                onChange={(event) => setModelSearch(event.target.value)}
                placeholder={t('searchEndpointModels').replace('{{endpoint}}', activeEndpointLabel)}
                className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-text-secondary"
              />
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {activeModelOptions.map((model) => {
                const selected =
                  selectedEndpoint === activeModelEndpoint && selectedModel === model;
                return (
                  <button
                    key={`${activeModelEndpoint}-${model}`}
                    type="button"
                    onClick={() => {
                      setSelectedEndpoint(activeModelEndpoint);
                      setSelectedModel(model);
                      setModelPickerOpen(false);
                      setError(null);
                    }}
                    className={cn(
                      'flex h-10 w-full items-center justify-between rounded-md px-3 text-left text-sm transition-colors hover:bg-surface-hover',
                      selected ? 'bg-surface-hover text-text-primary' : 'text-text-primary',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex h-5 min-w-5 items-center justify-center text-sm font-semibold">
                        {getMeetingEndpointIconText(activeModelEndpoint)}
                      </span>
                      <span className="truncate">{model}</span>
                    </span>
                    {selected && <Check className="h-4 w-4 text-text-secondary" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderRecorderIcon = () => {
    if (isRecording) {
      return <MicOff className="h-5 w-5 stroke-red-500" />;
    }
    if (isTranscribing) {
      return <Spinner className="stroke-text-secondary" />;
    }
    return <ListeningIcon className="stroke-text-secondary" />;
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface-primary-alt text-text-primary">
      <header className="flex shrink-0 items-center justify-between border-b border-border-light bg-surface-primary px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-brand h-5 w-5" />
            <h1 className="truncate text-lg font-semibold">{t('title')}</h1>
          </div>
          <p className="mt-1 text-sm text-text-secondary">{t('subtitle')}</p>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <aside className="min-h-0 space-y-4 overflow-visible pr-1">
          <section className="rounded-lg border border-border-light bg-surface-primary p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <BriefcaseBusiness className="text-brand h-4 w-4" />
              {t('details')}
            </div>
            <label className="mb-3 block">
              <span className="mb-2 block text-xs font-semibold uppercase text-text-secondary">
                {t('clientCase')}
              </span>
              <input
                value={caseNumber}
                onChange={(event) => {
                  setCaseNumber(event.target.value);
                  setError(null);
                }}
                placeholder={t('caseHint')}
                className="focus:border-brand h-10 w-full rounded-md border border-border-light bg-surface-primary-alt px-3 text-sm outline-none transition-colors placeholder:text-text-secondary"
              />
            </label>
            <label className="mb-3 block">
              <span className="mb-2 block text-xs font-semibold uppercase text-text-secondary">
                {t('caseWorker')}
              </span>
              <input
                value={caseWorker}
                onChange={(event) => {
                  setCaseWorker(event.target.value);
                  setError(null);
                }}
                placeholder={t('workerHint')}
                className="focus:border-brand h-10 w-full rounded-md border border-border-light bg-surface-primary-alt px-3 text-sm outline-none transition-colors placeholder:text-text-secondary"
              />
            </label>
            <label className="mb-3 block">
              <span className="mb-2 block text-xs font-semibold uppercase text-text-secondary">
                {t('clientName')}
              </span>
              <input
                value={clientName}
                onChange={(event) => {
                  setClientName(event.target.value);
                  setError(null);
                }}
                placeholder={t('clientNameHint')}
                className="focus:border-brand h-10 w-full rounded-md border border-border-light bg-surface-primary-alt px-3 text-sm outline-none transition-colors placeholder:text-text-secondary"
              />
            </label>
          </section>

          <section className="rounded-lg border border-border-light bg-surface-primary p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <FileText className="text-brand h-4 w-4" />
              {t('meetingType')}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {MEETING_TYPES.map((type) => (
                <button
                  key={type.key}
                  type="button"
                  onClick={() => {
                    setMeetingType(type.key);
                    setError(null);
                  }}
                  className={cn(
                    'rounded-md border px-3 py-2 text-left text-sm transition-colors',
                    meetingType === type.key
                      ? 'border-brand bg-brand/10 text-text-primary'
                      : 'border-border-light bg-surface-primary-alt text-text-secondary hover:bg-surface-hover',
                  )}
                >
                  {lang === 'de' ? type.de : type.en}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border-light bg-surface-primary p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="text-brand h-4 w-4" />
              {t('settings')}
            </div>
            <label className="mb-2 block text-xs font-semibold uppercase text-text-secondary">
              {t('model')}
            </label>
            {renderModelSelector()}

            <label className="mb-2 block text-xs font-semibold uppercase text-text-secondary">
              {t('language')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['de', 'en'] as OutputLanguage[]).map((language) => (
                <button
                  key={language}
                  type="button"
                  onClick={() => {
                    setMdpLanguage(language);
                    setError(null);
                  }}
                  className={cn(
                    'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                    outputLanguage === language
                      ? 'border-brand bg-brand/10 text-text-primary'
                      : 'border-border-light bg-surface-primary-alt text-text-secondary hover:bg-surface-hover',
                  )}
                >
                  {language === 'de' ? t('german') : t('english')}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <main className="flex min-h-0 flex-col overflow-hidden">
          <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-border-light bg-surface-primary p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="text-brand h-4 w-4" />
                {t('notes')}
              </div>
              <TooltipAnchor
                description={isRecording ? t('stop') : t('record')}
                render={
                  <button
                    type="button"
                    aria-label={isRecording ? t('stop') : t('record')}
                    aria-pressed={isRecording}
                    disabled={isTranscribing || isAttaching || isGenerating}
                    onClick={isRecording ? stopRecording : startRecording}
                    className={cn(
                      'flex size-10 items-center justify-center rounded-full p-1 transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60',
                      isRecording && 'animate-pulse bg-red-500/10',
                    )}
                  >
                    {renderRecorderIcon()}
                  </button>
                }
              />
            </div>

            <textarea
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                setError(null);
              }}
              placeholder={t('notesPlaceholder')}
              className="focus:border-brand min-h-[360px] flex-1 resize-none rounded-lg border border-border-light bg-surface-primary-alt px-3 py-3 text-sm leading-6 outline-none transition-colors placeholder:text-text-secondary"
            />

            {(isTranscribing || isAttaching || attachedFile) && (
              <div className="mt-3 rounded-lg border border-border-light bg-surface-primary-alt px-3 py-2">
                {isTranscribing && (
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Spinner size={12} />
                    {t('transcribing')}
                  </div>
                )}
                {isAttaching && (
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Spinner size={12} />
                    {t('anonymizing')}
                  </div>
                )}
                {attachedFile && !isAttaching && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-hover">
                        {statusIcon}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium" title={attachedFile.name}>
                          {attachedFile.name}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                          <span>{formatBytes(attachedFile.size)}</span>
                          <span
                            className={cn(
                              attachedFile.status === 'ready' && 'text-emerald-600',
                              attachedFile.status === 'failed' && 'text-red-600',
                              isProcessingStatus(attachedFile.status) && 'text-sky-600',
                            )}
                          >
                            {attachedFile.status === 'ready'
                              ? t('ready')
                              : attachedFile.status === 'failed'
                                ? t('failed')
                                : t('anonymizing')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1.5"
                      disabled={!attachedFile.safeFile || attachedFile.status !== 'ready'}
                      onClick={() => openNotesPreview(attachedFile)}
                    >
                      <Eye className="h-4 w-4" />
                      {t('preview')}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>
        </main>

        <aside className="min-h-0 space-y-4 overflow-y-auto pl-1">
          <section className="rounded-lg border border-border-light bg-surface-primary p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Thread
              </div>
              <span className="rounded-md bg-surface-hover px-2 py-1 text-xs text-text-secondary">
                {sessionId ? sessionId.slice(0, 8) : t('newThread')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-xs text-text-secondary">
              <div className="rounded-md bg-surface-primary-alt p-2">
                <div className="text-sm font-semibold text-text-primary">
                  {attachedFile?.status === 'ready' ? 1 : 0}
                </div>
                TXT
              </div>
              <div className="rounded-md bg-surface-primary-alt p-2">
                <div className="text-sm font-semibold text-text-primary">{artifacts.length}</div>
                Artifacts
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border-light bg-surface-primary p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Download className="text-brand h-4 w-4" />
                {t('output')}
              </div>
              {generatedContent && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1"
                  onClick={handleResetOutput}
                >
                  <RefreshCw className="h-4 w-4" />
                  {t('regenerate')}
                </Button>
              )}
            </div>

            {error && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </div>
            )}

            <Button
              type="button"
              className="mb-3 h-10 w-full gap-2"
              disabled={
                isGenerating ||
                isAttaching ||
                isTranscribing ||
                isTemplateLoading ||
                hasProcessingFile ||
                !notes.trim() ||
                !meetingTemplate?.body
              }
              onClick={handleGenerate}
            >
              {isGenerating || isAttaching || isTranscribing || isTemplateLoading ? (
                <Spinner size={16} />
              ) : (
                <Bot className="h-4 w-4" />
              )}
              {isGenerating || isAttaching || isTranscribing || isTemplateLoading
                ? t('creating')
                : t('create')}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mb-2 h-9 w-full gap-1.5"
              disabled={!generatedContent}
              onClick={handlePreviewGenerated}
            >
              <Eye className="h-4 w-4" />
              {t('preview')}
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 flex-1 gap-1.5"
                disabled={!generatedContent}
                onClick={handleCopy}
              >
                <Copy className="h-4 w-4" />
                {copied ? t('copied') : t('copy')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 flex-1 gap-1.5"
                disabled={!generatedContent || isDownloadingDocx}
                onClick={handleDownloadDocx}
              >
                {isDownloadingDocx ? <Spinner size={14} /> : <Download className="h-4 w-4" />}
                DOCX
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 h-8 w-full gap-1.5"
              disabled={!generatedContent}
              onClick={handleDownloadMarkdown}
            >
              <Download className="h-4 w-4" />
              {t('downloadMd')}
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}
