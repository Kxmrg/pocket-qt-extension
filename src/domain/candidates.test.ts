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

  it('uses only the current HaiDan user UID when uploader profile links are present', () => {
    const result = selectCandidate('uid', snapshot({
      candidates: [{ key: 'uid', value: '63618', source: 'current-user-profile' }],
      links: [
        { text: 'weisle', href: 'https://haidan.cc/userdetails.php?id=63618' },
        { text: 'happysky0816', href: 'https://haidan.cc/userdetails.php?id=62090' },
        { text: 'WhiteLycoris', href: 'https://haidan.cc/userdetails.php?id=52698' },
      ],
    }));

    expect(result).toMatchObject({ value: '63618', needsConfirmation: false });
    expect(result.alternatives.map((item) => item.value)).toEqual(['63618']);
  });

  it('extracts an mTorrent UUID from its profile detail route', () => {
    const result = selectCandidate('uid', snapshot({
      url: 'https://kp.m-team.cc/browse',
      origin: 'https://kp.m-team.cc',
      host: 'kp.m-team.cc',
      links: [{ text: 'M-Team 用户', href: 'https://kp.m-team.cc/profile/detail/295964' }],
      candidates: [{ key: 'uid', value: 'cookie-value-is-not-the-profile-uuid', source: 'cookie' }],
    }));
    expect(result.value).toBe('295964');
    expect(result.alternatives[0]?.source).toBe('个人资料链接');
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
