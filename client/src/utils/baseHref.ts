export const normalizeBaseHref = (baseHref?: string | null): string => {
  const href = (baseHref ?? '/').trim();

  if (!href || href === '/') {
    return '/';
  }

  return href.endsWith('/') ? href : `${href}/`;
};
