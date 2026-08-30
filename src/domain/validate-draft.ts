import type { SiteDraft } from './adapt-site';

export interface DraftValidation {
  valid: boolean;
  errors: Record<string, string>;
}

const expectedScheme: Record<string, number> = {
  nexusphp: 0,
  tnode: 1,
  mtorrent: 2,
  haidan: 3,
  sunnypt: 4,
};

function isHttpAddress(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function validateDraft(draft: SiteDraft): DraftValidation {
  const errors: Record<string, string> = {};
  if (draft.scheme === null || expectedScheme[draft.architecture] !== draft.scheme) {
    errors.architecture = '请选择 Pocket Qt 支持的站点架构';
  }
  if (!draft.name.trim()) errors.name = '请输入站点名称';
  if (!isHttpAddress(draft.address)) errors.address = '请输入有效的 HTTP 或 HTTPS 站点地址';

  if (!draft.cookie.trim()) {
    errors.cookie = draft.architecture === 'mtorrent' ? '请输入 UUID' : '请输入 Cookie';
  }
  if (draft.architecture === 'tnode' && !draft.token?.trim()) errors.token = '请输入 X-Csrf-Token';
  if (draft.architecture === 'mtorrent' && !draft.token?.trim()) errors.token = '请前往控制台实验室复制令牌并手动填写';
  if (draft.architecture === 'haidan' && !draft.token?.trim()) errors.token = '请输入 UID';

  const selectedPages = draft.pages.filter((page) => page.selected);
  if (selectedPages.length === 0) {
    errors.pages = '至少选择一个种子页面';
  } else if (selectedPages.some((page) => !page.path.startsWith('/'))) {
    errors.pages = '种子页面路径必须以 / 开头';
  } else if (selectedPages.some((page) => !page.name.trim())) {
    errors.pages = '种子页面名称不能为空';
  }

  if (!Number.isInteger(draft.widget) || draft.widget < 1 || draft.widget > 999) {
    errors.widget = '权重必须为 1 到 999 的整数';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
