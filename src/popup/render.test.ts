import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SiteDraft } from '../domain/adapt-site';
import type { DetectionResult } from '../domain/types';
import { renderPopup, type PopupActions, type PopupState } from './render';

function draft(overrides: Partial<SiteDraft> = {}): SiteDraft {
  return {
    architecture: 'nexusphp', scheme: 0, name: 'Example PT', address: 'https://pt.example',
    cookie: 'session=secret',
    pages: [
      { name: '综合', path: '/torrents.php', tags: null, selected: true },
      { name: '电影', path: '/torrents.php?cat=401', tags: null, selected: true },
    ],
    passkey: null, userAgent: 'Browser UA', tags: null, downloadTags: null,
    widget: 1, token: null, search: true, top: null, fieldWarnings: {}, alternatives: {},
    ...overrides,
  };
}

function actions(): PopupActions {
  return {
    onRequestPermission: vi.fn(), onRetry: vi.fn(), onArchitectureChange: vi.fn(),
    onFieldChange: vi.fn(), onToggleCredential: vi.fn(), onPageToggle: vi.fn(),
    onPageChange: vi.fn(), onPageRemove: vi.fn(), onPageAdd: vi.fn(),
    onGenerate: vi.fn(), onBack: vi.fn(), onEnlarge: vi.fn(),
  };
}

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<main id="app"></main>';
  root = document.querySelector('#app') as HTMLElement;
});

describe('renderPopup', () => {
  it('renders one explicit per-site permission action', () => {
    const state: PopupState = { kind: 'permission', origin: 'https://pt.example' };
    renderPopup(root, state, actions());
    expect(root.querySelectorAll('button')).toHaveLength(1);
    expect(root.querySelector('button')?.textContent).toContain('允许读取本站');
  });

  it.each(['gazelle', 'unit3d'] as const)('shows %s as unsupported without a generate action', (id) => {
    const detection: DetectionResult = { id, supported: false, confidence: 'certain', reasons: [`检测到 ${id}`] };
    renderPopup(root, { kind: 'unsupported', detection }, actions());
    expect(root.textContent?.toLowerCase()).toContain(id);
    expect([...root.querySelectorAll('button')].some((button) => button.textContent?.includes('生成二维码'))).toBe(false);
  });

  it('renders editable fields, masked credentials, and all extracted pages checked', () => {
    renderPopup(root, { kind: 'ready', draft: draft(), errors: {}, revealed: new Set() }, actions());
    expect((root.querySelector('#site-name') as HTMLInputElement).value).toBe('Example PT');
    expect((root.querySelector('#site-address') as HTMLInputElement).value).toBe('https://pt.example');
    expect((root.querySelector('#user-agent') as HTMLInputElement).value).toBe('Browser UA');
    expect((root.querySelector('#cookie') as HTMLInputElement).type).toBe('password');
    expect(root.querySelector('#page-tags-0')).not.toBeNull();
    const pageChecks = [...root.querySelectorAll<HTMLInputElement>('input[data-page-selected]')];
    expect(pageChecks).toHaveLength(2);
    expect(pageChecks.every((input) => input.checked)).toBe(true);
  });

  it('shows field errors and disables QR generation', () => {
    renderPopup(root, {
      kind: 'ready', draft: draft({ cookie: '' }), errors: { cookie: '请输入 Cookie' }, revealed: new Set(),
    }, actions());
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('请输入 Cookie');
    expect((root.querySelector('[data-action="generate"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a QR capacity error near the final action', () => {
    renderPopup(root, {
      kind: 'ready', draft: draft(), errors: { payload: '二维码数据过大，请减少种子页面后重试' }, revealed: new Set(),
    }, actions());
    const alert = root.querySelector('[data-payload-error][role="alert"]');
    expect(alert?.textContent).toContain('二维码数据过大');
  });

  it('reveals only the selected credential', () => {
    renderPopup(root, { kind: 'ready', draft: draft(), errors: {}, revealed: new Set() }, actions());
    const button = root.querySelector('[data-reveal="cookie"]') as HTMLButtonElement;
    button.click();
    expect((root.querySelector('#cookie') as HTMLInputElement).type).toBe('text');
  });

  it('renders QR details and enlargement controls', () => {
    renderPopup(root, {
      kind: 'qr', draft: draft(), payload: { text: 'pocket-pt://import/site?v=1&data=x', sourceBytes: 320, compressedBytes: 180 }, enlarged: false,
    }, actions());
    expect(root.querySelector('#qr-canvas')).not.toBeNull();
    expect(root.textContent).toContain('Example PT');
    expect(root.textContent).toContain('180 B');
    expect(root.textContent).toContain('二维码包含当前站点登录凭据');
    expect(root.textContent).toContain('返回修改');
    expect(root.textContent).toContain('放大二维码');
  });

  it('connects every form control to an accessible label', () => {
    renderPopup(root, { kind: 'ready', draft: draft(), errors: {}, revealed: new Set() }, actions());
    for (const input of root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[id], select[id]')) {
      expect(root.querySelector(`label[for="${input.id}"]`), input.id).not.toBeNull();
    }
    for (const button of root.querySelectorAll('button')) {
      expect(Boolean(button.textContent?.trim() || button.getAttribute('aria-label'))).toBe(true);
    }
  });
});
