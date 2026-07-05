import { LW, LH, TILE, X, C, reduce } from '../core/constants.js';
import { hash, clamp } from '../core/math.js';
import { LEAF_OAK, canopy, px } from '../core/canvas.js';
import { G } from '../core/state.js';
import { player } from '../entities/player.js';
import { drawChar, PAL_PLAYER } from '../entities/drawChar.js';
import { setBanner, showBanner } from '../ui/banner.js';
import { toast } from '../ui/toast.js';
import { cground, PAL_STUD1, PAL_STUD2, PAL_GIRL } from './chb.js';
import {
  MITPX, MITHPX, PAL_WAITER, PAL_HIP, PAL_CLUB1, PAL_CLUB2, PAL_CLUB3,
  OWNER_IMG, BARK_IMG, drawSpriteImg, CLUB_LOADSCREEN,
} from './mitte.js';
import {
  T, lightCv, Lx, sitting, clearSitting, setEnterCool, showDistrictLoad,
  clubcamx, clubcamy, setClubCam, setMitCam, drawPunisherHUD,
} from '../main.js';

/* ======================================================================
   HEIDEGLUEHEN — Innenbereich (begehbar). Open-Air, alles Holz.
   Spree an der einen Laengsseite, Palisade mit Lichterketten/Girlanden an
   der anderen. DJ-Booth vorn, Buehne mit Couch dahinter, 2. Stock mit Owner.
   Seifenblasen in der Luft, viele Leute.
   ====================================================================== */
const CLUBW=48, CLUBH=18; export const CLUBPX=CLUBW*TILE, CLUBHPX=CLUBH*TILE;
const clubBelow=document.createElement('canvas'); clubBelow.width=CLUBPX; clubBelow.height=CLUBHPX;
const clubAbove=document.createElement('canvas'); clubAbove.width=CLUBPX; clubAbove.height=CLUBHPX;
const clB=clubBelow.getContext('2d'), clA=clubAbove.getContext('2d'); clB.imageSmoothingEnabled=false; clA.imageSmoothingEnabled=false;
const clbground=new Uint8Array(CLUBW*CLUBH); const clbgi=(x,y)=>y*CLUBW+x;
const clubSolids=[]; export const clubInters=[], clubDoors=[], clubNpcs=[]; const clubGlows=[];
function clSolid(x,y,w,h){ clubSolids.push({x,y,w,h}); }
function clInter(x,y,w,h,who,lines){ clubInters.push({x,y,w,h,who,lines}); }
let clubDisco=null; let clubWaesche=null;
const clubEntry={x:2*TILE, y:8*TILE};
let clubReturn={x:7*TILE, y:45*TILE, dir:'down'};

function clubTile(x,y,code){ const X0=x*TILE,Y0=y*TILE;
  if(code===4){ clB.fillStyle=C.water; clB.fillRect(X0,Y0,TILE,TILE);
    for(let i=0;i<6;i++){ const wy=Y0+2+i*2+((x+(i&1))%2); clB.fillStyle=hash(x,y*9+i)<.5?C.waterHi:C.waterLo; clB.fillRect(X0+1+((i*3)%TILE),wy,5,1); }
  } else { clB.fillStyle='#6a4f34'; clB.fillRect(X0,Y0,TILE,TILE); clB.fillStyle='#5c4530'; clB.fillRect(X0,Y0,TILE,1);
    for(let i=0;i<4;i++){ clB.fillStyle=hash(i,x*3+y)<.5?'#77593b':'#5e4630'; clB.fillRect(X0+(hash(i,x)*TILE|0),Y0+2+(hash(i+2,y)*12|0),3,1); }
    if(((x+y)&3)===0){ clB.fillStyle='#7d5f3f'; clB.fillRect(X0,Y0+8,TILE,1); }
  }
}
function paintClubGround(){
  for(let i=0;i<cground.length;i++) cground[i]=1;
  for(let y=CLUBH-4;y<CLUBH;y++) for(let x=0;x<CLUBW;x++) clbground[clbgi(x,y)]=4;   // Spree Suedseite
  for(let y=0;y<CLUBH;y++)for(let x=0;x<CLUBW;x++) clubTile(x,y,clbground[clbgi(x,y)]);
  for(let y=0;y<CLUBH;y++)for(let x=0;x<CLUBW;x++) if(clbground[clbgi(x,y)]===4) clSolid(x*TILE,y*TILE,TILE,TILE);
}

// Palisade (Nord) + Lichterketten + Girlanden
function clPalisade(){ const H=2*TILE;
  for(let x=0;x<CLUBPX;x+=8){ clB.fillStyle=((x/8)&1)?'#634629':'#523823'; clB.fillRect(x,0,7,H); }
  clB.fillStyle='#3a2a1a'; clB.fillRect(0,H-2,CLUBPX,2); clB.fillStyle='#6a4e30'; clB.fillRect(0,0,CLUBPX,1);
  for(let i=0;i<40;i++){ clB.fillStyle=['#c85a3a','#3a7ad0','#e34d8c','#3aa88a','#161410'][i%5]; clB.fillRect((hash(i,3)*CLUBPX|0),(hash(i,7)*H|0),3,2); }
  clSolid(0,0,CLUBPX,H-2);
  // Lichterkette (schwingend) + Wimpel-Girlande auf clA
  const cols=['#ffd24a','#ff7a5a','#6fd0ff','#e34d8c','#9fe8cf'];
  for(let x=6;x<CLUBPX-6;x+=4){ const yy=H-6 + Math.sin(x*0.06)*5; clA.fillStyle='#2a2018'; clA.fillRect(x,yy|0,1,1);
    if(x%16===6){ const c=cols[(x/16|0)%cols.length]; clA.fillStyle=c; clA.fillRect(x-1,(yy+1)|0,3,3); clubGlows.push({x:x,y:yy+2,r:10,c}); } }
  for(let gx=8; gx<CLUBPX-8; gx+=18){ const c=cols[(gx/18|0)%cols.length]; clA.fillStyle=c;   // Wimpel
    clA.beginPath(); clA.moveTo(gx,H-3); clA.lineTo(gx+9,H-3); clA.lineTo(gx+4,H+5); clA.closePath(); clA.fill(); clA.fillStyle='rgba(255,255,255,.25)'; clA.fillRect(gx+1,H-2,7,1); }
}
function clRailing(){ const ry=(CLUBH-4)*TILE;   // Holz-Reling zur Spree
  clB.fillStyle='#5a4230'; clB.fillRect(0,ry-3,CLUBPX,3); clB.fillStyle='#6e523a'; clB.fillRect(0,ry-4,CLUBPX,1);
  for(let x=6;x<CLUBPX;x+=18){ clB.fillStyle='#4a3626'; clB.fillRect(x,ry-3,3,7); }
  clSolid(0,ry-2,CLUBPX,4);
}
function clBar(tx,ty,w){ const x=tx*TILE, y=ty*TILE, W=w*TILE;
  clB.fillStyle='#3a2a1a'; clB.fillRect(x,y-14,W,14);                 // Ruecktheke/Regal
  for(let i=0;i<W-4;i+=6){ clB.fillStyle=['#3aa88a','#c85a3a','#e6c84a','#6fd0ff'][(i/6|0)%4]; clB.fillRect(x+2+i,y-11,3,6); } // Flaschen
  clB.fillStyle='#5a4028'; clB.fillRect(x,y,W,7); clB.fillStyle='#6e5238'; clB.fillRect(x,y,W,2);   // Tresen
  clB.fillStyle='#402e1e'; clB.fillRect(x,y+7,W,2);
  clSolid(x,y-2,W,11);
}
function clDJBooth(tx,ty){ const x=tx*TILE, y=ty*TILE;
  clB.fillStyle='#2a2018'; clB.fillRect(x,y,3*TILE,2*TILE); clB.fillStyle='#3a2c1e'; clB.fillRect(x,y,3*TILE,4);
  // Turntables + Mixer
  clB.fillStyle='#161410'; clB.fillRect(x+4,y+6,12,10); clB.fillRect(x+3*TILE-16,y+6,12,10); clB.fillStyle='#3a3a44'; clB.fillRect(x+18,y+6,3*TILE-36,10);
  clB.fillStyle='#c8c8d0'; clB.fillRect(x+8,y+9,4,4); clB.fillRect(x+3*TILE-12,y+9,4,4);
  // LED-Front
  for(let i=0;i<3*TILE-6;i+=4){ clB.fillStyle=['#e34d8c','#6fd0ff','#ffd24a'][(i/4|0)%3]; clB.fillRect(x+3+i,y+2*TILE-3,2,2); }
  clSolid(x,y,3*TILE,2*TILE); clubGlows.push({x:x+1.5*TILE,y:y+TILE,r:26,c:'#e34d8c'});
  clInter(x,y+2*TILE-2,3*TILE,10,'DJ-Booth',['Die Booth. Kabelsalat, ein Laptop mit Sticker-Panzerung, zwei Decks.','Der Bass geht durch den Holzboden direkt in deine Knie.']);
}
function clStage(tx,ty,w,h){ const x=tx*TILE, y=ty*TILE, W=w*TILE, H=h*TILE;
  clB.fillStyle='#7a5c3a'; clB.fillRect(x,y,W,H); clB.fillStyle='#8a6a44'; clB.fillRect(x,y,W,2);   // helleres Buehnenholz
  for(let yy=4;yy<H;yy+=6){ clB.fillStyle='#6a4f32'; clB.fillRect(x,y+yy,W,1); }
  clB.fillStyle='rgba(20,14,8,0.35)'; clB.fillRect(x-2,y+H,W+2,4);    // Kante/Schatten (Erhoehung)
}
function clSpeaker(tx,ty){ const x=tx*TILE,y=ty*TILE; clB.fillStyle='#161410'; clB.fillRect(x,y,TILE,2*TILE);
  clB.fillStyle='#2a2a2e'; clB.fillRect(x+2,y+2,TILE-4,TILE-2); clB.fillStyle='#0a0a0c'; clB.beginPath(); clB.arc(x+TILE/2,y+8,4,0,6.3); clB.fill(); clB.beginPath(); clB.arc(x+TILE/2,y+2*TILE-6,3,0,6.3); clB.fill();
  clSolid(x,y,TILE,2*TILE); }
function clCouch(tx,ty){ const x=tx*TILE,y=ty*TILE;
  clB.fillStyle='rgba(8,6,8,0.35)'; clB.fillRect(x,y+13,2*TILE,3);
  clB.fillStyle='#16161a'; clB.fillRect(x,y,2*TILE,14);
  clB.fillStyle='#24242a'; clB.fillRect(x,y,2*TILE,4);
  clB.fillStyle='#0c0c10'; clB.fillRect(x,y+2,3,12); clB.fillRect(x+2*TILE-3,y+2,3,12);
  clB.fillStyle='#32323a'; clB.fillRect(x+4,y+5,2*TILE-8,4);
  clB.fillStyle='#484852'; for(let i=x+6;i<x+2*TILE-4;i+=6) clB.fillRect(i,y+6,1,2);
  clB.fillStyle='rgba(255,255,255,0.10)'; clB.fillRect(x+3,y+1,2*TILE-6,1);
  clSolid(x,y+6,2*TILE,8); }
function clLoft(){ // 2. Stock — erhoehte Galerie (NO), Owner + Tuer
  const x=40*TILE, y=2*TILE, W=8*TILE, H=4*TILE;
  clB.fillStyle='rgba(12,8,6,0.4)'; clB.fillRect(x-2,y+H,W+2,5);        // Schatten drunter (Hoehe)
  clB.fillStyle='#8a6a44'; clB.fillRect(x,y,W,H); clB.fillStyle='#9a7a52'; clB.fillRect(x,y,W,2);  // hellstes Holz = oben
  for(let yy=4;yy<H;yy+=6){ clB.fillStyle='#7a5c3a'; clB.fillRect(x,y+yy,W,1); }
  // Owner-Tuer LINKS
  clB.fillStyle='#2a1e14'; clB.fillRect(x+2,y+2,2*TILE,H-4); clB.fillStyle='#4a3222'; clB.fillRect(x+4,y+4,2*TILE-4,H-8); clB.fillStyle='#1a120c'; clB.fillRect(x+2*TILE,y+H/2,2,5);
  // Reling vorne (Sued) mit Treppen-Luecke links
  clB.fillStyle='#5a4230'; clB.fillRect(x+TILE,y+H-2,W-TILE,3); for(let px2=x+TILE+3;px2<x+W;px2+=12){ clB.fillStyle='#4a3626'; clB.fillRect(px2,y+H-6,2,6); }
  clB.fillStyle='#6e523a'; clB.fillRect(x+TILE,y+H-6,2,6);
  // Treppe (links) runter zur Buehne
  for(let s=0;s<4;s++){ clB.fillStyle=s%2?'#7a5c3a':'#6a4f32'; clB.fillRect(x-2,y+H+ s*4,TILE+4,4); }
  // Solids: Reling (ausser Treppenluecke links) + Rueckwand
  clSolid(x+TILE, y+H-4, W-TILE, 4); clSolid(x, y, W, 2);
  clInter(x+2,y+H-2,2*TILE,8,'Owner-Tuer',['Eine schwere Holztuer, mattschwarz. Dahinter das eigentliche Herz des Ladens.','Der Owner steht davor wie festgewachsen. Erst wenn du ihn schlaegst, geht sie auf.']);
}

function clBulbString(){ const cols=['#ffd24a','#ff7a5a','#6fd0ff','#e34d8c','#9fe8cf'];
  for(let x=4;x<CLUBPX-4;x+=3){ const yy=2*TILE+7 + Math.sin(x*0.05)*6; clA.fillStyle='#2a2018'; clA.fillRect(x,yy|0,1,1);
    if(x%15===4){ const c=cols[(x/15|0)%cols.length]; clA.fillStyle=c; clA.fillRect(x-1,(yy+1)|0,3,3); clubGlows.push({x,y:yy+2,r:9,c}); } } }
function clFassPool(tx,ty){ const x=tx*TILE, y=ty*TILE, cx=x+TILE, cy=y+TILE;
  clB.fillStyle='rgba(8,6,4,0.3)'; clB.beginPath(); clB.ellipse(cx,cy+3,TILE+3,TILE-2,0,0,6.3); clB.fill();
  clB.fillStyle='#4a3320'; clB.beginPath(); clB.ellipse(cx,cy,TILE+2,TILE-1,0,0,6.3); clB.fill();
  for(let a=0;a<6.28;a+=0.45){ clB.fillStyle=(a%0.9<0.45)?'#6e4d2e':'#523620'; clB.fillRect(cx+Math.cos(a)*(TILE)-1,cy+Math.sin(a)*(TILE-3)-1,2,3); }
  clB.fillStyle='#2a2a30'; clB.beginPath(); clB.ellipse(cx,cy,TILE,TILE-3,0,0,6.3); clB.fill();
  clB.fillStyle='#2f6f9a'; clB.beginPath(); clB.ellipse(cx,cy,TILE-3,TILE-5,0,0,6.3); clB.fill();
  clB.fillStyle='#4a92c0'; clB.beginPath(); clB.ellipse(cx-2,cy-2,TILE-6,TILE-8,0,0,6.3); clB.fill();
  clB.fillStyle='rgba(255,255,255,.4)'; clB.fillRect(cx-6,cy-4,5,1); clB.fillRect(cx+2,cy+2,3,1);
  clSolid(x+2,y+4,2*TILE-4,2*TILE-8);
  clInter(x,y+2*TILE-6,2*TILE,10,'Fass-Pool',['Ein aufgesaegtes Bierfass, randvoll mit Wasser. Jemand plantscht selig drin.','Klein, absurd, notwendig. Genau wie der Laden.']); }
function clFeuertonne(tx,ty){ const x=tx*TILE,y=ty*TILE;
  clB.fillStyle='#3a2a1e'; clB.fillRect(x+2,y+4,TILE-4,TILE-2); clB.fillStyle='#4a3526'; clB.fillRect(x+2,y+4,TILE-4,2); clB.fillStyle='#241811'; clB.fillRect(x+2,y+TILE,TILE-4,2);
  for(let i=0;i<3;i++){ clB.fillStyle='#5a4230'; clB.fillRect(x+2,y+6+i*4,TILE-4,1); }
  clB.fillStyle='#e8631e'; clB.fillRect(x+4,y+1,TILE-8,5); clB.fillStyle='#ffb030'; clB.fillRect(x+6,y,TILE-12,4); clB.fillStyle='#ffe070'; clB.fillRect(x+7,y+1,2,2);
  clSolid(x+2,y+6,TILE-4,TILE-2); clubGlows.push({x:x+TILE/2,y:y+3,r:26,c:'#ff8a2a'});
  clInter(x,y+TILE-2,TILE,8,'Feuertonne',['Eine Feuertonne. Waerme, Funkenflug, ein Kreis aus Gesichtern.','Hier werden die besten und duemmsten Ideen der Nacht geboren.']); }
function clPlant(tx,ty){ const x=tx*TILE+8,y=ty*TILE;
  clB.fillStyle='#3a2a1a'; clB.fillRect(x-4,y+8,9,7); clB.fillStyle='#4a3626'; clB.fillRect(x-4,y+8,9,2);
  canopy(clA, x, y+2, 8, 8, LEAF_OAK, (tx*3+ty)|0); clSolid(x-4,y+10,9,5); }
function clDiscoBall(cx,cy){ clA.fillStyle='#2a2a30'; clA.fillRect(cx-1,0,2,cy-7);
  clA.fillStyle='#9aa0b0'; clA.beginPath(); clA.arc(cx,cy,7,0,6.3); clA.fill();
  for(let i=0;i<22;i++){ const a=i/22*6.28; clA.fillStyle=(i%2)?'#c8ccda':'#7a8090'; clA.fillRect((cx+Math.cos(a)*5)|0,(cy+Math.sin(a)*5)|0,2,2); }
  clA.fillStyle='#ffffff'; clA.fillRect(cx-3,cy-3,2,2); clubDisco={x:cx,y:cy}; }
function clKarussell(tx,ty){ const cx=tx*TILE+TILE, cy=ty*TILE+TILE;
  clB.fillStyle='rgba(10,8,6,0.3)'; clB.beginPath(); clB.ellipse(cx,cy+9,26,9,0,0,6.3); clB.fill();
  clB.fillStyle='#5a4632'; clB.beginPath(); clB.ellipse(cx,cy+6,24,9,0,0,6.3); clB.fill();
  clB.fillStyle='#6e553c'; clB.beginPath(); clB.ellipse(cx,cy+5,21,7,0,0,6.3); clB.fill();
  clB.fillStyle='#7d603f'; clB.beginPath(); clB.ellipse(cx,cy+4,18,5,0,0,6.3); clB.fill();
  clB.fillStyle='#b89a40'; clB.fillRect(cx-2,cy-24,4,28); clB.fillStyle='#e0cf88'; clB.fillRect(cx-2,cy-24,1,28);
  const seats=[[-16,3,'#c8402c'],[16,3,'#3a7ad0'],[-9,10,'#e6b83a'],[9,10,'#3aa88a']];
  for(const s of seats){ const dx=s[0],dy=s[1],c=s[2]; clB.fillStyle='#9a9aa2'; clB.fillRect(cx+dx-1,cy-16,2,dy+14);
    clB.fillStyle=c; clB.fillRect(cx+dx-5,cy+dy-3,10,7); clB.fillStyle='#161410'; clB.fillRect(cx+dx-5,cy+dy-3,10,1); clB.fillStyle='rgba(255,255,255,.35)'; clB.fillRect(cx+dx-4,cy+dy-2,3,2); }
  for(let i=-22;i<22;i+=4){ const h=Math.sqrt(Math.max(0,1-(i/22)*(i/22)))*11; clA.fillStyle=(((i/4)|0)&1)?'#d83a3a':'#f0e8d8'; clA.fillRect(cx+i,(cy-16-h)|0,4,(h+2)|0); }
  clA.fillStyle='#8a6a44'; clA.fillRect(cx-24,cy-16,48,2); clA.fillStyle='#e0cf88'; clA.fillRect(cx-2,cy-30,4,6);
  clSolid(cx-18,cy-2,36,12);
  clInter(cx-9,cy+5,18,9,'Karussell',['Ein winziges Karussell mitten im Club. Warum? Weil Berlin.','Setz dich, dreh dich, guck dem Bass beim Arbeiten zu. (Bewegen = aufstehen)']);
  clubGlows.push({x:cx,y:cy-8,r:20,c:'#ffd24a'}); }
function clDeco(){ const cols=['#3aa88a','#c85a3a','#e6c84a','#6fd0ff','#e34d8c'];
  for(let i=0;i<44;i++){ const x=(hash(i,3)*CLUBPX)|0, y=(3*TILE+hash(i,7)*(10*TILE))|0;
    if(clbground[clbgi(clamp(x/TILE|0,0,CLUBW-1),clamp(y/TILE|0,0,CLUBH-1))]===4) continue;
    if(i%3===0){ clB.fillStyle=cols[i%cols.length]; clB.fillRect(x,y,2,3); clB.fillStyle='#161410'; clB.fillRect(x,y,2,1); }
    else { clB.fillStyle='#d8d0c0'; clB.fillRect(x,y,2,2); } }
  clB.fillStyle='#161410'; for(let x=22*TILE;x<38*TILE;x+=4) clB.fillRect(x, 11*TILE+((Math.sin(x*0.2)*2)|0), 4, 1); }
function clKlo(tx,ty){ const x=tx*TILE,y=ty*TILE;
  for(let s=0;s<2;s++){ const sx=x+s*TILE;
    clB.fillStyle=s?'#2a6a4a':'#2a4a7a'; clB.fillRect(sx,y,TILE-1,2*TILE);
    clB.fillStyle=s?'#357a58':'#35588f'; clB.fillRect(sx,y,TILE-1,3);
    clB.fillStyle='#16242f'; clB.fillRect(sx+3,y+5,TILE-7,2*TILE-8);
    clB.fillStyle='#c8c8d0'; clB.fillRect(sx+TILE-6,y+TILE,1,3);
    clB.fillStyle='#e0e0e0'; clB.fillRect(sx+TILE/2-2,y+3,4,3); }
  clB.fillStyle='#161410'; clB.fillRect(x,y-8,2*TILE-1,7); clB.fillStyle='#e6e0d0'; clB.font='6px Georgia'; clB.textAlign='center'; clB.textBaseline='alphabetic'; clB.fillText('WC',x+TILE,y-2); clB.textAlign='left';
  clSolid(x,y,2*TILE,2*TILE); }
function clMetalExit(){ const x=44*TILE, W=3*TILE;
  clB.fillStyle='#2a2c30'; clB.fillRect(x-2,0,W+4,2*TILE+2);
  clB.fillStyle='#3a3d42'; clB.fillRect(x,0,W,2*TILE);
  clB.fillStyle='#1c1e22'; clB.fillRect(x+2,2,W/2-3,2*TILE-4); clB.fillRect(x+W/2+1,2,W/2-3,2*TILE-4);
  clB.fillStyle='#4a4e54'; clB.fillRect(x+2,2,W/2-3,2); clB.fillRect(x+W/2+1,2,W/2-3,2);
  clB.fillStyle='#0e0f12'; clB.fillRect(x+W/2-1,4,2,2*TILE-8);
  clB.fillStyle='#c8c8d0'; clB.fillRect(x+W/2-5,TILE,2,4); clB.fillRect(x+W/2+3,TILE,2,4);
  clB.fillStyle='#3a1010'; clB.fillRect(x+W/2-3,3,6,3); clB.fillStyle='#ff3030'; clB.fillRect(x+W/2-2,3,4,2);
  clSolid(x-2,0,W+4,2*TILE-2);
  clubDoors.push({x:x, y:2*TILE-2, w:W, h:12, to:'mitte'});
  clInter(x,2*TILE-4,W,12,'Ausgang',['Zwei schwere Metalltueren, zwei Tuersteher davor. Der Weg zurueck nach draussen.']);
  clubGlows.push({x:x+W/2,y:3,r:10,c:'#ff3030'}); }
function clWaescheleine(){ const x0=27*TILE, x1=37*TILE, y=10*TILE+8;
  clB.fillStyle='#4a3626'; clB.fillRect(x0,y-8,3,3*TILE); clB.fillRect(x1,y-8,3,3*TILE);
  clB.fillStyle='#6a5238'; clB.fillRect(x0,y-8,3,2); clB.fillRect(x1,y-8,3,2);
  for(let x=x0+2;x<x1;x+=2){ const yy=y+Math.sin((x-x0)/(x1-x0)*Math.PI)*4; clA.fillStyle='#2a2018'; clA.fillRect(x,yy|0,2,1); }
  clSolid(x0,y,3,2*TILE-8); clSolid(x1,y,3,2*TILE-8);
  clInter(x0,y+2*TILE-10,x1-x0,10,'Waescheleine',['Eine Waescheleine quer durch den Club, auf der Kleidung im Kreis faehrt.','Jemand hat mal seine Jacke verloren. Jetzt dreht sie hier ewig ihre Runden.']);
  clubWaesche={x0,x1,y}; }
function drawClothing(c,x,y,i){ c.fillStyle='#2a2018'; c.fillRect(x,y-2,1,2);
  const cols=['#c8402c','#3a7ad0','#e6b83a','#3aa88a','#e34d8c','#6a6a72']; c.fillStyle=cols[i%cols.length]; const t=i%6;
  if(t===0){ c.fillRect(x-3,y,7,6); c.fillRect(x-5,y+1,2,3); c.fillRect(x+4,y+1,2,3); }
  else if(t===1){ c.fillRect(x-2,y,5,2); c.fillRect(x-2,y+2,2,6); c.fillRect(x+1,y+2,2,6); }
  else if(t===2){ c.fillRect(x-3,y,7,3); c.fillRect(x-2,y+3,5,6); }
  else if(t===3){ c.fillRect(x-1,y,3,7); }
  else if(t===4){ c.fillRect(x-4,y,9,6); c.fillRect(x-4,y,2,3); c.fillRect(x+3,y,2,3); }
  else { c.fillRect(x-3,y,7,2); c.fillRect(x-2,y+2,5,2); }
  c.fillStyle='rgba(255,255,255,0.12)'; c.fillRect(x-2,y,3,1); }
export function buildClub(){
  paintClubGround();
  clPalisade(); clRailing(); clBulbString();
  clBar(4,3,7);
  clFassPool(13,3);
  clDiscoBall(28*TILE, 22);
  clFeuertonne(33,4);
  clKarussell(21,8);
  clStage(38,4,10,6);
  clSpeaker(37,4); clSpeaker(47,4);
  clCouch(39,6); clCouch(43,6);        // schwarze Ledercouches auf der Buehne
  clDJBooth(38,10);                     // DJ-Booth VOR der Buehne
  clLoft();
  clMetalExit();
  clWaescheleine();
  clKlo(2,10); clPlant(35,12);
  clDeco();
  // (Ausgang jetzt oben rechts: clMetalExit)
  clubNpcs.push(
    // Owner (2. Stock) — End-Boss
    {x:40*TILE+4,y:3*TILE+4,sprite:'owner',dir:'down',who:'Owner',frame:0,lines:['Der Owner. Grauer Schopf, schwarze Lederjacke, Kette aus Gold, Blick aus Stein.','»Mein Laden. Meine Regeln. Willst du hier oben stehen, musst du erst durch alle da unten — und dann durch mich.«','(Man munkelt: nuechtern schlaegt ihn keiner.)']},
    // Tuersteher an den Metalltueren (Ausgang)
    {x:44*TILE,y:2*TILE+2,pal:PAL_WAITER,who:'Tuersteher',dir:'down',frame:0,lines:['Der Tuersteher nickt Richtung Metalltueren. »Raus geht immer.«','»Rein war schwerer, wa?«']},
    {x:46*TILE,y:2*TILE+2,pal:PAL_WAITER,who:'Tuersteher',dir:'down',frame:0,lines:['Arme verschraenkt, Blick geradeaus. Er sagt nichts.','Erst wenn der Owner faellt, gehoert dir der Laden. Nicht vorher.']},
    // Barkeeperin
    {x:6*TILE,y:3*TILE+2,sprite:'bark',dir:'down',who:'Barkeeperin',frame:0,lines:['Sie stellt ein Bier ab, ohne hinzusehen. »Was guckst du?«','»Trinkst du, oder willst du dich mit mir messen? Spoiler: beides endet schlecht fuer dich.«','(Fightbar — bald.)']},
    // Gnarley Gustav — Startup-Quest
    {x:16*TILE,y:7*TILE,pal:PAL_STUD2,who:'Gnarley Gustav',dir:'down',frame:0,lines:['»Yo! Gnarley Gustav. Ich mach was mit Impact.«','»Unser Startup ist quasi das Airbnb fuer Gefuehle. Introducing: synergy. This is so Berlin, honestly.«','»Als Case Study fuer self improvement, ganz ehrlich: du brauchst die Blue Punisher. Absoluter Gamechanger, next level, hat mein ganzes Mindset disrupted.«','»Frag den Typ in komplett Schwarz beim Klo. Sag, Gustav schickt dich. Scale your vibe, bro.«']},
    // Typ in Schwarz beim Klo — Dealer
    {x:5*TILE,y:10*TILE,pal:PAL_CLUB1,who:'Dealer',dir:'left',frame:0,lines:[]},
    // DJ VOR der Buehne
    {x:39*TILE,y:10*TILE,pal:PAL_HIP,who:'DJ',play:true,t:0,frame:0,dir:'down',lines:['Kopfnicken ist die einzige Antwort die du kriegst.','Der Drop kommt, wenn er kommt. Geduld.']},
    // Fass-Pool
    {x:14*TILE,y:3*TILE+2,pal:PAL_STUD1,who:'Planscher',dir:'up',frame:0,lines:['Wasser bis zum Hals, Grinsen bis zu den Ohren. Alles richtig gemacht.']},
    // Karussell
    {x:20*TILE-6,y:7*TILE,pal:PAL_GIRL,who:'Keta Paule',dir:'down',frame:0,lines:['Ich fahr seit drei Runden. Oder dreissig. Blud is hella trippin.','Dreh dich mit! Der Boden bewegt sich eh schon.']},
    {x:23*TILE,y:8*TILE+2,pal:PAL_CLUB3,who:'Raver',dir:'down',frame:0,lines:['Bro, ich fuehl die Vibes.','Runde fuer Runde, immer im Kreis. Sehr meditativ.']},
    // Feuertonne
    {x:32*TILE,y:5*TILE,pal:PAL_CLUB2,who:'Keta Paule',play:true,t:0.5,frame:0,lines:['Wie lang bist du denn schon hier drin? Deine Augen haben Dinge gesehen.','Warm hier. Bleib ein bisschen.']},
    // Floor-Crowd — alles Raver / Keta Paule / Startup-Futzi
    {x:10*TILE,y:8*TILE,pal:PAL_CLUB1,who:'Raver',play:true,t:0.2,frame:0,lines:['Damn, du hast ja mieseste Teller.','AUGEN ZU UND WEITER, DIGGA!']},
    {x:16*TILE,y:11*TILE,pal:PAL_GIRL,who:'Raver',play:true,t:1.1,frame:0,lines:['Dang, bist du auf Perks?','Seifenblasen! Guck, Seifenblasen!']},
    {x:26*TILE,y:9*TILE,pal:PAL_CLUB2,who:'Keta Paule',play:true,t:2.0,frame:0,lines:['Blud is hella trippin.','Ich spuer mein Gesicht nicht mehr und das ist gut so.']},
    {x:30*TILE,y:12*TILE,pal:PAL_CLUB3,who:'Raver',play:true,t:0.6,frame:0,lines:['Bro, ich fuehl die Vibes.','Der Holzboden federt. Perfekt gebaut.']},
    {x:12*TILE,y:12*TILE,pal:PAL_STUD1,who:'Startup-Futzi',play:true,t:1.5,frame:0,lines:['Ich hab die Nacht als OKR getrackt. Wir sind ahead of schedule.','Introducing: mein Bewegungsprofil. This is so Berlin.']},
    {x:22*TILE,y:6*TILE,pal:PAL_HIP,who:'Startup-Futzi',play:true,t:0.4,frame:0,lines:['Kennst du meinen Podcast? Case Study ueber self improvement auf dem Floor.','Lass connecten. Also spaeter. Wenn ich mein Gesicht wieder spuere.']},
    {x:9*TILE,y:6*TILE,pal:PAL_STUD2,who:'Raver',play:true,t:0.9,frame:0,lines:['Wie lang bist du schon hier drin? Deine Augen haben Dinge gesehen.','Ein Bier von ihr und du bist verliebt oder besiegt. Manchmal beides.']},
    // Ledercouch-Chiller
    {x:39*TILE+6,y:6*TILE+4,dir:'down',pal:PAL_GIRL,who:'Raver',frame:0,lines:['Schwarzes Leder, warmer Bass. Von hier oben gehoert dir der Laden.','Damn, du hast ja mieseste Teller.']},
    {x:43*TILE+6,y:6*TILE+4,dir:'down',pal:PAL_HIP,who:'Raver',frame:0,lines:['Beste Couch im Haus. Erkaempft, nicht gemietet.','Bro, ich fuehl die Vibes.']}
  );
}
export function blockedClub(nx,ny){ const fx=nx+4,fy=ny+15,fw=8,fh=6;
  if(fx<TILE||fy<TILE||fx+fw>CLUBPX-TILE||fy+fh>CLUBHPX-TILE) return true;
  for(const s of clubSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}
export function renderClub(){
  X.clearRect(0,0,LW,LH);
  X.drawImage(clubBelow, clubcamx,clubcamy,LW,LH, 0,0,LW,LH);
  const ents=[];
  ents.push({y:player.y+22,draw:()=>drawChar(X,(player.x-clubcamx)|0,(player.y-clubcamy)|0,player.dir,player.frame,PAL_PLAYER)});
  for(const n of clubNpcs) ents.push({y:n.y+22,draw:()=>{
    if(n.sprite==='owner') drawSpriteImg(OWNER_IMG,(n.x-clubcamx),(n.y-clubcamy));
    else if(n.sprite==='bark') drawSpriteImg(BARK_IMG,(n.x-clubcamx),(n.y-clubcamy));
    else drawChar(X,(n.x-clubcamx)|0,(n.y-clubcamy)|0,n.dir,n.frame||0,n.pal); }});
  ents.sort((a,b)=>a.y-b.y); for(const e of ents) e.draw();
  if(clubWaesche){ const x0=clubWaesche.x0,x1=clubWaesche.x1,wy=clubWaesche.y, span=x1-x0-8, N=6;
    for(let i=0;i<N;i++){ const p=((T*12+i*span/N)%span); const wx=x0+4+p; const yy=wy+Math.sin(p/span*Math.PI)*4;
      const sx=wx-clubcamx, sy=yy-clubcamy; if(sx<-12||sx>LW+12) continue; drawClothing(X,sx|0,sy|0,i); } }
  X.drawImage(clubAbove, clubcamx,clubcamy,LW,LH, 0,0,LW,LH);
  // Seifenblasen
  for(let i=0;i<18;i++){ const per=CLUBHPX+30; const wy=CLUBHPX-16-((T*(10+(i%5)*4)+i*97)%per); const wx=20+((i*41)%(CLUBPX-40))+Math.sin(T*0.8+i)*10;
    const sx=wx-clubcamx, sy=wy-clubcamy; if(sx<-8||sx>LW+8||sy<-8||sy>LH+8) continue; const r=2+(i%3);
    X.strokeStyle='rgba(200,230,255,0.5)'; X.fillStyle='rgba(180,215,255,0.10)'; X.beginPath(); X.arc(sx,sy,r,0,6.3); X.fill(); X.stroke();
    X.fillStyle='rgba(255,255,255,0.65)'; X.fillRect((sx-r/2)|0,(sy-r/2)|0,1,1); }
  drawLightClub();
  drawPunisherHUD();
}
function drawLightClub(){
  Lx.clearRect(0,0,LW,LH); Lx.fillStyle='rgba(14,10,22,0.40)'; Lx.fillRect(0,0,LW,LH);
  Lx.globalCompositeOperation='lighter'; const fl=reduce?1:0.8+0.2*Math.sin(T*3);
  for(const g of clubGlows){ const sx=g.x-clubcamx, sy=g.y-clubcamy; if(sx<-40||sx>LW+40||sy<-40||sy>LH+40) continue;
    const c=g.c||'#ffd24a'; const rg=Lx.createRadialGradient(sx,sy,0,sx,sy,g.r); rg.addColorStop(0,c); rg.addColorStop(1,'rgba(0,0,0,0)'); Lx.globalAlpha=0.34*fl; Lx.fillStyle=rg; Lx.fillRect(sx-g.r,sy-g.r,g.r*2,g.r*2); }
  Lx.globalAlpha=1;
  // Floor-Farblicht (Booth), pulsierend
  if(clubDisco){ const dcx=clubDisco.x-clubcamx, dcy=clubDisco.y-clubcamy;
    for(let i=0;i<12;i++){ const a=i/12*6.283+T*0.6; const rr=34+(i%3)*12; const sx=dcx+Math.cos(a)*rr, sy=dcy+46+Math.sin(a)*rr*0.5;
      Lx.fillStyle='hsla('+((i*30+T*70)%360)+',85%,66%,0.30)'; Lx.fillRect((sx-3)|0,(sy-3)|0,6,6); } }
  const bx=39.5*TILE-clubcamx, by=11*TILE-clubcamy; const hue=(T*40)%360;
  const fg=Lx.createRadialGradient(bx,by,10,bx,by,120); fg.addColorStop(0,'hsla('+hue+',80%,60%,0.5)'); fg.addColorStop(1,'rgba(0,0,0,0)'); Lx.fillStyle=fg; Lx.fillRect(bx-120,by-120,240,240);
  Lx.globalCompositeOperation='source-over'; X.drawImage(lightCv,0,0);
}
export function enterClub(){ showDistrictLoad(CLUB_LOADSCREEN, ()=>{
  G.scene='club'; clearSitting(); player.x=clubEntry.x; player.y=clubEntry.y; player.dir='right'; player.frame=0; setEnterCool(0.5);
  setClubCam(clamp(player.x+8-LW/2,0,CLUBPX-LW), clamp(player.y+16-LH/2,0,CLUBHPX-LH));
  setBanner('Heideglühen','Club · Open Air'); showBanner(); toast('Drinnen: Holz, Bass, Seifenblasen. Ganz hinten oben wartet der Owner.',3200); }); }
export function exitClub(){ G.scene='mitte'; clearSitting(); player.x=clubReturn.x; player.y=clubReturn.y; player.dir=clubReturn.dir; player.frame=0; setEnterCool(0.5);
  setMitCam(clamp(player.x+8-LW/2,0,MITPX-LW), clamp(player.y+16-LH/2,0,MITHPX-LH));
  setBanner('Mitte','High-Level-Bezirk'); showBanner(); }
