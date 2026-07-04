import { toast } from '../ui/toast.js';
import { drawKeta, PUNISHER_IMG, drawBluePunisher, ketaKapseln } from '../main.js';

export let invOpen=false;
export const inventory=[];

// --- Item-Sprites (prozedural, Stil wie der Rest) ---
function drawMate(c){            // Club-Mate-Flasche (nach Don's Pixel-Vorlage)
  c.fillStyle='rgba(20,18,10,.20)'; c.fillRect(4,46,14,3);
  // Kronkorken (Navy)
  c.fillStyle='#15366e'; c.fillRect(7,0,8,6); c.fillStyle='#2a5aa0'; c.fillRect(7,0,8,2); c.fillStyle='#0e244a'; c.fillRect(7,5,8,1);
  // Hals (helles Bernsteinglas)
  c.fillStyle='#e3c389'; c.fillRect(8,6,6,11); c.fillStyle='#f2dcae'; c.fillRect(8,6,2,11); c.fillStyle='#c9a266'; c.fillRect(13,6,1,11);
  // Schulter
  c.fillStyle='#d8932a'; c.fillRect(5,16,12,4);
  // Korpus (Bernstein)
  c.fillStyle='#cf8a24'; c.fillRect(4,19,14,27);
  c.fillStyle='#eeb142'; c.fillRect(5,19,3,27);     // Glanzkante links
  c.fillStyle='#a86a18'; c.fillRect(15,19,2,27);    // Schattenkante rechts
  c.fillStyle='#b9781e'; c.fillRect(4,44,14,2);     // Boden dunkler
  // Etikett (creme)
  c.fillStyle='#efe3c4'; c.fillRect(5,24,12,17);
  // rote Zickzack-Ränder (angedeutet)
  c.fillStyle='#c0392b';
  for(let i=5;i<17;i+=2){ c.fillRect(i,24,1,1); c.fillRect(i+1,25,1,1); }
  for(let i=5;i<17;i+=2){ c.fillRect(i,40,1,1); c.fillRect(i+1,39,1,1); }
  // blauer Kreis + Gaucho-Silhouette
  c.fillStyle='#1d3f7a'; c.fillRect(8,26,6,6);
  c.fillStyle='#dfe2ea'; c.fillRect(9,27,4,1);      // Hutkrempe-Hint
  c.fillStyle='#16305f'; c.fillRect(9,28,4,3);      // Figur
  // CLUB-MATE-Schrift (angedeutet)
  c.fillStyle='#1d3f7a'; c.fillRect(6,34,10,2);
  c.fillStyle='#c0392b'; c.fillRect(6,37,10,1);
}
function drawZettel(c){          // „Consumption Smoothing" — Sprite nach Don's Vorlage
  const r=(x,y,w,h,col)=>{ c.fillStyle=col; c.fillRect(x,y,w,h); };
  // gezackter dunkler Rand + Pergament
  r(1,9,22,32,'#4a3018');
  r(2,10,20,30,'#e7d4a4'); r(2,10,20,3,'#f1e3bf');
  r(2,38,20,2,'#d2ba83'); r(20,11,2,29,'#d2ba83');
  for(const p of [[5,16],[14,20],[8,30],[17,15],[6,24],[15,33]]) r(p[0],p[1],1,1,'#d8c290');
  r(2,10,2,2,'#4a3018'); r(20,10,2,2,'#4a3018'); r(2,38,2,2,'#4a3018'); r(20,38,2,2,'#4a3018');
  r(11,9,2,1,'#4a3018'); r(11,40,2,1,'#4a3018');
  // Titel Zeile 1 „Consumption"
  for(const g of [[4,2],[7,3],[11,2],[14,2],[17,3]]) r(g[0],13,g[1],3,'#3a2414');
  r(4,13,1,1,'#e7d4a4'); r(9,14,1,1,'#e7d4a4'); r(15,14,1,1,'#e7d4a4');
  // Titel Zeile 2 „Smoothing"
  for(const g of [[5,3],[9,2],[12,3],[16,2]]) r(g[0],17,g[1],3,'#3a2414');
  r(6,18,1,1,'#e7d4a4'); r(13,18,1,1,'#e7d4a4');
  // Trennlinie
  r(4,21,16,1,'#7a5a3a');
  // Formel-Gekrakel
  r(4,24,6,1,'#5a4632'); r(11,24,3,1,'#5a4632'); r(16,24,3,1,'#5a4632');
  r(4,26,2,1,'#5a4632'); r(7,26,1,1,'#5a4632'); r(9,26,5,1,'#5a4632');
  // Mini-Steigungsgraph (unten links)
  r(4,29,1,8,'#3a2414'); r(4,36,9,1,'#3a2414');
  for(const p of [[5,35],[6,34],[7,34],[8,33],[9,32],[10,31],[11,31]]) r(p[0],p[1],1,1,'#7a3a1a');
  // rotes Wachssiegel (unten rechts)
  r(15,30,5,1,'#7c0e0e'); r(14,31,7,5,'#7c0e0e'); r(15,36,5,1,'#7c0e0e');
  r(15,31,5,4,'#c01818'); r(16,32,3,2,'#e23a3a'); r(16,32,2,1,'#f06060');
  r(15,33,3,1,'#8c1010'); r(20,37,1,1,'#a11414');
}
function drawBluePunisherItem(c){ if(typeof PUNISHER_IMG!=='undefined' && PUNISHER_IMG && PUNISHER_IMG.width){ c.imageSmoothingEnabled=false; const w=PUNISHER_IMG.width,h=PUNISHER_IMG.height,s=Math.min(22/w,44/h); c.drawImage(PUNISHER_IMG,(24-w*s)/2,(50-h*s)/2,w*s,h*s); } else if(typeof drawBluePunisher==='function'){ drawBluePunisher(c,12,26,4); } }
const ITEMS={
  keta:{name:'Keta Kapsel', draw:drawKeta},
  bluePunisher:{name:'Blue Punisher', draw:drawBluePunisherItem},
  zettel:{name:'Zettel: „Consumption Smoothing"', draw:drawZettel},
  mate:{name:'Club-Mate', draw:drawMate},
};
export function addItem(id){ if(inventory.includes(id))return; inventory.push(id);
  if(invOpen) renderInv(); toast('🎒 '+ITEMS[id].name+' erhalten',2200); }
export function renderInv(){ const grid=document.getElementById('invGrid'); grid.innerHTML='';
  if(!inventory.length){ grid.innerHTML='<div class="inv-empty">— noch leer —</div>'; return; }
  for(const id of inventory){ const it=ITEMS[id]; if(!it)continue;
    const slot=document.createElement('div'); slot.className='inv-slot';
    const cnv=document.createElement('canvas'); cnv.width=24; cnv.height=50; cnv.className='inv-cv';
    const cx=cnv.getContext('2d'); cx.imageSmoothingEnabled=false; it.draw(cx);
    const nm=document.createElement('div'); nm.className='inv-name'; nm.textContent= (id==='keta')? (it.name+' ×'+ketaKapseln) : it.name;
    slot.appendChild(cnv); slot.appendChild(nm); grid.appendChild(slot);
  }
}
export function toggleInv(){ invOpen=!invOpen; document.getElementById('inv').style.display=invOpen?'block':'none'; document.getElementById('invBack').style.display=invOpen?'block':'none'; if(invOpen) renderInv(); }
export function closeInv(){ if(!invOpen) return; invOpen=false; document.getElementById('inv').style.display='none'; document.getElementById('invBack').style.display='none'; }
document.getElementById('invClose').addEventListener('click',e=>{e.preventDefault();e.stopPropagation(); closeInv();});
document.getElementById('invBack').addEventListener('click',e=>{e.preventDefault(); closeInv();});
