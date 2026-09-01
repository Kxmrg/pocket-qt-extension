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
  const markers = new Set(snapshot.domMarkers ?? []);
  const hasGazelleBrand = /(?:powered by\s+)?gazelle/.test(haystack);
  const hasGazellePwSignature = markers.has('gazellepw-cover-wall') && markers.has('gazellepw-movie-filters');
  const hasClassicStructure = [
    'body#torrents',
    'gazelle-grouping-table',
    'gazelle-group-row',
    'gazelle-torrent-row',
  ].every((marker) => markers.has(marker));
  const routeSignals = [
    links.some((href) => /\/ajax\.php\?action=/.test(href)),
    links.some((href) => /\/collages\.php(?:[?#]|$)/.test(href)),
    links.some((href) => /\/requests\.php(?:[?#]|$)/.test(href)),
  ];
  const hasIndependentCommonRoutes = routeSignals.filter(Boolean).length >= 2;
  const explicit = hasGazelleBrand && hasIndependentCommonRoutes;
  const reasons = [
    ...(hasGazellePwSignature ? ['检测到 GazellePW 海报墙/筛选结构'] : []),
    ...(hasClassicStructure ? ['检测到 Gazelle 分组种子表结构'] : []),
    ...(explicit ? ['检测到 Gazelle 标识和独立路由'] : []),
    ...(routeSignals[0] ? ['检测到 Gazelle AJAX 路由'] : []),
    ...(routeSignals[1] ? ['检测到 Gazelle 合集路由'] : []),
    ...(routeSignals[2] ? ['检测到 Gazelle 求种路由'] : []),
  ];
  const score = hasGazellePwSignature || hasClassicStructure ? 4 : explicit ? 3 : 0;
  return {
    id: 'gazelle',
    score,
    explicit,
    reasons,
    supported: hasGazellePwSignature || hasClassicStructure || explicit,
  };
}

function scoreNexusPhp(snapshot: PageSnapshot): ScoreResult {
  const haystack = searchable(snapshot);
  const links = hrefs(snapshot);
  const explicit = /(?:powered by\s+)?nexusphp/.test(haystack);
  const signals = [
    links.some((href) => /\/(?:torrents|browse)\.php(?:[?#]|$)/.test(href)),
    links.some((href) => /\/download\.php\?[^#]*\bid=|\/dl\/\d+\/\d+(?:[/?#]|$)/.test(href)),
    links.some((href) => /\/details\.php\?[^#]*\bid=/.test(href)),
    links.some((href) => /\/userdetails\.php\?[^#]*\bid=/.test(href)),
    /nexusphp|\/styles\/.*nexus/.test(haystack),
  ];
  const reasons = [
    ...(explicit ? ['检测到 NexusPHP 标识'] : []),
    ...(signals[0] ? ['检测到 NexusPHP 种子列表路由'] : []),
    ...(signals[1] ? ['检测到 NexusPHP 下载路由'] : []),
    ...(signals[2] ? ['检测到 details.php'] : []),
    ...(signals[3] ? ['检测到 userdetails.php'] : []),
    ...(!explicit && signals[4] ? ['检测到 NexusPHP 资源'] : []),
  ];
  return { id: 'nexusphp', score: (explicit ? 10 : 0) + signals.filter(Boolean).length, explicit, reasons, supported: true };
}

function fixed(id: ArchitectureId, reason: string): DetectionResult {
  return { id, supported: true, confidence: 'certain', reasons: [reason] };
}

function detectionFromScore(result: ScoreResult): DetectionResult {
  return {
    id: result.id,
    supported: result.supported,
    confidence: result.explicit ? 'certain' : 'likely',
    reasons: result.reasons,
  };
}

export function detectArchitecture(snapshot: PageSnapshot): DetectionResult {
  if (isHost(snapshot.host, 'zhuque.in')) return fixed('tnode', '固定域名：zhuque.in');
  if (isHost(snapshot.host, 'm-team.cc') || isHost(snapshot.host, 'm-team.io')) {
    return fixed('mtorrent', '固定域名：M-Team');
  }
  if (isHost(snapshot.host, 'haidan.cc')) return fixed('haidan', '固定域名：haidan.cc');
  if (isHost(snapshot.host, 'sunnypt.top')) return fixed('sunnypt', '固定域名：sunnypt.top');
  if (isHost(snapshot.host, 'dicmusic.com')) return fixed('gazelle', '固定域名：dicmusic.com');
  if (isHost(snapshot.host, 'greatposterwall.com')) return fixed('gazelle', '固定域名：greatposterwall.com');

  const gazelle = scoreGazelle(snapshot);
  if (gazelle.score >= 4) return detectionFromScore(gazelle);

  for (const result of [scoreUnit3d(snapshot), gazelle, scoreNexusPhp(snapshot)]) {
    if (result.explicit || result.score >= 3) {
      return detectionFromScore(result);
    }
  }

  return { id: 'unknown', supported: false, confidence: 'unknown', reasons: [] };
}
