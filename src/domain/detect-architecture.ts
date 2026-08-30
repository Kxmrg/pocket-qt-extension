import type { ArchitectureId, DetectionResult, PageSnapshot } from './types';

interface ScoreResult {
  id: ArchitectureId;
  score: number;
  explicit: boolean;
  reasons: string[];
  supported: boolean;
}

function isHost(host: string, root: string): boolean {
  const normalized = host.toLowerCase().replace(/\.$/, '');
  return normalized === root || normalized.endsWith(`.${root}`);
}

function searchable(snapshot: PageSnapshot): string {
  return [
    snapshot.textSample,
    ...snapshot.meta.flatMap((item) => [item.name, item.property, item.content]),
    ...snapshot.resources,
  ].join('\n').toLowerCase();
}

function hrefs(snapshot: PageSnapshot): string[] {
  return snapshot.links.map((link) => link.href.toLowerCase());
}

function scoreUnit3d(snapshot: PageSnapshot): ScoreResult {
  const haystack = searchable(snapshot);
  const links = hrefs(snapshot);
  const explicit = /(?:powered by\s+)?unit3d/.test(haystack);
  const signals = [
    links.some((href) => /\/torrents(?:[/?#]|$)/.test(href)),
    links.some((href) => /\/api\/torrents\/(?:filter|search)/.test(href)),
    /laravel|\/build\/assets\//.test(haystack),
  ];
  const reasons = [
    ...(explicit ? ['检测到 UNIT3D 标识'] : []),
    ...(signals[0] ? ['检测到 UNIT3D 种子路由'] : []),
    ...(signals[1] ? ['检测到 UNIT3D API 路由'] : []),
    ...(signals[2] ? ['检测到 Laravel/UNIT3D 资源'] : []),
  ];
  return { id: 'unit3d', score: (explicit ? 10 : 0) + signals.filter(Boolean).length, explicit, reasons, supported: false };
}

function scoreGazelle(snapshot: PageSnapshot): ScoreResult {
  const haystack = searchable(snapshot);
  const links = hrefs(snapshot);
  const explicit = /(?:powered by\s+)?gazelle/.test(haystack);
  const signals = [
    links.some((href) => /\/ajax\.php\?action=/.test(href)),
    links.some((href) => /\/collages\.php(?:[?#]|$)/.test(href)),
    links.some((href) => /\/requests\.php(?:[?#]|$)/.test(href)),
  ];
  const reasons = [
    ...(explicit ? ['检测到 Gazelle 标识'] : []),
    ...(signals[0] ? ['检测到 Gazelle AJAX 路由'] : []),
    ...(signals[1] ? ['检测到 Gazelle 合集路由'] : []),
    ...(signals[2] ? ['检测到 Gazelle 求种路由'] : []),
  ];
  return { id: 'gazelle', score: (explicit ? 10 : 0) + signals.filter(Boolean).length, explicit, reasons, supported: false };
}

function scoreNexusPhp(snapshot: PageSnapshot): ScoreResult {
  const haystack = searchable(snapshot);
  const links = hrefs(snapshot);
  const explicit = /(?:powered by\s+)?nexusphp/.test(haystack);
  const signals = [
    links.some((href) => /\/torrents\.php(?:[?#]|$)/.test(href)),
    links.some((href) => /\/download\.php\?[^#]*\bid=/.test(href)),
    links.some((href) => /\/userdetails\.php\?[^#]*\bid=/.test(href)),
    /nexusphp|\/styles\/.*nexus/.test(haystack),
  ];
  const reasons = [
    ...(explicit ? ['检测到 NexusPHP 标识'] : []),
    ...(signals[0] ? ['检测到 torrents.php'] : []),
    ...(signals[1] ? ['检测到 download.php'] : []),
    ...(signals[2] ? ['检测到 userdetails.php'] : []),
    ...(!explicit && signals[3] ? ['检测到 NexusPHP 资源'] : []),
  ];
  return { id: 'nexusphp', score: (explicit ? 10 : 0) + signals.filter(Boolean).length, explicit, reasons, supported: true };
}

function fixed(id: ArchitectureId, reason: string): DetectionResult {
  return { id, supported: true, confidence: 'certain', reasons: [reason] };
}

export function detectArchitecture(snapshot: PageSnapshot): DetectionResult {
  if (isHost(snapshot.host, 'zhuque.in')) return fixed('tnode', '固定域名：zhuque.in');
  if (isHost(snapshot.host, 'm-team.cc') || isHost(snapshot.host, 'm-team.io')) {
    return fixed('mtorrent', '固定域名：M-Team');
  }
  if (isHost(snapshot.host, 'haidan.cc')) return fixed('haidan', '固定域名：haidan.cc');
  if (isHost(snapshot.host, 'sunnypt.top')) return fixed('sunnypt', '固定域名：sunnypt.top');

  for (const result of [scoreUnit3d(snapshot), scoreGazelle(snapshot), scoreNexusPhp(snapshot)]) {
    if (result.explicit || result.score >= 3) {
      return {
        id: result.id,
        supported: result.supported,
        confidence: result.explicit ? 'certain' : 'likely',
        reasons: result.reasons,
      };
    }
  }

  return { id: 'unknown', supported: false, confidence: 'unknown', reasons: [] };
}
