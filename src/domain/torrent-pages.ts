import type { ArchitectureId, PageSnapshot } from './types';

export interface DraftPage {
  name: string;
  path: string;
  tags: string | null;
  selected: boolean;
}

const defaults: Partial<Record<ArchitectureId, string>> = {
  nexusphp: '/torrents.php',
  tnode: '/torrent/search',
  mtorrent: '/browse',
  haidan: '/torrents.php',
};

function isTorrentList(id: ArchitectureId, pathname: string): boolean {
  switch (id) {
    case 'nexusphp':
      return /^\/torrents(?:[_-][^/]*)?\.php$/i.test(pathname);
    case 'tnode':
      return pathname === '/torrent/search' || pathname.startsWith('/torrent/search/');
    case 'mtorrent':
      return pathname === '/browse' || pathname.startsWith('/browse/');
    case 'haidan':
      return pathname === '/torrents.php';
    default:
      return false;
  }
}

function cleanName(value: string): string {
  return value.replace(/[\s\u00a0]+/g, ' ').replace(/^[|·•›»\-\s]+|[|·•‹«\-\s]+$/g, '').trim();
}

export function extractTorrentPages(id: ArchitectureId, snapshot: PageSnapshot): DraftPage[] {
  const pages = new Map<string, DraftPage>();
  for (const link of snapshot.links) {
    let url: URL;
    try {
      url = new URL(link.href, snapshot.url);
    } catch {
      continue;
    }
    if (url.origin !== snapshot.origin || !isTorrentList(id, url.pathname)) continue;
    const path = `${url.pathname}${url.search}`;
    const name = cleanName(link.text) || '综合';
    const existing = pages.get(path);
    if (!existing || name.length > existing.name.length) {
      pages.set(path, { name, path, tags: null, selected: true });
    }
  }

  if (pages.size === 0) {
    const path = defaults[id];
    return path ? [{ name: '综合', path, tags: null, selected: true }] : [];
  }
  return [...pages.values()];
}
