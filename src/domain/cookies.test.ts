import { describe, expect, it } from 'vitest';
import { formatCookieHeader } from './cookies';

describe('formatCookieHeader', () => {
  it('keeps only cookies applicable to the current URL and orders specific paths first', () => {
    expect(formatCookieHeader([
      { name: 'root', value: 'a', domain: '.example.com', path: '/', secure: true },
      { name: 'deep', value: 'b', domain: 'pt.example.com', path: '/torrents', secure: true },
      { name: 'other', value: 'x', domain: 'other.example', path: '/', secure: true },
    ], 'https://pt.example.com/torrents/list')).toBe('deep=b; root=a');
  });

  it('does not include secure cookies on HTTP pages', () => {
    expect(formatCookieHeader([
      { name: 'secure', value: 'yes', domain: 'pt.example', path: '/', secure: true },
      { name: 'plain', value: 'yes', domain: 'pt.example', path: '/', secure: false },
    ], 'http://pt.example/')).toBe('plain=yes');
  });
});
