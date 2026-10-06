const {test}=require('node:test'), assert=require('node:assert/strict'), vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const {today}=require('../.build/lib/domain');
function harness(){
 let actor='alice',tables=new Map(),lock=Promise.resolve();
 const clone=x=>JSON.parse(JSON.stringify(x));
 function collection(name,store=tables){
  if(!store.has(name))store.set(name,new Map());
  const table=()=>store.get(name);
  return {doc(id){return {async get(){if(!table().has(id))throw new Error('document not exist');return {data:{...clone(table().get(id)),_id:id}};},async set({data}){table().set(id,clone(data));},async update({data}){if(!table().has(id))throw new Error('document not exist');table().set(id,{...table().get(id),...clone(data)});},async remove(){table().delete(id);}};},
   where(filter){let start=0,count=100;const query={orderBy(){return query;},skip(n){start=n;return query;},limit(n){count=n;return query;},async get(){const entries=[...table().entries()].filter(([,v])=>Object.entries(filter).every(([k,x])=>v[k]===x)).sort(([a],[b])=>a.localeCompare(b));return {data:entries.slice(start,start+count).map(([id,v])=>({...clone(v),_id:id}))};}};return query;}};
 }
 const db={collection,async runTransaction(fn){const previous=lock;let release;lock=new Promise(r=>release=r);await previous;const copy=new Map([...tables].map(([k,v])=>[k,new Map([...v].map(([id,d])=>[id,clone(d)]))]));try{const result=await fn({collection:n=>collection(n,copy)});tables=copy;return result;}finally{release();}}};
 const cloud={init(){},DYNAMIC_CURRENT_ENV:'test',database:()=>db,getWXContext:()=>({OPENID:actor}),async getTempFileURL({fileList}){return {fileList:fileList.map(f=>({fileID:f.fileID,tempFileURL:'https://private.example/'+encodeURIComponent(f.fileID)}))};}};
 const exports={},filename=path.resolve('cloudfunctions/paw-family/index.js'),localRequire=createRequire(filename);
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{require:n=>n==='wx-server-sdk'?cloud:localRequire(n),exports,console:{error(){}},Date,Set,Map});
 return {async call(id,event){actor=id;return exports.main(event);},table:n=>tables.get(n),db};
}
async function setup(){const h=harness();const a=await h.call('alice',{action:'bootstrap'});assert.equal(a.ok,true);const p={id:'pet_one',name:'糯米',birthday:'2026-01-01',breed:'比熊',stage:'puppy',neutered:false,weaned:true,bodyCondition:5,meals:3,vetTarget:400,freshPercent:0,snackPercent:5,mainFoodId:'',mainRecipeId:''};assert.equal((await h.call('alice',{action:'command',command:{type:'save',entity:'pet',value:p}})).ok,true);assert.equal((await h.call('alice',{action:'command',command:{type:'save',entity:'food',value:{id:'food_one',name:'粮',unit:'kcal100g',energy:400,complete:true,role:'main'}}})).ok,true);return {h,familyId:a.state.family.id};}
const feeding=id=>({type:'feed',id,requestId:id,petId:'pet_one',date:today(),time:'12:00',itemType:'food',itemId:'food_one',amount:10});
test('server derives identity; request-supplied actor and calorie snapshots are ignored',async()=>{
 const {h}=await setup();const result=await h.call('alice',{action:'command',command:{...feeding('feed_a'),actorId:'mallory',snapshot:{calories:1}}});assert.equal(result.ok,true);assert.equal(result.state.feedings[0].actorId,'alice');assert.equal(result.state.feedings[0].snapshot.calories,40);
});
test('foreign household pet IDs and document IDs cannot access or overwrite another household',async()=>{
 const {h,familyId}=await setup();await h.call('bob',{action:'bootstrap'});
 const failed=await h.call('bob',{action:'command',command:feeding('feed_a')});assert.equal(failed.ok,false);
 const ownPet={id:'pet_one',name:'Bob dog',birthday:'2026-01-01',breed:'',stage:'adult',neutered:true,weaned:true,bodyCondition:5,meals:2,vetTarget:null,freshPercent:0,snackPercent:5,mainFoodId:'',mainRecipeId:''};assert.equal((await h.call('bob',{action:'command',command:{type:'save',entity:'pet',value:ownPet}})).ok,true);
 assert.equal(h.table('pets').get(`${familyId}__pet_one`).name,'糯米');
});
test('one-use invitations, authorized member removal and family switching',async()=>{
 const {h}=await setup();await h.call('bob',{action:'bootstrap'});const invite=await h.call('alice',{action:'invite'});assert.equal(invite.ok,true);
 assert.equal((await h.call('bob',{action:'join',code:invite.code})).ok,true);assert.equal((await h.call('charlie',{action:'join',code:invite.code})).ok,false);
 assert.equal((await h.call('bob',{action:'invite'})).ok,false);assert.equal((await h.call('bob',{action:'command',command:feeding('bob_feed')})).ok,true);
 assert.equal((await h.call('alice',{action:'command',command:{type:'removeMember',id:'bob'}})).ok,true);
 assert.equal((await h.call('bob',{action:'read'})).ok,false);const boot=await h.call('bob',{action:'bootstrap'});assert.equal(boot.ok,true);assert.equal(boot.state.pets.length,0);
});
test('concurrent unique feedings both commit without lost updates; duplicate commits only once',async()=>{
 const {h}=await setup();const result=await Promise.all([h.call('alice',{action:'command',command:feeding('one')}),h.call('alice',{action:'command',command:feeding('two')})]);assert.ok(result.every(r=>r.ok));
 const retry=await h.call('alice',{action:'command',command:feeding('one')});assert.equal(retry.state.feedings.length,2);assert.equal(retry.state.feedings.reduce((s,f)=>s+f.snapshot.calories,0),80);
});
test('photos shared only within family; unknown cross-user file IDs rejected',async()=>{
 const {h}=await setup();const own='cloud://env/uploads/alice/photo.jpg',foreign='cloud://env/uploads/bob/secret.jpg';
 const diary={id:'d',petId:'pet_one',date:today(),text:'hello',photos:[foreign],weight:null,stool:'',color:'',abnormal:''};assert.equal((await h.call('alice',{action:'command',command:{type:'save',entity:'diary',value:diary}})).ok,false);
 assert.equal((await h.call('alice',{action:'media',fileIds:[own]})).ok,true); // preview uploader's unsaved draft
 assert.equal((await h.call('alice',{action:'command',command:{type:'save',entity:'diary',value:{...diary,photos:[own]}}})).ok,true);
 await h.call('bob',{action:'bootstrap'});assert.equal((await h.call('bob',{action:'media',fileIds:[own]})).ok,false);const invite=await h.call('alice',{action:'invite'});await h.call('bob',{action:'join',code:invite.code});assert.equal((await h.call('bob',{action:'media',fileIds:[own]})).ok,true);
 await h.call('alice',{action:'command',command:{type:'removeMember',id:'bob'}});assert.equal((await h.call('bob',{action:'media',fileIds:[own]})).ok,false);
});
test('pagination returns all family records beyond 100 rows',async()=>{
 const {h,familyId}=await setup();for(let i=0;i<107;i++)await h.db.collection('weights').doc(`${familyId}__w_${i}`).set({data:{id:`w_${i}`,familyId,petId:'pet_one',date:today(),kg:2}});
 const result=await h.call('alice',{action:'read'});assert.equal(result.state.weights.length,107);
});
