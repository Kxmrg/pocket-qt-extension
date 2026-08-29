# Pocket PT 站点导入 Chrome 扩展

扩展使用 Chrome 侧边栏。用户点击“读取当前页面”后，扩展才会在本地识别站点架构，读取当前站点 Cookie、User-Agent、特殊 Token/UUID/UID/Passkey，并把当前网址的路径作为唯一种子页面。用户可以自行修改或新增页面，确认后生成供 Pocket PT 手机端导入的二维码。

当前阶段只包含 Chrome 扩展。手机端扫码导入将在下一阶段实现。

## 支持范围

- NexusPHP：通过页面特征识别；
- TNode：识别 `zhuque.in`；
- mTorrent：识别 M-Team 的 `m-team.cc` 和 `m-team.io` 域名，并转换为对应 API 地址；
- HaiDanPt：识别 `haidan.cc`；
- Gazelle、UNIT3D：能够识别，但会明确提示 Pocket PT 暂不支持；
- 未知架构：允许手动选择以上四种已支持架构并填写配置。

## 构建与测试

需要 Chrome 114 或更高版本，以及 Node.js 24 或兼容版本。

```bash
cd chrome-extension
npm install
npm test
npm run build
```

构建产物位于 `chrome-extension/dist/`。

## 安装

1. 打开 Chrome，在地址栏输入 `chrome://extensions`；
2. 开启右上角“开发者模式”；
3. 点击“加载已解压的扩展程序”；
4. 选择本项目的 `chrome-extension/dist` 目录；
5. 点击工具栏中的 Pocket PT 图标打开侧边栏；
6. 打开或切换到 PT 页面，在侧边栏点击“读取当前页面”；
7. 首次读取某个站点时，点击“允许读取本站”。Chrome 只授予当前站点 origin 的权限；
8. 切换标签页不会关闭侧边栏，需要更新数据时点击顶部“刷新数据”。

mTorrent 会从首页用户名链接 `/profile/detail/<UUID>` 提取 UUID。令牌不会自动读取，请前往 M-Team 控制台实验室复制后手动填写。

NexusPHP 不使用 Token，扩展不会显示或写入 Token。Cookie 优先通过 Chrome Cookie API 按当前 URL 和域名读取、合并去重，再用当前页面可见 Cookie 补充缺失项；首次读取必须明确授予当前域名权限。站点禁止页面存储访问或 Cookie API 暂时失败时，架构和其他字段仍可继续读取。

修改源代码后，需要重新执行 `npm run build`，再到扩展管理页面点击刷新。

## 隐私与安全

- 扩展不发送网络请求，不包含分析或错误上报服务；
- 站点配置和凭据只存在于当前侧边栏内存中，不使用 `chrome.storage`、IndexedDB 或本地文件保存；
- 关闭侧边栏会丢弃当前编辑内容和二维码；
- Cookie、Token、UID 和 Passkey 默认遮挡；
- 二维码包含站点登录凭据，请勿截图或分享；
- 二维码使用 Deflate 和 Base64URL 压缩编码，这不是加密。

## 二维码协议

```text
pocket-pt://import/site?v=1&data=<base64url(deflateRaw(UTF-8 JSON))>
```

解压后的 `site` 字段与 Flutter 项目中的 `SiteConfig` 字段保持一致。协议版本为 `1`。

## 发布前验收

自动测试覆盖架构识别、Cookie 存储区和过滤、凭据提取、种子页面、草稿校验、二维码协议、Chrome 权限编排和侧边栏行为。

由于真实 PT 站点需要用户登录，发布前仍需在以下真实页面手动检查一次：

- 朱雀；
- M-Team；
- 海胆；
- 至少一个 NexusPHP 站点；
- 一个 Gazelle 或 UNIT3D 站点。

验收时不要把 Cookie、Token、UID、Passkey 或二维码写入日志、截图或问题报告。
