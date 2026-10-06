const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist');
const build=cp.spawnSync(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'-p','tsconfig.preview.json'],{cwd:root,stdio:'inherit'});
if(build.status!==0)process.exit(build.status||1);
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(path.join(out,'preview'),{recursive:true});
fs.cpSync(path.join(root,'.preview-build'),path.join(out,'modules'),{recursive:true});
// Public browser builds always use independent local data, even if native config changes.
fs.writeFileSync(path.join(out,'modules/lib/config.js'),'exports.config={mode:"demo",cloudEnv:"",functionName:"paw-family"};\n');
fs.copyFileSync(path.join(root,'preview/index.html'),path.join(out,'index.html'));
fs.writeFileSync(path.join(out,'preview/runtime.js'),fs.readFileSync(path.join(root,'preview/runtime.js'),'utf8').replaceAll('.preview-build/','modules/'));
fs.mkdirSync(path.join(out,'miniprogram/pages'),{recursive:true});
fs.copyFileSync(path.join(root,'miniprogram/app.wxss'),path.join(out,'miniprogram/app.wxss'));
for(const route of ['today','feed','growth','profile']){
 const dir=path.join(out,'miniprogram/pages',route);fs.mkdirSync(dir,{recursive:true});
 for(const ext of ['wxml','wxss'])fs.copyFileSync(path.join(root,'miniprogram/pages',route,'index.'+ext),path.join(dir,'index.'+ext));
}
fs.writeFileSync(path.join(out,'.nojekyll'),'');
console.log('Static browser build ready: dist/ (works at / or any repository subpath)');
