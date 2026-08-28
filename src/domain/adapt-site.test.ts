import { describe, expect, it } from 'vitest';
import { adaptSite } from './adapt-site';
import type { ArchitectureId, DetectionResult, PageSnapshot } from './types';

function input(id: ArchitectureId, url: string, overrides: Partial<PageSnapshot> = {}, cookieHeader = 'session=secret') {
  const parsed = new URL(url);
  const detection: DetectionResult = { id, supported: true, confidence: 'certain', reasons: ['test'] };
  const snapshot: PageSnapshot = {
    url,
    origin: parsed.origin,
    host: parsed.hostname,
    title: 'Example PT - 首页',
    userAgent: 'Browser UA',
    meta: [],
    resources: [],
    links: [],
    textSample: '',
    storage: [],
    candidates: [],
    ...overrides,
  };
  return { detection, snapshot, cookieHeader };
}

describe('adaptSite', () => {
  it('maps NexusPHP directly to Flutter SiteConfig fields', () => {
    const draft = adaptSite(input('nexusphp', 'https://pt.example/torrents.php'));
    expect(draft).toMatchObject({
      architecture: 'nexusphp', scheme: 0, name: 'Example PT',
      address: 'https://pt.example', cookie: 'session=secret',
      token: null, widget: 1, search: true,
    });
    expect(draft.pages[0]?.path).toBe('/torrents.php');
  });

  it('maps TNode CSRF token and passkey', () => {
    const draft = adaptSite(input('tnode', 'https://zhuque.in/torrent/search', {
      meta: [{ name: 'csrf-token', property: '', content: 'csrf-secret' }],
      links: [{ text: '下载', href: 'https://zhuque.in/api/torrent/download/7/pass-key' }],
    }));
    expect(draft).toMatchObject({ scheme: 1, address: 'https://zhuque.in', cookie: 'session=secret', token: 'csrf-secret', passkey: 'pass-key' });
  });

  it.each([
    ['https://kp.m-team.cc/browse', 'https://api.m-team.cc'],
    ['https://zp.m-team.io/browse', 'https://api.m-team.io'],
    ['https://api.m-team.cc/browse', 'https://api.m-team.cc'],
  ])('normalizes M-Team address %s to %s', (url, address) => {
    const draft = adaptSite(input('mtorrent', url, {
      storage: [
        { area: 'local', key: 'uid', value: '88' },
        { area: 'local', key: 'x-api-key', value: 'api-token' },
      ],
    }));
    expect(draft).toMatchObject({ scheme: 2, address, cookie: '88', token: 'api-token' });
  });

  it('maps HaiDan profile UID into token and retains the complete Cookie header', () => {
    const draft = adaptSite(input('haidan', 'https://haidan.cc/torrents.php', {
      links: [{ text: '资料', href: 'https://haidan.cc/userdetails.php?id=42' }],
    }));
    expect(draft).toMatchObject({ scheme: 3, address: 'https://haidan.cc', cookie: 'session=secret', token: '42' });
  });

  it('marks required special credentials when extraction fails', () => {
    const draft = adaptSite(input('mtorrent', 'https://kp.m-team.cc/browse'));
    expect(draft.fieldWarnings).toMatchObject({ cookie: '未自动获取 UID', token: '未自动获取 Access Token' });
  });
});
