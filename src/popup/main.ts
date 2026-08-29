import QRCode from 'qrcode';
import { collectSiteDraft } from '../application/collect-site';
import type { SiteDraft } from '../domain/adapt-site';
import { encodeImportPayload } from '../domain/payload';
import { createManualPage, draftPageFromSnapshot } from '../domain/torrent-pages';
import type { ArchitectureId } from '../domain/types';
import { validateDraft } from '../domain/validate-draft';
import {
  getActivePageContext,
  readCookies,
  readPageSnapshot,
  requestCurrentOrigin,
  type ActivePageContext,
} from '../browser/chrome-gateway';
import { popupStateFromCollection, renderPopup, type PopupActions, type PopupState } from './render';
import './styles.css';

const rootElement = document.querySelector<HTMLElement>('#app');
if (!rootElement) throw new Error('Popup root is missing');
const root: HTMLElement = rootElement;

let state: PopupState = { kind: 'idle' };
let activeContext: ActivePageContext | null = null;

const schemeByArchitecture: Record<string, 0 | 1 | 2 | 3> = {
  nexusphp: 0,
  tnode: 1,
  mtorrent: 2,
  haidan: 3,
};

function readyState(draft: SiteDraft, revealed = new Set<string>(), sourceOrigin = activeContext?.origin): PopupState {
  return { kind: 'ready', draft, errors: validateDraft(draft).errors, revealed, sourceOrigin };
}

async function drawQr(): Promise<void> {
  if (state.kind !== 'qr') return;
  const canvas = root.querySelector<HTMLCanvasElement>('#qr-canvas');
  if (!canvas) return;
  await QRCode.toCanvas(canvas, state.payload.text, {
    width: state.enlarged ? 520 : 280,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#102a2b', light: '#fffdf6' },
  });
}

function paint(next: PopupState): void {
  state = next;
  renderPopup(root, state, actions);
  void drawQr();
}

function currentReady(): Extract<PopupState, { kind: 'ready' }> | null {
  return state.kind === 'ready' ? state : null;
}

function updateDraft(transform: (draft: SiteDraft) => SiteDraft): void {
  const ready = currentReady();
  if (!ready) return;
  paint(readyState(transform(ready.draft), ready.revealed, ready.sourceOrigin));
}

async function loadSite(): Promise<void> {
  paint({ kind: 'loading', message: '正在识别架构并收集配置…' });
  try {
    activeContext = await getActivePageContext();
    const context = activeContext;
    const result = await collectSiteDraft({
      getContext: async () => context,
      readSnapshot: async () => readPageSnapshot(context.tabId),
      readCookies,
    });
    const next = popupStateFromCollection(result, context.origin);
    paint(next.kind === 'ready' ? readyState(next.draft) : next);
  } catch (error) {
    paint({ kind: 'error', message: error instanceof Error ? error.message : '读取当前站点失败，请重试' });
  }
}

const actions: PopupActions = {
  onRead: () => { void loadSite(); },
  onRefresh: () => { void loadSite(); },
  onRequestPermission: () => {
    if (state.kind !== 'permission') return;
    void requestCurrentOrigin(state.origin).then((granted) => {
      if (granted) void loadSite();
      else paint({ kind: 'error', message: '未授予当前站点权限，无法读取完整 Cookie' });
    });
  },
  onRetry: () => { void loadSite(); },
  onArchitectureChange: (architecture: ArchitectureId) => {
    updateDraft((draft) => {
      const pages = draft.pages.length > 0 ? draft.pages : [{
        ...createManualPage(architecture), name: '综合',
      }];
      return {
        ...draft,
        architecture,
        scheme: schemeByArchitecture[architecture] ?? null,
        token: architecture === 'nexusphp' ? null : draft.token,
        pages,
        fieldWarnings: {},
      };
    });
  },
  onFieldChange: (field, value) => {
    updateDraft((draft) => {
      switch (field) {
        case 'name': return { ...draft, name: String(value) };
        case 'address': return { ...draft, address: String(value) };
        case 'cookie': return { ...draft, cookie: String(value), fieldWarnings: { ...draft.fieldWarnings, cookie: '' } };
        case 'token': return { ...draft, token: String(value) || null, fieldWarnings: { ...draft.fieldWarnings, token: '' } };
        case 'passkey': return { ...draft, passkey: String(value) || null, fieldWarnings: { ...draft.fieldWarnings, passkey: '' } };
        case 'userAgent': return { ...draft, userAgent: String(value) || null };
        case 'tags': return { ...draft, tags: String(value) || null };
        case 'downloadTags': return { ...draft, downloadTags: String(value) || null };
        case 'widget': return { ...draft, widget: Number(value) };
        case 'search': return { ...draft, search: Boolean(value) };
        default: return draft;
      }
    });
  },
  onToggleCredential: (field) => {
    const ready = currentReady();
    if (!ready) return;
    const revealed = new Set(ready.revealed);
    if (revealed.has(field)) revealed.delete(field); else revealed.add(field);
    paint({ ...ready, revealed });
  },
  onPageChange: (index, field, value) => {
    updateDraft((draft) => ({ ...draft, pages: draft.pages.map((page, pageIndex) => pageIndex === index ? { ...page, [field]: value } : page) }));
  },
  onPageRemove: (index) => {
    updateDraft((draft) => ({ ...draft, pages: draft.pages.filter((_, pageIndex) => pageIndex !== index) }));
  },
  onPageAddCurrent: () => {
    void (async () => {
      try {
        const context = await getActivePageContext();
        const page = draftPageFromSnapshot(await readPageSnapshot(context.tabId), '');
        if (!page) throw new Error('未能读取当前页面地址');
        updateDraft((draft) => ({ ...draft, pages: [...draft.pages, page] }));
      } catch (error) {
        const ready = currentReady();
        if (!ready) return;
        paint({ ...ready, errors: { ...ready.errors, pages: error instanceof Error ? error.message : '未能读取当前页面' } });
      }
    })();
  },
  onPageAddManual: () => {
    updateDraft((draft) => ({ ...draft, pages: [...draft.pages, createManualPage(draft.architecture)] }));
  },
  onGenerate: () => {
    const ready = currentReady();
    if (!ready) return;
    const validation = validateDraft(ready.draft);
    if (!validation.valid) {
      paint({ ...ready, errors: validation.errors });
      return;
    }
    try {
      paint({ kind: 'qr', draft: ready.draft, payload: encodeImportPayload(ready.draft), enlarged: false });
    } catch (error) {
      paint({ ...ready, errors: { payload: error instanceof Error ? error.message : '二维码生成失败' } });
    }
  },
  onBack: () => {
    if (state.kind === 'qr') paint(readyState(state.draft));
  },
  onEnlarge: () => {
    if (state.kind === 'qr') paint({ ...state, enlarged: !state.enlarged });
  },
};

paint(state);
