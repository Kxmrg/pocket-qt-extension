import { adaptSite, type SiteDraft } from '../domain/adapt-site';
import { formatCookieHeader, type CookieLike } from '../domain/cookies';
import { detectArchitecture } from '../domain/detect-architecture';
import type { DetectionResult, PageSnapshot } from '../domain/types';

export interface CollectionContext {
  url: string;
  origin: string;
  hasPermission: boolean;
}

export interface CollectionDeps {
  getContext: () => Promise<CollectionContext>;
  readSnapshot: () => Promise<PageSnapshot>;
  readCookies: (url: string) => Promise<CookieLike[]>;
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
      deps.readCookies(context.url),
    ]);
    const detection = detectArchitecture(snapshot);
    if (detection.id === 'gazelle' || detection.id === 'unit3d') {
      return { state: 'unsupported', detection };
    }
    const cookieHeader = formatCookieHeader(cookies, context.url);
    const snapshotWithCookieCandidates: PageSnapshot = {
      ...snapshot,
      candidates: [
        ...snapshot.candidates,
        ...cookies.map((cookie) => ({ key: cookie.name, value: cookie.value, source: 'cookie' })),
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
