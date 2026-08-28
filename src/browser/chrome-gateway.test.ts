import { describe, expect, it } from 'vitest';
import { toOriginPattern } from './chrome-gateway';

describe('toOriginPattern', () => {
  it('returns the exact HTTP(S) origin pattern', () => {
    expect(toOriginPattern('https://pt.example.com/path?q=1')).toBe('https://pt.example.com/*');
    expect(toOriginPattern('http://localhost:8080/page')).toBe('http://localhost:8080/*');
  });

  it.each(['chrome://extensions', 'file:///tmp/page.html', 'about:blank'])('rejects unsupported URL %s', (url) => {
    expect(() => toOriginPattern(url)).toThrow('请在普通 HTTP 或 HTTPS 站点中使用');
  });
});
