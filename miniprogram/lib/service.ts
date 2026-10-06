import { State, Command } from './types';
import { demoState } from './seed';
import { applyCommand } from './commands';
import { config } from './config';
const STORE = 'paw-diary-demo-v1', SELECTED = 'paw-diary-selected';
let cached: State | null = null, selected = '', networkOnline = true, epoch = 0;
export let families: {id:string;name:string}[] = [];
export function isDemo() { return config.mode === 'demo'; }
export function online() { return networkOnline; }
export function setOnline(value: boolean) { networkOnline = value; }
export function uid(prefix = 'record') { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,12)}`; }
async function call(action: string, data: any = {}): Promise<any> {
  const requestEpoch=epoch;
  if (!networkOnline) throw new Error('当前离线，输入已保留；联网后请重试保存');
  const response = await wx.cloud.callFunction({name:config.functionName,data:{action,...data}});
  const result = response.result as any;
  if (!result?.ok) throw new Error(result?.message || '云端请求失败，请重试');
  if (result.state && requestEpoch===epoch && (!cached || cached.family.id!==result.state.family.id || cached.family.version<=result.state.family.version)) cached = result.state;
  if (result.families && requestEpoch===epoch) families = result.families;
  return result;
}
export async function initialize(): Promise<State> {
  if (cached) return cached;
  selected = wx.getStorageSync(SELECTED) || '';
  if (isDemo()) {
    const stored = wx.getStorageSync(STORE);
    cached = stored?.schemaVersion === 1 ? stored : demoState();
    families = [{id:cached!.family.id,name:cached!.family.name}];
    return cached!;
  }
  if (!config.cloudEnv) throw new Error('请先配置云开发环境ID');
  wx.cloud.init({env:config.cloudEnv});
  await call('bootstrap'); return cached!;
}
export async function getState(force = false): Promise<State> { await initialize(); if (force && !isDemo()) await call('read'); return cached!; }
export function selectedPetId(state: State): string {
  if (!state.pets.some(p=>p.id===selected && !p.archived)) selected = state.pets.find(p=>!p.archived)?.id || '';
  return selected;
}
export function selectPet(id: string) { selected=id; wx.setStorageSync(SELECTED,id); }
export async function execute(command: Command): Promise<State> {
  await initialize();
  if (isDemo()) {
    const next = applyCommand(cached!,command,cached!.currentUser.id);
    wx.setStorageSync(STORE,next); // A quota/write failure must never report success.
    cached=next;
  } else { await call('command',{command}); }
  return cached!;
}
export async function invite(): Promise<string> {
  if (isDemo()) throw new Error('本地演示不支持真实邀请；配置云开发后即可邀请家人');
  return (await call('invite')).code;
}
export async function join(code: string) { if (isDemo()) throw new Error('本地演示不能加入真实家庭'); epoch++;await call('join',{code:code.trim()}); selected=''; await call('bootstrap'); }
export async function switchFamily(familyId:string) { epoch++;await call('switchFamily',{familyId}); selected=''; }
export async function resetDemo() { wx.removeStorageSync(STORE); cached=demoState(); selected=''; wx.setStorageSync(STORE,cached); }
export async function switchDemoActor(id:string) {
  await initialize(); const actor = cached!.family.members.find(m=>m.id===id); if (!actor) throw new Error('演示成员不存在');
  cached!.currentUser={...actor}; wx.setStorageSync(STORE,cached);
}
export async function choosePhotos(existing: string[] = [], progress?: (photos:string[])=>void, pending: string[] = []): Promise<string[]> {
  const selected = pending.length ? pending : (await wx.chooseMedia({count:Math.max(1,9-existing.length),mediaType:['image'],sizeType:['compressed'],sourceType:['album','camera']})).tempFiles.map(f=>f.tempFilePath);
  const output = [...existing];
  for (let index=0;index<selected.length;index++) {
    try {
    const compressed = await wx.compressImage({src:selected[index],quality:75});
    if (isDemo()) {
      const saved = await new Promise<{savedFilePath:string}>((resolve,reject)=>wx.getFileSystemManager().saveFile({tempFilePath:compressed.tempFilePath,success:resolve,fail:reject}));
      output.push(saved.savedFilePath);
    } else {
      if (!online()) throw new Error('当前离线，请联网后重试上传照片');
      const upload = await wx.cloud.uploadFile({cloudPath:`uploads/${cached!.currentUser.id}/${uid('photo')}.jpg`,filePath:compressed.tempFilePath});
      output.push(upload.fileID);
    }
    progress?.([...output]);
    }catch(error:any){error.pendingFiles=selected.slice(index);throw error;}
  }
  return output;
}
export async function resolvePhotos(ids:string[]):Promise<string[]> {
  if (!ids.length || isDemo()) return ids;
  const cloudIds = ids.filter(p=>p.startsWith('cloud://'));
  if (!cloudIds.length) return ids;
  const result = await call('media',{fileIds:cloudIds});
  const urls = new Map<string,string>(result.files.map((f:any)=>[f.fileID,f.tempFileURL]));
  return ids.map(id=>urls.get(id)||id);
}
