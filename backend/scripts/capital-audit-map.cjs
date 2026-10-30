/* Structural coverage is not a semantic or runtime acceptance claim. No env values are exported. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const slash = p => p.replaceAll('\\', '/');
const tracked = [...new Set(cp.execFileSync('git', ['-c', `safe.directory=${slash(root)}`, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], {cwd:root, encoding:'utf8'}).split('\0').filter(Boolean))].sort().filter(p=>p!=='docs/full-build/CAPITAL-AUDIT-MAP.json');
const inventory = tracked.filter(p=>fs.existsSync(path.join(root,p))).map(file=>{
  const bytes=fs.readFileSync(path.join(root,file));
  return {file, bytes:bytes.length, sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
});
const files = inventory.filter(p=>/\.(?:[cm]?js|tsx?)$/.test(p.file) && !p.file.includes('node_modules/'));
const imports=[], localRoutes=[], mounts=[], calls=[], links=[], environment=new Set(), parseErrors=[];
const literal = n => n && (ts.isStringLiteralLike(n) ? n.text : ts.isTemplateExpression(n) ? n.head.text+n.templateSpans.map(s=>'${*}'+s.literal.text).join('') : null);
const resolveLocal = (file,spec)=>{
  const base=spec.startsWith('@/')?path.join(root,'frontend',spec.slice(2)):spec.startsWith('.')?path.resolve(root,path.dirname(file),spec):null;
  if(!base)return null;
  const candidates=[base,base.replace(/\.js$/,'.ts'),base.replace(/\.js$/,'.tsx'),...['.ts','.tsx','.js','/index.ts','/index.tsx'].map(x=>base+x)];
  return slash(path.relative(root,candidates.find(p=>fs.existsSync(p)&&fs.statSync(p).isFile())||base));
};
for(const item of files){
  const source=fs.readFileSync(path.join(root,item.file),'utf8');
  const ast=ts.createSourceFile(item.file,source,ts.ScriptTarget.Latest,true,item.file.endsWith('.tsx')?ts.ScriptKind.TSX:undefined);
  const line=n=>ast.getLineAndCharacterOfPosition(n.getStart(ast)).line+1;
  for(const d of ast.parseDiagnostics)parseErrors.push({file:item.file,line:ast.getLineAndCharacterOfPosition(d.start||0).line+1,message:ts.flattenDiagnosticMessageText(d.messageText,' ')});
  const bindings=new Map();
  function visit(n){
    if(ts.isImportDeclaration(n)){
      const spec=literal(n.moduleSpecifier), target=resolveLocal(item.file,spec);
      imports.push({file:item.file,line:line(n),specifier:spec,target});
      if(n.importClause?.name)bindings.set(n.importClause.name.text,target);
    }
    if(ts.isPropertyAccessExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.getText(ast)==='process.env')environment.add(n.name.text);
    if(ts.isCallExpression(n)){
      const expr=n.expression;
      if(ts.isPropertyAccessExpression(expr)){
        const obj=expr.expression.getText(ast),method=expr.name.text.toLowerCase(),first=literal(n.arguments[0]);
        if(['router','app'].includes(obj)&&['get','post','put','patch','delete','options','head','all'].includes(method)&&first!==null)localRoutes.push({file:item.file,line:line(n),method:method.toUpperCase(),path:first});
        if(obj==='app'&&method==='use'&&first!==null){
          for(const arg of n.arguments.slice(1)){const target=bindings.get(arg.getText(ast));if(target)mounts.push({prefix:first,file:target,line:line(n)});}
        }
        if(item.file.startsWith('frontend/')&&['api','axios'].includes(obj)&&['get','post','put','patch','delete'].includes(method))calls.push({file:item.file,line:line(n),method:method.toUpperCase(),path:first,dynamic:first===null,client:obj});
      }
      if(item.file.startsWith('frontend/')&&expr.getText(ast)==='fetch'){
        let method='GET';const opts=n.arguments[1];if(opts&&ts.isObjectLiteralExpression(opts)){for(const prop of opts.properties)if(ts.isPropertyAssignment(prop)&&prop.name.getText(ast)==='method')method=literal(prop.initializer)||'DYNAMIC';}
        calls.push({file:item.file,line:line(n),method,path:literal(n.arguments[0]),dynamic:literal(n.arguments[0])===null,client:'fetch'});
      }
    }
    if(ts.isJsxAttribute(n)&&n.name.getText(ast)==='href'&&n.initializer){let href=literal(n.initializer);if(ts.isJsxExpression(n.initializer))href=literal(n.initializer.expression);if(href?.startsWith('/'))links.push({file:item.file,line:line(n),path:href});}
    ts.forEachChild(n,visit);
  }
  visit(ast);
}
const endpoints=[];
for(const r of localRoutes){
  if(r.file==='backend/src/server.ts')endpoints.push(r);
  else for(const mount of mounts.filter(m=>m.file===r.file))endpoints.push({...r,path:(mount.prefix+(r.path==='/'?'':r.path)).replace(/\/$/,''),mount:mount.prefix});
}
const pattern=p=>new RegExp('^'+p.split('/').map(s=>s.startsWith(':')?'[^/]+':s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('/')+'/?$');
const shadows=[];
for(const later of endpoints)for(const earlier of endpoints){
  if(later.file===earlier.file&&later.mount===earlier.mount&&earlier.line<later.line&&earlier.method===later.method&&earlier.path!==later.path&&!later.path.includes(':')&&pattern(earlier.path).test(later.path))shadows.push({method:later.method,path:later.path,shadowedBy:earlier.path,file:later.file,line:later.line,earlierLine:earlier.line,status:'REVIEW_REQUIRED: earlier handler may call next()'});
}
for(const c of calls){
  if(c.path===null){c.contract='DYNAMIC_REVIEW';continue;}
  let p=c.path.split('?')[0];
  if(c.client==='api'&&p.startsWith('/api/')){c.contract='DOUBLE_API_PREFIX';continue;}
  if(c.client==='api'&&!/^https?:/.test(p))p='/api'+(p.startsWith('/')?'':'/')+p;
  if(p.includes('${*}')){c.contract='TEMPLATE_REVIEW';continue;}
  c.resolvedPath=p;
  c.matches=endpoints.filter(e=>e.method===c.method&&pattern(e.path).test(p)).map(e=>({file:e.file,line:e.line,path:e.path}));
  c.contract=c.matches.length?(c.matches.some(e=>!e.path.includes(':'))?'DECLARED_ROUTE_ONLY':'DYNAMIC_ROUTE_MATCH_REVIEW'):'NO_DECLARED_ROUTE_REVIEW';
}
const pages=inventory.filter(i=>/^frontend\/app\/.*page\.(tsx?|jsx?)$/.test(i.file)).map(i=>({file:i.file,path:'/'+i.file.replace(/^frontend\/app\//,'').replace(/\/?page\.(tsx?|jsx?)$/,'').replace(/\([^/]+\)\/?/g,'').replace(/\[([^\]]+)\]/g,':$1')}));
for(const l of links)l.matches=[...pages.filter(p=>pattern(p.path).test(l.path)).map(p=>p.file),...inventory.filter(i=>i.file==='frontend/public'+l.path).map(i=>i.file)];
const schema=fs.readFileSync(path.join(root,'backend/prisma/schema.prisma'),'utf8');
const map={schemaVersion:1,scope:'Tracked current source. AST inventory and contract candidates; not full semantic review, authorization proof or provider acceptance.',inventory,summary:{trackedFiles:inventory.length,parsedCodeFiles:files.length,sourceBytes:files.reduce((n,f)=>n+f.bytes,0),mountedRouters:mounts.length,endpoints:endpoints.length,frontendCalls:calls.length,pages:pages.length,parseErrors:parseErrors.length},imports,mounts,endpoints,routeShadowCandidates:shadows,frontendCalls:calls,internalLinks:links,pages,environmentNames:[...environment].sort(),schemaModels:[...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map(m=>m[1]),schemaEnums:[...schema.matchAll(/^enum\s+(\w+)\s*\{/gm)].map(m=>m[1]),parseErrors};
// Avoid hashing the map into itself; repeated generation is deterministic for the same input tree.
map.inventory=map.inventory.filter(i=>i.file!=='docs/full-build/CAPITAL-AUDIT-MAP.json');
const output=path.join(root,'docs/full-build/CAPITAL-AUDIT-MAP.json');
fs.writeFileSync(output,JSON.stringify(map,null,2)+'\n');
console.log(JSON.stringify({output,summary:map.summary,routeShadowCandidates:shadows,unmatchedCalls:calls.filter(c=>['DOUBLE_API_PREFIX','NO_DECLARED_ROUTE_REVIEW'].includes(c.contract)),unmatchedLinks:links.filter(l=>!l.matches.length&&!l.path.includes('${*}'))},null,2));
