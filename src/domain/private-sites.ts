export type PrivateSiteId = 'exoticaz' | 'filelist' | 'beyondhd' | 'hdbits';

interface PrivateSiteDefinition {
  id: PrivateSiteId;
  root: string;
  name: string;
  path: string;
}

export const privateSites: readonly PrivateSiteDefinition[] = [
  { id: 'exoticaz', root: 'exoticaz.to', name: 'ExoticaZ', path: '/torrents' },
  { id: 'filelist', root: 'filelist.io', name: 'FileList', path: '/browse.php' },
  { id: 'beyondhd', root: 'beyond-hd.me', name: 'BeyondHD', path: '/torrents' },
  { id: 'hdbits', root: 'hdbits.org', name: 'HDBits', path: '/browse.php' },
] as const;

export function privateSiteForHost(host: string): PrivateSiteDefinition | null {
  const normalized = host.toLowerCase().replace(/\.$/, '');
  return privateSites.find(({ root }) => normalized === root || normalized.endsWith(`.${root}`)) ?? null;
}
