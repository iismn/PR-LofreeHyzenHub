(function(){
'use strict';
let hovered=null,lastPointer=null,verifying=false;
function setHovered(block){
 if(hovered===block)return;
 if(hovered)hovered.removeAttribute('data-glow-hover');
 hovered=block;if(hovered)hovered.setAttribute('data-glow-hover','');
}
function blockAt(target){return target instanceof Element?target.closest('[data-glow-block]'):null;}
function refresh(root){
 for(const block of root.querySelectorAll('.card,.range-control,.color-control'))if(block.querySelector('.dot-readout,.tick-lights'))block.setAttribute('data-glow-block','');
 if(lastPointer)setHovered(blockAt(document.elementFromPoint(lastPointer.x,lastPointer.y)));
 else if(hovered&&!hovered.isConnected)setHovered(null);
}
document.addEventListener('pointerover',event=>{
 if(event.pointerType==='touch'||verifying&&event.isTrusted)return;
 lastPointer={x:event.clientX,y:event.clientY};setHovered(blockAt(event.target));
});
document.addEventListener('pointermove',event=>{
 if(event.pointerType==='touch'||verifying&&event.isTrusted)return;
 lastPointer={x:event.clientX,y:event.clientY};setHovered(blockAt(event.target));
});
document.addEventListener('pointerout',event=>{
 if(event.pointerType==='touch'||verifying&&event.isTrusted)return;
 setHovered(blockAt(event.relatedTarget));if(!event.relatedTarget)lastPointer=null;
});
window.addEventListener('blur',()=>{lastPointer=null;setHovered(null);});
// Native verification owns a synthetic pointer; the user's mouse stays independent.
window.HyzenBlockGlow={refresh,clear:()=>{lastPointer=null;setHovered(null);},beginVerification:()=>{verifying=true;lastPointer=null;setHovered(null);}};
})();
