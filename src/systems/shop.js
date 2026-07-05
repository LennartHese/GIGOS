import { LW, LH, X } from '../core/constants.js';
import { px } from '../core/canvas.js';
import { G } from '../core/state.js';
import { toast } from '../ui/toast.js';
import { parchmentBG, DEXC } from './dex.js';
import { drawKeta } from './battle.js';
import { drawMate, drawZigaretten, drawWein, drawSekt, drawSterni, addItem } from './inventory.js';
import { akhTaler, addAkhTaler, stock, ketaKapseln, setKetaKapseln } from '../main.js';

/* ======================================================================
   SPÄTI-KIOSK — kauft Keta Kapseln / Club-Mate / Zigaretten / Wein / Sekt /
   Sterni gegen Akh-Taler. Aufgerufen aus world/spaeti.js (talkKiosk).
   ====================================================================== */
export const SHOP_ITEMS=[
  {id:'keta', name:'Keta Kapsel', price:8, draw:drawKeta, desc:'Zum Fangen wilder Akhs.'},
  {id:'mate', name:'Club-Mate', price:6, draw:drawMate, desc:'5 Min. etwas mehr Tempo.'},
  {id:'zigaretten', name:'Zigaretten', price:10, draw:drawZigaretten, desc:'Team heilt beim Rauchen +10% HP.'},
  {id:'wein', name:'Wein', price:12, draw:drawWein, desc:'Macht beschwingt. Ändert, wer dich mag.'},
  {id:'sekt', name:'Sekt', price:18, draw:drawSekt, desc:'Macht beschwingt. Ändert, wer dich mag.'},
  {id:'sterni', name:'Sterni', price:5, draw:drawSterni, desc:'Macht beschwingt. Ändert, wer dich mag.'},
];
let shopIdx=0;
export function openShop(){ G.state='shop'; shopIdx=0; }
export function closeShop(){ G.state='play'; }
export function shopKey(k){
  if(['q','backspace','escape'].includes(k)){ closeShop(); return; }
  if(['arrowup','w'].includes(k)){ shopIdx=(shopIdx+SHOP_ITEMS.length-1)%SHOP_ITEMS.length; return; }
  if(['arrowdown','s'].includes(k)){ shopIdx=(shopIdx+1)%SHOP_ITEMS.length; return; }
  if(k==='e'||k===' '||k==='enter'){ buyItem(shopIdx); return; }
}
export function buyItem(idx){
  const it=SHOP_ITEMS[idx]; if(!it) return;
  if(akhTaler<it.price){ toast('Nicht genug Akh-Taler dafür.',1800); return; }
  addAkhTaler(-it.price);
  if(it.id==='keta'){ setKetaKapseln(ketaKapseln+1); addItem('keta'); }
  else { stock[it.id]=(stock[it.id]||0)+1; addItem(it.id); }
  toast(it.name+' gekauft (−'+it.price+' Akh-Taler)',1800);
}
function countFor(id){ return id==='keta' ? ketaKapseln : (stock[id]||0); }
export function renderShop(){
  parchmentBG();
  X.textAlign='center'; X.textBaseline='top'; X.fillStyle=DEXC.ink; X.font='bold 12px Georgia';
  X.fillText('Späti-Kiosk', LW/2, 8);
  X.fillStyle=DEXC.ink2; X.font='7px Georgia'; X.fillText('Du hast '+akhTaler+' Akh-Taler', LW/2, 21);
  X.fillStyle=DEXC.edgeD; X.font='bold 11px Georgia'; X.textAlign='right'; X.fillText('×',LW-8,4); X.textAlign='left';

  const x0=16, w=LW-32, y0=34, rh=24;
  for(let i=0;i<SHOP_ITEMS.length;i++){
    const it=SHOP_ITEMS[i], y=y0+i*rh, sel=(i===shopIdx);
    px(X,x0,y,w,rh-3, sel?'#e7d7ae':'rgba(200,170,110,0.14)');
    if(sel){ X.strokeStyle='#d8b24a'; X.lineWidth=1; X.strokeRect(x0+0.5,y+0.5,w-1,rh-4); }
    X.save(); X.translate(x0+14,y+2); X.scale(0.42,0.42); it.draw(X); X.restore();
    X.fillStyle=DEXC.ink; X.font='bold 9px Georgia'; X.textAlign='left'; X.textBaseline='top';
    X.fillText(it.name, x0+30, y+2);
    X.fillStyle='#6d5738'; X.font='7px Georgia'; X.fillText(it.desc, x0+30, y+12);
    X.fillStyle=DEXC.ink; X.font='bold 8px Georgia'; X.textAlign='right';
    X.fillText(it.price+' AT', x0+w-8, y+2);
    X.fillStyle='#6d5738'; X.font='7px Georgia'; X.fillText('besitzt: '+countFor(it.id), x0+w-8, y+12);
    X.textAlign='left';
  }
  X.textAlign='center'; X.fillStyle=DEXC.ink2; X.font='7px Georgia';
  X.fillText('Pfeile: wählen  ·  E: kaufen  ·  Q: raus', LW/2, LH-11);
  X.textAlign='left';
}
