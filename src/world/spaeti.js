import { LW, LH, X, reduce } from '../core/constants.js';
import { px } from '../core/canvas.js';
import { hash } from '../core/math.js';
import { G } from '../core/state.js';
import { player } from '../entities/player.js';
import { drawChar, PAL_PLAYER } from '../entities/drawChar.js';
import { setBanner, showBanner } from '../ui/banner.js';
import { openDialog } from '../systems/dialogue.js';
import { openShop } from '../systems/shop.js';
import { T, lightCv, Lx, setEnterCool } from '../main.js';

/* ======================================================================
   SPÄTI — begehbarer Innenraum, ein einziger geteilter Grundriss fuer
   jeden Spaeti auf der Karte (Zehlendorf, Wilmersdorf, Tempelhof-Feld).
   Rueckkehrpunkt wird pro Herkunfts-Bezirk gemerkt (wie ubahn.js/stationReturn).
   ====================================================================== */
const SPB={x:18,y:92,x2:302,y2:160};
export function blockedSpaeti(nx,ny){ const fx=nx+4, fy=ny+15, fw=8, fh=6;
  if(fx<SPB.x||fy<SPB.y||fx+fw>SPB.x2||fy+fh>SPB.y2) return true;
  for(const s of spaetiSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}

const spaetiBG=document.createElement('canvas'); spaetiBG.width=LW; spaetiBG.height=LH;
const spaetiSolids=[];
const kiosk={x:150,y:34};
export const spaetiReturn={};
export function setSpaetiReturn(id,p){ spaetiReturn[id]=p; }
let curFrom='town';

export function buildSpaeti(){
  const c=spaetiBG.getContext('2d'); c.imageSmoothingEnabled=false; c.textBaseline='top';
  // Boden (abgewetztes Linoleum)
  for(let y=56;y<LH;y+=16)for(let x=0;x<LW;x+=16){ const a=((x/16+y/16)&1);
    c.fillStyle=a?'#8f8a72':'#82805f'; c.fillRect(x,y,16,16);
    c.fillStyle='#6b6850'; c.fillRect(x,y,16,1); c.fillRect(x,y,1,16);
    if(hash(x,y)<.2){ c.fillStyle='#98936f'; c.fillRect(x+4+(hash(x,y)*6|0),y+4+(hash(y,x)*6|0),2,2); } }
  // Wand + Rahmen
  for(let y=0;y<56;y+=8)for(let x=0;x<LW;x+=8){ c.fillStyle=((x/8+y/8)&1)?'#3a342a':'#332e26'; c.fillRect(x,y,8,8); }
  c.fillStyle='#241c14'; c.fillRect(0,0,14,LH); c.fillRect(LW-14,0,14,LH); c.fillRect(0,LH-12,LW,12);
  c.fillStyle='#342a1c'; c.fillRect(0,LH-12,LW,2);
  // Neon-Schild "SPÄTI"
  c.fillStyle='#1a1620'; c.fillRect(108,6,104,16); c.fillStyle='#ff5fa2'; c.font='bold 12px Georgia'; c.fillText('SPÄTI',132,8);
  c.fillStyle='#62d0ff'; c.font='7px Georgia'; c.fillText('Getränke · Snacks · Alles', 116,22);
  // Kuehlregal links (Getraenke)
  c.fillStyle='#243038'; c.fillRect(20,30,60,50); c.fillStyle='#3a4a56'; c.fillRect(22,32,56,46);
  for(let r=0;r<3;r++){ for(let b=0;b<6;b++){ c.fillStyle=['#cf8a24','#8a6a2a','#e0b23a','#3a6a3a','#b8452f'][(b+r)%5]; c.fillRect(26+b*9,36+r*14,6,11); } }
  spaetiSolids.push({x:20,y:30,w:60,h:50});
  // Zigaretten-/Zeitschriftenregal rechts
  c.fillStyle='#2a2420'; c.fillRect(240,30,60,50); c.fillStyle='#3a332c'; c.fillRect(242,32,56,46);
  for(let r=0;r<4;r++){ for(let b=0;b<7;b++){ c.fillStyle=(b+r)%2?'#caa23a':'#c0392b'; c.fillRect(244+b*8,35+r*10,6,8); } }
  spaetiSolids.push({x:240,y:30,w:60,h:50});
  // Wein-/Sekt-Regal (mittig hinten, ueber der Theke)
  c.fillStyle='#2a2018'; c.fillRect(120,30,80,20); c.fillStyle='#3a2c1e'; c.fillRect(122,32,76,16);
  for(let b=0;b<9;b++){ c.fillStyle=b%2?'#5a2a2a':'#caa23a'; c.fillRect(124+b*8,35,4,11); }
  // Theke
  c.fillStyle='#4a3320'; c.fillRect(96,60,128,10); c.fillStyle='#5a3f28'; c.fillRect(96,60,128,2);
  c.fillStyle='#3a281a'; c.fillRect(96,70,128,14);
  for(let x=100;x<220;x+=10){ c.fillStyle='#2a1e14'; c.fillRect(x,70,1,14); }
  spaetiSolids.push({x:96,y:60,w:128,h:24});
  // Ausgang unten
  c.fillStyle='#2a1c14'; c.fillRect(140,LH-12,40,12); c.fillStyle='#4a3320'; c.fillRect(144,LH-10,32,10);
  c.fillStyle='#7a3a30'; c.fillRect(146,LH-16,28,4); c.fillStyle='#9a5a4a'; c.fillRect(148,LH-15,24,1);
  c.fillStyle='#cfe0f0'; c.font='6px Georgia'; c.fillText('→ raus',138,LH-23);
}

function drawKiosk(c,x,y){ x|=0;y|=0;
  px(c,x+3,y+9,12,11,'#4a4a52');                    // Kittel
  px(c,x,y+10,2,7,'#d8a070'); px(c,x+15,y+10,2,7,'#d8a070');
  px(c,x+4,y+1,8,8,'#dfae82'); px(c,x+4,y+1,8,1,'#eec092');
  px(c,x+3,y,10,3,'#3a2a1a'); px(c,x+3,y+2,2,3,'#3a2a1a'); px(c,x+11,y+2,2,3,'#3a2a1a');
  px(c,x+5,y+5,1,1,'#1a1410'); px(c,x+10,y+5,1,1,'#1a1410');
}

export function enterSpaeti(fromId){ curFrom=fromId; G.scene='spaeti'; player.x=152; player.y=118; player.dir='up'; player.frame=0;
  setBanner('Späti','Getränke · Snacks'); showBanner(); setEnterCool(0.5); }
export function exitSpaeti(){ const ret=spaetiReturn[curFrom]||{x:160,y:200,dir:'down'};
  G.scene=curFrom; player.x=ret.x; player.y=ret.y; player.dir=ret.dir; player.frame=0; setEnterCool(0.5); }

export function talkKiosk(){
  openDialog('Spätiverkäufer',['»Na, wat brauchste?« Er deutet aufs Regal hinter sich. »Kannst dir aussuchen, wat de willst — kostet natürlich.«'], ()=>openShop());
}

export function renderSpaeti(){
  X.clearRect(0,0,LW,LH);
  X.drawImage(spaetiBG,0,0);
  drawKiosk(X, kiosk.x, kiosk.y);
  drawChar(X, player.x|0, player.y|0, player.dir, player.frame, PAL_PLAYER);
  drawLightSpaeti();
}
function drawLightSpaeti(){
  Lx.clearRect(0,0,LW,LH);
  Lx.fillStyle='rgba(150,160,60,0.10)'; Lx.fillRect(0,0,LW,LH);
  let v=Lx.createRadialGradient(LW/2,LH/2,60,LW/2,LH/2,200); v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(10,8,4,0.46)');
  Lx.fillStyle=v; Lx.fillRect(0,0,LW,LH);
  Lx.globalCompositeOperation='lighter';
  const fl=reduce?1:0.85+0.15*Math.sin(T*3);
  function glow(gx,gy,r,col,a){ const rg=Lx.createRadialGradient(gx,gy,0,gx,gy,r); rg.addColorStop(0,col+a+')'); rg.addColorStop(1,col+'0)'); Lx.fillStyle=rg; Lx.fillRect(gx-r,gy-r,r*2,r*2); }
  glow(160,14,46,'rgba(255,95,162,',0.16*fl);
  glow(50,55,30,'rgba(120,180,255,',0.14*fl);
  Lx.globalCompositeOperation='source-over';
  X.drawImage(lightCv,0,0);
}
