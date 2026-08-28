import { describe, expect, it } from 'vitest';
import { selectCandidate } from './candidates';
import type { PageSnapshot } from './types';

function snapshot(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    url: 'https://pt.example/',
    origin: 'https://pt.example',
    host: 'pt.example',
    title: 'PT',
    userAgent: 'Test UA',
    meta: [],
    resources: [],
    links: [],
    textSample: '',
    storage: [],
    candidates: [],
    ...overrides,
  };
}

describe('selectCandidate', () => {
  it('extracts a CSRF token from meta', () => {
    const result = selectCandidate('csrfToken', snapshot({
      meta: [{ name: 'csrf-token', property: '', content: 'csrf-value' }],
    }));
    expect(result).toMatchObject({ value: 'csrf-value', needsConfirmation: false });
  });

  it('extracts a TNode passkey from a download route', () => {
    const result = selectCandidate('passkey', snapshot({
      links: [{ text: '下载', href: 'https://pt.example/api/torrent/download/123/abc123passkey' }],
    }));
    expect(result.value).toBe('abc123passkey');
  });

  it('extracts M-Team UID and API key from storage aliases', () => {
    const value = snapshot({ storage: [
      { area: 'local', key: 'uid', value: '1024' },
      { area: 'local', key: 'x-api-key', value: 'api-secret' },
    ] });
    expect(selectCandidate('uid', value).value).toBe('1024');
    expect(selectCandidate('apiToken', value).value).toBe('api-secret');
  });

  it('extracts HaiDan UID from a profile link', () => {
    const result = selectCandidate('uid', snapshot({
      links: [{ text: '我的资料', href: 'https://haidan.cc/userdetails.php?id=42' }],
    }));
    expect(result.value).toBe('42');
  });

  it('flags conflicting values and keeps the highest confidence candidate', () => {
    const result = selectCandidate('apiToken', snapshot({
      candidates: [{ key: 'x-api-key', value: 'explicit-token', source: 'meta' }],
      storage: [{ area: 'local', key: 'accessToken', value: 'stored-token' }],
    }));
    expect(result.value).toBe('explicit-token');
    expect(result.needsConfirmation).toBe(true);
    expect(result.alternatives.map((item) => item.value)).toEqual(['explicit-token', 'stored-token']);
  });
});
