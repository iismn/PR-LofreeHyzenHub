'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],P=HyzenProtocol,C=HYZEN_CONFIG,I=HyzenInstruments;
const paths={home:'M3 10 12 3l9 7v10H3Z M9 20v-7h6v7',keyboard:'M3 5h18v14H3Z M6 9h1m3 0h1m3 0h1m3 0h0M6 12h1m3 0h1m3 0h1m3 0h0M7 16h10',depth:'M5 3v18M19 3v18M3 7h4m-4 10h4M10 5h4v10h-4Z M12 18v3m-2-2 2 2 2-2',advanced:'M4 7h16M7 4v6M4 17h16M17 14v6',light:'M9 18h6m-5 3h4M8 13a6 6 0 1 1 8 0l-1 2H9ZM12 1v1',test:'M4 4h16v16H4Z M8 12l3 3 6-7',calibration:'M5 3v18M12 3v18M19 3v18M3 8h4m3 7h4m3-8h4',settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',help:'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h0 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',macro:'M8 4 4 8l4 4M4 8h12a4 4 0 0 1 0 8h-5m1-4-4 4 4 4',refresh:'M20 7v5h-5M4 17v-5h5M19 12a7 7 0 0 0-12-5M5 12a7 7 0 0 0 12 5',arrow:'M4 12h16m-6-6 6 6-6 6',moon:'M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',link:'M9 8 7 8a4 4 0 0 0 0 8h3m5-8h2a4 4 0 0 1 0 8h-3M8 12h8',check:'M5 12l4 4L19 6'};
const icon=name=>`<i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${paths[name]||paths.keyboard}"/></svg></i>`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nav=[['home','키보드'],['keyboard','키 매핑'],['depth','입력 깊이'],['advanced','고급 키'],['light','조명'],['macro','매크로'],['test','키 테스트'],['calibration','보정'],['settings','일반'],['help','도움말']];
const state={page:'home',busy:false,connectionPhase:'idle',selected:new Set(),layer:-1,category:'basic',binding:[32,0,4],advanced:'MT',lightGroup:'back',lightDraft:null,macroSlot:0,macroDraft:null,recording:false,recordLast:0,testLog:[],pressed:new Set(),visited:new Set(),testCount:0,lastEvent:0,confirm:null,error:null};
let serial=0,pending=new Map(),toastTimer;
function rpc(action,args={}){return new Promise((resolve,reject)=>{const id=++serial,t=setTimeout(()=>{pending.delete(id);reject(Error('장치 요청 시간이 초과되었습니다. 다시 연결하세요.'));},30000);pending.set(id,{resolve,reject,t});if(!window.chrome?.webview){clearTimeout(t);pending.delete(id);reject(Error('Windows용 LofreeHUB.exe에서 실행하세요.'));return;}chrome.webview.postMessage({id,action,...args});});}
window.chrome?.webview?.addEventListener('message',e=>{const p=pending.get(e.data.id);if(p){pending.delete(e.data.id);clearTimeout(p.t);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.result);}});
const device=new P.Hyzen(rpc,HYZEN_CURVE);
const physical=C.keyLayoutArr.filter(k=>!k.disabled&&k.displayGroup!=='fRow'&&k.keyCode&&k.keyCode!=='20 00 A0');
function keyCode(k){const mod=/^(Meta|Control|Shift|Alt)/.test(k.code);return mod?[32,parseInt(k.hidCode,16),0]:[32,0,parseInt(k.hidCode,16)];}
const catalogue=HYZEN_KEYS.map(k=>({label:k.keyName,code:keyCode(k),event:k.code}));
const paletteLabels={Wireless24g:'2.4GHz 전환',Calc:'계산기',VolDown:'볼륨 −',VolUp:'볼륨 +',Mute:'음소거',Bt1:'Bluetooth 1',Bt2:'Bluetooth 2',Bt3:'Bluetooth 3',Prev:'이전 곡',Next:'다음 곡',Refresh:'새로고침',Search:'검색',Stop:'로딩 중지',Back:'뒤로',Fwd:'앞으로',Pc:'내 PC',Player:'미디어 플레이어',Mail:'메일',Pause:'재생 / 일시정지',Home:'홈페이지',IncreaseScreenBrightness:'화면 밝기 +',ReduceScreenBrightness:'화면 밝기 −',winScreenshot:'Windows 캡처',macScreenshot:'macOS 캡처',winTab:'Windows 창 전환',macTab:'macOS 창 전환',leftClick:'왼쪽 클릭',rightClick:'오른쪽 클릭',middleClick:'가운데 클릭',back:'마우스 뒤로',forward:'마우스 앞으로',scrollUp:'휠 위',scrollDown:'휠 아래',switchMechanicalMagneticAxis:'스위치 모드 전환',openWeb:'공식 웹페이지',Wins:'Windows 모드',Macs:'macOS 모드',Backslash:'백슬래시',BacklightToggle:'백라이트 켜기 / 끄기',BacklightModeSwitch:'백라이트 효과',BacklightColor:'백라이트 색상',BacklightBrightnessDown:'백라이트 밝기 −',BacklightBrightnessUp:'백라이트 밝기 +',BacklightSpeedDown:'백라이트 속도 −',BacklightSpeedUp:'백라이트 속도 +',switchbackLightLuminance:'백라이트 속도 순환',FrontlightToggle:'라이트 바 켜기 / 끄기',FrontlightModeSwitch:'라이트 바 효과',FrontlightColorSwitch:'라이트 바 색상',FrontlightBrightnessDown:'라이트 바 밝기 −',FrontlightBrightnessUp:'라이트 바 밝기 +',FrontlightSpeedDown:'라이트 바 속도 −',FrontlightSpeedUp:'라이트 바 속도 +',switchFrontlightLuminance:'라이트 바 속도 순환',ReceiverBrightnessDown:'수신기 밝기 −',ReceiverBrightnessUp:'수신기 밝기 +',DownDongleSpeed:'수신기 속도 −',UpDongleSpeed:'수신기 속도 +',switchDongleSpeed:'수신기 속도 순환',SwitchDongleLightmode:'수신기 조명 효과',SwitchDongleLightColor:'수신기 색상',LightsAllOff:'전체 조명 끄기'};
const palettes=Object.fromEntries(Object.entries(HYZEN_PALETTES).map(([group,list])=>[group,list.map(k=>{const key=k.tooltipKey.split('.').pop(),label=paletteLabels[key]||(/^profile[1-7]$/.test(key)?'프로필 '+key.slice(-1):key.replace(/^shortcut/,'').replace(/(Ctrl|Win)([A-Z])/,'$1 + $2'));return{label,code:P.bytes(k.keyCode)};})]));
const extras=[...palettes.media,...palettes.light,...palettes.special,{label:'비활성',code:[0,0,0]}];
function labelFor(code){const h=P.hex(code),known=[...catalogue,...extras].find(k=>P.hex(k.code)===h);if(known)return known.label;if(code[0]===0x70||code[0]===0x71)return 'M'+(code[1]+1);if(code[0]===0xa0)return 'FN';return h||'—';}
function firstSelected(){return [...state.selected][0]??-1;}
function nameForIndex(i){const code=device.defaults?.slice(i*3,i*3+3);return code?labelFor(code):'—';}
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,5500);}
function showError(error){
 state.error=error.message;
 if(isLanding()||!device.connected){setVisibleScreen('landing');setConnectionPhase('error',error.message);}
 else{$('#notice').textContent=error.message;$('#notice').hidden=false;toast(error.message);}
}
function confirmAction(title,text){return new Promise(resolve=>{state.confirm=resolve;$('#confirmTitle').textContent=title;$('#confirmText').textContent=text;$('#confirmDialog').showModal();});}
function checkDevice(){if(!device.connected)throw Error('키보드를 먼저 연결하세요.');}
function setBusy(b){state.busy=b;document.body.classList.toggle('busy',b);for(const el of $$('button,input,select'))if(!el.closest('#caption')&&!el.closest('#nav')&&!el.closest('#confirmDialog')&&el.id!=='officialLink'){if(b){el.dataset.wasDisabled=el.disabled?'1':'0';el.disabled=true;}else if(el.dataset.wasDisabled!==undefined){el.disabled=el.dataset.wasDisabled==='1';delete el.dataset.wasDisabled;}}}
async function work(fn,message){
 if(state.busy)return;
 setBusy(true);$('#notice').hidden=true;state.error=null;
 try{await fn();if(message)toast(message);if(device.connected&&!live.busy&&!live.error&&$('#syncStatus').dataset.phase!=='error')liveState({phase:live.last?'saved':'idle'});}
 catch(error){showError(error);}
 finally{setBusy(false);updateConnection();if(isLanding())$('#startConnect').focus({preventScroll:true});}
}
function updateConnection(){const on=device.connected;$('#statusDot').classList.toggle('online',on);$('#pageTitle').textContent=on?device.info.name.replace(/@Lofree$/i,'').trim():'Lofree HYZEN';$('#pageContext').textContent=state.page==='home'?'':nav.find(item=>item[0]===state.page)?.[1]||'';$('#pageContext').hidden=state.page==='home';$('#deviceStatus').textContent=on?'연결됨':'USB 케이블 또는 2.4GHz 수신기를 연결하세요';$('#connectionType').textContent=on?device.info.connection:'연결 대기';$('#connect').textContent=on?'다시 연결':'연결';$('#profileSelect').disabled=!on||state.busy;$('#profileSelect').value=String(device.profile);}

function previewKeyboard(){
 return '<div class="keyboard product-visual"><img id="productPreview" src="hyzen-product.webp" alt="Lofree Hyzen 67 — 투명 키캡과 금속 하우징" width="3335" height="1400" draggable="false"></div>';
}
function isLanding(){return document.body.dataset.screen==='landing';}
function setConnectionPhase(phase,message=''){
 state.connectionPhase=phase;$('#connectScreen').dataset.phase=phase;
 const waiting=phase==='opening'||phase==='reading';
 $('#startConnectLabel').textContent=waiting?'연결 중':phase==='ready'?'연결됨':phase==='error'?'다시 시도':'연결';
 $('#connectMark').innerHTML=waiting?'<span class="connect-spinner"></span>':icon(phase==='ready'?'check':'link');
 $('#connectStatus').textContent=phase==='opening'?'키보드를 찾는 중…':phase==='reading'?'설정을 읽는 중…':phase==='ready'?'연결되었습니다.':message;
 $('#connectStatus').setAttribute('role',phase==='error'?'alert':'status');
 $('#connectScreen').setAttribute('aria-busy',String(waiting));
}
function setVisibleScreen(name){
 const settings=name==='settings',shell=$('.shell'),landing=$('#connectScreen');
 shell.hidden=!settings;shell.inert=!settings;landing.hidden=settings;landing.inert=settings;
 document.body.dataset.screen=name;
}
async function transitionScreen(name){
 if(document.body.dataset.screen===name)return;
 if(name==='settings'&&!device.connected)throw Error('키보드 연결이 완료되지 않았습니다.');
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){setVisibleScreen(name);return;}
 if(typeof document.startViewTransition==='function'){
  const transition=document.startViewTransition(()=>setVisibleScreen(name));
  try{await transition.finished;}catch{setVisibleScreen(name);}
 }else{
  setVisibleScreen(name);const target=name==='settings'?$('.shell'):$('#connectScreen');
  if(target.animate)try{await target.animate([{opacity:0,transform:'translateY(12px)',filter:'blur(4px)'},{opacity:1,transform:'translateY(0)',filter:'blur(0)'}],{duration:400,easing:'cubic-bezier(.2,.7,.2,1)'}).finished;}catch{}
 }
}
async function disconnectToLanding(){
 if(state.recording)stopRecording();
 await live.discard();
 await rpc('disconnect');device.connected=false;state.pressed.clear();setConnectionPhase('idle');
 await transitionScreen('landing');$('#content').replaceChildren();updateConnection();
}

function keyboard(selectable=true){
 const selecting=['keyboard','depth','advanced'].includes(state.page);
 const keys=physical.map(k=>{
  const i=device.index(k.keyCode),locked=!!k.forbidEdit||i<0,binding=i>=0?device.binding(i,state.layer):[],changed=state.page==='keyboard'&&binding.length&&P.hex(binding)!==k.keyCode;
  const x=(Number(k.left)+40)/960*100,y=(Number(k.top)+66)/412*100,w=Number(k.width)/960*100,h=Number(k.height)/412*100;
  const label=k.name+(changed?' → '+labelFor(binding):'')+(locked?' · 고정 키':'');
  return `<button class="key photo-key ${state.selected.has(i)?'selected':''} ${locked?'locked':''}" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%" data-key="${i}" data-event="${esc(eventForCode(k.keyCode))}" aria-label="${esc(label)}" title="${esc(label)}" ${locked&&selecting||!selectable?'disabled':''} aria-pressed="${state.selected.has(i)}">${changed?`<span class="mapping-badge">${esc(labelFor(binding))}</span>`:''}</button>`;
 }).join('');
 const caption=state.page==='test'?'키를 누르면 해당 위치가 밝아집니다.':selecting?(state.selected.size?`${state.selected.size}개 선택 · ${[...state.selected].map(nameForIndex).join(', ')}`:'설정할 키를 선택하세요.'):'',selection=selecting?'<div class="selection-chips"><button class="chip" data-select="wasd">WASD</button><button class="chip" data-select="all">전체</button><button class="chip" data-select="none">해제</button></div>':'';
 return `<article class="card keyboard-card"><div class="keyboard photo-keyboard" role="group" aria-label="Hyzen 67 키보드"><img class="keyboard-photo" src="hyzen-product.webp" alt="Lofree Hyzen 67" width="3335" height="1400" draggable="false">${keys}</div>${caption||selection?`<div class="keyboard-caption"><span>${caption}</span>${selection}</div>`:''}</article>`;
}
function eventForCode(code){return catalogue.find(k=>P.hex(k.code)===code)?.event||'';}
function option(value,label,current){return `<option value="${esc(value)}" ${String(value)===String(current)?'selected':''}>${esc(label)}</option>`;}
function keyOptions(current='20 00 04'){return [...catalogue,...extras].map(k=>option(P.hex(k.code),k.label,current)).join('');}
function range(id,label,value,min,max,step,unit){
 const fixed=Number(value).toFixed(step<1?2:0);
 return `<div class="range-control ruler-control" data-instrument="ruler"><div class="range-heading"><label for="${id}">${label}</label><span class="range-value"><output for="${id}" id="${id}Value" aria-label="${fixed} ${unit}">${dotNumber(fixed)}</output><small>${unit}</small></span></div><div class="ruler-wrap" data-ruler-for="${id}"><div class="instrument-visual">${I.ruler(value,min,max)}</div><input id="${id}" class="ruler-input" data-unit="${unit}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" aria-valuetext="${fixed} ${unit}"></div><div class="range-labels"><span>${min} ${unit}</span><span>${max} ${unit}</span></div></div>`;
}
function dialRange(id,label,value,min,max,step,unit){
 const fixed=Number(value).toFixed(step<1?2:0);
 return '<div class="range-control dial-control" data-instrument="dial"><div class="dial-face" data-dial-for="'+id+'"><div class="instrument-visual">'+I.dial(value,min,max)+'</div><div class="dial-readout"><div class="dial-value"><output for="'+id+'" id="'+id+'Value" aria-label="'+fixed+' '+unit+'">'+dotNumber(fixed)+'</output><small>'+unit+'</small></div><label for="'+id+'" class="dial-label">'+label+'</label></div><input id="'+id+'" class="dial-input" data-unit="'+unit+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+value+'" aria-valuetext="'+fixed+' '+unit+'"></div><div class="range-labels dial-labels"><span>'+min+' '+unit+'</span><span>'+max+' '+unit+'</span></div></div>';
}
function syncInstrument(input,immediate=false){
 const wrap=input.closest('[data-instrument]');if(!wrap)return;
 const value=Number(input.value),min=Number(input.min),max=Number(input.max),fixed=value.toFixed(Number(input.step)<1?2:0),unit=input.dataset.unit||'';
 const output=$('#'+input.id+'Value');if(output){if(output.dataset.value!==fixed){output.innerHTML=dotNumber(fixed);output.dataset.value=fixed;}output.setAttribute('aria-label',fixed+' '+unit);}
 input.setAttribute('aria-valuetext',fixed+' '+unit);
 HyzenInstrumentMotion.sync(input,{raw:instrumentDrag?.input===input?instrumentDrag.rawValue:null,immediate});
}
function syncInstruments(){for(const input of $$('#content input[type=range]'))syncInstrument(input,true);}

function fold(title,body,extra=''){return `<details class="option-fold ${extra}"><summary>${title}</summary><div class="fold-body">${body}</div></details>`;}
function toggle(id,title,desc,on){return `<div class="setting-row"><label for="${id}">${title}</label><input type="checkbox" class="switch" id="${id}" ${on?'checked':''}></div>`;}
function actionRow(){return '';}
function dotNumber(value){return I.dotText(value);}
function home(){
 const rate=device.global[device.info.productId===37?54:53],frequency=rate===0?'8000':rate===4?'1000':null;
 const first=Math.round(P.u16(device.global,34)/60),second=Math.round(P.u16(device.global,36)/60);
 const stats=[
  ['depth','스위치',dotNumber(device.func[56]===2?'MAG':'MEC'),'', ''],
  ['link','폴링레이트',frequency?dotNumber(frequency):'—','Hz',device.info.connection],
  ['keyboard','펌웨어',device.versions.keyboard?'<small>V</small>'+dotNumber(device.versions.keyboard):'—','',device.versions.receiver?'수신기 V'+device.versions.receiver:'키보드'],
  ['moon','자동 절전',device.global[33]?dotNumber(first):'꺼짐',device.global[33]?'분':'',device.global[33]?'2단계 '+second+'분':'']
 ];
 return keyboard(false)+'<div class="stats">'+stats.map(([ic,label,value,unit,foot])=>'<article class="card stat"><div class="stat-label">'+icon(ic)+label+'</div><div class="stat-value">'+value+(unit?'<small>'+unit+'</small>':'')+'</div>'+(foot?'<div class="stat-foot">'+foot+'</div>':'')+'</article>').join('')+'</div>';
}
function keymap(){const list=state.category==='basic'?catalogue:state.category==='media'?palettes.media:state.category==='lightkeys'?palettes.light:state.category==='special'?[...palettes.special,{label:'비활성',code:[0,0,0]}]:state.category==='macro'?Array.from({length:28},(_,i)=>{const m=device.cache.macros?.[i];return{label:'M'+(i+1),code:[m?.mode?0x70:0x71,i,m?.mode||m?.loops||1]};}):[];const i=firstSelected(),current=i<0?'—':labelFor(device.binding(i,state.layer));return keyboard()+`<article class="card"><div class="section-heading"><h2>동작 지정</h2><select id="layerSelect" aria-label="편집할 레이어">${[[-1,'기본 레이어'],[0,'Windows · Fn'],[2,'Windows · Fn + Shift'],[1,'macOS · Fn'],[3,'macOS · Fn + Shift']].map(([v,l])=>option(v,l,state.layer)).join('')}</select></div><div class="editor-grid"><div><div class="pill-tabs">${[['basic','기본 키'],['media','미디어'],['lightkeys','조명 키'],['special','특수 · 마우스'],['macro','매크로']].map(([id,title])=>`<button data-category="${id}" class="${id===state.category?'active':''}">${title}</button>`).join('')}</div><div class="binding-keys">${list.map(k=>`<button data-binding="${P.hex(k.code)}" title="${esc(k.label)}" class="${P.hex(k.code)===P.hex(state.binding)?'chosen':''}">${esc(k.label)}</button>`).join('')}</div></div><div><p class="small muted">현재 동작: ${esc(current)}</p><div class="binding-preview"><span class="big-key">${esc(i<0?'선택':nameForIndex(i))}</span>${icon('arrow')}<span class="big-key" id="bindingTarget">${esc(labelFor(state.binding))}</span></div><label class="small muted" for="modifierSelect">보조키 조합</label><select id="modifierSelect" aria-label="보조키 조합">${[[0,'없음'],[1,'Ctrl'],[2,'Shift'],[4,'Alt'],[8,'Win'],[3,'Ctrl + Shift'],[5,'Ctrl + Alt'],[6,'Alt + Shift'],[9,'Win + Ctrl'],[10,'Win + Shift'],[16,'오른쪽 Ctrl'],[32,'오른쪽 Shift'],[64,'오른쪽 Alt'],[128,'오른쪽 Win'],[160,'오른쪽 Win + Shift']].map(([v,l])=>option(v,l,state.binding[0]===32&&state.binding[2]?state.binding[1]:0)).join('')}</select></div></div>${actionRow('saveMap','선택한 키에 저장','Fn 레이어는 키보드 전체에서 공유합니다. 기본 레이어는 현재 프로필에 저장됩니다.')}</article>`;}
function depth(){
 const i=firstSelected();let v={mm:1.5,press:.1,release:.1,top:.1,bottom:.1,rtEnabled:false,deadEnabled:false};if(i>=0)try{v=device.actuation(i);}catch{}
 const deadzone=toggle('deadEnabled','데드존 사용','',v.deadEnabled)+`<div class="inline deadzone-fields"><label for="deadTop">위</label><input id="deadTop" type="number" min="0.01" max="${device.maxMm}" step=".01" value="${v.top.toFixed(2)}"><label for="deadBottom">아래</label><input id="deadBottom" type="number" min="0.01" max="${device.maxMm}" step=".01" value="${v.bottom.toFixed(2)}"><span class="small muted">mm</span></div>`;
 return keyboard()+`${device.func[56]!==2?'<div class="notice">MAG 모드에서 사용할 수 있습니다. 일반 설정에서 스위치 모드를 변경하세요.</div>':''}<div class="two-col depth-console"><article class="card actuation-card"><div class="panel-heading"><h2>입력 지점</h2></div>${dialRange('actMm','입력 깊이',v.mm,device.minMm,device.maxMm,.01,'mm')}${fold('데드존',deadzone)}</article><article class="card rt-card"><div class="panel-heading"><h2>Rapid Trigger</h2><input type="checkbox" class="switch" id="rtEnabled" aria-label="Rapid Trigger 사용" ${v.rtEnabled?'checked':''}></div>${range('rtPress','누를 때',v.press,device.minMm,device.maxMm,.01,'mm')}${range('rtRelease','뗄 때',v.release,device.minMm,device.maxMm,.01,'mm')}</article></div>${actionRow('saveActuation','선택한 키에 저장')}`;
}
function advanced(){const type=state.advanced,desc={MT:'짧게 누를 때와 길게 누를 때 서로 다른 키를 실행합니다.',TGL:'한 번 눌러 키를 유지하고, 다시 눌러 해제합니다.',RS:'두 키의 입력 깊이를 비교해 더 깊게 누른 키를 우선합니다.',SOCD:'반대 방향의 두 키를 동시에 누를 때 우선할 동작을 정합니다.',HT:'두 키를 서로 연결해 한 방향 또는 양방향으로 동작시킵니다.',DKS:'누르는 깊이와 떼는 단계에 따라 최대 네 가지 키 동작을 실행합니다.'};let form='';if(type==='MT'||type==='TGL')form=`<div class="advanced-form"><div class="field"><label for="advancedTap">${type==='MT'?'짧게 누를 때':'유지할 키'}</label><select id="advancedTap">${keyOptions()}</select></div>${type==='MT'?`<div class="field"><label for="advancedHold">길게 누를 때</label><select id="advancedHold">${keyOptions('20 01 00')}</select></div><div class="field"><label for="advancedDelay">길게 누르기 기준 (ms)</label><input id="advancedDelay" type="number" min="0" max="2550" step="10" value="350"></div>`:''}</div>`;
 else if(type==='DKS')form=`<div class="dks-rows">${['1차 누름','2차 누름','1차 해제','2차 해제'].map((l,i)=>`<div class="dks-step"><span class="small muted">${i+1}</span><select id="dksKey${i}" aria-label="${l} 동작">${keyOptions('20 00 '+(4+i).toString(16).padStart(2,'0'))}</select><input id="dksPoint${i}" aria-label="${l} 깊이 mm" type="number" min="${device.minMm}" max="${device.maxMm}" step=".01" value="${[.7,2.5,2.5,.7][i]}"></div>`).join('')}</div><p class="small muted" style="margin-top:15px">1·2: 누를 때 / 3·4: 뗄 때 · 각 단계에서 지정한 키를 실행합니다.</p>`;
 else form=`<div class="advanced-form"><div class="field"><label for="partnerKey">함께 동작할 키</label><select id="partnerKey">${physical.filter(k=>!k.forbidEdit&&device.index(k.keyCode)>=0).map(k=>option(device.index(k.keyCode),k.name,device.index('20 00 16'))).join('')}</select></div><div class="field"><label for="advancedPriority">${type==='SOCD'?'우선순위':type==='HT'?'연결 방향':'입력 비교'}</label><select id="advancedPriority">${(type==='SOCD'?[[0,'나중에 누른 키 우선'],[1,'선택한 키 우선'],[2,'상대 키 우선'],[3,'중립 · 두 키 해제']]:type==='HT'?[[0,'양방향'],[1,'선택한 키 → 상대 키'],[2,'상대 키 → 선택한 키']]:[[0,'더 깊게 누른 키 우선']]).map(([v,l])=>option(v,l,0)).join('')}</select></div></div>${range('advancedMm','동작 시작 깊이',1,device.minMm,device.maxMm,.01,'mm')}${toggle('advancedRt','빠른 입력 사용','연결된 두 키에 빠른 반응을 적용합니다.',false)}`;
 return keyboard()+`<article class="card"><div class="section-heading"><h2>고급 키</h2><button data-action="clearAdvanced">일반 키로 복원</button></div><div class="pill-tabs">${Object.keys(desc).map(t=>`<button data-advanced="${t}" class="${type===t?'active':''}">${t}</button>`).join('')}</div><p class="advanced-description">${desc[type]}</p>${form}${actionRow('saveAdvanced','선택한 키에 저장','고급 키는 기본 레이어에서 동작합니다. 게임 규정에 맞게 설정하세요.')}</article>`;}
const effectNames={constantlyOn:'고정',breathe:'숨쉬기',singleLiang:'누른 키',singleOff:'꺼지는 키',heartbeat:'심장 박동',ripple:'물결',alternate:'교차',raindrop:'빗방울',conversion:'색 전환',piano:'피아노',wave:'웨이브',spin:'회전',meteor:'유성',OpenClose:'열림과 닫힘',storeLibra:'쌓기'};
function lights(){
 const group=state.lightGroup,list=group==='back'?C.mainBackLight:group==='front'?C.prepositionLight:C.dongleLight,v=state.lightDraft||device.light(group);state.lightDraft=v;
 const effect=list.find(e=>parseInt(e.command,16)===v.mode)||list[0],name=effectNames[effect.tooltip]||effect.tooltip;
 const effects=`<div class="effect-grid">${list.map(e=>`<button class="effect ${parseInt(e.command,16)===v.mode?'active':''}" data-effect="${e.command}" aria-pressed="${parseInt(e.command,16)===v.mode}">${icon(e.tooltip==='breathe'?'moon':e.tooltip==='wave'?'link':'light')}<span>${effectNames[e.tooltip]||e.tooltip}</span></button>`).join('')}</div>`;
 const color=`<div class="setting-row color-row"><label for="lightColor">색상</label><div class="inline"><span id="colorLabel" class="small muted">${v.color.toUpperCase()}</span><input type="color" id="lightColor" value="${v.color}"></div></div><div class="swatches">${['#c6e4a2','#c5dfec','#e5c2a9','#bcb0da','#ffffff','#ff4e60'].map(c=>`<button class="swatch" style="background:${c}" data-color="${c}" aria-label="${c} 색상"></button>`).join('')}</div>`;
 const extra=(effect.speedBol?range('lightSpeed','속도',v.speed,0,4,1,'단계'):'')+toggle('customColor','단색 사용','',v.custom)+(effect.directionBol?`<div class="setting-row"><label for="lightDirection">진행 방향</label><select id="lightDirection">${option(0,'왼쪽 → 오른쪽',v.direction)}${option(1,'오른쪽 → 왼쪽',v.direction)}</select></div>`:'');
 const presets=`<div class="quick-actions">${[['calm','녹색','#c6e4a2'],['ocean','파랑','#8ab9d0'],['warm','웜화이트','#e9b899']].map(([id,l,c])=>`<button data-light-theme="${id}" class="quick-action"><span class="swatch" style="background:${c}"></span><span>${l}</span>${icon('arrow')}</button>`).join('')}</div>`;
 return `<article class="card lighting-card"><div class="pill-tabs light-tabs">${[['back','키보드'],['front','라이트 바'],['receiver','수신기']].map(([id,label])=>`<button data-light-group="${id}" class="${id===group?'active':''}">${label}</button>`).join('')}</div><details class="option-fold effect-picker"><summary><span>효과</span><span class="summary-value">${name}</span></summary><div class="fold-body">${effects}</div></details><div class="light-preview" style="--led-color:${esc(v.color)}"></div><div class="two-col lighting-controls">${range('lightBrightness','밝기',v.brightness,0,100,1,'%')}<div class="color-control">${color}</div></div>${fold('세부 설정',extra)}${actionRow('saveLight','키보드에 저장')}</article><details class="card option-card"><summary>전체 조명 프리셋</summary><div class="fold-body">${presets}</div></details>`;
}
function macroPage(){const m=state.macroDraft||device.cache.macros?.[state.macroSlot]||{mode:0,loops:1,fixed:false,actions:[]};state.macroDraft=JSON.parse(JSON.stringify(m));return `<article class="card"><div class="section-heading"><div><h2>매크로 녹화</h2></div><select id="macroSlot" aria-label="매크로 슬롯">${Array.from({length:28},(_,i)=>option(i,'M'+(i+1),state.macroSlot)).join('')}</select></div><div class="advanced-form"><div class="field"><label for="macroMode">실행 방식</label><select id="macroMode">${option(0,'지정 횟수 반복',m.mode)}${option(1,'누르고 있는 동안 반복',m.mode)}${option(2,'한 번 눌러 시작 / 다시 눌러 중지',m.mode)}</select></div><div class="field"><label for="macroLoops">반복 횟수</label><input id="macroLoops" type="number" min="1" max="255" value="${m.loops}"></div></div><div id="recorder" class="recorder ${state.recording?'recording':''}" tabindex="0" aria-label="매크로 녹화 영역"><p>${state.recording?'<span class="record-dot"></span>녹화 중 · 키를 입력하고 녹화 중지를 누르세요.':'녹화를 시작하면 이 창에서 누른 키와 간격을 기록합니다.'}</p><div class="macro-events" id="macroEvents">${macroEventHtml(m.actions)}</div></div><div class="action-row"><div class="inline"><button data-action="recordMacro">${state.recording?'녹화 중지':'녹화 시작'}</button><button data-action="clearMacro" ${state.recording?'disabled':''}>비우기</button></div><span class="small muted" id="macroCount">${m.actions.length}개 동작</span></div>${actionRow('saveMacro','키보드에 저장','저장 후 키 매핑 → 매크로에서 M'+(state.macroSlot+1)+'을 원하는 키에 지정하세요.')}</article><article class="card help-card"><h3>입력과 재생</h3><p>녹화는 이 창에 포커스가 있을 때만 동작합니다. 누름·해제와 입력 간격을 기록하며, 키보드의 28개 매크로 슬롯에 저장합니다. 녹화 영역 바깥을 누르거나 창이 비활성화되면 녹화를 중지합니다.</p></article>`;}
function macroEventHtml(actions){return actions.slice(-36).map(a=>`<span class="macro-event">${esc(labelFor(a.modifier?[32,a.hid,0]:[32,0,a.hid]))} ${a.down?'↓':'↑'} <span class="muted">${a.delay}ms</span></span>`).join('');}
function testPage(){return keyboard(false)+`<article class="card"><div class="section-heading"><div class="test-summary"><span><strong id="testCount">${state.testCount}</strong>입력</span><span><strong id="visitedCount">${state.visited.size}</strong>종류</span></div><button data-action="clearTest">기록 지우기</button></div><div class="table-wrap"><table><thead><tr><th>#</th><th>키</th><th>시간</th><th>간격</th><th>상태</th></tr></thead><tbody id="testBody">${testRows()}</tbody></table></div></article><p class="small muted">이 창이 활성화되어 있을 때 Windows가 전달한 입력을 표시합니다. 입력 간격은 폴링레이트나 실제 하드웨어 지연의 측정값이 아닙니다.</p>`;}
function testRows(){return state.testLog.length?state.testLog.slice(0,100).map((e,i)=>`<tr><td>${state.testLog.length-i}</td><td>${esc(e.key)}</td><td>${e.time}</td><td>${Math.round(e.interval)} ms</td><td class="${e.down?'down-event':''}">${e.down?'↓ 누름':'↑ 해제'}</td></tr>`).join(''):'<tr><td colspan="5" class="empty-row">키보드의 아무 키나 눌러보세요.</td></tr>';}
function calibration(){const wired=device.info?.productId!==37;return `<article class="card calibration-card"><div class="calibration-visual"><div class="shaft"></div></div><div><h2>MAG 보정</h2><p class="muted small" style="margin-top:14px">보정은 USB 유선 · MAG 모드에서 사용할 수 있습니다. 공식 보정 화면으로 연결해 장치의 기준 값을 맞춥니다.</p><ol><li>USB 케이블을 연결하고 키보드를 유선 모드로 전환합니다.</li><li>일반 설정에서 MAG 모드를 선택합니다.</li><li>공식 화면에서 Recalibrate를 열고 안내에 따라 키를 누릅니다.</li><li>보정이 끝나면 Lofree HUB로 돌아와 다시 연결합니다.</li></ol><button class="primary" data-action="official">공식 보정 화면 열기 ↗</button></div></article><div class="notice">${wired?'현재 USB로 연결되어 있습니다.':'현재 2.4GHz 수신기로 연결되어 있어 보정을 시작할 수 없습니다.'} 공식 도구를 사용할 때는 이 프로그램의 연결을 먼저 해제합니다.</div>`;}
function settings(){
 const g=device.global,f=device.func,cap=currentCapabilities();
 const locks=toggle('winLock','Windows 키 잠금','',f[22]===1)+toggle('altTabLock','Alt + Tab 잠금','',f[60]===1)+toggle('altF4Lock','Alt + F4 잠금','',f[61]===1)+toggle('lightspeed','Lightspeed','',f[62]===0x66);
 const sleep=toggle('autoSleep','자동 절전','',!!g[33])+`<div class="setting-row"><label for="sleepFirst">1단계 절전</label><div class="inline"><input id="sleepFirst" type="number" min="1" max="1092" value="${Math.round(P.u16(g,34)/60)}"><span class="small muted">분</span></div></div><div class="setting-row"><label for="sleepSecond">2단계 절전</label><div class="inline"><input id="sleepSecond" type="number" min="1" max="1092" value="${Math.round(P.u16(g,36)/60)}"><span class="small muted">분</span></div></div>${actionRow('saveSleep')}`;
 const rate=cap.wired?`<div class="setting-row"><label for="wiredRate">유선 폴링레이트</label><select id="wiredRate">${option(0,'8000 Hz',g[53])}${option(4,'1000 Hz',g[53])}</select></div>`:`<div class="setting-row"><label for="wirelessRate">무선 폴링레이트</label><select id="wirelessRate">${option(0,'8000 Hz',g[54])}${option(4,'1000 Hz',g[54])}</select></div>`;
 const profile=`<div class="setting-row"><div class="setting-label">기본 프로필 백업</div><div class="inline"><button data-action="export">내보내기</button><button data-action="import">불러오기</button></div></div><div class="setting-row"><div class="setting-label">장치 연결</div><button data-action="disconnect">연결 해제</button></div>`;
 const firmware=(cap.firmware?`<div class="setting-row"><div class="setting-label">펌웨어<span class="sub-label">키보드 ${device.versions.keyboard?'V'+device.versions.keyboard:'—'}${device.versions.receiver?' · 수신기 V'+device.versions.receiver:''}</span></div><button data-action="official">공식 업데이트 ↗</button></div>`:'')+`<div class="setting-row"><div class="setting-label">초기화</div><button data-action="official">공식 드라이버 ↗</button></div>`;
 return `<article class="card"><div class="setting-row"><label for="axisMode">스위치 모드</label><select id="axisMode">${option(2,'MAG',f[56])}${option(1,'MEC',f[56])}</select></div>${fold('키 잠금 · 고속 응답',locks)}${actionRow('saveMode')}</article>${[['절전',sleep],['폴링레이트',rate],['프로필 · 연결',profile],[cap.firmware?'업데이트 · 초기화':'초기화',firmware]].map(([title,body])=>`<details class="card option-card"><summary>${title}</summary><div class="fold-body">${body}</div></details>`).join('')}`;
}
function help(){return `<article class="card help-card"><h2>Lofree HUB 1.1.2</h2><p>Lofree Hyzen 67용 Windows 제어 프로그램입니다. USB 또는 2.4GHz로 연결해 키 매핑, 입력 깊이, 조명 등을 설정합니다.</p></article>${[['연결과 프로필','USB 유선 또는 2.4GHz 수신기로 연결합니다. Bluetooth에서는 설정용 HID 인터페이스가 제공되지 않습니다. 상단에서 7개 프로필을 전환할 수 있고, 키 매핑과 조명 등은 현재 프로필에 저장합니다.'],['저장과 설정 확인','변경한 값은 자동으로 키보드에 적용합니다. 연속 조작은 짧게 묶어 전송하고, 같은 값을 다시 읽어 확인합니다. 하단에서 적용 상태를 확인하세요. 실패하면 ‘다시 적용’을 누르거나 새로고침으로 장치 값을 다시 읽을 수 있습니다.'],['키 매핑과 Fn 레이어','키를 선택한 뒤 새 동작을 지정합니다. Ctrl을 누르며 선택하면 여러 키를 편집할 수 있습니다. Fn과 고정 키는 변경할 수 없습니다. 네 가지 Fn 레이어는 프로필 전체에서 공유됩니다.'],['입력 깊이와 고급 키','MAG 모드에서는 장치의 보정 값으로 mm와 원시 값을 변환합니다. RT는 누름·해제 이동 거리를 따로 조절하고, MT·TGL·DKS·RS·SOCD·HT를 설정할 수 있습니다. 두 키 기능은 서로 다른 키를 연결해야 합니다.'],['키 테스트와 매크로','입력 기록은 이 프로그램 창이 활성 상태일 때만 메모리에 보관합니다. 창을 벗어나면 녹화를 중지합니다. Fn이나 Windows가 가로채는 단축키는 일반 입력 이벤트에 나타나지 않을 수 있습니다. 매크로는 녹화를 중지하면 자동 적용합니다. 키 매핑에서 M1~M28을 지정하세요.'],['보정 · 펌웨어 · 초기화','이 버전의 보정, 펌웨어 쓰기, 공장 초기화는 공식 드라이버로 연결합니다. 프로그램에서 공식 도구를 열면 HID 연결을 먼저 해제합니다. 보정은 유선 MAG 모드에서 진행하세요.'],['백업 범위','내보내기는 현재 프로필의 기본 레이어 매핑과 기능 설정을 포함합니다. Fn 레이어·고급 키·입력 깊이·매크로 데이터는 이 백업 형식에 포함되지 않습니다. 원본 JSON 파일을 별도로 보관하세요.']].map(([t,p])=>`<details class="card help-card"><summary>${t}</summary><p>${p}</p></details>`).join('')}<button data-action="official">Lofree 공식 Hyzen 드라이버 ↗</button>`;}
async function loadAdvanced(prefetched=undefined){if(state.page!=='advanced'||firstSelected()<0)return;const v=prefetched===undefined?await device.advancedConfig(firstSelected()):prefetched;if(v){state.advanced=v.kind;render();if(v.tap)$('#advancedTap').value=P.hex(v.tap);if(v.hold)$('#advancedHold').value=P.hex(v.hold);if(v.delay!==undefined)$('#advancedDelay').value=v.delay;if(v.partner!==undefined)$('#partnerKey').value=v.partner;if(v.priority!==undefined)$('#advancedPriority').value=v.priority;if(v.mm!==undefined){$('#advancedMm').value=v.mm;syncInstrument($('#advancedMm'),true);}if(v.rtEnabled!==undefined)$('#advancedRt').checked=v.rtEnabled;if(v.rows)for(let n=0;n<4;n++){$('#dksKey'+n).value=P.hex(v.rows[n].code);$('#dksPoint'+n).value=v.points[n].toFixed(2);}}}
async function navigate(page){
 if(!device.connected||!availablePage(page))return;
 const meta=nav.find(item=>item[0]===page);if(!meta)return;
 const from=state.page,animate=!isLanding()&&from!==page&&$('#content').children.length>0;
 if(state.recording)stopRecording();
 if(live.busy||live.error)await live.flush();
 if(['depth','advanced'].includes(page))await device.module('actuation');
 if(page==='macro')await device.module('macros');
 const keyIndex=['keyboard','depth','advanced'].includes(page)?device.index('20 00 1A'):-1;
 const advancedValue=page==='advanced'&&keyIndex>=0?await device.advancedConfig(keyIndex):undefined;
 await HyzenPageMotion.transition(async()=>{
  finishInstrumentDrag();HyzenInstrumentMotion.settleAll();
  state.page=page;state.selected.clear();state.lightDraft=null;state.layer=-1;
  if(page==='macro')state.macroDraft=null;
  if(keyIndex>=0)state.selected.add(keyIndex);
  HyzenPageMotion.setActive(page,animate);
  render();if(page==='advanced')await loadAdvanced(advancedValue);$('main').scrollTop=0;
 },from,page,{animate});
}
function render(){validationError=null;document.body.dataset.page=state.page;
 if(!device.connected){$('#content').replaceChildren();if(!isLanding())setVisibleScreen('landing');if(state.connectionPhase==='ready')setConnectionPhase('idle');updateConnection();return;}
 const views={home,keyboard:keymap,depth,advanced,light:lights,macro:macroPage,test:testPage,calibration,settings,help};
 $('#content').innerHTML=views[state.page]();syncInstruments();HyzenBlockGlow.refresh($('#content'));
 for(const paragraph of $$('#content .advanced-description,#content>p.small.muted')){const details=document.createElement('details');details.className='inline-help';details.innerHTML='<summary>사용 안내</summary>';paragraph.before(details);details.append(paragraph);}
 updateConnection();if(state.page==='test')paintTest();
}
async function connect(){
 await live.discard();
 try{
  await device.connect(phase=>setConnectionPhase(phase));
  state.lightDraft=null;state.macroDraft=null;
  updateNavigationVisibility();liveState({phase:'idle'});
  await navigate('home');
  await transitionScreen('settings');
  $('#pageTitle').focus({preventScroll:true});
 }catch(error){device.connected=false;setVisibleScreen('landing');throw error;}
}
function selectedIndices(){if(!state.selected.size)throw Error('설정할 키를 먼저 선택하세요.');return[...state.selected];}
function val(id){const el=$('#'+id);if(!el)throw Error('설정 항목을 찾지 못했습니다: '+id);return Number(el.value);}
async function saveAdvanced(){const indices=selectedIndices();if(indices.length!==1)throw Error('고급 키는 한 번에 하나의 시작 키를 선택하세요.');const type=state.advanced,i=indices[0];let v={};if(type==='MT'||type==='TGL'){v.tap=P.bytes($('#advancedTap').value);if(type==='MT'){v.hold=P.bytes($('#advancedHold').value);v.delay=val('advancedDelay');if(v.delay<0||v.delay>2550)throw Error('길게 누르기 기준은 0~2550ms입니다.');}}
 else if(type==='DKS'){v.points=Array.from({length:4},(_,j)=>val('dksPoint'+j));if(v.points[0]>=v.points[1]||v.points[2]<=v.points[3])throw Error('누름 지점은 얕은 쪽부터, 해제 지점은 깊은 쪽부터 지정하세요.');v.rows=Array.from({length:4},(_,j)=>({code:P.bytes($('#dksKey'+j).value),flags:[0x80,0x40,0x20,0x10][j]}));}
 else v={partner:val('partnerKey'),priority:val('advancedPriority'),mm:val('advancedMm'),rtEnabled:$('#advancedRt').checked};
 await device.advanced(type,i,v);
}
async function exportSettings(){await live.flush();const data={format:'HyzenControl.BasicProfile',version:1,model:'HYZEN67',exported:new Date().toISOString(),profile:device.profile,matrix:await device.read(8,384,device.profile*384),functions:await device.read(5,64,device.profile*64)};const ok=await rpc('export',{text:JSON.stringify(data,null,2)});if(ok)toast('현재 프로필의 기본 설정을 내보냈습니다.');}
async function importSettings(){await live.flush();const text=await rpc('import');if(!text)return;let data;try{data=JSON.parse(text);}catch{throw Error('올바른 JSON 파일이 아닙니다.');}if(data.format!=='HyzenControl.BasicProfile'||data.version!==1||data.model!=='HYZEN67'||!validByteArray(data.matrix,384)||!validByteArray(data.functions,64))throw Error('지원하는 Hyzen 기본 프로필 백업이 아닙니다.');if(!await confirmAction('프로필 불러오기','현재 프로필의 기본 키 매핑과 설정을 선택한 파일로 덮어씁니다. 현재 설정을 먼저 내보내 두는 것을 권장합니다.'))return;let f=data.functions.slice();f[0]=device.profile;for(let i of [33,34,35,36,37,53,54])f[i]=device.func[i];await device.verified(9,8,data.matrix,device.profile*384);await device.verified(6,5,f,device.profile*64);await device.refresh();render();toast('프로필을 불러왔습니다.');}
function validByteArray(a,n){return Array.isArray(a)&&a.length===n&&a.every(x=>Number.isInteger(x)&&x>=0&&x<=255);}
const actions={
 connect,refresh:async()=>{checkDevice();await live.discard();await device.refresh();updateNavigationVisibility();await navigate(availablePage(state.page)?state.page:'home');liveState({phase:'idle'});},
 clearAdvanced:async()=>{await live.flush();for(const i of selectedIndices())await device.clearAdvanced(i);render();},
 export:exportSettings,import:importSettings,
 disconnect:async()=>{await live.flush();await disconnectToLanding();},
 official:async()=>{await live.flush();if(device.connected)await disconnectToLanding();await rpc('official');},
 retryApply:()=>live.retry(),
 clearMacro:async()=>{state.macroDraft={mode:0,loops:1,fixed:false,actions:[]};render();scheduleAuto('macro');},
 clearTest:async()=>{state.testLog=[];state.visited.clear();state.pressed.clear();state.testCount=0;state.lastEvent=0;render();}
};
function stopRecording(){if(!state.recording)return;state.recording=false;const m=state.macroDraft,down=new Map();for(const a of m.actions){let k=(a.modifier?'m':'k')+a.hid;a.down?down.set(k,a):down.delete(k);}for(const a of down.values())m.actions.push({...a,down:false,delay:0});scheduleAuto('macro');}
function paintTest(){for(const k of $$('.key')){k.classList.toggle('down',state.pressed.has(k.dataset.event));k.classList.toggle('visited',state.visited.has(k.dataset.event));}}
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.caption){rpc('caption',{command:b.dataset.caption});return;}if(b.id==='cancelConfirm'||b.id==='acceptConfirm'){const resolve=state.confirm;state.confirm=null;$('#confirmDialog').close();resolve?.(b.id==='acceptConfirm');return;}if(state.busy)return;
 if(b.dataset.page){await work(()=>navigate(b.dataset.page));return;}
 if(b.dataset.key!==undefined){let i=Number(b.dataset.key);if(i<0||!['keyboard','depth','advanced'].includes(state.page))return;await work(async()=>{if(live.busy||live.error)await live.flush();if(e.ctrlKey){state.selected.has(i)?state.selected.delete(i):state.selected.add(i);}else{state.selected.clear();state.selected.add(i);}render();if(state.page==='advanced')await loadAdvanced();});return;}
 if(b.dataset.select){await work(async()=>{if(live.busy||live.error)await live.flush();if(b.dataset.select==='none')state.selected.clear();else if(b.dataset.select==='wasd')state.selected=new Set(['20 00 1A','20 00 04','20 00 16','20 00 07'].map(c=>device.index(c)).filter(i=>i>=0));else state.selected=new Set(physical.filter(k=>!k.forbidEdit).map(k=>device.index(k.keyCode)).filter(i=>i>=0));render();});return;}
 if(b.dataset.category){await work(async()=>{if(live.busy||live.error)await live.flush();state.category=b.dataset.category;if(state.category==='macro')await device.module('macros');render();});return;}
 if(b.dataset.binding){state.binding=P.bytes(b.dataset.binding);render();scheduleAuto('map');return;}
 if(b.dataset.advanced){state.advanced=b.dataset.advanced;render();scheduleAuto('advanced');return;}
 if(b.dataset.lightGroup){await work(async()=>{if(live.busy||live.error)await live.flush();state.lightGroup=b.dataset.lightGroup;state.lightDraft=null;render();});return;}
 if(b.dataset.effect){const v=state.lightDraft;v.mode=parseInt(b.dataset.effect,16);v.brightness=val('lightBrightness');v.color=$('#lightColor').value;v.custom=$('#customColor').checked;if($('#lightSpeed'))v.speed=val('lightSpeed');render();scheduleAuto('light',['mode']);return;}
 if(b.dataset.color){$('#lightColor').value=b.dataset.color;$('#lightColor').dispatchEvent(new Event('input',{bubbles:true}));return;}
 if(b.dataset.lightTheme){await work(async()=>{await live.flush();const c={calm:'#c6e4a2',ocean:'#8ab9d0',warm:'#e9b899'}[b.dataset.lightTheme];for(const group of ['back','front','receiver'])await device.setLight(group,{mode:0,brightness:55,speed:2,color:c,custom:true,direction:0});state.lightDraft=null;render();},'조명 테마를 저장했습니다.');return;}
 if(b.dataset.action==='recordMacro'){if(state.recording)stopRecording();else{await work(async()=>{await live.flush();state.macroDraft.actions=[];state.recording=true;state.recordLast=performance.now();});}render();if(state.recording)$('#recorder').focus();return;}
 const action=b.dataset.action||(b.id==='connect'?'connect':b.id==='refresh'?'refresh':b.id==='officialLink'?'official':b.id==='retryApply'?'retryApply':null);if(action&&actions[action])await work(actions[action],/^save|^clearAdvanced/.test(action)?'장치에서 저장 값을 확인했습니다.':null);
});
let instrumentDrag=null;
function pointerAngle(event,rect){return Math.atan2(event.clientX-rect.left-rect.width/2,-(event.clientY-rect.top-rect.height/2))*180/Math.PI;}
function moveInstrument(event){
 const drag=instrumentDrag;if(!drag||drag.pointerId!==event.pointerId)return;
 const {surface,input,rect}=drag;if(!surface.isConnected||input.disabled||state.busy){instrumentDrag=null;return;}
 const min=Number(input.min),max=Number(input.max),step=Number(input.step);
 if(drag.kind==='dial'){
  const angle=pointerAngle(event,rect);drag.rawValue-=I.angleDelta(drag.previousAngle,angle)/280*(max-min);drag.previousAngle=angle;
 }else{drag.rawValue-=(event.clientX-drag.previousX)/(rect.width*.96)*(max-min);drag.previousX=event.clientX;}
 drag.rawValue=Math.max(min,Math.min(max,drag.rawValue));input.value=I.stepped(drag.rawValue,min,max,step);
 input.dispatchEvent(new Event('input',{bubbles:true}));
}
document.addEventListener('pointerdown',event=>{
 const surface=event.target.closest('.dial-face,.ruler-wrap');if(!surface||state.busy||event.button!==0)return;
 const input=$('#'+(surface.dataset.dialFor||surface.dataset.rulerFor));if(!input||input.disabled)return;
 event.preventDefault();input.focus({preventScroll:true});
 const rect=surface.getBoundingClientRect();instrumentDrag={surface,input,rect,kind:surface.dataset.dialFor?'dial':'ruler',pointerId:event.pointerId,rawValue:Number(input.value),previousX:event.clientX,previousAngle:pointerAngle(event,rect)};
 surface.classList.add('is-dragging');HyzenInstrumentMotion.hover(surface,event);
 try{surface.setPointerCapture(event.pointerId);}catch{}
});
document.addEventListener('pointerover',event=>{HyzenInstrumentMotion.hover(event.target.closest('.dial-face,.ruler-wrap'),event);});
document.addEventListener('pointerout',event=>{const surface=event.target.closest('.dial-face,.ruler-wrap');if(surface&&!(event.relatedTarget instanceof Node&&surface.contains(event.relatedTarget)))surface.classList.remove('instrument-hover');});
document.addEventListener('pointermove',event=>{HyzenInstrumentMotion.hover(instrumentDrag?.surface||event.target.closest('.dial-face,.ruler-wrap'),event);if(instrumentDrag){event.preventDefault();moveInstrument(event);}});
function finishInstrumentDrag(){const drag=instrumentDrag;if(!drag)return;instrumentDrag=null;drag.surface.classList.remove('is-dragging');try{drag.surface.releasePointerCapture(drag.pointerId);}catch{}if(drag.input.isConnected)syncInstrument(drag.input);}
function stopInstrument(event){if(instrumentDrag?.pointerId!==event.pointerId)return;if(event.type==='pointerup')moveInstrument(event);finishInstrumentDrag();}
document.addEventListener('pointerup',stopInstrument);document.addEventListener('pointercancel',stopInstrument);
window.addEventListener('blur',()=>{finishInstrumentDrag();for(const surface of $$('.instrument-hover'))surface.classList.remove('instrument-hover');});
let instrumentWheel={input:null,total:0,time:0};
document.addEventListener('wheel',event=>{
 const surface=event.target.closest('.dial-face,.ruler-wrap');if(!surface||state.busy||event.ctrlKey||instrumentDrag)return;
 const input=surface.querySelector('input[type=range]');if(!input||input.disabled)return;
 event.preventDefault();const now=performance.now();
 if(instrumentWheel.input!==input||now-instrumentWheel.time>180)instrumentWheel={input,total:0,time:now};
 instrumentWheel.time=now;instrumentWheel.total+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?surface.clientHeight:1);
 if(Math.abs(instrumentWheel.total)<40)return;
 input.value=I.stepped(Number(input.value)-Math.sign(instrumentWheel.total)*Number(input.step),Number(input.min),Number(input.max),Number(input.step));instrumentWheel.total=0;
 input.dispatchEvent(new Event('input',{bubbles:true}));
},{passive:false});
document.addEventListener('input',e=>{let el=e.target;if(el.type==='range')syncInstrument(el);if(el.id==='lightColor'){$('#colorLabel').textContent=el.value.toUpperCase();$('.light-preview').style.setProperty('--led-color',el.value);}});
document.addEventListener('change',async e=>{const el=e.target,chosen=Number(el.value);
 if(el.id==='layerSelect')await work(async()=>{await live.flush();state.layer=chosen;if(state.layer>=0)await device.module('fn');render();});
 if(el.id==='profileSelect')await work(async()=>{if(state.recording)stopRecording();await live.flush();await device.switchProfile(chosen);state.macroDraft=null;updateNavigationVisibility();await navigate(availablePage(state.page)?state.page:'home');},'프로필을 전환했습니다.');
 if(el.id==='macroSlot')await work(async()=>{if(state.recording)stopRecording();await live.flush();state.macroSlot=chosen;state.macroDraft=null;render();});
});
function inputKey(e,down){if(state.busy)return;if(state.page==='test'&&device.connected){if(e.repeat)return;e.preventDefault();const now=performance.now();state.testLog.unshift({key:e.code,time:new Date().toLocaleTimeString('en-GB',{hour12:false})+'.'+String(new Date().getMilliseconds()).padStart(3,'0'),interval:state.lastEvent?now-state.lastEvent:0,down});state.lastEvent=now;state.testLog=state.testLog.slice(0,300);if(down){state.pressed.add(e.code);state.visited.add(e.code);state.testCount++;}else state.pressed.delete(e.code);$('#testBody').innerHTML=testRows();$('#testCount').textContent=state.testCount;$('#visitedCount').textContent=state.visited.size;paintTest();}
 if(state.page==='macro'&&state.recording){if(e.repeat)return;e.preventDefault();const k=HYZEN_KEYS.find(k=>k.code===e.code);if(!k)return;const now=performance.now(),m=state.macroDraft;if(m.actions.length>=680){stopRecording();render();toast('매크로 저장 공간 한도에 도달했습니다.');return;}m.actions.push({delay:Math.min(65535,Math.round(now-state.recordLast)),down,modifier:/^(Meta|Control|Shift|Alt)/.test(e.code),hid:parseInt(k.hidCode,16)});state.recordLast=now;$('#macroEvents').innerHTML=macroEventHtml(m.actions);$('#macroCount').textContent=m.actions.length+'개 동작';}}
document.addEventListener('keydown',e=>inputKey(e,true));document.addEventListener('keyup',e=>inputKey(e,false));
window.addEventListener('blur',()=>{state.pressed.clear();if(state.page==='test')paintTest();if(state.recording){stopRecording();render();}});
document.addEventListener('pointerdown',e=>{if(state.recording&&!e.target.closest('#recorder')&&!e.target.closest('[data-action="recordMacro"]')){stopRecording();render();}});
$('#confirmDialog').addEventListener('cancel',()=>{state.confirm?.(false);state.confirm=null;});
$('#nav').innerHTML=nav.map(([id,title])=>`<button data-page="${id}" class="${id==='home'?'active':''}">${icon(id)}<span>${title}</span></button>`).join('');$('#refresh').innerHTML=icon('refresh');$('#profileSelect').innerHTML=Array.from({length:7},(_,i)=>option(i,'프로필 '+String(i+1).padStart(2,'0'),0)).join('');$('#connectVisual').innerHTML=previewKeyboard();setConnectionPhase('idle');render();requestAnimationFrame(()=>$('#startConnect').focus({preventScroll:true}));
async function prepareClose(){
 for(let attempt=0;state.busy&&attempt<650;attempt++)await new Promise(resolve=>setTimeout(resolve,100));
 if(state.busy){toast('진행 중인 작업이 끝난 뒤 닫아주세요.');return false;}
 try{if(state.recording)stopRecording();await live.flush();return true;}catch(error){showError(error);return false;}
}
window.hyzenApp={device,state,navigate,render,rpc,prepareClose};
window.runVerification=async()=>{
 state.verifying=true;await live.pause();HyzenBlockGlow.beginVerification();
 const checks=[],phases=[],wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const settled=async()=>{for(let i=0;i<300&&state.busy;i++)await wait(100);if(state.busy)throw Error('Connection did not settle');};
 const screenshot=async name=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);await rpc('capture',{name});};
 const landingOnly=()=>isLanding()&&!$('#connectScreen').hidden&&$('.shell').hidden&&$('.shell').inert;
 const windowMetrics=await rpc('windowMetrics');
 checks.push({name:'webview-fills-window-without-black-inset',ok:windowMetrics.margin===0&&Math.abs(windowMetrics.left)<1&&Math.abs(windowMetrics.top)<1&&Math.abs(windowMetrics.width-windowMetrics.windowWidth)<1&&Math.abs(windowMetrics.height-windowMetrics.windowHeight)<1,metrics:windowMetrics});
 checks.push({name:'caption-title-removed-and-background-continuous',ok:!$('#caption>span')&&getComputedStyle($('aside')).backgroundColor==='rgba(0, 0, 0, 0)'&&getComputedStyle($('aside')).backgroundImage==='none'&&getComputedStyle($('aside')).borderRightWidth==='0px'&&getComputedStyle($('aside')).backdropFilter==='none'});
 const product=$('#productPreview');if(product&&!product.complete)await new Promise(resolve=>{product.addEventListener('load',resolve,{once:true});product.addEventListener('error',resolve,{once:true});});
 checks.push({name:'startup-no-auto-connect',ok:landingOnly()&&!device.connected&&!device.info&&pending.size===0&&$('#content').children.length===0});
 checks.push({name:'official-product-image',ok:product?.complete&&product.naturalWidth===3335&&physical.length===67});
 await screenshot('landing');
 const realRpc=device.rpc;let attempts=0;
 device.rpc=async(action,args)=>{if(action==='connect'){attempts++;throw Error('검증용 연결 실패');}return realRpc(action,args);};
 $('#startConnect').click();$('#startConnect').click();await settled();
 checks.push({name:'failure-stays-on-landing',ok:landingOnly()&&!device.connected&&state.connectionPhase==='error'&&!$('#startConnect').disabled&&!$('#connectScreen').getAttribute('aria-busy').includes('true')});
 checks.push({name:'duplicate-connect-click',ok:attempts===1});
 await screenshot('connection-error');
 const observer=new MutationObserver(()=>{const phase=$('#connectScreen').dataset.phase;if(phases[phases.length-1]!==phase)phases.push(phase);});
 observer.observe($('#connectScreen'),{attributes:true,attributeFilter:['data-phase']});
 device.rpc=async(action,args)=>{if(action==='connect'){attempts++;await screenshot('connecting');}return realRpc(action,args);};
 $('#startConnect').click();await settled();observer.disconnect();device.rpc=realRpc;
 checks.push({name:'retry-connects-device',ok:device.connected&&!isLanding()&&$('#connectScreen').hidden&&!$('.shell').hidden&&!$('.shell').inert,error:state.error||undefined});
 checks.push({name:'connection-phases',ok:phases.includes('opening')&&phases.includes('reading')&&phases.includes('ready'),phases});
 checks.push({name:'transition-finished',ok:document.activeElement===$('#pageTitle'),nativeViewTransition:typeof document.startViewTransition==='function'});
 checks.push({name:'dark-only',ok:getComputedStyle(document.documentElement).colorScheme==='dark'&&getComputedStyle(document.body).backgroundColor==='rgb(11, 12, 15)'&&!$('#appearance')&&!$('#themeTime')});
 const logo=$('#brandLogo');await logo.decode().catch(()=>{});
 checks.push({name:'official-lofree-logo-loaded',ok:logo.complete&&logo.naturalWidth===200&&logo.naturalHeight===56&&logo.alt==='Lofree'&&$('.brand').textContent.trim()===''&&getComputedStyle(logo).filter==='invert(1)'});
 const footer=$('#officialLink'),brand=$('.brand'),brandTextLeft=brand.getBoundingClientRect().left+parseFloat(getComputedStyle(brand).paddingLeft);
 checks.push({name:'sidebar-footer-and-headings-aligned',ok:Math.abs(footer.getBoundingClientRect().left-brandTextLeft)<1.5&&getComputedStyle(footer).backgroundColor==='rgba(0, 0, 0, 0)'&&Math.abs(brand.getBoundingClientRect().top-$('#pageTitle').getBoundingClientRect().top)<1.5&&!$('.sidebar-bottom .version'),positions:{footerLeft:footer.getBoundingClientRect().left,brandTextLeft,brandTop:brand.getBoundingClientRect().top,titleTop:$('#pageTitle').getBoundingClientRect().top}});
 if(!device.connected){await screenshot('actual-connection-error');return{checks,error:state.error,device:device.info};}
 const recognizedName=device.info.name.replace(/@Lofree$/i,'').trim();
 checks.push({name:'single-header-uses-recognized-device-name',ok:$('#pageTitle').textContent===recognizedName&&$('#connection').contains($('#pageTitle'))&&$('#connection').contains($('#refresh'))&&!$('.heading')&&!$('#deviceName')&&$('#pageContext').hidden});
 $('#nav [data-page="light"]').click();
 checks.push({name:'sidebar-click-animates-outgoing-page',ok:HyzenPageMotion.status.phase==='leaving'&&state.page==='home'&&$('#content').inert&&$('#content').getAnimations().some(a=>a.playState==='running')});
 for(let n=0;n<150&&HyzenPageMotion.status.phase!=='entering';n++)await wait(10);
 await wait(35);
 const pillTarget=$('#nav [data-page="light"]').offsetTop,pillY=new DOMMatrixReadOnly(getComputedStyle($('#nav'),':before').transform).m42;
 checks.push({name:'sidebar-pill-glides-to-new-menu',ok:pillY>0&&pillY<pillTarget&&HyzenPageMotion.status.phase==='entering'});
 checks.push({name:'new-page-fades-and-slides-in',ok:state.page==='light'&&$('#pageContext').textContent==='조명'&&$('#pageTitle').textContent===recognizedName&&$('#pageTitle').getAnimations().length===0&&Number(getComputedStyle($('#content')).opacity)>0&&Number(getComputedStyle($('#content')).opacity)<1&&$('#content').getAnimations().some(a=>a.playState==='running')});
 await screenshot('menu-transition');await settled();await wait(100);
 checks.push({name:'page-transition-finishes-cleanly',ok:HyzenPageMotion.status.phase==='idle'&&!$('#content').inert&&getComputedStyle($('#content')).opacity==='1'&&$('#content').getAnimations().length===0&&$('#nav [data-page="light"]').getAttribute('aria-current')==='page'});
 const pageTransitions=[],photoViews=[],dotCoverage=[];
 const banned=/손끝에 맞춰|YOUR EVERYDAY|KEYBOARD CONTROL|Designed around|MAKE EVERY|PRECISION IN|LESS REPETITION|YOUR OWN MOOD|손에 익은 배치|책상에 어울리는|손끝에 맞춘|손에 맞게/;
 for(const page of nav.map(n=>n[0]).filter(availablePage)){
  try{
   await navigate(page);pageTransitions.push({page,animated:HyzenPageMotion.status.animated,phase:HyzenPageMotion.status.phase});await wait(30);const content=$('#content');
   if(['home','keyboard','depth','advanced','test'].includes(page)){
    const image=$('.keyboard-photo'),photo=$('.photo-keyboard'),bounds=photo.getBoundingClientRect();
    photoViews.push({page,ok:image?.complete&&image.naturalWidth===3335&&$$('.photo-key').length===67&&!$('.keyboard-frame')&&!$('.knob')&&$$('.photo-key').every(key=>{const r=key.getBoundingClientRect();return r.left>=bounds.left&&r.top>=bounds.top&&r.right<=bounds.right+1&&r.bottom<=bounds.bottom+1;})});
   }
   if(page==='keyboard'){
    const key=$('.photo-key[data-event="Escape"]'),rect=key.getBoundingClientRect(),hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2),keyIndex=Number(key.dataset.key);
    key.click();const selected=$('.photo-key[data-event="Escape"]');
    checks.push({name:'photo-overlay-selects-real-key',ok:hit===key&&state.selected.has(keyIndex)&&selected.getAttribute('aria-pressed')==='true'&&!!$('.keyboard-photo')&&getComputedStyle(selected).backgroundColor.startsWith('rgba(')});
    $('[data-select="wasd"]').click();
   }
   if(page==='test'){
    document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyA',key:'a',bubbles:true,cancelable:true}));
    const down=$('.photo-key[data-event="KeyA"]').classList.contains('down');document.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyA',key:'a',bubbles:true,cancelable:true}));
    checks.push({name:'photo-key-test-highlights-and-releases',ok:down&&!$('.photo-key[data-event="KeyA"]').classList.contains('down')&&!!$('.keyboard-photo')});
   }
   if(page==='home'){
    checks.push({name:'reference-surfaces',ok:getComputedStyle(document.body).backgroundImage.includes('radial-gradient')&&parseFloat(getComputedStyle($('.stat')).borderRadius)>=27&&!!$('.stat .dot-readout')});
    const savedMode=device.func[56],serialBefore=serial,modes=[];
    try{for(const [value,label]of [[2,'MAG'],[1,'MEC']]){device.func[56]=value;render();const readout=$('.stat:first-child .stat-value .dot-readout');modes.push({label,ok:readout?.getAttribute('aria-label')===label&&readout.querySelectorAll('circle').length>40&&$('.stat:first-child .stat-value').textContent.trim()===''});}}
    finally{device.func[56]=savedMode;render();}
    checks.push({name:'mag-mec-dot-labels-without-device-write',ok:modes.every(mode=>mode.ok)&&serial===serialBefore,modes});
    HyzenBlockGlow.clear();$('#pageTitle').focus({preventScroll:true});await wait(320);
    const block=$('.stat'),halo=block.querySelector('.dot-halo'),r=block.getBoundingClientRect(),off=Number(getComputedStyle(halo).opacity);
    block.dispatchEvent(new PointerEvent('pointerover',{pointerType:'mouse',clientX:r.left+12,clientY:r.top+12,bubbles:true}));getComputedStyle(halo).opacity;await new Promise(requestAnimationFrame);await wait(70);const rising=Number(getComputedStyle(halo).opacity);await wait(360);const on=Number(getComputedStyle(halo).opacity);
    checks.push({name:'stat-dot-glow-fades-in-gradually',ok:off<.001&&rising>off&&rising<on&&Math.abs(on-.72)<.01&&block.hasAttribute('data-glow-hover'),levels:{off,rising,on}});
    await screenshot('home-glow');block.dispatchEvent(new PointerEvent('pointerout',{relatedTarget:document.body,bubbles:true}));getComputedStyle(halo).opacity;await new Promise(requestAnimationFrame);await wait(70);const falling=Number(getComputedStyle(halo).opacity);await wait(360);const ended=Number(getComputedStyle(halo).opacity);
    checks.push({name:'stat-dot-glow-fades-out-gradually',ok:falling>ended&&falling<on&&ended<.001&&!block.hasAttribute('data-glow-hover'),levels:{on,falling,ended}});
   }
   if(page==='depth'){
    const input=$('#actMm'),face=$('.dial-face'),rect=face.getBoundingClientRect(),before=input.value;
    input.value='1.5';input.dispatchEvent(new Event('input',{bubbles:true}));const cursor=$('.dial-cursor').getAttribute('transform'),scale=$('.dial-scale').getAttribute('transform'),serialBefore=serial;
    const point={clientX:rect.left+rect.width/2,clientY:rect.top+rect.height*.08,pointerId:701,button:0,bubbles:true};
    face.dispatchEvent(new PointerEvent('pointerdown',point));const stationary=Number(input.value)===1.5;
    const radians=-40*Math.PI/180,moved={...point,clientX:rect.left+rect.width/2+Math.sin(radians)*rect.width*.42,clientY:rect.top+rect.height/2-Math.cos(radians)*rect.height*.42};
    const scaleNode=$('.dial-scale'),startMotion=HyzenInstrumentMotion.inspect(input);
    face.dispatchEvent(new PointerEvent('pointermove',moved));await wait(32);
    const duringMotion=HyzenInstrumentMotion.inspect(input);
    checks.push({name:'dial-smooth-follow-with-stable-svg',ok:duringMotion.active&&duringMotion.position>startMotion.position&&duringMotion.position<duringMotion.target&&$('.dial-scale')===scaleNode});
    face.dispatchEvent(new PointerEvent('pointerup',moved));await wait(450);
    const expected=I.stepped(1.5+40/280*(Number(input.max)-Number(input.min)),Number(input.min),Number(input.max),Number(input.step));
    const settledMotion=HyzenInstrumentMotion.inspect(input);
    checks.push({name:'dial-fixed-pointer-moving-scale',ok:stationary&&Math.abs(Number(input.value)-expected)<.011&&$('.dial-cursor').getAttribute('transform')===cursor&&$('.dial-scale').getAttribute('transform')!==scale&&Number($('.dial-svg').dataset.value)===Number(input.value)&&serial===serialBefore});
    checks.push({name:'dial-magnetic-release-settles-exactly',ok:!settledMotion.active&&Math.abs(settledMotion.position-I.fraction(Number(input.value),Number(input.min),Number(input.max)))<.000002&&face.dataset.motion==='idle'});
    input.value=before;input.dispatchEvent(new Event('input',{bubbles:true}));$('#pageTitle').focus();
    const ruler=$('#rtPress'),previous=ruler.value;ruler.value='0.37';ruler.dispatchEvent(new Event('input',{bubbles:true}));
    checks.push({name:'ruler-and-dot-readout-follow-value',ok:Math.abs(Number(ruler.value)-.37)<.001&&Number(ruler.closest('[data-instrument]').querySelector('.ruler-svg').dataset.value)===Number(ruler.value)&&$('#rtPressValue .dot-readout').getAttribute('aria-label')==='0.37'});
    ruler.value=previous;ruler.dispatchEvent(new Event('input',{bubbles:true}));
    checks.push({name:'deadzone-collapsed-fields-preserved',ok:!$('.actuation-card details').open&&!!$('#deadTop')&&!!$('#deadBottom')});
   }
   if(page==='light'){
    const picker=$('.effect-picker'),extra=$('.lighting-card>.option-fold:not(.effect-picker)');
    checks.push({name:'light-secondary-controls-collapsed',ok:!picker.open&&!extra.open&&$$('.effect').every(e=>e.getClientRects().length===0)&&!!$('#customColor')});

    const markerSurface=$('#lightBrightness').closest('.ruler-wrap'),markerGeometry=[];
    for(const width of [260,360,500]){
     markerSurface.style.width=width+'px';
     const handle=markerSurface.querySelector('.ruler-marker .instrument-handle').getBoundingClientRect(),dot=markerSurface.querySelector('.ruler-marker .instrument-dot').getBoundingClientRect(),line=markerSurface.querySelector('.ruler-cursor line').getBoundingClientRect();
     markerGeometry.push({width,handleWidth:handle.width,handleHeight:handle.height,dotWidth:dot.width,dotHeight:dot.height,centerError:Math.abs((handle.left+handle.right-line.left-line.right)/2),dotCenterError:Math.hypot((handle.left+handle.right-dot.left-dot.right)/2,(handle.top+handle.bottom-dot.top-dot.bottom)/2)});
    }
    markerSurface.style.removeProperty('width');
    checks.push({name:'ruler-handle-and-dot-stay-round-at-all-widths',ok:markerGeometry.every(r=>r.handleWidth>0&&Math.abs(r.handleWidth-r.handleHeight)<.05&&Math.abs(r.dotWidth-r.dotHeight)<.05&&r.centerError<.1&&r.dotCenterError<.1)&&Math.abs(markerGeometry[0].handleWidth-markerGeometry[2].handleWidth)<.05,geometry:markerGeometry});
    const input=$('#lightBrightness'),wrap=input.closest('.ruler-wrap'),rect=wrap.getBoundingClientRect(),before=input.value;
    input.value='50';input.dispatchEvent(new Event('input',{bubbles:true}));const cursor=$('.lighting-card .ruler-cursor').getAttribute('transform'),scale=$('.lighting-card .ruler-scale').getAttribute('transform'),serialBefore=serial;
    const point={clientX:rect.left+rect.width*.8,clientY:rect.top+20,pointerId:702,button:0,bubbles:true};wrap.dispatchEvent(new PointerEvent('pointerdown',point));const stationary=Number(input.value)===50;
    const moved={...point,clientX:point.clientX-rect.width*.2};wrap.dispatchEvent(new PointerEvent('pointermove',moved));wrap.dispatchEvent(new PointerEvent('pointerup',moved));await wait(450);
    checks.push({name:'ruler-fixed-pointer-moving-scale',ok:stationary&&Number(input.value)===71&&$('.lighting-card .ruler-cursor').getAttribute('transform')===cursor&&$('.lighting-card .ruler-scale').getAttribute('transform')!==scale&&$('#lightBrightnessValue .dot-readout').getAttribute('aria-label')==='71'&&serial===serialBefore});
    wrap.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,bubbles:true,cancelable:true}));const wheelMotion=HyzenInstrumentMotion.inspect(input);await wait(450);
    const wheelSettled=HyzenInstrumentMotion.inspect(input);
    checks.push({name:'wheel-single-tick-springs-to-detent',ok:Number(input.value)===72&&wheelMotion.active&&wheelMotion.position<wheelMotion.target&&!wheelSettled.active&&Math.abs(wheelSettled.position-.72)<.000002&&$('.lighting-card .ruler-cursor').getAttribute('transform')===cursor&&serial===serialBefore});
    input.value=before;input.dispatchEvent(new Event('input',{bubbles:true}));HyzenInstrumentMotion.settleAll();$('#pageTitle').focus({preventScroll:true});
    picker.open=true;await wait(30);
    const effects=$$('.effect'),boxes=effects.map(e=>e.getBoundingClientRect()),centered=effects.every(e=>{const b=e.getBoundingClientRect(),i=e.querySelector('i').getBoundingClientRect(),t=e.querySelector('span').getBoundingClientRect();return Math.abs((b.left+b.right-i.left-i.right)/2)<1&&Math.abs((b.left+b.right-t.left-t.right)/2)<1;});
    checks.push({name:'effect-grid-aligned',ok:centered&&boxes.every(b=>Math.abs(b.height-boxes[0].height)<1)&&parseFloat(getComputedStyle(effects[0]).fontSize)>=13});
    await screenshot('light-effects');picker.open=false;await wait(180);
   }
   if(page==='settings')checks.push({name:'settings-secondary-sections-collapsed',ok:$$('#content>.option-card').length===4&&$$('#content>.option-card').every(e=>!e.open)&&!!$('#sleepFirst')&&!!$(currentCapabilities().wired?'#wiredRate':'#wirelessRate')&&!$(currentCapabilities().wired?'#wirelessRate':'#wiredRate')});
   dotCoverage.push(...$$('#content .dot-readout').map(readout=>!!readout.closest('[data-glow-block]')));

   const controlsFit=!$$('input,select').some(e=>e.offsetParent&&e.getBoundingClientRect().right>$('main').getBoundingClientRect().right+2);
   checks.push({name:page,ok:content.textContent.length>20&&controlsFit&&!banned.test(document.body.innerText),overflow:content.scrollWidth>content.clientWidth+2});
   await screenshot(page);
   if(page==='depth'){
    const main=$('main'),panel=$('.depth-console');
    main.scrollTop+=panel.getBoundingClientRect().top-main.getBoundingClientRect().top-22;
    await screenshot('depth-controls');main.scrollTop=0;
    main.scrollTop+=panel.getBoundingClientRect().top-main.getBoundingClientRect().top-22;
    const blocks=[$('.actuation-card'),$('#rtPress').closest('.ruler-control')],surfaces=blocks.map(block=>block.querySelector('.dial-face,.ruler-wrap')),hoverResults=[];
    HyzenBlockGlow.clear();$('#pageTitle').focus({preventScroll:true});await wait(320);
    for(let index=0;index<blocks.length;index++){
     const block=blocks[index],r=block.getBoundingClientRect(),halo=block.querySelector('.dot-halo'),light=block.querySelector('.tick-lights'),core=block.querySelector('.dial-ticks,.ruler-ticks'),lines=[...core.children];
     block.dispatchEvent(new PointerEvent('pointerover',{pointerType:'mouse',clientX:r.left+10,clientY:r.top+10,bubbles:true}));getComputedStyle(halo).opacity;await new Promise(requestAnimationFrame);await wait(70);
     const rising={dots:Number(getComputedStyle(halo).opacity),ticks:Number(getComputedStyle(light).opacity)};await wait(360);
     const on={dots:Number(getComputedStyle(halo).opacity),ticks:Number(getComputedStyle(light).opacity)};
     const geometry=light.children.length===lines.length&&lines.every((line,n)=>['x1','x2','y1','y2'].every(attr=>line.getAttribute(attr)===light.children[n].getAttribute(attr)));
     const thin=getComputedStyle(light.children[0]).strokeWidth==='2px'&&getComputedStyle(light).animationName==='none';
     await screenshot(index===0?'depth-dial-glow':'depth-glow');
     block.dispatchEvent(new PointerEvent('pointerout',{relatedTarget:document.body,bubbles:true}));getComputedStyle(halo).opacity;await new Promise(requestAnimationFrame);await wait(70);const falling={dots:Number(getComputedStyle(halo).opacity),ticks:Number(getComputedStyle(light).opacity)};await wait(360);
     hoverResults.push({geometry,thin,rising,on,falling,ended:{dots:Number(getComputedStyle(halo).opacity),ticks:Number(getComputedStyle(light).opacity)},fadeIn:rising.dots>0&&rising.dots<on.dots&&rising.ticks>0&&rising.ticks<on.ticks&&Math.abs(on.dots-.72)<.01&&Math.abs(on.ticks-.46)<.01,fadeOut:falling.dots>0&&falling.dots<on.dots&&falling.ticks>0&&falling.ticks<on.ticks&&Number(getComputedStyle(halo).opacity)<.001&&Number(getComputedStyle(light).opacity)<.001});
    }
    checks.push({name:'individual-tick-lines-glow',ok:hoverResults.every(result=>result.geometry&&result.thin)});
    checks.push({name:'block-hover-fades-dots-and-ticks-in',ok:hoverResults.every(result=>result.fadeIn),results:hoverResults});
    checks.push({name:'block-hover-fades-dots-and-ticks-out',ok:hoverResults.every(result=>result.fadeOut)});
    checks.push({name:'no-cursor-following-glow-background',ok:surfaces.every(surface=>getComputedStyle(surface,':before').content==='none'&&surface.style.getPropertyValue('--glow-x')===''&&surface.style.getPropertyValue('--glow-y')==='')});
    checks.push({name:'hover-glow-clears-on-leave',ok:blocks.every(block=>!block.hasAttribute('data-glow-hover'))});main.scrollTop=0;
   }
  }catch(error){checks.push({name:page,ok:false,error:error.message});}
 }
 checks.push({name:'all-menu-pages-use-transition',ok:pageTransitions.length===nav.filter(([page])=>availablePage(page)).length&&pageTransitions.every(item=>item.animated&&item.phase==='idle')});
 checks.push({name:'official-photo-on-all-keyboard-views',ok:photoViews.length===5&&photoViews.every(item=>item.ok),views:photoViews});
 checks.push({name:'all-dot-readouts-have-hover-blocks',ok:dotCoverage.length>=8&&dotCoverage.every(Boolean),readouts:dotCoverage.length});

 // Rendering and inspecting values must never enqueue a write.
 checks.push({name:'no-save-buttons-or-startup-auto-writes',ok:!$('[data-action^="save"]')&&!live.busy&&live.last===null});
 const originalInfo=device.info,originalMode=device.func[56],actualCap=currentCapabilities();
 try{
  await navigate('settings');
  checks.push({name:'wireless-hides-usb-only-settings',ok:actualCap.wired||(!$('#wiredRate')&&!$('#content [data-action="official"]').closest('.setting-row')?.textContent.includes('펌웨어')&&$('#nav [data-page="calibration"]').hidden),transport:originalInfo.connection});
  device.info={...originalInfo,productId:36,connection:'USB'};device.func[56]=2;updateNavigationVisibility();render();
  checks.push({name:'usb-fixture-shows-wired-rate-firmware-calibration',ok:!!$('#wiredRate')&&!$('#wirelessRate')&&$('#content').textContent.includes('공식 업데이트')&&!$('#nav [data-page="calibration"]').hidden});
  device.func[56]=1;updateNavigationVisibility();checks.push({name:'mec-hides-magnetic-calibration',ok:$('#nav [data-page="calibration"]').hidden});
 }finally{device.info=originalInfo;device.func[56]=originalMode;updateNavigationVisibility();render();}
 // Exercise real controls against a recording executor, without writing to HID.
 HyzenAutoApply.beginProbe();
 try{
  await navigate('light');
  const input=$('#lightBrightness');for(const value of [31,42,53]){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}
  $('#lightColor').value='#c5dfec';$('#lightColor').dispatchEvent(new Event('input',{bubbles:true}));
  await live.flush();const lighting=live.last;
  checks.push({name:'live-control-burst-coalesces-final-value-and-fields',ok:lighting.kind==='light'&&lighting.values.brightness===53&&lighting.fields.includes('brightness')&&lighting.fields.includes('color')&&!$('[data-action="saveLight"]')});
  await navigate('keyboard');const index=firstSelected(),layer=state.layer,profile=device.profile;
  const binding=$('[data-binding="20 00 05"]');binding.click();const readyToClose=await prepareClose();
  checks.push({name:'mapping-choice-auto-applies-captured-key-layer-profile',ok:readyToClose&&live.last.kind==='map'&&live.last.indices[0]===index&&live.last.layer===layer&&live.last.profile===profile&&P.hex(live.last.code)==='20 00 05'});
  await navigate('depth');$('#deadEnabled').checked=false;$('#deadTop').value='0';$('#deadBottom').value='0';$('#actMm').value='1.32';$('#actMm').dispatchEvent(new Event('input',{bubbles:true}));await live.flush();
  checks.push({name:'actuation-control-auto-applies-without-save',ok:live.last.kind==='actuation'&&live.last.values.mm===1.32&&live.last.indices.length===1});
  await navigate('advanced');state.advanced='MT';render();$('#advancedDelay').value='420';$('#advancedDelay').dispatchEvent(new Event('input',{bubbles:true}));await live.flush();
  checks.push({name:'advanced-control-auto-applies-without-save',ok:live.last.kind==='advanced'&&live.last.type==='MT'&&live.last.values.delay===420});
  await navigate('settings');$('#sleepFirst').value='2';$('#sleepFirst').dispatchEvent(new Event('input',{bubbles:true}));await live.flush();
  checks.push({name:'sleep-control-auto-applies-without-save',ok:live.last.kind==='sleep'&&live.last.values.first===2});
  $('#sleepFirst').value='';$('#sleepFirst').dispatchEvent(new Event('input',{bubbles:true}));await wait(200);
  checks.push({name:'invalid-number-is-not-written-and-shows-validation',ok:!live.busy&&$('#syncStatus').dataset.phase==='invalid'&&$('#retryApply').hidden});render();
  $('#winLock').checked=!$('#winLock').checked;$('#winLock').dispatchEvent(new Event('input',{bubbles:true}));await live.flush();
  checks.push({name:'mode-control-patches-only-changed-field',ok:live.last.kind==='mode'&&live.last.fields.length===1&&live.last.fields[0]==='winLock'});
  const rate=$(actualCap.wired?'#wiredRate':'#wirelessRate');rate.value=rate.value==='0'?'4':'0';rate.dispatchEvent(new Event('change',{bubbles:true}));await live.flush();
  checks.push({name:'polling-control-auto-applies-current-transport-only',ok:live.last.kind==='rate'&&live.last.index===(actualCap.wired?53:54)});
  await navigate('macro');state.macroDraft={mode:0,loops:1,fixed:false,actions:[]};state.recording=true;stopRecording();await live.flush();
  checks.push({name:'macro-stop-auto-applies-captured-slot',ok:live.last.kind==='macro'&&live.last.slot===state.macroSlot&&live.last.values.actions.length===0});
 }finally{const jobs=await HyzenAutoApply.endProbe();checks.push({name:'auto-control-probes-remain-isolated-from-hardware',ok:jobs.length===8,jobs:jobs.map(job=>job.kind)});}
 if(windowMetrics.verifyLive){
  try{
   await navigate('light');state.lightGroup='front';state.lightDraft=null;render();
   const before=await device.read(5,64,device.profile*64);
   const applied=await HyzenAutoApply.verifyIdentical(),after=await device.read(5,64,device.profile*64),evidence=await rpc('windowMetrics');
   checks.push({name:'actual-identical-brightness-write-and-readback',ok:before.every((value,index)=>value===after[index])&&evidence.verifyWrites===1&&applied.kind==='light'&&applied.group==='front',writes:evidence.verifyWrites,settingsUnchanged:before.every((value,index)=>value===after[index])});
  }catch(error){checks.push({name:'actual-identical-brightness-write-and-readback',ok:false,error:error.message});}
 }
 await navigate('settings');await screenshot('automatic-settings');
 await work(disconnectToLanding);await wait(150);
 checks.push({name:'disconnect-restores-connect-screen',ok:landingOnly()&&!device.connected&&state.connectionPhase==='idle'&&!$('#startConnect').disabled});
 const staleConnected=device.connected;await navigate('settings');
 checks.push({name:'settings-gated-after-disconnect',ok:landingOnly()&&!staleConnected&&$('#content').children.length===0});
 $('#startConnect').click();await settled();
 checks.push({name:'connect-after-disconnect',ok:device.connected&&!isLanding()});
 return{checks,device:device.info,versions:device.versions,keys:physical.length,window:windowMetrics};
};
