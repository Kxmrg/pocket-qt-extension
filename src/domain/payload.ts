import { deflateSync } from 'fflate';
import QRCode from 'qrcode';
import type { SiteDraft } from './adapt-site';

export interface SiteConfigPayload {
  scheme: 0 | 1 | 2 | 3;
  name: string;
  address: string;
  cookie: string;
  pages: Array<{ name: string; path: string; tags: string | null }>;
  passkey: string | null;
  userAgent: string | null;
  tags: string | null;
  downloadTags: string | null;
  widget: number;
  token: string | null;
  search: boolean;
  top: boolean | null;
}

export interface PocketPtImportPayload {
  protocol: 'pocket-pt.site';
  version: 1;
  site: SiteConfigPayload;
}

export interface EncodedPayload {
  text: string;
  compressedBytes: number;
  sourceBytes: number;
}

export function buildImportPayload(draft: SiteDraft): PocketPtImportPayload {
  if (draft.scheme === null) throw new Error('请选择 Pocket Qt 支持的站点架构');
  return {
    protocol: 'pocket-pt.site',
    version: 1,
    site: {
      scheme: draft.scheme,
      name: draft.name,
      address: draft.address,
      cookie: draft.cookie,
      pages: draft.pages
        .filter((page) => page.selected)
        .map(({ name, path, tags }) => ({ name, path, tags })),
      passkey: draft.passkey,
      userAgent: draft.userAgent,
      tags: draft.tags,
      downloadTags: draft.downloadTags,
      widget: draft.widget,
      token: draft.scheme === 0 ? null : draft.token,
      search: draft.search,
      top: draft.top,
    },
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 2_048;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    for (const byte of chunk) binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function assertQrCapacity(text: string): void {
  try {
    QRCode.create(text, { errorCorrectionLevel: 'M' });
  } catch {
    throw new Error('二维码数据过大，请减少种子页面后重试');
  }
}

export function encodeImportPayload(draft: SiteDraft): EncodedPayload {
  const source = new TextEncoder().encode(JSON.stringify(buildImportPayload(draft)));
  const compressed = deflateSync(source, { level: 9 });
  const text = `pocket-pt://import/site?v=1&data=${toBase64Url(compressed)}`;
  assertQrCapacity(text);
  return { text, compressedBytes: compressed.byteLength, sourceBytes: source.byteLength };
}
