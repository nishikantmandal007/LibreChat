export function formatMayaAssistantText({
  responseText,
  citations = '',
}: {
  originalPrompt?: string;
  responseText?: string;
  modelLabel?: string;
  citations?: string;
}): string {
  const safeResponse = responseText || 'No response content was returned.';
  const parts: string[] = [safeResponse];

  if (citations) {
    parts.push(citations);
  }

  return parts.join('\n');
}
