# 在 GitHub 共享与发布

## 分享给使用者

GitHub Pages 发布成功后，把 Pages 地址发给朋友，手机或电脑浏览器即可打开。网页支持喂食计算、零食预算、鲜食备餐、成长日记、照片和健康待办。每位使用者的数据保存在自己的浏览器；清除网站数据、换浏览器或换设备不会保留这些记录。网页不会把日记或照片提交到 GitHub，也不提供微信家庭同步或后台通知。重要记录请另行备份。

GitHub 源码采用 MIT 许可证。使用者可 Fork、下载 ZIP 或克隆，在保留版权声明的条件下使用和修改代码。正式微信小程序仍需自己的 AppID、云环境和发布审核，详见 [SETUP.md](SETUP.md)。

## 仓库与 Pages 首次设置

1. 在 GitHub 创建公开仓库 `paw-diary`，主分支 `main`。
2. 上传本项目源码（包含 `.github/workflows/pages.yml`、许可证和锁文件），不要上传 `node_modules`、私人配置、真实记录或凭据。
3. 打开仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。这是 [GitHub 官方支持的自定义工作流发布方式](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
4. 在 **Actions → Test and publish browser demo** 等待成功；如果首次上传时尚未设置 Pages，设置后点击 **Run workflow** 重跑。
5. 在 Settings → Pages 复制实际网站地址。公开地址通常为 `https://<账号>.github.io/paw-diary/`；只有部署成功并能打开页面后才算发布完成。

之后每次推送到 `main`，工作流会先执行类型检查和测试，再构建与发布网页。部署使用 GitHub 自动提供的短期身份，无需向源码添加令牌。

## 本地静态构建

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build:web
python3 -m http.server 4174 --directory dist
```

打开 http://127.0.0.1:4174/ 。`dist/` 是独立静态产物，支持 GitHub 仓库子路径；不要通过 `file://` 打开。公共网页构建始终使用本地演示模式，即使微信源码配置后来接入了云环境。
