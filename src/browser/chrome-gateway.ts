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
  const cookies = await chrome.cookies.getAll(storeId ? { url, storeId } : { url });
  return cookies.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
  }));
}
