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
    pages: [{ name: '综合', path: '/torrents.php', tags: null, selected: true }],
    passkey: null,
    userAgent: 'Test UA',
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
    [{ architecture: 'unknown', scheme: null }, 'architecture', '请选择 Pocket PT 支持的站点架构'],
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

  it('requires mTorrent UID and Access Token', () => {
    const result = validateDraft(validDraft({ architecture: 'mtorrent', scheme: 2, cookie: '', token: null }));
    expect(result.errors).toMatchObject({ cookie: '请输入 UID', token: '请输入 Access Token' });
  });

  it('requires HaiDan UID', () => {
    const result = validateDraft(validDraft({ architecture: 'haidan', scheme: 3, token: '' }));
    expect(result.errors.token).toBe('请输入 UID');
  });
});
