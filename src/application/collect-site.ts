import { adaptSite, type SiteDraft } from '../domain/adapt-site';
import {
  formatCookieHeader,
  mergeCookieHeaders,
  parseCookieHeader,
  type CookieLike,
} from '../domain/cookies';
import { detectArchitecture } from '../domain/detect-architecture';
import type { DetectionResult, PageSnapshot } from '../domain/types';

export interface CollectionContext {
  tabId?: number;
  url: string;
  origin: string;
  hasPermission: boolean;
}

export interface CollectionDeps {
  getContext: () => Promise<CollectionContext>;
  readSnapshot: () => Promise<PageSnapshot>;
  readCookies: (url: string, tabId?: number) => Promise<CookieLike[]>;
}

export type CollectionResult =
  | { state: 'permission-required'; origin: string }
  | { state: 'unsupported'; detection: DetectionResult }
  | { state: 'ready'; detection: DetectionResult; draft: SiteDraft }
  | { state: 'error'; message: string };

export async function collectSiteDraft(deps: CollectionDeps): Promise<CollectionResult> {
  let context: CollectionContext;
  try {
    context = await deps.getContext();
  } catch {
    return { state: 'error', message: '当前标签页读取失败（E_CONTEXT），请切回站点页面后重试' };
  }
  if (!context.hasPermission) return { state: 'permission-required', origin: context.origin };

  let snapshot: PageSnapshot;
  try {
    snapshot = await deps.readSnapshot();
  } catch {
    return { state: 'error', message: '页面数据读取失败（E_PAGE），请刷新站点页面后重试' };
  }

  try {
    const detection = detectArchitecture(snapshot);
    if (detection.id === 'gazelle' || detection.id === 'unit3d') {
      return { state: 'unsupported', detection };
    }
    let cookies: CookieLike[] = [];
    let cookieReadFailed = false;
    try {
      cookies = await deps.readCookies(context.url, context.tabId);
    } catch {
      cookieReadFailed = true;
    }
    const cookieHeader = mergeCookieHeaders(
      formatCookieHeader(cookies, context.url),
      snapshot.documentCookie ?? '',
    );
    const snapshotWithCookieCandidates: PageSnapshot = {
      ...snapshot,
      candidates: [
        ...snapshot.candidates,
        ...parseCookieHeader(cookieHeader)
          .map((cookie) => ({ key: cookie.name, value: cookie.value, source: 'cookie' })),
      ],
    };
    const draft = adaptSite({ detection, snapshot: snapshotWithCookieCandidates, cookieHeader });
    if (detection.id !== 'mtorrent') {
      if (cookieReadFailed) {
        draft.fieldWarnings.cookie = cookieHeader
          ? 'Chrome 完整 Cookie 读取失败，已使用页面可见 Cookie，请确认'
          : 'Chrome 完整 Cookie 读取失败，请手动填写';
      } else if (cookies.length === 0 && cookieHeader) {
        draft.fieldWarnings.cookie = 'Chrome 未返回完整 Cookie，已使用页面可见 Cookie，请确认';
      } else if (!cookieHeader) {
        draft.fieldWarnings.cookie = 'Chrome 和当前页面都未返回 Cookie，请确认已登录并允许读取本站';
      }
    }
    return { state: 'ready', detection, draft };
  } catch {
    return { state: 'error', message: '站点数据解析失败（E_PARSE），请刷新页面后重试' };
  }
}
