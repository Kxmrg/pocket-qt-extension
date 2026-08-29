import type { PageSnapshot } from '../domain/types';

export function collectPageSnapshot(): PageSnapshot {
  const maxText = 20_000;
  const maxLinks = 1_000;
  const maxValue = 4_096;
  const keyPattern = /csrf|token|api.?key|uid|user.?id|member.?id|passkey/i;
  const current = new URL(window.location.href);
  const limit = (value: string, max = maxValue) => value.slice(0, max);

  const meta = Array.from(document.querySelectorAll('meta')).slice(0, 500).map((element) => ({
    name: limit(element.getAttribute('name') ?? '', 200),
    property: limit(element.getAttribute('property') ?? '', 200),
    content: limit(element.getAttribute('content') ?? ''),
  }));

  const resources = Array.from(document.querySelectorAll('script[src], link[href]'))
    .slice(0, 500)
    .map((element) => limit(element.getAttribute('src') ?? element.getAttribute('href') ?? ''))
    .filter(Boolean);

  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .flatMap((element) => {
      try {
        const url = new URL(element.href, current.href);
        if (url.origin !== current.origin) return [];
        return [{ text: limit((element.textContent ?? '').replace(/\s+/g, ' ').trim(), 300), href: limit(url.href) }];
      } catch {
        return [];
      }
    })
    .slice(0, maxLinks);

  const storage: PageSnapshot['storage'] = [];
  const readStorage = (area: 'local' | 'session', store: Storage) => {
    try {
      for (let index = 0; index < store.length && storage.length < 500; index += 1) {
        const key = store.key(index);
        if (!key) continue;
        storage.push({ area, key: limit(key, 300), value: limit(store.getItem(key) ?? '') });
      }
    } catch {
      // Storage may be blocked by the site or browser privacy policy.
    }
  };
  readStorage('local', window.localStorage);
  readStorage('session', window.sessionStorage);

  const candidates: PageSnapshot['candidates'] = [];
  for (const input of Array.from(document.querySelectorAll<HTMLInputElement>('input[name], input[id]')).slice(0, 500)) {
    if (input.type.toLowerCase() === 'password') continue;
    const key = input.name || input.id;
    if (keyPattern.test(key) && input.value) {
      candidates.push({ key: limit(key, 300), value: limit(input.value), source: 'input' });
    }
  }
  for (const element of Array.from(document.querySelectorAll<HTMLElement>('*')).slice(0, 2_000)) {
    for (const attribute of Array.from(element.attributes)) {
      if (candidates.length >= 500) break;
      if (keyPattern.test(attribute.name) && attribute.value && attribute.name !== 'value') {
        candidates.push({ key: limit(attribute.name, 300), value: limit(attribute.value), source: 'attribute' });
      }
    }
    if (candidates.length >= 500) break;
  }

  return {
    url: current.href,
    origin: current.origin,
    host: current.hostname,
    title: limit(document.title, 500),
    userAgent: limit(navigator.userAgent, 1_000),
    documentCookie: document.cookie,
    meta,
    resources,
    links,
    textSample: limit((document.body?.textContent ?? '').replace(/\s+/g, ' ').trim(), maxText),
    storage,
    candidates,
  };
}
