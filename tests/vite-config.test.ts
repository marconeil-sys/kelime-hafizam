import { describe, expect, it } from 'vitest';

import { githubPagesBase } from '../vite.config';

describe('GitHub Pages taban yolu', () => {
  it('proje deposunda depo adını kullanır', () => {
    expect(githubPagesBase('atif/kelime-hafizam')).toBe('/kelime-hafizam/');
  });

  it('kullanıcı sitesi deposunda kök yolu kullanır', () => {
    expect(githubPagesBase('atif/atif.github.io')).toBe('/');
  });

  it('elle verilen taban yolunu önceliklendirir', () => {
    expect(githubPagesBase('atif/kelime-hafizam', '/ozel')).toBe('/ozel/');
  });
});
