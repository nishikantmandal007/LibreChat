export const MDP_SUPPORTED_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
] as const;

export type MdpLanguage = (typeof MDP_SUPPORTED_LANGUAGES)[number]['value'];

const SUPPORTED_LANGUAGE_VALUES = new Set<string>(
  MDP_SUPPORTED_LANGUAGES.map((language) => language.value),
);

export function normalizeMdpLanguage(language?: string | null): MdpLanguage {
  return language && SUPPORTED_LANGUAGE_VALUES.has(language) ? (language as MdpLanguage) : 'de';
}
