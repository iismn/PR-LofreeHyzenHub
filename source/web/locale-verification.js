'use strict';
window.runLocaleVerification=async({checks,screenshot,wait,settled})=>{
 const cjk=/[가-힣\u3400-\u9fff]/,audits=[];
 function audit(name){
  const untranslated=[],walker=document.createTreeWalker(document.body,4);
  for(let node=walker.nextNode();node;node=walker.nextNode())if(!node.parentElement?.closest('script,style')&&cjk.test(node.nodeValue))untranslated.push(node.nodeValue.trim());
  for(const element of $$('[aria-label],[title],[alt],[placeholder]'))for(const attribute of ['aria-label','title','alt','placeholder']){const value=element.getAttribute(attribute);if(value&&cjk.test(value))untranslated.push(attribute+': '+value);}
  const main=$('main').getBoundingClientRect(),content=$('#content');
  const fits=content.scrollWidth<=content.clientWidth+2&&!$$('#content input,#content select').some(element=>element.getClientRects().length&&element.getBoundingClientRect().right>main.right+2);
  const navFits=$$('#nav button:not([hidden]) span').every(element=>element.getBoundingClientRect().right<=element.closest('button').getBoundingClientRect().right+1);
  audits.push({name,untranslated:[...new Set(untranslated)].slice(0,20),fits,navFits});
 }
 await navigate('settings');
 const hardware=[],originalRpc=device.rpc,originalProfile=device.profile;
 const originalDelay=live.delay,originalWait=live.maxWait;live.delay=5000;live.maxWait=5000;HyzenAutoApply.beginProbe();
 $('#sleepFirst').value='3';$('#sleepFirst').dispatchEvent(new Event('input',{bubbles:true}));
 device.rpc=async(action,args)=>{hardware.push(action);return originalRpc(action,args);};
 try{
  $('[data-language=en]').click();await settled();
  checks.push({name:'general-en-switch-localizes-ui-without-hid-requests',ok:L.language==='en'&&document.documentElement.lang==='en'&&$('#pageContext').textContent==='General'&&$('#languageLabel').textContent==='Language'&&$('[data-language=en]').getAttribute('aria-pressed')==='true'&&$('[data-language=ko]').getAttribute('aria-pressed')==='false'&&hardware.length===0&&device.profile===originalProfile,hardwareRequests:hardware});
  checks.push({name:'language-switch-preserves-pending-edits-without-flushing-device-writes',ok:live.pending.has('sleep')&&$('#sleepFirst').value==='3'});
 }finally{device.rpc=originalRpc;await HyzenAutoApply.endProbe();live.delay=originalDelay;live.maxWait=originalWait;}
 const saved=await rpc('preferences');checks.push({name:'selected-language-is-saved-by-native-preferences',ok:saved.language==='en'});
 for(const [page]of nav.filter(([id])=>availablePage(id))){
  await navigate(page);for(const details of $$('#content details'))details.open=true;
  audit('en-'+page);for(const details of $$('#content details'))details.open=false;
  await screenshot('en-'+page);
  if(page==='depth'){
   const main=$('main');main.scrollTop+=$('.depth-console').getBoundingClientRect().top-main.getBoundingClientRect().top-22;
   await screenshot('en-actuation');main.scrollTop=0;
  }
 }
 await navigate('keyboard');
 for(const category of ['basic','media','lightkeys','special','macro']){state.category=category;render();audit('en-palette-'+category);}
 state.category='basic';
 await navigate('advanced');
 for(const type of ['MT','TGL','DKS','RS','SOCD','HT']){state.advanced=type;render();audit('en-advanced-'+type);}
 await navigate('light');
 for(const group of ['back','front','receiver']){state.lightGroup=group;state.lightDraft=null;render();for(const details of $$('#content details'))details.open=true;audit('en-light-'+group);}
 const originalInfo=device.info,originalMode=device.func[56];
 try{
  device.info={...originalInfo,productId:36,connection:'USB'};device.func[56]=2;updateNavigationVisibility();
  await navigate('settings');for(const details of $$('#content details'))details.open=true;audit('en-usb-settings');
  await navigate('calibration');audit('en-usb-calibration');
 }finally{device.info=originalInfo;device.func[56]=originalMode;updateNavigationVisibility();}
 checks.push({name:'all-english-pages-details-palettes-and-advanced-types-translate',ok:audits.every(result=>result.untranslated.length===0),audits});
 checks.push({name:'english-controls-fit-main-and-sidebar',ok:audits.every(result=>result.fits&&result.navFits),failures:audits.filter(result=>!result.fits||!result.navFits)});
 await navigate('settings');
 liveState({phase:'error',error:Error('장치 요청 시간이 초과되었습니다. 다시 연결하세요.')});
 checks.push({name:'english-auto-apply-errors-and-retry-text',ok:$('#syncStatus').textContent==='Auto-apply failed · The device request timed out. Reconnect the keyboard.'&&$('#retryApply').textContent==='Retry'});
 liveState({phase:'idle'});
 const confirmation=confirmAction('프로필 불러오기','현재 프로필의 기본 키 매핑과 설정을 선택한 파일로 덮어씁니다. 현재 설정을 먼저 내보내 두는 것을 권장합니다.');
 checks.push({name:'english-confirmation-labels-and-body',ok:$('#confirmTitle').textContent==='Import profile'&&$('#cancelConfirm').textContent==='Cancel'&&$('#acceptConfirm').textContent==='Continue'&&!cjk.test($('#confirmDialog').textContent)});
 $('#cancelConfirm').click();await confirmation;
 $('[data-language=ko]').click();await settled();
 checks.push({name:'ko-switch-restores-original-static-and-dynamic-labels',ok:L.language==='ko'&&document.documentElement.lang==='ko'&&$('#pageContext').textContent==='일반'&&$('#languageLabel').textContent==='언어'&&$('#nav [data-page=light] span').textContent==='조명'&&$('#cancelConfirm').textContent==='취소'&&$('#retryApply').textContent==='다시 적용'});
 await screenshot('ko-general');
 $('[data-language=en]').click();await settled();await screenshot('en-general');
 const persisted=await rpc('preferences');checks.push({name:'language-preference-remains-en-for-relaunch-check',ok:persisted.language==='en'&&L.language==='en'});
};
