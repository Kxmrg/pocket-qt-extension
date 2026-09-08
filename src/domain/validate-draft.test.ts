import { describe, expect, it } from 'vitest';
import type { SiteDraft } from './adapt-site';
import { validateDraft } from './validate-draft';

function validDraft(overrides: Partial<SiteDraft> = {}): SiteDraft {
  return {
    architecture: 'nexusphp',
    scheme: 0,
    name: 'Example PT',
    address: 'https://pt.example',
    cookie: 'session=secret',
    webToken: null,
    webDeviceId: null,
    webVisitorId: null,
    pages: [{ name: '综合', path: '/torrents.php', tags: null, selected: true }],
    passkey: null,
    userAgent: 'Test UA',
    importUserAgent: true,
    tags: null,
    downloadTags: null,
    widget: 1,
    token: null,
    search: true,
    top: null,
    fieldWarnings: {},
    alternatives: {},
    ...overrides,
  };
}

describe('validateDraft', () => {
  it('accepts a complete NexusPHP draft', () => {
    expect(validateDraft(validDraft())).toEqual({ valid: true, errors: {} });
  });

  it.each([
    [{ architecture: 'unknown', scheme: null }, 'architecture', '请选择 Pocket Qt 支持的站点架构'],
    [{ name: '  ' }, 'name', '请输入站点名称'],
    [{ address: 'file:///tmp/pt' }, 'address', '请输入有效的 HTTP 或 HTTPS 站点地址'],
    [{ cookie: '' }, 'cookie', '请输入 Cookie'],
    [{ pages: [] }, 'pages', '至少选择一个种子页面'],
    [{ pages: [{ name: '坏页面', path: 'https://outside.example/', tags: null, selected: true }] }, 'pages', '种子页面路径必须以 / 开头'],
    [{ widget: 0 }, 'widget', '权重必须为 1 到 999 的整数'],
  ] as const)('returns a field error for %j', (change, field, message) => {
    const result = validateDraft(validDraft(change as Partial<SiteDraft>));
    expect(result.errors[field]).toBe(message);
  });

  it('requires TNode CSRF token', () => {
    const result = validateDraft(validDraft({ architecture: 'tnode', scheme: 1, token: null }));
    expect(result.errors.token).toBe('请输入 X-Csrf-Token');
  });

  it('requires only mTorrent UID and Access Token', () => {
    const result = validateDraft(validDraft({
      architecture: 'mtorrent', scheme: 2, cookie: '', webToken: null,
      webDeviceId: null, webVisitorId: null, passkey: null, token: null,
    }));
    expect(result.errors).toMatchObject({
      passkey: '请输入 UID',
      token: '请前往控制台实验室复制令牌并手动填写',
    });
    expect(result.errors.cookie).toBeUndefined();
    expect(result.errors.webToken).toBeUndefined();
    expect(result.errors.webDeviceId).toBeUndefined();
    expect(result.errors.webVisitorId).toBeUndefined();
  });

  it('requires HaiDan UID', () => {
    const result = validateDraft(validDraft({ architecture: 'haidan', scheme: 3, token: '' }));
    expect(result.errors.token).toBe('请输入 UID');
  });

  it('accepts SunnyPT with scheme 4 and Cookie without a stored token', () => {
    const result = validateDraft(validDraft({
      architecture: 'sunnypt', scheme: 4, address: 'https://sunnypt.top',
      pages: [{ name: '综合', path: '/torrents?category=All', tags: null, selected: true }],
      token: null,
    }));
    expect(result).toEqual({ valid: true, errors: {} });
  });

  it('accepts Gazelle with scheme 5 and Cookie without a token', () => {
    const result = validateDraft(validDraft({
      architecture: 'gazelle', scheme: 5, address: 'https://dicmusic.com', token: null,
    }));
    expect(result).toEqual({ valid: true, errors: {} });
  });

  it('accepts UNIT3D with scheme 6 and Cookie without API credentials', () => {
    const result = validateDraft(validDraft({
      architecture: 'unit3d', scheme: 6, address: 'https://unit3d.example',
      pages: [{ name: '综合', path: '/torrents', tags: null, selected: true }],
      token: null, passkey: null,
    }));
    expect(result).toEqual({ valid: true, errors: {} });
  });

  it('accepts a registered Private domain with scheme 7 and no API credentials', () => {
    const result = validateDraft(validDraft({
      architecture: 'private', scheme: 7, address: 'https://filelist.io',
      pages: [{ name: '综合', path: '/browse.php', tags: null, selected: true }],
      token: null, passkey: null,
    }));
    expect(result).toEqual({ valid: true, errors: {} });
  });

  it('rejects an unregistered domain manually assigned to Private', () => {
    const result = validateDraft(validDraft({
      architecture: 'private', scheme: 7, address: 'https://private.example',
    }));
    expect(result.errors.address).toBe('该 Private 站点尚未适配');
  });
});
