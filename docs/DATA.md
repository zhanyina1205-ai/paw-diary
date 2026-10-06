# 数据与计算接口

## 云函数调用

通过 `wx.cloud.callFunction({name:'paw-family',data:{action,...payload}})` 调用。返回 `{ok:true,state?}` 或 `{ok:false,message}`。客户端不传身份；服务端通过 `cloud.getWXContext().OPENID` 取得调用者。每次授权验证当前家庭成员资格。

| action | 输入 | 输出 / 行为 |
| --- | --- | --- |
| bootstrap | 无 | 初始化个人家庭，返回 state 和可切换 families |
| read | 无 | 当前家庭一致性快照 |
| command | command | 校验、事务保存并返回最新 state |
| invite | 无 | 管理员生成 code 和 expiresAt |
| join | code | 消耗一次性邀请码，切换至该家庭 |
| switchFamily | familyId | 验证已有成员资格并切换 |
| media | fileIds[] | 验证家庭图片引用或上传者身份，返回 files[] 短期签名URL |

`State`、`Command` 及实体类型定义见 `miniprogram/lib/types.ts`。通用命令有 `save`、`delete`，以及 `feed`、`completeHealth`、`removeMember`、`rename`。已归档狗狗的记录仍保存；活跃列表隐藏它。食品和食谱正在被喂养计划引用时不允许删除。

## 一致性

读取先获取家庭版本，再分页读取实体集合，最后再次验证版本。保存基于一致性快照，在事务内重新验证成员资格和家庭版本，重试并发版本冲突。所有实体的真实数据库文档ID为 `familyId__id`。

喂食提交携带稳定 `id` 和 `requestId`。同一请求重复提交返回原记录；变更内容的重复请求被拒绝。保存后响应丢失时，客户端重新读取识别上次已保存的请求。不同家人的真实喂食分别保留。

其他表单在首次提交前分配并保留稳定ID，因此失败重试不会产生第二条记录。普通资料同时编辑采用最后一次成功保存的值；喂食历史快照不随资料修改变化。

## 计算

`domain.ts` 是小程序、演示、测试和云函数共享的纯计算实现。`nutrition(state,pet,date)` 返回目标、最近有效体重、建议克数、每餐量、已吃/剩余/加餐预算及缺失热量状态。`scaleRecipe` 返回按天数和每日热量缩放的食材、比例及补充剂。

照片最多9张。健康周期从实际完成日期起算，完成操作幂等。疫苗采用医院逐针计划，不设置通用自动接种间隔。日历记录按成员、家庭、事项和修订号保存在本机；计划改动后提示手动调整旧事件。

生产应定期导出数据库和存储备份。该版全家庭快照适合小规模家庭使用；大量多年历史数据可后续改为按日期分页查询，避免一次读取全部内容。
