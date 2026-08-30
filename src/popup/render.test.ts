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
    onRead: vi.fn(), onRefresh: vi.fn(), onRequestPermission: vi.fn(), onRetry: vi.fn(), onArchitectureChange: vi.fn(),
    onFieldChange: vi.fn(), onToggleCredential: vi.fn(),
    onPageChange: vi.fn(), onPageRemove: vi.fn(), onPageAddCurrent: vi.fn(), onPageAddManual: vi.fn(),
    onGenerate: vi.fn(), onBack: vi.fn(),
  };
}

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<main id="app"></main>';
  root = document.querySelector('#app') as HTMLElement;
});

describe('renderPopup', () => {
  it('waits for an explicit read action before collecting the current page', () => {
    const handlers = actions();
    renderPopup(root, { kind: 'idle' }, handlers);
    expect(root.querySelector('#site-form')).toBeNull();
    const readButton = root.querySelector<HTMLButtonElement>('[data-action="read"]');
    expect(readButton?.textContent).toContain('读取站点数据');
    readButton?.click();
    expect(handlers.onRead).toHaveBeenCalledOnce();
  });

  it('renders the compact unread home in its intended reading order', () => {
    renderPopup(root, { kind: 'idle' }, actions());

    expect(root.querySelector('[data-home-brand]')?.textContent).toContain('Pocket Qt');
    expect(root.querySelector('[data-home-brand]')?.textContent).toContain('站点导入插件 v0.5.0');
    expect(root.querySelectorAll('[data-home-guide] li')).toHaveLength(4);
    expect(root.querySelector('[data-home-guide]')?.textContent).toContain('打开并登录 PT 站点，停留在种子列表页面');
    expect(root.querySelector('[data-home-guide]')?.textContent).toContain('点击开始读取站点数据');
    expect(root.querySelector('[data-home-guide]')?.textContent).toContain('手动修改补充站点信息');
    expect(root.querySelector('[data-home-guide]')?.textContent).toContain('生成二维码，使用 Pocket Qt 扫码添加站点');
    expect(root.querySelector('[data-home-features]')).toBeNull();
    expect(root.querySelector('[data-home-security]')?.textContent).toContain('仅在本机处理');
    expect(root.querySelector('[data-home-guide]')?.classList).toContain('home-card');
    expect(root.querySelector('[data-home-security]')?.classList).toContain('home-card');

    const project = root.querySelector<HTMLAnchorElement>('a[data-home-link="project"]');
    const license = root.querySelector<HTMLAnchorElement>('a[data-home-link="license"]');
    expect(project?.href).toBe('https://kxmrg.com/');
    expect(license?.href).toBe('https://pocket.kxmrg.com/user/licenses');
    expect(project?.target).toBe('_blank');
    expect(license?.target).toBe('_blank');

    const children = [...(root.querySelector('.home-shell')?.children ?? [])];
    expect(children.map((element) => element.getAttribute('data-home-section'))).toEqual([
      'brand', 'links', 'guide', 'security', 'action',
    ]);
  });

  it('renders one explicit per-site permission action', () => {
    const state: PopupState = { kind: 'permission', origin: 'https://pt.example' };
    renderPopup(root, state, actions());
    expect(root.querySelectorAll('button')).toHaveLength(1);
    expect(root.querySelector('button')?.textContent).toContain('允许读取本站');
    expect(root.querySelector('.app-brand')?.textContent).toContain('Pocket Qt 站点导入插件');
    expect(root.querySelector('.app-brand')?.textContent).toContain('v0.5.0');
  });

  it.each(['gazelle', 'unit3d'] as const)('shows %s as unsupported without a generate action', (id) => {
    const detection: DetectionResult = { id, supported: false, confidence: 'certain', reasons: [`检测到 ${id}`] };
    renderPopup(root, { kind: 'unsupported', detection }, actions());
    expect(root.textContent?.toLowerCase()).toContain(id);
    expect([...root.querySelectorAll('button')].some((button) => button.textContent?.includes('生成二维码'))).toBe(false);
  });

  it('uses the plugin header and omits technical guidance on the read error page', () => {
    renderPopup(root, { kind: 'error', message: '请在普通 HTTP 或 HTTPS 站点中使用' }, actions());

    expect(root.querySelector('.app-brand')?.textContent).toContain('Pocket Qt 站点导入插件');
    expect(root.querySelector('.app-brand')?.textContent).toContain('v0.5.0');
    expect(root.querySelector('h1')?.textContent).toBe('未能读取站点');
    expect(root.textContent).not.toContain('请在普通 HTTP 或 HTTPS 站点中使用');
    expect(root.querySelector('[role="alert"]')).toBeNull();
  });

  it('renders editable fields, masked credentials, and simplified page rows', () => {
    const handlers = actions();
    renderPopup(root, { kind: 'ready', draft: draft(), errors: {}, revealed: new Set(), sourceOrigin: 'https://pt.example' }, handlers);
    expect((root.querySelector('#site-name') as HTMLInputElement).value).toBe('Example PT');
    expect((root.querySelector('#site-address') as HTMLInputElement).value).toBe('https://pt.example');
    expect((root.querySelector('#user-agent') as HTMLInputElement).value).toBe('Browser UA');
    expect((root.querySelector('#cookie') as HTMLInputElement).type).toBe('password');
    expect(root.querySelector('#token')).toBeNull();
    expect(root.querySelector('#page-tags-0')).toBeNull();
    expect(root.querySelector('[data-page-selected]')).toBeNull();
    expect(root.querySelectorAll('.page-row')).toHaveLength(2);
    expect(root.querySelector('[data-page-title="0"]')?.textContent).toContain('页面 #1');
    expect(root.querySelector('[data-page-title="1"]')?.textContent).toContain('页面 #2');
    expect(root.querySelector('[data-page-title="0"] .page-number')?.textContent).toBe('#1');
    expect([...root.querySelector('.page-row')!.children].map((element) => element.classList[0])).toEqual([
      'page-row-heading', 'field', 'field',
    ]);
    expect((root.querySelector('#page-name-0') as HTMLInputElement).value).toBe('综合');
    expect((root.querySelector('#page-path-0') as HTMLInputElement).value).toBe('/torrents.php');
    expect([...root.querySelector('[data-site-context]')!.children].map((element) => element.className)).toEqual([
      'architecture-badge',
      'site-domain',
    ]);
    expect(root.querySelector('[data-site-context] .status-dot')).toBeNull();
    expect(root.querySelector('[data-site-context]')?.textContent).toContain('pt.example');
    expect(root.querySelector('[data-site-context]')?.textContent).toContain('NexusPHP');
    expect(root.querySelector('[data-home-guide]')).toBeNull();
    expect(root.querySelector('.app-brand')?.textContent).toContain('Pocket Qt 站点导入插件');
    expect(root.querySelector('.app-brand')?.textContent).toContain('v0.5.0');
    expect(root.querySelector('h2')?.textContent).toBe('站点信息');
    root.querySelector<HTMLButtonElement>('[data-action="refresh"]')?.click();
    expect(handlers.onRefresh).toHaveBeenCalledOnce();
  });

  it('shows architecture names without fixed-site aliases', () => {
    renderPopup(root, { kind: 'ready', draft: draft({ architecture: 'mtorrent', scheme: 2 }), errors: {}, revealed: new Set(), sourceOrigin: 'https://kp.m-team.cc' }, actions());
    expect(root.querySelector('[data-architecture-option="mtorrent"]')?.textContent).toContain('mTorrent');
    expect(root.querySelector('[data-architecture-option="tnode"]')?.textContent).toContain('TNode');
    expect(root.textContent).not.toContain('M-Team');
    expect(root.textContent).not.toContain('朱雀');
    expect(root.querySelector('label[for="cookie"]')?.textContent).toBe('UUID');
    expect(root.querySelector('label[for="token"]')?.textContent).toBe('令牌');
    expect(root.querySelector('#passkey')).toBeNull();
  });

  it('hides Passkey for TNode while keeping it for NexusPHP', () => {
    renderPopup(root, { kind: 'ready', draft: draft({ architecture: 'tnode', scheme: 1 }), errors: {}, revealed: new Set() }, actions());
    expect(root.querySelector('#passkey')).toBeNull();

    renderPopup(root, { kind: 'ready', draft: draft(), errors: {}, revealed: new Set() }, actions());
    expect(root.querySelector('#passkey')).not.toBeNull();
  });

  it('shows SunnyPt as supported and hides token and passkey inputs', () => {
    renderPopup(root, {
      kind: 'ready',
      draft: draft({ architecture: 'sunnypt', scheme: 4, address: 'https://sunnypt.top' }),
      errors: {}, revealed: new Set(), sourceOrigin: 'https://sunnypt.top',
    }, actions());

    expect(root.querySelector('[data-architecture-option="sunnypt"]')?.textContent).toContain('SunnyPt');
    expect(root.querySelector('#token')).toBeNull();
    expect(root.querySelector('#passkey')).toBeNull();
  });

  it('explains how to separate multiple downloader tags', () => {
    renderPopup(root, { kind: 'ready', draft: draft(), errors: {}, revealed: new Set() }, actions());
    expect(root.querySelector<HTMLInputElement>('#download-tags')?.placeholder).toBe('多个标签用英文逗号分隔');
  });

  it('opens the custom architecture menu and selects an option', () => {
    const handlers = actions();
    renderPopup(root, { kind: 'ready', draft: draft(), errors: {}, revealed: new Set() }, handlers);
    const trigger = root.querySelector<HTMLButtonElement>('[data-architecture-trigger]');
    const menu = root.querySelector<HTMLElement>('[data-architecture-menu]');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(menu?.hidden).toBe(true);

    trigger?.click();
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(menu?.hidden).toBe(false);
    root.querySelector<HTMLButtonElement>('[data-architecture-option="tnode"]')?.click();
    expect(handlers.onArchitectureChange).toHaveBeenCalledWith('tnode');
    expect(menu?.hidden).toBe(true);
  });

  it('provides separate current-page and manual-page actions on one row', () => {
    const handlers = actions();
    renderPopup(root, { kind: 'ready', draft: draft(), errors: {}, revealed: new Set() }, handlers);
    root.querySelector<HTMLButtonElement>('[data-action="add-current-page"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="add-manual-page"]')?.click();
    expect(handlers.onPageAddCurrent).toHaveBeenCalledOnce();
    expect(handlers.onPageAddManual).toHaveBeenCalledOnce();
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

  it('keeps advanced settings open when aggregate search rerenders the form', () => {
    const handlers = actions();
    let readyState: Extract<PopupState, { kind: 'ready' }> = {
      kind: 'ready', draft: draft(), errors: {}, revealed: new Set(),
    };
    handlers.onFieldChange = vi.fn((field, value) => {
      if (field === 'search') readyState = { ...readyState, draft: { ...readyState.draft, search: Boolean(value) } };
      renderPopup(root, readyState, handlers);
    });
    renderPopup(root, readyState, handlers);
    const advanced = root.querySelector<HTMLDetailsElement>('details.advanced');
    if (advanced) advanced.open = true;

    root.querySelector<HTMLInputElement>('#search')?.click();

    expect(root.querySelector<HTMLDetailsElement>('details.advanced')?.open).toBe(true);
  });

  it('renders a single responsive QR card without metadata or enlargement controls', () => {
    const handlers = actions();
    renderPopup(root, {
      kind: 'qr', draft: draft(), payload: { text: 'pocket-pt://import/site?v=1&data=x', sourceBytes: 320, compressedBytes: 180 },
    }, handlers);
    expect(root.querySelector('#qr-canvas')).not.toBeNull();
    expect(root.querySelector('#qr-canvas')?.getAttribute('aria-label')).toBe('Pocket Qt 站点导入二维码');
    expect(root.querySelector('.app-brand')?.textContent).toContain('Pocket Qt 站点导入插件');
    expect(root.querySelector('.app-brand')?.textContent).toContain('v0.5.0');
    expect(root.querySelector('.payload-meta')).toBeNull();
    const siteInfo = root.querySelector('[data-qr-site-info]');
    expect(siteInfo?.textContent).toContain('架构');
    expect(siteInfo?.textContent).toContain('NexusPHP');
    expect(siteInfo?.textContent).toContain('站点名称');
    expect(siteInfo?.textContent).toContain('Example PT');
    expect(siteInfo?.textContent).toContain('地址');
    expect(siteInfo?.textContent).toContain('https://pt.example');
    expect(root.textContent).not.toContain('180 B');
    expect(root.textContent).toContain('二维码包含当前站点登录凭据');
    expect(root.textContent).toContain('返回修改');
    expect(root.textContent).not.toContain('放大二维码');
    expect(root.querySelectorAll('.qr-actions button')).toHaveLength(1);
    root.querySelector<HTMLButtonElement>('[data-action="refresh"]')?.click();
    expect(handlers.onRefresh).toHaveBeenCalledOnce();
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
