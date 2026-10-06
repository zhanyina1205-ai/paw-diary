import {basePage} from '../../lib/page';
import {State,Pet,HealthPlan} from '../../lib/types';
import {today,healthStatus,addDays,calendarEvent} from '../../lib/domain';
import * as service from '../../lib/service';
const blankPet=()=>({id:'',name:'',birthday:today(),breed:'',stage:'puppy',neutered:false,weaned:true,bodyCondition:5,meals:3,vetTarget:'',freshPercent:0,snackPercent:5,mainFoodId:'',mainRecipeId:'',initialWeight:'',weightDate:today()});
const blankHealth=()=>({id:'',kind:'vaccine',name:'',recordDate:'',dueDate:today(),dose:'',hospital:'',product:'',notes:'',attachments:[],repeatDays:'',advanceDays:7});
Page(basePage({
 data:{tab:'pet',archivedPets:[],petEditing:false,petForm:blankPet(),healthEditing:false,healthForm:blankHealth(),plans:[],healthPhotoUrls:[],attachmentBusy:false,pendingAttachmentCount:0,
  stages:[{value:'puppy',label:'幼犬 · 成长中'},{value:'adult',label:'成犬 · 已确认成熟'}],stageIndex:0,
  healthKinds:[{value:'vaccine',label:'疫苗'},{value:'internal',label:'体内驱虫'},{value:'external',label:'体外驱虫'},{value:'checkup',label:'体检'}],kindIndex:0,
  mainFoods:[],mainFoodIndex:0,mainRecipes:[],mainRecipeIndex:0,
  completion:{date:today()},memberForm:{name:''},joinForm:{code:''},inviteCode:'',familyOptions:[],familyIndex:0},
 onLoad(options:any){if(options.invite)this.setData({tab:'family','joinForm.code':options.invite});},
 async afterRefresh(state:State,pet:Pet|null){
  const foods=[{id:'',name:'尚未选择'},...state.foods.filter(f=>f.complete&&f.unit!=='kcalpiece')];
  const recipes=[{id:'',name:'尚未选择'},...state.recipes.filter(r=>r.purpose==='main')];
  this.setData({archivedPets:state.pets.filter(p=>p.archived),mainFoods:foods,mainRecipes:recipes,mainFoodIndex:Math.max(0,foods.findIndex(f=>f.id===this.data.petForm.mainFoodId)),mainRecipeIndex:Math.max(0,recipes.findIndex(r=>r.id===this.data.petForm.mainRecipeId)),
   familyOptions:service.families,familyIndex:Math.max(0,service.families.findIndex(f=>f.id===state.family.id)),
   plans:pet?state.healthPlans.filter(p=>p.petId===pet.id).sort((a,b)=>Number(!!a.completedAt)-Number(!!b.completedAt)||a.dueDate.localeCompare(b.dueDate)).map(p=>{
    const stamp=wx.getStorageSync(`calendar_${state.currentUser.id}_${state.family.id}_${p.id}`);
    return {...p,status:healthStatus(p),kindLabel:this.data.healthKinds.find((k:any)=>k.value===p.kind).label,calendarAdded:stamp===p.revision,calendarChanged:!!stamp&&stamp!==p.revision};
   }):[]});
  if(!this.data.memberForm.name)this.setData({'memberForm.name':state.currentUser.name});
 },
 tabChange(e:any){this.setData({tab:e.currentTarget.dataset.tab,error:''});},
 newPet(){this.setData({petForm:blankPet(),petEditing:true,stageIndex:0,mainFoodIndex:0,mainRecipeIndex:0,error:''});},
 editPet(){if(!this.data.pet)return;this.setData({petForm:{...this.data.pet,vetTarget:this.data.pet.vetTarget??'',initialWeight:'',weightDate:today()},petEditing:true,stageIndex:this.data.pet.stage==='puppy'?0:1,mainFoodIndex:Math.max(0,this.data.mainFoods.findIndex((f:any)=>f.id===this.data.pet.mainFoodId)),mainRecipeIndex:Math.max(0,this.data.mainRecipes.findIndex((r:any)=>r.id===this.data.pet.mainRecipeId))});},
 mainFoodChange(e:any){const i=Number(e.detail.value);this.setData({mainFoodIndex:i,'petForm.mainFoodId':this.data.mainFoods[i].id});},
 mainRecipeChange(e:any){const i=Number(e.detail.value);this.setData({mainRecipeIndex:i,'petForm.mainRecipeId':this.data.mainRecipes[i].id});},
 async savePet(){if(this.data.busy)return;const f=this.data.petForm,id=f.id||service.uid('pet');this.setData({'petForm.id':id});const value={...f,id,meals:Number(f.meals),bodyCondition:Number(f.bodyCondition),freshPercent:Number(f.freshPercent),snackPercent:Number(f.snackPercent),vetTarget:f.vetTarget===''?null:Number(f.vetTarget),initialWeight:f.initialWeight===''?null:Number(f.initialWeight)};
   if(await this.mutate({type:'save',entity:'pet',value})){service.selectPet(id);this.setData({petEditing:false,petForm:blankPet()});await this.refresh();}},
 cancelPet(){this.setData({petEditing:false});},
 async restorePet(e:any){const p=this._state.pets.find((p:Pet)=>p.id===e.currentTarget.dataset.id);if(p&&await this.mutate({type:'save',entity:'pet',value:p},'已恢复档案')){service.selectPet(p.id);await this.refresh();}},
 newHealth(){this._pendingAttachments=[];if(!this.data.pet){this.setData({error:'请先添加狗狗'});return;}this.setData({healthForm:blankHealth(),healthEditing:true,kindIndex:0,healthPhotoUrls:[],pendingAttachmentCount:0,error:''});},
 async editHealth(e:any){this._pendingAttachments=[];this.setData({pendingAttachmentCount:0});const h=this._state.healthPlans.find((h:HealthPlan)=>h.id===e.currentTarget.dataset.id);this.setData({healthForm:{...h,repeatDays:h.repeatDays??''},healthEditing:true,kindIndex:this.data.healthKinds.findIndex((k:any)=>k.value===h.kind),healthPhotoUrls:await service.resolvePhotos(h.attachments)});},
 cancelHealth(){this._pendingAttachments=[];this.setData({healthEditing:false,pendingAttachmentCount:0});},
 calculateNext(){const f=this.data.healthForm,days=Number(f.repeatDays);if(!f.recordDate||!(Number.isInteger(days)&&days>=1&&days<=3650)){this.setData({error:'先填写上次完成日期与有效的周期天数'});return;}this.setData({'healthForm.dueDate':addDays(f.recordDate,days),error:''});},
 async addAttachments(){if(this.data.attachmentBusy||this.data.healthForm.attachments.length>=9)return;this.setData({attachmentBusy:true});try{const attachments=await service.choosePhotos(this.data.healthForm.attachments,attachments=>this.setData({'healthForm.attachments':attachments}),this._pendingAttachments||[]);this._pendingAttachments=[];this.setData({'healthForm.attachments':attachments,healthPhotoUrls:await service.resolvePhotos(attachments),pendingAttachmentCount:0});}catch(e:any){this._pendingAttachments=e.pendingFiles||[];this.setData({pendingAttachmentCount:this._pendingAttachments.length});if(!String(e.errMsg||'').includes('cancel'))this.setData({error:e.message||'附件上传失败，已上传附件及输入已保留，请重试'});}finally{this.setData({attachmentBusy:false});}},
 async removeAttachment(e:any){const attachments=this.data.healthForm.attachments.filter((_:any,i:number)=>i!==Number(e.currentTarget.dataset.index));this._pendingAttachments=[];this.setData({'healthForm.attachments':attachments,healthPhotoUrls:await service.resolvePhotos(attachments),pendingAttachmentCount:0});},
 async saveHealth(){if(!this.data.pet||this.data.busy)return;const f=this.data.healthForm,id=f.id||service.uid('health');this.setData({'healthForm.id':id});if(await this.mutate({type:'save',entity:'health',value:{...f,id,petId:this.data.pet.id,repeatDays:f.kind==='vaccine'||f.repeatDays===''?null:Number(f.repeatDays),advanceDays:Number(f.advanceDays)}})){this.setData({healthEditing:false,healthForm:blankHealth(),healthPhotoUrls:[]});}},
 async completeHealth(e:any){const confirm=await wx.showModal({title:'确认已经完成？',content:`完成日期：${this.data.completion.date}。周期事项会从实际完成日期计算下一次。`,confirmColor:'#96546A'});if(confirm.confirm)await this.mutate({type:'completeHealth',id:e.currentTarget.dataset.id,date:this.data.completion.date},'已记录完成');},
 async addCalendar(e:any){const h=this._state.healthPlans.find((h:HealthPlan)=>h.id===e.currentTarget.dataset.id);if(!h||!this.data.pet)return;
  const event=calendarEvent(h,this.data.pet),manual=`${event.title}\n${h.dueDate} 09:00（北京时间）\n提前1天提醒\n${h.hospital||h.product} ${h.notes}`;
  if(!wx.canIUse('addPhoneCalendar')){const r=await wx.showModal({title:'请手动添加日历',content:manual,confirmText:'复制信息'});if(r.confirm)await wx.setClipboardData({data:manual});return;}
  try{await wx.addPhoneCalendar(event);wx.setStorageSync(`calendar_${this._state.currentUser.id}_${this._state.family.id}_${h.id}`,h.revision);wx.showToast({title:'已添加日历',icon:'success'});await this.refresh();}
  catch{const r=await wx.showModal({title:'日历未添加',content:`未取得日历权限或添加失败。你可以到手机日历手动添加：\n${manual}`,confirmText:'复制信息'});if(r.confirm)await wx.setClipboardData({data:manual});}
 },
 async saveNickname(){await this.mutate({type:'rename',name:this.data.memberForm.name});},
 async createInvite(){try{this.setData({inviteCode:await service.invite(),error:''});}catch(e:any){this.setData({error:e.message});}},
 copyInvite(){wx.setClipboardData({data:this.data.inviteCode});},
 async joinFamily(){try{this.setData({busy:true});await service.join(this.data.joinForm.code);this.setData({inviteCode:'','joinForm.code':'','memberForm.name':''});await this.refresh(true);}catch(e:any){this.setData({error:e.message});}finally{this.setData({busy:false});}},
 async removeMember(e:any){const r=await wx.showModal({title:'移除这位家人？',content:'移除后对方无法读取或修改这个家庭的记录，历史喂食记录会保留。',confirmColor:'#96546A'});if(r.confirm)await this.mutate({type:'removeMember',id:e.currentTarget.dataset.id},'成员已移除');},
 async familyChange(e:any){try{await service.switchFamily(this.data.familyOptions[Number(e.detail.value)].id);this.setData({'memberForm.name':''});await this.refresh(true);}catch(e:any){this.setData({error:e.message});}},
 async demoActor(e:any){await service.switchDemoActor(e.currentTarget.dataset.id);this.setData({'memberForm.name':''});await this.refresh();},
 async resetDemo(){const r=await wx.showModal({title:'重置本机演示？',content:'将清除本机演示记录，重新载入示例狗狗；云端数据不受影响。',confirmColor:'#96546A'});if(r.confirm){await service.resetDemo();await this.refresh();}},
 onShareAppMessage(){return {title:'一起来照顾我们的毛孩子 🐾',path:`/pages/profile/index${this.data.inviteCode?'?invite='+this.data.inviteCode:''}`};}
}));
