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

export async function getActivePageContext(): Promise<ActivePageContext> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) throw new Error('未找到当前页面，请重新打开站点后重试');
  const pattern = toOriginPattern(tab.url);
  const hasPermission = await chrome.permissions.contains({ origins: [pattern] });
  return { tabId: tab.id, url: tab.url, origin: new URL(tab.url).origin, hasPermission };
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

export async function readCookies(url: string): Promise<CookieLike[]> {
  const cookies = await chrome.cookies.getAll({ url });
  return cookies.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
  }));
}
