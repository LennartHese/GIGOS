import { LW, LH, TILE, WPX, HPX, X, C, reduce } from '../core/constants.js';
import { hash, clamp } from '../core/math.js';
import { LEAF_LINDEN, LEAF_OAK, canopy, px, shadow } from '../core/canvas.js';
import { G } from '../core/state.js';
import { player } from '../entities/player.js';
import { drawChar, PAL_PLAYER } from '../entities/drawChar.js';
import { setBanner, showBanner } from '../ui/banner.js';
import { toast } from '../ui/toast.js';
import { rollWild } from '../data/encounters.js';
import { startBattle } from '../systems/battle.js';
import { PAL_STUD1, PAL_STUD2 } from './chb.js';
import { drawUbahnSign, setStationReturn } from './ubahn.js';
import {
  T, lightCv, Lx, encCool, clearSitting, grassFlash, setGrassFlash,
  mitcamx, mitcamy, setMitCam, setCcam, setEnterCool, drunk, chatNPC,
} from '../main.js';

/* ======================================================================
   MITTE — erster High-Level-Bezirk (Ost-Ausgang aus Wilmersdorf)
   Doppelt grosse Karte. Fernsehturm, Alexanderplatz, verwinkelte Strassen,
   Cafes & Restaurants mit sitzenden NPCs, Spree-Promenade mit Mate.
   ====================================================================== */
export const MITW=68, MITH=52, MITPX=MITW*TILE, MITHPX=MITH*TILE;
const mitBelow=document.createElement('canvas'); mitBelow.width=MITPX; mitBelow.height=MITHPX;
const mitAbove=document.createElement('canvas'); mitAbove.width=MITPX; mitAbove.height=MITHPX;
const mitB=mitBelow.getContext('2d'), mitA=mitAbove.getContext('2d'); mitB.imageSmoothingEnabled=false; mitA.imageSmoothingEnabled=false;
const mground=new Uint8Array(MITW*MITH); const mgi=(x,y)=>y*MITW+x;
function mfill(code,x0,y0,x1,y1){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) if(x>=0&&y>=0&&x<MITW&&y<MITH) mground[mgi(x,y)]=code; }
export const mitSolids=[], mitInters=[], mitDoors=[], mitNpcs=[], mitGlows=[];
function mSolid(x,y,w,h){ mitSolids.push({x,y,w,h}); }
function mInter(x,y,w,h,who,lines){ mitInters.push({x,y,w,h,who,lines}); }
const mitEntry={x:2*TILE, y:30*TILE};
let mitReturn={x:31*TILE, y:17*TILE, dir:'left'};

export const PAL_WAITER={coat:'#2a2a2f',coatHi:'#3a3a42',coatLo:'#1e1e22',pants:'#20201f',shoe:'#141414',skin:'#e8c39a',hair:'#241a12'};
export const PAL_TOURIST={coat:'#c85a3a',coatHi:'#e2744f',coatLo:'#9e4630',pants:'#4a5a3a',shoe:'#2a2118',skin:'#f0d0a8',hair:'#8a6a3a'};
export const PAL_BUSKER={coat:'#5a3a7a',coatHi:'#744f9a',coatLo:'#463060',pants:'#2f2a3a',shoe:'#2a2118',skin:'#d8b48a',hair:'#2a1a10'};
export const PAL_HIP={coat:'#3a6a6a',coatHi:'#4f8a8a',coatLo:'#2c5252',pants:'#3a3328',shoe:'#2a2118',skin:'#e8c39a',hair:'#3a2a1a'};
export const PAL_CLUB1={coat:'#1e1e24',coatHi:'#30303a',coatLo:'#141418',pants:'#18181c',shoe:'#0e0e10',skin:'#e8c39a',hair:'#161210'};
export const PAL_CLUB2={coat:'#2a2028',coatHi:'#3c2e38',coatLo:'#1c1620',pants:'#201820',shoe:'#0e0e10',skin:'#d8b48a',hair:'#2a1a10'};
export const PAL_CLUB3={coat:'#20242a',coatHi:'#323840',coatLo:'#161a1e',pants:'#1a1c20',shoe:'#0e0e10',skin:'#f0d0a8',hair:'#3a2a1a',curly:true};
const TUER_SRC='assets/images/ui/tuer.png';
export const TUER_IMG=new Image(); TUER_IMG.src=TUER_SRC;
const OWNER_SRC='assets/images/ui/owner.png';
export const OWNER_IMG=new Image(); OWNER_IMG.src=OWNER_SRC;
const BARK_SRC='assets/images/ui/bark.png';
export const BARK_IMG=new Image(); BARK_IMG.src=BARK_SRC;
export const CLUB_LOADSCREEN='assets/images/club-loadscreen.jpg';

// tiles: 0 grass · 2 gehweg · 3 asphalt · 4 spree · 5 platz(granit) · 6 dirt · 7 hohes gras
function mitTile(x,y,code){ const X0=x*TILE,Y0=y*TILE;
  if(code===0||code===7){ mitB.fillStyle=C.grassBase; mitB.fillRect(X0,Y0,TILE,TILE);
    for(let i=0;i<9;i++){ const xx=hash(i,x*7+y)*TILE|0, yy=hash(i+9,x+y*5)*TILE|0, r=hash(i+3,x*y+1); mitB.fillStyle=r<.5?C.grassHi:C.grassLo; mitB.fillRect(X0+xx,Y0+yy,1,r<.4?2:1); }
    if(code===7){ for(let i=0;i<8;i++){ const gx=X0+(hash(i,x+3)*14|0), gy=Y0+4+(hash(i+4,y+2)*8|0); mitB.fillStyle=hash(i,x+y)<.4?C.tgrassHi:C.tgrass; mitB.fillRect(gx,gy,1,3+(hash(i,x)*2|0)); } }
  } else if(code===2){ mitB.fillStyle='#6a6258'; mitB.fillRect(X0,Y0,TILE,TILE);
    for(let yy=0;yy<TILE;yy+=4)for(let xx=0;xx<TILE;xx+=4){ mitB.fillStyle=hash(xx+yy,x+y)<.5?'#746c60':'#5e574e'; mitB.fillRect(X0+xx,Y0+yy,3,3); }
  } else if(code===3){ mitB.fillStyle='#3a3a40'; mitB.fillRect(X0,Y0,TILE,TILE);
    for(let i=0;i<6;i++){ mitB.fillStyle=hash(i,x+y)<.5?'#343438':'#42424a'; mitB.fillRect(X0+(hash(i,x)*TILE|0),Y0+(hash(i+2,y)*TILE|0),2,1); }
  } else if(code===4){ mitB.fillStyle=C.water; mitB.fillRect(X0,Y0,TILE,TILE);
    for(let i=0;i<6;i++){ const wy=Y0+2+i*2+((x+(i&1))%2); mitB.fillStyle=hash(x,y*9+i)<.5?C.waterHi:C.waterLo; mitB.fillRect(X0+1+((i*3)%TILE),wy,5,1); }
  } else if(code===5){ mitB.fillStyle='#8a857c'; mitB.fillRect(X0,Y0,TILE,TILE);
    mitB.fillStyle='#7a756c'; mitB.fillRect(X0,Y0,TILE,1); mitB.fillRect(X0,Y0,1,TILE);
    for(let i=0;i<4;i++){ mitB.fillStyle=hash(i,x+y)<.5?'#948f86':'#807b72'; mitB.fillRect(X0+(hash(i,x)*TILE|0),Y0+(hash(i+1,y)*TILE|0),2,2); }
  } else if(code===6){ mitB.fillStyle='#b89b6a'; mitB.fillRect(X0,Y0,TILE,TILE);
    for(let i=0;i<6;i++){ mitB.fillStyle=hash(i,x+y)<.5?'#c7ac7c':'#a98c5e'; mitB.fillRect(X0+(hash(i,x)*TILE|0),Y0+(hash(i+2,y)*TILE|0),2,2); }
  } else if(code===8){ mitB.fillStyle='#5e564a'; mitB.fillRect(X0,Y0,TILE,TILE);   // kiesig-erdig
    for(let i=0;i<16;i++){ const gx=X0+(hash(i,x*5+y)*TILE|0), gy=Y0+(hash(i+7,x+y*3)*TILE|0), r=hash(i+2,x*y+1);
      mitB.fillStyle = r<.33?'#726858':(r<.66?'#494336':'#847a6a'); mitB.fillRect(gx,gy,1+(r<.18?1:0),1); }
    for(let i=0;i<3;i++){ const gx=X0+(hash(i,x+9)*13|0), gy=Y0+(hash(i+3,y+4)*13|0); mitB.fillStyle=hash(i,x)<.5?'#403a2e':'#6a5238'; mitB.fillRect(gx,gy,2,2); }
  }
}
function paintMitteGround(){
  for(let i=0;i<mground.length;i++) mground[i]=0;
  // Haupt-Boulevard (West-Ost)
  mfill(3, 0,30, MITW-1,31);
  // Alexanderplatz (Granit)
  mfill(5, 26,7, 47,22);
  // verwinkelte Nebenstrassen (gestaffelt, nicht als reines Raster)
  mfill(3, 10,22, 11,41); mfill(3, 18,16, 19,30); mfill(3, 24,23, 25,45);
  mfill(3, 40,8, 41,30); mfill(3, 52,18, 53,43); mfill(3, 58,24, 59,41);
  mfill(3, 8,24, 30,24); mfill(3, 14,38, 56,38); mfill(3, 30,16, 52,16); mfill(3, 20,44, 60,44);
  mfill(3, 36,22, 37,30); // Platz-Zufahrt
  mfill(3, 53,26, MITW-1,27); // Ost-Anschluss -> Friedrichshain-Kreuzberg
  // Spree (Sued-Band) + Promenade
  mfill(4, 3,47, MITW-4,50); mfill(2, 3,46, MITW-4,46);
  mfill(8, 2,44, 28,49);   // Heidegluehen — kiesig-erdiges Gelaende (SW, laenger, am Kanal)
  // kleine Parks (Encounter-Zonen, hohes Gras)
  mfill(7, 3,3, 9,9); mfill(7, 55,6, 63,13); mfill(7, 5,34, 12,40); mfill(7, 48,40, 58,43); mfill(7, 60,15, 65,24);
  // Gehwege automatisch an alle Strassen legen (Snapshot -> kein Cascade)
  const snap=mground.slice();
  for(let y=0;y<MITH;y++)for(let x=0;x<MITW;x++){ if(snap[mgi(x,y)]!==0) continue;
    let near=false; [[1,0],[-1,0],[0,1],[0,-1]].forEach(d=>{ const nx=x+d[0],ny=y+d[1]; if(nx>=0&&ny>=0&&nx<MITW&&ny<MITH && snap[mgi(nx,ny)]===3) near=true; });
    if(near) mground[mgi(x,y)]=2;
  }
  for(let y=0;y<MITH;y++)for(let x=0;x<MITW;x++) mitTile(x,y,mground[mgi(x,y)]);
  // Wasser-Ufer + Solids
  for(let y=0;y<MITH;y++)for(let x=0;x<MITW;x++){ if(mground[mgi(x,y)]===4){
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(d=>{ const nx=x+d[0],ny=y+d[1]; if(nx>=0&&ny>=0&&nx<MITW&&ny<MITH && mground[mgi(nx,ny)]!==4){ mitB.fillStyle=C.waterEdge; mitB.fillRect(x*TILE+(d[0]>0?TILE-2:0),y*TILE+(d[1]>0?TILE-2:0), d[0]?2:TILE, d[1]?2:TILE);} });
  }}
  for(let y=0;y<MITH;y++)for(let x=0;x<MITW;x++) if(mground[mgi(x,y)]===4) mSolid(x*TILE,y*TILE,TILE,TILE);
}

function mitTree(tx,ty){ const x=tx*TILE+8,y=ty*TILE; px(mitB,x-1,y+10,3,9,'#4a3522'); canopy(mitA, x, y+2, 13, 11, LEAF_LINDEN, (tx*7+ty)|0); mSolid(x-3,y+13,7,5); }
function mitLamp(tx,ty){ const x=tx*TILE+8,y=ty*TILE; px(mitB,x,y+2,2,15,'#2a2a30'); px(mitA,x-3,y,8,4,'#3a3a42'); px(mitA,x-2,y+1,6,2,'#ffcf7a'); mitGlows.push({x:x+1,y:y+3,r:16}); }
function mitBench(tx,ty){ const x=tx*TILE,y=ty*TILE+9; shadow(mitB,x+1,y+5,14,3); px(mitB,x,y,15,3,'#7a5a38'); px(mitB,x,y+3,15,4,'#6a4a2e'); px(mitB,x+1,y+7,2,4,'#4a3320'); px(mitB,x+12,y+7,2,4,'#4a3320'); mSolid(x+1,y+3,14,5); }
function mitTable(x,y){ shadow(mitB,x+1,y+7,10,3); px(mitB,x+5,y+3,2,7,'#3a2a1a'); px(mitB,x+1,y,10,4,'#c9b483'); px(mitB,x+1,y,10,1,'#e0cfa0'); }

// Altbau-Block (Gruenderzeit-Fassade), zeichnet nach mitB, Solid = Grundriss
function mitAltbau(tx,ty,w,pal){ const x=tx*TILE, y=ty*TILE, W=w*TILE, fl=pal.fl||3, H=fl*14+12;
  px(mitB,x,y-2,W,H+2, pal.wall); px(mitB,x,y-2,W,2,pal.wallHi); px(mitB,x-1,y-5,W+2,4,pal.trim);
  for(let f=0;f<fl;f++){ const wy=y+6+f*14; for(let cx=x+4; cx<x+W-5; cx+=12){ px(mitB,cx,wy,7,9,'#20242c'); px(mitB,cx,wy,7,2,'#38414e'); px(mitB,cx+1,wy+2,2,6, hash(cx,wy)<.5?'#6a7688':'#20242c'); } }
  px(mitB,x,y+H-13,W,13, pal.base||'#4a4038');
  if(pal.door){ px(mitB,x+W/2-5,y+H-13,10,13,'#3a2a1a'); px(mitB,x+W/2-4,y+H-12,8,11,'#5a3f26'); }
  mSolid(x+1,y+2,W-2,H-2);
}
// Laden mit Markise + Schild (Cafe/Restaurant)
function mitShop(tx,ty,w,name,awn,pal){ const x=tx*TILE, y=ty*TILE, W=w*TILE, fl=pal.fl||2, H=fl*14+16;
  px(mitB,x,y-2,W,H+2, pal.wall); px(mitB,x,y-2,W,2,pal.wallHi); px(mitB,x-1,y-5,W+2,4,pal.trim);
  for(let f=0;f<fl;f++){ const wy=y+6+f*14; for(let cx=x+4; cx<x+W-5; cx+=12){ px(mitB,cx,wy,7,9,'#20242c'); px(mitB,cx,wy,7,2,'#38414e'); } }
  // Schaufenster
  px(mitB,x+2,y+H-15,W-4,12,'#2a3038'); px(mitB,x+3,y+H-14,W-6,10,'#3a4652'); px(mitB,x+3,y+H-14,W-6,2,'#556474');
  // Markise (gestreift)
  for(let i=0;i<W-4;i+=6){ px(mitB,x+2+i,y+H-20,3,5,awn); px(mitB,x+5+i,y+H-20,3,5,'#f0e8d8'); }
  px(mitB,x+2,y+H-21,W-4,2,'#e8e0d0');
  // Schild
  px(mitB,x+W/2-((name.length*3+4)>>1),y-11,name.length*3+4,9,'#20140a'); px(mitB,x+W/2-((name.length*3+4)>>1)+1,y-10,name.length*3+2,7,'#3a2a16');
  mitShopSigns.push({x:x+W/2, y:y-9, name, col:awn});
  mSolid(x+1,y+2,W-2,H-4);
}
const mitShopSigns=[];

function mitFernsehturm(cxpx, baseY){
  const H=150;
  // Schaft (verjuengt), auf mitB
  for(let i=0;i<H;i++){ const yy=baseY-i; const t=i/H; const hw=(9-4*t); const shade=(i%6<3);
    px(mitB, (cxpx-hw)|0, yy, (hw*2)|0, 1, shade?'#b8bcc4':'#9aa0a8'); px(mitB,(cxpx-hw)|0,yy,2,1,'#c8ccd4'); px(mitB,(cxpx+hw-2)|0,yy,2,1,'#82868e'); }
  // Basis-Fuss
  px(mitB,(cxpx-11)|0, baseY-6, 22, 10, '#6a6e76'); px(mitB,(cxpx-13)|0, baseY+2, 26, 6, '#565a62'); shadow(mitB,(cxpx-14)|0,baseY+6,28,4);
  // Kugel + Antenne auf mitA (schwebt vor allem)
  const sy=baseY-H-14, r=17;
  for(let a=-r;a<=r;a++){ const hw=Math.sqrt(r*r-a*a)|0; const yy=sy+a; const band=((a+r)%5===0); px(mitA,(cxpx-hw)|0,yy,hw*2,1, band?'#7c828c':(a<0?'#c4c8d0':'#9aa0aa')); }
  px(mitA,(cxpx-r+3)|0,(sy-4)|0,6,4,'#eef2f6');            // Glanzpunkt
  px(mitA,(cxpx-2)|0,(sy+r)|0,4,6,'#9aa0a8');              // Kugel-Hals
  // Antenne (rot/weiss segmentiert)
  for(let i=0;i<40;i++){ const yy=sy-r-i; px(mitA,(cxpx-1)|0,yy,2,1, (i%6<3)?'#c8402c':'#e8e8ea'); }
  px(mitA,(cxpx-1)|0,(sy-r-40)|0,2,3,'#ffd24a');
  mSolid(cxpx-12, baseY-8, 24, 14);
  mInter(cxpx-16, baseY-6, 32, 12, 'Fernsehturm', ['Der Fernsehturm. 368 Meter DDR-Trotz, sichtbar aus dem halben Land.','Bei Sonne blitzt ein Kreuz auf der Kugel — »Rache des Papstes« nennen sie das hier.','Ganz oben soll es sich drehen. Dein Magen dreht sich beim Blick nach oben schon von allein.']);
}

function drawStar(c,cx,cy,r,col){ c.fillStyle=col; c.beginPath(); for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, rr=(i%2?r*0.42:r); const X1=cx+Math.cos(a)*rr, Y1=cy+Math.sin(a)*rr; i?c.lineTo(X1,Y1):c.moveTo(X1,Y1); } c.closePath(); c.fill(); }
function drawSprayCanTag(c,x,y){ c.fillStyle='#161410'; c.fillRect(x,y,15,24); c.fillRect(x+4,y-7,7,7); c.fillRect(x+6,y-10,3,3);
  c.fillStyle='#c9a83a'; c.fillRect(x+3,y+5,9,12); c.fillStyle='#161410'; c.fillRect(x+5,y+8,2,2); c.fillRect(x+9,y+8,2,2); c.fillRect(x+5,y+12,6,1);
  c.fillStyle='#c9a83a'; c.font='4px Georgia'; c.textAlign='center'; c.fillText('ATB', x+7, y+21); c.textAlign='left'; }
function drawTagBlob(c,x,y,fill,hi,txt){ c.save(); c.fillStyle=fill; c.beginPath(); c.ellipse(x,y,20,10,0,0,6.3); c.fill();
  c.fillStyle=hi; c.beginPath(); c.ellipse(x-4,y-3,14,5,0,0,6.3); c.fill();
  c.lineWidth=1.5; c.strokeStyle='#161410'; c.beginPath(); c.ellipse(x,y,20,10,0,0,6.3); c.stroke();
  c.fillStyle='#161410'; c.font='bold 9px Georgia'; c.textAlign='center'; c.fillText(txt,x,y+3); c.textAlign='left'; c.restore(); }
function mitBigTree(tx,ty){ const x=tx*TILE+8,y=ty*TILE;
  px(mitB,x-2,y+10,5,13,'#4a3522'); px(mitB,x-2,y+10,2,13,'#5a4230');
  canopy(mitA, x, y-5, 19, 16, LEAF_OAK, (tx*13+ty)|0);
  canopy(mitA, x-10, y+2, 11, 10, LEAF_OAK, (tx*7+ty+3)|0);
  canopy(mitA, x+10, y+1, 11, 10, LEAF_OAK, (tx*5+ty+9)|0);
  mSolid(x-4,y+15,10,6); }
export function drawSpriteImg(im,ox,oy){ if(!im||!im.width) return; const p=X.imageSmoothingEnabled; X.imageSmoothingEnabled=false;
  X.drawImage(im, Math.round(ox+8-im.width/2), Math.round(oy+16-im.height), im.width, im.height); X.imageSmoothingEnabled=p; }
function mitClubHeidegluehen(){
  const x0=2*TILE, y0=39*TILE, W=26*TILE, H=5*TILE;
  shadow(mitB, x0+8, y0+H-2, W-16, 8);
  // Sprueh-gelbe Bretterwand + Planken + Witterung
  px(mitB,x0,y0,W,H,'#b89a30');
  for(let yy=0;yy<H;yy+=5) px(mitB,x0,y0+yy,W,1,'#8a7220');
  for(let i=0;i<120;i++) px(mitB, x0+(hash(i,3)*W|0), y0+(hash(i,7)*H|0),1,2, hash(i,9)<.5?'#caa93a':'#9c8020');
  px(mitB,x0,y0+H-8,W,8,'#3a3220'); for(let i=0;i<44;i++) px(mitB,x0+(hash(i,5)*W|0),y0+H-8+(hash(i,6)*8|0),2,1,'#2a2416');
  // Flachdach (Wellblech)
  px(mitB,x0-3,y0-5,W+6,7,'#7a7c80'); for(let xx=0;xx<W+6;xx+=3) px(mitB,x0-3+xx,y0-5,1,7,'#63656a'); px(mitB,x0-3,y0-6,W+6,1,'#33333a');
  // Graffiti — Sterne + Blobs
  for(const s of [[20,12],[300,10],[360,26],[250,58],[150,60],[410,16]]) drawStar(mitB,x0+s[0],y0+s[1],4,'#161410');
  for(const b of [[110,22],[336,52],[64,58],[290,30]]){ mitB.fillStyle='#161410'; mitB.beginPath(); mitB.ellipse(x0+b[0],y0+b[1],5,4,0,0,6.3); mitB.fill(); }
  // Name gross + klar getagged (pink fill, schwarze Outline)
  mitB.save(); mitB.translate(x0+118,y0+42); mitB.rotate(-0.05); mitB.font='bold 30px Georgia';
  mitB.fillStyle='#161410'; mitB.fillText('HEIDEGLÜHEN',3,3);
  mitB.fillStyle='#e34d8c'; mitB.fillText('HEIDEGLÜHEN',0,0);
  mitB.lineWidth=1.4; mitB.strokeStyle='#161410'; mitB.strokeText('HEIDEGLÜHEN',0,0); mitB.restore();
  // weitere Farben fuer Varianz
  drawTagBlob(mitB, x0+40,  y0+30, '#c85a3a', '#ffb090', 'ATB');
  drawTagBlob(mitB, x0+236, y0+18, '#3aa88a', '#9fe8cf', 'BRN');
  drawTagBlob(mitB, x0+330, y0+34, '#3a7ad0', '#8fc0ff', 'GLOW');
  drawSprayCanTag(mitB, x0+W-46, y0+14);
  // seitlicher Eingang (west) + versenktes rostiges Tor
  const ex=x0+4*TILE, ey=y0+H-36;
  px(mitB,ex-4,ey-4,40,40,'#241a12'); px(mitB,ex,ey,32,36,'#3a2a1e'); px(mitB,ex+3,ey+2,26,34,'#6a4a34'); px(mitB,ex+3,ey+2,26,2,'#7c5a40');
  for(let i=0;i<32;i+=4) px(mitB,ex+3,ey+2+i,26,1,'#5a3e2a'); px(mitB,ex+15,ey+18,2,7,'#241a12');
  // ueberdachter Vorbau vor dem Eingang
  const vx=ex-10, vw=52, vy=y0+H;
  px(mitB,vx,vy,4,20,'#4a3728'); px(mitB,vx+vw-4,vy,4,20,'#4a3728');
  px(mitB,vx-4,vy-4,vw+8,7,'#6a5238'); for(let xx=0;xx<vw+8;xx+=3) px(mitB,vx-4+xx,vy-4,1,7,'#523f2a'); px(mitB,vx-4,vy-5,vw+8,1,'#2a2016');
  mitB.fillStyle='rgba(20,16,10,0.18)'; mitB.fillRect(vx,vy+2,vw,15);
  mSolid(x0, y0, ex-x0-2, H); mSolid(ex+34, y0, x0+W-(ex+34), H); mSolid(vx,vy,4,18); mSolid(vx+vw-4,vy,4,18);
  mitDoors.push({x:ex-2, y:y0+H-6, w:36, h:16, to:'club'});   // Eingang -> Innenbereich
  mInter(ex-4, y0+H-6, 40, 12, 'Heideglühen',
    ['Heideglühen. Bretterbude am Kanal — von aussen nur besprayte Holzwand. Drinnen soll die Sonne aufgehen und nie untergehen.',
     'Ueber dem seitlichen Eingang haengt ein schiefes Vordach, dahinter nur Dunkelheit und Bass.',
     'Noch kommst du hier nicht rein. Aber bald wird dieser Laden dein erster echter Test.']);
}
export function buildMitte(){
  paintMitteGround();
  mitFernsehturm(37*TILE, 21*TILE);
  drawUbahnSign(mitB,480,144); mInter(472,142,20,26,'U-Bahn',[]);
  setStationReturn('mitte',{x:486,y:170,dir:'down'});
  // Cafes/Restaurants/Altbau vorerst raus — kommen mit echten Assets zurueck.
  // Baeume, Laternen, Baenke (Ambiente)
  mitTree(24,20); mitTree(50,20); mitTree(7,28); mitTree(62,26); mitTree(58,45);
  mitLamp(28,23); mitLamp(45,23); mitLamp(20,30); mitLamp(40,30); mitLamp(58,30); mitLamp(50,38);
  mitBench(34,24); mitBench(39,24); mitBench(40,46); mitBench(54,46);
  // --- Club #1: Heidegluehen (SW, ueber der Spree) ---
  mitClubHeidegluehen();
  mitBigTree(20,45);   // groesserer Baum, direkt neben der Schlange (auf Schlangen-Hoehe)
  mSolid(8*TILE+2,44*TILE+4,12,10);   // Tuersteherin blockt den Eingang
  // Ausgang zurueck nach Wilmersdorf (West)
  mitDoors.push({x:0,y:30*TILE,w:24,h:2*TILE,to:'chb'});
  mInter(1*TILE,29*TILE,2*TILE,2*TILE,'→ Wilmersdorf',['Zurueck nach Westen, raus aus dem Trubel, rein nach Charlottenburg-Wilmersdorf.']);
  // Ausgang weiter nach Friedrichshain-Kreuzberg (Ost) — der naechste grosse Schritt
  mitDoors.push({x:MITPX-24,y:26*TILE,w:24,h:2*TILE,to:'fhxb'});
  mInter(MITPX-28,25*TILE,28,3*TILE,'→ Friedrichshain-Kreuzberg',['Weiter Richtung Osten: Friedrichshain-Kreuzberg. Der naechste grosse Schritt.']);
  mInter(37*TILE-8,6*TILE,32,16,'Alexanderplatz',['Der Alex. Beton, Bahnen, Buden. Alle rennen, keiner weiss wohin.','Der erste Club steht schon — unten an der Spree.']);
  // NPCs — Warteschlange vorm Heidegluehen (auf der Spree-Seite) + Ambiente
  mitNpcs.push(
    {x:8*TILE,y:44*TILE,sprite:'tuer',dir:'down',who:'Tuersteherin',frame:0,lines:['Die Tuersteherin mustert dich, dann nickt sie knapp Richtung Tor.','»Na los. Rein mit dir. Aber der Boss da drin macht dich fertig.«','Hinter ihr: Holz, Bass und Seifenblasen.']},
    {x:11*TILE,y:45*TILE,dir:'left',pal:PAL_CLUB1,who:'Schlange',frame:0,lines:['Steh hier seit zwei. Bewegt sich wie Beton.','Drin soll’s knallen. Wenn se dich reinlassen.'], talk:()=>schlangeTalk()},
    {x:12*TILE+6,y:44*TILE+4,dir:'left',pal:PAL_CLUB2,who:'Schlange',frame:0,lines:['Guck nich so eifrig, das riecht die Tuersteherin.','Erstes Mal? Merkt man. Bleib locker.']},
    {x:14*TILE,y:45*TILE,dir:'left',pal:PAL_CLUB3,who:'Schlange',frame:0,lines:['Schwarz traegt man hier. Immer.','Dein Team? Niedlich. Lass drin lieber stecken.']},
    {x:15*TILE+6,y:44*TILE+2,dir:'left',pal:PAL_CLUB1,who:'Schlange',frame:0,lines:['Mate leer, Geduld auch.','Der Laden ist aelter als du denkst.']},
    {x:17*TILE,y:45*TILE,dir:'left',pal:PAL_CLUB2,who:'Schlange',frame:0,lines:['Sonnenaufgang drin, Sonnenaufgang drauss’. Man verliert das Gefuehl.','Sssh. Nich draengeln.']},
    {x:18*TILE+6,y:44*TILE+4,dir:'left',pal:PAL_CLUB3,who:'Schlange',frame:0,lines:['Ich kenn die Tuersteherin. ...Kenn sie nich.','Bald biste dran, Kleiner. Nur nich heut.']},
    {x:44*TILE,y:45*TILE,dir:'right',pal:PAL_STUD1,who:'Mate-Trinker',play:true,t:0.3,frame:0,lines:['Spree, Sonne, Mate. Mehr Bezirk geht nicht.','Zone 2? Bruder, ich bin in Zone Ufer.']},
    {x:48*TILE,y:45*TILE,dir:'left',pal:PAL_STUD2,who:'Mate-Trinkerin',play:true,t:1.4,frame:0,lines:['Pfandflasche steht, Diskurs laeuft, alles gut.','Der Club da hinten? Da kommste noch nich rein.']},
    {x:36*TILE,y:12*TILE,dir:'down',pal:PAL_BUSKER,who:'Strassenmusiker',play:true,t:0.7,frame:0,lines:['Drei Akkorde, ein Hut, der Alex als Buehne.','Wirf wat rein, dann spiel ich dein Team ein Siegerlied. Vielleicht.']},
    {x:41*TILE,y:14*TILE,dir:'left',pal:PAL_TOURIST,who:'Tourist',wander:true,base:41*TILE,range:20,t:0,frame:0,lines:['Excuse me — wo Fernsehturm? ...Ach. Da. Logisch.','So many Level. My little guy is not ready, oh no.'], talk:()=>touristTalk()}
  );
}
function schlangeTalk(){
  if(drunk>0){ chatNPC('Schlange',['Endlich einer der auch schon vorglueht! Passt zur Schlange.','Komm, stell dich zu uns. Riechste eh schon nach drinnen.']); return; }
  chatNPC('Schlange',['Steh hier seit zwei. Bewegt sich wie Beton.','Drin soll’s knallen. Wenn se dich reinlassen.']);
}
function touristTalk(){
  if(drunk>0){ chatNPC('Tourist',['Oh... are you okay? You smell like... Sterni?','I did not expect zis on my city trip. Very authentic though!']); return; }
  chatNPC('Tourist',['Excuse me — wo Fernsehturm? ...Ach. Da. Logisch.','So many Level. My little guy is not ready, oh no.']);
}
export function blockedMitte(nx,ny){ const fx=nx+4,fy=ny+15,fw=8,fh=6;
  if(fx<TILE||fy<TILE||fx+fw>MITPX-TILE||fy+fh>MITHPX-TILE) return true;
  for(const s of mitSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}
let mlastTile=-1;
export function checkEncounterMitte(){
  const tx=(player.x+8)/TILE|0, ty=(player.y+16)/TILE|0;
  const t=mground[mgi(clamp(tx,0,MITW-1),clamp(ty,0,MITH-1))];
  if(t===7){ const id=ty*MITW+tx;
    if(id!==mlastTile && encCool<=0){ mlastTile=id; if(Math.random()<0.24){ const w=rollWild('mitte'); setGrassFlash(0.5); startBattle(w.id,w.lv,'mitte'); } } }
  else mlastTile=-1;
}
export function renderMitte(){
  X.clearRect(0,0,LW,LH);
  X.drawImage(mitBelow, mitcamx,mitcamy,LW,LH, 0,0,LW,LH);
  const ents=[];
  ents.push({y:player.y+22,draw:()=>drawChar(X,(player.x-mitcamx)|0,(player.y-mitcamy)|0,player.dir,player.frame,PAL_PLAYER)});
  for(const n of mitNpcs) ents.push({y:n.y+22,draw:()=> n.sprite==='tuer' ? drawSpriteImg(TUER_IMG,(n.x-mitcamx),(n.y-mitcamy)) : drawChar(X,(n.x-mitcamx)|0,(n.y-mitcamy)|0,n.dir,n.frame||0,n.pal)});
  ents.sort((a,b)=>a.y-b.y); for(const e of ents) e.draw();
  X.drawImage(mitAbove, mitcamx,mitcamy,LW,LH, 0,0,LW,LH);
  // Ladenschilder (Text scharf)
  X.textAlign='center'; X.textBaseline='middle';
  for(const s of mitShopSigns){ const sx=s.x-mitcamx, sy=s.y-mitcamy; if(sx<-40||sx>LW+40||sy<-20||sy>LH+20) continue;
    X.font='6px Georgia'; X.fillStyle=s.col; X.fillText(s.name, sx+0.5, sy+0.5); X.fillStyle='#f3ecd8'; X.fillText(s.name, sx, sy-0.5); }
  X.textAlign='left'; X.textBaseline='alphabetic';
  if(grassFlash>0){ X.fillStyle='rgba(120,200,90,'+(grassFlash*0.5)+')'; X.fillRect(0,0,LW,LH); }
  drawLightMitte();
}
function drawLightMitte(){
  Lx.clearRect(0,0,LW,LH);
  Lx.fillStyle='rgba(26,24,40,0.12)'; Lx.fillRect(0,0,LW,LH);
  let v=Lx.createRadialGradient(LW/2,LH/2,64,LW/2,LH/2,214); v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(6,6,14,0.50)');
  Lx.fillStyle=v; Lx.fillRect(0,0,LW,LH);
  Lx.globalCompositeOperation='lighter';
  const fl=reduce?1:0.85+0.15*Math.sin(T*3);
  for(const g of mitGlows){ const sx=g.x-mitcamx, sy=g.y-mitcamy; if(sx<-30||sx>LW+30||sy<-30||sy>LH+30) continue;
    const rg=Lx.createRadialGradient(sx,sy,0,sx,sy,g.r); rg.addColorStop(0,'rgba(255,200,120,'+(0.42*fl)+')'); rg.addColorStop(1,'rgba(255,200,120,0)');
    Lx.fillStyle=rg; Lx.fillRect(sx-g.r,sy-g.r,g.r*2,g.r*2); }
  Lx.globalCompositeOperation='source-over';
  X.drawImage(lightCv,0,0);
}
export function enterMitte(){
  G.scene='mitte'; clearSitting(); player.x=mitEntry.x; player.y=mitEntry.y; player.dir='right'; player.frame=0; setEnterCool(0.5);
  setMitCam(clamp(player.x+8-LW/2,0,MITPX-LW), clamp(player.y+16-LH/2,0,MITHPX-LH));
  setBanner('Mitte','High-Level-Bezirk'); showBanner(); toast('Neue Karte: Mitte — Akhs Lvl 15–30. Pass auf dein Team auf.',3000);
}
export function exitMitte(){
  G.scene='chb'; clearSitting(); player.x=mitReturn.x; player.y=mitReturn.y; player.dir=mitReturn.dir; player.frame=0; setEnterCool(0.5);
  setCcam(clamp(player.x+8-LW/2,0,WPX-LW), clamp(player.y+16-LH/2,0,HPX-LH));
  setBanner('Charlottenburg-Wilmersdorf','Bezirk'); showBanner();
}
