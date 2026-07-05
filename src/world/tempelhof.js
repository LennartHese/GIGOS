import { LW, LH, TILE, WPX, HPX, X, C, reduce } from '../core/constants.js';
import { hash, clamp } from '../core/math.js';
import { LEAF_LINDEN, LEAF_OAK, canopy, px, shadow } from '../core/canvas.js';
import { G } from '../core/state.js';
import { player } from '../entities/player.js';
import { drawChar, PAL_PLAYER } from '../entities/drawChar.js';
import { setBanner, showBanner } from '../ui/banner.js';
import { toast } from '../ui/toast.js';
import { openDialog } from '../systems/dialogue.js';
import { rollWild } from '../data/encounters.js';
import { startBattle } from '../systems/battle.js';
import { PAL_STUD1, PAL_STUD2, PAL_GIRL } from './chb.js';
import { PAL_HIP } from './mitte.js';
import {
  T, lightCv, Lx, encCool, clearSitting, grassFlash, setGrassFlash,
  tpcamx, tpcamy, setTpCam, setCcam, setEnterCool,
} from '../main.js';

/* ======================================================================
   TEMPELHOF-SCHÖNEBERG — Kirchviertel (Apostel-Paulus-Kirche, Bierball,
   Spaeti/Cafe/Restaurant, BHZ-Easter-Egg) im Westen, riesiges Tempelhofer
   Feld im Osten. Eingang unten rechts aus Charlottenburg-Wilmersdorf.
   ====================================================================== */
export const TFW=84, TFH=54, TFPX=TFW*TILE, TFHPX=TFH*TILE;
const tpBelow=document.createElement('canvas'); tpBelow.width=TFPX; tpBelow.height=TFHPX;
const tpAbove=document.createElement('canvas'); tpAbove.width=TFPX; tpAbove.height=TFHPX;
const tpB=tpBelow.getContext('2d'), tpA=tpAbove.getContext('2d'); tpB.imageSmoothingEnabled=false; tpA.imageSmoothingEnabled=false;
const tpGround=new Uint8Array(TFW*TFH); const tpGi=(x,y)=>y*TFW+x;
function tfill(code,x0,y0,x1,y1){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) if(x>=0&&y>=0&&x<TFW&&y<TFH) tpGround[tpGi(x,y)]=code; }
export const tpInters=[], tpDoors=[], tpNpcs=[]; const tpSolids=[], tpGlows=[];
function tpSolid(x,y,w,h){ tpSolids.push({x,y,w,h}); }
function tpInter(x,y,w,h,who,lines){ tpInters.push({x,y,w,h,who,lines}); }
const tpEntry={x:2*TILE, y:22*TILE};
let tpReturn={x:31*TILE, y:23*TILE, dir:'up'};   // Position in CHB (Ausgang unten rechts)

// tiles: 0 gras · 2 gehweg · 3 asphalt · 5 platz/rollbahn-beton · 7 hohes gras
function tpTile(x,y,code){ const X0=x*TILE,Y0=y*TILE;
  if(code===0||code===7){ tpB.fillStyle=C.grassBase; tpB.fillRect(X0,Y0,TILE,TILE);
    for(let i=0;i<9;i++){ const xx=hash(i,x*7+y)*TILE|0, yy=hash(i+9,x+y*5)*TILE|0, r=hash(i+3,x*y+1); tpB.fillStyle=r<.5?C.grassHi:C.grassLo; tpB.fillRect(X0+xx,Y0+yy,1,r<.4?2:1); }
    if(code===7){ for(let i=0;i<8;i++){ const gx=X0+(hash(i,x+3)*14|0), gy=Y0+4+(hash(i+4,y+2)*8|0); tpB.fillStyle=hash(i,x+y)<.4?C.tgrassHi:C.tgrass; tpB.fillRect(gx,gy,1,3+(hash(i,x)*2|0)); } }
  } else if(code===2){ tpB.fillStyle='#6a6258'; tpB.fillRect(X0,Y0,TILE,TILE);
    for(let yy=0;yy<TILE;yy+=4)for(let xx=0;xx<TILE;xx+=4){ tpB.fillStyle=hash(xx+yy,x+y)<.5?'#746c60':'#5e574e'; tpB.fillRect(X0+xx,Y0+yy,3,3); }
  } else if(code===3){ tpB.fillStyle='#3a3a40'; tpB.fillRect(X0,Y0,TILE,TILE);
    for(let i=0;i<6;i++){ tpB.fillStyle=hash(i,x+y)<.5?'#343438':'#42424a'; tpB.fillRect(X0+(hash(i,x)*TILE|0),Y0+(hash(i+2,y)*TILE|0),2,1); }
  } else if(code===5){ tpB.fillStyle='#9a988e'; tpB.fillRect(X0,Y0,TILE,TILE);
    tpB.fillStyle='#8a887e'; tpB.fillRect(X0,Y0,TILE,1); tpB.fillRect(X0,Y0,1,TILE);
    for(let i=0;i<4;i++){ tpB.fillStyle=hash(i,x+y)<.5?'#a4a298':'#8e8c82'; tpB.fillRect(X0+(hash(i,x)*TILE|0),Y0+(hash(i+1,y)*TILE|0),2,2); }
  }
}
function paintTempelhofGround(){
  for(let i=0;i<tpGround.length;i++) tpGround[i]=0;
  // Haupt-Boulevard (West-Ost) — Kirchviertel bis Feld-Eingang
  tfill(3, 0,21, TFW-1,22);
  // Nebenstrassen im Kirchviertel
  tfill(3, 8,10, 9,34); tfill(3, 20,6, 21,34);
  tfill(3, 8,16, 21,16); tfill(3, 8,30, 21,30);
  // Kirchplatz (Beton) vor der Apostel-Paulus-Kirche
  tfill(5, 8,15, 24,26);
  // Tempelhofer Feld — riesige Graesflaeche, rechter Teil der Map
  tfill(0, 30,2, TFW-1,TFH-3);
  // alte Rollbahn-Streifen (heller Beton), zwei parallele Bahnen
  tfill(5, 34,14, TFW-4,17); tfill(5, 34,32, TFW-4,35);
  // hohes Gras (Encounter-Zonen) an den Feldraendern
  tfill(7, 32,4, 48,10); tfill(7, 62,20, 80,26); tfill(7, 36,40, 54,46);
  // Gehwege automatisch an Strassen (Snapshot -> kein Cascade)
  const snap=tpGround.slice();
  for(let y=0;y<TFH;y++)for(let x=0;x<TFW;x++){ if(snap[tpGi(x,y)]!==0) continue;
    let near=false; [[1,0],[-1,0],[0,1],[0,-1]].forEach(d=>{ const nx=x+d[0],ny=y+d[1]; if(nx>=0&&ny>=0&&nx<TFW&&ny<TFH && snap[tpGi(nx,ny)]===3) near=true; });
    if(near) tpGround[tpGi(x,y)]=2;
  }
  for(let y=0;y<TFH;y++)for(let x=0;x<TFW;x++) tpTile(x,y,tpGround[tpGi(x,y)]);
}

function tpTree(tx,ty){ const x=tx*TILE+8,y=ty*TILE; px(tpB,x-1,y+10,3,9,'#4a3522'); canopy(tpA, x, y+2, 13, 11, LEAF_LINDEN, (tx*7+ty)|0); tpSolid(x-3,y+13,7,5); }
function tpBigTree(tx,ty){ const x=tx*TILE+8,y=ty*TILE;
  px(tpB,x-2,y+10,5,13,'#4a3522'); canopy(tpA, x, y-5, 17, 14, LEAF_OAK, (tx*13+ty)|0); tpSolid(x-4,y+15,9,6); }
function tpLamp(tx,ty){ const x=tx*TILE+8,y=ty*TILE; px(tpB,x,y+2,2,15,'#2a2a30'); px(tpA,x-3,y,8,4,'#3a3a42'); px(tpA,x-2,y+1,6,2,'#ffcf7a'); tpGlows.push({x:x+1,y:y+3,r:16}); }
function tpBench(tx,ty){ const x=tx*TILE,y=ty*TILE+9; shadow(tpB,x+1,y+5,14,3); px(tpB,x,y,15,3,'#7a5a38'); px(tpB,x,y+3,15,4,'#6a4a2e'); px(tpB,x+1,y+7,2,4,'#4a3320'); px(tpB,x+12,y+7,2,4,'#4a3320'); tpSolid(x+1,y+3,14,5); }
// einfacher Drachen (Deko, schwebt auf tpA) — fuer die Tempelhofer-Feld-Atmosphaere
function tpKite(x,y,col){ tpA.fillStyle='#2a2018'; for(let i=0;i<8;i++) tpA.fillRect(x-i,y+40+i*2,1,1);
  tpA.fillStyle=col; tpA.beginPath(); tpA.moveTo(x,y-7); tpA.lineTo(x+7,y); tpA.lineTo(x,y+7); tpA.lineTo(x-7,y); tpA.closePath(); tpA.fill();
  tpA.strokeStyle='#161410'; tpA.beginPath(); tpA.moveTo(x,y-7); tpA.lineTo(x,y+7); tpA.stroke(); }

// ---------- Apostel-Paulus-Kirche ----------
function tpChurch(tx,ty){
  const x=tx*TILE, y=ty*TILE, W=16*TILE, H=13*TILE;
  const stone='#a89a7e', hi='#c7bb9c', sh='#7a6e56', dk='#4e4636', roof='#5a3a2c', roofHi='#78503c';
  const glass='#3a5a7c', glassHi='#6a9ac2';
  shadow(tpB,x+6,y+H-2,W-12,8);
  // Schiff
  px(tpB,x,y+40,W,H-40,stone); px(tpB,x,y+40,W,3,hi); px(tpB,x+W-4,y+40,4,H-40,sh);
  for(let i=0;i<3;i++){ const wx=x+18+i*40;
    px(tpB,wx,y+58,12,26,dk); px(tpB,wx+2,y+60,8,22,glass); px(tpB,wx+2,y+60,8,3,glassHi); px(tpB,wx,y+54,12,4,sh); }
  // Zwillingstuerme (rot-backsteinig, neuromanisch)
  for(const tOff of [0, W-34]){
    const tx2=x+tOff, tw=34;
    px(tpB,tx2,y,tw,58,stone); px(tpB,tx2,y,tw,3,hi); px(tpB,tx2+tw-4,y,4,58,sh);
    px(tpB,tx2+8,y+16,10,18,dk); px(tpB,tx2+10,y+18,6,14,glass); px(tpB,tx2+10,y+18,2,14,glassHi);
    // Turmspitze (Pyramidendach)
    tpB.fillStyle=roof; tpB.beginPath(); tpB.moveTo(tx2-3,y); tpB.lineTo(tx2+tw+3,y); tpB.lineTo(tx2+tw/2,y-30); tpB.closePath(); tpB.fill();
    tpB.fillStyle=roofHi; tpB.beginPath(); tpB.moveTo(tx2-3,y); tpB.lineTo(tx2+tw/2,y-30); tpB.lineTo(tx2+tw/2-4,y-28); tpB.lineTo(tx2+1,y-2); tpB.closePath(); tpB.fill();
    px(tpA,tx2+tw/2-1,y-38,2,10,'#2a2620'); px(tpA,tx2+tw/2-3,y-40,6,3,'#3a342a');
  }
  // Rosette (rundes Fenster) mittig ueber dem Portal
  const rx=x+W/2, ry=y+30;
  tpB.fillStyle=dk; tpB.beginPath(); tpB.arc(rx,ry,11,0,6.3); tpB.fill();
  tpB.fillStyle=glass; tpB.beginPath(); tpB.arc(rx,ry,8,0,6.3); tpB.fill();
  tpB.fillStyle=glassHi; tpB.beginPath(); tpB.arc(rx,ry,3,0,6.3); tpB.fill();
  // Portal
  px(tpB,x+W/2-10,y+H-20,20,20,dk); px(tpB,x+W/2-8,y+H-18,16,18,'#3a2a1e');
  tpSolid(x,y+38,W,H-38);
  tpInter(x-4, y+H-4, W+8, 10, 'Apostel-Paulus-Kirche',
    ['Die Apostel-Paulus-Kirche. Zwei rote Backsteintuerme, wachsam ueber dem Kiez.',
     'Drinnen ist es kuehl und still — draussen johlen schon die ersten Bierball-Runden.',
     '(Platzhalter fuer ein begehbares Interieur — kommt spaeter.)']);
}

// ---------- Laeden: Spaeti Wunderlampe, Café, Restaurant ----------
function tpShop(tx,ty,w,h,title,sub,wallCol,signBg,signCol){
  const x=tx*TILE,y=ty*TILE,W=w*TILE,H=h*TILE;
  shadow(tpB,x+3,y+H-2,W-6,6);
  px(tpB,x,y,W,H,wallCol); px(tpB,x,y,W,2,'#00000022'); px(tpB,x+W-3,y,3,H,'#00000033'); px(tpB,x,y+H-3,W,3,'#00000033');
  // Schaufenster
  px(tpB,x+3,y+H-18,W-6,13,'#2a3038'); px(tpB,x+4,y+H-17,W-8,11,'#3a4652'); px(tpB,x+4,y+H-17,W-8,2,'#556474');
  // beleuchtetes Schild
  px(tpB,x+3,y+2,W-6,16,signBg); px(tpB,x+3,y+2,W-6,1,'rgba(255,255,255,.18)');
  tpB.textAlign='center'; tpB.textBaseline='alphabetic';
  tpB.fillStyle=signCol; tpB.font='bold 8px Arial'; tpB.fillText(title, x+W/2, y+11);
  if(sub){ tpB.fillStyle='rgba(255,255,255,.75)'; tpB.font='6px Arial'; tpB.fillText(sub, x+W/2, y+17); }
  tpB.textAlign='left';
  tpSolid(x,y+2,W,H-4);
  tpInter(x-4, y+H-4, W+8, 10, title, [title+' — '+(sub||'ein kleiner Laden im Kiez')+'.', 'Noch kein begehbares Interieur, aber der Blick durchs Schaufenster ist schon mal was.']);
}

// ---------- BHZ — Easter Egg (versteckte Rap-Crew) ----------
const PAL_BHZ1={coat:'#1a1a1e',coatHi:'#2c2c32',coatLo:'#0e0e10',pants:'#242428',shoe:'#0a0a0c',skin:'#caa06e',hair:'#100c0a'};
const PAL_BHZ2={coat:'#232028',coatHi:'#38323e',coatLo:'#16131a',pants:'#1c1a20',shoe:'#0a0a0c',skin:'#e8c39a',hair:'#1a1410'};
const PAL_BHZ3={coat:'#1e2420',coatHi:'#303a34',coatLo:'#121612',pants:'#26241e',shoe:'#0a0a0c',skin:'#d8a878',hair:'#241a10',curly:true};
function buildBHZ(){
  const x0=3*TILE, y0=44*TILE;
  tpBigTree(2,42); tpBigTree(6,46);
  tpSolid(x0-6,y0-4,4,4); // kleine Kiste als Deko-Blocker
  tpNpcs.push(
    {x:x0,y:y0,dir:'down',pal:PAL_BHZ1,who:'BHZ',frame:0,lines:['Drei Typen chillen versteckt zwischen den Baeumen, Boombox auf Blockstein.','»Yo... haste uns gefunden? Respekt. Bleib cool, sag keinem was.«','»BHZ, immer im Schatten, immer am Start. Und jetzt lass uns in Ruhe reisen.«']},
    {x:x0+18,y:y0+6,dir:'down',pal:PAL_BHZ2,who:'BHZ',frame:0,lines:['»Wir sind nur zum Vibe hier, kein Feature, keine Ansage.«','»Kiez bleibt Kiez. Hoerste?«']},
    {x:x0+34,y:y0-4,dir:'down',pal:PAL_BHZ3,who:'BHZ',frame:0,lines:['Er nickt kurz im Takt einer Melodie, die keiner sonst hoert.','»Alles Fame kommt und geht. Der Beat bleibt.«']}
  );
}

// ---------- Bierball-Minigame ----------
let bbActive=false, bbPlayerBeer=100, bbOppBeer=100, bbPointerX=0, bbDir=1, bbResult=null, bbMsg='';
const BB_SPEED=170;
export function openBierball(){
  G.state='bierball'; bbActive=true; bbPlayerBeer=100; bbOppBeer=100; bbPointerX=0; bbDir=1; bbResult=null;
  bbMsg='Druck E, wenn der Zeiger im gruenen oder goldenen Feld ist!';
}
export function closeBierball(){ G.state='play'; bbActive=false; }
export function updateBierball(dt){
  if(!bbActive || bbResult) return;
  bbPointerX+=bbDir*BB_SPEED*dt;
  if(bbPointerX>200){ bbPointerX=200; bbDir=-1; }
  if(bbPointerX<0){ bbPointerX=0; bbDir=1; }
}
function bbThrow(){
  const p=bbPointerX;
  let dmg=0, txt;
  if(p>=85&&p<=115){ dmg=34; txt='PERFEKT getroffen! Volle Kanne fuers Team!'; }
  else if(p>=58&&p<=142){ dmg=19; txt='Getroffen! Flasche wackelt und faellt.'; }
  else { dmg=0; txt='Daneben! Die Flasche steht noch.'; }
  if(dmg>0) bbPlayerBeer=Math.max(0,bbPlayerBeer-dmg);
  bbMsg=txt;
  if(bbPlayerBeer<=0){ bbResult='win'; bbMsg='Bier leer! Dein Team johlt — ausgetrunken!'; return; }
  // Gegner-Zug (automatisch, direkt danach)
  if(Math.random()<0.55) bbOppBeer=Math.max(0,bbOppBeer-(13+Math.random()*17));
  if(bbOppBeer<=0){ bbResult='lose'; bbMsg='Knapp! Der Kumpel war zuerst leer.'; }
}
export function bierballKey(k){
  if(k==='q'||k==='backspace'||k==='escape'){ closeBierball(); return; }
  if(bbResult){ if(k==='e'||k===' '||k==='enter') closeBierball(); return; }
  if(k==='e'||k===' '||k==='enter') bbThrow();
}
export function renderBierball(){
  X.fillStyle='#1a140c'; X.fillRect(0,0,LW,LH);
  const g=X.createRadialGradient(LW/2,60,10,LW/2,60,180); g.addColorStop(0,'rgba(216,178,74,0.18)'); g.addColorStop(1,'rgba(0,0,0,0)');
  X.fillStyle=g; X.fillRect(0,0,LW,LH);
  X.textAlign='center'; X.textBaseline='top';
  X.fillStyle='#ffd24a'; X.font='bold 15px Georgia'; X.fillText('BIERBALL', LW/2, 8);
  X.fillStyle='#cdbfa6'; X.font='8px Georgia'; X.fillText('Wirf die Flasche um, bevor dein Kumpel sein Bier leer hat.', LW/2, 26);
  // Zielleiste
  const barX=(LW-200)/2, barY=52, barW=200, barH=14;
  px(X,barX-2,barY-2,barW+4,barH+4,'#0c0a08');
  px(X,barX,barY,barW,barH,'#5a2a20');
  px(X,barX+58,barY,84,barH,'#3a7a40');
  px(X,barX+85,barY,30,barH,'#d8b24a');
  px(X,barX+bbPointerX-1,barY-3,2,barH+6,'#f3ecd8');
  // Bier-Meter
  function meter(mx,label,val,col){
    X.fillStyle='#cdbfa6'; X.font='bold 9px Georgia'; X.fillText(label, mx, 82);
    px(X,mx-16,94,32,84,'#241f18'); px(X,mx-14,96,28,80,'#e8d8a0');
    const fillH=Math.round(76*(val/100));
    px(X,mx-14,96+(80-fillH-4),28,fillH+4,col);
    X.fillStyle='#3a2a1a'; X.font='8px Georgia'; X.fillText(Math.round(val)+'%', mx, 184);
  }
  meter(LW/2-60,'DU',bbPlayerBeer,'#e8b84a');
  meter(LW/2+60,'KUMPEL',bbOppBeer,'#e8b84a');
  X.fillStyle='#f3ecd8'; X.font='10px Georgia'; X.fillText(bbMsg, LW/2, 200);
  if(bbResult){ X.fillStyle=bbResult==='win'?'#8fe08a':'#e08a8a'; X.font='bold 12px Georgia'; X.fillText(bbResult==='win'?'DU GEWINNST!':'VERLOREN!', LW/2, 216); }
  X.fillStyle='#a89b76'; X.font='8px Georgia'; X.fillText(bbResult? 'E: nochmal probieren  ·  Q: raus' : 'E: werfen  ·  Q: abbrechen', LW/2, LH-13);
  X.textAlign='left';
}

export function buildTempelhof(){
  paintTempelhofGround();
  tpChurch(8,2);
  tpTree(6,20); tpTree(24,20); tpTree(10,34); tpBigTree(30,6); tpBigTree(70,8);
  tpLamp(12,22); tpLamp(20,22); tpLamp(28,22); tpLamp(16,10);
  tpBench(11,18); tpBench(18,18);
  // Bierball-Ecke auf dem Kirchplatz
  const bbx=13*TILE, bby=19*TILE;
  tpSolid(bbx+6,bby+10,10,8);
  tpInter(bbx-4,bby+8,26,14,'Bierball-Fass',
    ['Ein Bierfass, eine wacklige Flasche obendrauf — der Klassiker.',
     'Ringsrum johlen schon Studis. Traust du dich?']);
  tpNpcs.push({x:bbx,y:bby,dir:'down',pal:PAL_STUD1,who:'Bierball-Gastgeber',frame:0,
    lines:['»Yo! Bierball, mein Freund. Du wirfst, du triffst, dein ganzes Team trinkt mit.«',
      '»Wer zuerst sein Bier leer hat, gewinnt. Los, zeig was du drauf hast!«']});
  tpNpcs.push({x:bbx+20,y:bby+4,dir:'left',pal:PAL_STUD2,who:'Student',frame:0,lines:['Ich hab schon drei Runden verloren. Macht nix, schmeckt trotzdem.','GEH REIN, GEH REIN, GEH REIN!']});
  tpNpcs.push({x:bbx-14,y:bby+8,dir:'right',pal:PAL_GIRL,who:'Studentin',frame:0,lines:['Kirchplatz ist der beste Vorglueh-Spot der Stadt.','Nimm die Perfect-Zone, glaub mir.']});
  // Laeden (Spaeti Wunderlampe, Café, Restaurant)
  tpShop(8,28,7,6,'SPÄTI','WUNDERLAMPE','#8a6a30','#161320','#ffd24a');
  tpShop(16,28,7,6,'CAFÉ','SONNTAGSKIND','#7a4a3a','#1c1420','#ffb0a0');
  tpShop(24,28,7,6,'RESTAURANT','ZUR KIEZPERLE','#4a5a3a','#161e14','#c8e896');
  // BHZ — verstecktes Easter Egg
  buildBHZ();
  // Tempelhofer Feld — Kite-Flieger, Chiller, Trinker
  tpKite(46*TILE, 22*TILE, '#e34d8c'); tpKite(64*TILE, 20*TILE, '#3a7ad0'); tpKite(38*TILE, 28*TILE, '#ffd24a');
  tpInter(48*TILE,24*TILE,4*TILE,3*TILE,'Tempelhofer Feld',
    ['Das Tempelhofer Feld. Frueher Flughafen, heute die groesste Wiese der Stadt.',
     'Drachen steigen, Bier fliesst, irgendwo grillt garantiert jemand illegal.',
     'Kilometerweit nichts als Rollbahn, Gras und Horizont.']);
  tpNpcs.push(
    {x:44*TILE,y:8*TILE,dir:'up',pal:PAL_STUD1,who:'Drachen-Flieger',frame:0,lines:['Die Schnur haelt, der Wind auch. Perfekter Tag.','Mein Drache ist aelter als mein Fuehrerschein.']},
    {x:62*TILE,y:8*TILE,dir:'up',pal:PAL_HIP,who:'Drachen-Fliegerin',frame:0,lines:['Guck ihn fliegen! Ganz ohne Motor, nur Wind und Vibes.','Frueher sind hier Flugzeuge gestartet. Jetzt nur noch das hier.']},
    {x:40*TILE,y:22*TILE,dir:'down',pal:PAL_STUD2,who:'Grillgruppe',play:true,t:0.3,frame:0,lines:['Offiziell verboten, inoffiziell Tradition.','Willste eine Bratwurst? Frag nicht woher der Grill ist.']},
    {x:56*TILE,y:24*TILE,dir:'down',pal:PAL_GIRL,who:'Skater',wander:true,base:56*TILE,range:24,t:0,frame:0,lines:['Flachste Flaeche der Stadt. Ehemalige Startbahn, perfekt zum Rollen.','Kein Auto, kein Stress. Nur Asphalt und Horizont.']},
    {x:70*TILE,y:24*TILE,dir:'left',pal:PAL_HIP,who:'Slackliner',frame:0,lines:['Balance ist alles. Auch beim Bier danach.','Zwischen zwei Baeumen, hoch ueber dem Gras. Naja, einen Meter.']},
    {x:36*TILE,y:44*TILE,dir:'up',pal:PAL_STUD1,who:'Picknick-Gruppe',play:true,t:1.1,frame:0,lines:['Decke, Wein, Sonnenuntergang. Klassiker.','Wir sind seit dem Mittag hier. Vielleicht laenger.']},
    {x:66*TILE,y:42*TILE,dir:'down',pal:PAL_STUD2,who:'Jogger',wander:true,base:66*TILE,range:20,t:0.6,frame:0,lines:['Zehn Kilometer, kein Baum im Weg. Nur Wind.','Feld schlaegt Laufband. Immer.']},
    {x:50*TILE,y:38*TILE,dir:'right',pal:PAL_GIRL,who:'Hipster',play:true,t:1.8,frame:0,lines:['Vintage-Fahrrad, Bluetooth-Box, gute Laune.','Ich komm jeden Sonntag her. Kirche kann warten.']}
  );
  // Ausgang zurueck nach Charlottenburg-Wilmersdorf (West)
  tpDoors.push({x:0,y:21*TILE,w:24,h:2*TILE,to:'chb'});
  tpInter(1*TILE,20*TILE,2*TILE,2*TILE,'→ Wilmersdorf',['Zurueck Richtung Westen, rein nach Charlottenburg-Wilmersdorf.']);
}
export function blockedTempelhof(nx,ny){ const fx=nx+4,fy=ny+15,fw=8,fh=6;
  if(fx<TILE||fy<TILE||fx+fw>TFPX-TILE||fy+fh>TFHPX-TILE) return true;
  for(const s of tpSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}
let tpLastTile=-1;
export function checkEncounterTempelhof(){
  const tx=(player.x+8)/TILE|0, ty=(player.y+16)/TILE|0;
  const t=tpGround[tpGi(clamp(tx,0,TFW-1),clamp(ty,0,TFH-1))];
  if(t===7){ const id=ty*TFW+tx;
    if(id!==tpLastTile && encCool<=0){ tpLastTile=id; if(Math.random()<0.24){ const w=rollWild('tempelhof'); setGrassFlash(0.5); startBattle(w.id,w.lv,'tempelhof'); } } }
  else tpLastTile=-1;
}
export function renderTempelhof(){
  X.clearRect(0,0,LW,LH);
  X.drawImage(tpBelow, tpcamx,tpcamy,LW,LH, 0,0,LW,LH);
  const ents=[];
  ents.push({y:player.y+22,draw:()=>drawChar(X,(player.x-tpcamx)|0,(player.y-tpcamy)|0,player.dir,player.frame,PAL_PLAYER)});
  for(const n of tpNpcs) ents.push({y:n.y+22,draw:()=>drawChar(X,(n.x-tpcamx)|0,(n.y-tpcamy)|0,n.dir,n.frame||0,n.pal)});
  ents.sort((a,b)=>a.y-b.y); for(const e of ents) e.draw();
  X.drawImage(tpAbove, tpcamx,tpcamy,LW,LH, 0,0,LW,LH);
  if(grassFlash>0){ X.fillStyle='rgba(120,200,90,'+(grassFlash*0.5)+')'; X.fillRect(0,0,LW,LH); }
  drawLightTempelhof();
}
function drawLightTempelhof(){
  Lx.clearRect(0,0,LW,LH);
  Lx.fillStyle='rgba(255,235,200,0.06)'; Lx.fillRect(0,0,LW,LH);
  let v=Lx.createRadialGradient(LW/2,LH/2,80,LW/2,LH/2,230); v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(20,18,10,0.30)');
  Lx.fillStyle=v; Lx.fillRect(0,0,LW,LH);
  Lx.globalCompositeOperation='lighter';
  const fl=reduce?1:0.85+0.15*Math.sin(T*3);
  for(const g of tpGlows){ const sx=g.x-tpcamx, sy=g.y-tpcamy; if(sx<-30||sx>LW+30||sy<-30||sy>LH+30) continue;
    const rg=Lx.createRadialGradient(sx,sy,0,sx,sy,g.r); rg.addColorStop(0,'rgba(255,200,120,'+(0.35*fl)+')'); rg.addColorStop(1,'rgba(255,200,120,0)');
    Lx.fillStyle=rg; Lx.fillRect(sx-g.r,sy-g.r,g.r*2,g.r*2); }
  Lx.globalCompositeOperation='source-over';
  X.drawImage(lightCv,0,0);
}
export function enterTempelhof(){
  G.scene='tempelhof'; clearSitting(); player.x=tpEntry.x; player.y=tpEntry.y; player.dir='right'; player.frame=0; setEnterCool(0.5);
  setTpCam(clamp(player.x+8-LW/2,0,TFPX-LW), clamp(player.y+16-LH/2,0,TFHPX-LH));
  setBanner('Tempelhof-Schöneberg','Kirchviertel & Tempelhofer Feld'); showBanner();
  toast('Neue Karte: Tempelhof-Schöneberg. Bierball auf dem Kirchplatz, das Feld ganz im Osten.',3200);
}
export function exitTempelhof(){
  G.scene='chb'; clearSitting(); player.x=tpReturn.x; player.y=tpReturn.y; player.dir=tpReturn.dir; player.frame=0; setEnterCool(0.5);
  setCcam(clamp(player.x+8-LW/2,0,WPX-LW), clamp(player.y+16-LH/2,0,HPX-LH));
  setBanner('Charlottenburg-Wilmersdorf','Bezirk'); showBanner();
}
