import * as service from './service';
import { State } from './types';
import { age, nutrition, round, today } from './domain';
export const display = (n:number|null|undefined, decimals=1) => n == null ? '—' : String(round(n,decimals));
export function fields(this:any,event:any) {
  const field=event.currentTarget.dataset.field, form=event.currentTarget.dataset.form || 'form';
  let value=event.detail.value;
  const options=event.currentTarget.dataset.options;
  const changes:any={};
  if(options) {
    const index=Number(value);value=this.data[options][index].value;
    const indexes:any={units:'foodUnitIndex',roles:'roleIndex',purposes:'purposeIndex',bases:'basisIndex',stools:'stoolIndex',colors:'colorIndex',stages:'stageIndex',healthKinds:'kindIndex'};
    if(indexes[options])changes[indexes[options]]=index;
  }
  this.setData({[`${form}.${field}`]:value,...changes});
}
export function basePage(extra:any) {
  const extraData=extra.data || {}, extraShow=extra.afterRefresh, extraLoad=extra.onLoad;
  return {
    ...extra,
    data:{pets:[],pet:null,petIndex:0,petNames:[],isDemo:service.isDemo(),online:true,loading:false,busy:false,error:'',status:'',date:today(),...extraData},
    onLoad(options:any) { extraLoad?.call(this,options); },
    onShow() {
      this.refresh(true);
      this._timer=setInterval(()=>{if(!this.data.busy && !this._refreshing)this.refresh(true,true);},20000);
    },
    onHide() {clearInterval(this._timer);}, onUnload() {clearInterval(this._timer);},
    async refresh(force=false,quiet=false) {
      if(this._refreshing){if(!quiet)this._refreshAgain=true;return;}
      this._refreshing=true;
      if(!quiet)this.setData({loading:true,error:''});
      try {
        const state=await service.getState(force); this._state=state;
        const pets=state.pets.filter(p=>!p.archived), selected=service.selectedPetId(state), pet=pets.find(p=>p.id===selected)||null;
        if(this._petId && this._petId!==selected) {
          this._feedId='';this._pendingPhotos=[];this._pendingAttachments=[];this.setData({petEditing:false,healthEditing:false,diaryEditing:false,pendingPhotoCount:0,pendingAttachmentCount:0});
          if(this.data.form?.amount!==undefined)this.setData({'form.amount':''});
        }
        this._petId=selected;
        const summary=pet?nutrition(state,pet):null;
        this.setData({pets,pet,petNames:pets.map(p=>p.name),petIndex:Math.max(0,pets.findIndex(p=>p.id===selected)),
          age:pet?age(pet.birthday).label:'',family:state.family,currentUser:state.currentUser,online:service.online(),
          date:today(),summary:summary?{...summary,targetText:display(summary.target,0),fedText:display(summary.fed),remainingText:display(summary.remaining),
            dryText:display(summary.dryGrams),freshText:display(summary.freshGrams),dryMealText:display(summary.dryPerMeal),freshMealText:display(summary.freshPerMeal),
            weightText:display(summary.weight?.kg,2),snackText:display(summary.snackFed),snackLimitText:display(summary.snackLimit),
            progress:Math.round(summary.progress),rerText:display(summary.rer,0),snackRemainingText:display(summary.snackLimit==null?null:Math.max(0,summary.snackLimit-summary.snackFed))}:null,
            status:service.isDemo()?'本机演示 · 不会同步到家人设备':service.online()?'云端记录已刷新':'离线 · 显示上次记录',error:''});
        if(extraShow)await extraShow.call(this,state,pet);
      }catch(e:any){this.setData({error:e.message||'暂时无法读取，请重试',online:service.online()});}
      finally{this._refreshing=false;this.setData({loading:false});if(this._refreshAgain){this._refreshAgain=false;this.refresh(force);}}
    },
    async switchPet(e:any) { if(this.data.busy)return;const p=this.data.pets[Number(e.detail.value)];if(p){service.selectPet(p.id);this.setData({petEditing:false,healthEditing:false,diaryEditing:false});await this.refresh();} },
    fieldChange: fields,
    async mutate(command:any,success='已保存') {
      if(this.data.busy)return false;
      this.setData({busy:true,error:'',status:'正在保存…'});
      try {await service.execute(command);this.setData({status:service.isDemo()?'已保存到本机':'已保存到云端'});wx.showToast({title:success,icon:'success'});await this.refresh();return true;}
      catch(e:any){this.setData({error:e.message||'保存失败，输入已保留，请重试',status:'保存失败 · 输入已保留'});return false;}
      finally{this.setData({busy:false});}
    },
    async deleteRecord(e:any) {
      const {entity,id}=e.currentTarget.dataset;
      const confirmation=await wx.showModal({title:entity==='pet'?'归档这只狗狗？':'删除这条记录？',content:entity==='pet'?'成长记录会保留，狗狗将从日常列表隐藏。':'删除后会重新计算相关统计。',confirmText:entity==='pet'?'归档':'删除',confirmColor:'#96546A'});
      if(confirmation.confirm)await this.mutate({type:'delete',entity,id},entity==='pet'?'已归档':'已删除');
    },
    goProfile(){wx.switchTab({url:'/pages/profile/index'});},
    retry(){this.refresh(true);},
    stop(){},
    async previewPhoto(e:any){const urls=await service.resolvePhotos(e.currentTarget.dataset.photos||[]);wx.previewImage({current:urls[Number(e.currentTarget.dataset.index)]||urls[0],urls});}
  };
}
