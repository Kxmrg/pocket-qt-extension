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
  try {
    const context = await deps.getContext();
    if (!context.hasPermission) return { state: 'permission-required', origin: context.origin };
    const [snapshot, cookies] = await Promise.all([
      deps.readSnapshot(),
      deps.readCookies(context.url, context.tabId),
    ]);
    const detection = detectArchitecture(snapshot);
    if (detection.id === 'gazelle' || detection.id === 'unit3d') {
      return { state: 'unsupported', detection };
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
    return {
      state: 'ready',
      detection,
      draft: adaptSite({ detection, snapshot: snapshotWithCookieCandidates, cookieHeader }),
    };
  } catch {
    return { state: 'error', message: '读取当前站点失败，请刷新页面后重试' };
  }
}
