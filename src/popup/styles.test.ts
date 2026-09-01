import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('popup responsive styles', () => {
  it('places all resource links in one row when the side panel is wide enough', () => {
    const styles = readFileSync('src/popup/styles.css', 'utf8');

    expect(styles).toMatch(/@media \(min-width: 400px\)[\s\S]*?\.resource-links\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(min-width: 400px\)[\s\S]*?\.resource-links a:first-child\s*\{[^}]*grid-column:\s*auto/);
  });
});
