import { mdpClient } from './client';
import { MDP_ENDPOINTS } from './endpoints';

export type PremadePromptDisplayField = 'name' | 'description' | 'category' | 'output_format';

export interface PremadePrompt {
  id: string;
  name: string;
  description?: string;
  body?: string;
  category?: string;
  output_format?: string;
  constraints?: string[];
  is_builtin?: boolean;
  name_en?: string;
  name_de?: string;
  description_en?: string;
  description_de?: string;
  category_en?: string;
  category_de?: string;
  output_format_en?: string;
  output_format_de?: string;
  [key: string]: unknown;
}

function baseLocale(locale?: string | null): string {
  return (locale || 'en').split('-')[0]?.toLowerCase() || 'en';
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function cookieLanguage(): string | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const match = document.cookie.match(/(?:^|; )lang=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function getCurrentPremadePromptLocale(): string {
  if (typeof window === 'undefined') {
    return 'en';
  }
  return localStorage.getItem('lang') || cookieLanguage() || navigator.language || 'en';
}

export function getLocalizedPremadePromptField(
  prompt: PremadePrompt,
  field: PremadePromptDisplayField,
  locale?: string | null,
): string {
  const lang = baseLocale(locale);
  const candidates = [`${field}_${lang}`, `${field}_en`, field, `${field}_de`];

  for (const key of candidates) {
    const value = readString(prompt[key]);
    if (value) {
      return value;
    }
  }
  return '';
}

export function getPremadePromptDisplay(prompt: PremadePrompt, locale?: string | null) {
  return {
    name: getLocalizedPremadePromptField(prompt, 'name', locale) || prompt.id,
    description: getLocalizedPremadePromptField(prompt, 'description', locale),
    category: getLocalizedPremadePromptField(prompt, 'category', locale),
    outputFormat: getLocalizedPremadePromptField(prompt, 'output_format', locale),
  };
}

export async function listPremadePrompts(category?: string): Promise<PremadePrompt[]> {
  const params = category ? { category } : undefined;
  const response = await mdpClient.get<unknown>(MDP_ENDPOINTS.premadePrompts, { params });
  const data = response.data;
  return Array.isArray(data) ? (data as PremadePrompt[]) : [];
}

export async function getPremadePrompt(id: string): Promise<PremadePrompt | null> {
  try {
    const response = await mdpClient.get<unknown>(
      `${MDP_ENDPOINTS.premadePrompts}/${encodeURIComponent(id)}`,
    );
    return (response.data as PremadePrompt) ?? null;
  } catch {
    return null;
  }
}

export async function createPremadePrompt(data: Partial<PremadePrompt>): Promise<PremadePrompt> {
  const response = await mdpClient.post<unknown>(MDP_ENDPOINTS.premadePrompts, data);
  return response.data as PremadePrompt;
}

export async function updatePremadePrompt(
  id: string,
  data: Partial<PremadePrompt>,
): Promise<PremadePrompt> {
  const response = await mdpClient.put<unknown>(
    `${MDP_ENDPOINTS.premadePrompts}/${encodeURIComponent(id)}`,
    data,
  );
  return response.data as PremadePrompt;
}

export async function deletePremadePrompt(id: string): Promise<boolean> {
  try {
    await mdpClient.delete(`${MDP_ENDPOINTS.premadePrompts}/${encodeURIComponent(id)}`);
    return true;
  } catch {
    return false;
  }
}
