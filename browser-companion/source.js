(()=>{
 let stopped=false,busy=false,lastStatus='';const banner=document.createElement('div');banner.textContent='Capital source connection: checking the prepared search...';Object.assign(banner.style,{position:'fixed',bottom:'12px',right:'12px',zIndex:'2147483647',padding:'12px',maxWidth:'360px',background:'#10243a',color:'#fff',border:'1px solid #6ba5de',borderRadius:'8px',font:'14px sans-serif'});
 const message=async body=>chrome.runtime.sendMessage(body);
 const setStatus=async(type,text)=>{banner.textContent=text;if(lastStatus!==type){lastStatus=type;await message({type:'EVENT',event:{type,sourceUrl:location.href}});}};
 const normalized=value=>String(value||'').replace(/\s+/g,' ').trim();
 function caseRadio(){return [...document.querySelectorAll('input[type=radio]')].filter(input=>[input.title,input.getAttribute('aria-label'),...(input.labels?[...input.labels].map(label=>label.innerText):[]),input.nextSibling?.textContent].some(value=>normalized(value)==='Case'));}
 async function tick(){if(stopped||busy)return;busy=true;try{
  const ready=await message({type:'GET_PLAN'});if(!ready?.ok||ready.waitingForBinding)return;const plan=ready.plan;if(!plan)return;const value=plan.sourceFields?.courtCaseNumber;if(!/^\d{2}-\d{3,5}-[IVX]+$/.test(value||'')){stopped=true;return;}
  if(!banner.isConnected)document.body.appendChild(banner);
  const body=document.body.innerText.replace(banner.innerText,'');
  if(document.querySelector('#amzn-captcha-verify-button')||/let.s confirm you are human|complete the security check/i.test(body)){await setStatus('WAITING_HUMAN','Complete the county verification yourself. Capital will resume this prepared search when the form returns.');return;}
  if(location.pathname.endsWith('/default.aspx')){const link=[...document.querySelectorAll('a')].filter(a=>normalized(a.innerText)==='Search Civil Cases');if(link.length===1){banner.textContent='Opening the official civil-case search...';stopped=true;location.assign('/PublicAccess/Search.aspx?ID=200');return;}}
  if(body.includes('Case No. '+value)&&body.includes('Events & Orders of the Court')){
   stopped=true;banner.textContent='Saving the actual rendered docket to the prepared Capital work file...';const events=[...document.querySelectorAll('tr')].map(row=>[...row.children].map(cell=>cell.innerText.trim())).filter(cells=>cells.length===4&&/^\d{2}\/\d{2}\/\d{4}$/.test(cells[0])).map(cells=>({date:cells[0],description:cells[3]}));
   const result=await message({type:'EVENT',event:{type:'DOCKET_CAPTURE',sourceUrl:location.href,capture:{format:'MGR_DAVIDSON_RENDERED_DOCKET_V1',caseNumber:value,sourceUrl:location.href,capturedAt:new Date().toISOString(),visibleText:body,events}}});banner.textContent=result?.ok&&result.status==='CAPTURED'?'Court evidence saved in Capital. Claim status and payment still need review.':'Save outcome unconfirmed. Check Capital before retrying.';return;
  }
  const field=document.getElementById('CaseSearchValue');
  if(field){if(!field.getClientRects().length){const radios=caseRadio();if(radios.length!==1){await setStatus('MAPPING_REVIEW_REQUIRED','Select Case search on the county page. The companion will continue when its exact field is available.');return;}radios[0].click();return;}
   const submit=document.getElementById('SearchSubmit');if(!submit){await setStatus('MAPPING_REVIEW_REQUIRED','The county search form changed. Mapping review is required.');return;}
   Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));await setStatus('FORM_FILLED','Prepared court case filled from the selected Capital work file. Running its public search...');stopped=true;submit.click();return;
  }
  const matches=[...document.querySelectorAll('a')].filter(a=>normalized(a.innerText)===value&&new URL(a.href,location.href).origin===location.origin&&new URL(a.href,location.href).pathname==='/PublicAccess/CaseDetail.aspx');if(matches.length===1){stopped=true;matches[0].click();return;}
  const radios=caseRadio();if(radios.length===1&&!radios[0].checked){radios[0].click();return;}
  await setStatus('MAPPING_REVIEW_REQUIRED','The exact prepared case or form was not uniquely found. Review this county page; no claimant outcome was inferred.');
 }catch{stopped=true;banner.textContent='Source connection interrupted. Check its saved state in Capital.';}finally{busy=false;}}
 const interval=setInterval(tick,3000);void tick();window.addEventListener('pagehide',()=>clearInterval(interval),{once:true});
})();
