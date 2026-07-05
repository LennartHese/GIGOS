import { LW, LH, TILE, MAPW, MAPH, WPX, HPX, X, C, reduce } from '../core/constants.js';
import { px, canopy, LEAF_LINDEN, LEAF_OAK } from '../core/canvas.js';
import { hash, clamp, lerp } from '../core/math.js';
import { G } from '../core/state.js';
import { player } from '../entities/player.js';
import { drawChar, PAL_PLAYER } from '../entities/drawChar.js';
import { setBanner, showBanner } from '../ui/banner.js';
import { toast } from '../ui/toast.js';
import { rollWild } from '../data/encounters.js';
import { startBattle } from '../systems/battle.js';
import {
  T, lightCv, Lx, encCool, clearSitting, grassFlash, setGrassFlash,
  klcamx, klcamy, setKlCam, setEnterCool,
} from '../main.js';

/* ======================================================================
   KRUMME LANKE  — erstes Wasser-Biom (West-Ausgang aus Zehlendorf)
   ====================================================================== */
const klBelow=document.createElement('canvas'); klBelow.width=WPX; klBelow.height=HPX;
const klAbove=document.createElement('canvas'); klAbove.width=WPX; klAbove.height=HPX;
const klB=klBelow.getContext('2d'), klA=klAbove.getContext('2d');
klB.imageSmoothingEnabled=false; klA.imageSmoothingEnabled=false;

const klground=new Uint8Array(MAPW*MAPH);
const kgi=(x,y)=>y*MAPW+x;
function kfill(code,x0,y0,x1,y1){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) if(x>=0&&y>=0&&x<MAPW&&y<MAPH) klground[kgi(x,y)]=code; }

const klSolids=[]; export const klInters=[], klDoors=[]; const klGlows=[];
function kSolid(x,y,w,h){ klSolids.push({x,y,w,h}); }
function kInter(x,y,w,h,who,lines){ klInters.push({x,y,w,h,who,lines}); }

const klEntry={x:31*TILE, y:13*TILE};
let klReturn={x:2*TILE, y:14*TILE, dir:'right'};
const SPRUNG={ sx:13*TILE, sy:21*TILE, wx:13*TILE, wy:16*TILE };

// tile codes: 0 grass · 4 water · 6 dirt · 7 tallgrass · 8 bridge
function klTile(x,y,code){
  const X0=x*TILE,Y0=y*TILE;
  if(code===0||code===7){
    klB.fillStyle=C.grassBase; klB.fillRect(X0,Y0,TILE,TILE);
    for(let i=0;i<10;i++){ const xx=hash(i,x*7+y)*TILE|0, yy=hash(i+9,x+y*5)*TILE|0, r=hash(i+3,x*y+1);
      klB.fillStyle = r<.5?C.grassHi:C.grassLo; klB.fillRect(X0+xx,Y0+yy,1, r<.4?2:1); }
    if(code===7){ for(let i=0;i<9;i++){ const gx=X0+(hash(i,x+3)*14|0), gy=Y0+4+(hash(i+4,y+2)*8|0);
      klB.fillStyle = hash(i,x+y)<.4?C.tgrassHi:C.tgrass; klB.fillRect(gx,gy,1,3+(hash(i,x)*2|0)); } }
  } else if(code===6){
    klB.fillStyle='#b89b6a'; klB.fillRect(X0,Y0,TILE,TILE);
    for(let i=0;i<6;i++){ klB.fillStyle=hash(i,x+y)<.5?'#c7ac7c':'#a98c5e'; klB.fillRect(X0+(hash(i,x)*TILE|0),Y0+(hash(i+2,y)*TILE|0),2,2); }
  } else if(code===4){
    klB.fillStyle=C.water; klB.fillRect(X0,Y0,TILE,TILE);
    for(let i=0;i<6;i++){ const wy=Y0+2+i*2+((x+(i&1))%2); klB.fillStyle=hash(x,y*9+i)<.5?C.waterHi:C.waterLo; klB.fillRect(X0+1+((i*3)%TILE),wy,5,1); }
  } else if(code===8){
    klB.fillStyle='#8a7250'; klB.fillRect(X0,Y0,TILE,TILE);
    for(let yy=0;yy<TILE;yy+=4){ klB.fillStyle='#6f5a3e'; klB.fillRect(X0,Y0+yy,TILE,1); }
    for(let i=0;i<5;i++){ klB.fillStyle=hash(i,x+y)<.5?'#9a815b':'#7c6547'; klB.fillRect(X0+(hash(i,x)*TILE|0),Y0+(hash(i+2,y)*(TILE-2)|0),2,1); }
  }
}
function paintKLGround(){
  for(let i=0;i<klground.length;i++) klground[i]=0;
  kfill(4, 6,5, 27,20);          // See
  kfill(6, 0,12, 33,13);         // Ost-West-Weg
  kfill(8, 6,12, 27,13);         // Steinbrücke über den See
  kfill(7, 2,6, 5,10); kfill(7, 2,16, 5,19);   // Ufer-Wiesen West
  kfill(7, 28,6, 31,10); kfill(7, 28,16, 31,19); // Ufer-Wiesen Ost
  kfill(0, 12,21, 15,23);        // Sprungbaum-Ufer (Süd)
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++) klTile(x,y,klground[kgi(x,y)]);
  // Wasser-Ufer + Solids
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++){ if(klground[kgi(x,y)]===4){
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(d=>{ const nx=x+d[0],ny=y+d[1];
      if(nx>=0&&ny>=0&&nx<MAPW&&ny<MAPH && klground[kgi(nx,ny)]!==4){ klB.fillStyle=C.waterEdge;
        klB.fillRect(x*TILE+(d[0]>0?TILE-2:0),y*TILE+(d[1]>0?TILE-2:0), d[0]?2:TILE, d[1]?2:TILE);} });
  }}
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++) if(klground[kgi(x,y)]===4) kSolid(x*TILE,y*TILE,TILE,TILE);
}

function klTree(tx,ty){ const x=tx*TILE+8,y=ty*TILE;
  px(klB,x-1,y+10,3,8,'#4a3522'); canopy(klA, x, y+2, 13, 11, LEAF_LINDEN, (tx*7+ty)|0); kSolid(x-2,y+14,6,5); }
function klLamp(tx,ty){ const x=tx*TILE+8,y=ty*TILE;
  px(klB,x,y+2,2,14,'#2a2a30'); px(klA,x-3,y,8,4,'#3a3a42'); px(klA,x-2,y+1,6,2,'#ffcf7a'); klGlows.push({x:x+1,y:y+3,r:15}); }
function klReed(x,y){ for(let i=0;i<5;i++){ const rx=x+(hash(i,x)*8|0), rh=6+(hash(i,y)*6|0);
  px(klA,rx,y-rh,1,rh, hash(i,x+y)<.5?'#5f8c3c':'#3f6a30'); px(klA,rx,y-rh-2,1,2,'#c9b06a'); } }
function klLily(x,y){ px(klB,x,y,5,3,'#3c6e3a'); px(klB,x+1,y-1,3,1,'#4f8a44'); px(klB,x+2,y+1,1,1,'#e7a6bd'); }
function klBoat(tx,ty){ const x=tx*TILE,y=ty*TILE;
  px(klB,x,y+3,26,7,'#6a4a2e'); px(klB,x+1,y+2,24,2,'#835c39'); px(klB,x+2,y+5,22,3,'#4a3320');
  px(klB,x+11,y-2,2,6,'#5a3f26'); }
function klDivePlank(){ // Sprungbrett am Sprungbaum-Ufer
  const x=13*TILE, y=20*TILE;
  px(klA,x+4,y+2,8,20,'#7a6142'); px(klA,x+4,y+2,8,2,'#8f724d'); px(klA,x+5,y+18,6,3,'#5c4930');
  px(klA,x+3,y+20,10,2,'#4a3a24'); }

export function buildKL(){
  paintKLGround();
  // Wald-Rand ringsum (Ost-Lücke y12/13 = Ein-/Ausgang)
  for(let x=0;x<MAPW;x++){ klTree(x,0); if(x%2===0) klTree(x,1); klTree(x,MAPH-1); }
  for(let y=2;y<MAPH-1;y++){ klTree(0,y); if(!(y===12||y===13)) klTree(MAPW-1,y); }
  // Uferbäume
  klTree(4,4); klTree(29,4); klTree(4,22); klTree(30,22); klTree(11,21);
  // Sprungbaum (interaktiv)
  const stx=13, sty=20; px(klB,stx*TILE+7,sty*TILE+8,3,9,'#4a3522');
  canopy(klA, stx*TILE+8, sty*TILE, 14, 12, LEAF_OAK, 77); kSolid(stx*TILE+5,sty*TILE+12,7,5);
  klDivePlank();
  kInter(11*TILE,20*TILE,5*TILE,3*TILE,'Sprungbaum',null);
  // Deko: Boot, Schilf, Seerosen
  klBoat(8,7); klReed(6*TILE,6*TILE); klReed(26*TILE,7*TILE); klReed(7*TILE,18*TILE); klReed(27*TILE,18*TILE);
  klLily(15*TILE,8*TILE); klLily(20*TILE,10*TILE); klLily(11*TILE,17*TILE); klLily(22*TILE,18*TILE); klLily(18*TILE,7*TILE);
  // Brücken-Laternen
  klLamp(7,11); klLamp(26,11);
  // Schilder + Rückweg
  klDoors.push({x:32*TILE,y:12*TILE,w:2*TILE,h:2*TILE,to:'town'});
  kInter(31*TILE,12*TILE,2*TILE,2*TILE,'→ Zehlendorf',['Zurueck nach Osten, rauf nach Zehlendorf Mitte.']);
  kInter(2*TILE,22*TILE,3*TILE,2*TILE,'Schild',['»Frischluft statt Feinstaub«. Jemand hat ein Herz danebengemalt.']);
  kInter(28*TILE,22*TILE,3*TILE,2*TILE,'Schild',['»Grillen verboten«. Der Ascheklecks daneben sagt: wird trotzdem gemacht.']);
}

export function blockedKL(nx,ny){ const fx=nx+4,fy=ny+15,fw=8,fh=6;
  if(fx<TILE||fy<TILE||fx+fw>WPX-TILE||fy+fh>HPX-TILE) return true;
  for(const s of klSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}
let kllastTile=-1;
export function checkEncounterKL(){
  const tx=(player.x+8)/TILE|0, ty=(player.y+16)/TILE|0;
  const t=klground[kgi(clamp(tx,0,MAPW-1),clamp(ty,0,MAPH-1))];
  if(t===7){ const id=ty*MAPW+tx;
    if(id!==kllastTile && encCool<=0){ kllastTile=id;
      if(Math.random()<0.22){ const w=rollWild('kl'); setGrassFlash(0.5); startBattle(w.id,w.lv,'kl'); } } }
  else kllastTile=-1;
}

// --- Sprungbaum: Jump ins Wasser ---
export let klJump=null;
export function startKLJump(){
  player.x=SPRUNG.sx; player.y=SPRUNG.sy; player.dir='up'; player.frame=1;
  klJump={ t:0, phase:'air', dy:0 };
  toast('Absprung!',900);
}
export function updateKLJump(dt){
  const J=klJump; J.t+=dt;
  if(J.phase==='air'){ const k=clamp(J.t/0.55,0,1);
    player.x=lerp(SPRUNG.sx,SPRUNG.wx,k); player.y=lerp(SPRUNG.sy,SPRUNG.wy,k); J.dy=Math.sin(k*Math.PI)*24; player.frame=1;
    if(k>=1){ J.phase='splash'; J.t=0; J.dy=0; toast('Platsch! Kalt. Erfrischend. Enten unbeeindruckt.',1500); } }
  else if(J.phase==='splash'){ player.frame=0; if(J.t>=0.7){ J.phase='back'; J.t=0; player.dir='down'; } }
  else if(J.phase==='back'){ const k=clamp(J.t/0.5,0,1);
    player.x=lerp(SPRUNG.wx,SPRUNG.sx,k); player.y=lerp(SPRUNG.wy,SPRUNG.sy,k); J.dy=Math.sin(k*Math.PI)*10;
    if(k>=1){ player.x=SPRUNG.sx; player.y=SPRUNG.sy; player.dir='down'; player.frame=0; klJump=null; } }
}

export function renderKL(){
  X.clearRect(0,0,LW,LH);
  X.drawImage(klBelow, klcamx,klcamy,LW,LH, 0,0,LW,LH);
  // Splash-Ringe im Wasser
  if(klJump && klJump.phase==='splash'){ const sx=SPRUNG.wx+8-klcamx, sy=SPRUNG.wy+18-klcamy;
    X.strokeStyle='rgba(220,240,255,0.7)'; X.lineWidth=1;
    for(let r=1;r<=3;r++){ const rr=4+r*4+klJump.t*14; X.beginPath(); X.ellipse(sx,sy,rr,rr*0.5,0,0,7); X.stroke(); } }
  const jdy=klJump?klJump.dy:0;
  const ents=[];
  ents.push({y:player.y+22,draw:()=>drawChar(X,(player.x-klcamx)|0,(player.y-klcamy-jdy)|0,player.dir,player.frame,PAL_PLAYER)});
  ents.sort((a,b)=>a.y-b.y); for(const e of ents) e.draw();
  X.drawImage(klAbove, klcamx,klcamy,LW,LH, 0,0,LW,LH);
  if(grassFlash>0){ X.fillStyle='rgba(120,200,90,'+(grassFlash*0.5)+')'; X.fillRect(0,0,LW,LH); }
  drawLightKL();
}
function drawLightKL(){
  Lx.clearRect(0,0,LW,LH);
  Lx.fillStyle='rgba(24,30,44,0.10)'; Lx.fillRect(0,0,LW,LH);
  let v=Lx.createRadialGradient(LW/2,LH/2,70,LW/2,LH/2,215); v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(6,8,16,0.46)');
  Lx.fillStyle=v; Lx.fillRect(0,0,LW,LH);
  Lx.globalCompositeOperation='lighter';
  const fl=reduce?1:0.85+0.15*Math.sin(T*3);
  for(const g of klGlows){ const sx=g.x-klcamx, sy=g.y-klcamy; if(sx<-30||sx>LW+30||sy<-30||sy>LH+30) continue;
    const rg=Lx.createRadialGradient(sx,sy,0,sx,sy,g.r); rg.addColorStop(0,'rgba(255,200,120,'+(0.40*fl)+')'); rg.addColorStop(1,'rgba(255,200,120,0)');
    Lx.fillStyle=rg; Lx.fillRect(sx-g.r,sy-g.r,g.r*2,g.r*2); }
  Lx.globalCompositeOperation='source-over';
  X.drawImage(lightCv,0,0);
}
export function enterKL(){
  G.scene='kl'; clearSitting(); klJump=null; player.x=klEntry.x; player.y=klEntry.y; player.dir='left'; player.frame=0; setEnterCool(0.5);
  setKlCam(clamp(player.x+8-LW/2,0,WPX-LW), clamp(player.y+16-LH/2,0,HPX-LH));
  setBanner('Krumme Lanke','Zehlendorf, Berlin'); showBanner(); toast('Neue Karte: Krumme Lanke',2600);
}
export function exitKL(){
  G.scene='town'; clearSitting(); player.x=klReturn.x; player.y=klReturn.y; player.dir=klReturn.dir; player.frame=0; setEnterCool(0.5);
  setBanner('Zehlendorf Mitte','Bezirk'); showBanner();
}
