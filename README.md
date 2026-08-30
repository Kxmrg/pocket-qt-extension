# Pocket Qt 站点导入插件

一个用于 Pocket Qt App 快速添加站点的 Chrome 扩展。它可以从已登录的站点读取导入所需的配置，并生成供 Pocket Qt 手机端扫码导入的二维码。

## 功能

- 识别 NexusPHP、TNode、mTorrent、SunnyPt 和 HaiDanPt 架构站点；
- 读取并整理当前站点的 Cookie 和必要配置；
- 支持手动修改站点信息和页面信息；
- 在 Chrome 侧边栏中生成 Pocket Qt 导入二维码。

Gazelle 和 UNIT3D 可被识别，但 Pocket Qt 暂不支持导入，后续可能会提供支持。

## 开发

需要 Node.js 24 或兼容版本。

```bash
npm install
npm test
npm run build
```

构建产物位于 `dist/` 目录。

## 安装

1. 运行 `npm run build`；
2. 在 Chrome 中打开 `chrome://extensions`；
3. 开启“开发者模式”；
4. 点击“加载已解压的扩展程序”；
5. 选择构建后的 `dist/` 目录。

插件需要 Chrome 132 或更高版本。打开 PT 站页面后，点击插件图标即可在侧边栏中读取和编辑配置。

## 隐私与安全

- 插件不会把站点配置或凭据发送到网络；
- 配置和凭据只保留在当前侧边栏内存中；
- Cookie、Token、UID 和 Passkey 默认遮挡；
- 二维码包含站点登录凭据，请勿截图或分享；
- 二维码的压缩编码不是加密。

为完成核心功能，插件需要读取当前 HTTP/HTTPS 站点的页面和 Cookie 数据。

## License

本项目使用 [MIT License](LICENSE) 开源。
