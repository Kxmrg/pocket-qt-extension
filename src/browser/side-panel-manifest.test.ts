import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface ExtensionManifest {
  permissions?: string[];
  host_permissions?: string[];
  optional_host_permissions?: string[];
  action?: { default_popup?: string };
  side_panel?: { default_path?: string };
  background?: { service_worker?: string; type?: string };
}

describe('side panel manifest', () => {
  it('opens a global side panel from the toolbar action instead of a transient popup', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8')) as ExtensionManifest;

    expect(manifest.permissions).toContain('sidePanel');
    expect(manifest.action?.default_popup).toBeUndefined();
    expect(manifest.side_panel?.default_path).toBe('popup.html');
    expect(manifest.background).toEqual({ service_worker: 'assets/background.js', type: 'module' });
  });

  it('uses persistent tab and host permissions required by the side panel Cookie flow', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8')) as ExtensionManifest;

    expect(manifest.permissions).toEqual(expect.arrayContaining(['tabs', 'cookies', 'scripting', 'sidePanel']));
    expect(manifest.permissions).not.toContain('activeTab');
    expect(manifest.host_permissions).toEqual(['http://*/*', 'https://*/*']);
    expect(manifest.optional_host_permissions).toBeUndefined();
  });
});
