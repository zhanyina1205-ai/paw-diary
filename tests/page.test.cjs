const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {demoState}=require('../.build/lib/seed');
function loadPage(name,service){let definition;const source=ts.transpileModule(fs.readFileSync(`miniprogram/pages/${name}/index.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(source,{exports:{},Page:d=>definition=d,wx:{showToast(){}},require:ref=>ref.endsWith('/page')?{basePage:x=>x,display:n=>n==null?'—':String(n)}:ref.endsWith('/domain')?require('../.build/lib/domain'):service});
 return definition;
}
test('double click during async preflight submits one feeding only',async()=>{
 const state=demoState();let reads=0,commands=[];const definition=loadPage('feed',{async getState(){reads++;await new Promise(r=>setTimeout(r,10));return state;},uid:()=> 'request_one'});
 const page={...definition,data:{...definition.data,pet:state.pets[0],items:[{id:state.foods[0].id,type:'food'}],form:{date:require('../.build/lib/domain').today(),time:'12:00',itemId:state.foods[0].id,amount:'10'}},setData(changes){for(const [key,value]of Object.entries(changes)){const parts=key.split('.');if(parts.length===1)this.data[key]=value;else this.data[parts[0]][parts[1]]=value;}},async mutate(cmd){commands.push(cmd);await new Promise(r=>setTimeout(r,5));return true;},async refresh(){}};
 await Promise.all([page.saveFeed(),page.saveFeed()]);assert.equal(reads,1);assert.equal(commands.length,1);assert.equal(page.data.preparingFeed,false);
});
test('failed diary save retains fields and stable ID for retry',async()=>{
 const state=demoState(),definition=loadPage('growth',{uid:()=> 'stable_diary'}),commands=[];
 const page={...definition,data:{...definition.data,pet:state.pets[0],form:{...definition.data.form,text:'a story',weight:'3'}},setData(changes){for(const [key,value]of Object.entries(changes)){const parts=key.split('.');if(parts.length===1)this.data[key]=value;else this.data[parts[0]][parts[1]]=value;}},async mutate(cmd){commands.push(cmd);return false;}};
 await page.saveDiary();await page.saveDiary();assert.equal(commands[0].value.id,commands[1].value.id);assert.equal(page.data.form.text,'a story');assert.equal(page.data.form.weight,'3');
});
