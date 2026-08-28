import { afterEach, describe, expect, it, vi } from 'vitest';
import { readCookies, toOriginPattern } from './chrome-gateway';

afterEach(() => vi.unstubAllGlobals());

describe('toOriginPattern', () => {
  it('returns the exact HTTP(S) origin pattern', () => {
    expect(toOriginPattern('https://pt.example.com/path?q=1')).toBe('https://pt.example.com/*');
    expect(toOriginPattern('http://localhost:8080/page')).toBe('http://localhost:8080/*');
  });

  it.each(['chrome://extensions', 'file:///tmp/page.html', 'about:blank'])('rejects unsupported URL %s', (url) => {
    expect(() => toOriginPattern(url)).toThrow('请在普通 HTTP 或 HTTPS 站点中使用');
  });

  it('reads cookies from the store that owns the active tab', async () => {
    const getAll = vi.fn().mockResolvedValue([
      { name: 'c_secure_uid', value: '1', domain: 'pt.example', path: '/', secure: true },
    ]);
    vi.stubGlobal('chrome', {
      cookies: {
        getAllCookieStores: vi.fn().mockResolvedValue([
          { id: 'default', tabIds: [1, 2] },
          { id: 'incognito', tabIds: [77] },
        ]),
        getAll,
      },
    });

    const cookies = await readCookies('https://pt.example/torrents.php', 77);

    expect(getAll).toHaveBeenCalledWith({ url: 'https://pt.example/torrents.php', storeId: 'incognito' });
    expect(cookies[0]?.name).toBe('c_secure_uid');
  });
});
