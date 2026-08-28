import { describe, expect, it } from 'vitest';
import { extractTorrentPages } from './torrent-pages';
import type { PageSnapshot } from './types';

function snapshotWithLinks(links: Array<[string, string]>, url = 'https://pt.example/'): PageSnapshot {
  return {
    url,
    origin: new URL(url).origin,
    host: new URL(url).hostname,
    title: 'PT',
    userAgent: 'Test UA',
    meta: [],
    resources: [],
    links: links.map(([text, href]) => ({ text, href })),
    textSample: '',
    storage: [],
    candidates: [],
  };
}

describe('extractTorrentPages', () => {
  it('keeps NexusPHP torrent queries, removes hashes, and deduplicates by normalized path', () => {
    expect(extractTorrentPages('nexusphp', snapshotWithLinks([
      ['综合', 'https://pt.example/torrents.php'],
      ['电影', 'https://pt.example/torrents.php?cat=401'],
      ['电影种子', 'https://pt.example/torrents.php?cat=401#top'],
      ['详情', 'https://pt.example/details.php?id=9'],
      ['外站', 'https://outside.example/torrents.php'],
    ]))).toEqual([
      { name: '综合', path: '/torrents.php', tags: null, selected: true },
      { name: '电影种子', path: '/torrents.php?cat=401', tags: null, selected: true },
    ]);
  });

  it.each([
    ['tnode', 'https://zhuque.in/', '/torrent/search'],
    ['mtorrent', 'https://kp.m-team.cc/', '/browse'],
    ['haidan', 'https://haidan.cc/', '/torrents.php'],
  ] as const)('uses the default page for %s when navigation has none', (id, url, path) => {
    expect(extractTorrentPages(id, snapshotWithLinks([], url))).toEqual([
      { name: '综合', path, tags: null, selected: true },
    ]);
  });

  it('collects all matching TNode and mTorrent navigation pages', () => {
    const tnode = extractTorrentPages('tnode', snapshotWithLinks([
      ['综合', 'https://zhuque.in/torrent/search'],
      ['电影', 'https://zhuque.in/torrent/search?category=movie'],
    ], 'https://zhuque.in/'));
    const mtorrent = extractTorrentPages('mtorrent', snapshotWithLinks([
      ['综合', 'https://kp.m-team.cc/browse'],
      ['成人', 'https://kp.m-team.cc/browse/adult'],
    ], 'https://kp.m-team.cc/'));
    expect(tnode).toHaveLength(2);
    expect(mtorrent.map((page) => page.path)).toEqual(['/browse', '/browse/adult']);
  });
});
