import { describe, expect, it } from 'vitest';
import { detectArchitecture } from './detect-architecture';
import type { PageSnapshot } from './types';

function snapshot(url = 'https://example.com/', overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  const parsed = new URL(url);
  return {
    url,
    origin: parsed.origin,
    host: parsed.hostname,
    title: 'Example',
    userAgent: 'Test UA',
    meta: [],
    resources: [],
    links: [],
    textSample: '',
    storage: [],
    candidates: [],
    ...overrides,
  };
}

describe('detectArchitecture', () => {
  it.each([
    ['https://exoticaz.to/torrents', 'exoticaz.to'],
    ['https://www.filelist.io/browse.php', 'filelist.io'],
    ['https://beyond-hd.me/torrents', 'beyond-hd.me'],
    ['https://img.hdbits.org/browse.php', 'hdbits.org'],
  ] as const)('recognizes %s as the Private architecture by domain', (url, root) => {
    const result = detectArchitecture(snapshot(url, {
      textSample: 'Powered by NexusPHP UNIT3D Gazelle',
      links: [{ text: 'Legacy', href: `${new URL(url).origin}/details.php?id=1` }],
    }));
    expect(result).toMatchObject({ id: 'private', supported: true, confidence: 'certain' });
    expect(result.reasons.join(' ')).toContain(root);
  });

  it('does not infer Private from a similar unregistered site', () => {
    expect(detectArchitecture(snapshot('https://private.example/browse.php', {
      textSample: 'Powered by HD Sauce',
      links: [{ text: 'Details', href: 'https://private.example/details.php?id=1' }],
    })).id).not.toBe('private');
  });

  it.each([
    ['https://zhuque.in/torrent/search', 'tnode'],
    ['https://kp.m-team.cc/browse', 'mtorrent'],
    ['https://zp.m-team.io/browse', 'mtorrent'],
    ['https://haidan.cc/torrents.php', 'haidan'],
    ['https://dicmusic.com/collages.php', 'gazelle'],
    ['https://greatposterwall.com/torrents.php', 'gazelle'],
    ['https://passthepopcorn.me/torrents.php', 'gazelle'],
    ['https://broadcasthe.net/collages.php', 'gazelle'],
  ] as const)('recognizes fixed site %s as %s', (url, expected) => {
    expect(detectArchitecture(snapshot(url))).toMatchObject({ id: expected, supported: true });
  });

  it('recognizes UNIT3D before a coincidental NexusPHP route', () => {
    const result = detectArchitecture(snapshot('https://u3.example/torrents', {
      textSample: 'Powered by UNIT3D',
      resources: ['/build/assets/app.js'],
      links: [
        { text: 'Torrents', href: 'https://u3.example/torrents' },
        { text: 'Legacy', href: 'https://u3.example/torrents.php' },
      ],
    }));
    expect(result).toMatchObject({ id: 'unit3d', supported: true });
  });

  it('recognizes exact UNIT3D product identity without a fixed domain', () => {
    const result = detectArchitecture(snapshot('https://tracker.example/torrents', {
      textSample: 'Built with UNIT3D-rs (core) + UNIT3D-Announce',
      links: [{ text: 'Torrents', href: 'https://tracker.example/torrents' }],
    }));

    expect(result).toMatchObject({ id: 'unit3d', supported: true, confidence: 'certain' });
  });

  it('recognizes a structurally complete UNIT3D tracker without branding', () => {
    const result = detectArchitecture(snapshot('https://tracker.example/torrents', {
      domMarkers: ['unit3d-torrent-table', 'unit3d-torrent-row'],
      links: [
        { text: 'Torrents', href: 'https://tracker.example/torrents' },
        { text: 'Uploader', href: 'https://tracker.example/users/uploader' },
        { text: 'Forums', href: 'https://tracker.example/forums' },
        { text: 'RSS', href: 'https://tracker.example/rss' },
      ],
    }));

    expect(result).toMatchObject({ id: 'unit3d', supported: true, confidence: 'likely' });
  });

  it.each([
    { textSample: 'A forum post comparing UNIT3D themes' },
    { resources: ['/build/assets/app.js'] },
    { links: [{ text: 'Torrents', href: 'https://tracker.example/torrents' }] },
  ])('rejects a lone weak UNIT3D signal: %j', (overrides) => {
    expect(detectArchitecture(snapshot('https://tracker.example/', overrides)))
      .toEqual({ id: 'unknown', supported: false, confidence: 'unknown', reasons: [] });
  });

  it('recognizes original Gazelle from its classic structure and common routes', () => {
    const result = detectArchitecture(snapshot('https://gazelle.example/', {
      domMarkers: ['body#torrents', 'gazelle-grouping-table', 'gazelle-group-row', 'gazelle-torrent-row'],
      links: [
        { text: 'Collages', href: 'https://gazelle.example/collages.php' },
        { text: 'Requests', href: 'https://gazelle.example/requests.php' },
      ],
    }));
    expect(result).toMatchObject({ id: 'gazelle', supported: true, confidence: 'likely' });
  });

  it('supports GazellePW poster-wall pages as Gazelle', () => {
    const result = detectArchitecture(snapshot('https://greatposterwall.com/torrents.php', {
      domMarkers: ['body#torrents', 'gazellepw-cover-wall', 'gazellepw-movie-filters'],
    }));

    expect(result).toMatchObject({ id: 'gazelle', supported: true });
  });

  it.each([
    [['ptp-movie-routes', 'ptp-group-table']],
    [['btn-series-links', 'btn-torrent-actions']],
  ])('recognizes an HTML-only Gazelle structure: %j', (domMarkers) => {
    const result = detectArchitecture(snapshot('https://fork.example/torrents.php', { domMarkers }));
    expect(result).toMatchObject({ id: 'gazelle', supported: true, confidence: 'likely' });
  });

  it('does not identify a page as GazellePW from movie filters alone', () => {
    const result = detectArchitecture(snapshot('https://example.com/search.php', {
      domMarkers: ['gazellepw-movie-filters'],
    }));

    expect(result).toEqual({ id: 'unknown', supported: false, confidence: 'unknown', reasons: [] });
  });

  it('prefers a branded and routed classic Gazelle structure over incidental UNIT3D page text', () => {
    const result = detectArchitecture(snapshot('https://gazelle.example/torrents.php', {
      textSample: 'Powered by Gazelle. Forum post: I also use UNIT3D on another tracker.',
      domMarkers: ['body#torrents', 'gazelle-grouping-table', 'gazelle-group-row', 'gazelle-torrent-row'],
      links: [
        { text: 'Collages', href: 'https://gazelle.example/collages.php' },
        { text: 'Requests', href: 'https://gazelle.example/requests.php' },
      ],
    }));

    expect(result).toMatchObject({ id: 'gazelle', supported: true, confidence: 'certain' });
  });

  it.each([
    ['https://example.com/collages.php'],
    ['https://example.com/torrents.php'],
  ])('does not identify a normal PHP page as Gazelle from one weak route: %s', (url) => {
    expect(detectArchitecture(snapshot('https://example.com/', {
      links: [{ text: 'Ordinary link', href: url }],
    }))).toEqual({ id: 'unknown', supported: false, confidence: 'unknown', reasons: [] });
  });

  it('recognizes an explicit NexusPHP marker', () => {
    const result = detectArchitecture(snapshot('https://nexus.example/', {
      meta: [{ name: 'generator', property: '', content: 'NexusPHP' }],
    }));
    expect(result).toMatchObject({ id: 'nexusphp', supported: true });
  });

  it('recognizes SunnyPT as its independent architecture without legacy php route signals', () => {
    const result = detectArchitecture(snapshot('https://sunnypt.top/torrents?category=All', {
      title: 'SUNNYPT',
      resources: ['/_next/static/chunks/app/torrents/page.js'],
      links: [{ text: '种子', href: 'https://sunnypt.top/torrents?category=All' }],
    }));

    expect(result).toMatchObject({ id: 'sunnypt', supported: true, confidence: 'certain' });
  });

  it('recognizes a NexusPHP route combination without branding', () => {
    const result = detectArchitecture(snapshot('https://nexus.example/', {
      links: [
        { text: '种子', href: 'https://nexus.example/torrents.php' },
        { text: '下载', href: 'https://nexus.example/download.php?id=7' },
        { text: '用户', href: 'https://nexus.example/userdetails.php?id=2' },
      ],
    }));
    expect(result.id).toBe('nexusphp');
  });

  it('recognizes the TTG NexusPHP route variant', () => {
    const result = detectArchitecture(snapshot('https://totheglory.im/browse.php?c=M', {
      title: 'TTG',
      links: [
        { text: '影视&音乐', href: 'https://totheglory.im/browse.php?c=M' },
        { text: '种子详情', href: 'https://totheglory.im/details.php?id=830851&hit=1' },
        { text: '下载', href: 'https://totheglory.im/dl/830851/3780' },
        { text: '用户', href: 'https://totheglory.im/userdetails.php?id=62254' },
      ],
    }));

    expect(result).toMatchObject({ id: 'nexusphp', supported: true, confidence: 'likely' });
  });

  it('keeps a normal page with one torrent-like link unknown', () => {
    const result = detectArchitecture(snapshot('https://news.example/', {
      links: [{ text: 'Torrents in the news', href: 'https://news.example/torrents' }],
    }));
    expect(result).toEqual({ id: 'unknown', supported: false, confidence: 'unknown', reasons: [] });
  });
});
