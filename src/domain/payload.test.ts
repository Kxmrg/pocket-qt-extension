import { inflateSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { SiteDraft } from './adapt-site';
import { buildImportPayload, encodeImportPayload } from './payload';

function draft(overrides: Partial<SiteDraft> = {}): SiteDraft {
  return {
    architecture: 'nexusphp',
    scheme: 0,
    name: 'Example PT',
    address: 'https://pt.example.com',
    cookie: 'uid=1; pass=secret',
    pages: [
      { name: '综合', path: '/torrents.php', tags: null, selected: true },
      { name: '不导入', path: '/torrents.php?cat=9', tags: null, selected: false },
    ],
    passkey: null,
    userAgent: 'Test UA',
    importUserAgent: true,
    tags: null,
    downloadTags: null,
    widget: 1,
    token: null,
    search: true,
    top: null,
    fieldWarnings: { cookie: 'UI only' },
    alternatives: {},
    ...overrides,
  };
}

const expected = {
  protocol: 'pocket-pt.site',
  version: 1,
  site: {
    scheme: 0,
    name: 'Example PT',
    address: 'https://pt.example.com',
    cookie: 'uid=1; pass=secret',
    pages: [{ name: '综合', path: '/torrents.php', tags: null }],
    passkey: null,
    userAgent: 'Test UA',
    tags: null,
    downloadTags: null,
    widget: 1,
    token: null,
    search: true,
    top: null,
  },
};

function randomCookie(length: number): string {
  let state = 0x12345678;
  return Array.from({ length }, () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return String.fromCharCode(33 + (state % 90));
  }).join('');
}

describe('Pocket Qt import payload', () => {
  it('maps only Flutter SiteConfig fields and selected pages', () => {
    expect(buildImportPayload(draft())).toEqual(expected);
  });

  it('always removes a stale token from NexusPHP payloads', () => {
    expect(buildImportPayload(draft({ token: 'must-not-be-sent' })).site.token).toBeNull();
  });

  it('never exports a short-lived SunnyPT bearer token', () => {
    const payload = buildImportPayload(draft({
      architecture: 'sunnypt', scheme: 4, address: 'https://sunnypt.top',
      token: 'short-lived-bearer',
    }));
    expect(payload.site.scheme).toBe(4);
    expect(payload.site.token).toBeNull();
  });

  it('never exports an unnecessary SunnyPT passkey', () => {
    const payload = buildImportPayload(draft({
      architecture: 'sunnypt', scheme: 4, address: 'https://sunnypt.top',
      passkey: 'must-not-be-sent',
    }));
    expect(payload.site.passkey).toBeNull();
  });

  it('encodes Gazelle without a token or passkey', () => {
    const encoded = buildImportPayload(draft({
      architecture: 'gazelle', scheme: 5, address: 'https://dicmusic.com',
      token: 'unused-token', passkey: 'unused-passkey',
    }));
    expect(encoded).toMatchObject({ version: 1, site: { scheme: 5, token: null, passkey: null } });
  });

  it('omits User-Agent when its import switch is off', () => {
    expect(buildImportPayload(draft({ importUserAgent: false })).site.userAgent).toBeNull();
  });

  it('round trips the versioned raw-deflate Base64URL payload', () => {
    const encoded = encodeImportPayload(draft());
    expect(encoded.text.startsWith('pocket-pt://import/site?v=1&data=')).toBe(true);

    const data = new URL(encoded.text).searchParams.get('data') ?? '';
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(data.length / 4) * 4, '=');
    const compressed = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const decoded = JSON.parse(new TextDecoder().decode(inflateSync(compressed)));
    expect(decoded).toEqual(expected);
    expect(encoded.sourceBytes).toBeGreaterThan(encoded.compressedBytes);
  });

  it('encodes data that fits QR low error correction but exceeds medium capacity', () => {
    expect(() => encodeImportPayload(draft({ cookie: randomCookie(2_100) }))).not.toThrow();
  });

  it('rejects data that cannot fit a single QR code', () => {
    expect(() => encodeImportPayload(draft({ cookie: randomCookie(8_000) })))
      .toThrow('二维码数据过大，请减少种子页面后重试');
  });
});
