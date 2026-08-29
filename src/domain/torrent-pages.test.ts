import { describe, expect, it } from 'vitest';
import { draftPageFromSnapshot, extractTorrentPages } from './torrent-pages';
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
  it('uses only the current page path and ignores discovered navigation pages', () => {
    expect(extractTorrentPages('nexusphp', snapshotWithLinks([
      ['综合', 'https://pt.example/torrents.php'],
      ['电影', 'https://pt.example/torrents.php?cat=401'],
      ['电影种子', 'https://pt.example/torrents.php?cat=401#top'],
      ['详情', 'https://pt.example/details.php?id=9'],
      ['外站', 'https://outside.example/torrents.php'],
    ], 'https://pt.example/torrents.php?cat=401#top'))).toEqual([
      { name: 'PT', path: '/torrents.php?cat=401', tags: null, selected: true },
    ]);
  });

  it.each([
    ['tnode', 'https://zhuque.in/'],
    ['mtorrent', 'https://kp.m-team.cc/'],
    ['haidan', 'https://haidan.cc/'],
  ] as const)('uses the current root path for %s instead of an architecture default', (id, url) => {
    expect(extractTorrentPages(id, snapshotWithLinks([], url))).toEqual([
      { name: 'PT', path: '/', tags: null, selected: true },
    ]);
  });

  it('returns one current page for TNode and mTorrent', () => {
    const tnode = extractTorrentPages('tnode', snapshotWithLinks([
      ['综合', 'https://zhuque.in/torrent/search'],
      ['电影', 'https://zhuque.in/torrent/search?category=movie'],
    ], 'https://zhuque.in/'));
    const mtorrent = extractTorrentPages('mtorrent', snapshotWithLinks([
      ['综合', 'https://kp.m-team.cc/browse'],
      ['成人', 'https://kp.m-team.cc/browse/adult'],
    ], 'https://kp.m-team.cc/'));
    expect(tnode).toEqual([{ name: 'PT', path: '/', tags: null, selected: true }]);
    expect(mtorrent).toEqual([{ name: 'PT', path: '/', tags: null, selected: true }]);
  });

  it('builds a page from the current title and URL when adding the active page', () => {
    const snapshot = snapshotWithLinks([], 'https://pt.example/special.php?id=7#top');
    snapshot.title = '  今日推荐 - Example PT  ';

    expect(draftPageFromSnapshot(snapshot)).toEqual({
      name: '今日推荐 - Example PT',
      path: '/special.php?id=7',
      tags: null,
      selected: true,
    });
  });
});
