import { LW, LH, TILE, X, C, reduce } from '../core/constants.js';
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
import { addAkhTaler } from '../main.js';
import { PAL_STUD1, PAL_STUD2, PAL_GIRL } from './chb.js';
import { PAL_HIP, PAL_CLUB1, PAL_CLUB2, MITPX, MITHPX } from './mitte.js';
import {
  T, lightCv, Lx, encCool, clearSitting, grassFlash, setGrassFlash,
  fhxbcamx, fhxbcamy, setFhxbCam, setMitCam, setEnterCool,
} from '../main.js';

/* ======================================================================
   FRIEDRICHSHAIN-KREUZBERG — der naechste grosse Schritt. Warehouse-Clubs,
   Spree-Bucht, Kies und Beton. Vier Club-Fassaden stehen als Platzhalter
   (KitKat, Berghain, Lokschuppen, about blank) — Interieurs + echte Sprites
   kommen Stueck fuer Stueck. Ausserdem: Ayahuasca Anja (fightable Trainer,
   Sprite folgt) und eine seltene, periodische Schiesserei-Ambient-Szene.
   ====================================================================== */
export const FXW=70, FXH=54, FXPX=FXW*TILE, FXHPX=FXH*TILE;
const fxBelow=document.createElement('canvas'); fxBelow.width=FXPX; fxBelow.height=FXHPX;
const fxAbove=document.createElement('canvas'); fxAbove.width=FXPX; fxAbove.height=FXHPX;
const fxB=fxBelow.getContext('2d'), fxA=fxAbove.getContext('2d'); fxB.imageSmoothingEnabled=false; fxA.imageSmoothingEnabled=false;
const fground=new Uint8Array(FXW*FXH); const fgi=(x,y)=>y*FXW+x;
function ffill(code,x0,y0,x1,y1){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) if(x>=0&&y>=0&&x<FXW&&y<FXH) fground[fgi(x,y)]=code; }
export const fxInters=[], fxDoors=[], fxNpcs=[]; const fxSolids=[], fxGlows=[];
function fxSolid(x,y,w,h){ fxSolids.push({x,y,w,h}); }
function fxInter(x,y,w,h,who,lines){ fxInters.push({x,y,w,h,who,lines}); }
const fxEntry={x:2*TILE, y:27*TILE};
let fxReturn={x:1050, y:26*TILE, dir:'left'};   // Position in Mitte (Ost-Tor)

// tiles: 0 gras · 2 gehweg · 3 asphalt · 4 spree · 5 platz(beton) · 7 hohes gras · 8 kies/industrie
function fxTile(x,y,code){ const X0=x*TILE,Y0=y*TILE;
  if(code===0||code===7){ fxB.fillStyle=C.grassBase; fxB.fillRect(X0,Y0,TILE,TILE);
    for(let i=0;i<9;i++){ const xx=hash(i,x*7+y)*TILE|0, yy=hash(i+9,x+y*5)*TILE|0, r=hash(i+3,x*y+1); fxB.fillStyle=r<.5?C.grassHi:C.grassLo; fxB.fillRect(X0+xx,Y0+yy,1,r<.4?2:1); }
    if(code===7){ for(let i=0;i<8;i++){ const gx=X0+(hash(i,x+3)*14|0), gy=Y0+4+(hash(i+4,y+2)*8|0); fxB.fillStyle=hash(i,x+y)<.4?C.tgrassHi:C.tgrass; fxB.fillRect(gx,gy,1,3+(hash(i,x)*2|0)); } }
  } else if(code===2){ fxB.fillStyle='#6a6258'; fxB.fillRect(X0,Y0,TILE,TILE);
    for(let yy=0;yy<TILE;yy+=4)for(let xx=0;xx<TILE;xx+=4){ fxB.fillStyle=hash(xx+yy,x+y)<.5?'#746c60':'#5e574e'; fxB.fillRect(X0+xx,Y0+yy,3,3); }
  } else if(code===3){ fxB.fillStyle='#343438'; fxB.fillRect(X0,Y0,TILE,TILE);
    for(let i=0;i<6;i++){ fxB.fillStyle=hash(i,x+y)<.5?'#2e2e32':'#3c3c42'; fxB.fillRect(X0+(hash(i,x)*TILE|0),Y0+(hash(i+2,y)*TILE|0),2,1); }
  } else if(code===4){ fxB.fillStyle=C.water; fxB.fillRect(X0,Y0,TILE,TILE);
    for(let i=0;i<6;i++){ const wy=Y0+2+i*2+((x+(i&1))%2); fxB.fillStyle=hash(x,y*9+i)<.5?C.waterHi:C.waterLo; fxB.fillRect(X0+1+((i*3)%TILE),wy,5,1); }
  } else if(code===5){ fxB.fillStyle='#7a7c80'; fxB.fillRect(X0,Y0,TILE,TILE);
    fxB.fillStyle='#6a6c70'; fxB.fillRect(X0,Y0,TILE,1); fxB.fillRect(X0,Y0,1,TILE);
    for(let i=0;i<4;i++){ fxB.fillStyle=hash(i,x+y)<.5?'#84868a':'#6e7074'; fxB.fillRect(X0+(hash(i,x)*TILE|0),Y0+(hash(i+1,y)*TILE|0),2,2); }
  } else if(code===8){ fxB.fillStyle='#5e564a'; fxB.fillRect(X0,Y0,TILE,TILE);
    for(let i=0;i<16;i++){ const gx=X0+(hash(i,x*5+y)*TILE|0), gy=Y0+(hash(i+7,x+y*3)*TILE|0), r=hash(i+2,x*y+1);
      fxB.fillStyle = r<.33?'#726858':(r<.66?'#494336':'#847a6a'); fxB.fillRect(gx,gy,1+(r<.18?1:0),1); }
  }
}
function paintFhxbGround(){
  for(let i=0;i<fground.length;i++) fground[i]=0;
  // Haupt-Boulevard (West-Ost) — Anschluss ans Mitte-Tor
  ffill(3, 0,26, FXW-1,27);
  // Nebenstrassen
  ffill(3, 10,10, 11,44); ffill(3, 30,6, 31,44); ffill(3, 50,10, 51,44); ffill(3, 60,16, 61,44);
  ffill(3, 10,16, 60,17); ffill(3, 10,34, 60,35);
  // Berghain-Platz (Beton)
  ffill(5, 26,4, 44,16);
  // Lokschuppen-Areal (Gleisschotter)
  ffill(8, 48,28, 66,42);
  // Spree — Sued-Band + Ost-Bucht
  ffill(4, 0,FXH-6, FXW-1,FXH-3); ffill(2, 0,FXH-7, FXW-1,FXH-7);
  ffill(4, FXW-9,6, FXW-6,FXH-6);
  // Parks / hohes Gras (Encounter-Zonen)
  ffill(7, 2,4, 9,12); ffill(7, 14,30, 24,36); ffill(7, 36,30, 46,36); ffill(7, 4,38, 12,45);
  // Gehwege automatisch an Strassen (Snapshot -> kein Cascade)
  const snap=fground.slice();
  for(let y=0;y<FXH;y++)for(let x=0;x<FXW;x++){ if(snap[fgi(x,y)]!==0) continue;
    let near=false; [[1,0],[-1,0],[0,1],[0,-1]].forEach(d=>{ const nx=x+d[0],ny=y+d[1]; if(nx>=0&&ny>=0&&nx<FXW&&ny<FXH && snap[fgi(nx,ny)]===3) near=true; });
    if(near) fground[fgi(x,y)]=2;
  }
  for(let y=0;y<FXH;y++)for(let x=0;x<FXW;x++) fxTile(x,y,fground[fgi(x,y)]);
  // Wasser-Ufer + Solids
  for(let y=0;y<FXH;y++)for(let x=0;x<FXW;x++){ if(fground[fgi(x,y)]===4){
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(d=>{ const nx=x+d[0],ny=y+d[1]; if(nx>=0&&ny>=0&&nx<FXW&&ny<FXH && fground[fgi(nx,ny)]!==4){ fxB.fillStyle=C.waterEdge; fxB.fillRect(x*TILE+(d[0]>0?TILE-2:0),y*TILE+(d[1]>0?TILE-2:0), d[0]?2:TILE, d[1]?2:TILE);} });
  }}
  for(let y=0;y<FXH;y++)for(let x=0;x<FXW;x++) if(fground[fgi(x,y)]===4) fxSolid(x*TILE,y*TILE,TILE,TILE);
}

function fxTree(tx,ty){ const x=tx*TILE+8,y=ty*TILE; px(fxB,x-1,y+10,3,9,'#4a3522'); canopy(fxA, x, y+2, 13, 11, LEAF_LINDEN, (tx*7+ty)|0); fxSolid(x-3,y+13,7,5); }
function fxBigTree(tx,ty){ const x=tx*TILE+8,y=ty*TILE;
  px(fxB,x-2,y+10,5,13,'#4a3522'); canopy(fxA, x, y-5, 17, 14, LEAF_OAK, (tx*13+ty)|0); fxSolid(x-4,y+15,9,6); }
function fxLamp(tx,ty){ const x=tx*TILE+8,y=ty*TILE; px(fxB,x,y+2,2,15,'#2a2a30'); px(fxA,x-3,y,8,4,'#3a3a42'); px(fxA,x-2,y+1,6,2,'#ffcf7a'); fxGlows.push({x:x+1,y:y+3,r:16}); }
function fxBench(tx,ty){ const x=tx*TILE,y=ty*TILE+9; shadow(fxB,x+1,y+5,14,3); px(fxB,x,y,15,3,'#7a5a38'); px(fxB,x,y+3,15,4,'#6a4a2e'); px(fxB,x+1,y+7,2,4,'#4a3320'); px(fxB,x+12,y+7,2,4,'#4a3320'); fxSolid(x+1,y+3,14,5); }

// Generische Club-Fassade — Platzhalter bis echte Sprites/Interieurs kommen.
function fxClub(tx,ty,w,h,name,wallCol,tagCol,lines){
  const x=tx*TILE, y=ty*TILE, W=w*TILE, H=h*TILE;
  shadow(fxB,x+6,y+H-2,W-12,8);
  fxB.fillStyle=wallCol; fxB.fillRect(x,y,W,H);
  for(let yy=6;yy<H;yy+=6){ fxB.fillStyle='rgba(0,0,0,0.14)'; fxB.fillRect(x,y+yy,W,1); }
  for(let i=0;i<Math.floor(W*H/85);i++){ const gx=x+(hash(i,3+tx)*W|0), gy=y+(hash(i+7,7+ty)*H|0);
    fxB.fillStyle=hash(i,9)<.5?tagCol:'#161410'; fxB.fillRect(gx,gy,2,hash(i,2)<.5?2:3); }
  // Flachdach
  px(fxB,x-3,y-5,W+6,7,'#5a5c60'); for(let xx=0;xx<W+6;xx+=3) px(fxB,x-3+xx,y-5,1,7,'#43454a'); px(fxB,x-3,y-6,W+6,1,'#26262c');
  // Name-Schild (mittig)
  fxB.save(); fxB.font='bold 13px Georgia'; fxB.textAlign='center'; fxB.textBaseline='middle';
  fxB.fillStyle='#0c0a08'; fxB.fillText(name, x+W/2+1, y+H/2+1);
  fxB.fillStyle=tagCol; fxB.fillText(name, x+W/2, y+H/2);
  fxB.restore(); fxB.textAlign='left'; fxB.textBaseline='alphabetic';
  // Zugenagelter Platzhalter-Eingang (noch kein begehbares Interieur)
  const dx=x+W/2-8, dy=y+H-14;
  px(fxB,dx,dy,16,14,'#1c1410'); px(fxB,dx+2,dy+2,12,10,'#2a1e16'); px(fxB,dx+2,dy+2,12,2,'#3a2a1e');
  fxSolid(x,y,W,H);
  fxInter(x-6, y+H-6, W+12, 12, name, lines);
}

// ---------- Ayahuasca Anja — fightable Trainer (Sprite folgt) ----------
const PAL_ANJA={coat:'#5a6a3a',coatHi:'#748a4c',coatLo:'#465229',pants:'#8a6a3a',shoe:'#3a2a1a',skin:'#d8a878',hair:'#241a10',curly:true};
const ANJA_TEAM=[ {id:'mephe',level:30}, {id:'squirrel2',level:33}, {id:'koka',level:36} ];
let anjaDefeated=false;
export function talkAnja(){
  const n=fxNpcs.find(x=>x.who==='Ayahuasca Anja');
  if(anjaDefeated){ openDialog(n.who,['Sie laechelt in sich hinein. »Der Trip war real, wa? Komm wieder wenn du bereit fuer den naechsten bist.«']); return; }
  openDialog(n.who, n.lines, ()=>{
    startBattle(ANJA_TEAM[0].id, ANJA_TEAM[0].level, 'fhxb', 'trainer',
      {team:ANJA_TEAM, trainerName:'Ayahuasca Anja', onWin:anjaWin});
  });
}
function anjaWin(){ anjaDefeated=true; addAkhTaler(20); toast('Ayahuasca Anja nickt dir zu. +20 Akh-Taler fuer den Trip.',2600); }

// ---------- Seltene Schiesserei (Ambient-Event, alle ~5 Minuten) ----------
function fxRollShootoutWait(){ return 180+Math.random()*240; }   // 3–7 Min, Schnitt ~5 Min
let fxShootoutT=fxRollShootoutWait();
let fxShootoutActive=0;
const SHOOT_X=54*TILE, SHOOT_Y=26*TILE;
export function updateFhxbEvents(dt){
  if(fxShootoutActive>0){ fxShootoutActive-=dt; if(fxShootoutActive<=0) toast('Sirenen in der Ferne. Die Luft ist wieder rein.',2600); return; }
  fxShootoutT-=dt;
  if(fxShootoutT<=0){ fxShootoutT=fxRollShootoutWait(); fxShootoutActive=3.4;
    toast('💥 Schüsse! Irgendwer klaert gerade eine Meinungsverschiedenheit...',3200); }
}

export function buildFhxb(){
  paintFhxbGround();
  fxTree(6,8); fxTree(20,32); fxTree(46,32); fxBigTree(8,40); fxBigTree(58,10);
  fxLamp(12,26); fxLamp(30,26); fxLamp(50,26); fxLamp(20,12); fxLamp(40,42);
  fxBench(16,32); fxBench(38,32); fxBench(6,42);
  // --- Vier Club-Fassaden (Platzhalter) ---
  fxClub(28,5,16,10,'BERGHAIN','#4a4c50','#c8c8d0',
    ['Berghain. Ehemaliges Heizkraftwerk, jetzt Mythos aus Beton und Bass.',
     'Die Schlange ist jetzt schon laenger als die ganze Karte.',
     '(Platzhalter — Innenbereich + echte Sprites kommen bald.)']);
  fxClub(4,18,8,7,'KITKAT CLUB','#6e0e2a','#ff5aa0',
    ['KitKat Club. Von aussen eine unscheinbare Tuer, drinnen nur Geruechte.',
     'Das Tuersteher-Casting ist strenger als jede Pruefungsordnung.',
     '(Platzhalter.)']);
  fxClub(50,30,13,8,'LOKSCHUPPEN','#5a4a34','#e0a83a',
    ['Lokschuppen. Altes Gleisgelaende, Rost und Bassreflexe.',
     'Riecht nach Motoroel, Sommerregen und billigem Sekt.',
     '(Platzhalter.)']);
  fxClub(40,39,8,6,'about blank','#3a5a3a','#cfead0',
    ['about blank. Garten, Bar, Boombox-Ecke — tagsueber fast idyllisch.',
     'Der Name steht klein, die Reputation gross.',
     '(Platzhalter.)']);
  // Ausgang zurueck nach Mitte (West)
  fxDoors.push({x:0,y:26*TILE,w:24,h:2*TILE,to:'mitte'});
  fxInter(1*TILE,25*TILE,2*TILE,2*TILE,'→ Mitte',['Zurueck Richtung Westen, rein nach Mitte.']);
  // Ayahuasca Anja — am Rand des Parks, Sprite folgt spaeter
  fxNpcs.push({x:18*TILE,y:33*TILE,dir:'down',pal:PAL_ANJA,who:'Ayahuasca Anja',frame:0,
    lines:['Eine Frau sitzt im Schneidersitz im hohen Gras, Raeucherstaebchen zwischen den Fingern.',
      '»Du suchst einen Kampf? Ich zeig dir lieber eine andere Realitaet. Kommt aufs Selbe raus.«',
      '»Na los. Trink nix, aber lass uns trotzdem reisen.«']});
  // Schiesserei-Akteure (immer sichtbar, Vignette nur waehrend fxShootoutActive)
  fxNpcs.push({x:SHOOT_X,y:SHOOT_Y,dir:'right',pal:PAL_CLUB1,who:'Ganove',shooter:true,frame:0,
    lines:['Er mustert dich kurz, dann schaut er wieder weg. »Alles cool hier. Alles safe.«']});
  fxNpcs.push({x:SHOOT_X+18,y:SHOOT_Y,dir:'left',pal:PAL_CLUB2,who:'Ganove',shooter:true,frame:0,
    lines:['»Wat guckst du.« Mehr sagt er nicht.']});
  // Berghain-Schlange
  fxNpcs.push(
    {x:24*TILE,y:16*TILE+4,dir:'up',pal:PAL_CLUB1,who:'Schlange',frame:0,lines:['Steh hier seit drei Stunden. Bewegt sich nicht.','Kein Handy, kein Foto, kein Lachen. Verstanden.']},
    {x:26*TILE+4,y:16*TILE+2,dir:'up',pal:PAL_CLUB2,who:'Schlange',frame:0,lines:['Schwarz getragen, Blick gesenkt, Hoffnung niedrig.','Zweites Mal hier. Erstes Mal kam ich nicht rein.']},
    {x:28*TILE+8,y:16*TILE+4,dir:'up',pal:PAL_HIP,who:'Schlange',frame:0,lines:['Ich hab meinen Ausweis dreimal gecheckt.','Sag nix ueber die Musik. Fuehl sie einfach.']}
  );
  // Studenten/Hipster — Ambiente entlang Spree & Parks
  fxNpcs.push(
    {x:8*TILE,y:8*TILE,dir:'down',pal:PAL_STUD1,who:'Student',wander:true,base:8*TILE,range:20,t:0,frame:0,lines:['Hausarbeit ist fast fertig. Fast.','Kreuzberg macht produktiv. Irgendwie.']},
    {x:6*TILE,y:44*TILE,dir:'right',pal:PAL_STUD2,who:'Studentin',wander:true,base:6*TILE,range:16,t:0.8,frame:0,lines:['Spree-Ufer, Bier, Sonnenuntergang. Mehr brauch ich nicht.','Frag mich nicht nach meinem Nebenjob.']},
    {x:18*TILE,y:38*TILE,dir:'left',pal:PAL_HIP,who:'Hipster',play:true,t:0.4,frame:0,lines:['Mein Fixie hat kein einziges Gang. Absichtlich.','Ich hab den Laden entdeckt bevor er cool war.']},
    {x:40*TILE,y:34*TILE,dir:'down',pal:PAL_STUD1,who:'Hipster',play:true,t:1.2,frame:0,lines:['Analog-Kamera, Kaffee to go, drei Piercings.','Bin nur auf nem Zwischenstopp zwischen zwei Vernissagen.']},
    {x:44*TILE,y:34*TILE,dir:'up',pal:PAL_GIRL,who:'Studentin',play:true,t:2.0,frame:0,lines:['Bafoeg reicht bis zum 12., heut ist der 3.','Egal. Der Sonnenuntergang ist gratis.']},
    {x:14*TILE,y:12*TILE,dir:'right',pal:PAL_STUD2,who:'Student',wander:true,base:14*TILE,range:14,t:1.6,frame:0,lines:['Ich zieh nach Kreuzberg, sobald ich mir Kreuzberg leisten kann.','Ironisch, oder?']},
    {x:56*TILE,y:22*TILE,dir:'left',pal:PAL_HIP,who:'Hipster',wander:true,base:56*TILE,range:18,t:0.3,frame:0,lines:['Vintage-Klamotten, neue Aeltere-Bruder-Energie.','Lokschuppen? Da war ich schon vor deiner Geburt. Gefuehlt.']},
    {x:34*TILE,y:44*TILE,dir:'down',pal:PAL_STUD1,who:'Student',play:true,t:0.9,frame:0,lines:['Spree-Schwimmen ist illegal. Macht’s attraktiver.','Frag nicht, wies schmeckt.']}
  );
}
export function blockedFhxb(nx,ny){ const fx=nx+4,fy=ny+15,fw=8,fh=6;
  if(fx<TILE||fy<TILE||fx+fw>FXPX-TILE||fy+fh>FXHPX-TILE) return true;
  for(const s of fxSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}
let fxLastTile=-1;
export function checkEncounterFhxb(){
  const tx=(player.x+8)/TILE|0, ty=(player.y+16)/TILE|0;
  const t=fground[fgi(clamp(tx,0,FXW-1),clamp(ty,0,FXH-1))];
  if(t===7){ const id=ty*FXW+tx;
    if(id!==fxLastTile && encCool<=0){ fxLastTile=id; if(Math.random()<0.24){ const w=rollWild('fhxb'); setGrassFlash(0.5); startBattle(w.id,w.lv,'fhxb'); } } }
  else fxLastTile=-1;
}
export function renderFhxb(){
  X.clearRect(0,0,LW,LH);
  X.drawImage(fxBelow, fhxbcamx,fhxbcamy,LW,LH, 0,0,LW,LH);
  const ents=[];
  ents.push({y:player.y+22,draw:()=>drawChar(X,(player.x-fhxbcamx)|0,(player.y-fhxbcamy)|0,player.dir,player.frame,PAL_PLAYER)});
  for(const n of fxNpcs) ents.push({y:n.y+22,draw:()=>drawChar(X,(n.x-fhxbcamx)|0,(n.y-fhxbcamy)|0,n.dir,n.frame||0,n.pal)});
  ents.sort((a,b)=>a.y-b.y); for(const e of ents) e.draw();
  X.drawImage(fxAbove, fhxbcamx,fhxbcamy,LW,LH, 0,0,LW,LH);
  if(grassFlash>0){ X.fillStyle='rgba(120,200,90,'+(grassFlash*0.5)+')'; X.fillRect(0,0,LW,LH); }
  if(fxShootoutActive>0) drawShootoutFx();
  drawLightFhxb();
}
function drawShootoutFx(){
  const a=clamp(fxShootoutActive/3.4,0,1);
  X.fillStyle='rgba(200,30,20,'+(0.14*a)+')'; X.fillRect(0,0,LW,LH);
  const sx=SHOOT_X-fhxbcamx, sy=SHOOT_Y-fhxbcamy;
  for(let i=0;i<6;i++){ const ang=Math.random()*6.28, r=2+Math.random()*10;
    X.fillStyle='rgba(255,214,110,'+(0.6+0.4*Math.random())+')';
    X.fillRect((sx+Math.cos(ang)*r+8)|0,(sy+Math.sin(ang)*r+8)|0,2,2); }
}
function drawLightFhxb(){
  Lx.clearRect(0,0,LW,LH);
  Lx.fillStyle='rgba(20,18,26,0.10)'; Lx.fillRect(0,0,LW,LH);
  let v=Lx.createRadialGradient(LW/2,LH/2,66,LW/2,LH/2,216); v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(8,8,12,0.42)');
  Lx.fillStyle=v; Lx.fillRect(0,0,LW,LH);
  Lx.globalCompositeOperation='lighter';
  const fl=reduce?1:0.85+0.15*Math.sin(T*3);
  for(const g of fxGlows){ const sx=g.x-fhxbcamx, sy=g.y-fhxbcamy; if(sx<-30||sx>LW+30||sy<-30||sy>LH+30) continue;
    const rg=Lx.createRadialGradient(sx,sy,0,sx,sy,g.r); rg.addColorStop(0,'rgba(255,200,120,'+(0.4*fl)+')'); rg.addColorStop(1,'rgba(255,200,120,0)');
    Lx.fillStyle=rg; Lx.fillRect(sx-g.r,sy-g.r,g.r*2,g.r*2); }
  Lx.globalCompositeOperation='source-over';
  X.drawImage(lightCv,0,0);
}
export function enterFhxb(){
  G.scene='fhxb'; clearSitting(); player.x=fxEntry.x; player.y=fxEntry.y; player.dir='right'; player.frame=0; setEnterCool(0.5);
  setFhxbCam(clamp(player.x+8-LW/2,0,FXPX-LW), clamp(player.y+16-LH/2,0,FXHPX-LH));
  setBanner('Friedrichshain-Kreuzberg','Der naechste grosse Schritt'); showBanner();
  toast('Neue Karte: Friedrichshain-Kreuzberg. Vier Clubs warten — noch verschlossen.',3200);
}
export function exitFhxb(){
  G.scene='mitte'; clearSitting(); player.x=fxReturn.x; player.y=fxReturn.y; player.dir=fxReturn.dir; player.frame=0; setEnterCool(0.5);
  setMitCam(clamp(player.x+8-LW/2,0,MITPX-LW), clamp(player.y+16-LH/2,0,MITHPX-LH));
  setBanner('Mitte','High-Level-Bezirk'); showBanner();
}
