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

  it('returns an editable unknown draft for manual architecture selection', async () => {
    const result = await collectSiteDraft(deps({
      readSnapshot: async () => ({ ...nexusSnapshot(), meta: [], links: [], textSample: '' }),
    }));
    expect(result.state).toBe('ready');
    if (result.state !== 'ready') throw new Error('expected editable result');
    expect(result.draft).toMatchObject({ architecture: 'unknown', scheme: null, cookie: 'session=secret' });
  });

  it('converts collection failures into a safe message', async () => {
    const result = await collectSiteDraft(deps({ readSnapshot: async () => { throw new Error('private-secret'); } }));
    expect(result).toEqual({ state: 'error', message: '读取当前站点失败，请刷新页面后重试' });
  });
});
