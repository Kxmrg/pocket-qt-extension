import { afterEach, describe, expect, it } from 'vitest';
import { collectPageSnapshot } from './page-probe';

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  localStorage.clear();
  sessionStorage.clear();
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; Max-Age=0; path=/`;
  }
});

describe('collectPageSnapshot', () => {
  it('collects bounded public architecture signals and excludes password values', () => {
    document.head.innerHTML = `
      <meta name="generator" content="NexusPHP">
      <meta name="csrf-token" content="meta-csrf">
      <link rel="stylesheet" href="/styles/nexus.css">
      <script src="/scripts/app.js"></script>
    `;
    document.title = 'Fixture PT';
    const manyLinks = Array.from({ length: 1_005 }, (_, index) =>
      `<a href="/torrents.php?cat=${index}">分类 ${index}</a>`).join('');
    document.body.innerHTML = `
      <input name="csrf_token" value="field-csrf">
      <input type="password" name="api-token" value="password-secret">
      <div data-uid="42">${'x'.repeat(21_000)}</div>
      <iframe src="https://outside.example/private"></iframe>
      ${manyLinks}
    `;
    localStorage.setItem('accessToken', 'a'.repeat(5_000));
    sessionStorage.setItem('uid', '42');
    document.cookie = 'session=page-secret; path=/';

    const result = collectPageSnapshot();

    expect(result.title).toBe('Fixture PT');
    expect(result.meta).toContainEqual({ name: 'generator', property: '', content: 'NexusPHP' });
    expect(result.resources.some((value) => value.includes('/styles/nexus.css'))).toBe(true);
    expect(result.links).toHaveLength(1_000);
    expect(result.textSample.length).toBeLessThanOrEqual(20_000);
    expect(result.storage.find((item) => item.key === 'accessToken')?.value).toHaveLength(4_096);
    expect(result.candidates).toContainEqual({ key: 'csrf_token', value: 'field-csrf', source: 'input' });
    expect(result.candidates).toContainEqual({ key: 'data-uid', value: '42', source: 'attribute' });
    expect(result.documentCookie).toBe('session=page-secret');
    expect(JSON.stringify(result)).not.toContain('password-secret');
    expect(result.links.some((link) => link.href.includes('outside.example'))).toBe(false);
  });
});
