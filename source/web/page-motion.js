(function(){
'use strict';
const preference=matchMedia('(prefers-reduced-motion: reduce)'),status={phase:'idle',from:null,to:null,animated:false,completed:0};
let animations=[];
const $=selector=>document.querySelector(selector);
function setActive(page,animate=true){
 const nav=$('#nav');if(!nav)return;
 for(const button of nav.querySelectorAll('button')){const on=button.dataset.page===page;button.classList.toggle('active',on);button.setAttribute('aria-current',on?'page':'false');}
 const button=nav.querySelector('[data-page="'+page+'"]');if(!button||!button.offsetHeight)return;
 nav.style.setProperty('--nav-duration',animate&&!preference.matches?'300ms':'0ms');
 nav.style.setProperty('--nav-y',button.offsetTop+'px');nav.style.setProperty('--nav-height',button.offsetHeight+'px');nav.dataset.pill='true';
}
function cancel(){for(const animation of animations)animation.cancel();animations=[];}
function play(elements,keyframes,options){
 const batch=elements.map(element=>element.animate(keyframes,options));animations.push(...batch);
 return Promise.allSettled(batch.map(animation=>animation.finished));
}
async function transition(update,from,to,{animate=true}={}){
 const content=$('#content'),context=$('#pageContext'),elements=[content,context];
 const enabled=animate&&from!==to&&!preference.matches&&typeof content.animate==='function';
 Object.assign(status,{from,to,animated:enabled,phase:enabled?'leaving':'updating'});
 const inert=content.inert;content.inert=true;content.setAttribute('aria-busy','true');
 try{
  if(enabled)await play(elements,[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-6px)'}],{duration:120,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
  status.phase='updating';await update();
  if(enabled){
   cancel();status.phase='entering';
   await play(elements,[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'});
  }
  status.completed++;
 }finally{cancel();content.inert=inert;content.removeAttribute('aria-busy');status.phase='idle';}
}
const observer=new ResizeObserver(()=>{const active=$('#nav button.active');if(active)setActive(active.dataset.page,false);});
window.addEventListener('DOMContentLoaded',()=>{observer.observe($('#nav'));setActive($('#nav button.active')?.dataset.page||'home',false);});
preference.addEventListener('change',()=>{if(preference.matches)for(const animation of animations)try{animation.finish();}catch{};});
window.HyzenPageMotion={transition,setActive,status};
})();
