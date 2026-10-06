const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist');
const build=cp.spawnSync(process.execPath,[path.join(root,'scripts/build-web.cjs')],{cwd:root,encoding:'utf8'});
assert.equal(build.status,0,build.stderr);
const source=fs.readFileSync(path.join(out,'preview/runtime.js'),'utf8');
const assets=source.slice(source.indexOf('const assetRoot='),source.indexOf('const getJSON='));
const loader=source.slice(source.indexOf('function requireModule('),source.indexOf('\nfunction toast('));

for(const prefix of ['/','/paw-diary/','/another-project/nested/'])test(`public modules load and save local records under ${prefix}`,async()=>{
 const requests=[],definitions=[],storage=new Map();
 const context=vm.createContext({URL,console,document:{currentScript:{src:`https://example.test${prefix}preview/runtime.js`}},cache:{},Page:p=>definitions.push(p),wx:{getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>storage.set(k,v)},fetchSync:url=>{
  const pathname=new URL(url).pathname;
  assert.ok(pathname.startsWith(prefix),'request escaped repository subpath');requests.push(pathname);
  return fs.readFileSync(path.join(out,pathname.slice(prefix.length)),'utf8');
 }});
 vm.runInContext(assets+loader,context);
 for(const route of ['today','feed','growth','profile'])vm.runInContext(`requireModule(asset('modules/pages/${route}/index'))`,context);
 assert.equal(definitions.length,4);
 assert.ok(requests.some(p=>p.endsWith('modules/lib/domain.js')));
 const service=vm.runInContext("requireModule(asset('modules/lib/service'))",context);
 assert.equal(service.isDemo(),true);
 const state=await service.getState();await service.selectPet(state.pets[0].id);
 assert.equal(storage.get('paw-diary-selected'),state.pets[0].id);
 assert.ok(state.pets.length>=2);
});

test('static output includes every template and stays in local mode',()=>{
 const html=fs.readFileSync(path.join(out,'index.html'),'utf8');
 assert.match(html,/src="preview\/runtime\.js"/);assert.doesNotMatch(html,/src="\//);
 assert.doesNotMatch(source,/\.preview-build\//);
 assert.ok(fs.existsSync(path.join(out,'.nojekyll')));
 assert.match(fs.readFileSync(path.join(out,'modules/lib/config.js'),'utf8'),/mode:"demo",cloudEnv:""/);
 for(const route of ['today','feed','growth','profile'])for(const ext of ['wxml','wxss'])assert.ok(fs.statSync(path.join(out,'miniprogram/pages',route,'index.'+ext)).isFile());
});
