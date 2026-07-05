import { LW, LH, X, reduce } from '../core/constants.js';
import { px } from '../core/canvas.js';
import { hash } from '../core/math.js';
import { G } from '../core/state.js';
import { player } from '../entities/player.js';
import { drawChar, PAL_PLAYER } from '../entities/drawChar.js';
import { setBanner, showBanner } from '../ui/banner.js';
import { toast } from '../ui/toast.js';
import { openDialog } from '../systems/dialogue.js';
import { party, T, lightCv, Lx, setEnterCool } from '../main.js';

/* ======================================================================
   EFES GRILL — Innenraum (Heilstation, Pokécenter-Äquivalent)
   ====================================================================== */
const EFB={x:18,y:92,x2:302,y2:164};   // begehbarer Essbereich im Efes
export function blockedEfes(nx,ny){ const fx=nx+4, fy=ny+15, fw=8, fh=6;
  if(fx<EFB.x||fy<EFB.y||fx+fw>EFB.x2||fy+fh>EFB.y2) return true;
  for(const s of efesSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}

const efesBG=document.createElement('canvas'); efesBG.width=LW; efesBG.height=LH;
const efesSolids=[];
const doener={x:144,y:30};
let healFx=0;
export function tickHealFx(dt){ if(healFx>0) healFx-=dt; }
export let efesReturn={x:400,y:272,dir:'up'};
export function setEfesReturn(p){ efesReturn=p; }

export function buildEfes(){
  const c=efesBG.getContext('2d'); c.imageSmoothingEnabled=false; c.textBaseline='top';
  // Kachelwand hinten (Dönerladen-Fliesen)
  for(let y=0;y<56;y+=8)for(let x=0;x<LW;x+=8){ c.fillStyle=((x/8+y/8)&1)?'#e7e0d2':'#dcd3c0'; c.fillRect(x,y,8,8);
    c.fillStyle='#c8bda6'; c.fillRect(x,y,8,1); c.fillRect(x,y,1,8); }
  // Boden (warme Kacheln)
  for(let y=56;y<LH;y+=16)for(let x=0;x<LW;x+=16){ const a=((x/16+y/16)&1);
    c.fillStyle=a?'#b89a72':'#a8895f'; c.fillRect(x,y,16,16);
    c.fillStyle='#8f714c'; c.fillRect(x,y,16,1); c.fillRect(x,y,1,16);
    if(hash(x,y)<.2){ c.fillStyle=a?'#c2a47c':'#9a7c54'; c.fillRect(x+4+(hash(x,y)*6|0),y+4+(hash(y,x)*6|0),2,2);} }
  // Rahmen / Seitenwände
  c.fillStyle='#5a4436'; c.fillRect(0,0,14,LH); c.fillRect(LW-14,0,14,LH); c.fillRect(0,LH-12,LW,12);
  c.fillStyle='#6e5644'; c.fillRect(0,LH-12,LW,2);
  // EFES GRILL Schild
  c.fillStyle='#1a2a4a'; c.fillRect(108,5,104,17); c.fillStyle='#ef5446'; c.font='bold 12px Georgia'; c.fillText('EFES GRILL',116,7);
  c.fillStyle='#cfe0f0'; c.font='6px Georgia'; c.fillText('Döner · Bistro · Café',130,20);
  // Efes-Pils-Plakat links
  c.fillStyle='#1f5fae'; c.fillRect(22,8,40,40); c.fillStyle='#dfe7f0'; c.fillRect(24,10,36,9);
  c.fillStyle='#0e3f80'; c.font='6px Georgia'; c.fillText('EFES Pils',28,11);
  c.fillStyle='#f0e6c8'; c.fillRect(30,22,24,22); c.fillStyle='#e8c33a'; c.fillRect(36,26,12,14); c.fillStyle='#fff'; c.fillRect(36,26,12,3);
  // Speisekarte rechts
  c.fillStyle='#2a2118'; c.fillRect(256,8,44,42); c.fillStyle='#f4ecd6'; c.fillRect(258,10,40,38);
  c.fillStyle='#7a3a30'; c.font='6px Georgia'; c.fillText('SPEISEN',262,12);
  c.fillStyle='#3a2a1a'; c.font='5px Georgia';
  ['Döner ....6,50','Dürüm ...7,00','Lahmacun 6,00','Pommes ..3,50','Ayran ...2,00','Mate ....2,50'].forEach((s,i)=>c.fillText(s,260,22+i*5));
  // Theke
  c.fillStyle='#6e4a30'; c.fillRect(40,52,240,8); c.fillStyle='#8a6240'; c.fillRect(40,52,240,2);
  c.fillStyle='#4e3322'; c.fillRect(40,60,240,16);
  for(let x=44;x<280;x+=10){ c.fillStyle='#3a2618'; c.fillRect(x,60,1,16); }
  // Glasvitrine
  c.fillStyle='rgba(180,220,235,.30)'; c.fillRect(150,42,84,12); c.fillStyle='#9ec6d6'; c.fillRect(150,42,84,1);
  c.fillStyle='#caa86e'; c.fillRect(154,49,76,4);
  // Akh-Lager-Terminal (alter Röhrenmonitor auf der Theke)
  c.fillStyle='#2a2a30'; c.fillRect(180,36,20,16); c.fillStyle='#1c1c22'; c.fillRect(182,38,16,11);
  c.fillStyle='#3a8a5a'; c.fillRect(183,39,14,9); c.fillStyle='#8ae8b0'; c.fillRect(184,40,3,1); c.fillRect(184,42,6,1); c.fillRect(184,44,4,1);
  c.fillStyle='#1c1c22'; c.fillRect(186,52,8,3); c.fillStyle='#141418'; c.fillRect(178,55,24,2);
  // Dönerspieß
  c.fillStyle='#3a3a42'; c.fillRect(70,22,3,32);
  c.fillStyle='#7a4a2a'; c.fillRect(63,26,16,24);
  c.fillStyle='#8e5a34'; c.fillRect(64,26,14,5); c.fillStyle='#9a6a40'; c.fillRect(65,28,12,3);
  for(let i=0;i<24;i+=3){ c.fillStyle=(i&3)?'#a8754a':'#8e5a34'; c.fillRect(63+(i%2),28+i,16-(i%2)*2,1); }
  c.fillStyle='#5a3a22'; c.fillRect(62,49,18,3);
  c.fillStyle='#2a2730'; c.fillRect(80,24,4,30); c.fillStyle='#ff7a3a'; c.fillRect(81,26,2,26);
  // Tische + Hocker
  function table(tx,ty){ c.fillStyle='#3a2a1e'; c.beginPath(); c.ellipse(tx+13,ty+10,15,11,0,0,7); c.fill();
    c.fillStyle='#6a4a30'; c.beginPath(); c.ellipse(tx+13,ty+8,15,11,0,0,7); c.fill();
    c.fillStyle='#7e5a3a'; c.beginPath(); c.ellipse(tx+13,ty+6,13,9,0,0,7); c.fill();
    c.fillStyle='#4a3322'; c.fillRect(tx-8,ty+7,7,7); c.fillRect(tx+27,ty+7,7,7); }
  table(60,104); table(224,104);
  efesSolids.push({x:56,y:104,w:34,h:16},{x:220,y:104,w:34,h:16});
  // Ausgang unten
  c.fillStyle='#2a1c14'; c.fillRect(140,LH-12,40,12); c.fillStyle='#4a3320'; c.fillRect(144,LH-10,32,10);
  c.fillStyle='#7a3a30'; c.fillRect(146,LH-16,28,4); c.fillStyle='#9a5a4a'; c.fillRect(148,LH-15,24,1);
  c.fillStyle='#cfe0f0'; c.font='6px Georgia'; c.fillText('→ Zehlendorf',130,LH-23);
}

function drawDoener(c,x,y){ x|=0;y|=0;
  px(c,x+2,y+8,12,12,'#f0ece0');                 // weißes Shirt
  px(c,x+3,y+11,10,9,'#c23a2a');                 // rote Schürze
  px(c,x+3,y+11,10,2,'#e0e0d8');                 // Schürzenband
  px(c,x,y+9,2,7,'#d8a070'); px(c,x+14,y+9,2,7,'#d8a070'); // Arme
  px(c,x+15,y+5,1,6,'#c8d0d8'); px(c,x+15,y+11,2,2,'#5a4a3a'); // Messer
  px(c,x+4,y+1,8,8,'#e8b888'); px(c,x+4,y+1,8,1,'#f4cc9c'); // Kopf
  px(c,x+3,y,10,3,'#2a2018'); px(c,x+3,y+2,2,3,'#2a2018'); px(c,x+11,y+2,2,3,'#2a2018'); // Haar
  px(c,x+4,y+6,8,4,'#2f2620'); px(c,x+3,y+5,2,3,'#2f2620'); px(c,x+11,y+5,2,3,'#2f2620'); px(c,x+5,y+9,6,1,'#241c16'); // Bart
  px(c,x+5,y+5,1,1,'#1a1410'); px(c,x+10,y+5,1,1,'#1a1410'); // Augen
}

export function enterEfes(){ G.scene='efes'; player.x=152; player.y=116; player.dir='up'; player.frame=0;
  setBanner('Efes Grill','Imbiss · Heilung'); showBanner(); setEnterCool(0.5); }
export function exitEfes(){ G.scene='town'; player.x=efesReturn.x; player.y=efesReturn.y; player.dir=efesReturn.dir; player.frame=0;
  setEnterCool(0.5); setBanner('Zehlendorf Mitte','Bezirk'); }
export function talkDoener(){
  openDialog('Dönermann',[
    'Na, Alta! Komm rin, komm rin. Setz dir hin — deine Viecher sehn ja fix und fertich aus.',
    'Emaaa— einmal Heilung mit alles, ohne Zwiebeln. *fuchtelt mitm Messer* ...zack. Wie neu, Habibi.',
    'So. Frisch wie Fladenbrot ausm Ofen, deine Gigos. Und nu raus mit dir, ick hab Kundschaft.']);
  healFx=0.8; for(const g of party){ g.hp=g.maxHP; if(g.atk0!=null) g.atk=g.atk0; g.skipChance=0; g.selfHitChance=0; } toast('Deine Gigos sind wieder topfit! ✨',2200);
}

export function renderEfes(){
  X.clearRect(0,0,LW,LH);
  X.drawImage(efesBG,0,0);
  drawDoener(X, doener.x, doener.y);
  drawChar(X, player.x|0, player.y|0, player.dir, player.frame, PAL_PLAYER);
  if(healFx>0){ const a=Math.min(1,healFx); X.fillStyle='rgba(130,235,150,'+(a*0.30)+')'; X.fillRect(0,0,LW,LH);
    for(let i=0;i<10;i++){ const t=(T*1.5+i*0.1)%1; X.fillStyle='rgba(225,255,225,'+(a*(1-t))+')';
      X.fillRect((player.x+2+(hash(i,1)*14|0))|0,(player.y+18-t*26)|0,2,2); } }
  drawLightEfes();
}
function drawLightEfes(){
  Lx.clearRect(0,0,LW,LH);
  Lx.fillStyle='rgba(255,200,120,0.10)'; Lx.fillRect(0,0,LW,LH);
  let v=Lx.createRadialGradient(LW/2,LH/2,60,LW/2,LH/2,200); v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(30,18,10,0.40)');
  Lx.fillStyle=v; Lx.fillRect(0,0,LW,LH);
  Lx.globalCompositeOperation='lighter';
  function glow(gx,gy,r,col,a){ const rg=Lx.createRadialGradient(gx,gy,0,gx,gy,r); rg.addColorStop(0,col+a+')'); rg.addColorStop(1,col+'0)'); Lx.fillStyle=rg; Lx.fillRect(gx-r,gy-r,r*2,r*2); }
  glow(82,40,26,'rgba(255,140,60,', 0.5*(reduce?1:0.85+0.15*Math.sin(T*4)));
  glow(160,14,42,'rgba(239,84,70,', 0.18);
  Lx.globalCompositeOperation='source-over';
  X.drawImage(lightCv,0,0);
}
