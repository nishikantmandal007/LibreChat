import { normalizeBaseHref, toRouterBasename } from '../baseHref';

describe('normalizeBaseHref', () => {
  it('keeps the root base as /', () => {
    expect(normalizeBaseHref('/')).toBe('/');
  });

  it('normalizes a subpath base to a trailing-slash form', () => {
    expect(normalizeBaseHref('/newaisafe')).toBe('/newaisafe/');
  });

  it('preserves an already-normalized subpath base', () => {
    expect(normalizeBaseHref('/newaisafe/')).toBe('/newaisafe/');
  });
});

describe('toRouterBasename', () => {
  it('keeps the root base as /', () => {
    expect(toRouterBasename('/')).toBe('/');
    expect(toRouterBasename(null)).toBe('/');
  });

  it('strips the trailing slash for a subpath base', () => {
    expect(toRouterBasename('/newaisafe/')).toBe('/newaisafe');
    expect(toRouterBasename('/newaisafe')).toBe('/newaisafe');
  });
});
