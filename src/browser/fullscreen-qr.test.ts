import { describe, expect, it, vi } from 'vitest';
import { consumeFullscreenQr, openFullscreenQr, type FullscreenQrSession } from './fullscreen-qr';

const session: FullscreenQrSession = {
  text: 'pocket-pt://import/site?v=1&data=secret',
  siteName: 'Example PT',
};

describe('fullscreen QR transfer', () => {
  it('stores the QR in memory and opens only an opaque id in a new tab', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn().mockResolvedValue(undefined);

    await openFullscreenQr(session, {
      createId: () => 'transfer-123',
      set,
      remove: vi.fn(),
      open,
      getUrl: (path) => `chrome-extension://fixture/${path}`,
    });

    expect(set).toHaveBeenCalledWith('fullscreenQr:transfer-123', session);
    expect(open).toHaveBeenCalledWith('chrome-extension://fixture/fullscreen.html#transfer-123');
    expect(open.mock.calls[0]?.[0]).not.toContain('secret');
  });

  it('consumes and removes the in-memory QR data', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const result = await consumeFullscreenQr('#transfer-123', {
      get: vi.fn().mockResolvedValue(session),
      remove,
    });

    expect(result).toEqual(session);
    expect(remove).toHaveBeenCalledWith('fullscreenQr:transfer-123');
  });
});
