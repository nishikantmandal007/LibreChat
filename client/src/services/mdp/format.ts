function normalizeAssistantText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatMayaAssistantText({
  responseText,
  citations = '',
}: {
  originalPrompt?: string;
  responseText?: string;
  modelLabel?: string;
  citations?: string;
}): string {
  const safeResponse = normalizeAssistantText(responseText || 'No response content was returned.');
  const parts: string[] = [safeResponse];

  if (citations) {
    parts.push(normalizeAssistantText(citations));
  }

  return parts.filter(Boolean).join('\n\n');
}
