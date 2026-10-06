import {basePage,display} from '../../lib/page';
import {State,Pet,Recipe} from '../../lib/types';
import {foodDensity,recipeEnergy,recipeEligible,scaleRecipe,nutrition,today,clockTime} from '../../lib/domain';
import * as service from '../../lib/service';
const foodForm=()=>({id:'',name:'',unit:'kcal100g',energy:'',complete:true,role:'main'});
const recipeForm=()=>({id:'',name:'',purpose:'addon',source:'',stages:['puppy','adult'],basis:'cooked',batchEnergy:'',ingredients:[{name:'',grams:'',energy:''}],supplements:[],verified:false,reconfirm:false});
Page(basePage({
 data:{tab:'log',foodForm:foodForm(),recipeForm:recipeForm(),foodEditing:false,recipeEditing:false,
   form:{date:today(),time:clockTime(),itemId:'',amount:''},items:[],itemNames:[],itemIndex:0,foods:[],recipes:[],logs:[],
   units:[{value:'kcal100g',label:'kcal / 100g'},{value:'kcalkg',label:'kcal / kg'},{value:'kcalpiece',label:'kcal / 个'}],
   roles:[{value:'main',label:'主粮'},{value:'treat',label:'零食'},{value:'addon',label:'加餐'}],
   purposes:[{value:'addon',label:'鲜食加餐'},{value:'main',label:'专业完整主食'}],
   bases:[{value:'cooked',label:'熟重 · 食材煮熟后称重'},{value:'raw',label:'生重 · 烹饪前称重（不代表生食）'}],
   prep:{recipeId:'',calories:'',days:1},prepIndex:0,prepResult:null,prepWarning:'',logDate:today(),preparingFeed:false},
 afterRefresh(state:State,pet:Pet|null){
  const items=[...state.foods.map(f=>({id:f.id,type:'food',label:f.name,unit:f.unit==='kcalpiece'?'个':'g'})),...state.recipes.map(r=>({id:r.id,type:'recipe',label:`${r.name} · ${r.basis==='raw'?'生重':'熟重'}`,unit:'g'}))];
  const index=Math.max(0,items.findIndex(i=>i.id===this.data.form.itemId));
  this.setData({items,itemNames:items.map(i=>i.label),itemIndex:index,'form.itemId':items[index]?.id||'',itemUnit:items[index]?.unit||'g',
   foods:state.foods.map(f=>({...f,energyText:display(f.energy),unitLabel:this.data.units.find((u:any)=>u.value===f.unit).label})),
   recipes:state.recipes.map(r=>({...r,energyText:display(recipeEnergy(r)),status:r.purpose==='main'?(pet&&recipeEligible(r,pet)?'已确认 · 适用当前狗狗':'待确认或阶段不适用'):'鲜食加餐'})),
   logs:pet?state.feedings.filter(f=>f.petId===pet.id&&f.date===this.data.logDate).sort((a,b)=>b.time.localeCompare(a.time)).map(f=>({...f,caloriesText:display(f.snapshot.calories)})):[],
   foodUnitIndex:this.data.units.findIndex((u:any)=>u.value===this.data.foodForm.unit),roleIndex:this.data.roles.findIndex((u:any)=>u.value===this.data.foodForm.role),
   purposeIndex:this.data.purposes.findIndex((u:any)=>u.value===this.data.recipeForm.purpose),basisIndex:this.data.bases.findIndex((u:any)=>u.value===this.data.recipeForm.basis)});
  if(state.recipes.length&&!state.recipes.some(r=>r.id===this.data.prep.recipeId))this.setData({'prep.recipeId':state.recipes[0].id,prepIndex:0,prepResult:null});
  const result=this.data.prepResult;
  if(result&&!state.recipes.some(r=>r.id===result.recipeId&&r.version===result.version))this.setData({prepResult:null});
 },
 tabChange(e:any){this.setData({tab:e.currentTarget.dataset.tab,error:''});},
 itemChange(e:any){const i=Number(e.detail.value),item=this.data.items[i];this.setData({itemIndex:i,'form.itemId':item.id,itemUnit:item.unit});},
 async logDateChange(e:any){this.setData({logDate:e.detail.value});await this.refresh();},
 async saveFeed(){
  if(this.data.busy||this._submittingFeed||!this.data.pet)return;
  this._submittingFeed=true;this.setData({preparingFeed:true});
  try{
    const latest=await service.getState(true);this._state=latest;
    if(this._feedId&&latest.feedings.some(f=>f.id===this._feedId)){this._feedId='';this.setData({'form.amount':''});await this.refresh();wx.showToast({title:'上次记录已保存',icon:'success'});return;}
    const item=this.data.items.find((i:any)=>i.id===this.data.form.itemId);
    if(!item)throw new Error('请先添加食物或食谱');
    const command={type:'feed' as const,id:this._feedId||service.uid('feed'),requestId:this._feedId||'',petId:this.data.pet.id,date:this.data.form.date,time:this.data.form.time,itemType:item.type,itemId:item.id,amount:Number(this.data.form.amount)};
    command.requestId=command.id;this._feedId=command.id;
    if(await this.mutate(command,'进食已记录')){this._feedId='';this.setData({'form.amount':'',logDate:command.date});await this.refresh();}
  }catch(e:any){this.setData({error:e.message||'读取最新记录失败，请重试'});}
  finally{this._submittingFeed=false;this.setData({preparingFeed:false});}
 },
 newFood(){this.setData({foodForm:foodForm(),foodEditing:true,foodUnitIndex:0,roleIndex:0,error:''});},
 editFood(e:any){const f=this._state.foods.find((f:any)=>f.id===e.currentTarget.dataset.id);this.setData({foodForm:{...f,energy:f.energy??''},foodEditing:true,foodUnitIndex:this.data.units.findIndex((u:any)=>u.value===f.unit),roleIndex:this.data.roles.findIndex((u:any)=>u.value===f.role)});},
 async saveFood(){if(this.data.busy)return;const f=this.data.foodForm;const id=f.id||service.uid('food');this.setData({'foodForm.id':id});if(await this.mutate({type:'save',entity:'food',value:{...f,id,energy:f.energy===''?null:Number(f.energy)}}))this.setData({foodEditing:false,foodForm:foodForm()});},
 cancelFood(){this.setData({foodEditing:false});},
 newRecipe(){this.setData({recipeForm:recipeForm(),recipeEditing:true,purposeIndex:0,basisIndex:0,error:''});},
 editRecipe(e:any){const r=this._state.recipes.find((r:any)=>r.id===e.currentTarget.dataset.id);this.setData({recipeForm:{...JSON.parse(JSON.stringify(r)),batchEnergy:r.batchEnergy??'',ingredients:r.ingredients.map((i:any)=>({...i,energy:i.energy??''})),reconfirm:false},recipeEditing:true,purposeIndex:r.purpose==='main'?1:0,basisIndex:r.basis==='raw'?1:0});},
 ingredientField(e:any){const {index,field}=e.currentTarget.dataset;this.setData({[`recipeForm.ingredients[${index}].${field}`]:e.detail.value});},
 supplementField(e:any){const {index,field}=e.currentTarget.dataset;this.setData({[`recipeForm.supplements[${index}].${field}`]:e.detail.value});},
 addIngredient(){this.setData({'recipeForm.ingredients':[...this.data.recipeForm.ingredients,{name:'',grams:'',energy:''}]});},
 removeIngredient(e:any){this.setData({'recipeForm.ingredients':this.data.recipeForm.ingredients.filter((_:any,i:number)=>i!==Number(e.currentTarget.dataset.index))});},
 addSupplement(){this.setData({'recipeForm.supplements':[...this.data.recipeForm.supplements,{name:'',amount:'',unit:'g'}]});},
 removeSupplement(e:any){this.setData({'recipeForm.supplements':this.data.recipeForm.supplements.filter((_:any,i:number)=>i!==Number(e.currentTarget.dataset.index))});},
 stageChange(e:any){this.setData({'recipeForm.stages':e.detail.value});},
 async saveRecipe(){
  if(this.data.busy)return;const r=this.data.recipeForm,id=r.id||service.uid('recipe');this.setData({'recipeForm.id':id});
  const value={...r,id,batchEnergy:r.batchEnergy===''?null:Number(r.batchEnergy),
   ingredients:r.ingredients.map((i:any)=>({...i,grams:Number(i.grams),energy:i.energy===''?null:Number(i.energy)})),supplements:r.supplements.map((s:any)=>({...s,amount:Number(s.amount)}))};
  if(await this.mutate({type:'save',entity:'recipe',value})){this.setData({recipeEditing:false,recipeForm:recipeForm(),prepResult:null});}
 },
 cancelRecipe(){this.setData({recipeEditing:false});},
 prepRecipeChange(e:any){const index=Number(e.detail.value);this.setData({prepIndex:index,'prep.recipeId':this.data.recipes[index].id,prepResult:null});},
 makePrep(){
  const recipe=this._state.recipes.find((r:Recipe)=>r.id===this.data.prep.recipeId);
  if(!recipe){this.setData({error:'请先录入食谱'});return;}
  const calories=Number(this.data.prep.calories),days=Number(this.data.prep.days);
  if(!(calories>0&&calories<=20000&&Number.isInteger(days)&&days>=1&&days<=30)){this.setData({error:'填写有效的每日热量和1至30天的备餐天数'});return;}
  const result=scaleRecipe(recipe,calories,days);
  if(!result){this.setData({error:'请补充整份热量或所有食材的热量'});return;}
  const n=this.data.pet?nutrition(this._state,this.data.pet):null,complete=this.data.pet&&recipeEligible(recipe,this.data.pet);
  let warning=complete?'':'此配方当前按加餐计算，不能替代完整主食。';
  if(!complete&&n?.snackLimit!=null&&calories>n.snackLimit)warning+=' 已超过每日加餐热量上限。';
  this.setData({prepResult:{...result,recipeId:recipe.id,version:recipe.version,name:recipe.name,basisLabel:recipe.basis==='raw'?'烹饪前生重':'食材熟重',days},prepWarning:warning,error:''});
 },
 useSuggested(){const recipe=this._state.recipes.find((r:Recipe)=>r.id===this.data.prep.recipeId);if(!recipe||!this.data.pet)return;const n=nutrition(this._state,this.data.pet);const calories=recipeEligible(recipe,this.data.pet)?n.freshCalories:n.snackBudget;this.setData({'prep.calories':display(calories),prepResult:null});},
 async copyPrep(){const p=this.data.prepResult;if(!p)return;const lines=[`${p.name} · ${p.days}天 · ${p.basisLabel}`,`合计 ${p.totalCalories} kcal / 食材 ${p.totalGrams}g`,...p.ingredients.map((i:any)=>`${i.name} ${i.grams}g (${i.percent}%)`),...p.supplements.map((s:any)=>`${s.name} ${s.amount}${s.unit}`)];await wx.setClipboardData({data:lines.join('\n')});}
}));
