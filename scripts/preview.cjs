const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const build=cp.spawnSync(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'-p','tsconfig.preview.json'],{cwd:root,stdio:'inherit'});
if(build.status)process.exit(build.status);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.wxml':'text/plain; charset=utf-8','.wxss':'text/css; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),relative=url.pathname==='/'?'preview/index.html':decodeURIComponent(url.pathname).replace(/^\/+/,''),file=path.resolve(root,relative);
 if(!file.startsWith(root+path.sep)||!['preview','.preview-build','miniprogram'].some(dir=>file.startsWith(path.join(root,dir)+path.sep))){res.writeHead(403);return res.end('Forbidden');}
 try{const stat=fs.statSync(file);if(!stat.isFile())throw new Error();res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain','Cache-Control':'no-store'});res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end('Not found');}
});
server.listen(4173,'127.0.0.1',()=>console.log('Paw Diary local demo: http://127.0.0.1:4173 (native WXML + compiled TypeScript, mocked device APIs)'));
