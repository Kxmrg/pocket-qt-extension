import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectPageSnapshot } from './page-probe';

afterEach(() => {
  vi.restoreAllMocks();
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
  it('marks the HaiDan top navigation profile as the current user UID', () => {
    document.body.innerHTML = `
      <div class="userinfo medium border-box">
        <div class="userinfo-half">
          <div class="user_sub_item" href="userdetails.php?id=63618">
            <span><a href="userdetails.php?id=63618"><b>weisle</b></a></span>
          </div>
        </div>
      </div>
      <div class="time_col"><a href="userdetails.php?id=62090">happysky0816</a></div>
    `;

    const result = collectPageSnapshot();

    expect(result.candidates).toContainEqual({
      key: 'uid',
      value: '63618',
      source: 'current-user-profile',
    });
  });

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

  it('still collects the page when browser privacy rules block storage and document cookies', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(document, 'cookie', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    document.title = 'Restricted PT';
    document.body.innerHTML = '<a href="/torrents.php">种子</a>';

    const result = collectPageSnapshot();

    expect(result.title).toBe('Restricted PT');
    expect(result.documentCookie).toBe('');
    expect(result.storage).toEqual([]);
    expect(result.links[0]?.href).toContain('/torrents.php');
  });
});
