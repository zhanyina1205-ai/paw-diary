# 爪爪日记 🐾

原生微信小程序：多狗档案、每日热量与喂食克数、专业鲜食配比、零食预算、照片成长日记、便便记录、健康计划和家庭协作。

界面采用奶油色 `#FFF8EF`、柔和粉 `#F2B8C6`、薄荷浅绿 `#D9EFE3`，搭配深灰褐文字 `#514843`。提醒同时显示文字和状态标识。

## 体验

**[打开爪爪日记网页版](https://zhanyina1205-ai.github.io/paw-diary/)** — 手机或电脑浏览器直接使用，无需 GitHub 账号或安装工具。

网页已通过 GitHub Pages 公开发布。部署操作与数据保存边界见 [GitHub 分享说明](docs/GITHUB.md)。

直接将此目录导入微信开发者工具，本机演示无需云环境。或者：

```sh
pnpm install
pnpm preview
```

浏览器打开 http://127.0.0.1:4173 。演示直接读取小程序 WXML 和编译后的页面代码，提供本机持久化、记账、鲜食清单、日记、称重曲线及健康计划；微信设备能力由适配器模拟。

## 开发和验证

```sh
pnpm check
pnpm test
pnpm build
pnpm build:web
```

需要 Node.js 20+、pnpm。微信小程序使用原生 TypeScript 编译插件，根目录依赖只用于检查、测试、构建与浏览器演示；应用无需客户端 npm 分包。

- `miniprogram/`：四个原生页面、计算与校验、演示和云端数据服务。
- `cloudfunctions/paw-family/`：微信身份、家庭授权、一次性邀请、事务与照片共享。
- `tests/`：实际计算和服务端权限/并发测试。云端测试使用内存数据库适配器，不代表云平台联调已通过。
- `preview/`：WXML浏览器适配器，不重复实现营养逻辑。

正式接入步骤见 [配置说明](docs/SETUP.md)，验收状态见 [验收清单](docs/ACCEPTANCE.md)，数据与计算接口见 [数据说明](docs/DATA.md)。

`pnpm build:web` 生成独立静态网页 `dist/`。推送到 GitHub `main` 后，Actions 会检查、测试并自动发布 Pages；首次须在仓库 Settings → Pages 中选择 GitHub Actions。

## 计算口径

目标热量来自兽医覆盖值或 AAHA 初始估算。鲜食和主粮按热量比例分配；加餐预算默认预留5%，合计上限10%。剩余预算是已知热量账目，不能据此自动决定跳过完整正餐。热量缺失时明确提示统计不完整。

专业鲜食由用户录入来源、犬龄、称重口径、完整配方和补充剂并确认专业审核；系统不自动产生或认证营养均衡配方。改动配方后需要重新确认。生重代表烹饪前称重，食谱记录量采用相同口径，不自动猜测烹饪失水率。

历史喂食保存名称、用途、单位、热量和食谱版本快照，修改食品资料不会重算过去。所有日期按北京时间，月龄按日历月计算，月末生日按对应月最后一天确定周年月。

参考：[AAHA 热量计算](https://www.aaha.org/globalassets/02-guidelines/2021-nutrition-and-weight-management/resourcepdfs/nutritiongl_box1.pdf)、[AAHA 家庭鲜食](https://www.aaha.org/resources/2021-aaha-nutrition-and-weight-management-guidelines/home-prepared-diets/)、[WSAVA 零食指南](https://wsava.org/wp-content/uploads/2024/06/Feeding-treats-to-your-dog-v2.pdf)。

## 当前边界

源码、本机演示、云函数、配置说明已提供。没有配置正式账号、云环境；微信编译、真机云端协作、手机日历权限与正式发布仍需账号持有人完成接入后验收。

首版报告附件为照片（最多9张）。删除日记不会自动删除云端图片，以免影响其他引用；取消上传可能留下未关联图片，云存储需要定期按实际引用清理。默认家庭同步刷新为前台20秒，喂食提交前额外刷新。

网页记录与照片仅保存在当前浏览器，不上传到 GitHub；清除网站数据会丢失记录，换设备也不会同步。重要记录请另行备份。手机日历、家庭云同步及后台通知不在网页体验版中提供。

## 许可证

[MIT](LICENSE) — 允许使用、修改与再发布，请保留版权及许可证声明。
