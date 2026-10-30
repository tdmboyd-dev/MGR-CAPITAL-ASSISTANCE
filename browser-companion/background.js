const origins=new Map([['http://127.0.0.1:17972','http://127.0.0.1:17971'],['https://capitalmgr.com','https://api.capitalmgr.com'],['https://www.capitalmgr.com','https://api.capitalmgr.com']]);
const court='https://portal-tnnashville.tylertech.cloud';
export function permittedApp(url,backend){try{return origins.get(new URL(url).origin)===backend;}catch{return false;}}
export function permittedSource(url){try{const u=new URL(url);return u.origin===court&&!u.username&&!u.password&&/^\/PublicAccess\/(default|Search|CaseDetail)\.aspx$/.test(u.pathname);}catch{return false;}}
export function validStart(message,sender){return message?.type==='START'&&permittedApp(sender.url,message.backendOrigin)&&/^[A-Za-z0-9_-]{10,100}$/.test(message.runId||'')&&/^[A-Za-z0-9_-]{43}$/.test(message.token||'');}
async function request(run,path,body){const response=await fetch(run.backendOrigin+'/api/source-connections/bridge/'+encodeURIComponent(run.id)+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+run.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Capital rejected or did not confirm this source operation. Reopen its saved status.');const data=await response.json();if(!data.success)throw Error('Capital did not confirm the operation.');return data.data;}
async function external(message,sender){
 if(message?.type==='PING'){if(!origins.has(new URL(sender.url).origin))throw Error('Unadmitted app');return {ready:true,version:'0.1.0'};}
 if(!validStart(message,sender))throw Error('Unadmitted app or source connection');
 const run={id:message.runId,token:message.token,backendOrigin:message.backendOrigin};const prepared=await request(run,'/plan');
 if(prepared.plan.adapterId!=='US-47037-CHANCERY-CASE-SEARCH-v1'||prepared.plan.sourceUrl!==court+'/PublicAccess/default.aspx'||!/^\d{2}-\d{3,5}-[IVX]+$/.test(prepared.plan.sourceFields?.courtCaseNumber||''))throw Error('County mapping is not admitted.');
 const previous=await chrome.storage.session.get('run:'+run.id);if(previous['run:'+run.id]){const old=previous['run:'+run.id];try{await chrome.windows.update(old.windowId,{focused:true});return {opened:true,reused:true};}catch{throw Error('The source window was closed. Reprepare the connection to resume.');}}
 const opened=await chrome.windows.create({url:prepared.plan.sourceUrl,type:'popup',width:1120,height:850});const tab=opened.tabs?.[0];if(!tab?.id)throw Error('Source window could not be confirmed.');
 await chrome.storage.session.set({['run:'+run.id]:{...run,plan:prepared.plan,expiresAt:prepared.expiresAt,tabId:tab.id,windowId:opened.id}});return {opened:true,reused:false};
}
async function internal(message,sender){
 if(sender.id!==chrome.runtime.id||!sender.tab?.id||!permittedSource(sender.tab.url))throw Error('Unadmitted source tab');
 const all=await chrome.storage.session.get(null);const run=Object.values(all).find(value=>value.tabId===sender.tab.id);if(!run)return {waitingForBinding:true};
 if(Date.parse(run.expiresAt)<=Date.now()){await chrome.storage.session.remove('run:'+run.id);throw Error('Source connection expired. Return to Capital.');}
 if(message.type==='GET_PLAN')return {plan:run.plan};
 if(message.type!=='EVENT'||!message.event||message.event.sourceUrl!==sender.tab.url)throw Error('Unbound source event');
 if(JSON.stringify(message.event).length>1500000)throw Error('Court capture exceeds the bounded limit.');
 return request(run,'/events',message.event);
}
if(typeof chrome!=='undefined'&&chrome.runtime){
 chrome.runtime.onMessageExternal.addListener((message,sender,reply)=>{external(message,sender).then(value=>reply({ok:true,...value})).catch(()=>reply({ok:false,error:'Source connection was not confirmed. Check its saved status in Capital.'}));return true;});
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{internal(message,sender).then(value=>reply({ok:true,...value})).catch(()=>reply({ok:false,error:'Source operation was not confirmed. Check Capital before retrying.'}));return true;});
 chrome.tabs.onRemoved.addListener(async tabId=>{const all=await chrome.storage.session.get(null);for(const [key,value]of Object.entries(all))if(value.tabId===tabId)await chrome.storage.session.remove(key);});
}
