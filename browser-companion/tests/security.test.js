import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {permittedApp,permittedSource,validStart} from '../background.js';
test('Cross-site and unexpected local-port apps cannot start a source job',()=>{
 assert.equal(permittedApp('http://127.0.0.1:17972/source-connections','http://127.0.0.1:17971'),true);
 for(const url of ['https://capitalmgr.com.evil.invalid','https://portal-tnnashville.tylertech.cloud','http://127.0.0.1:9999','http://localhost:17972','javascript:alert(1)','https://evil.invalid/?url=https://capitalmgr.com'])assert.equal(permittedApp(url,'http://127.0.0.1:17971'),false);
 assert.equal(permittedApp('https://capitalmgr.com','https://unrelated.example.invalid'),false);
});
test('Portal navigation never admits lookalike hosts, credential URLs, admin paths or script URLs',()=>{
 assert.equal(permittedSource('https://portal-tnnashville.tylertech.cloud/PublicAccess/CaseDetail.aspx?CaseID=83449'),true);
 for(const url of ['https://portal-tnnashville.tylertech.cloud.evil.invalid/PublicAccess/CaseDetail.aspx','https://user:pass@portal-tnnashville.tylertech.cloud/PublicAccess/Search.aspx','https://portal-tnnashville.tylertech.cloud/Admin/default.aspx','javascript:alert(1)','https://www.shelbycountytn.gov/222/Chancery-Court'])assert.equal(permittedSource(url),false);
});
test('Forged start payloads cannot replace scoped backend, token or run identifiers',()=>{
 const message={type:'START',backendOrigin:'http://127.0.0.1:17971',runId:'prepared-source-job',token:'a'.repeat(43)},sender={url:'http://127.0.0.1:17972/source-connections'};assert.equal(validStart(message,sender),true);
 for(const patch of [{token:'a'},{runId:'../../private'},{backendOrigin:'http://127.0.0.1:18588'},{type:'APPROVE'}])assert.equal(validStart({...message,...patch},sender),false);
});
test('Installable manifest has scoped portal content and no all-sites, cookie, debugger or browser-history permissions',async()=>{
 const manifest=JSON.parse(await fs.readFile(new URL('../manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.manifest_version,3);assert.deepEqual(manifest.permissions,['storage']);assert.equal(manifest.host_permissions.some(value=>value.includes('<all_urls>')),false);assert.deepEqual(manifest.content_scripts[0].matches,['https://portal-tnnashville.tylertech.cloud/PublicAccess/*']);
});
