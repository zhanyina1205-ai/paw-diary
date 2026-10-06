# 导入与云开发配置

## 1. 立即体验本地版

在微信开发者工具导入仓库根目录（包含 project.config.json）。默认 `appid: touristappid`、`mode: demo`，不连接云端。开发者工具如要求账号，使用工具提供的测试号导入；本地演示不依赖测试号的云能力。

开发者工具启用 TypeScript 编译插件（项目配置已开启）。首页会加载两只示例狗狗、示例主粮和健康事项，所有示例都标明演示用途。实际记录保存在当前微信本机存储中。昵称和「模拟此人记录」可体验操作者留痕，不能替代真实跨设备协作。

浏览器体验使用实际 WXML 与编译后的 TypeScript，设备接口由本地适配器模拟：

```sh
pnpm install
pnpm preview
```

打开 http://127.0.0.1:4173 。浏览器记录与微信本机记录相互独立。关闭服务后该地址不再可用。此体验不验证微信原生渲染、权限、登录或云能力。

## 2. 注册和绑定云环境

用户在 [微信公众平台](https://mp.weixin.qq.com/) 注册小程序，完成主体信息和开发者绑定，在微信开发者工具使用正式 AppID 导入。账号实名、平台协议及可能的付费步骤由账号持有人完成。

开通并绑定微信云开发环境，记录环境ID。在 `project.config.json` 将 `appid` 替换为正式 AppID；在 `miniprogram/lib/config.ts` 设置：

```ts
export const config = {
  mode: 'cloud' as 'demo' | 'cloud',
  cloudEnv: '你的实际环境ID',
  functionName: 'paw-family'
};
```

不要填写 AppSecret；客户端不需要、也不应持有该密钥。

## 3. 数据集合和权限

在云开发数据库创建以下10个空集合：

- `families`、`bindings`、`invites`
- `pets`、`weights`、`foods`、`recipes`
- `feedings`、`diaries`、`healthPlans`

每个集合均设置「仅管理端可读写」，即客户端权限规则：

```json
{"read": false, "write": false}
```

所有应用读写通过 `paw-family` 云函数进行；禁止设置成「所有用户可读写」。云函数用微信上下文中的 OPENID 验证成员身份，家庭元数据的版本锁和事务保护每次变更。实体文档ID包含家庭ID，防止相同业务ID跨家庭覆盖。

为以下七个记录集合配置组合索引：`familyId` 升序、`_id` 升序，支持分页读取：`pets`、`weights`、`foods`、`recipes`、`feedings`、`diaries`、`healthPlans`。

云存储采用「仅创建者可读写」权限。客户端文件路径为 `uploads/OPENID/随机标识.jpg`。家庭成员的共享读取通过云函数校验记录归属后获取有效期10分钟的签名地址，成员不能直接获取其他家庭文件的地址。上传者可预览自己尚未保存的草稿附件。移除成员后应用请求立即失去访问资格，已签发地址在有效期结束前可能仍可访问。

## 4. 部署云函数

```sh
pnpm check
pnpm test
```

`pnpm test` 会构建共享计算和校验代码，输出至 `cloudfunctions/paw-family/lib/`。仓库提供已构建版本，因此首次导入可直接使用；修改 `miniprogram/lib/domain.ts` 或 `commands.ts` 后必须重新构建再部署。

微信开发者工具中右击 `cloudfunctions/paw-family` → 上传并部署（云端安装依赖）。确认安装 `wx-server-sdk`，部署至配置的环境。首页首次打开会创建个人家庭；再从「档案 → 家人共用」生成一次性48小时邀请码。加入其他家庭后可切换回自己的家庭。

不配置订阅消息、外部推送、后台定时任务：页面在打开和前台每20秒刷新，日历事件由用户主动添加。

## 5. 真机与发布

先用体验版完成 `docs/ACCEPTANCE.md` 中的真机项，再上传、设置体验者、完成隐私保护指引和微信要求的相关声明、提交审核、发布。照片权限在用户点击上传时触发，日历权限在点击添加时触发。云资源按账号实际套餐使用，项目不自动购买套餐。

本仓库当前没有正式 AppID 和环境ID，也没有微信开发者工具，因此没有完成云端部署、微信编译、真机验证或发布审核。
