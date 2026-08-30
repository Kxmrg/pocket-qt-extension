import type { CookieLike } from '../domain/cookies';
import type { PageSnapshot } from '../domain/types';
import { collectPageSnapshot } from './page-probe';

export interface ActivePageContext {
  tabId: number;
  url: string;
  origin: string;
  hasPermission: boolean;
}

export function toOriginPattern(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('请在普通 HTTP 或 HTTPS 站点中使用');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('请在普通 HTTP 或 HTTPS 站点中使用');
  }
  return `${url.origin}/*`;
}

function grantedPatternCoversUrl(pattern: string, url: URL): boolean {
  if (pattern === '<all_urls>') return true;
  const match = /^(\*|https?):\/\/([^/]+)\//i.exec(pattern);
  if (!match) return false;
  const scheme = match[1];
  const hostPatternValue = match[2];
  if (!scheme || !hostPatternValue) return false;
  if (scheme !== '*' && `${scheme.toLowerCase()}:` !== url.protocol) return false;

  const hostPattern = hostPatternValue.toLowerCase();
  const targetHost = url.host.toLowerCase();
  if (hostPattern === '*') return true;
  if (hostPattern.startsWith('*.')) {
    const baseHost = hostPattern.slice(2);
    const targetHostname = url.hostname.toLowerCase();
    return targetHostname === baseHost || targetHostname.endsWith(`.${baseHost}`);
  }
  return hostPattern === targetHost;
}

export async function getActivePageContext(): Promise<ActivePageContext> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) throw new Error('未找到当前页面，请重新打开站点后重试');
  toOriginPattern(tab.url);
  const url = new URL(tab.url);
  const granted = await chrome.permissions.getAll();
  const hasPermission = (granted.origins ?? []).some((pattern) => grantedPatternCoversUrl(pattern, url));
  return { tabId: tab.id, url: tab.url, origin: url.origin, hasPermission };
}

export async function requestCurrentOrigin(origin: string): Promise<boolean> {
  return chrome.permissions.request({ origins: [toOriginPattern(origin)] });
}

export async function readPageSnapshot(tabId: number): Promise<PageSnapshot> {
  const results = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    func: collectPageSnapshot,
  });
  const snapshot = results[0]?.result as PageSnapshot | undefined;
  if (!snapshot) throw new Error('页面未返回可读取的信息');
  return snapshot;
}

export async function readCookies(url: string, tabId?: number): Promise<CookieLike[]> {
  const selectedTabId = tabId;
  const stores = selectedTabId === undefined ? [] : await chrome.cookies.getAllCookieStores();
  const storeId = selectedTabId === undefined
    ? undefined
    : stores.find((store) => store.tabIds.includes(selectedTabId))?.id;
  const hostname = new URL(url).hostname;
  let partitionKey: chrome.cookies.CookiePartitionKey | undefined;
  if (selectedTabId !== undefined && typeof chrome.cookies.getPartitionKey === 'function') {
    try {
      partitionKey = (await chrome.cookies.getPartitionKey({ tabId: selectedTabId, frameId: 0 })).partitionKey;
    } catch {
      // Ordinary cookies remain readable if Chrome cannot resolve a partition key.
    }
  }
  const queryDetails: chrome.cookies.GetAllDetails[] = [
    storeId ? { url, storeId } : { url },
    storeId ? { domain: hostname, storeId } : { domain: hostname },
  ];
  if (partitionKey) {
    queryDetails.push(
      storeId ? { url, storeId, partitionKey } : { url, partitionKey },
      storeId ? { domain: hostname, storeId, partitionKey } : { domain: hostname, partitionKey },
    );
  }
  const cookieQueries = await Promise.allSettled(queryDetails.map((details) => chrome.cookies.getAll(details)));
  const fulfilledQueries = cookieQueries
    .filter((result): result is PromiseFulfilledResult<chrome.cookies.Cookie[]> => result.status === 'fulfilled');
  if (fulfilledQueries.length === 0) throw new Error('Chrome Cookie API unavailable');

  const uniqueCookies = new Map<string, chrome.cookies.Cookie>();
  for (const result of fulfilledQueries) {
    for (const cookie of result.value) {
      const partition = cookie.partitionKey
        ? `${cookie.partitionKey.topLevelSite ?? ''}\u0000${cookie.partitionKey.hasCrossSiteAncestor ?? ''}`
        : '';
      const key = `${cookie.name}\u0000${cookie.domain}\u0000${cookie.path}\u0000${partition}`;
      if (!uniqueCookies.has(key)) uniqueCookies.set(key, cookie);
    }
  }
  return [...uniqueCookies.values()].map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
  }));
}
