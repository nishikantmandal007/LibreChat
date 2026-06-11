import { normalizeBaseHref } from '../baseHref';

describe('normalizeBaseHref', () => {
  it('keeps the root base as /', () => {
    expect(normalizeBaseHref('/')).toBe('/');
  });

  it('normalizes a subpath base to a trailing-slash form', () => {
    expect(normalizeBaseHref('/librechat')).toBe('/librechat/');
  });

  it('preserves an already-normalized subpath base', () => {
    expect(normalizeBaseHref('/librechat/')).toBe('/librechat/');
  });
});
