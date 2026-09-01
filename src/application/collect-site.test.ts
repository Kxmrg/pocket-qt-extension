import { describe, expect, it } from 'vitest';
import { collectSiteDraft, type CollectionDeps } from './collect-site';
import type { PageSnapshot } from '../domain/types';

function nexusSnapshot(): PageSnapshot {
  return {
    url: 'https://pt.example/torrents.php',
    origin: 'https://pt.example',
    host: 'pt.example',
    title: 'Fixture PT',
    userAgent: 'Browser UA',
    meta: [{ name: 'generator', property: '', content: 'NexusPHP' }],
    resources: [],
    links: [{ text: '综合', href: 'https://pt.example/torrents.php' }],
    textSample: '',
    storage: [],
    candidates: [],
  };
}

function deps(overrides: Partial<CollectionDeps> = {}): CollectionDeps {
  return {
    getContext: async () => ({ url: 'https://pt.example/torrents.php', origin: 'https://pt.example', hasPermission: true }),
    readSnapshot: async () => nexusSnapshot(),
    readCookies: async () => [{ name: 'session', value: 'secret', domain: 'pt.example', path: '/', secure: true }],
    ...overrides,
  };
}

describe('collectSiteDraft', () => {
  it('returns permission-required before reading private page data', async () => {
    let snapshotRead = false;
    const result = await collectSiteDraft(deps({
      getContext: async () => ({ url: 'https://pt.example/', origin: 'https://pt.example', hasPermission: false }),
      readSnapshot: async () => { snapshotRead = true; return nexusSnapshot(); },
    }));
    expect(result).toEqual({ state: 'permission-required', origin: 'https://pt.example' });
    expect(snapshotRead).toBe(false);
  });

  it('returns a real detected and adapted draft', async () => {
    const result = await collectSiteDraft(deps());
    expect(result.state).toBe('ready');
    if (result.state !== 'ready') throw new Error('expected ready result');
    expect(result.detection.id).toBe('nexusphp');
    expect(result.draft).toMatchObject({ scheme: 0, cookie: 'session=secret', address: 'https://pt.example' });
  });

  it('uses page-visible cookies when the Chrome Cookie API returns an empty list', async () => {
    const result = await collectSiteDraft(deps({
      readSnapshot: async () => ({ ...nexusSnapshot(), documentCookie: 'session=page-secret; theme=dark' }),
      readCookies: async () => [],
    }));

    expect(result.state).toBe('ready');
    if (result.state !== 'ready') throw new Error('expected ready result');
    expect(result.draft.cookie).toBe('session=page-secret; theme=dark');
    expect(result.draft.fieldWarnings.cookie).toContain('页面可见 Cookie');
  });

  it('explains when neither Chrome nor the current page returns a Cookie', async () => {
    const result = await collectSiteDraft(deps({
      readSnapshot: async () => ({ ...nexusSnapshot(), documentCookie: '' }),
      readCookies: async () => [],
    }));

    expect(result.state).toBe('ready');
    if (result.state !== 'ready') throw new Error('expected ready result');
    expect(result.draft.cookie).toBe('');
    expect(result.draft.fieldWarnings.cookie).toContain('确认已登录并允许读取本站');
  });

  it('keeps complete API cookies and appends only missing page-visible cookies', async () => {
    const result = await collectSiteDraft(deps({
      readSnapshot: async () => ({ ...nexusSnapshot(), documentCookie: 'session=stale; theme=dark' }),
      readCookies: async () => [
        { name: 'session', value: 'api-secret', domain: 'pt.example', path: '/', secure: true },
        { name: 'uid', value: '42', domain: 'pt.example', path: '/', secure: true },
      ],
    }));

    expect(result.state).toBe('ready');
    if (result.state !== 'ready') throw new Error('expected ready result');
    expect(result.draft.cookie).toBe('session=api-secret; uid=42; theme=dark');
  });

  it('keeps the site editable when the Chrome Cookie API fails', async () => {
    const result = await collectSiteDraft(deps({
      readSnapshot: async () => ({ ...nexusSnapshot(), documentCookie: 'session=page-secret' }),
      readCookies: async () => { throw new Error('Chrome cookie access denied'); },
    }));

    expect(result.state).toBe('ready');
    if (result.state !== 'ready') throw new Error('expected ready result');
    expect(result.draft.cookie).toBe('session=page-secret');
    expect(result.draft.fieldWarnings.cookie).toContain('Chrome 完整 Cookie');
  });

  it('uses the mTorrent profile UUID and leaves the laboratory token for manual entry', async () => {
    const result = await collectSiteDraft(deps({
      getContext: async () => ({ tabId: 77, url: 'https://kp.m-team.cc/browse', origin: 'https://kp.m-team.cc', hasPermission: true }),
      readSnapshot: async () => ({
        ...nexusSnapshot(), url: 'https://kp.m-team.cc/browse', origin: 'https://kp.m-team.cc', host: 'kp.m-team.cc', meta: [],
        links: [{ text: '用户', href: 'https://kp.m-team.cc/profile/detail/295964' }],
      }),
      readCookies: async (_url, tabId) => {
        expect(tabId).toBe(77);
        return [{ name: 'x-api-key', value: 'must-not-auto-fill', domain: '.m-team.cc', path: '/', secure: true }];
      },
    }));
    expect(result.state).toBe('ready');
    if (result.state !== 'ready') throw new Error('expected ready result');
    expect(result.draft).toMatchObject({ architecture: 'mtorrent', cookie: '295964', token: null });
    expect(result.draft.fieldWarnings.token).toContain('控制台实验室');
  });

  it('returns unsupported details without an encodable draft', async () => {
    const result = await collectSiteDraft(deps({
      readSnapshot: async () => ({ ...nexusSnapshot(), meta: [], textSample: 'Powered by UNIT3D' }),
    }));
    expect(result).toMatchObject({ state: 'unsupported', detection: { id: 'unit3d', supported: false } });
    expect('draft' in result).toBe(false);
  });

  it('collects a supported original Gazelle site through detection, adaptation, and page generation', async () => {
    const result = await collectSiteDraft(deps({
      getContext: async () => ({
        url: 'https://dicmusic.com/torrents.php', origin: 'https://dicmusic.com', hasPermission: true,
      }),
      readSnapshot: async () => ({
        ...nexusSnapshot(),
        url: 'https://dicmusic.com/torrents.php',
        origin: 'https://dicmusic.com',
        host: 'dicmusic.com',
        title: '浏览种子 :: DIC Music',
        meta: [],
        domMarkers: ['body#torrents', 'gazelle-grouping-table', 'gazelle-group-row', 'gazelle-torrent-row'],
        links: [
          { text: 'Collages', href: 'https://dicmusic.com/collages.php' },
          { text: 'Requests', href: 'https://dicmusic.com/requests.php' },
        ],
      }),
    }));

    expect(result.state).toBe('ready');
    if (result.state !== 'ready') throw new Error('expected ready result');
    expect(result.detection).toMatchObject({ id: 'gazelle', supported: true });
    expect(result.draft).toMatchObject({ architecture: 'gazelle', scheme: 5, name: 'DIC Music' });
    expect(result.draft.pages).toEqual([
      { name: '种子', path: '/torrents.php', tags: null, selected: true },
      { name: '合集', path: '/collages.php', tags: null, selected: true },
    ]);
  });

  it('keeps GazellePW editable as a supported Gazelle site', async () => {
    const result = await collectSiteDraft(deps({
      getContext: async () => ({
        url: 'https://greatposterwall.com/torrents.php', origin: 'https://greatposterwall.com', hasPermission: true,
      }),
      readSnapshot: async () => ({
        ...nexusSnapshot(),
        url: 'https://greatposterwall.com/torrents.php',
        origin: 'https://greatposterwall.com',
        host: 'greatposterwall.com',
        title: '电影 :: Great Poster Wall',
        meta: [],
        domMarkers: ['body#torrents', 'gazellepw-cover-wall', 'gazellepw-movie-filters'],
      }),
    }));

    expect(result.state).toBe('ready');
    if (result.state !== 'ready') throw new Error('expected ready result');
    expect(result.detection).toMatchObject({ id: 'gazelle', supported: true });
    expect(result.draft).toMatchObject({ architecture: 'gazelle', scheme: 5, name: 'Great Poster Wall' });
  });

  it('keeps an unrecognized site editable with the collected page data', async () => {
    const result = await collectSiteDraft(deps({
      readSnapshot: async () => ({ ...nexusSnapshot(), meta: [], links: [], textSample: '' }),
    }));

    expect(result.state).toBe('ready');
    if (result.state !== 'ready') throw new Error('expected editable ready result');
    expect(result.detection).toMatchObject({ id: 'unknown', supported: false });
    expect(result.draft).toMatchObject({
      architecture: 'unknown',
      scheme: null,
      name: 'Fixture PT',
      address: 'https://pt.example',
      cookie: 'session=secret',
      userAgent: 'Browser UA',
      pages: [{ name: '综合', path: '/torrents.php', selected: true }],
    });
  });

  it('identifies page-probe failures without exposing the underlying error', async () => {
    const result = await collectSiteDraft(deps({ readSnapshot: async () => { throw new Error('private-secret'); } }));
    expect(result).toEqual({ state: 'error', message: '页面数据读取失败（E_PAGE），请刷新站点页面后重试' });
    expect(JSON.stringify(result)).not.toContain('private-secret');
  });
});
