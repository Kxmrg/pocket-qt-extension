import { afterEach, describe, expect, it, vi } from 'vitest';
import { getActivePageContext, readCookies, toOriginPattern } from './chrome-gateway';

afterEach(() => vi.unstubAllGlobals());

describe('toOriginPattern', () => {
  it('returns the exact HTTP(S) origin pattern', () => {
    expect(toOriginPattern('https://pt.example.com/path?q=1')).toBe('https://pt.example.com/*');
    expect(toOriginPattern('http://localhost:8080/page')).toBe('http://localhost:8080/*');
  });

  it.each(['chrome://extensions', 'file:///tmp/page.html', 'about:blank'])('rejects unsupported URL %s', (url) => {
    expect(() => toOriginPattern(url)).toThrow('请在普通 HTTP 或 HTTPS 站点中使用');
  });

  it('does not treat temporary activeTab access as an explicit Cookie host grant', async () => {
    vi.stubGlobal('chrome', {
      tabs: { query: vi.fn().mockResolvedValue([{ id: 42, url: 'https://hhanclub.net/torrents.php' }]) },
      permissions: {
        contains: vi.fn().mockResolvedValue(true),
        getAll: vi.fn().mockResolvedValue({ permissions: ['activeTab'], origins: [] }),
      },
    });

    await expect(getActivePageContext()).resolves.toMatchObject({
      origin: 'https://hhanclub.net',
      hasPermission: false,
    });
  });

  it.each([
    ['https://hhanclub.net/*'],
    ['https://*/*'],
    ['<all_urls>'],
  ])('accepts an explicit host grant covering the active site: %s', async (originGrant) => {
    vi.stubGlobal('chrome', {
      tabs: { query: vi.fn().mockResolvedValue([{ id: 42, url: 'https://hhanclub.net/torrents.php' }]) },
      permissions: {
        contains: vi.fn().mockResolvedValue(true),
        getAll: vi.fn().mockResolvedValue({ permissions: ['activeTab'], origins: [originGrant] }),
      },
    });

    await expect(getActivePageContext()).resolves.toMatchObject({ hasPermission: true });
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

  it('falls back to a domain query when Chrome returns no cookies for the page URL', async () => {
    const getAll = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { name: 'c_secure_pass', value: 'secret', domain: '.hhanclub.net', path: '/', secure: true },
      ]);
    vi.stubGlobal('chrome', {
      cookies: {
        getAllCookieStores: vi.fn().mockResolvedValue([{ id: 'default', tabIds: [42] }]),
        getAll,
      },
    });

    const cookies = await readCookies('https://hhanclub.net/torrents.php', 42);

    expect(getAll).toHaveBeenNthCalledWith(1, {
      url: 'https://hhanclub.net/torrents.php',
      storeId: 'default',
    });
    expect(getAll).toHaveBeenNthCalledWith(2, { domain: 'hhanclub.net', storeId: 'default' });
    expect(cookies.map((cookie) => cookie.name)).toEqual(['c_secure_pass']);
  });
});
