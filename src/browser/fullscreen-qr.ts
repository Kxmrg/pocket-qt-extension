export interface FullscreenQrSession {
  text: string;
  siteName: string;
}

interface OpenFullscreenQrServices {
  createId: () => string;
  set: (key: string, value: FullscreenQrSession) => Promise<void>;
  remove: (key: string) => Promise<void>;
  open: (url: string) => Promise<unknown>;
  getUrl: (path: string) => string;
}

interface ConsumeFullscreenQrServices {
  get: (key: string) => Promise<unknown>;
  remove: (key: string) => Promise<void>;
}

const storageKey = (id: string) => `fullscreenQr:${id}`;

function defaultOpenServices(): OpenFullscreenQrServices {
  return {
    createId: () => crypto.randomUUID(),
    set: async (key, value) => { await chrome.storage.session.set({ [key]: value }); },
    remove: async (key) => { await chrome.storage.session.remove(key); },
    open: async (url) => chrome.tabs.create({ url }),
    getUrl: (path) => chrome.runtime.getURL(path),
  };
}

function defaultConsumeServices(): ConsumeFullscreenQrServices {
  return {
    get: async (key) => (await chrome.storage.session.get(key))[key],
    remove: async (key) => { await chrome.storage.session.remove(key); },
  };
}

function validSession(value: unknown): value is FullscreenQrSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FullscreenQrSession>;
  return typeof candidate.text === 'string'
    && candidate.text.startsWith('pocket-pt://import/site?')
    && typeof candidate.siteName === 'string';
}

export async function openFullscreenQr(
  session: FullscreenQrSession,
  services: OpenFullscreenQrServices = defaultOpenServices(),
): Promise<void> {
  const id = services.createId();
  const key = storageKey(id);
  await services.set(key, session);
  try {
    await services.open(services.getUrl(`fullscreen.html#${id}`));
  } catch (error) {
    await services.remove(key);
    throw error;
  }
}

export async function consumeFullscreenQr(
  hash: string,
  services: ConsumeFullscreenQrServices = defaultConsumeServices(),
): Promise<FullscreenQrSession | null> {
  const id = hash.replace(/^#/, '');
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return null;
  const key = storageKey(id);
  const value = await services.get(key);
  await services.remove(key);
  return validSession(value) ? value : null;
}
