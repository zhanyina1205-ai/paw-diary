const {test}=require('node:test');
const assert=require('node:assert/strict');
const d=require('../.build/lib/domain');
const {applyCommand}=require('../.build/lib/commands');
const {demoState,emptyState}=require('../.build/lib/seed');
const change=(s,cmd,actor=s.currentUser.id)=>applyCommand(s,cmd,actor);
const feed=(s,overrides={})=>change(s,{type:'feed',id:'test_feed',requestId:'test_request',petId:s.pets[0].id,date:d.today(),time:'12:30',itemType:'food',itemId:s.foods[0].id,amount:10,...overrides});
const sampleRecipe=(s,extra={})=>({id:'recipe_test',familyId:s.family.id,name:'已审核示例',purpose:'main',source:'测试营养师 / 测试专用',stages:['puppy','adult'],basis:'raw',batchEnergy:300,ingredients:[{name:'测试食材A',grams:100,energy:200},{name:'测试食材B',grams:100,energy:100}],supplements:[{name:'测试补充剂',amount:0.05,unit:'g'}],verified:true,version:1,...extra});
test('calendar month age handles Jan 31 and leap day, not 30-day approximation',()=>{
 assert.equal(d.age('2026-01-31','2026-02-28').label,'1个月0天');assert.equal(d.age('2024-02-29','2025-02-28').months,12);assert.equal(d.age('2026-01-31','2026-03-30').label,'1个月30天');assert.equal(d.validDate('2026-02-29'),false);
});
test('Shanghai day boundary independent of host timezone',()=>{assert.equal(d.today(new Date('2026-10-05T15:59:59Z')),'2026-10-05');assert.equal(d.today(new Date('2026-10-05T16:00:00Z')),'2026-10-06');});
test('4-month coefficient, adult neuter coefficient, override and unweaned restriction',()=>{
 const s=demoState(),p={...s.pets[0],birthday:'2026-01-31'};
 assert.equal(d.nutrition(s,p,'2026-05-30').factor,3);assert.equal(d.nutrition(s,p,'2026-05-31').factor,2);
 assert.equal(d.nutrition(s,{...p,stage:'adult',neutered:true}).factor,1.6);assert.equal(d.nutrition(s,{...p,stage:'adult',neutered:false}).factor,1.8);
 assert.equal(d.nutrition(s,{...p,weaned:false}).target,null);assert.equal(d.nutrition(s,{...p,vetTarget:450}).target,450);
});
test('latest effective weigh-in ordered by date then save time',()=>{
 const s=demoState(),p=s.pets[0];s.weights=[{id:'a',petId:p.id,date:d.today(),kg:2,updatedAt:'2026-10-06T01:00Z'},{id:'b',petId:p.id,date:d.today(),kg:3,updatedAt:'2026-10-06T02:00Z'},{id:'future',petId:p.id,date:d.addDays(d.today(),1),kg:10}];assert.equal(d.nutrition(s,p).weight.kg,3);
});
test('food units kcal/100g, kcal/kg and kcal/piece',()=>{const s=demoState();assert.equal(d.foodDensity(s.foods[0]),3.8);assert.equal(d.foodDensity(s.foods[1]),3.5);assert.equal(d.foodDensity(s.foods[2]),3);});
test('mixed feeding reserves snacks by calories and converts both sources',()=>{
 const s=demoState(),r=sampleRecipe(s);s.recipes.push(r);const p={...s.pets[0],vetTarget:500,freshPercent:40,snackPercent:10,mainRecipeId:r.id};const n=d.nutrition(s,p);
 assert.equal(n.mainBudget,450);assert.equal(n.freshCalories,180);assert.equal(n.dryCalories,270);assert.ok(Math.abs(n.dryGrams-270/3.8)<1e-10);assert.equal(n.freshGrams,120);
});
test('all incomplete meals count against shared 10% allowance, excess is visible',()=>{
 let s=demoState();s=feed(s,{itemId:s.foods[2].id,amount:100});assert.equal(d.nutrition(s,s.pets[0]).snackStatus,'加餐已超额');assert.equal(d.nutrition(s,s.pets[0]).snackFed,300);
});
test('unknown calories stay unknown rather than counted as zero-complete',()=>{
 let s=demoState();s.foods[0].energy=null;s=feed(s);const n=d.nutrition(s,s.pets[0]);assert.equal(n.incomplete,true);assert.equal(s.feedings.at(-1).snapshot.calories,null);
});
test('food edits never rewrite historical calorie snapshots and deleted food history remains',()=>{
 let s=feed(demoState());const log=s.feedings.at(-1);s=change(s,{type:'save',entity:'food',value:{...s.foods[0],energy:100}});assert.equal(s.feedings.at(-1).snapshot.calories,38);assert.equal(log.snapshot.calories,38);
 assert.throws(()=>change(s,{type:'delete',entity:'food',id:s.foods[0].id}),/正在用于/);
});
test('repeated submission is idempotent; altered request payload is rejected',()=>{
 const original=demoState(),s=feed(original);const again=feed(s);assert.equal(again.feedings.length,s.feedings.length);assert.equal(again.family.version,s.family.version);assert.throws(()=>feed(s,{amount:20}),/已保存/);
});
test('multi-pet isolation and membership enforcement',()=>{
 const s=feed(demoState());assert.equal(d.nutrition(s,s.pets[1]).fed,0);assert.throws(()=>applyCommand(s,{type:'rename',name:'x'},'intruder'),/家庭/);assert.throws(()=>feed(s,{petId:'foreign_pet',id:'foreign_attempt',requestId:'foreign_request'}),/家庭/);
 assert.throws(()=>change(s,{type:'removeMember',id:s.currentUser.id}),/自己/);assert.throws(()=>change(s,{type:'removeMember',id:s.currentUser.id},'demo_family_member'),/管理员/);
});
test('invalid weights, dates and quantities rejected and original state immutable',()=>{
 const s=demoState();assert.throws(()=>feed(s,{amount:NaN}),/进食数量/);assert.throws(()=>feed(s,{date:'2026-02-30'}),/日期/);assert.throws(()=>change(s,{type:'save',entity:'weight',value:{id:'bad',petId:s.pets[0].id,date:d.today(),kg:0}}),/体重/);assert.equal(s.family.version,0);
});
test('recipe scaling includes ratios and tiny supplement precision',()=>{
 const r=sampleRecipe(demoState());const scaled=d.scaleRecipe(r,150,7);assert.equal(scaled.totalGrams,700);assert.equal(scaled.ingredients[0].percent,50);assert.equal(scaled.supplements[0].amount,.175);assert.equal(d.recipeEnergy({...r,batchEnergy:null}),300);
});
test('recipe changed ingredients invalidates audit unless re-confirmed; snapshots remain',()=>{
 let s=demoState();s.recipes.push(sampleRecipe(s));s=feed(s,{itemType:'recipe',itemId:'recipe_test',amount:100});const edited={...s.recipes[0],ingredients:[{name:'changed',grams:300,energy:100}]};
 let next=change(s,{type:'save',entity:'recipe',value:edited});assert.equal(next.recipes[0].verified,false);assert.equal(next.feedings.at(-1).snapshot.calories,150);assert.equal(next.feedings.at(-1).snapshot.recipeVersion,1);
 next=change(s,{type:'save',entity:'recipe',value:{...edited,reconfirm:true}});assert.equal(next.recipes[0].verified,true);
 const r=sampleRecipe(s,{stages:['adult']});assert.equal(d.recipeEligible(r,s.pets[0]),false);
});
test('diary edit updates linked weigh-in; delete removes it',()=>{
 let s=demoState();const value={id:'diary_test',petId:s.pets[0].id,date:d.today(),text:'test',photos:[],weight:3,stool:'',color:'',abnormal:''};s=change(s,{type:'save',entity:'diary',value});s=change(s,{type:'save',entity:'diary',value:{...value,weight:3.5}});assert.equal(s.weights.filter(w=>w.id==='diary_diary_test').length,1);assert.equal(d.nutrition(s,s.pets[0]).weight.kg,3.5);s=change(s,{type:'delete',entity:'diary',id:value.id});assert.equal(s.weights.some(w=>w.id==='diary_diary_test'),false);
});
test('recurring health completion creates one next occurrence, uses actual completion',()=>{
 let s=demoState();s.healthPlans[0]={...s.healthPlans[0],kind:'internal',repeatDays:30};const id=s.healthPlans[0].id;s=change(s,{type:'completeHealth',id,date:d.today()});assert.equal(s.healthPlans.at(-1).dueDate,d.addDays(d.today(),30));assert.equal(s.healthPlans.at(-1).recordDate,d.today());const again=change(s,{type:'completeHealth',id,date:d.today()});assert.equal(again.healthPlans.length,s.healthPlans.length);
});
test('health overdue and calendar timezone, invalid vaccine recurrence',()=>{
 const s=demoState(),h={...s.healthPlans[0],dueDate:d.addDays(d.today(),-2)};assert.equal(d.healthStatus(h).label,'逾期2天');const event=d.calendarEvent(h,s.pets[0]);assert.equal(new Date(event.startTime*1000).toISOString().slice(11,16),'01:00');assert.equal(event.alarmOffset,86400);assert.throws(()=>change(s,{type:'save',entity:'health',value:{...h,repeatDays:30}}),/逐针/);
});
test('design palette meets WCAG AA for small text on brand surfaces',()=>{
 const rgb=hex=>hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const lum=hex=>rgb(hex).reduce((n,c,i)=>n+c*[.2126,.7152,.0722][i],0);
 for(const bg of ['FFF8EF','F2B8C6','D9EFE3'])assert.ok((lum(bg)+.05)/(lum('514843')+.05)>=4.5);
});
test('tiny ingredient and supplement amounts are never rounded down to zero',()=>{const r=sampleRecipe(demoState(),{supplements:[{name:'tiny',amount:.000001,unit:'g'}],ingredients:[{name:'tiny ingredient',grams:.001,energy:0},{name:'main',grams:100,energy:200}]});const scaled=d.scaleRecipe(r,30);assert.ok(scaled.supplements[0].amount>0);assert.ok(scaled.ingredients[0].grams>0);});
test('many recurring completions retain every occurrence with unique IDs',()=>{let s=demoState();s.healthPlans[0]={...s.healthPlans[0],kind:'internal',repeatDays:30};for(let i=0;i<35;i++){const next=s.healthPlans.find(h=>!h.completedAt);s=change(s,{type:'completeHealth',id:next.id,date:d.today()});}assert.equal(new Set(s.healthPlans.map(h=>h.id)).size,36);assert.equal(s.healthPlans.length,36);});
