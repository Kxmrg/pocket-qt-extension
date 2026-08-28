import type { CollectionResult } from '../application/collect-site';
import type { SiteDraft } from '../domain/adapt-site';
import type { EncodedPayload } from '../domain/payload';
import type { ArchitectureId, DetectionResult } from '../domain/types';

export type PopupState =
  | { kind: 'loading'; message: string }
  | { kind: 'permission'; origin: string }
  | { kind: 'unsupported'; detection: DetectionResult }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; draft: SiteDraft; errors: Record<string, string>; revealed: Set<string> }
  | { kind: 'qr'; draft: SiteDraft; payload: EncodedPayload; enlarged: boolean };

export interface PopupActions {
  onRequestPermission: () => void;
  onRetry: () => void;
  onArchitectureChange: (architecture: ArchitectureId) => void;
  onFieldChange: (field: string, value: string | number | boolean | null) => void;
  onToggleCredential: (field: string) => void;
  onPageToggle: (index: number, selected: boolean) => void;
  onPageChange: (index: number, field: 'name' | 'path' | 'tags', value: string) => void;
  onPageRemove: (index: number) => void;
  onPageAdd: () => void;
  onGenerate: () => void;
  onBack: () => void;
  onEnlarge: () => void;
}

const architectureNames: Record<ArchitectureId, string> = {
  nexusphp: 'NexusPHP',
  tnode: 'TNode · 朱雀',
  mtorrent: 'mTorrent · M-Team',
  haidan: 'HaiDanPt',
  gazelle: 'Gazelle',
  unit3d: 'UNIT3D',
  unknown: '未知架构',
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function header(eyebrow: string, title: string, detail = ''): string {
  return `<header class="masthead">
    <div class="brand-mark" aria-hidden="true"><span>P</span></div>
    <div class="masthead-copy"><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1>${detail ? `<p>${escapeHtml(detail)}</p>` : ''}</div>
  </header>`;
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
  const supported: ArchitectureId[] = ['nexusphp', 'tnode', 'mtorrent', 'haidan'];
  const options = [
    ...(draft.architecture === 'unknown' ? ['unknown' as const] : []),
    ...supported,
  ].map((id) => `<option value="${id}" ${draft.architecture === id ? 'selected' : ''}>${escapeHtml(architectureNames[id])}</option>`).join('');
  return `<div class="field ${errors.architecture ? 'has-error' : ''}">
    <label for="architecture">站点架构</label>
    <select id="architecture" data-architecture>${options}</select>
    ${errorFor(errors, 'architecture')}
  </div>`;
}

function pageRows(draft: SiteDraft): string {
  return draft.pages.map((page, index) => `<article class="page-row">
    <div class="page-select">
      <input id="page-selected-${index}" data-page-selected="${index}" type="checkbox" ${page.selected ? 'checked' : ''}>
      <label for="page-selected-${index}">导入页面 ${index + 1}</label>
    </div>
    <div class="page-grid">
      <div class="field compact"><label for="page-name-${index}">页面名称</label><input id="page-name-${index}" data-page-field="name" data-page-index="${index}" value="${escapeHtml(page.name)}"></div>
      <div class="field compact path"><label for="page-path-${index}">页面路径</label><input id="page-path-${index}" data-page-field="path" data-page-index="${index}" value="${escapeHtml(page.path)}" spellcheck="false"></div>
      <button type="button" class="remove-page" data-page-remove="${index}" aria-label="删除页面 ${index + 1}">删除</button>
      <div class="field compact page-tags"><label for="page-tags-${index}">页面标签（可选）</label><input id="page-tags-${index}" data-page-field="tags" data-page-index="${index}" value="${escapeHtml(page.tags ?? '')}" placeholder="多个标签用英文逗号分隔"></div>
    </div>
  </article>`).join('');
}

function readyView(state: Extract<PopupState, { kind: 'ready' }>): string {
  const { draft, errors } = state;
  const tokenLabel = draft.architecture === 'tnode' ? 'X-Csrf-Token' : draft.architecture === 'mtorrent' ? 'Access Token' : draft.architecture === 'haidan' ? 'UID' : 'Token（可选）';
  const cookieLabel = draft.architecture === 'mtorrent' ? 'UID' : 'Cookie';
  const invalid = Object.keys(errors).length > 0;
  return `<div class="shell ready-shell">
    ${header('SITE TRANSFER / 01', draft.name || '检查站点配置', `${architectureNames[draft.architecture]} · 本地处理`)}
    <form id="site-form" novalidate>
      <section class="panel"><div class="section-heading"><span>01</span><div><h2>基础信息</h2><p>确认识别结果和请求身份</p></div></div>
        <div class="field-grid">${architectureSelect(draft, errors)}
        ${regularField('site-name', '站点名称', draft.name, 'name', { error: errors.name })}
        ${regularField('site-address', '站点地址', draft.address, 'address', { error: errors.address })}
        ${regularField('user-agent', 'User-Agent', draft.userAgent ?? '', 'userAgent', { error: errors.userAgent })}</div>
      </section>
      <section class="panel sensitive-panel"><div class="section-heading"><span>02</span><div><h2>登录信息</h2><p>仅保留在当前弹窗内存中</p></div></div>
        ${credentialField('cookie', cookieLabel, draft.cookie, 'cookie', state)}
        ${credentialField('token', tokenLabel, draft.token, 'token', state)}
        ${credentialField('passkey', 'Passkey（可选）', draft.passkey, 'passkey', state)}
      </section>
      <section class="panel pages-panel"><div class="section-heading"><span>03</span><div><h2>种子页面</h2><p>已识别 ${draft.pages.length} 个，默认全部导入</p></div></div>
        <div class="page-list">${pageRows(draft)}</div>
        ${errorFor(errors, 'pages')}
        <button class="secondary full" type="button" data-action="add-page">＋ 新增页面</button>
      </section>
      <details class="panel advanced"><summary>高级设置 <span>标签、权重与聚合搜索</span></summary>
        <div class="advanced-body">
          ${regularField('tags', '站点标签', draft.tags ?? '', 'tags', { placeholder: '多个标签用英文逗号分隔' })}
          ${regularField('download-tags', '下载器标签', draft.downloadTags ?? '', 'downloadTags')}
          ${regularField('widget', '权重', draft.widget, 'widget', { type: 'number', error: errors.widget })}
          <div class="check-field"><input id="search" data-field="search" type="checkbox" ${draft.search ? 'checked' : ''}><label for="search">参与聚合搜索</label></div>
        </div>
      </details>
      <aside class="security-note"><strong>LOCAL ONLY</strong><p>配置不会上传或保存。生成的二维码包含登录凭据，请勿分享。</p></aside>
      ${errors.payload ? `<p class="payload-error" data-payload-error role="alert">${escapeHtml(errors.payload)}</p>` : ''}
      <div class="action-dock"><button type="button" class="primary" data-action="generate" ${invalid ? 'disabled' : ''}>生成二维码 <span>→</span></button></div>
    </form>
  </div>`;
}

function renderStatic(root: HTMLElement, state: Exclude<PopupState, { kind: 'ready' }>): void {
  if (state.kind === 'loading') {
    root.innerHTML = `<div class="shell state-shell" aria-live="polite">${header('SITE TRANSFER', '正在读取站点')}<div class="scanner"><i></i></div><p>${escapeHtml(state.message)}</p></div>`;
  } else if (state.kind === 'permission') {
    root.innerHTML = `<div class="shell state-shell">${header('PERMISSION / ONCE', '允许读取当前站点', state.origin)}<div class="permission-card"><p>需要读取当前站点页面和完整 Cookie，才能生成手机端配置。权限仅授予此域名。</p><button class="primary" type="button" data-action="permission">允许读取本站 <span>→</span></button></div></div>`;
  } else if (state.kind === 'unsupported') {
    root.innerHTML = `<div class="shell state-shell">${header('ARCHITECTURE', architectureNames[state.detection.id])}<div class="unsupported-mark">暂不支持</div><p>Pocket PT 当前还不能导入此架构。</p><ul class="reason-list">${state.detection.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul><button class="secondary" type="button" data-action="retry">重新识别</button></div>`;
  } else if (state.kind === 'error') {
    root.innerHTML = `<div class="shell state-shell">${header('COLLECTION ERROR', '未能读取站点')}<p role="alert">${escapeHtml(state.message)}</p><button class="primary" type="button" data-action="retry">重试</button></div>`;
  } else {
    root.innerHTML = `<div class="shell qr-shell ${state.enlarged ? 'is-enlarged' : ''}">${header('SITE TRANSFER / 02', '扫码导入', `${state.draft.name} · ${architectureNames[state.draft.architecture]}`)}<div class="qr-frame"><canvas id="qr-canvas" aria-label="Pocket PT 站点导入二维码"></canvas><span class="corner top-left"></span><span class="corner bottom-right"></span></div><div class="payload-meta"><span>压缩数据</span><strong>${state.payload.compressedBytes} B</strong></div><aside class="danger-note"><strong>敏感凭据</strong><p>二维码包含当前站点登录凭据，请勿截图或分享。</p></aside><div class="qr-actions"><button class="secondary" type="button" data-action="back">← 返回修改</button><button class="primary" type="button" data-action="enlarge">${state.enlarged ? '恢复大小' : '放大二维码'}</button></div></div>`;
  }
}

export function renderPopup(root: HTMLElement, state: PopupState, actions: PopupActions): void {
  if (state.kind !== 'ready') renderStatic(root, state);
  else root.innerHTML = readyView(state);

  root.querySelector<HTMLElement>('[data-action="permission"]')?.addEventListener('click', actions.onRequestPermission);
  root.querySelector<HTMLElement>('[data-action="retry"]')?.addEventListener('click', actions.onRetry);
  root.querySelector<HTMLElement>('[data-action="generate"]')?.addEventListener('click', actions.onGenerate);
  root.querySelector<HTMLElement>('[data-action="back"]')?.addEventListener('click', actions.onBack);
  root.querySelector<HTMLElement>('[data-action="enlarge"]')?.addEventListener('click', actions.onEnlarge);
  root.querySelector<HTMLElement>('[data-action="add-page"]')?.addEventListener('click', actions.onPageAdd);

  root.querySelector<HTMLSelectElement>('[data-architecture]')?.addEventListener('change', (event) => {
    actions.onArchitectureChange((event.currentTarget as HTMLSelectElement).value as ArchitectureId);
  });
  for (const input of root.querySelectorAll<HTMLInputElement>('[data-field]')) {
    input.addEventListener('change', () => {
      const field = input.dataset.field ?? '';
      const value = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value;
      actions.onFieldChange(field, value);
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
  for (const checkbox of root.querySelectorAll<HTMLInputElement>('[data-page-selected]')) {
    checkbox.addEventListener('change', () => actions.onPageToggle(Number(checkbox.dataset.pageSelected), checkbox.checked));
  }
  for (const input of root.querySelectorAll<HTMLInputElement>('[data-page-field]')) {
    input.addEventListener('change', () => actions.onPageChange(Number(input.dataset.pageIndex), input.dataset.pageField as 'name' | 'path' | 'tags', input.value));
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-page-remove]')) {
    button.addEventListener('click', () => actions.onPageRemove(Number(button.dataset.pageRemove)));
  }
}

export function popupStateFromCollection(result: CollectionResult): PopupState {
  if (result.state === 'permission-required') return { kind: 'permission', origin: result.origin };
  if (result.state === 'unsupported') return { kind: 'unsupported', detection: result.detection };
  if (result.state === 'error') return { kind: 'error', message: result.message };
  return { kind: 'ready', draft: result.draft, errors: {}, revealed: new Set() };
}
