export const normalizeBaseHref = (baseHref?: string | null): string => {
  const href = (baseHref ?? '/').trim();

  if (!href || href === '/') {
    return '/';
  }

  return href.endsWith('/') ? href : `${href}/`;
};

export const toRouterBasename = (baseHref?: string | null): string => {
  const normalized = normalizeBaseHref(baseHref);

  if (normalized === '/') {
    return '/';
  }

  return normalized.replace(/\/$/, '');
};
