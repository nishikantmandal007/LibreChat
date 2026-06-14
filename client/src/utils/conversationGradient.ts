const PALETTE = [
  { h: 35, s: 100, l: 65 },  // amber
  { h: 350, s: 80, l: 65 },  // rose
  { h: 280, s: 60, l: 60 },  // violet
  { h: 170, s: 70, l: 55 },  // teal
  { h: 210, s: 80, l: 60 },  // blue
  { h: 25, s: 90, l: 60 },   // orange
  { h: 320, s: 55, l: 60 },  // pink
  { h: 150, s: 50, l: 55 },  // emerald
];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getConversationGradient(
  conversationId: string | null | undefined,
  isDark: boolean,
): string | null {
  if (!conversationId || conversationId === 'new') {
    return null;
  }

  const h = hashCode(conversationId);
  const primary = PALETTE[h % PALETTE.length];
  const secondary = PALETTE[(h >> 4) % PALETTE.length];

  const posX1 = 5 + (h % 40);
  const posX2 = 55 + ((h >> 8) % 40);
  const posY1 = ((h >> 3) % 15);
  const posY2 = 5 + ((h >> 6) % 20);

  const opA = isDark ? 0.22 : 0.14;
  const opB = isDark ? 0.18 : 0.11;

  return [
    `radial-gradient(ellipse 140% 70% at ${posX1}% ${posY1}%, hsla(${primary.h},${primary.s}%,${primary.l}%,${opA}) 0%, transparent 65%)`,
    `radial-gradient(ellipse 120% 60% at ${posX2}% ${posY2}%, hsla(${secondary.h},${secondary.s}%,${secondary.l}%,${opB}) 0%, transparent 60%)`,
  ].join(', ');
}
