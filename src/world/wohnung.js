import { LW, LH, X, reduce } from '../core/constants.js';
import { px } from '../core/canvas.js';
import { hash, clamp } from '../core/math.js';
import { G } from '../core/state.js';
import { player } from '../entities/player.js';
import { drawChar, drawSit, PAL_PLAYER } from '../entities/drawChar.js';
import { setBanner, showBanner } from '../ui/banner.js';
import { T, lightCv, Lx, setEnterCool, clearSitting } from '../main.js';

/* ======================================================================
   WOHNUNG — begehbarer Altbau (Treppe rauf -> hohe Wohnung, Stuck, Parkett)
   Eine hohe, vertikal scrollende Szene. NPC "Lucas" sitzt auf der Couch.
   ====================================================================== */
const WOH=304;
const wohnungBG=document.createElement('canvas'); wohnungBG.width=LW; wohnungBG.height=WOH;
const wohnungSolids=[]; export const wohnungNpcs=[], wohnungInters=[];
export let wohnungReturn={x:288,y:48,dir:'down'};
export function setWohnungReturn(p){ wohnungReturn=p; }
const PAL_LUCAS={coat:'#5e7d9e',coatHi:'#7a9aba',coatLo:'#486078',pants:'#3a3f4a',shoe:'#2a2118',skin:'#e8c39a',skinHi:'#f0d0a8',hair:'#e6c862'};
export function buildWohnung(){
  const c=wohnungBG.getContext('2d'); c.imageSmoothingEnabled=false; c.textBaseline='top';
  // ======================= WOHNUNG (oben) =======================
  px(c,0,0,LW,172,'#efe9dd');
  // Tafelparkett (Korbgeflecht)
  const oak=['#b08753','#a67c48','#bb9460','#9c7340'];
  for(let y=76;y<156;y+=12){ for(let x=0;x<LW;x+=12){
    const vert=(((x/12)+(y/12))&1); const base=oak[(hash(x,y)*2|0)*2 % 4];
    px(c,x,y,12,12,base);
    if(vert){ for(let i=0;i<3;i++) px(c,x+1+i*4,y+1,1,10,'rgba(40,26,14,.22)'); }
    else { for(let i=0;i<3;i++) px(c,x+1,y+1+i*4,10,1,'rgba(40,26,14,.22)'); }
    px(c,x,y,12,1,'rgba(40,26,14,.30)'); px(c,x,y,1,12,'rgba(40,26,14,.30)'); } }
  // Teppich unter Essbereich
  px(c,150,112,150,40,'#b8967a'); px(c,150,112,150,2,'#caa98c'); px(c,152,148,146,2,'#9c7a5e');
  for(let x=156;x<300;x+=10) px(c,x,116,4,1,'#a8866a');
  // ---- Stuckdecke ----
  px(c,0,0,LW,8,'#f6f2ea'); px(c,0,8,LW,2,'#e2dccf');
  for(let x=2;x<LW;x+=6) px(c,x,8,3,1,'#dcd4c4');
  px(c,0,10,LW,3,'#efe9dd');
  function corner(x){ px(c,x,12,18,3,'#f2ece2'); px(c,x+7,12,4,10,'#f2ece2'); px(c,x+4,14,10,2,'#e6dccc'); }
  corner(8); corner(LW-26);
  const rx=160, ry=20;
  for(let i=5;i>=1;i--){ c.fillStyle=i%2?'#f4eee4':'#e8e0d2'; c.beginPath(); c.ellipse(rx,ry,i*5,i*3.2,0,0,7); c.fill(); }
  for(let a=0;a<12;a++){ const an=a/12*6.28; px(c, rx+Math.cos(an)*22|0, ry+Math.sin(an)*13|0, 2,2,'#e2d8c8'); }
  px(c,rx-2,ry-2,4,4,'#f6f2ea');
  px(c,rx,ry+3,1,18,'#3a342c'); px(c,rx-2,ry+21,5,4,'#e8c86a'); px(c,rx-1,ry+25,3,2,'#fff0c0');
  // ---- Erkerfenster ----
  function window(x,w){
    px(c,x-2,24,w+4,52,'#f4efe6'); px(c,x,26,w,46,'#cfe0ea');
    px(c,x,26,w,4,'#dce8ee');
    px(c,x+w/2-0.5,26,1,46,'#f4efe6'); px(c,x,48,w,1,'#f4efe6');
    px(c,x+1,40,w-2,30,'#b8a890'); for(let i=0;i<3;i++) px(c,x+3+i*7,44,4,5,'#7a6a52');
    px(c,x+1,27,w-2,12,'#dfeaf0');
    px(c,x-2,24,w+4,1,'#fbf7ee'); px(c,x-2,72,w+4,2,'#d8d0c0');
  }
  window(120,30); window(170,30);
  px(c,116,24,2,52,'#e2dccf'); px(c,204,24,2,52,'#e2dccf');
  px(c,122,76,76,12,'#eae6dd'); for(let x=124;x<198;x+=5) px(c,x,77,2,10,'#d6d0c4'); px(c,122,76,76,1,'#f4f0e8');
  px(c,210,68,7,8,'#b5683a'); px(c,209,60,9,9,'#3f7a3a'); px(c,212,55,3,6,'#52924a');
  px(c,106,66,6,8,'#b5683a'); px(c,108,58,2,8,'#4f8a44'); px(c,107,60,1,5,'#52924a');
  // ---- Couch (Lucas sitzt hier) ----
  function couch(x,y,w){ const f='#5e7d70',fhi='#74948a',flo='#48645a';
    px(c,x,y,w,18,f); px(c,x,y,w,3,fhi); px(c,x,y+15,w,3,flo);
    px(c,x,y-6,w,8,f); px(c,x,y-6,w,2,fhi);
    px(c,x-5,y-4,6,22,flo); px(c,x+w-1,y-4,6,22,flo);
    px(c,x-5,y-4,6,2,fhi); px(c,x+w-1,y-4,6,2,fhi);
    px(c,x+3,y+2,w/2-4,8,fhi); px(c,x+w/2+1,y+2,w/2-4,8,fhi);
    px(c,x+3,y+2,w/2-4,1,'#86a69c'); px(c,x+w/2+1,y+2,w/2-4,1,'#86a69c');
    px(c,x+4,y+3,7,6,'#caa23a'); px(c,x+w-12,y+3,7,6,'#b5486a');
    px(c,x-4,y+18,w+10,2,'rgba(20,12,8,.3)'); }
  couch(20,98,72);
  px(c,40,80,30,14,'#8a6038'); px(c,42,82,26,10,'#caa890'); px(c,44,84,22,6,'#7a8a9a'); px(c,46,85,8,4,'#9aaa86');
  px(c,98,108,8,10,'#a8855a'); px(c,96,96,14,14,'#357a35'); px(c,99,92,3,6,'#52924a'); px(c,104,94,3,6,'#52924a'); px(c,93,100,4,4,'#3f8a3f');
  function dtable(x,y,w,h){ px(c,x,y,w,h,'#9a6e3e'); px(c,x,y,w,2,'#b48a52'); px(c,x+2,y+h,3,6,'#6e4a28'); px(c,x+w-5,y+h,3,6,'#6e4a28'); px(c,x+2,y+h-1,w-4,1,'rgba(20,12,8,.3)'); }
  function dchair(x,y){ px(c,x,y,9,3,'#8a5e30'); px(c,x,y-6,9,6,'#9a6e3e'); px(c,x,y-6,9,1,'#b48a52'); px(c,x+1,y+3,1,4,'#6e4a28'); px(c,x+7,y+3,1,4,'#6e4a28'); }
  dchair(176,116); dchair(196,116); dchair(216,116);
  dtable(170,122,60,22);
  dchair(176,150); dchair(196,150); dchair(216,150);
  px(c,290,80,22,52,'#6e4424'); px(c,290,80,22,2,'#865a30'); px(c,292,84,18,30,'#4a2e18');
  for(let i=0;i<3;i++) px(c,293,86+i*9,16,1,'#3a2414'); px(c,292,116,18,14,'#5a3618'); px(c,300,120,2,4,'#caa23a');
  px(c,289,79,24,2,'#3a2414');
  // ======================= WOHNUNGSTUER =======================
  px(c,0,156,LW,16,'#e8e2d4');
  px(c,40,150,12,22,'#f4efe6'); px(c,268,150,12,22,'#f4efe6');
  px(c,40,150,240,3,'#fbf7ee');
  px(c,52,152,8,20,'#e0d8c8'); px(c,260,152,8,20,'#e0d8c8');
  px(c,128,150,4,22,'#f4efe6'); px(c,188,150,4,22,'#f4efe6');
  px(c,132,156,56,16,'#cfc6b4');
  // ======================= TREPPENHAUS =======================
  px(c,0,172,LW,92,'#d8d0c0');
  px(c,0,172,44,92,'#cfc6b2'); px(c,276,172,44,92,'#cfc6b2');
  px(c,0,228,LW,36,'#c2b6a0'); px(c,0,228,LW,2,'#b0a288');
  for(let x=4;x<LW;x+=20) px(c,x,230,1,32,'#a89a80');
  px(c,8,178,28,44,'#f4efe6'); px(c,11,181,22,38,'#cfe0ea'); px(c,21,181,1,38,'#f4efe6'); px(c,11,199,22,1,'#f4efe6');
  px(c,12,196,20,18,'#b8a890');
  const sx0=48, sx1=272;
  for(let i=0;i<10;i++){ const sy=254-i*8;
    px(c,sx0,sy,sx1-sx0,8,'#8a6038'); px(c,sx0,sy,sx1-sx0,2,'#a07a48'); px(c,sx0,sy+7,sx1-sx0,1,'#5e3e22'); }
  for(let i=0;i<10;i++){ const sy=254-i*8; px(c,140,sy,40,8,'#8a3a32'); px(c,140,sy,40,1,'#a04a40'); px(c,140,sy+7,40,1,'#6e2c26');
    px(c,142,sy,1,8,'#c8a23a'); px(c,177,sy,1,8,'#c8a23a'); }
  px(c,256,176,4,86,'#5a3a22');
  for(let sy=180;sy<258;sy+=5){ px(c,259,sy,2,5,'#6e4a2a'); px(c,259,sy,2,1,'#8a6038'); }
  px(c,253,174,14,3,'#74502e'); px(c,253,174,14,1,'#8e6a40');
  // ======================= EINGANG / PODEST =======================
  for(let y=264;y<WOH;y+=12)for(let x=46;x<274;x+=12){ const a=((x/12+y/12)&1);
    c.fillStyle=a?'#c8bca8':'#a89880'; c.fillRect(x,y,12,12); c.fillStyle='#9a8c74'; c.fillRect(x,y,12,1); c.fillRect(x,y,1,12);
    px(c,x+5,y+5,2,2,a?'#8a7c64':'#bcae98'); }
  px(c,0,264,46,WOH-264,'#bdb29c'); px(c,274,264,46,WOH-264,'#bdb29c');
  px(c,8,270,28,20,'#5a5048'); for(let i=0;i<3;i++){ px(c,10,272+i*6,24,5,'#6e6258'); px(c,30,274+i*6,2,1,'#caa23a'); }
  px(c,138,WOH-12,44,12,'#3a2c1e'); px(c,142,WOH-9,36,9,'#6a4a30'); px(c,142,WOH-9,36,2,'#8a6a44');
  px(c,144,WOH-16,32,4,'#e8e2d4'); c.fillStyle='#5a4a36'; c.font='6px Georgia'; c.fillText('→ raus',150,WOH-22);
  px(c,0,WOH-3,LW,3,'#2a1f16');
  // ---- Solids (Moebel) ----
  wohnungSolids.length=0;
  wohnungSolids.push(
    {x:14,y:90,w:84,h:30},   // Couch + Lehnen
    {x:165,y:120,w:70,h:26}, // Esstisch
    {x:288,y:78,w:26,h:56}   // Vitrine
  );
  // ---- Lucas (blond) sitzt auf der Couch ----
  wohnungNpcs.length=0;
  wohnungNpcs.push({x:44,y:96,dir:'down',frame:0,sit:true,pal:PAL_LUCAS,who:'Lucas',
    lines:['Lucas lehnt sich in die Couch zurueck.',
           '»Schau dir den Stuck an. 1904 hat das jemand von Hand modelliert — und es haelt heute noch.«',
           '»Bleib so lange du willst. Kaffee steht in der Kueche.«']});
  // ---- Inters ----
  wohnungInters.length=0;
  wohnungInters.push(
    {x:120,y:78,w:90,h:10,who:'Erkerfenster',
     lines:['Durch die hohen Erkerfenster faellt warmes Licht.','Gegenueber: noch ein Altbau, noch ein Erker. Charlottenburg eben.']},
    {x:288,y:114,w:26,h:20,who:'Vitrine',
     lines:['Eine dunkle Holzvitrine.','Hinter Glas: ein paar alte Bücher, ein Foto, ein Schluessel den keiner mehr zuordnen kann.']}
  );
}
export function enterWohnung(){ G.scene='wohnung'; clearSitting(); player.x=152; player.y=274; player.dir='up'; player.frame=0;
  setBanner('Altbauwohnung','Charlottenburg-Wilmersdorf'); showBanner(); setEnterCool(0.5); }
export function exitWohnung(){ G.scene='chb'; clearSitting(); player.x=wohnungReturn.x; player.y=wohnungReturn.y; player.dir=wohnungReturn.dir; player.frame=0;
  setEnterCool(0.5); setBanner('Charlottenburg-Wilmersdorf','Bezirk'); }
export function blockedWohnung(nx,ny){ const fx=nx+4, fy=ny+15, fw=8, fh=5;
  let lo,hi;
  if(fy>=90 && fy<156){ lo=14; hi=306; }
  else if(fy>=156 && fy<172){ lo=132; hi=188; }
  else if(fy>=172 && fy<264){ lo=48; hi=272; }
  else if(fy>=264 && fy<300){ lo=48; hi=272; }
  else return true;
  if(fx<lo || fx+fw>hi) return true;
  for(const s of wohnungSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}
export function renderWohnung(){
  X.clearRect(0,0,LW,LH);
  const cy=clamp((player.y+8)-LH/2, 0, WOH-LH);
  X.drawImage(wohnungBG, 0, cy, LW, LH, 0,0, LW,LH);
  const ents=[];
  for(const n of wohnungNpcs) ents.push({y:n.y+16, draw:()=> n.sit?drawSit(X,n.x|0,(n.y-cy)|0,n.pal):drawChar(X,n.x|0,(n.y-cy)|0,n.dir,n.frame||0,n.pal)});
  ents.push({y:player.y+16, draw:()=>drawChar(X,player.x|0,(player.y-cy)|0,player.dir,player.frame,PAL_PLAYER)});
  ents.sort((a,b)=>a.y-b.y); for(const e of ents) e.draw();
  drawLightWohnung(cy);
}
function drawLightWohnung(cy){
  Lx.clearRect(0,0,LW,LH);
  Lx.fillStyle='rgba(255,210,150,0.06)'; Lx.fillRect(0,0,LW,LH);
  let v=Lx.createRadialGradient(LW/2,LH/2,90,LW/2,LH/2,220); v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(30,20,10,0.32)');
  Lx.fillStyle=v; Lx.fillRect(0,0,LW,LH);
  Lx.globalCompositeOperation='lighter';
  function glow(gx,gy,r,col,a){ const rg=Lx.createRadialGradient(gx,gy,0,gx,gy,r); rg.addColorStop(0,col+a+')'); rg.addColorStop(1,col+'0)'); Lx.fillStyle=rg; Lx.fillRect(gx-r,gy-r,r*2,r*2); }
  const fl=reduce?1:0.9+0.1*Math.sin(T*2);
  glow(135,50-cy,40,'rgba(220,240,255,',0.30);   // Erker-Tageslicht
  glow(185,50-cy,40,'rgba(220,240,255,',0.30);
  glow(160,30-cy,26,'rgba(255,200,110,',0.26*fl);// Deckenlampe
  glow(22,200-cy,30,'rgba(220,235,250,',0.22);   // Treppenhausfenster
  Lx.globalCompositeOperation='source-over';
  X.drawImage(lightCv,0,0);
}
