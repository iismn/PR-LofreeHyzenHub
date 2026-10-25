(function(root){
'use strict';
const catalogue=typeof module!=='undefined'?require('./translations.js'):root.HyzenTranslations;
const quote=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const patterns=catalogue.patterns.map(([source,target])=>{
 const names=[];const expression=source.split(/(\{[a-z]+\})/i).map(part=>{if(/^\{[a-z]+\}$/i.test(part)){names.push(part.slice(1,-1));return '(.+?)';}return quote(part);}).join('');
 return{source,target,names,regex:new RegExp('^'+expression+'$')};
});
function create(language='ko'){
 if(!['ko','en'].includes(language))language='ko';
 const textCache=new WeakMap(),attributeCache=new WeakMap();
 function text(value,depth=0){
  const source=String(value??'');if(language==='ko'||depth>4)return source;
  if(Object.prototype.hasOwnProperty.call(catalogue.messages,source))return catalogue.messages[source];
  for(const pattern of patterns){const match=source.match(pattern.regex);if(!match)continue;const values=Object.fromEntries(pattern.names.map((name,index)=>[name,text(match[index+1],depth+1)]));return pattern.target.replace(/\{([a-z]+)\}/gi,(_,name)=>values[name]);}
  return source;
 }
 function localize(node){
  if(!node)return;
  const doc=node.ownerDocument||node,walker=doc.createTreeWalker(node,4);
  for(let current=walker.nextNode();current;current=walker.nextNode()){
   if(current.parentElement?.closest('script,style'))continue;
   const value=current.nodeValue,old=textCache.get(current),source=old&&old.last===value?old.source:value;
   const match=source.match(/^(\s*)([\s\S]*?)(\s*)$/),translated=match[1]+text(match[2])+match[3];
   current.nodeValue=translated;textCache.set(current,{source,last:translated});
  }
  const elements=node.nodeType===1?[node,...node.querySelectorAll('*')]:[...node.querySelectorAll('*')];
  for(const element of elements)for(const name of ['aria-label','title','alt','placeholder']){
   if(!element.hasAttribute(name))continue;
   let records=attributeCache.get(element);if(!records){records=new Map();attributeCache.set(element,records);}
   const value=element.getAttribute(name),old=records.get(name),source=old&&old.last===value?old.source:value,translated=text(source);
   element.setAttribute(name,translated);records.set(name,{source,last:translated});
  }
 }
 function html(value){const template=root.document.createElement('template');template.innerHTML=value;localize(template.content);return template.innerHTML;}
 return{text,localize,html,get language(){return language;},get locale(){return language==='en'?'en-US':'ko-KR';},setLanguage(value){if(!['ko','en'].includes(value))throw Error('지원하지 않는 언어입니다.');language=value;}};
}
if(typeof module!=='undefined')module.exports={create,catalogue};
else{root.HyzenLocale=create(root.HUB_PREFERENCES?.language);root.HyzenLocale.localize(root.document.body);root.document.documentElement.lang=root.HyzenLocale.language;}
})(typeof window!=='undefined'?window:globalThis);
