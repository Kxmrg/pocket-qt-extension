import type { PageSnapshot } from './types';

export interface FieldCandidate {
  value: string;
  source: string;
  score: number;
}

export type CandidateField = 'csrfToken' | 'apiToken' | 'uid' | 'passkey';

export interface CandidateSelection {
  value: string;
  alternatives: FieldCandidate[];
  needsConfirmation: boolean;
}

const aliases: Record<CandidateField, RegExp> = {
  csrfToken: /(?:^|[-_.])(?:x[-_.]?)?csrf(?:[-_.]?token)?$/i,
  apiToken: /(?:x[-_.]?api[-_.]?key|api[-_.]?key|access[-_.]?token|authorization|bearer[-_.]?token)/i,
  uid: /^(?:uid|user[-_.]?id|userid|member[-_.]?id)$/i,
  passkey: /pass[-_.]?key/i,
};

function addCandidate(target: FieldCandidate[], value: string, source: string, score: number): void {
  const clean = value.trim();
  if (!clean) return;
  target.push({ value: clean, source, score });
}

function linkCandidates(field: CandidateField, snapshot: PageSnapshot, target: FieldCandidate[]): void {
  for (const link of snapshot.links) {
    let url: URL;
    try {
      url = new URL(link.href, snapshot.url);
    } catch {
      continue;
    }
    if (field === 'uid') {
      const match = url.pathname.toLowerCase().endsWith('/userdetails.php') ? url.searchParams.get('id') : null;
      if (match) addCandidate(target, match, '个人资料链接', 60);
      const profileDetail = url.pathname.match(/\/profile\/detail\/(\d+)(?:\/|$)/i);
      if (profileDetail?.[1]) addCandidate(target, profileDetail[1], '个人资料链接', 140);
    }
    if (field === 'passkey') {
      const queryValue = url.searchParams.get('passkey');
      if (queryValue) addCandidate(target, queryValue, '下载链接', 65);
      const route = url.pathname.match(/\/api\/torrent\/download\/[^/]+\/([^/?#]+)/i);
      if (route?.[1]) addCandidate(target, decodeURIComponent(route[1]), '下载链接', 65);
    }
  }
}

export function selectCandidate(field: CandidateField, snapshot: PageSnapshot): CandidateSelection {
  const found: FieldCandidate[] = [];
  const pattern = aliases[field];

  for (const meta of snapshot.meta) {
    const key = meta.name || meta.property;
    if (pattern.test(key)) addCandidate(found, meta.content, `meta:${key}`, 120);
  }
  for (const candidate of snapshot.candidates) {
    if (pattern.test(candidate.key)) {
      const score = candidate.source.toLowerCase().includes('meta') ? 115 : 100;
      addCandidate(found, candidate.value, candidate.source, score);
    }
  }
  for (const entry of snapshot.storage) {
    if (pattern.test(entry.key)) addCandidate(found, entry.value, `${entry.area}Storage:${entry.key}`, 80);
  }
  linkCandidates(field, snapshot, found);

  const byValue = new Map<string, FieldCandidate>();
  for (const item of found.sort((a, b) => b.score - a.score)) {
    if (!byValue.has(item.value)) byValue.set(item.value, item);
  }
  const alternatives = [...byValue.values()].sort((a, b) => b.score - a.score);
  return {
    value: alternatives[0]?.value ?? '',
    alternatives,
    needsConfirmation: alternatives.length > 1,
  };
}
