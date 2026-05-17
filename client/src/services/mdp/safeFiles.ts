import { mdpClient } from './client';
import { MDP_ENDPOINTS } from './endpoints';

import type { MayaSafeFilePiiSummary, MayaSafeFileState, MayaSafeFileStatus } from '~/common';

function buildFileUrl(base: string, fileId: string | undefined): string | undefined {
  if (!fileId) {
    return undefined;
  }
  return `${base}/${encodeURIComponent(fileId)}`;
}

function buildDownloadUrl(safeFileId: string | undefined): string | undefined {
  return buildFileUrl(`${MDP_ENDPOINTS.anonymizeFile}/download`, safeFileId);
}

const POLL_INTERVAL_MS = 1200;
const MAX_POLLS = 80;

type UnknownRecord = Record<string, unknown>;

const PROCESSING_STATUSES = new Set<MayaSafeFileStatus>([
  'uploading',
  'scanning',
  'anonymizing',
  'indexing',
]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unwrapData(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }
  if ('data' in value && isRecord(value.data)) {
    return value.data;
  }
  return value;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }
  return undefined;
}

function firstRecord(...values: unknown[]): UnknownRecord | undefined {
  for (const value of values) {
    if (isRecord(value)) {
      return value;
    }
  }
  return undefined;
}

function normalizeDetectedValues(value: unknown): Record<string, string[]> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const detectedValues: Record<string, string[]> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (Array.isArray(raw)) {
      detectedValues[key] = raw.map(String);
    } else if (typeof raw === 'string' && raw.trim() !== '') {
      detectedValues[key] = [raw];
    } else if (typeof raw === 'number') {
      detectedValues[key] = [String(raw)];
    }
  }

  return Object.keys(detectedValues).length > 0 ? detectedValues : undefined;
}

function normalizeCounts(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const counts: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'number') {
      counts[key] = raw;
    } else if (Array.isArray(raw)) {
      counts[key] = raw.length;
    } else if (typeof raw === 'string' && raw.trim() !== '') {
      const parsed = Number(raw);
      counts[key] = Number.isFinite(parsed) ? parsed : 1;
    }
  }

  return Object.keys(counts).length > 0 ? counts : undefined;
}

function normalizePiiSummary(record: UnknownRecord): MayaSafeFilePiiSummary | undefined {
  const summary = firstRecord(
    record.pii_summary,
    record.piiSummary,
    record.summary,
    record.anonymization_summary,
  );
  const detectedValues = normalizeDetectedValues(
    summary?.detected_values ?? summary?.detectedValues ?? record.detected_values ?? record.detectedValues,
  );
  const anonymizedValues = normalizeDetectedValues(
    summary?.anonymized_values ?? summary?.anonymizedValues ?? record.anonymized_values ?? record.anonymizedValues,
  );
  const counts =
    normalizeCounts(summary?.counts ?? summary?.entities ?? summary?.detected_values ?? record.entity_counts) ??
    (detectedValues
      ? Object.fromEntries(Object.entries(detectedValues).map(([key, values]) => [key, values.length]))
      : undefined);

  const total =
    typeof summary?.total === 'number'
      ? summary.total
      : typeof summary?.total_count === 'number'
        ? summary.total_count
        : typeof record.total_pii === 'number'
          ? (record.total_pii as number)
          : counts
            ? Object.values(counts).reduce((sum, count) => sum + count, 0)
            : undefined;

  const changedCount =
    typeof summary?.changed_count === 'number'
      ? summary.changed_count
      : typeof summary?.changedCount === 'number'
        ? (summary.changedCount as number)
        : total;

  if (!counts && !detectedValues && total == null && changedCount == null) {
    return undefined;
  }

  return {
    total,
    changedCount,
    counts,
    detectedValues,
    anonymizedValues,
  };
}

function normalizeStatus(record: UnknownRecord, fallback?: MayaSafeFileState): MayaSafeFileStatus {
  const rawStatus = firstString(
    record.status,
    record.state,
    record.job_status,
    record.rag_index_status,
  )?.toLowerCase();

  if (rawStatus?.includes('fail') || rawStatus?.includes('error')) {
    return 'failed';
  }
  if (rawStatus?.includes('index')) {
    if (rawStatus.includes('ready') || rawStatus.includes('complete')) {
      return 'ready';
    }
    return 'indexing';
  }
  if (rawStatus === 'ready' || rawStatus === 'indexed') {
    return 'ready';
  }
  if (
    rawStatus === 'anonymized' ||
    rawStatus === 'completed' ||
    rawStatus === 'complete' ||
    rawStatus === 'success'
  ) {
    return 'ready';
  }
  if (rawStatus === 'queued' || rawStatus === 'pending' || rawStatus === 'processing') {
    return 'scanning';
  }
  if (rawStatus === 'anonymizing' || rawStatus === 'redacting' || rawStatus === 'deidentifying') {
    return 'anonymizing';
  }

  if (
    fallback?.status === 'ready'
  ) {
    return 'ready';
  }

  if (firstString(record.safe_doc_id, record.safeDocId, record.doc_id, record.docId)) {
    return 'ready';
  }

  return fallback?.status ?? 'scanning';
}

export function normalizeSafeFileResponse(
  value: unknown,
  fallback?: MayaSafeFileState,
): MayaSafeFileState {
  const data = unwrapData(value);
  const record = isRecord(data) ? data : {};
  const preview = firstRecord(record.preview, record.previews);
  const anonymized = firstRecord(record.anonymized, record.safe_file, record.safeFile);
  const raw = firstRecord(record.raw, record.original, record.source_file, record.sourceFile);
  const safeDocId = firstString(
    record.safe_doc_id,
    record.safeDocId,
    record.doc_id,
    record.docId,
    anonymized?.safe_doc_id,
    anonymized?.doc_id,
    fallback?.safeDocId,
  );

  const rawFileId = firstString(
    record.raw_file_id,
    record.rawFileId,
    record.original_file_id,
    raw?.file_id,
    safeDocId ? record.file_id : undefined,
    fallback?.rawFileId,
  );

  const safeFileId = safeDocId || firstString(
    record.safe_file_id,
    record.safeFileId,
    record.file_id,
    anonymized?.file_id,
    fallback?.safeFileId,
  );
  const safeFilename = firstString(
    record.safe_filename,
    record.safeFilename,
    record.anonymized_filename,
    record.anonymizedFilename,
    anonymized?.filename,
    anonymized?.file_name,
    fallback?.safeFilename,
  );
  const mimeType = firstString(
    record.mime_type,
    record.mimeType,
    record.safe_mime_type,
    record.safeMimeType,
    anonymized?.mime_type,
    anonymized?.mimeType,
    fallback?.mimeType,
  );
  const downloadFileId = safeDocId || safeFileId;

  const downloadUrl = firstString(
    record.download_url,
    record.downloadUrl,
    record.safe_download_url,
    anonymized?.download_url,
    fallback?.downloadUrl,
  ) || buildDownloadUrl(downloadFileId);

  const previewOriginalUrl = firstString(
    record.preview_original_url,
    record.original_preview_url,
    preview?.original,
    preview?.raw,
    raw?.preview_url,
    fallback?.previewOriginalUrl,
  );

  const previewAnonymizedUrl = firstString(
    record.preview_anonymized_url,
    record.anonymized_preview_url,
    record.safe_preview_url,
    preview?.anonymized,
    preview?.safe,
    anonymized?.preview_url,
    fallback?.previewAnonymizedUrl,
  ) || buildDownloadUrl(downloadFileId);

  return {
    status: normalizeStatus(record, fallback),
    rawFileId,
    safeFileId,
    safeDocId,
    jobId: firstString(record.job_id, record.jobId, record.id, fallback?.jobId),
    piiSummary: normalizePiiSummary(record) ?? fallback?.piiSummary,
    previewOriginalUrl,
    previewAnonymizedUrl,
    originalText: firstString(record.original_text, raw?.text, preview?.original_text, fallback?.originalText),
    anonymizedText: firstString(
      record.anonymized_text,
      record.safe_text,
      anonymized?.text,
      preview?.anonymized_text,
      fallback?.anonymizedText,
    ),
    downloadUrl,
    safeFilename,
    mimeType,
    ragIndexStatus: firstString(
      record.rag_index_status,
      record.index_status,
      record.indexStatus,
      fallback?.ragIndexStatus,
    ),
    error: firstString(record.error, record.message, fallback?.error),
  };
}

function isProcessing(status: MayaSafeFileStatus): boolean {
  return PROCESSING_STATUSES.has(status);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollSafeFile(jobId: string, fallback: MayaSafeFileState): Promise<MayaSafeFileState> {
  let latest = fallback;

  for (let i = 0; i < MAX_POLLS; i += 1) {
    await delay(POLL_INTERVAL_MS);
    const response = await mdpClient.get<unknown>(
      `${MDP_ENDPOINTS.anonymizeFile}/${encodeURIComponent(jobId)}`,
    );
    latest = normalizeSafeFileResponse(response.data, latest);

    if (!isProcessing(latest.status)) {
      return latest;
    }
  }

  return {
    ...latest,
    status: 'failed',
    error: 'Timed out waiting for the safe copy to finish.',
  };
}

export async function createSafeFile({
  file,
  rawFileId,
  rawFilepath,
  filename,
  mimeType,
  llmType,
  localPreviewUrl,
}: {
  file: File;
  rawFileId: string;
  rawFilepath?: string;
  filename: string;
  mimeType?: string;
  llmType: string;
  localPreviewUrl?: string;
}): Promise<MayaSafeFileState> {
  const form = new FormData();
  form.append('file', file, filename);
  form.append('safe_chat', 'true');
  form.append('requestId', crypto.randomUUID());
  form.append('raw_file_id', rawFileId);
  form.append('file_id', rawFileId);
  form.append('file_name', filename);
  form.append('file_type', mimeType ?? file.type);
  form.append('llm_type', llmType);
  if (rawFilepath) {
    form.append('raw_file_path', rawFilepath);
  }

  const response = await mdpClient.post<unknown>(MDP_ENDPOINTS.anonymizeFile, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const fallback: MayaSafeFileState = {
    status: 'scanning',
    rawFileId,
    previewOriginalUrl: localPreviewUrl,
  };
  const initial = normalizeSafeFileResponse(response.data, fallback);

  if (initial.jobId && isProcessing(initial.status)) {
    return pollSafeFile(initial.jobId, initial);
  }

  return initial;
}
