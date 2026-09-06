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

  const hasRowLinks = (selectors: string[]) => Array.from(document.querySelectorAll('tr')).some(
    (row) => selectors.every((selector) => row.querySelector(selector)),
  );
  const normalizedText = (element: Element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  const unit3dTables = Array.from(document.querySelectorAll('table')).filter((table) => {
    const headers = Array.from(table.querySelectorAll('thead th, thead td')).map(normalizedText);
    const hasHeader = (aliases: string[]) => headers.some((header) => aliases.some((alias) => header.includes(alias)));
    return hasHeader(['name', '名称', '标题']) && hasHeader(['size', '体积', '大小']) &&
      hasHeader(['seeders', '做种']) && hasHeader(['leechers', '吸血鬼', '下载中']) &&
      hasHeader(['completed', '完成']);
  });
  const hasUnit3dRow = unit3dTables.some((table) => Array.from(table.querySelectorAll('tbody tr, tr')).some((row) => {
    const rowLinks = Array.from(row.querySelectorAll<HTMLAnchorElement>('a[href]'));
    const paths = rowLinks.map((link) => {
      try { return new URL(link.href, current.href).pathname.toLowerCase(); } catch { return ''; }
    });
    const hasDetail = paths.some((path) => path.includes('/torrents/') && !path.includes('/download'));
    const hasDownload = paths.some((path) => path.includes('/torrents/') && path.includes('/download'));
    const hasUploader = paths.some((path) => path.includes('/users/')) || /anonymous|匿名/i.test(row.textContent ?? '');
    return hasDetail && hasDownload && hasUploader;
  }));
  const hasUnit3dFooter = Array.from(document.querySelectorAll('footer a[href], a[href]')).some((link) => {
    const value = `${link.textContent ?? ''} ${link.getAttribute('href') ?? ''}`.toLowerCase();
    return /unit3d-(?:rs|announce)|hdinnovations\/unit3d/.test(value);
  });
  const domMarkers = [
    document.querySelector('body#torrents') && 'body#torrents',
    document.querySelector('#torrent_table.torrent_table.grouping') && 'gazelle-grouping-table',
    document.querySelector('.group') && 'gazelle-group-row',
    document.querySelector('.edition') && 'gazelle-edition-row',
    document.querySelector('.group_torrent') && 'gazelle-torrent-row',
    document.querySelector('.TorrentCover, .TorrentCover-item') && 'gazellepw-cover-wall',
    document.querySelector('[name="resolution"], [name="codec"], [name="container"]') && 'gazellepw-movie-filters',
    document.querySelector('a[href*="movies.php"]') &&
      document.querySelector('a[href*="collages.php"]') && 'ptp-movie-routes',
    document.querySelector('table.torrent_table a[href*="torrents.php?id="]') && 'ptp-group-table',
    document.querySelector('a[href*="series.php?id="]') && 'btn-series-links',
    hasRowLinks([
      'a[href*="torrents.php?id="]',
      'a[href*="torrents.php?action=download"]',
      'a[href*="reports.php?action=report"]',
    ]) && 'btn-torrent-actions',
    unit3dTables.length > 0 && 'unit3d-torrent-table',
    hasUnit3dRow && 'unit3d-torrent-row',
    hasUnit3dFooter && 'unit3d-footer',
  ].filter((value): value is string => Boolean(value));

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
  try {
    readStorage('local', window.localStorage);
  } catch {
    // Accessing the Storage object itself can throw on privacy-restricted pages.
  }
  try {
    readStorage('session', window.sessionStorage);
  } catch {
    // Accessing the Storage object itself can throw on privacy-restricted pages.
  }

  let documentCookie = '';
  try {
    documentCookie = document.cookie;
  } catch {
    // Chrome's Cookie API remains the primary source when page access is blocked.
  }

  const candidates: PageSnapshot['candidates'] = [];
  const currentUserProfile = document.querySelector<HTMLAnchorElement>('.userinfo a[href*="userdetails.php"]');
  if (currentUserProfile) {
    try {
      const profileUrl = new URL(currentUserProfile.href, current.href);
      const uid = profileUrl.pathname.toLowerCase().endsWith('/userdetails.php')
        ? profileUrl.searchParams.get('id')
        : null;
      if (uid) candidates.push({ key: 'uid', value: limit(uid), source: 'current-user-profile' });
    } catch {
      // Ignore malformed profile links and continue collecting other signals.
    }
  }
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
    documentCookie,
    meta,
    resources,
    links,
    domMarkers,
    textSample: limit((document.body?.textContent ?? '').replace(/\s+/g, ' ').trim(), maxText),
    storage,
    candidates,
  };
}
