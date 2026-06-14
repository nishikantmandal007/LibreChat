function normalizeAssistantText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatMayaAssistantText({
  responseText,
}: {
  originalPrompt?: string;
  responseText?: string;
  modelLabel?: string;
}): string {
  return normalizeAssistantText(responseText || 'No response content was returned.');
}
