import {basePage} from '../../lib/page';
import {State,Pet} from '../../lib/types';
import {today,daysBetween} from '../../lib/domain';
import * as service from '../../lib/service';
const blank=()=>({id:'',date:today(),text:'',photos:[],weight:'',stool:'',color:'',abnormal:''});
Page(basePage({
 data:{form:blank(),diaryEditing:false,entries:[],formPhotoUrls:[],stools:[{value:'',label:'未记录'},{value:'偏硬干燥',label:'偏硬干燥'},{value:'成形适中',label:'成形适中'},{value:'偏软',label:'偏软'},{value:'不成形',label:'不成形'},{value:'水样',label:'水样'}],
   colors:[{value:'',label:'未记录'},{value:'棕色',label:'棕色'},{value:'黄色',label:'黄色'},{value:'绿色',label:'绿色'},{value:'黑色',label:'黑色'},{value:'带红色',label:'带红色'},{value:'灰白色',label:'灰白色'}],stoolIndex:0,colorIndex:0,weightCount:0,photoBusy:false,pendingPhotoCount:0},
 async afterRefresh(state:State,pet:Pet|null){
  if(this._lastPet&&this._lastPet!==pet?.id)this.setData({diaryEditing:false,form:blank()});this._lastPet=pet?.id;
  const entries=pet?state.diaries.filter(d=>d.petId===pet.id).sort((a,b)=>b.date.localeCompare(a.date)):[];
  const resolved=await Promise.all(entries.map(async e=>({...e,photoUrls:await service.resolvePhotos(e.photos)})));
  this.setData({entries:resolved,weightCount:pet?state.weights.filter(w=>w.petId===pet.id).length:0});
  if(pet)this.drawChart(state,pet);
 },
 newEntry(){this._pendingPhotos=[];this.setData({diaryEditing:true,form:blank(),formPhotoUrls:[],pendingPhotoCount:0,stoolIndex:0,colorIndex:0,error:''});},
 async editEntry(e:any){this._pendingPhotos=[];this.setData({pendingPhotoCount:0});const d=this._state.diaries.find((d:any)=>d.id===e.currentTarget.dataset.id);this.setData({form:{...d,weight:d.weight??''},diaryEditing:true,formPhotoUrls:await service.resolvePhotos(d.photos),stoolIndex:this.data.stools.findIndex((s:any)=>s.value===d.stool),colorIndex:this.data.colors.findIndex((s:any)=>s.value===d.color)});},
 cancel(){this._pendingPhotos=[];this.setData({diaryEditing:false,pendingPhotoCount:0});},
 async addPhotos(){if(this.data.photoBusy||this.data.form.photos.length>=9)return;this.setData({photoBusy:true});try{const photos=await service.choosePhotos(this.data.form.photos,photos=>this.setData({'form.photos':photos}),this._pendingPhotos||[]);this._pendingPhotos=[];this.setData({'form.photos':photos,formPhotoUrls:await service.resolvePhotos(photos),pendingPhotoCount:0});}catch(e:any){this._pendingPhotos=e.pendingFiles||[];this.setData({pendingPhotoCount:this._pendingPhotos.length});if(!String(e.errMsg||'').includes('cancel'))this.setData({error:e.message||e.errMsg||'照片上传失败，已上传的照片和其他输入已保留；点击重试'});}finally{this.setData({photoBusy:false});}},
 async removePhoto(e:any){const photos=this.data.form.photos.filter((_:any,i:number)=>i!==Number(e.currentTarget.dataset.index));this._pendingPhotos=[];this.setData({'form.photos':photos,formPhotoUrls:await service.resolvePhotos(photos),pendingPhotoCount:0});},
 async saveDiary(){if(!this.data.pet||this.data.busy)return;const f=this.data.form,id=f.id||service.uid('diary');this.setData({'form.id':id});if(await this.mutate({type:'save',entity:'diary',value:{...f,id,petId:this.data.pet.id,weight:f.weight===''?null:Number(f.weight)}})){this.setData({diaryEditing:false,form:blank(),formPhotoUrls:[]});}},
 drawChart(state:State,pet:Pet){
   const byDate=new Map<string,number>();for(const w of state.weights.filter(w=>w.petId===pet.id&&w.date<=today()).sort((a,b)=>a.date.localeCompare(b.date)||(a.updatedAt||'').localeCompare(b.updatedAt||'')))byDate.set(w.date,w.kg);
   const points=[...byDate.entries()].slice(-30);if(!points.length)return;
   wx.nextTick(()=>wx.createSelectorQuery().in(this).select('#weight-chart').boundingClientRect((rect:any)=>{
    if(!rect)return;const ctx=wx.createCanvasContext('weight-chart',this),width=rect.width,height=rect.height;
    const values=points.map(p=>p[1]),low=Math.max(0,Math.min(...values)-.3),high=Math.max(...values)+.3,left=40,right=18,top=18,bottom=35;
    ctx.clearRect(0,0,width,height);ctx.setFontSize(11);ctx.setFillStyle('#786B65');ctx.setStrokeStyle('#E5DCD0');
    for(let i=0;i<3;i++){const y=top+i*(height-top-bottom)/2;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(width-right,y);ctx.stroke();ctx.fillText((high-i*(high-low)/2).toFixed(1),0,y+4);}
    const span=daysBetween(points[0][0],points[points.length-1][0])||1;
    const coords=points.map(([d,kg])=>[left+(points.length===1?.5:daysBetween(points[0][0],d)/span)*(width-left-right),top+(high-kg)/(high-low)*(height-top-bottom)]);
    ctx.setStrokeStyle('#96546A');ctx.setLineWidth(2.5);ctx.beginPath();coords.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
    ctx.setFillStyle('#96546A');coords.forEach(([x,y])=>{ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();});
    ctx.setFillStyle('#786B65');ctx.fillText(points[0][0].slice(5),left,height-8);if(points.length>1)ctx.fillText(points[points.length-1][0].slice(5),width-52,height-8);ctx.draw();
   }).exec());
 }
}));
