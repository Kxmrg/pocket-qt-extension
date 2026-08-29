export interface CookieLike {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
}

export interface CookiePair {
  name: string;
  value: string;
}

function domainMatches(host: string, domain: string): boolean {
  const normalized = domain.toLowerCase().replace(/^\./, '');
  return host === normalized || host.endsWith(`.${normalized}`);
}

function pathMatches(requestPath: string, cookiePath: string): boolean {
  if (cookiePath === '/') return true;
  if (!requestPath.startsWith(cookiePath)) return false;
  return cookiePath.endsWith('/') || requestPath.length === cookiePath.length || requestPath[cookiePath.length] === '/';
}

export function formatCookieHeader(cookies: CookieLike[], pageUrl: string): string {
  const url = new URL(pageUrl);
  return cookies
    .map((cookie, index) => ({ cookie, index }))
    .filter(({ cookie }) =>
      domainMatches(url.hostname.toLowerCase(), cookie.domain)
      && pathMatches(url.pathname || '/', cookie.path || '/')
      && (!cookie.secure || url.protocol === 'https:'))
    .sort((a, b) => b.cookie.path.length - a.cookie.path.length || a.index - b.index)
    .map(({ cookie }) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

export function parseCookieHeader(header: string): CookiePair[] {
  return header.split(';').flatMap((part) => {
    const separator = part.indexOf('=');
    if (separator <= 0) return [];
    const name = part.slice(0, separator).trim();
    if (!name) return [];
    return [{ name, value: part.slice(separator + 1).trim() }];
  });
}

export function mergeCookieHeaders(primary: string, fallback: string): string {
  const primaryPairs = parseCookieHeader(primary);
  const primaryNames = new Set(primaryPairs.map((pair) => pair.name));
  const missingFallbackPairs = parseCookieHeader(fallback)
    .filter((pair) => !primaryNames.has(pair.name));
  return [...primaryPairs, ...missingFallbackPairs]
    .map((pair) => `${pair.name}=${pair.value}`)
    .join('; ');
}
