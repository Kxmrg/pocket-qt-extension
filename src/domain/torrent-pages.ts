import type { ArchitectureId, PageSnapshot } from './types';

export interface DraftPage {
  name: string;
  path: string;
  tags: string | null;
  selected: boolean;
}

export function extractTorrentPages(_id: ArchitectureId, snapshot: PageSnapshot): DraftPage[] {
  try {
    const current = new URL(snapshot.url);
    return [{
      name: '当前页面',
      path: `${current.pathname || '/'}${current.search}`,
      tags: null,
      selected: true,
    }];
  } catch {
    return [];
  }
}
