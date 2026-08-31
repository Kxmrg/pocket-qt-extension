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
    ['https://zhuque.in/torrent/search', 'tnode'],
    ['https://kp.m-team.cc/browse', 'mtorrent'],
    ['https://zp.m-team.io/browse', 'mtorrent'],
    ['https://haidan.cc/torrents.php', 'haidan'],
  ] as const)('recognizes fixed site %s as %s', (url, expected) => {
    expect(detectArchitecture(snapshot(url)).id).toBe(expected);
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
    expect(result).toMatchObject({ id: 'unit3d', supported: false });
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

  it('keeps GazellePW poster-wall pages unsupported in Phase 1', () => {
    const result = detectArchitecture(snapshot('https://greatposterwall.com/torrents.php', {
      domMarkers: ['body#torrents', 'gazellepw-cover-wall', 'gazellepw-movie-filters'],
    }));

    expect(result).toMatchObject({ id: 'gazelle', supported: false });
  });

  it('does not identify a page as GazellePW from movie filters alone', () => {
    const result = detectArchitecture(snapshot('https://example.com/search.php', {
      domMarkers: ['gazellepw-movie-filters'],
    }));

    expect(result).toEqual({ id: 'unknown', supported: false, confidence: 'unknown', reasons: [] });
  });

  it('prefers a classic Gazelle structure over incidental UNIT3D page text', () => {
    const result = detectArchitecture(snapshot('https://gazelle.example/torrents.php', {
      textSample: 'Forum post: I also use UNIT3D on another tracker.',
      domMarkers: ['body#torrents', 'gazelle-grouping-table', 'gazelle-group-row', 'gazelle-torrent-row'],
    }));

    expect(result).toMatchObject({ id: 'gazelle', supported: true, confidence: 'likely' });
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

  it('keeps a normal page with one torrent-like link unknown', () => {
    const result = detectArchitecture(snapshot('https://news.example/', {
      links: [{ text: 'Torrents in the news', href: 'https://news.example/torrents' }],
    }));
    expect(result).toEqual({ id: 'unknown', supported: false, confidence: 'unknown', reasons: [] });
  });
});
