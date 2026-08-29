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

export function extractTorrentPages(_id: ArchitectureId, snapshot: PageSnapshot): DraftPage[] {
  const page = draftPageFromSnapshot(snapshot, '综合');
  return page ? [page] : [];
}
