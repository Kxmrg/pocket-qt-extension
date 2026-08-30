import type { ArchitectureId, PageSnapshot } from './types';

export interface DraftPage {
  name: string;
  path: string;
  tags: string | null;
  selected: boolean;
}

const defaultPathByArchitecture: Partial<Record<ArchitectureId, string>> = {
  nexusphp: '/torrents.php',
  tnode: '/torrent/search',
  mtorrent: '/browse',
  haidan: '/torrents.php',
  sunnypt: '/torrents?category=All',
};

export function draftPageFromSnapshot(snapshot: PageSnapshot, name: string): DraftPage | null {
  try {
    const current = new URL(snapshot.url);
    return {
      name,
      path: `${current.pathname || '/'}${current.search}`,
      tags: null,
      selected: true,
    };
  } catch {
    return null;
  }
}

export function createManualPage(id: ArchitectureId): DraftPage {
  return {
    name: '',
    path: defaultPathByArchitecture[id] ?? '/torrents.php',
    tags: null,
    selected: true,
  };
}

export function extractTorrentPages(id: ArchitectureId, snapshot: PageSnapshot): DraftPage[] {
  if (id === 'tnode') {
    return [{ name: '综合', path: '/torrent/search', tags: null, selected: true }];
  }
  if (id === 'sunnypt') {
    const page = draftPageFromSnapshot(snapshot, '综合');
    if (page?.path === '/torrents' || page?.path.startsWith('/torrents?')) return [page];
    return [{ name: '综合', path: '/torrents?category=All', tags: null, selected: true }];
  }
  const page = draftPageFromSnapshot(snapshot, '综合');
  return page ? [page] : [];
}
