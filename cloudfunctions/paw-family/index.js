const cloud = require('wx-server-sdk');
const crypto = require('node:crypto');
const { emptyState } = require('./lib/seed');
const { applyCommand } = require('./lib/commands');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const collections = { pets:'pets', weights:'weights', foods:'foods', recipes:'recipes', feedings:'feedings', diaries:'diaries', healthPlans:'healthPlans' };
const clean = doc => { const { _id, _openid, ...data } = doc; return data; };
async function findDoc(reader, collection, id) {
  try { return (await reader.collection(collection).doc(id).get()).data || null; }
  catch (e) { if (/not exist|not found|不存在|DATABASE_DOCUMENT_NOT_EXIST/i.test(String(e.message || e.errMsg))) return null; throw e; }
}
async function pageAll(collection, familyId) {
  const result = []; let skip = 0;
  while (true) {
    const rows = (await db.collection(collection).where({ familyId }).orderBy('_id','asc').skip(skip).limit(100).get()).data;
    result.push(...rows.map(clean)); if (rows.length < 100) return result; skip += rows.length;
  }
}
async function bindingFor(openid) { return await findDoc(db,'bindings',openid); }
async function familyFor(openid) {
  const binding = await bindingFor(openid);
  if (!binding) throw new Error('请先初始化家庭');
  const family = await findDoc(db,'families',binding.activeFamilyId);
  if (!family || !family.members.some(m => m.id === openid)) throw new Error('你已不在该家庭中，请重新打开小程序');
  return clean(family);
}
async function bootstrap(openid) {
  let binding = await bindingFor(openid);
  if (!binding) {
    const familyId = 'family_' + crypto.createHash('sha256').update(openid).digest('hex').slice(0,32);
    await db.runTransaction(async tx => {
      const exists = await findDoc(tx,'bindings',openid); if (exists) return;
      const initial = emptyState(familyId,openid);
      await tx.collection('families').doc(familyId).set({ data: initial.family });
      await tx.collection('bindings').doc(openid).set({data:{activeFamilyId:familyId,familyIds:[familyId]}});
    });
    binding = await bindingFor(openid);
  }
  const accessible = [];
  for (const familyId of binding.familyIds) {
    const f = await findDoc(db,'families',familyId);
    if (f && f.members.some(m => m.id === openid)) accessible.push({id:familyId,name:f.name});
  }
  if (!accessible.length) throw new Error('当前家庭成员资格已取消，请联系家庭管理员重新邀请');
  if (!accessible.some(f=>f.id===binding.activeFamilyId)) {
    await db.collection('bindings').doc(openid).update({data:{activeFamilyId:accessible[0].id}});
  }
  return accessible;
}
async function snapshot(openid) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const family = await familyFor(openid);
    const lists = await Promise.all(Object.entries(collections).map(async ([key,col]) => [key, await pageAll(col,family.id)]));
    const after = await familyFor(openid);
    if (after.id !== family.id || after.version !== family.version) continue;
    return { schemaVersion:1, family, currentUser:family.members.find(m=>m.id===openid), ...Object.fromEntries(lists) };
  }
  throw new Error('家人正在更新记录，请稍后重试');
}
async function mutate(openid, command) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const before = await snapshot(openid);
    if (command?.type === 'save' && ['diary','health'].includes(command.entity)) {
      const references = new Set([...before.diaries.flatMap(d=>d.photos), ...before.healthPlans.flatMap(h=>h.attachments)]);
      const files = command.entity === 'diary' ? command.value?.photos : command.value?.attachments;
      if (!Array.isArray(files) || files.some(file=>typeof file !== 'string' || !file.startsWith('cloud://') || (!references.has(file) && !file.includes(`/uploads/${openid}/`)))) {
        throw new Error('无权引用其他家庭的附件，请重新上传');
      }
    }
    const after = applyCommand(before,command,openid);
    try {
      await db.runTransaction(async tx => {
        const live = await findDoc(tx,'families',before.family.id);
        const binding = await findDoc(tx,'bindings',openid);
        if (binding.activeFamilyId !== before.family.id || !live.members.some(m=>m.id===openid)) throw new Error('家庭权限已变更');
        if (live.version !== before.family.version) throw new Error('VERSION_CONFLICT');
        if (after.family.version === before.family.version) return;
        for (const [key, collection] of Object.entries(collections)) {
          const old = new Map(before[key].map(x=>[x.id,x])), next = new Map(after[key].map(x=>[x.id,x]));
          for (const [id, value] of next) if (JSON.stringify(old.get(id)) !== JSON.stringify(value)) {
            // Namespace document IDs to prevent a guessed ID from overwriting a different household.
            await tx.collection(collection).doc(`${before.family.id}__${id}`).set({data:value});
          }
          for (const id of old.keys()) if (!next.has(id)) await tx.collection(collection).doc(`${before.family.id}__${id}`).remove();
        }
        await tx.collection('families').doc(before.family.id).set({data:after.family});
      });
      return;
    } catch(e) { if (e.message === 'VERSION_CONFLICT') continue; throw e; }
  }
  throw new Error('家人正在更新记录，请重试，重复喂食提交不会重复保存');
}
async function createInvite(openid) {
  const family = await familyFor(openid), code = crypto.randomBytes(12).toString('hex');
  await db.runTransaction(async tx => {
    const current = await findDoc(tx,'families',family.id);
    if (!current.members.some(m=>m.id===openid && m.admin)) throw new Error('只有管理员可以邀请家人');
    await tx.collection('invites').doc(code).set({data:{familyId:family.id,creatorId:openid,expiresAt:Date.now()+48*3600000,used:false}});
  });
  return {code,expiresAt:Date.now()+48*3600000};
}
async function join(openid, code) {
  if (typeof code !== 'string' || !/^[a-f0-9]{24}$/.test(code)) throw new Error('邀请码无效');
  await db.runTransaction(async tx => {
    const invite = await findDoc(tx,'invites',code);
    if (!invite || invite.used || invite.expiresAt < Date.now()) throw new Error('邀请码已使用或过期');
    const family = await findDoc(tx,'families',invite.familyId), binding = await findDoc(tx,'bindings',openid);
    if (!family || !family.members.some(m=>m.id===invite.creatorId && m.admin)) throw new Error('邀请已失效');
    if (!family.members.some(m=>m.id===openid)) family.members.push({id:openid,name:'家人',admin:false});
    family.version++;
    const familyIds = [...new Set([...(binding?.familyIds || []),family.id])];
    await tx.collection('families').doc(family.id).set({data:clean(family)});
    await tx.collection('bindings').doc(openid).set({data:{familyIds,activeFamilyId:family.id}});
    await tx.collection('invites').doc(code).update({data:{used:true,usedBy:openid}});
  });
}
exports.main = async event => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return {ok:false,message:'无法确认微信身份'};
  try {
    const action = event?.action;
    if (action === 'bootstrap') { const families = await bootstrap(openid); return {ok:true,state:await snapshot(openid),families}; }
    if (action === 'read') return {ok:true,state:await snapshot(openid)};
    if (action === 'media') {
      const state = await snapshot(openid);
      const allowed = new Set([...state.diaries.flatMap(d=>d.photos),...state.healthPlans.flatMap(h=>h.attachments)]);
      if (!Array.isArray(event.fileIds) || event.fileIds.length>50 || event.fileIds.some(id=>typeof id!=='string' || !id.startsWith('cloud://') || (!allowed.has(id) && !id.includes(`/uploads/${openid}/`)))) throw new Error('家庭附件权限校验失败');
      const response = await cloud.getTempFileURL({fileList:event.fileIds.map(fileID=>({fileID,maxAge:600}))});
      return {ok:true,files:response.fileList};
    }
    if (action === 'command') { await mutate(openid,event.command); return {ok:true,state:await snapshot(openid)}; }
    if (action === 'invite') return {ok:true,...await createInvite(openid)};
    if (action === 'join') { await join(openid,event.code); return {ok:true,state:await snapshot(openid)}; }
    if (action === 'switchFamily') {
      const b = await bindingFor(openid), f = await findDoc(db,'families',event.familyId);
      if (!b?.familyIds.includes(event.familyId) || !f?.members.some(m=>m.id===openid)) throw new Error('无权访问该家庭');
      await db.collection('bindings').doc(openid).update({data:{activeFamilyId:event.familyId}});
      return {ok:true,state:await snapshot(openid)};
    }
    throw new Error('操作无效');
  } catch(e) {
    console.error('paw-family operation failed', {action:event?.action,name:e.name,message:e.message});
    return {ok:false,message:e.name==='DomainError' || /家庭|成员|邀请|重试|初始化|身份|操作/.test(e.message) ? e.message : '云端暂时无法保存，请保留输入并重试'};
  }
};
