import { mdpClient } from './client';
import { MDP_ENDPOINTS } from './endpoints';
import { normalizeMdpLanguage } from './language';

import type {
  MDPDetectRequest,
  MDPDetectResponse,
  MDPAnonymizeRequest,
  MDPAnonymizeResponse,
} from './types';

export async function detectEntities(
  prompt: string,
  choices: string[],
  lang = 'en',
): Promise<MDPDetectResponse> {
  const request: MDPDetectRequest = { prompt, choices, lang: normalizeMdpLanguage(lang) };
  const response = await mdpClient.post<MDPDetectResponse>(MDP_ENDPOINTS.detect, request);
  return response.data;
}

export async function anonymizeText(
  prompt: string,
  choices: string[],
  lang = 'en',
): Promise<MDPAnonymizeResponse> {
  const request: MDPAnonymizeRequest = {
    prompt,
    choices,
    lang: normalizeMdpLanguage(lang),
    model: 'Gliner',
    requires_anonymization: true,
    case_correction: true,
  };
  const response = await mdpClient.post<MDPAnonymizeResponse>(MDP_ENDPOINTS.anonymize, request);
  return response.data;
}

export const DEFAULT_PII_CHOICES = [
  'Names',
  'Emails',
  'Phone',
  'DOB',
  'Organization',
  'Street',
  'City',
  'Zip Code',
  'Dates',
  'IBAN',
  'Insurance Number',
  'Secret_Keys',
];
