import { selectCandidate, type FieldCandidate } from './candidates';
import { extractTorrentPages, type DraftPage } from './torrent-pages';
import type { ArchitectureId, DetectionResult, PageSnapshot } from './types';

export interface SiteDraft {
  architecture: ArchitectureId;
  scheme: 0 | 1 | 2 | 3 | null;
  name: string;
  address: string;
  cookie: string;
  pages: DraftPage[];
  passkey: string | null;
  userAgent: string | null;
  tags: string | null;
  downloadTags: string | null;
  widget: number;
  token: string | null;
  search: boolean;
  top: boolean | null;
  fieldWarnings: Record<string, string>;
  alternatives: Record<string, FieldCandidate[]>;
}

export interface AdaptSiteInput {
  detection: DetectionResult;
  snapshot: PageSnapshot;
  cookieHeader: string;
}

const schemeMap: Partial<Record<ArchitectureId, 0 | 1 | 2 | 3>> = {
  nexusphp: 0,
  tnode: 1,
  mtorrent: 2,
  haidan: 3,
};

function siteName(snapshot: PageSnapshot): string {
  const withoutGenerator = snapshot.title.replace(/\s*[-|｜:]?\s*Powered by\b.*$/i, '');
  const brand = withoutGenerator.split(/\s+(?:-|::|\||｜)\s+/)[0] ?? '';
  const cleaned = brand
    .replace(/\s*[-|｜]\s*(?:首页|home|index)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || snapshot.host;
}

function siteAddress(id: ArchitectureId, snapshot: PageSnapshot): string {
  if (id !== 'mtorrent') return snapshot.origin.replace(/\/$/, '');
  if (snapshot.host === 'api.m-team.cc' || snapshot.host.endsWith('.m-team.cc')) {
    return 'https://api.m-team.cc';
  }
  if (snapshot.host === 'api.m-team.io' || snapshot.host.endsWith('.m-team.io')) {
    return 'https://api.m-team.io';
  }
  return snapshot.origin.replace(/\/$/, '');
}

function addSelectionMetadata(
  field: string,
  label: string,
  selection: ReturnType<typeof selectCandidate>,
  warnings: Record<string, string>,
  alternatives: Record<string, FieldCandidate[]>,
): void {
  if (selection.alternatives.length > 0) alternatives[field] = selection.alternatives;
  if (!selection.value) warnings[field] = `未自动获取 ${label}`;
  else if (selection.needsConfirmation) warnings[field] = `${label} 存在多个候选，请确认`;
}

export function adaptSite({ detection, snapshot, cookieHeader }: AdaptSiteInput): SiteDraft {
  const warnings: Record<string, string> = {};
  const alternatives: Record<string, FieldCandidate[]> = {};
  const passkey = selectCandidate('passkey', snapshot);
  let cookie = cookieHeader;
  let token = '';

  if (detection.id === 'tnode') {
    const csrf = selectCandidate('csrfToken', snapshot);
    token = csrf.value;
    addSelectionMetadata('token', 'X-Csrf-Token', csrf, warnings, alternatives);
  } else if (detection.id === 'mtorrent') {
    const uid = selectCandidate('uid', snapshot);
    cookie = uid.value;
    token = '';
    addSelectionMetadata('cookie', 'UUID', uid, warnings, alternatives);
    warnings.token = '请前往控制台实验室复制令牌并手动填写';
  } else if (detection.id === 'haidan') {
    const uid = selectCandidate('uid', snapshot);
    token = uid.value;
    addSelectionMetadata('token', 'UID', uid, warnings, alternatives);
  }

  if (!cookie && detection.id !== 'unknown') warnings.cookie ??= '未自动获取 Cookie';
  if (passkey.needsConfirmation) warnings.passkey = 'Passkey 存在多个候选，请确认';
  if (passkey.alternatives.length > 0) alternatives.passkey = passkey.alternatives;

  return {
    architecture: detection.id,
    scheme: schemeMap[detection.id] ?? null,
    name: detection.id === 'tnode' ? 'ZhuQue' : siteName(snapshot),
    address: siteAddress(detection.id, snapshot),
    cookie,
    pages: extractTorrentPages(detection.id, snapshot),
    passkey: passkey.value || null,
    userAgent: snapshot.userAgent || null,
    tags: null,
    downloadTags: null,
    widget: 1,
    token: token || null,
    search: true,
    top: null,
    fieldWarnings: warnings,
    alternatives,
  };
}
