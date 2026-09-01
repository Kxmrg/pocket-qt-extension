import type { CollectionResult } from '../application/collect-site';
import type { SiteDraft } from '../domain/adapt-site';
import type { EncodedPayload } from '../domain/payload';
import type { ArchitectureId, DetectionResult } from '../domain/types';

export type PopupState =
  | { kind: 'idle' }
  | { kind: 'loading'; message: string }
  | { kind: 'permission'; origin: string }
  | { kind: 'unsupported'; detection: DetectionResult }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; draft: SiteDraft; errors: Record<string, string>; revealed: Set<string>; sourceOrigin?: string }
  | { kind: 'qr'; draft: SiteDraft; payload: EncodedPayload };

export interface PopupActions {
  onRead: () => void;
  onRefresh: () => void;
  onRequestPermission: () => void;
  onRetry: () => void;
  onArchitectureChange: (architecture: ArchitectureId) => void;
  onFieldChange: (field: string, value: string | number | boolean | null) => void;
  onToggleCredential: (field: string) => void;
  onPageChange: (index: number, field: 'name' | 'path', value: string) => void;
  onPageRemove: (index: number) => void;
  onPageAddCurrent: () => void;
  onPageAddManual: () => void;
  onGenerate: () => void;
  onFullscreen: () => void;
  onBack: () => void;
}

const architectureNames: Record<ArchitectureId, string> = {
  nexusphp: 'NexusPHP',
  tnode: 'TNode',
  mtorrent: 'mTorrent',
  haidan: 'HaiDanPt',
  sunnypt: 'SunnyPt',
  gazelle: 'Gazelle',
  unit3d: 'UNIT3D',
  unknown: '未知架构',
};

const PROJECT_URL = 'https://kxmrg.com/';
const LICENSE_URL = 'https://pocket.kxmrg.com/user/licenses';
const UPDATE_URL = 'https://github.com/Kxmrg/pocket-qt-extension';
const PLUGIN_NAME = 'Pocket Qt 站点导入插件';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function icon(name: 'arrow' | 'chevron' | 'external' | 'lock' | 'plus' | 'refresh' | 'remove' | 'shield'): string {
  const paths: Record<typeof name, string> = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chevron: '<path d="m7 10 5 5 5-5"/>',
    external: '<path d="M14 5h5v5M10 14 19 5M19 13v6H5V5h6"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',
    remove: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
    shield: '<path d="M12 3 5 6v5c0 4.6 2.9 8 7 10 4.1-2 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
  };
  return `<svg class="icon icon-${name}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}

function extensionVersion(): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
    return chrome.runtime.getManifest().version;
  }
  return '0.5.0';
}

function appHeader(options: { title?: string; detail?: string; action?: string } = {}): string {
  return `<header class="app-header">
    <div class="app-brand"><span class="app-mark" aria-hidden="true">P</span><div><strong>${escapeHtml(options.title ?? PLUGIN_NAME)}</strong>${options.detail ? `<span>${escapeHtml(options.detail)}</span>` : ''}</div></div>
    ${options.action ?? ''}
  </header>`;
}

function sourceHost(sourceOrigin?: string): string {
  if (!sourceOrigin) return '当前页面';
  try { return new URL(sourceOrigin).host; } catch { return sourceOrigin; }
}

function errorFor(errors: Record<string, string>, field: string): string {
  return errors[field] ? `<p class="field-error" role="alert">${escapeHtml(errors[field])}</p>` : '';
}

function regularField(id: string, label: string, value: unknown, field: string, options: { type?: string; error?: string; placeholder?: string } = {}): string {
  return `<div class="field ${options.error ? 'has-error' : ''}">
    <label for="${id}">${escapeHtml(label)}</label>
    <input id="${id}" data-field="${field}" type="${options.type ?? 'text'}" value="${escapeHtml(value)}" placeholder="${escapeHtml(options.placeholder ?? '')}" autocomplete="off">
    ${options.error ? `<p class="field-error" role="alert">${escapeHtml(options.error)}</p>` : ''}
  </div>`;
}

function credentialField(
  id: string,
  label: string,
  value: string | null,
  field: string,
  state: Extract<PopupState, { kind: 'ready' }>,
): string {
  const revealed = state.revealed.has(field);
  const warning = state.draft.fieldWarnings[field];
  return `<div class="field credential ${state.errors[field] ? 'has-error' : ''}">
    <label for="${id}">${escapeHtml(label)}</label>
    <div class="input-action">
      <input id="${id}" data-field="${field}" type="${revealed ? 'text' : 'password'}" value="${escapeHtml(value ?? '')}" autocomplete="off" spellcheck="false">
      <button type="button" class="reveal" data-reveal="${field}" aria-label="${revealed ? '隐藏' : '显示'}${escapeHtml(label)}">${revealed ? '隐藏' : '显示'}</button>
    </div>
    ${state.errors[field] ? `<p class="field-error" role="alert">${escapeHtml(state.errors[field])}</p>` : warning ? `<p class="field-warning">${escapeHtml(warning)}</p>` : ''}
  </div>`;
}

function architectureSelect(draft: SiteDraft, errors: Record<string, string>): string {
  const supported: ArchitectureId[] = ['nexusphp', 'tnode', 'mtorrent', 'haidan', 'sunnypt'];
  const options = [
    ...(draft.architecture === 'unknown' ? ['unknown' as const] : []),
    ...supported,
  ].map((id) => `<button type="button" class="architecture-option ${draft.architecture === id ? 'is-selected' : ''}" data-architecture-option="${id}" role="option" aria-selected="${draft.architecture === id}"><span>${draft.architecture === id ? '✓' : ''}</span>${escapeHtml(architectureNames[id])}</button>`).join('');
  return `<div class="field ${errors.architecture ? 'has-error' : ''}">
    <label id="architecture-label">站点架构</label>
    <div class="architecture-control">
      <button type="button" class="architecture-trigger" data-architecture-trigger aria-labelledby="architecture-label architecture-value" aria-haspopup="listbox" aria-expanded="false"><span id="architecture-value">${escapeHtml(architectureNames[draft.architecture])}</span>${icon('chevron')}</button>
      <div class="architecture-menu" data-architecture-menu role="listbox" aria-labelledby="architecture-label" hidden>${options}</div>
    </div>
    ${errorFor(errors, 'architecture')}
  </div>`;
}

function pageRows(draft: SiteDraft): string {
  return draft.pages.map((page, index) => `<article class="page-row">
    <div class="page-row-heading" data-page-title="${index}">
      <strong>页面 <span class="page-number">#${index + 1}</span></strong>
      <button type="button" class="icon-button remove-page" data-page-remove="${index}" aria-label="删除页面 ${index + 1}">${icon('remove')}</button>
    </div>
    <div class="field compact page-row-name"><label for="page-name-${index}">名称</label><input id="page-name-${index}" data-page-field="name" data-page-index="${index}" value="${escapeHtml(page.name)}"></div>
    <div class="field compact page-row-path"><label for="page-path-${index}">路径</label><input id="page-path-${index}" data-page-field="path" data-page-index="${index}" value="${escapeHtml(page.path)}" spellcheck="false"></div>
  </article>`).join('');
}

function readyView(state: Extract<PopupState, { kind: 'ready' }>): string {
  const { draft, errors } = state;
  const tokenLabel = draft.architecture === 'tnode' ? 'X-Csrf-Token' : draft.architecture === 'mtorrent' ? '令牌' : draft.architecture === 'haidan' ? 'UID' : 'Token（可选）';
  const cookieLabel = draft.architecture === 'mtorrent' ? 'UUID' : 'Cookie';
  const tokenField = draft.architecture === 'nexusphp' || draft.architecture === 'sunnypt' || draft.architecture === 'gazelle'
    ? ''
    : credentialField('token', tokenLabel, draft.token, 'token', state);
  const passkeyField = draft.architecture === 'tnode' || draft.architecture === 'mtorrent' || draft.architecture === 'sunnypt' || draft.architecture === 'gazelle'
    ? ''
    : credentialField('passkey', 'Passkey（可选）', draft.passkey, 'passkey', state);
  const invalid = Object.keys(errors).length > 0;
  return `<div class="shell ready-shell">
    ${appHeader({ title: PLUGIN_NAME, detail: `v${extensionVersion()}`, action: `<button type="button" class="header-action" data-action="refresh">${icon('refresh')}<span>刷新</span></button>` })}
    <div class="site-context" data-site-context><span class="architecture-badge">${escapeHtml(architectureNames[draft.architecture])}</span><strong class="site-domain">${escapeHtml(sourceHost(state.sourceOrigin))}</strong></div>
    <form id="site-form" novalidate>
      <section class="panel form-section"><div class="section-heading"><h2>站点信息</h2></div>
        <div class="field-grid">${architectureSelect(draft, errors)}
        ${regularField('site-name', '站点名称', draft.name, 'name', { error: errors.name })}
        ${regularField('site-address', '站点地址', draft.address, 'address', { error: errors.address })}
        ${regularField('user-agent', 'User-Agent', draft.userAgent ?? '', 'userAgent', { error: errors.userAgent })}
        <div class="check-field ua-import-toggle"><input id="import-user-agent" data-field="importUserAgent" type="checkbox" ${draft.importUserAgent ? 'checked' : ''}><label for="import-user-agent">导入 User-Agent</label></div></div>
      </section>
      <section class="panel form-section sensitive-panel"><div class="section-heading"><h2>登录信息</h2>${icon('lock')}</div>
        ${credentialField('cookie', cookieLabel, draft.cookie, 'cookie', state)}
        ${tokenField}
        ${passkeyField}
      </section>
      <section class="panel form-section pages-panel"><div class="section-heading"><h2>页面</h2></div>
        <div class="page-list">${pageRows(draft)}</div>
        ${errorFor(errors, 'pages')}
        <div class="page-actions">
          <button class="add-page add-current-page" type="button" data-action="add-current-page">${icon('plus')}添加当前页面</button>
          <button class="add-page" type="button" data-action="add-manual-page">${icon('plus')}手动添加页面</button>
        </div>
      </section>
      <details class="panel advanced"><summary><span>高级设置</span>${icon('chevron')}</summary>
        <div class="advanced-body">
          ${regularField('tags', '站点标签', draft.tags ?? '', 'tags', { placeholder: '多个标签用英文逗号分隔' })}
          ${regularField('download-tags', '下载器标签', draft.downloadTags ?? '', 'downloadTags', { placeholder: '多个标签用英文逗号分隔' })}
          ${regularField('widget', '权重', draft.widget, 'widget', { type: 'number', error: errors.widget })}
          <div class="check-field"><input id="search" data-field="search" type="checkbox" ${draft.search ? 'checked' : ''}><label for="search">参与聚合搜索</label></div>
        </div>
      </details>
      ${errors.payload ? `<p class="payload-error" data-payload-error role="alert">${escapeHtml(errors.payload)}</p>` : ''}
      <div class="action-dock"><button type="button" class="primary" data-action="generate" ${invalid ? 'disabled' : ''}>生成二维码${icon('arrow')}</button></div>
    </form>
  </div>`;
}

function homeView(): string {
  return `<div class="shell home-shell">
    <section class="home-brand" data-home-brand data-home-section="brand">
      <span class="home-brand-mark" aria-hidden="true">P</span>
      <h1>Pocket Qt</h1>
      <p>站点导入插件 <strong>v${escapeHtml(extensionVersion())}</strong></p>
    </section>
    <nav class="resource-links" data-home-section="links" aria-label="项目相关链接">
      <a data-home-link="update" href="${UPDATE_URL}" target="_blank" rel="noreferrer">插件更新${icon('external')}</a>
      <a data-home-link="project" href="${PROJECT_URL}" target="_blank" rel="noreferrer">项目地址${icon('external')}</a>
      <a data-home-link="license" href="${LICENSE_URL}" target="_blank" rel="noreferrer">授权管理${icon('external')}</a>
    </nav>
    <section class="home-card home-guide" data-home-guide data-home-section="guide">
      <h2>使用方法</h2>
      <ol class="guide-list">
        <li><span>1</span><strong>打开并登录 PT 站点，停留在种子列表页面</strong></li>
        <li><span>2</span><strong>点击开始读取站点数据</strong></li>
        <li><span>3</span><strong>手动修改补充站点信息</strong></li>
        <li><span>4</span><strong>生成二维码，使用 Pocket Qt 扫码添加站点</strong></li>
      </ol>
    </section>
    <section class="home-card security-card" data-home-security data-home-section="security">
      <span class="security-icon">${icon('shield')}</span>
      <div><h2>数据安全</h2><p>所有数据仅在本机处理，不上传、不保存。二维码包含登录凭据，请勿分享。</p></div>
    </section>
    <div class="home-action" data-home-section="action"><button class="primary home-read" type="button" data-action="read">读取站点数据${icon('arrow')}</button></div>
  </div>`;
}

function renderStatic(root: HTMLElement, state: Exclude<PopupState, { kind: 'ready' }>): void {
  if (state.kind === 'idle') {
    root.innerHTML = homeView();
  } else if (state.kind === 'loading') {
    root.innerHTML = `<div class="shell state-shell" aria-live="polite">${appHeader({ title: PLUGIN_NAME, detail: `v${extensionVersion()}` })}<section class="state-card"><div class="loading-ring" aria-hidden="true"></div><h1>正在读取</h1><p>${escapeHtml(state.message)}</p></section></div>`;
  } else if (state.kind === 'permission') {
    root.innerHTML = `<div class="shell state-shell">${appHeader({ title: PLUGIN_NAME, detail: `v${extensionVersion()}` })}<section class="state-card"><span class="state-icon">${icon('lock')}</span><h1>需要站点权限</h1><p>${escapeHtml(state.origin)}</p><button class="primary" type="button" data-action="permission">允许读取本站${icon('arrow')}</button></section></div>`;
  } else if (state.kind === 'unsupported') {
    root.innerHTML = `<div class="shell state-shell">${appHeader({ title: PLUGIN_NAME, detail: `v${extensionVersion()}` })}<section class="state-card"><span class="state-icon state-icon-muted">${architectureNames[state.detection.id].slice(0, 1)}</span><span class="status-badge">暂不支持</span><h1>${architectureNames[state.detection.id]}</h1><button class="secondary" type="button" data-action="retry">重新识别</button></section></div>`;
  } else if (state.kind === 'error') {
    root.innerHTML = `<div class="shell state-shell">${appHeader({ title: PLUGIN_NAME, detail: `v${extensionVersion()}` })}<section class="state-card"><span class="state-icon state-icon-error">!</span><h1>未能读取站点</h1><button class="primary" type="button" data-action="retry">重试</button></section></div>`;
  } else {
    root.innerHTML = `<div class="shell qr-shell">${appHeader({ title: PLUGIN_NAME, detail: `v${extensionVersion()}`, action: `<button type="button" class="header-action" data-action="refresh">${icon('refresh')}<span>刷新</span></button>` })}<section class="qr-card"><div class="qr-frame"><canvas id="qr-canvas" aria-label="Pocket Qt 站点导入二维码"></canvas></div><dl class="qr-site-info" data-qr-site-info><div><dt>架构</dt><dd>${escapeHtml(architectureNames[state.draft.architecture])}</dd></div><div><dt>站点名称</dt><dd>${escapeHtml(state.draft.name)}</dd></div><div><dt>地址</dt><dd title="${escapeHtml(state.draft.address)}">${escapeHtml(state.draft.address)}</dd></div></dl></section><aside class="danger-note">${icon('shield')}<p>二维码包含当前站点登录凭据，请勿截图或分享。</p></aside><aside class="scan-note" role="note">如果扫码失败，请拖拽放大二维码或全屏显示。</aside><div class="qr-actions"><button class="primary" type="button" data-action="fullscreen">全屏显示</button><button class="secondary" type="button" data-action="back">返回修改</button></div></div>`;
  }
}

export function renderPopup(root: HTMLElement, state: PopupState, actions: PopupActions): void {
  if (state.kind !== 'ready') renderStatic(root, state);
  else root.innerHTML = readyView(state);

  root.querySelector<HTMLElement>('[data-action="permission"]')?.addEventListener('click', actions.onRequestPermission);
  root.querySelector<HTMLElement>('[data-action="retry"]')?.addEventListener('click', actions.onRetry);
  root.querySelector<HTMLElement>('[data-action="generate"]')?.addEventListener('click', actions.onGenerate);
  root.querySelector<HTMLElement>('[data-action="fullscreen"]')?.addEventListener('click', actions.onFullscreen);
  root.querySelector<HTMLElement>('[data-action="back"]')?.addEventListener('click', actions.onBack);
  root.querySelector<HTMLElement>('[data-action="add-current-page"]')?.addEventListener('click', actions.onPageAddCurrent);
  root.querySelector<HTMLElement>('[data-action="add-manual-page"]')?.addEventListener('click', actions.onPageAddManual);
  root.querySelector<HTMLElement>('[data-action="read"]')?.addEventListener('click', actions.onRead);
  root.querySelector<HTMLElement>('[data-action="refresh"]')?.addEventListener('click', actions.onRefresh);

  const architectureTrigger = root.querySelector<HTMLButtonElement>('[data-architecture-trigger]');
  const architectureMenu = root.querySelector<HTMLElement>('[data-architecture-menu]');
  const closeArchitectureMenu = () => {
    if (!architectureMenu || !architectureTrigger) return;
    architectureMenu.hidden = true;
    architectureTrigger.setAttribute('aria-expanded', 'false');
  };
  architectureTrigger?.addEventListener('click', () => {
    if (!architectureMenu) return;
    architectureMenu.hidden = !architectureMenu.hidden;
    architectureTrigger.setAttribute('aria-expanded', String(!architectureMenu.hidden));
  });
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-architecture-option]')) {
    button.addEventListener('click', () => {
      closeArchitectureMenu();
      actions.onArchitectureChange(button.dataset.architectureOption as ArchitectureId);
    });
  }
  for (const input of root.querySelectorAll<HTMLInputElement>('[data-field]')) {
    input.addEventListener('change', () => {
      const keepAdvancedOpen = Boolean(input.closest<HTMLDetailsElement>('details.advanced')?.open);
      const field = input.dataset.field ?? '';
      const value = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value;
      actions.onFieldChange(field, value);
      if (keepAdvancedOpen) {
        const advanced = root.querySelector<HTMLDetailsElement>('details.advanced');
        if (advanced) advanced.open = true;
      }
    });
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-reveal]')) {
    button.addEventListener('click', () => {
      const field = button.dataset.reveal ?? '';
      const input = root.querySelector<HTMLInputElement>(`[data-field="${field}"]`);
      if (input) input.type = input.type === 'password' ? 'text' : 'password';
      button.textContent = input?.type === 'text' ? '隐藏' : '显示';
      actions.onToggleCredential(field);
    });
  }
  for (const input of root.querySelectorAll<HTMLInputElement>('[data-page-field]')) {
    input.addEventListener('change', () => actions.onPageChange(Number(input.dataset.pageIndex), input.dataset.pageField as 'name' | 'path', input.value));
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-page-remove]')) {
    button.addEventListener('click', () => actions.onPageRemove(Number(button.dataset.pageRemove)));
  }
}

export function popupStateFromCollection(result: CollectionResult, sourceOrigin?: string): PopupState {
  if (result.state === 'permission-required') return { kind: 'permission', origin: result.origin };
  if (result.state === 'unsupported') return { kind: 'unsupported', detection: result.detection };
  if (result.state === 'error') return { kind: 'error', message: result.message };
  return { kind: 'ready', draft: result.draft, errors: {}, revealed: new Set(), sourceOrigin };
}
