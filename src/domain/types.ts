export type ArchitectureId =
  | 'nexusphp'
  | 'tnode'
  | 'mtorrent'
  | 'haidan'
  | 'sunnypt'
  | 'gazelle'
  | 'unit3d'
  | 'unknown';

export interface PageLink {
  text: string;
  href: string;
}

export interface StorageEntry {
  area: 'local' | 'session';
  key: string;
  value: string;
}

export interface PageCandidate {
  key: string;
  value: string;
  source: string;
}

export interface PageSnapshot {
  url: string;
  origin: string;
  host: string;
  title: string;
  userAgent: string;
  documentCookie?: string;
  meta: Array<{ name: string; property: string; content: string }>;
  resources: string[];
  links: PageLink[];
  textSample: string;
  storage: StorageEntry[];
  candidates: PageCandidate[];
}

export interface DetectionResult {
  id: ArchitectureId;
  supported: boolean;
  confidence: 'certain' | 'likely' | 'unknown';
  reasons: string[];
}
