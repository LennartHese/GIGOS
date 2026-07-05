import { LW, LH, TILE, MAPW, MAPH, WPX, HPX, X, C, reduce } from '../core/constants.js';
import { px, shadow, canopy } from '../core/canvas.js';
import { hash, clamp } from '../core/math.js';
import { G } from '../core/state.js';
import { player } from '../entities/player.js';
import { drawChar, drawSit, PAL_PLAYER, PAL_OMA } from '../entities/drawChar.js';
import { setBanner, showBanner } from '../ui/banner.js';
import { rollWild } from '../data/encounters.js';
import { startBattle } from '../systems/battle.js';
import { setCafeReturn } from './cafe.js';
import { setWohnungReturn } from './wohnung.js';
import { drawUbahnSign, setStationReturn } from './ubahn.js';
import { setSpaetiReturn } from './spaeti.js';
import {
  T, lightCv, Lx, encCool, sitting, grassFlash, setGrassFlash,
  ccamx, ccamy, setCcam, clastTile, setClastTile, showDistrictLoad, drunk, chatNPC,
} from '../main.js';

/* ======================================================================
   CHARLOTTENBURG-WILMERSDORF — zweiter Bezirk (eigene Overworld)
   ====================================================================== */
const CHB_LOADSCREEN="assets/images/chb-loadscreen.jpg";
let churchCv=null; // prozedural gezeichneter »hohler Zahn« (siehe buildChurchSprite)

const cBelow=document.createElement('canvas'); cBelow.width=WPX; cBelow.height=HPX;
const cAbove=document.createElement('canvas'); cAbove.width=WPX; cAbove.height=HPX;
const cB=cBelow.getContext('2d'), cA=cAbove.getContext('2d');
cB.imageSmoothingEnabled=false; cA.imageSmoothingEnabled=false;
// exported so club.js's paintClubGround() can keep its original bug: it
// clobbers CHB's ground array to all-1 instead of its own clbground
// (pre-existing in the source file, preserved verbatim during the refactor).
export const cground=new Uint8Array(MAPW*MAPH);
const cgi=(x,y)=>y*MAPW+x;
function cfill(code,x0,y0,x1,y1){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) if(x>=0&&y>=0&&x<MAPW&&y<MAPH) cground[cgi(x,y)]=code; }

export const chbSolids=[], chbInters=[], chbDoors=[], chbNpcs=[], chbGlows=[];
function cSolid(x,y,w,h){ chbSolids.push({x,y,w,h}); }
function cInter(x,y,w,h,who,lines){ chbInters.push({x,y,w,h,who,lines}); }

const chbEntry={x:16*TILE, y:22*TILE};
let chbReturn={x:248, y:108, dir:'down'};
const CHURCH={x:5*TILE, y:6*TILE, w:120, h:120};

const PAL_BOULE={coat:'#8a5a3a',coatHi:'#a4744f',coatLo:'#6e4630',pants:'#3a3328',shoe:'#2a2118',skin:'#e8c39a',hair:'#3a2a1a'};
const PAL_CHESS={coat:'#46607a',coatHi:'#5a7892',coatLo:'#36506a',pants:'#3a3f4a',shoe:'#2a2118',skin:'#d8b48a',hair:'#cfc7c2'};
export const PAL_GIRL ={coat:'#b5486a',coatHi:'#cf6386',coatLo:'#923a55',pants:'#4a4452',shoe:'#2a2118',skin:'#e8c39a',hair:'#5a3a22'};
// Schnoesel — Sakko/Steppweste, glattes Haar
const PAL_SNOB1={coat:'#2f4256',coatHi:'#41596f',coatLo:'#243748',pants:'#cdbfa0',shoe:'#3a2a1a',skin:'#f0d0a8',skinHi:'#f8dcb8',hair:'#caa23a'};
const PAL_SNOB2={coat:'#7a3b3b',coatHi:'#9a5252',coatLo:'#5e2c2c',pants:'#d8cdb4',shoe:'#3a2a1a',skin:'#ecc8a2',skinHi:'#f6d8b4',hair:'#3a2a1a'};
// Mate-Studenten — Armyjacke / Strickpulli, entspannt
export const PAL_STUD1={coat:'#5a6a3a',coatHi:'#72844c',coatLo:'#46522c',pants:'#2f3540',shoe:'#2a2118',skin:'#e8c39a',hair:'#3a2a1a'};
export const PAL_STUD2={coat:'#8a6a4a',coatHi:'#a4845f',coatLo:'#6e5236',pants:'#3a3f4a',shoe:'#2a2118',skin:'#d8b48a',hair:'#6a4a2a',curly:true};
// Geschwister — alle blond
const PAL_LENNART={coat:'#6f9ac0',coatHi:'#8ab6d8',coatLo:'#547ea2',pants:'#3a4150',shoe:'#2a2118',skin:'#e8c39a',skinHi:'#f0d0a8',hair:'#5a3a22',neck:true};
const PAL_GOLO   ={coat:'#4a8a5a',coatHi:'#62a472',coatLo:'#386e46',pants:'#4a3f2c',shoe:'#2a2118',skin:'#e8c39a',hair:'#6a4a2a'};
const PAL_LENI   ={coat:'#c4708a',coatHi:'#dc8aa4',coatLo:'#9e5670',pants:'#4a4452',shoe:'#2a2118',skin:'#f0d0a8',hair:'#e6c862'};
const PAL_VICI   ={coat:'#8a6aaa',coatHi:'#a484c4',coatLo:'#6e5288',pants:'#403a4c',shoe:'#2a2118',skin:'#f0d0a8',hair:'#e8cc6a',curly:true};

function cTile(x,y,code){
  const X0=x*TILE,Y0=y*TILE;
  if(code===0||code===7){
    cB.fillStyle=C.grassBase; cB.fillRect(X0,Y0,TILE,TILE);
    for(let i=0;i<10;i++){ const xx=hash(i,x*7+y)*TILE|0, yy=hash(i+9,x+y*5)*TILE|0, r=hash(i+3,x*y+1);
      cB.fillStyle = r<.5?C.grassHi:C.grassLo; cB.fillRect(X0+xx,Y0+yy,1, r<.4?2:1); }
    if(code===7){ for(let i=0;i<7;i++){ const gx=X0+(hash(i,x+3)*14|0), gy=Y0+(hash(i+4,y+2)*10|0);
      cB.fillStyle = hash(i,x+y)<.4?C.tgrassHi:C.tgrass; cB.fillRect(gx,gy,1,3+(hash(i,x)*2|0)); } }
  } else if(code===3){
    cB.fillStyle='#3a3a40'; cB.fillRect(X0,Y0,TILE,TILE);
    for(let i=0;i<6;i++){ cB.fillStyle=hash(i,x+y)<.5?'#343438':'#42424a'; cB.fillRect(X0+(hash(i,x)*TILE|0),Y0+(hash(i+2,y)*TILE|0),2,1); }
    if(y===18 && (x%2===0)){ cB.fillStyle='#c9b483'; cB.fillRect(X0+4,Y0+7,8,2); }
  } else if(code===2){
    cB.fillStyle='#6a6258'; cB.fillRect(X0,Y0,TILE,TILE);
    for(let yy=0;yy<TILE;yy+=4)for(let xx=0;xx<TILE;xx+=4){ cB.fillStyle=hash(xx+yy,x+y)<.5?'#746c60':'#5e574e'; cB.fillRect(X0+xx,Y0+yy,3,3); }
  } else if(code===5){
    cB.fillStyle='#7a7068'; cB.fillRect(X0,Y0,TILE,TILE);
    for(let i=0;i<5;i++){ cB.fillStyle=hash(i,x+y)<.5?'#857a70':'#6e645c'; cB.fillRect(X0+(hash(i,x)*TILE|0),Y0+(hash(i+1,y)*TILE|0),2,2); }
  } else if(code===6){
    cB.fillStyle='#b89b6a'; cB.fillRect(X0,Y0,TILE,TILE);
    for(let i=0;i<6;i++){ cB.fillStyle=hash(i,x+y)<.5?'#c7ac7c':'#a98c5e'; cB.fillRect(X0+(hash(i,x)*TILE|0),Y0+(hash(i+2,y)*TILE|0),2,2); }
  }
}
function paintCHBGround(){
  for(let i=0;i<cground.length;i++) cground[i]=0;
  cfill(3, 1,17, MAPW-2,19);
  cfill(2, 1,16, MAPW-2,16);
  cfill(2, 1,20, MAPW-2,20);
  cfill(2, 14,20, 18,25);
  cfill(2, 30,20, 31,25);   // Gehweg runter zum neuen Ausgang unten rechts (Tempelhof-Schoeneberg)
  cfill(6, 24,4, 29,8);
  cfill(7, 3,3, 8,7);
  cfill(7, 11,3, 15,6);
  cfill(5, 4,12, 13,16);
  cfill(2, 21,0, 22,16);   // Durchgang nach Norden (spaeter: Mitte)
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++) cTile(x,y,cground[cgi(x,y)]);
}

const ALTBAU_PALS=[
  {wall:'#9e4a39',wallHi:'#b65b48',wallLo:'#7c3a2c',st:'#e7ddc8',stHi:'#f4ecda',stSh:'#c2b496',frame:'#caa46a',brickLines:true,roof:'#4a4652',roofHi:'#5e5868'},
  {wall:'#d8cdb4',wallHi:'#e8dfca',wallLo:'#b6a988',st:'#efe7d4',stHi:'#fbf5e6',stSh:'#c4b693',frame:'#b98f53',roof:'#4a4652',roofHi:'#5e5868'},
  {wall:'#a85842',wallHi:'#c06a50',wallLo:'#86412f',st:'#e9e0cc',stHi:'#f6eedd',stSh:'#c6b89a',frame:'#caa46a',brickLines:true,roof:'#3f4450',roofHi:'#535868'},
  {wall:'#cfc3a8',wallHi:'#e0d6bf',wallLo:'#aa9c7c',st:'#f0e8d6',stHi:'#fcf6e8',stSh:'#c0b290',frame:'#b98f53',roof:'#3f4450',roofHi:'#535868'}
];
// Gründerzeit-Altbau: Backstein/Stuck, Giebelbekroenungen, Eckquader, Zahnschnittgesims
function chbAltbau(tx,ty,tw,o){
  const x=tx*TILE, y=ty*TILE, w=tw*TILE, h=46;
  const wall=o.wall,wallHi=o.wallHi,wallLo=o.wallLo, st=o.st,stHi=o.stHi,stSh=o.stSh;
  const glass='#243038',glassHi='#3a4a56',glassLo='#1a1f26', iron='#23232a';
  shadow(cB,x+3,y+h-2,w-6,6);
  px(cB,x,y,w,h,wall); px(cB,x,y,w,1,wallHi); px(cB,x+w-3,y,3,h,wallLo);
  if(o.brickLines) for(let by=y+6;by<y+h-7;by+=3) px(cB,x+5,by,w-10,1,wallLo);
  // Eckquader
  for(let i=0;i<8;i++){ const qy=y+2+i*6;
    px(cB,x,qy,5,4,st); px(cB,x,qy,5,1,stHi); px(cB,x,qy+4,5,1,stSh);
    px(cB,x+w-6,qy,5,4,st); px(cB,x+w-6,qy,5,1,stHi); px(cB,x+w-6,qy+4,5,1,stSh); }
  // Hauptgesims mit Zahnschnitt
  px(cB,x,y,w,4,st); px(cB,x,y,w,1,stHi); px(cB,x,y+4,w,1,stSh);
  for(let dx=2;dx<w-2;dx+=4) px(cB,x+dx,y+4,2,1,stSh);
  // Gurtgesims
  px(cB,x,y+22,w,2,st); px(cB,x,y+22,w,1,stHi); px(cB,x,y+23,w,1,stSh);
  // genutete Sockelzone
  px(cB,x,y+h-7,w,7,st); px(cB,x,y+h-7,w,1,stHi);
  for(let dx=0;dx<w;dx+=8) px(cB,x+dx,y+h-7,1,7,stSh);
  // Fenster mit Bekroenung + Balkonen
  const cols=Math.max(2,tw-1), inset=8, span=w-2*inset, step=cols>1?span/(cols-1):0;
  for(let r=0;r<2;r++){ const fy=r===0?y+9:y+27;
    for(let cI=0;cI<cols;cI++){ const fx=x+inset+cI*step-3;
      px(cB,fx-2,fy-1,1,13,stSh); px(cB,fx+7,fy-1,1,13,stHi);
      px(cB,fx,fy,7,12,glass); px(cB,fx,fy,7,1,glassHi); px(cB,fx,fy+11,7,1,glassLo);
      px(cB,fx+3,fy,1,12,o.frame); px(cB,fx,fy+5,7,1,o.frame);
      px(cB,fx-1,fy+12,9,1,st);
      if((cI+r)%2===0){ px(cB,fx-1,fy-2,9,1,st); px(cB,fx+1,fy-4,5,1,st); px(cB,fx+2,fy-5,3,1,stHi); px(cB,fx+3,fy-6,1,1,stHi); }
      else { px(cB,fx-1,fy-2,9,1,st); px(cB,fx,fy-3,7,1,st); px(cB,fx+1,fy-4,5,1,stHi); px(cB,fx+2,fy-5,3,1,stHi); }
      if(r===0 && cI%2===1){ px(cB,fx-2,fy+13,11,1,iron); for(let b=fx-1;b<fx+9;b+=2) px(cB,b,fy+14,1,3,iron); px(cB,fx-2,fy+17,11,1,iron); }
    } }
  // Traufgesims/Dach in cA
  px(cA,x-1,y-6,w+2,6,o.roof); px(cA,x-1,y-6,w+2,2,o.roofHi);
  px(cA,x-2,y-1,w+4,2,st); px(cA,x-2,y-1,w+4,1,stHi);
  if(o.door){
    const dxw=18, ddx=x+(w>>1)-9, dby=y+h;
    // heller Stuck-Tuerrahmen
    px(cB, ddx-3, y+16, dxw+6, h-16, '#e7ddc8'); px(cB, ddx-3, y+16, dxw+6, 2, '#f4ecda');
    px(cB, ddx-3, y+16, 2, h-16, '#d2c6ae'); px(cB, ddx+dxw+1, y+16, 2, h-16, '#cabd9f');
    // Oberlicht (Rundbogen-Transom)
    px(cB, ddx, y+17, dxw, 6, glass); px(cB, ddx+1, y+18, dxw-2, 1, glassHi);
    px(cB, ddx+dxw/2-3|0, y+18, 6, 4, '#3a4f5a');
    // dunkles Holz, zweifluegelig
    px(cB, ddx, y+23, dxw, dby-(y+23), '#5a3a24'); px(cB, ddx, y+23, dxw, 2, '#74502e');
    px(cB, (ddx+dxw/2-0.5)|0, y+25, 1, dby-(y+25), '#3a2414');
    for(let p=0;p<2;p++){ const px0=ddx+2+p*((dxw/2)|0);
      px(cB, px0, y+27, (dxw/2-4)|0, 8, '#4a2e18'); px(cB, px0, y+38, (dxw/2-4)|0, 6, '#4a2e18'); }
    // Griffe + warmer Spalt + Stufe
    px(cB, (ddx+dxw/2-3)|0, y+33, 1, 3, '#caa23a'); px(cB, (ddx+dxw/2+2)|0, y+33, 1, 3, '#caa23a');
    px(cB, (ddx+dxw/2-2)|0, dby-7, 4, 6, '#caa24a');
    px(cB, ddx-2, dby-2, dxw+4, 2, '#9a8a6a');
    // Solid gesplittet + Tuer-Trigger + Rueckkehrpunkt
    cSolid(x, y+6, (ddx)-x, h-6);
    cSolid(ddx+dxw, y+6, (x+w)-(ddx+dxw), h-6);
    chbDoors.push({x:ddx, y:dby-10, w:dxw, h:12, to:'wohnung'});
    setWohnungReturn({x:(ddx+dxw/2-8)|0, y:dby+2, dir:'down'});
  } else {
    cSolid(x,y+6,w,h-6);
  }
  if(o.lines) cInter(x+(w>>1)-8,y+h-14,16,14,'Altbau',o.lines);
}
function chbSpaeti(tx,ty){
  const x=tx*TILE,y=ty*TILE,w=56,h=40;
  shadow(cB,x+3,y+h-2,w-6,6);
  px(cB,x,y,w,h,'#b7995f'); px(cB,x,y,w,2,'#d3b984'); px(cB,x+w-3,y,3,h,'#8a7042'); px(cB,x,y+h-3,w,3,'#8a7042');
  // beleuchtetes Schild — zwei zentrierte Zeilen, korrekte Grundlinie
  px(cB,x+3,y+2,w-6,15,'#161320'); px(cB,x+3,y+2,w-6,1,'#2a2436'); px(cB,x+3,y+16,w-6,1,'#0c0a14');
  cB.textAlign='center'; cB.textBaseline='alphabetic';
  cB.fillStyle='#62d0ff'; cB.font='bold 8px Arial'; cB.fillText('GETRÄNKE',x+w/2,y+10);
  cB.fillStyle='#ff6aa6'; cB.fillText('BÄRLIN',x+w/2-5,y+16);
  cB.textAlign='left';
  // Plueschbaer in der Ecke vom Schild
  const bx=x+w-13; px(cB,bx,y+10,7,6,'#7a5436'); px(cB,bx,y+10,2,2,'#7a5436'); px(cB,bx+5,y+10,2,2,'#7a5436'); px(cB,bx+2,y+12,1,1,'#1a1410'); px(cB,bx+4,y+12,1,1,'#1a1410');
  // Schaufenster + Tuer (nach unten gerueckt unters Schild)
  px(cB,x+5,y+19,18,16,'#243038'); px(cB,x+5,y+19,18,2,'#3a4a56');
  px(cB,x+33,y+19,18,16,'#243038'); px(cB,x+33,y+19,18,2,'#3a4a56');
  px(cB,x+25,y+21,8,14,'#3a2a1a'); px(cB,x+25,y+21,8,2,'#5a4632');
  for(let i=0;i<3;i++){ px(cB,x+w+1+i*7,y+h-7,6,7,'#2a6a3a'); for(let b=0;b<4;b++) px(cB,x+w+2+i*7+(b%2)*3,y+h-6+(b>1?3:0),2,2,'#caa23a'); cSolid(x+w+1+i*7,y+h-7,6,7); }
  cSolid(x,y+4,w,h-4);
  cInter(x+22,y+h-14,16,14,'Spaeti',['Getraenke Baerlin — »Ham wa, wa nich, ham wa nich.«','Club-Mate eiskalt, Sterni fuer 90 Cent, und ein Plueschbaer der seit 2009 im Regal sitzt und alles weiss.']);
}
// "All About West" — Cafe-Fassade (Altbau-EG, offene Faltglasfront). Innenraum/begehbar folgt.
function chbCafe(tx,ty){
  const x=tx*TILE, y=ty*TILE, tw=7, w=tw*TILE, h=54;
  const st='#dcd2bc', stHi='#efe7d4', stSh='#c2b48f', stDk='#b6a988';
  const band='#34363c', bandHi='#44464c', frame='#23231f', frameHi='#3a3a32';
  const burg='#5a2230', burgHi='#6e2c3c', burgLo='#431826';
  const wood='#9a6a3a', woodHi='#b0824c', woodLo='#73502c', glow='#ffcf7a', warm='#e8b85a';
  shadow(cB, x+3, y+h-2, w-6, 7);
  // Stuck-Bruestung oben
  px(cB,x,y,w,16,st); px(cB,x,y,w,1,stHi); px(cB,x,y+15,w,1,stSh);
  for(let i=0;i<2;i++){ const qy=y+2+i*6; px(cB,x,qy,5,4,st); px(cB,x,qy,5,1,stHi); px(cB,x,qy+4,5,1,stSh);
    px(cB,x+w-6,qy,5,4,st); px(cB,x+w-6,qy,5,1,stHi); px(cB,x+w-6,qy+4,5,1,stSh); }
  const mx=x+(w>>1);
  px(cB,mx-8,y+3,16,9,stDk); px(cB,mx-7,y+3,14,1,stHi); px(cB,mx-9,y+5,1,5,stSh); px(cB,mx+8,y+5,1,5,stHi);
  px(cB,mx-5,y+5,10,5,st); px(cB,mx-3,y+6,6,3,stHi);
  px(cB,mx-13,y+6,3,3,stHi); px(cB,mx+10,y+6,3,3,stHi);
  // Schildband
  const by=y+16;
  px(cB,x+1,by,w-2,11,band); px(cB,x+1,by,w-2,1,bandHi); px(cB,x+1,by+10,w-2,1,'#1d1e22');
  cB.textBaseline='alphabetic'; cB.textAlign='left';
  cB.fillStyle='#f4efe6'; cB.font='italic 11px Georgia'; cB.fillText('all about', x+7, by+9);
  const aw=cB.measureText('all about').width;
  cB.font='8px Arial'; cB.fillStyle='#d8d2c6'; cB.fillText('– west berlin', x+9+aw, by+9);
  // Faltglasfront / Schaufenster
  const sy=by+12, sh=h-(sy-y)-3;
  px(cB,x+2,sy,w-4,sh,frame); px(cB,x+2,sy,w-4,1,frameHi);
  px(cB,x+5,sy+2,w-10,sh-3,burg); px(cB,x+5,sy+2,w-10,2,burgLo);
  px(cB,x+8,sy+4,w-16,4,burgHi);
  px(cB,x+8,sy+sh-9,w-16,7,wood); px(cB,x+8,sy+sh-9,w-16,1,woodHi);
  px(cB,x+11,sy+sh-14,8,6,'#2a2226'); px(cB,x+12,sy+sh-13,2,2,warm); px(cB,x+16,sy+sh-13,2,2,'#8aa0b0');
  const pq=x+(w>>1)+6; px(cB,pq,sy+sh-15,3,3,'#241c20'); px(cB,pq-1,sy+sh-12,5,4,'#2c2228');
  px(cB,x+w-16,sy+5,8,1,wood); for(let i=0;i<3;i++) px(cB,x+w-15+i*3,sy+3,1,2,i?'#7a8a6a':'#9a7a4a');
  for(let i=0;i<3;i++){ const lx=x+10+i*((w-20)/2); px(cB,lx,sy+2,1,3,'#2a2226'); px(cB,lx-1,sy+5,3,3,glow); px(cB,lx,sy+6,1,1,'#fff3d2'); }
  px(cB,x+8,sy+2,1,3,'#2a2226'); px(cB,x+6,sy+4,5,3,'#3f6a30'); px(cB,x+7,sy+6,1,2,'#52844a'); px(cB,x+9,sy+6,1,2,'#52844a');
  for(let s=0;s<2;s++){ const px0 = s===0 ? x+3 : x+w-9;
    for(let p=0;p<2;p++){ const gx=px0+p*3;
      px(cB,gx,sy+2,2,sh-4,'#2c3a40'); px(cB,gx,sy+2,2,1,'#54707c'); px(cB,gx,sy+(sh>>1),2,1,'#1c2228'); } }
  px(cB,mx-7,sy+sh-2,14,2,'#6a5238');
  // offene Eingangstuer (Mitte) — begehbar
  px(cB,mx-9,sy,18,sh,frame); px(cB,mx-9,sy,18,1,frameHi);
  px(cB,mx-7,sy+1,14,sh-1,'#3a1820');                 // dunkler Flur
  px(cB,mx-6,sy+2,12,4,'#6e2c3c');                    // warmer Schein hinten
  px(cB,mx-5,sy+sh-7,10,5,'#caa24a'); px(cB,mx-4,sy+sh-7,8,1,'#e8c266'); // Lichtfleck/Boden
  px(cB,mx-2,sy+1,2,sh-1,'#1a0e12');                  // offener Tuerfluegel
  px(cB,mx-10,sy+sh,20,2,'#6a5238');                  // Schwelle/Matte
  // Aussenmoblierung (dekorativ, nicht solide)
  const fy=y+h+2;
  function chair(cx,cy){ px(cB,cx,cy+2,4,2,wood); px(cB,cx,cy+2,4,1,woodHi); px(cB,cx,cy,1,2,woodLo); px(cB,cx,cy+4,1,2,woodLo); px(cB,cx+3,cy+4,1,2,woodLo); }
  function bistro(bx){ chair(bx-5,fy+2); chair(bx+12,fy+2);
    px(cB,bx,fy,12,3,woodHi); px(cB,bx,fy,12,1,'#c89a5e'); px(cB,bx+1,fy+3,2,6,woodLo); px(cB,bx+9,fy+3,2,6,woodLo);
    shadow(cB,bx-4,fy+9,20,3); }
  bistro(x+7); bistro(x+w-28);
  const tb=x+w+3;
  px(cB,tb,fy-4,11,15,'#5a4a32'); px(cB,tb+1,fy-3,9,13,'#2c322c'); px(cB,tb+1,fy-3,9,1,'#3e463e');
  px(cB,tb+2,fy-1,7,1,'#cfcabe'); px(cB,tb+2,fy+2,5,1,'#b6b1a4'); px(cB,tb+2,fy+5,6,1,'#b6b1a4'); px(cB,tb+3,fy+8,4,1,'#cfcabe');
  shadow(cB,tb,fy+10,11,3);
  // Gesims in cA
  px(cA,x-1,y-3,w+2,4,'#3a3a32'); px(cA,x-1,y-3,w+2,1,'#52524a');
  px(cA,x-2,y,w+4,2,st); px(cA,x-2,y,w+4,1,stHi);
  // Fassade solide, Mitte (Tuer) offen
  cSolid(x,y+6,(mx-9)-x,h-8);
  cSolid(mx+9,y+6,(x+w)-(mx+9),h-8);
  chbDoors.push({x:mx-9,y:sy,w:18,h:sh+4,to:'cafe'});
  setCafeReturn({x:mx-8,y:y+h+2,dir:'down'});
  cInter(x+8,y+h-4,16,12,'All About West',
    ['All About West — Faltfront offen, Flat White dampft, irgendwo laeuft was mit viel Hall.','Die Tuer steht offen. Riecht nach Kaffee und alten Buechern. Geh rein.']);
}

function chbBench(tx,ty){ const x=tx*TILE,y=ty*TILE+9; shadow(cB,x+1,y+5,14,3);
  px(cB,x,y,16,3,'#3a6a3a'); px(cB,x,y+3,16,2,'#2c5a2c'); px(cB,x+1,y+5,2,4,'#5a4632'); px(cB,x+13,y+5,2,4,'#5a4632');
  cSolid(x,y,16,6); cInter(x,y-4,16,12,'Bank',['Eine Bank am Parkrand. Aufkleber auf der Lehne: »BVG — weil wir muessen«.']); }
function chbTree(tx,ty){ const x=tx*TILE+8,y=ty*TILE;
  px(cB,x-1,y+10,3,8,'#4a3522'); canopy(cA, x, y+2, 14, 12, C.grass, (tx*7+ty)|0); cSolid(x-2,y+14,6,5); }
function chbLamp(tx,ty){ const x=tx*TILE+6,y=ty*TILE;
  px(cB,x,y+2,2,14,'#2a2a30'); px(cA,x-3,y,8,4,'#3a3a42'); px(cA,x-2,y+1,6,2,'#ffcf7a'); chbGlows.push({x:x+1,y:y+3,r:16}); }

function buildChurchSprite(){
  churchCv=document.createElement('canvas'); churchCv.width=CHURCH.w; churchCv.height=CHURCH.h;
  const c=churchCv.getContext('2d'); c.imageSmoothingEnabled=false;
  const stone='#9a8f7c', hi='#bcae96', mid='#857b69', sh='#5f5749', dk='#433d33';
  const glass='#356a9c', glassHi='#62a6dd';
  shadow(c, 18, 110, 84, 5);
  // Schiff / Sockel
  px(c,26,70,68,40,stone); px(c,26,70,68,3,hi); px(c,88,70,6,40,sh); px(c,26,106,68,4,dk);
  px(c,20,110,80,4,mid); px(c,20,110,80,1,hi); px(c,16,114,88,3,sh);
  for(let i=0;i<3;i++){ const wx=34+i*20;
    px(c,wx,82,10,20,dk); px(c,wx+1,84,8,18,glass); px(c,wx+1,84,8,2,glassHi); px(c,wx+1,84,3,18,glassHi);
    px(c,wx,80,10,3,mid); px(c,wx+2,79,6,2,mid); }
  // Turm
  const tx=46, tw=28;
  px(c,tx,18,tw,54,stone); px(c,tx,18,tw,3,hi); px(c,tx+tw-5,18,5,54,sh); px(c,tx,18,3,54,hi);
  for(let i=1;i<4;i++) px(c,tx+i*7,20,1,50,sh);
  for(let i=0;i<2;i++){ const wx=tx+5+i*12;
    px(c,wx,30,7,16,dk); px(c,wx+1,32,5,14,glass); px(c,wx+1,32,2,14,glassHi); px(c,wx,28,7,3,mid); }
  px(c,tx+10,52,8,8,hi); px(c,tx+11,53,6,6,mid); px(c,tx+14,54,1,3,dk); px(c,tx+14,55,3,1,dk);
  // gebrochene Krone (»hohler Zahn«) — links hoeher, rechts abgeschert
  const crown=[[0,12],[3,7],[6,10],[9,4],[12,8],[15,3],[18,6],[21,2],[24,5],[27,3]];
  for(let i=0;i<crown.length;i++){ const a=crown[i], cx=a[0], ch=a[1];
    px(c,tx+cx,18-ch,3,ch+2,stone); px(c,tx+cx,18-ch,3,2,hi); px(c,tx+cx+2,18-ch,1,ch,sh);
    px(c,tx+cx-1,20-ch,1,ch,dk); }
}
export function buildCHB(){
  paintCHBGround();
  buildChurchSprite();
  chbTree(31,12); chbTree(3,11);
  cSolid(CHURCH.x+24, CHURCH.y+CHURCH.h-22, CHURCH.w-48, 18);
  cInter(CHURCH.x+30, CHURCH.y+CHURCH.h-16, CHURCH.w-60, 16, 'Gedaechtniskirche',
    ['Die Kaiser-Wilhelm-Gedaechtniskirche. Der »hohle Zahn« — oben abgebrochen, absichtlich nie ganz repariert. Mahnmal mitten im Trubel.',
     'Drinnen leuchtet blaues Glas. Draussen rauscht der Verkehr, als waere nichts.']);
  chbSpaeti(24,15);
  chbDoors.push({x:405,y:281,w:16,h:10,to:'spaeti'});
  setSpaetiReturn('chb',{x:409,y:290,dir:'down'});
  drawUbahnSign(cB,204,184); cInter(196,182,20,26,'U-Bahn',[]);
  setStationReturn('chb',{x:210,y:210,dir:'down'});
  // durchgehende Gruenderzeit-Zeile am oberen Strassenrand (Blockrandbebauung) — mit Durchgang
  for(let i=0;i<8;i++){ if(i===5) continue; const p=ALTBAU_PALS[i%4]; chbAltbau(i*4,0,4, i===4?Object.assign({},p,{door:true}):p); }
  chbAltbau(32,0,2, ALTBAU_PALS[1]);
  chbCafe(14,13);
  chbBench(9,5); chbBench(18,8);
  chbLamp(8,16); chbLamp(26,16); chbLamp(30,16); chbLamp(12,9);
  chbDoors.push({x:15*TILE,y:24*TILE,w:2*TILE,h:TILE,to:'town'});
  chbDoors.push({x:32*TILE,y:17*TILE,w:2*TILE,h:2*TILE,to:'mitte'});
  chbDoors.push({x:30*TILE,y:24*TILE,w:2*TILE,h:TILE,to:'tempelhof'});   // eigener Weg unten rechts
  cInter(31*TILE,17*TILE,2*TILE,2*TILE,'→ Mitte',['Nach Osten geht es rein nach Mitte. Fernsehturm, Alex, enge Strassen, teurer Kaffee. Und angeblich Level, die dir dein Team zerlegen.']);
  cInter(14*TILE,23*TILE,2*TILE,TILE,'→ Zehlendorf',['Der Weg zurueck nach Sueden — Richtung Zehlendorf. Ruhiger wird es da, das stimmt.']);
  chbNpcs.push(
    {x:25*TILE,y:5*TILE,dir:'right',pal:PAL_BOULE,who:'Boule-Olaf',play:true,t:0,frame:0,
      lines:['Ssscht — ich konzentrier mich.','Boule ist Schach fuer Leute die lieber draussen saufen.'], talk:()=>bouleOlafTalk()},
    {x:27*TILE,y:6*TILE,dir:'left',pal:PAL_CHESS,who:'Schach-Renate',play:true,t:1,frame:0,
      lines:['Matt in drei. Setz dich, wenn du verlieren willst.','Frueher hab ich am Wittenbergplatz gespielt. Da war noch Niveau.']},
    {x:26*TILE,y:7*TILE,dir:'down',pal:PAL_GIRL,who:'Frisbee-Kid',play:true,t:2,frame:0,
      lines:['Wirf zurueck! ...Ne, lieber nich, du siehst nich so aus als ob.','Im hohen Gras huepft staendig was weg wenn meine Scheibe reinfliegt.']},
    {x:7*TILE,y:16*TILE+4,dir:'down',pal:PAL_OMA,who:'Kirchen-Oma',wander:true,base:7*TILE,t:0,frame:0,
      lines:['Der hohle Zahn, ja. Steht da seit ich denken kann.','Setz dich nicht ins hohe Gras, Kindchen. Da wohnt was.']},
    {x:30*TILE,y:4*TILE,dir:'down',pal:PAL_SNOB1,who:'Schnoesel Henning',play:true,t:0.5,frame:0,
      lines:['Erbpacht. Drei Generationen. Man kennt sich.','Joggen? Wir haben Leute, die das fuer uns erledigen.'], talk:()=>henningTalk()},
    {x:2*TILE,y:7*TILE,dir:'down',pal:PAL_SNOB2,who:'Schnoesel Constantin',play:true,t:1.5,frame:0,
      lines:['Charlottengrad, mein Bester. Hier wohnt das alte Geld.','Ein Gigo? Wie putzig. Wir haben dafuer eine Galerie.']},
    {x:5*TILE,y:15*TILE,dir:'right',pal:PAL_STUD1,who:'Mate-Student',play:true,t:0.2,frame:0,
      lines:['Mate macht wach, Bahn faehrt eh nich.','Zone-2-Lauftraining? Ich bin in Zone Mate.']},
    {x:8*TILE,y:15*TILE,dir:'left',pal:PAL_STUD2,who:'Mate-Studentin',play:true,t:1.2,frame:0,
      lines:['Frag mich bloss nich nach meiner Hausarbeit-Deadline.','Im hohen Gras hopst was rum. Ich bleib lieber sitzen.']},
    {x:11*TILE,y:14*TILE,dir:'down',pal:PAL_STUD1,who:'Mate-Student',play:true,t:2.1,frame:0,
      lines:['Pfand sammeln is auch eine Form von BAFoeG.','Ne, das Gras da fang ich nich an. Da wohnt wat.']},
    {x:15*TILE,y:9*TILE,dir:'down',pal:PAL_LENNART,who:'Lennart (Der Lange)',frame:0,
      lines:['Ich bin der Aelteste, ich halt hier die Stellung.','Komm spaeter nochmal — wir brauchen bald jemanden mit Gigos.']},
    {x:17*TILE,y:9*TILE,dir:'down',pal:PAL_GOLO,who:'Golo',frame:0,
      lines:['Vici hat wieder wat in der Brennnessel-Ecke verbummelt.','Typisch die Kleine. Lennart regelt das. Oder du.']},
    {x:16*TILE,y:10*TILE,dir:'down',pal:PAL_LENI,who:'Leni',frame:0,
      lines:['Wenn du echt Gigos faengst — wir haetten bald wat fuer dich.','Noch nich. Bald. Pass solang auf dich auf.']},
    {x:18*TILE,y:10*TILE,dir:'left',pal:PAL_VICI,who:'Vici',frame:0,
      lines:['Pssst. Ich plan wat. Die andern wissens noch nich.','Sag Lennart nix, ja?']}
  );
}
function bouleOlafTalk(){
  if(drunk>0){ chatNPC('Boule-Olaf',['Ah, ein Getraenk intus? Jetzt reden wir mal Boule auf Augenhoehe, Kumpel!','Setz dich, ich zeig dir den perfekten Wurf. Nach dem dritten klappt er sogar.']); return; }
  chatNPC('Boule-Olaf',['Ssscht — ich konzentrier mich.','Boule ist Schach fuer Leute die lieber draussen saufen.']);
}
function henningTalk(){
  if(drunk>0){ chatNPC('Schnoesel Henning',['Riecht hier jemand nach Discounter-Sekt? Wie... unfein.','Bitte halten Sie Abstand. Man kennt sich, aber nicht SO.']); return; }
  chatNPC('Schnoesel Henning',['Erbpacht. Drei Generationen. Man kennt sich.','Joggen? Wir haben Leute, die das fuer uns erledigen.']);
}

export function blockedCHB(nx,ny){ const fx=nx+4,fy=ny+15,fw=8,fh=6;
  if(fx<TILE||fy<TILE||fx+fw>WPX-TILE||fy+fh>HPX-TILE) return true;
  for(const s of chbSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}
export function checkEncounterCHB(){
  const tx=(player.x+8)/TILE|0, ty=(player.y+16)/TILE|0;
  const t=cground[cgi(clamp(tx,0,MAPW-1),clamp(ty,0,MAPH-1))];
  if(t===7){ const id=ty*MAPW+tx;
    if(id!==clastTile && encCool<=0){ setClastTile(id);
      if(Math.random()<0.22){ const w=rollWild('chb'); setGrassFlash(0.5); startBattle(w.id,w.lv,'chb'); } } }
  else setClastTile(-1);
}
export function renderCHB(){
  X.clearRect(0,0,LW,LH);
  X.drawImage(cBelow, ccamx,ccamy,LW,LH, 0,0,LW,LH);
  const ents=[];
  ents.push({y:player.y+22,draw:()=> sitting?drawSit(X,player.x-ccamx,player.y-ccamy,PAL_PLAYER):drawChar(X,player.x-ccamx,player.y-ccamy,player.dir,player.frame,PAL_PLAYER)});
  for(const n of chbNpcs) ents.push({y:n.y+22,draw:()=>drawChar(X,(n.x-ccamx)|0,(n.y-ccamy)|0,n.dir,n.frame||0,n.pal)});
  if(churchCv)
    ents.push({y:CHURCH.y+CHURCH.h-6, draw:()=>X.drawImage(churchCv, (CHURCH.x-ccamx)|0,(CHURCH.y-ccamy)|0, CHURCH.w,CHURCH.h)});
  ents.sort((a,b)=>a.y-b.y); for(const e of ents) e.draw();
  X.drawImage(cAbove, ccamx,ccamy,LW,LH, 0,0,LW,LH);
  if(grassFlash>0){ X.fillStyle='rgba(120,200,90,'+(grassFlash*0.5)+')'; X.fillRect(0,0,LW,LH); }
  drawLightCHB();
}
function drawLightCHB(){
  Lx.clearRect(0,0,LW,LH);
  Lx.fillStyle='rgba(30,22,40,0.12)'; Lx.fillRect(0,0,LW,LH);
  let v=Lx.createRadialGradient(LW/2,LH/2,60,LW/2,LH/2,210); v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(6,5,12,0.52)');
  Lx.fillStyle=v; Lx.fillRect(0,0,LW,LH);
  Lx.globalCompositeOperation='lighter';
  const fl=reduce?1:0.85+0.15*Math.sin(T*3);
  for(const g of chbGlows){ const sx=g.x-ccamx, sy=g.y-ccamy; if(sx<-30||sx>LW+30||sy<-30||sy>LH+30) continue;
    const rg=Lx.createRadialGradient(sx,sy,0,sx,sy,g.r); rg.addColorStop(0,'rgba(255,200,120,'+(0.42*fl)+')'); rg.addColorStop(1,'rgba(255,200,120,0)');
    Lx.fillStyle=rg; Lx.fillRect(sx-g.r,sy-g.r,g.r*2,g.r*2); }
  Lx.globalCompositeOperation='source-over';
  X.drawImage(lightCv,0,0);
}

export function enterCHB(){
  showDistrictLoad(CHB_LOADSCREEN, ()=>{
    G.scene='chb'; player.x=chbEntry.x; player.y=chbEntry.y; player.dir='up'; player.frame=0;
    setCcam(clamp(player.x+8-LW/2,0,WPX-LW), clamp(player.y+16-LH/2,0,HPX-LH));
    setBanner('Charlottenburg-Wilmersdorf','Bezirk'); showBanner();
  });
}
export function exitCHB(){
  G.scene='town'; player.x=chbReturn.x; player.y=chbReturn.y; player.dir=chbReturn.dir; player.frame=0;
  setBanner('Zehlendorf Mitte','Bezirk'); showBanner();
}
