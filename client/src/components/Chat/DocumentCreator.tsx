import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { Button, Spinner } from '@librechat/client';
import {
  AlertTriangle,
  BookOpen,
  Bot,
  BriefcaseBusiness,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileText,
  FolderUp,
  Mic,
  MicOff,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { createSafeFile } from '~/services/mdp/safeFiles';
import { transcribeAudio, sendChat } from '~/services/mdp/chat';
import { exportDocxArtifact, fetchArtifactBlob } from '~/services/mdp/artifacts';
import { anonymizeText, DEFAULT_PII_CHOICES, listDocumentTemplates } from '~/services/mdp';
import {
  MAYA_DEFAULT_ENDPOINT,
  MAYA_DEFAULT_MODEL,
  MAYA_ENDPOINTS,
  MAYA_MODELS,
} from '~/services/mdp/modelConfig';
import { cn, triggerDownload } from '~/utils';
import store from '~/store';

import type { DocumentTemplate, MDPArtifact } from '~/services/mdp';
import type { MayaSafeFileState, MayaSafeFileStatus } from '~/common';

type Department = 'leistung' | 'integration' | 'fuehrung' | 'but' | 'recht';
type FileRole = 'case_file' | 'reference_file';

type DocumentType = {
  key: string;
  de: string;
  en: string;
  category?: string;
};

type DocumentFile = {
  id: string;
  name: string;
  size: number;
  status: MayaSafeFileStatus;
  role: FileRole;
  file: File;
  safeFile?: MayaSafeFileState;
  error?: string;
};

type LocaleText = Record<string, Record<string, string>>;

const TEXT: LocaleText = {
  de: {
    title: 'Dokument erstellen',
    subtitle: 'Akten, Vorlagen und Auftrag in einem anonymisierten Dokumentenlauf.',
    close: 'Schließen',
    setup: 'Dokument',
    files: 'Unterlagen',
    prompt: 'Auftrag',
    output: 'Ausgabe',
    department: 'Abteilung',
    documentType: 'Dokumenttyp',
    caseFiles: 'Falldokumente',
    referenceFiles: 'Referenzdokumente',
    caseHint: 'Primäre Faktenbasis',
    refHint: 'Vorlagen, Muster, Leitlinien',
    dropCase: 'Falldateien hochladen',
    dropRef: 'Referenzen hochladen',
    task: 'Auftrag an die KI',
    taskPlaceholder: 'Beschreiben Sie, was das Dokument leisten soll. Stichpunkte reichen aus.',
    plain: 'Einfache Sprache',
    record: 'Diktieren',
    stop: 'Stoppen',
    create: 'Dokument erstellen',
    creating: 'Dokument wird erstellt...',
    copy: 'Kopieren',
    copied: 'Kopiert',
    downloadDocx: 'DOCX herunterladen',
    downloadMd: 'Markdown herunterladen',
    regenerate: 'Neu erstellen',
    ready: 'Bereit',
    failed: 'Fehlgeschlagen',
    processing: 'Anonymisierung läuft',
    preview: 'Ansehen',
    remove: 'Entfernen',
    session: 'Thread',
    errorRequired:
      'Bitte wählen Sie Abteilung und Dokumenttyp und geben Sie einen Auftrag oder eine Vorlage an.',
    errorFiles: 'Bitte warten Sie, bis alle Dateien anonymisiert sind.',
    errorCaseFiles:
      'Bitte laden Sie mindestens eine Falldatei hoch, bevor Sie ein Dokument erstellen.',
    errorGenerate: 'Dokument konnte nicht erstellt werden.',
    emptyOutput: 'Noch kein Dokument erstellt.',
    uploadNote: 'PDF, DOCX, TXT, Bilder',
    artifacts: 'Artefakte',
    transcribing: 'Transkription läuft',
    docxReady: 'DOCX bereit',
    pdfPreviewReady: 'PDF-Vorschau bereit',
    settings: 'Einstellungen',
    model: 'Modell',
    endpoint: 'Anbieter',
    searchModels: 'Modelle suchen...',
    searchEndpointModels: '{{endpoint}}-Modelle suchen...',
    documentLanguage: 'Dokumentsprache',
    german: 'Deutsch',
    english: 'Englisch',
    dept_leistung: 'Leistungsgewährung',
    dept_integration: 'Integration',
    dept_fuehrung: 'Führungskräfte',
    dept_but: 'BuT',
    dept_recht: 'Fachreferat Recht',
  },
  en: {
    title: 'Create document',
    subtitle: 'Case files, references, and instructions in one anonymized document run.',
    close: 'Close',
    setup: 'Document',
    files: 'Files',
    prompt: 'Prompt',
    output: 'Output',
    department: 'Department',
    documentType: 'Document type',
    caseFiles: 'Case files',
    referenceFiles: 'Reference files',
    caseHint: 'Primary fact source',
    refHint: 'Templates, samples, guidance',
    dropCase: 'Upload case files',
    dropRef: 'Upload references',
    task: 'AI instruction',
    taskPlaceholder: 'Describe what the document should produce. Bullet points are fine.',
    plain: 'Plain language',
    record: 'Dictate',
    stop: 'Stop',
    create: 'Create document',
    creating: 'Creating document...',
    copy: 'Copy',
    copied: 'Copied',
    downloadDocx: 'Download DOCX',
    downloadMd: 'Download Markdown',
    regenerate: 'Regenerate',
    ready: 'Ready',
    failed: 'Failed',
    processing: 'Anonymizing',
    preview: 'Preview',
    remove: 'Remove',
    session: 'Thread',
    errorRequired: 'Select a department and document type, then add an instruction or template.',
    errorFiles: 'Wait until every file has been anonymized.',
    errorCaseFiles: 'Upload at least one case file before creating a document.',
    errorGenerate: 'Document could not be created.',
    emptyOutput: 'No document generated yet.',
    uploadNote: 'PDF, DOCX, TXT, images',
    artifacts: 'Artifacts',
    transcribing: 'Transcribing',
    docxReady: 'DOCX ready',
    pdfPreviewReady: 'PDF preview ready',
    settings: 'Settings',
    model: 'Model',
    endpoint: 'Provider',
    searchModels: 'Search models...',
    searchEndpointModels: 'Search {{endpoint}} models...',
    documentLanguage: 'Document language',
    german: 'Deutsch',
    english: 'English',
    dept_leistung: 'Benefits administration',
    dept_integration: 'Integration',
    dept_fuehrung: 'Management',
    dept_but: 'BuT',
    dept_recht: 'Legal department',
  },
};

const DEPARTMENTS: Department[] = ['leistung', 'integration', 'fuehrung', 'but', 'recht'];

const DOCUMENT_TYPES: Record<Department, DocumentType[]> = {
  leistung: [
    {
      key: 'widerspruch_vorverfahren',
      de: 'Widerspruch Vorverfahren',
      en: 'Objection pre-proceedings',
      category: 'Widerspruch',
    },
    {
      key: 'widerspruch_ablehnung',
      de: 'Widerspruch Ablehnung',
      en: 'Objection rejection',
      category: 'Widerspruch',
    },
    {
      key: 'ablehnung_begruendung',
      de: 'Ablehnungsbescheid',
      en: 'Rejection notice',
      category: 'Widerspruch',
    },
    { key: 'mitwirkungsschreiben', de: 'Mitwirkungsschreiben', en: 'Cooperation request' },
    {
      key: 'ueberpruefungsantrag',
      de: 'Überprüfungsantrag',
      en: 'Review application',
      category: 'Überprüfung',
    },
    { key: 'aktenvermerk', de: 'Aktenvermerk', en: 'Case note', category: 'Aktenvermerk' },
  ],
  integration: [
    { key: 'kooperationsvertrag', de: 'Kooperationsvertrag', en: 'Cooperation agreement' },
    {
      key: 'stellungnahme_sgbxii',
      de: 'Stellungnahme Übergang SGB XII',
      en: 'SGB XII transfer statement',
    },
    {
      key: 'ablehnung_einstiegsgeld',
      de: 'Ablehnung Einstiegsgeld',
      en: 'Start-up allowance rejection',
    },
    { key: 'stellungnahme_u25', de: 'Stellungnahme Auszug U25', en: 'Under-25 move-out statement' },
    {
      key: 'einladung_gruppenveranstaltung',
      de: 'Einladung Gruppenveranstaltung',
      en: 'Group event invitation',
    },
    { key: 'aktenvermerk', de: 'Aktenvermerk', en: 'Case note', category: 'Aktenvermerk' },
  ],
  fuehrung: [
    { key: 'hausverbotsverfahren', de: 'Hausverbotsverfahren', en: 'Premises ban procedure' },
    { key: 'beurteilung', de: 'Beurteilung', en: 'Performance review' },
    {
      key: 'mitarbeitergespraech_empfehlung',
      de: 'Handlungsempfehlung Mitarbeitergespräch',
      en: 'Staff meeting guidance',
    },
    { key: 'stellungnahme_abmahnung', de: 'Stellungnahme Abmahnung', en: 'Warning statement' },
    { key: 'stellungnahme_probezeit', de: 'Stellungnahme Probezeit', en: 'Probation statement' },
    { key: 'sachverhalt_allgemein', de: 'Sachverhaltsdarstellung', en: 'Case summary' },
    { key: 'antwort_beschwerde', de: 'Antwortentwurf Beschwerde', en: 'Complaint response draft' },
  ],
  but: [
    { key: 'klassenfahrt', de: 'Klassenfahrt', en: 'School trip' },
    { key: 'vereinsbeitraege', de: 'Vereinsbeiträge', en: 'Club fees' },
    { key: 'nachhilfe', de: 'Nachhilfe', en: 'Tutoring' },
    { key: 'mittagsverpflegung', de: 'Mittagsverpflegung', en: 'School meals' },
    {
      key: 'ueberpruefungsantrag',
      de: 'Überprüfungsantrag',
      en: 'Review application',
      category: 'Überprüfung',
    },
    { key: 'aktenvermerk', de: 'Aktenvermerk', en: 'Case note', category: 'Aktenvermerk' },
  ],
  recht: [
    { key: 'widerspruch', de: 'Widerspruch', en: 'Objection', category: 'Widerspruch' },
    {
      key: 'widerspruch_ablehnung',
      de: 'Widerspruch Ablehnung',
      en: 'Objection rejection',
      category: 'Widerspruch',
    },
    {
      key: 'ueberpruefungsantrag',
      de: 'Überprüfungsantrag',
      en: 'Review application',
      category: 'Überprüfung',
    },
    { key: 'aktenvermerk', de: 'Aktenvermerk', en: 'Case note', category: 'Aktenvermerk' },
  ],
};

const DOCUMENT_SKILL_INSTRUCTION = {
  name: 'document_create',
  description: 'Create structured administrative JSON for document generation.',
  body: 'Return only valid JSON following the selected system prompt schema. Preserve anonymization placeholders exactly so the backend can reidentify the final response and exported DOCX. Do not wrap the JSON in Markdown fences, chat prefaces, apologies, or explanatory text.',
};

const DOCUMENT_MODELS_BY_ENDPOINT = MAYA_MODELS as Record<string, string[]>;
const DOCUMENT_ENDPOINT_OPTIONS = Object.keys(DOCUMENT_MODELS_BY_ENDPOINT);
type DocumentOutputLanguage = 'de' | 'en';

function getDocumentEndpointLabel(endpoint: string): string {
  const endpointConfig = (MAYA_ENDPOINTS as Record<string, { modelDisplayLabel?: string }>)[
    endpoint
  ];
  return endpointConfig?.modelDisplayLabel ?? endpoint;
}

function getDocumentEndpointIconText(endpoint: string): string {
  const label = getDocumentEndpointLabel(endpoint).toLowerCase();
  if (label.includes('anthropic')) {
    return 'AI';
  }
  if (label.includes('google')) {
    return 'G';
  }
  return '◎';
}

function getDocumentEndpointModels(endpoint: string): string[] {
  return DOCUMENT_MODELS_BY_ENDPOINT[endpoint] ?? [];
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
  return compact || 'document';
}

function fileInputId(role: FileRole): string {
  return `document-creator-${role}`;
}

function isProcessingStatus(status: MayaSafeFileStatus): boolean {
  return ['uploading', 'scanning', 'anonymizing', 'indexing'].includes(status);
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

function getPdfArtifact(artifacts: MDPArtifact[]): MDPArtifact | undefined {
  return artifacts.find((artifact) => {
    const format = getArtifactFormat(artifact);
    return format === 'pdf' || format.includes('application/pdf');
  });
}

function getMarkdownArtifact(artifacts: MDPArtifact[]): MDPArtifact | undefined {
  return artifacts.find((artifact) => getArtifactFormat(artifact).includes('markdown'));
}

function documentTemplateInstruction(template?: DocumentTemplate) {
  if (!template?.body) {
    return null;
  }
  return {
    name: `document_system_${template.id}`,
    description:
      typeof template.description_en === 'string'
        ? template.description_en
        : 'Department and document-type system prompt for document creation.',
    body: template.body,
  };
}

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanJsonText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/i, '')
      .trim();
  }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function parseJsonDocument(text: string): JsonRecord | null {
  try {
    const parsed = JSON.parse(cleanJsonText(text)) as unknown;
    return isJsonRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function appendValue(lines: string[], value: unknown): void {
  const text = stringValue(value);
  if (text) {
    lines.push(text, '');
  }
}

function renderRecipient(recipient: unknown): string[] {
  if (!isJsonRecord(recipient)) {
    return [];
  }
  const salutation = stringValue(recipient.salutation);
  const firstName = stringValue(recipient.first_name);
  const lastName = stringValue(recipient.last_name);
  const street = stringValue(recipient.street);
  const postalCode = stringValue(recipient.postal_code);
  const city = stringValue(recipient.city);
  const name = [salutation, firstName, lastName].filter(Boolean).join(' ');
  const place = [postalCode, city].filter(Boolean).join(' ');
  return [name, street, place].filter(Boolean);
}

function appendLegalRemedy(lines: string[], content: unknown): void {
  if (!isJsonRecord(content)) {
    return;
  }
  appendValue(lines, content.intro);
  appendValue(lines, content.how_title);
  appendValue(lines, content.how_content);
  appendValue(lines, content.must_contain_title);
  if (Array.isArray(content.must_contain_items)) {
    content.must_contain_items.forEach((item) => lines.push(`- ${stringValue(item)}`));
    lines.push('');
  }
  appendValue(lines, content.should_contain_title);
  if (Array.isArray(content.should_contain_items)) {
    content.should_contain_items.forEach((item) => lines.push(`- ${stringValue(item)}`));
    lines.push('');
  }
  appendValue(lines, content.when_title);
  appendValue(lines, content.when_content);
  appendValue(lines, content.where_title);
  appendValue(lines, content.where_content);
  appendValue(lines, content.additional_info);
}

function humanizeKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

function renderUnknownJson(lines: string[], value: unknown, heading?: string): void {
  if (Array.isArray(value)) {
    if (heading) {
      lines.push(`## ${heading}`, '');
    }
    value.forEach((item) => {
      if (isJsonRecord(item)) {
        renderUnknownJson(lines, item);
      } else {
        const text = stringValue(item);
        if (text) {
          lines.push(`- ${text}`);
        }
      }
    });
    lines.push('');
    return;
  }
  if (isJsonRecord(value)) {
    if (heading) {
      lines.push(`## ${heading}`, '');
    }
    Object.entries(value).forEach(([key, nested]) => {
      renderUnknownJson(lines, nested, humanizeKey(key));
    });
    return;
  }
  const text = stringValue(value);
  if (text) {
    if (heading) {
      lines.push(`## ${heading}`, '');
    }
    lines.push(text, '');
  }
}

function renderDocumentJsonAsMarkdown(text: string): string | null {
  const doc = parseJsonDocument(text);
  if (!doc) {
    return null;
  }

  const lines: string[] = [];
  const title = stringValue(doc.decision_type) || stringValue(doc.document_title);
  if (title) {
    lines.push(`# ${title}`, '');
  }

  appendValue(lines, doc.header);
  appendValue(lines, doc.subject_line);
  renderRecipient(doc.recipient).forEach((line) => lines.push(line));
  if (isJsonRecord(doc.recipient)) {
    lines.push('');
  }
  appendValue(lines, doc.service_title);
  appendValue(lines, doc.reference);
  if (!title) {
    appendValue(lines, doc.document_type);
  }
  appendValue(lines, doc.salutation_text);
  appendValue(lines, doc.opening_statement);
  appendValue(lines, doc.cost_statement);

  const factsHeading = stringValue(doc.facts_heading);
  if (factsHeading || doc.facts_content) {
    lines.push(`## ${factsHeading || 'Sachverhalt'}`, '');
    appendValue(lines, doc.facts_content);
  }

  const reasoningHeading = stringValue(doc.reasoning_heading);
  const assessmentHeading = stringValue(doc.assessment_heading);
  const assessmentContent = doc.reasoning_content ?? doc.assessment_content;
  if (reasoningHeading || assessmentHeading || assessmentContent) {
    lines.push(`## ${reasoningHeading || assessmentHeading || 'Begründung'}`, '');
    appendValue(lines, assessmentContent);
  }

  const resultHeading = stringValue(doc.result_heading);
  if (resultHeading || doc.result_content) {
    lines.push(`## ${resultHeading || 'Ergebnis'}`, '');
    appendValue(lines, doc.result_content);
  }

  const nextStepsHeading = stringValue(doc.next_steps_heading);
  if (nextStepsHeading || doc.next_steps_content) {
    lines.push(`## ${nextStepsHeading || 'Weitere Schritte'}`, '');
    appendValue(lines, doc.next_steps_content);
  }

  if (Array.isArray(doc.missing_information) && doc.missing_information.length > 0) {
    lines.push('## Fehlende Informationen', '');
    doc.missing_information.forEach((item) => {
      const value = stringValue(item);
      if (value) {
        lines.push(`- ${value}`);
      }
    });
    lines.push('');
  }

  const legalRemedyHeading = stringValue(doc.legal_remedy_heading);
  if (legalRemedyHeading || doc.legal_remedy_content) {
    lines.push(`## ${legalRemedyHeading || 'Ihre Rechte'}`, '');
    appendLegalRemedy(lines, doc.legal_remedy_content);
  }

  appendValue(lines, doc.closing);

  if (lines.length <= 2) {
    renderUnknownJson(lines, doc);
  }

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildDocumentPrompt({
  departmentLabel,
  documentTypeLabel,
  taskDescription,
  plainLanguage,
  caseFileCount,
  referenceFileCount,
  outputLanguage,
}: {
  departmentLabel: string;
  documentTypeLabel: string;
  taskDescription: string;
  plainLanguage: boolean;
  caseFileCount: number;
  referenceFileCount: number;
  outputLanguage: DocumentOutputLanguage;
}): string {
  const outputLanguageLabel = outputLanguage === 'de' ? 'German (Deutsch)' : 'English';
  return `Use the selected system prompt to create final German administrative document data as structured JSON.

Department: ${departmentLabel}
Document type: ${documentTypeLabel}
Case files attached: ${caseFileCount}
Reference files attached: ${referenceFileCount}
Plain language required: ${plainLanguage ? 'yes' : 'no'}
Output language: ${outputLanguageLabel}

Use files by role:
- case_file: primary facts and evidence. Do not replace these facts with reference examples.
- reference_file: structure, tone, examples, legal guidance, and templates only.

USER PROMPT / TASK DESCRIPTION
${taskDescription.trim() || '(No additional free-text instruction provided.)'}

Output rules:
- Return only valid JSON following the selected system prompt schema.
- Write generated document content in ${outputLanguageLabel}, even when the UI labels or instructions use another language.
- Preserve anonymization placeholders exactly.
- Do not include commentary about the process.
- Do not wrap the JSON in Markdown fences.`;
}

export default function DocumentCreator() {
  const { i18n } = useTranslation();
  const safeFilePreview = useRecoilValue(store.safeFilePreview);
  const setSafeFilePreview = useSetRecoilState(store.safeFilePreview);
  const uiLocale = i18n.language || 'en';
  const lang = uiLocale.startsWith('de') ? 'de' : 'en';
  const t = useCallback((key: string) => TEXT[lang]?.[key] ?? TEXT.en[key] ?? key, [lang]);

  const [department, setDepartment] = useState<Department>('leistung');
  const [docTypeKey, setDocTypeKey] = useState<string>(DOCUMENT_TYPES.leistung[0].key);
  const [caseFiles, setCaseFiles] = useState<DocumentFile[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<DocumentFile[]>([]);
  const [taskDescription, setTaskDescription] = useState('');
  const [plainLanguage, setPlainLanguage] = useState(false);
  const [outputLanguage, setOutputLanguage] = useState<DocumentOutputLanguage>('de');
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>(MAYA_DEFAULT_ENDPOINT);
  const [selectedModel, setSelectedModel] = useState(MAYA_DEFAULT_MODEL);
  const [activeModelEndpoint, setActiveModelEndpoint] = useState<string>(MAYA_DEFAULT_ENDPOINT);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [endpointSearch, setEndpointSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [documentTemplates, setDocumentTemplates] = useState<DocumentTemplate[]>([]);
  const [documentSessionId, setDocumentSessionId] = useState<string | undefined>();
  const [generatedContent, setGeneratedContent] = useState('');
  const [artifacts, setArtifacts] = useState<MDPArtifact[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [draggingRole, setDraggingRole] = useState<FileRole | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const modelPickerRef = useRef<HTMLDivElement | null>(null);

  const documentTypes = DOCUMENT_TYPES[department];
  const selectedDocType = useMemo(
    () => documentTypes.find((type) => type.key === docTypeKey) ?? documentTypes[0],
    [docTypeKey, documentTypes],
  );
  const departmentLabel = t(`dept_${department}`);
  const documentTypeLabel = lang === 'de' ? selectedDocType.de : selectedDocType.en;
  const promptDepartmentLabel =
    outputLanguage === 'de'
      ? (TEXT.de[`dept_${department}`] ?? departmentLabel)
      : (TEXT.en[`dept_${department}`] ?? departmentLabel);
  const promptDocumentTypeLabel = outputLanguage === 'de' ? selectedDocType.de : selectedDocType.en;
  const endpointOptions = useMemo(() => {
    const query = endpointSearch.trim().toLowerCase();
    return DOCUMENT_ENDPOINT_OPTIONS.filter((endpoint) => {
      if (!query) {
        return true;
      }
      const label = getDocumentEndpointLabel(endpoint).toLowerCase();
      return label.includes(query) || endpoint.toLowerCase().includes(query);
    });
  }, [endpointSearch]);
  const activeModelOptions = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    return getDocumentEndpointModels(activeModelEndpoint).filter((model) =>
      query ? model.toLowerCase().includes(query) : true,
    );
  }, [activeModelEndpoint, modelSearch]);
  const selectedEndpointLabel = getDocumentEndpointLabel(selectedEndpoint);
  const activeEndpointLabel = getDocumentEndpointLabel(activeModelEndpoint);

  const readyCaseFiles = useMemo(
    () => caseFiles.filter((file) => file.status === 'ready' && file.safeFile?.safeDocId),
    [caseFiles],
  );
  const readyReferenceFiles = useMemo(
    () => referenceFiles.filter((file) => file.status === 'ready' && file.safeFile?.safeDocId),
    [referenceFiles],
  );
  const hasProcessingFiles = useMemo(
    () => [...caseFiles, ...referenceFiles].some((file) => isProcessingStatus(file.status)),
    [caseFiles, referenceFiles],
  );
  const docxArtifact = useMemo(() => getDocxArtifact(artifacts), [artifacts]);
  const markdownArtifact = useMemo(() => getMarkdownArtifact(artifacts), [artifacts]);

  const selectedDocumentTemplate = useMemo(() => {
    const exact = documentTemplates.find((template) => {
      const documentTypes = Array.isArray(template.document_types) ? template.document_types : [];
      return template.document_type === docTypeKey || documentTypes.includes(docTypeKey);
    });
    return exact ?? documentTemplates.find((template) => template.department === department);
  }, [department, docTypeKey, documentTemplates]);

  const compactLayout = Boolean(safeFilePreview);

  useEffect(() => {
    const models = getDocumentEndpointModels(selectedEndpoint);
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

  useEffect(() => {
    let cancelled = false;
    listDocumentTemplates({ department, documentType: docTypeKey })
      .then((templates) => {
        if (!cancelled) {
          setDocumentTemplates(templates);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDocumentTemplates([]);
        }
      })
      .finally(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [department, docTypeKey]);

  useEffect(() => {
    const nextType = DOCUMENT_TYPES[department][0];
    setDocTypeKey(nextType.key);
  }, [department]);

  const setFilesForRole = useCallback(
    (role: FileRole, updater: (files: DocumentFile[]) => DocumentFile[]) => {
      if (role === 'case_file') {
        setCaseFiles(updater);
        return;
      }
      setReferenceFiles(updater);
    },
    [],
  );

  const handleFileUpload = useCallback(
    async (files: FileList | null, role: FileRole) => {
      if (!files?.length) {
        return;
      }

      for (const file of Array.from(files)) {
        const rawFileId = crypto.randomUUID();
        const item: DocumentFile = {
          id: rawFileId,
          name: file.name,
          size: file.size,
          status: 'uploading',
          role,
          file,
        };

        setFilesForRole(role, (current) => [...current, item]);

        try {
          const safeFile = await createSafeFile({
            file,
            rawFileId,
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            llmType: 'openai',
            lang: outputLanguage,
            role,
          });

          setFilesForRole(role, (current) =>
            current.map((candidate) =>
              candidate.id === rawFileId
                ? {
                    ...candidate,
                    status: safeFile.status,
                    safeFile: { ...safeFile, role },
                    error: safeFile.error,
                  }
                : candidate,
            ),
          );
        } catch (err) {
          setFilesForRole(role, (current) =>
            current.map((candidate) =>
              candidate.id === rawFileId
                ? {
                    ...candidate,
                    status: 'failed',
                    error: err instanceof Error ? err.message : 'Upload failed',
                  }
                : candidate,
            ),
          );
        }
      }
    },
    [outputLanguage, setFilesForRole],
  );

  const handleRemoveFile = useCallback(
    (id: string, role: FileRole) => {
      setFilesForRole(role, (current) => current.filter((file) => file.id !== id));
    },
    [setFilesForRole],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLElement>, role: FileRole) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setDraggingRole(role);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLElement>, role: FileRole) => {
    event.preventDefault();
    event.stopPropagation();
    const nextTarget = event.relatedTarget as Node | null;
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setDraggingRole((current) => (current === role ? null : current));
    }
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>, role: FileRole) => {
      event.preventDefault();
      event.stopPropagation();
      setDraggingRole(null);
      void handleFileUpload(event.dataTransfer.files, role);
    },
    [handleFileUpload],
  );

  const handlePreviewFile = useCallback(
    (file: DocumentFile) => {
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
    (content: string, nextArtifacts: MDPArtifact[], sessionId?: string) => {
      if (!content.trim()) {
        return;
      }

      const nextDocxArtifact = getDocxArtifact(nextArtifacts);
      const nextPdfArtifact = getPdfArtifact(nextArtifacts);
      const fallbackFilename = `${safeFilename(documentTypeLabel)}.docx`;
      const previewFilename =
        nextDocxArtifact?.filename ?? nextPdfArtifact?.filename ?? fallbackFilename;
      const previewId =
        nextPdfArtifact?.artifact_id ??
        nextDocxArtifact?.artifact_id ??
        sessionId ??
        documentSessionId ??
        fallbackFilename;
      let statusLabel = t('ready');
      if (nextPdfArtifact?.download_url) {
        statusLabel = t('pdfPreviewReady');
      } else if (nextDocxArtifact?.download_url) {
        statusLabel = t('docxReady');
      }
      setSafeFilePreview({
        fileId: `generated-document-${previewId}`,
        filename: previewFilename,
        safeFilename: previewFilename,
        status: 'ready',
        statusLabel,
        mimeType: nextPdfArtifact?.download_url ? 'application/pdf' : 'text/markdown',
        previewAnonymizedUrl: nextPdfArtifact?.download_url,
        previewText: nextPdfArtifact?.download_url ? undefined : content,
        downloadUrl: nextDocxArtifact?.download_url ?? nextPdfArtifact?.download_url,
        previewOnly: true,
      });
    },
    [documentSessionId, documentTypeLabel, setSafeFilePreview, t],
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
        setTranscribing(true);
        try {
          const blob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          });
          const transcript = (await transcribeAudio(blob, outputLanguage)).trim();
          if (transcript) {
            setTaskDescription((current) => (current ? `${current}\n${transcript}` : transcript));
          }
        } finally {
          setTranscribing(false);
        }
      });

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone unavailable');
    }
  }, [outputLanguage]);

  const handleGenerateDocument = useCallback(async () => {
    const hasPromptInput = taskDescription.trim() || selectedDocumentTemplate;
    if (!department || !selectedDocType || !hasPromptInput) {
      setError(t('errorRequired'));
      return;
    }
    if (hasProcessingFiles) {
      setError(t('errorFiles'));
      return;
    }
    if (readyCaseFiles.length === 0) {
      setError(t('errorCaseFiles'));
      return;
    }

    setError(null);
    setIsGenerating(true);

    const allReadyFiles = [...readyCaseFiles, ...readyReferenceFiles];
    const docIds = allReadyFiles
      .map((file) => file.safeFile?.safeDocId)
      .filter((safeDocId): safeDocId is string => Boolean(safeDocId));
    const fileRoles = allReadyFiles.reduce<Record<string, FileRole>>((roles, file) => {
      const safeDocId = file.safeFile?.safeDocId;
      if (safeDocId) {
        roles[safeDocId] = file.role;
      }
      return roles;
    }, {});

    const prompt = buildDocumentPrompt({
      departmentLabel: promptDepartmentLabel,
      documentTypeLabel: promptDocumentTypeLabel,
      taskDescription,
      plainLanguage,
      caseFileCount: readyCaseFiles.length,
      referenceFileCount: readyReferenceFiles.length,
      outputLanguage,
    });

    try {
      const systemTemplateInstruction = documentTemplateInstruction(selectedDocumentTemplate);
      const skillInstructions = systemTemplateInstruction
        ? [DOCUMENT_SKILL_INSTRUCTION, systemTemplateInstruction]
        : [DOCUMENT_SKILL_INSTRUCTION];
      const manualSkills = systemTemplateInstruction
        ? [DOCUMENT_SKILL_INSTRUCTION.name, systemTemplateInstruction.name]
        : [DOCUMENT_SKILL_INSTRUCTION.name];

      const anonymized = await anonymizeText(prompt, DEFAULT_PII_CHOICES, outputLanguage);
      const result = await sendChat({
        text: prompt,
        sessionId: documentSessionId,
        lang: outputLanguage,
        anonymizedPrompt: anonymized.anonymized_prompt,
        anonymizedValues: anonymized.anonymized_values,
        detectedValues: anonymized.detected_values,
        choices: DEFAULT_PII_CHOICES,
        docId: docIds[0],
        docIds: docIds.length > 0 ? docIds : undefined,
        fileRoles,
        manualSkills,
        skillInstructions,
        endpoint: selectedEndpoint,
        model: selectedModel,
      });

      const assistantText =
        result.rawResponse.replaced_response || result.assistantMessage.text || '';
      const renderedContent = renderDocumentJsonAsMarkdown(assistantText) ?? assistantText;
      const nextArtifacts = result.rawResponse.artifacts ?? [];
      setDocumentSessionId(result.sessionId);
      setGeneratedContent(renderedContent);
      setArtifacts(nextArtifacts);
      openGeneratedPreview(renderedContent, nextArtifacts, result.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGenerate'));
    } finally {
      setIsGenerating(false);
    }
  }, [
    department,
    selectedDocType,
    taskDescription,
    hasProcessingFiles,
    t,
    readyCaseFiles,
    readyReferenceFiles,
    promptDepartmentLabel,
    promptDocumentTypeLabel,
    plainLanguage,
    outputLanguage,
    selectedEndpoint,
    selectedModel,
    documentSessionId,
    selectedDocumentTemplate,
    openGeneratedPreview,
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

  const handlePreviewGeneratedDocument = useCallback(() => {
    openGeneratedPreview(generatedContent, artifacts, documentSessionId);
  }, [artifacts, documentSessionId, generatedContent, openGeneratedPreview]);

  const handleDownloadMarkdown = useCallback(async () => {
    const filename = `${safeFilename(documentTypeLabel)}.md`;
    if (markdownArtifact?.download_url) {
      const blob = await fetchArtifactBlob(markdownArtifact.download_url);
      triggerDownload(URL.createObjectURL(blob), markdownArtifact.filename ?? filename);
      return;
    }
    const blob = new Blob([generatedContent], { type: 'text/markdown;charset=utf-8' });
    triggerDownload(URL.createObjectURL(blob), filename);
  }, [documentTypeLabel, generatedContent, markdownArtifact]);

  const handleDownloadDocx = useCallback(async () => {
    if (!generatedContent) {
      return;
    }
    setIsDownloadingDocx(true);
    const filename = `${safeFilename(documentTypeLabel)}.docx`;
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
  }, [docxArtifact, documentTypeLabel, generatedContent]);

  const handleReset = useCallback(() => {
    setGeneratedContent('');
    setArtifacts([]);
    setError(null);
  }, []);

  const renderFileStatusIcon = (file: DocumentFile) => {
    if (file.status === 'ready') {
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    }
    if (file.status === 'failed') {
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
    return <Spinner size={14} />;
  };

  const renderStatusPill = (file: DocumentFile) => {
    if (file.status === 'ready') {
      return <span className="text-emerald-600">{t('ready')}</span>;
    }
    if (file.status === 'failed') {
      return <span className="text-red-600">{t('failed')}</span>;
    }
    return <span className="text-sky-600">{t('processing')}</span>;
  };

  const renderFileList = (files: DocumentFile[], role: FileRole) => (
    <div className="mt-3 space-y-2">
      {files.map((file) => {
        const ready = file.status === 'ready';
        return (
          <div
            key={file.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border-light bg-surface-primary px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-hover">
                {renderFileStatusIcon(file)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-text-primary" title={file.name}>
                  {file.name}
                </div>
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <span>{formatBytes(file.size)}</span>
                  <span>{renderStatusPill(file)}</span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {ready && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  aria-label={t('preview')}
                  title={t('preview')}
                  onClick={() => handlePreviewFile(file)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-text-secondary hover:text-red-600"
                aria-label={t('remove')}
                title={t('remove')}
                onClick={() => handleRemoveFile(file.id, role)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderUploadLane = ({
    role,
    title,
    subtitle,
    files,
  }: {
    role: FileRole;
    title: string;
    subtitle: string;
    files: DocumentFile[];
  }) => (
    <section
      onDragEnter={(event) => handleDragOver(event, role)}
      onDragOver={(event) => handleDragOver(event, role)}
      onDragLeave={(event) => handleDragLeave(event, role)}
      onDrop={(event) => handleDrop(event, role)}
      className={cn(
        'rounded-lg border border-border-light bg-surface-primary p-4 transition-colors',
        draggingRole === role && 'border-brand bg-brand/5',
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            {role === 'case_file' ? (
              <BriefcaseBusiness className="h-4 w-4 text-emerald-600" />
            ) : (
              <BookOpen className="h-4 w-4 text-sky-600" />
            )}
            {title}
          </div>
          <div className="mt-1 text-xs text-text-secondary">{subtitle}</div>
        </div>
        <span className="rounded-md border border-border-light px-2 py-1 text-xs text-text-secondary">
          {files.length}
        </span>
      </div>
      <button
        type="button"
        onClick={() => document.getElementById(fileInputId(role))?.click()}
        className={cn(
          'hover:border-brand flex min-h-[104px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-border-heavy bg-surface-primary-alt px-4 py-5 text-center transition-colors hover:bg-surface-hover',
          draggingRole === role && 'border-brand bg-brand/10',
        )}
      >
        <FolderUp className="mb-2 h-6 w-6 text-text-secondary" />
        <span className="text-sm font-medium text-text-primary">
          {role === 'case_file' ? t('dropCase') : t('dropRef')}
        </span>
        <span className="mt-1 text-xs text-text-secondary">{t('uploadNote')}</span>
      </button>
      <input
        id={fileInputId(role)}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          void handleFileUpload(event.target.files, role);
          event.target.value = '';
        }}
      />
      {renderFileList(files, role)}
    </section>
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface-primary-alt text-text-primary">
      <header className="flex shrink-0 items-center justify-between border-b border-border-light bg-surface-primary px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="text-brand h-5 w-5" />
            <h1 className="truncate text-lg font-semibold">{t('title')}</h1>
          </div>
          <p className="mt-1 text-sm text-text-secondary">{t('subtitle')}</p>
        </div>
      </header>

      <div
        className={cn(
          'grid min-h-0 w-full flex-1 grid-cols-1 gap-4 p-4',
          compactLayout
            ? 'overflow-y-auto md:grid-cols-[280px_minmax(0,1fr)]'
            : 'overflow-hidden xl:grid-cols-[360px_minmax(0,1fr)_320px]',
        )}
      >
        <aside className="min-h-0 space-y-4 pr-1">
          <section className="rounded-lg border border-border-light bg-surface-primary p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Building2 className="text-brand h-4 w-4" />
              {t('setup')}
            </div>
            <label className="mb-2 block text-xs font-semibold uppercase text-text-secondary">
              {t('department')}
            </label>
            <div className="grid grid-cols-1 gap-2">
              {DEPARTMENTS.map((dept) => (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setDepartment(dept)}
                  className={cn(
                    'flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors',
                    department === dept
                      ? 'border-brand bg-brand/10 text-text-primary'
                      : 'border-border-light bg-surface-primary-alt text-text-secondary hover:bg-surface-hover',
                  )}
                >
                  <span>{t(`dept_${dept}`)}</span>
                  {department === dept && <CheckCircle2 className="text-brand h-4 w-4" />}
                </button>
              ))}
            </div>

            <label className="mb-2 mt-5 block text-xs font-semibold uppercase text-text-secondary">
              {t('documentType')}
            </label>
            <div className="grid grid-cols-1 gap-2">
              {documentTypes.map((type) => (
                <button
                  key={type.key}
                  type="button"
                  onClick={() => setDocTypeKey(type.key)}
                  className={cn(
                    'rounded-md border px-3 py-2 text-left text-sm transition-colors',
                    docTypeKey === type.key
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
            <div ref={modelPickerRef} className="relative mb-4">
              <button
                type="button"
                onClick={() => {
                  setActiveModelEndpoint(selectedEndpoint);
                  setEndpointSearch('');
                  setModelSearch('');
                  setModelPickerOpen((value) => !value);
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
                <div className="absolute left-0 top-12 z-50 flex gap-2">
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
                                {getDocumentEndpointIconText(endpoint)}
                              </span>
                              <span className="truncate">{getDocumentEndpointLabel(endpoint)}</span>
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
                        placeholder={t('searchEndpointModels').replace(
                          '{{endpoint}}',
                          activeEndpointLabel,
                        )}
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
                            }}
                            className={cn(
                              'flex h-10 w-full items-center justify-between rounded-md px-3 text-left text-sm transition-colors hover:bg-surface-hover',
                              selected ? 'bg-surface-hover text-text-primary' : 'text-text-primary',
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="flex h-5 min-w-5 items-center justify-center text-sm font-semibold">
                                {getDocumentEndpointIconText(activeModelEndpoint)}
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

            <label className="mb-2 block text-xs font-semibold uppercase text-text-secondary">
              {t('documentLanguage')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['de', 'en'] as DocumentOutputLanguage[]).map((language) => (
                <button
                  key={language}
                  type="button"
                  onClick={() => setOutputLanguage(language)}
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

        <main className={cn('flex min-h-0 flex-col gap-4', !compactLayout && 'overflow-hidden')}>
          <div
            className={cn(
              'grid shrink-0 grid-cols-1 gap-4',
              compactLayout ? '2xl:grid-cols-2' : 'lg:grid-cols-2',
            )}
          >
            {renderUploadLane({
              role: 'case_file',
              title: t('caseFiles'),
              subtitle: t('caseHint'),
              files: caseFiles,
            })}
            {renderUploadLane({
              role: 'reference_file',
              title: t('referenceFiles'),
              subtitle: t('refHint'),
              files: referenceFiles,
            })}
          </div>

          <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-border-light bg-surface-primary p-4">
            <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="text-brand h-4 w-4" />
                {t('task')}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPlainLanguage((value) => !value)}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors',
                    plainLanguage
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700'
                      : 'border-border-light bg-surface-primary-alt text-text-secondary',
                  )}
                >
                  {t('plain')}
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant={isRecording ? 'destructive' : 'outline'}
                  className="h-8 gap-1.5"
                  disabled={transcribing}
                  onClick={isRecording ? stopRecording : startRecording}
                >
                  {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  {isRecording ? t('stop') : t('record')}
                </Button>
              </div>
            </div>
            <textarea
              value={taskDescription}
              onChange={(event) => setTaskDescription(event.target.value)}
              placeholder={t('taskPlaceholder')}
              rows={8}
              className="focus:border-brand min-h-[220px] flex-1 resize-none rounded-lg border border-border-light bg-surface-primary-alt px-3 py-3 text-sm leading-6 outline-none transition-colors placeholder:text-text-secondary"
            />
            {transcribing && (
              <div className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
                <Spinner size={12} />
                {t('transcribing')}
              </div>
            )}
          </section>
        </main>

        <aside className={cn('min-h-0 space-y-4 pl-1', compactLayout && 'md:col-start-2 md:pl-0')}>
          <section className="rounded-lg border border-border-light bg-surface-primary p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                {t('session')}
              </div>
              <span className="truncate rounded-md bg-surface-hover px-2 py-1 text-xs text-text-secondary">
                {documentSessionId ? documentSessionId.slice(0, 8) : 'new'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs text-text-secondary">
              <div className="rounded-md bg-surface-primary-alt p-2">
                <div className="text-sm font-semibold text-text-primary">
                  {readyCaseFiles.length}
                </div>
                {t('caseFiles')}
              </div>
              <div className="rounded-md bg-surface-primary-alt p-2">
                <div className="text-sm font-semibold text-text-primary">
                  {readyReferenceFiles.length}
                </div>
                {t('referenceFiles')}
              </div>
              <div className="rounded-md bg-surface-primary-alt p-2">
                <div className="text-sm font-semibold text-text-primary">{artifacts.length}</div>
                {t('artifacts')}
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
                  onClick={handleReset}
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
              disabled={isGenerating || hasProcessingFiles}
              onClick={handleGenerateDocument}
            >
              {isGenerating ? <Spinner size={16} /> : <FileText className="h-4 w-4" />}
              {isGenerating ? t('creating') : t('create')}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mb-2 h-9 w-full gap-1.5"
              disabled={!generatedContent}
              onClick={handlePreviewGeneratedDocument}
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
