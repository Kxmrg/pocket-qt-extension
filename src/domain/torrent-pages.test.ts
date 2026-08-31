import { describe, expect, it } from 'vitest';
import { createManualPage, draftPageFromSnapshot, extractTorrentPages } from './torrent-pages';
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
      { name: '综合', path: '/torrents.php?cat=401', tags: null, selected: true },
    ]);
  });

  it.each([
    ['mtorrent', 'https://kp.m-team.cc/'],
    ['haidan', 'https://haidan.cc/'],
  ] as const)('uses the current root path for %s instead of an architecture default', (id, url) => {
    expect(extractTorrentPages(id, snapshotWithLinks([], url))).toEqual([
      { name: '综合', path: '/', tags: null, selected: true },
    ]);
  });

  it('returns the fixed comprehensive page for TNode', () => {
    const tnode = extractTorrentPages('tnode', snapshotWithLinks([
      ['综合', 'https://zhuque.in/torrent/search'],
      ['电影', 'https://zhuque.in/torrent/search?category=movie'],
    ], 'https://zhuque.in/torrent/info/123'));

    expect(tnode).toEqual([{ name: '综合', path: '/torrent/search', tags: null, selected: true }]);
  });

  it('returns the fixed torrent and collage pages for Gazelle', () => {
    expect(extractTorrentPages('gazelle', snapshotWithLinks([], 'https://dicmusic.com/torrents.php'))).toEqual([
      { name: '种子', path: '/torrents.php', tags: null, selected: true },
      { name: '合集', path: '/collages.php', tags: null, selected: true },
    ]);
  });

  it('returns one current page for mTorrent', () => {
    const mtorrent = extractTorrentPages('mtorrent', snapshotWithLinks([
      ['综合', 'https://kp.m-team.cc/browse'],
      ['成人', 'https://kp.m-team.cc/browse/adult'],
    ], 'https://kp.m-team.cc/'));

    expect(mtorrent).toEqual([{ name: '综合', path: '/', tags: null, selected: true }]);
  });

  it('keeps the name empty and uses the current URL when adding the active page', () => {
    const snapshot = snapshotWithLinks([], 'https://pt.example/special.php?id=7#top');
    snapshot.title = '  今日推荐 - Example PT  ';

    expect(draftPageFromSnapshot(snapshot, '')).toEqual({
      name: '',
      path: '/special.php?id=7',
      tags: null,
      selected: true,
    });
  });

  it('keeps a manually added page name empty while retaining its architecture path', () => {
    expect(createManualPage('mtorrent')).toEqual({
      name: '',
      path: '/browse',
      tags: null,
      selected: true,
    });
  });

  it('uses the SunnyPT torrent route for a manually added page', () => {
    expect(createManualPage('sunnypt')).toEqual({
      name: '',
      path: '/torrents?category=All',
      tags: null,
      selected: true,
    });
  });

  it('uses the Gazelle torrent route for a manually added page', () => {
    expect(createManualPage('gazelle')).toEqual({
      name: '',
      path: '/torrents.php',
      tags: null,
      selected: true,
    });
  });

  it('falls back to the SunnyPT list route when collected from a detail page', () => {
    expect(extractTorrentPages(
      'sunnypt',
      snapshotWithLinks([], 'https://sunnypt.top/torrent/440'),
    )).toEqual([
      { name: '综合', path: '/torrents?category=All', tags: null, selected: true },
    ]);
  });
});
