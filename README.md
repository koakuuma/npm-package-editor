# NPM Package Viewer

类似 github1s 的 NPM 包在线查看器，使用 Monaco Editor 实现代码浏览。

## 功能特性

- 🔍 通过 URL 参数快速查看任意 NPM 包
- 📁 文件树导航
- 💻 Monaco Editor 代码高亮
- 🚀 纯静态部署，使用 jsDelivr CDN

## 使用方法

访问：`https://your-username.github.io/npm-package-editor/?packagename=包名`

例如：`https://your-username.github.io/npm-package-editor/?packagename=koishi-plugin-githubsth`

## 本地开发

```bash
npm install
npm run dev
```

## 部署

推送到 GitHub 后自动通过 GitHub Actions 部署到 GitHub Pages。

需要在仓库设置中启用 GitHub Pages，选择 gh-pages 分支。
