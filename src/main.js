"use strict";
/* ======================================================================
   GIGOS · Zehlendorf Mitte  — 2D top-down, eigene Pixel-Art
   Alles prozedural gezeichnet. Keine Fremd-Assets. Licht von oben-links.
   ====================================================================== */
import { LW, LH, TILE, MAPW, MAPH, WPX, HPX, cv, X, reduce, C } from './core/constants.js';
import { hash, clamp, lerp, pick } from './core/math.js';
import { LEAF_LINDEN, LEAF_OAK, canopy, px, dot, shadow, fit } from './core/canvas.js';
import { G } from './core/state.js';
import { MOVES } from './data/moves.js';
import { GIGODEX } from './data/gigodex.js';
import { drawGigoStub, GIGO_IMG, GIGO_TINT } from './entities/creatures.js';
import { LEVEL_CAP, rollWild } from './data/encounters.js';
import { STARTERS } from './data/starters.js';
import { keys } from './core/input.js';
import { drawChar, drawSit, PAL_PLAYER, PAL_OMA, PAL_KID, PAL_HAZE, PAL_PASSI } from './entities/drawChar.js';
import { player, movePlayer, facingTo, frontPoint } from './entities/player.js';
import { setBanner, showBanner } from './ui/banner.js';
import { toast } from './ui/toast.js';
import { openDialog, advanceDialog, choiceState, closeChoice, openChoice, renderChoices, moveChoice, pickChoice } from './systems/dialogue.js';
import { invOpen, inventory, addItem, renderInv, toggleInv, closeInv } from './systems/inventory.js';
import { DEX_PAGES, dexPage, dexGridGeom, DEXC, drawBerlinodexIcon, parchmentBG, dexCard, dexFitName, renderDexEntry, openDexEntry, closeDexEntry, dexEntryKey, renderDex, openDex, closeDex, dexKey, drawMonAt } from './systems/dex.js';
import { storage, pendingCatch, setPendingCatch, openTeam, closeTeam, teamKey, openCatchChoice, catchChoose, catchKey, renderTeam, renderCatchChoice } from './systems/party.js';
import { readyEvolution, applyEvolution, startEvolution, updateEvolve, evolveKey, renderEvolve } from './systems/evolution.js';
import { makeGigo, kapselAt, drawKeta, caughtRacoon, startBattle, battleKey, renderBattle, updateBattle } from './systems/battle.js';
import { blockedEfes, setEfesReturn, buildEfes, enterEfes, exitEfes, talkDoener, renderEfes, tickHealFx } from './world/efes.js';
import { setCafeReturn, buildCafe, talkBarista, enterCafe, exitCafe, blockedCafe, renderCafe, cafeNpcs, cafeInters } from './world/cafe.js';
import { setWohnungReturn, buildWohnung, enterWohnung, exitWohnung, blockedWohnung, renderWohnung, wohnungNpcs, wohnungInters } from './world/wohnung.js';
import {
  setEicheReturn, blockedEiche, buildEiche, enterEiche, exitEiche, talkSoeren, renderEiche,
  obenUnlocked, blockedEicheOben, buildEicheOben, renderEicheOben, enterEicheOben, exitEicheOben,
  drawFade, stepCutscene, stepReveal, selectStarter, getStarterPick, grantStarter, wrapCenter,
  STC, renderStarterSelect, renderStarterConfirm, starterKey, talkSoerenOben,
} from './world/eiche.js';

const LOADSCREEN="assets/images/loadscreen.jpg";

/* ======================================================================
   GROUND-/COLLISION-AUFBAU  (regionsbasiert -> wenig Fehlerquelle)
   tile codes: 0 grass · 1 walk · 2 cobble · 3 road · 4 water · 5 plaza
               6 dirt · 7 tallgrass
   ====================================================================== */
const ground=new Uint8Array(MAPW*MAPH);   // default 0 = grass
const gi=(x,y)=>y*MAPW+x;
function fillRect(code,x0,y0,x1,y1){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) if(x>=0&&y>=0&&x<MAPW&&y<MAPH) ground[gi(x,y)]=code; }

// Straße (Teltower Damm) – Asphalt-Band quer
fillRect(3,0,14,MAPW-1,16);
// Gehwege beidseitig
fillRect(1,0,13,MAPW-1,13);
fillRect(1,0,17,MAPW-1,17);
// Rathaus-Vorplatz (Plaza) im Norden
fillRect(5,10,9,21,12);
// Verbindungsweg Platz -> Straße
fillRect(2,15,9,16,13);
// Eichen-Anger (Grün + Platzrand) Ost
fillRect(5,21,7,27,8);
// (Teich entfernt — Fläche links vom Rathaus ist jetzt Grün)
// Park West mit großem Wiesen-Areal (hohes Gras, inkl. ehemaliger Teichfläche)
fillRect(0,1,2,8,6);
fillRect(7,2,3,8,11);
// Süd-Gehweg vor den Läden + kleine Plätze
fillRect(1,0,18,MAPW-1,18);
fillRect(2,5,18,9,18);  fillRect(2,12,18,16,18);  fillRect(2,19,18,23,18);
// Cobble-Wege vor Eingängen
fillRect(2,7,22,8,22); fillRect(2,14,22,15,22); fillRect(2,21,22,22,22);
fillRect(2,25,22,26,24);  // Süd-Eingang Efes (Weg vom Gehweg ums Haus zur Tür)

/* solid rects (Welt-px) & Interaktionen werden beim Objekt-Bau gefüllt */
const solids=[];   // {x,y,w,h}
const inters=[];   // {x,y,w,h,who,lines}
const doors=[];    // {x,y,w,h,to}  Eingänge (Auto-Enter)
function solid(x,y,w,h){ solids.push({x,y,w,h}); }
function inter(x,y,w,h,who,lines){ inters.push({x,y,w,h,who,lines}); }

/* ======================================================================
   MAP-LAYER vor-rendern:  BELOW (Boden+Basen)  /  ABOVE (Kronen+Dächer)
   ====================================================================== */
const below=document.createElement('canvas'); below.width=WPX; below.height=HPX;
const above=document.createElement('canvas'); above.width=WPX; above.height=HPX;
const B=below.getContext('2d'), A=above.getContext('2d');
B.imageSmoothingEnabled=false; A.imageSmoothingEnabled=false;

/* ---------- Boden-Tiles malen ---------- */
function tileGrass(x,y){ const px0=x*TILE,py0=y*TILE;
  B.fillStyle=C.grassBase; B.fillRect(px0,py0,TILE,TILE);
  // feine, nahtlose Tönung (keine Tile-Kanten mehr)
  for(let yy=0;yy<TILE;yy++)for(let xx=0;xx<TILE;xx++){ const r=hash(px0+xx,py0+yy);
    if(r<0.14){ B.fillStyle = r<0.05?C.grass[3]:C.grass[2]; B.fillRect(px0+xx,py0+yy,1,1); } }
  // wenige Grashalme
  for(let i=0;i<3;i++){ const r=hash(x*7+i,y*13); const gx=px0+2+(hash(i,x+y)*(TILE-4)|0), gy=py0+3+(hash(i+9,x-y)*(TILE-5)|0);
    B.fillStyle = r<.5?C.grassLo:C.grassHi; B.fillRect(gx,gy,1, r<.4?2:1); }
}
function tileWalk(x,y){ const px0=x*TILE,py0=y*TILE;
  B.fillStyle=pick(C.walk,x,y); B.fillRect(px0,py0,TILE,TILE);
  // Plattenfugen
  B.fillStyle=C.walkLo;
  for(let i=0;i<TILE;i+=8){ B.fillRect(px0+i,py0,1,TILE); B.fillRect(px0,py0+i,TILE,1); }
  for(let i=0;i<6;i++){ const sx=px0+(hash(x+i,y)*TILE|0),sy=py0+(hash(y,x+i)*TILE|0); B.fillStyle=hash(i,x+y)<.5?C.walkLo:C.walk[2]; B.fillRect(sx,sy,1,1); }
}
function tileCobble(x,y){ const px0=x*TILE,py0=y*TILE;
  B.fillStyle=C.cobbleGrout; B.fillRect(px0,py0,TILE,TILE);
  for(let cy=0;cy<TILE;cy+=4)for(let cx=0;cx<TILE;cx+=4){ const r=hash(x*16+cx,y*16+cy);
    B.fillStyle=C.cobble[(r*C.cobble.length)|0]; B.fillRect(px0+cx,py0+cy,3,3);
    if(r<.3){ B.fillStyle=C.cobble[3]; B.fillRect(px0+cx,py0+cy+2,3,1);} }
}
function tilePlaza(x,y){ const px0=x*TILE,py0=y*TILE;
  B.fillStyle=pick(C.plaza,x,y); B.fillRect(px0,py0,TILE,TILE);
  B.fillStyle=C.walkLo;
  for(let i=0;i<TILE;i+=8){ B.fillRect(px0,py0+i,TILE,1); B.fillRect(px0+i,py0,1,TILE);}
  for(let i=0;i<4;i++){ B.fillStyle=hash(i,x*y)<.5?C.plaza[2]:C.walkLo; B.fillRect(px0+(hash(i,x)*TILE|0),py0+(hash(i,y)*TILE|0),1,1);}
}
function tileRoad(x,y){ const px0=x*TILE,py0=y*TILE;
  B.fillStyle=C.road; B.fillRect(px0,py0,TILE,TILE);
  for(let i=0;i<14;i++){ B.fillStyle=hash(x*5+i,y*3)<.5?C.roadHi:'#46444a'; B.fillRect(px0+(hash(i,x)*TILE|0),py0+(hash(i,y)*TILE|0),1,1);}
  // Mittellinie auf Reihe 15 (gestrichelt)
  if(y===15){ if((x%2)===0){ B.fillStyle=C.roadLine; B.fillRect(px0+4,py0+TILE/2-1,8,2);} }
}
function tileWater(x,y){ const px0=x*TILE,py0=y*TILE;
  B.fillStyle=C.water; B.fillRect(px0,py0,TILE,TILE);
  for(let i=0;i<6;i++){ const wy=py0+2+i*2+((x+ (i&1))%2); B.fillStyle=hash(x,y*9+i)<.5?C.waterHi:C.waterLo; B.fillRect(px0+1+((i*3)%TILE),wy,5,1);}
}
function tileTall(x,y){ const px0=x*TILE,py0=y*TILE;
  B.fillStyle=C.tgrassLo; B.fillRect(px0,py0,TILE,TILE);
  for(let i=0;i<26;i++){ const gx=px0+(hash(x*9+i,y)*TILE|0), gy=py0+4+(hash(i,y*7+x)*(TILE-4)|0);
    B.fillStyle = hash(i,x+y)<.4?C.tgrassHi:C.tgrass; B.fillRect(gx,gy,1, 3+ (hash(i,x)*2|0)); }
}
function tileDirt(x,y){ const px0=x*TILE,py0=y*TILE; B.fillStyle=pick(C.dirt,x,y); B.fillRect(px0,py0,TILE,TILE);
  for(let i=0;i<8;i++){ B.fillStyle=hash(i,x+y)<.5?C.dirt[1]:'#7a5e3a'; B.fillRect(px0+(hash(i,x)*TILE|0),py0+(hash(i,y)*TILE|0),1,1);}
}
function paintGround(){
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++){
    switch(ground[gi(x,y)]){
      case 0: tileGrass(x,y);break; case 1: tileWalk(x,y);break; case 2: tileCobble(x,y);break;
      case 3: tileRoad(x,y);break; case 4: tileWater(x,y);break; case 5: tilePlaza(x,y);break;
      case 6: tileDirt(x,y);break; case 7: tileGrass(x,y), tileTall(x,y);break;
    }
  }
  // Teich-Ufer
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++){ if(ground[gi(x,y)]===4){
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(d=>{ const nx=x+d[0],ny=y+d[1];
      if(nx>=0&&ny>=0&&nx<MAPW&&ny<MAPH && ground[gi(nx,ny)]!==4){ B.fillStyle=C.waterEdge;
        B.fillRect(x*TILE+(d[0]>0?TILE-2:0),y*TILE+(d[1]>0?TILE-2:0), d[0]?2:TILE, d[1]?2:TILE);} });
  }}
  // Wasser als solid (man läuft nicht rein)
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++) if(ground[gi(x,y)]===4) solid(x*TILE,y*TILE,TILE,TILE);
}

/* ======================================================================
   OBJEKTE  (zeichnen direkt auf BELOW + ABOVE, registrieren solid/inter)
   ====================================================================== */
// weicher Schatten (auf BELOW, leicht transparent)

/* ---------- Straßenlaterne (Berliner Bogenlampe) ---------- */
const glows=[]; // {x,y,r,col,kind}
function lamp(tx,ty){ const x=tx*TILE+8, y=ty*TILE+16;
  shadow(B,x-3,y-2,8,3);
  px(B,x-1,y-22,3,22,C.lamp); px(B,x-2,y,5,2,'#2a2730');     // Mast
  // Bogen
  B.strokeStyle=C.lamp; B.lineWidth=2; B.beginPath(); B.moveTo(x,y-21); B.quadraticCurveTo(x+7,y-26,x+9,y-21); B.stroke();
  px(B,x+7,y-23,5,4,'#2a2730');                              // Kopf
  px(B,x+8,y-20,3,2,C.lampGlow);                             // Glühbirne
  solid(x-2,y-4,6,5);
  glows.push({x:x+9,y:y-19,r:30,col:'rgba(255,214,150,', kind:'lamp'});
  inter(x-4,y-6,10,8,'Laterne',['Eine Gaslaterne aus Gusseisen. Sie summt leise und wirft einen warmen Kegel auf das Kopfsteinpflaster.']);
}

/* ---------- Linde / Straßenbaum ---------- */
function linden(tx,ty,big){ const x=tx*TILE+8, y=ty*TILE+15, s=big?1.3:1;
  shadow(B,x-7*s,y-1,14*s,4);
  px(B,x-2,y-13,4,13,C.trunk); px(B,x-2,y-13,1,13,C.trunkLo); px(B,x+1,y-13,1,13,C.trunkHi);
  canopy(A, x, (y-19*s)|0, (10*s)|0, (9*s)|0, LEAF_LINDEN, tx*13+ty);
  solid(x-3,y-4,7,5);
}

/* ---------- Hecke / Waldrand (Begrenzung) ---------- */
function hedge(tx,ty){ const x=tx*TILE,y=ty*TILE;
  for(let i=0;i<26;i++){ const hx=x+(hash(tx+i,ty)*TILE|0), hy=y+(hash(i,ty+tx)*TILE|0);
    B.fillStyle=hash(i,tx)<.3?C.leafHi:pick(C.leaf,tx,i); B.fillRect(hx,hy,2,2);}
  B.fillStyle=C.leafGap; for(let i=0;i<3;i++) B.fillRect(x+(hash(i,tx)*TILE|0),y+TILE-2,2,1);
  solid(x,y,TILE,TILE);
}

/* ---------- DIE ZEHLENDORF-EICHE (Hero) ---------- */
function eiche(tx,ty){ const x=tx*TILE, y=ty*TILE; const cx=x+19;
  shadow(B,x-4,y+18,46,10);
  // Wurzeln + knorriger Stamm
  px(B,x+9,y+20,8,5,C.trunkLo); px(B,x+21,y+20,8,5,C.trunkLo);
  px(B,x+13,y+2,12,22,C.trunk);
  px(B,x+13,y+2,2,22,C.trunkLo); px(B,x+23,y+2,2,22,C.trunkLo); px(B,x+17,y+2,2,22,C.trunkHi);
  for(let i=0;i<9;i++){ px(B,x+14+((hash(i,tx)*9)|0),y+4+i*2,2,1,C.trunkLo); } // Rinde
  // niedriger Holzzaun (gegründet, vorne) + Plakette auf Pfosten
  B.fillStyle=C.woodLo; for(let fx=x+2;fx<=x+34;fx+=6){ B.fillRect(fx,y+22,2,7); } B.fillRect(x+2,y+23,34,2);
  px(B,x+29,y+24,10,8,'#5a4a3a'); px(B,x+30,y+25,8,5,C.parch); px(B,x+33,y+30,1,4,C.woodLo); // Plakette
  // gewaltige, dichte Krone (mehrlobig) auf ABOVE
  canopy(A, cx,    y-6,  30, 25, LEAF_OAK, 11);
  canopy(A, cx-21, y+2,  18, 16, LEAF_OAK, 23);
  canopy(A, cx+21, y+1,  19, 16, LEAF_OAK, 31);
  canopy(A, cx-3,  y-21, 20, 15, LEAF_OAK, 47);
  for(let i=0;i<6;i++){ A.fillStyle=C.trunkLo; A.fillRect((cx-22+i*9),(y+6+(hash(i,tx)*8|0)),2,5); } // Zweige
  solid(x+12,y+18,16,8);
  doors.push({x:x+13,y:y+23,w:14,h:9,to:'eiche'});
  setEicheReturn({x:x+13,y:y+35,dir:'down'});
  inter(x+4,y+16,32,14,'Zehlendorf-Eiche',[
    'Die Zehlendorf-Eiche. Über 300 Jahre alt — älter als der Bezirk selbst.',
    'Die Plakette ist verwittert. Jemand hat mit Kreide darunter gekritzelt: »sie hört zu«.',
    'Nachts, sagen die Alten, raschelt sie auch ohne Wind.']);
}

/* ---------- Gebäude-Baukasten ---------- */
function building(x,y,w,h,opt){ // x,y px (linke obere Ecke des Körpers), h = Körperhöhe (ohne Dach)
  const o=opt||{}; const wall=o.wall||C.sand, sh=o.sh||C.sandSh;
  shadow(B,x+3,y+h-3,w-6,6);
  // Körper
  px(B,x,y,w,h,wall);
  px(B,x,y,w,2,o.hi||'#e8d3a8');           // Glanzkante oben
  px(B,x+w-3,y,3,h,sh);                     // rechte Schattenwand
  px(B,x,y+h-3,w,3,sh);                     // Sockel
  // Mauerwerk-Textur
  for(let i=0;i<w*h/14;i++){ B.fillStyle=hash(x+i,y)<.5?sh:wall; B.fillRect(x+ (hash(i,x)*(w-2)|0)+1, y+2+(hash(i,y)*(h-4)|0),1,1);}
  // Dach
  const rh=o.roofH||12, rc=o.roof||C.roofRed, rhi=o.roofHi||C.roofRedHi, rlo=o.roofLo||C.roofRedLo;
  if(o.gable){ // Giebel (Dreieck)
    for(let i=0;i<rh;i++){ const ww=w*(1-i/rh); A.fillStyle = i<2?rhi:rc; A.fillRect((x+(w-ww)/2)|0, y-rh+i, ww|0, 1);}    
  } else {
    A.fillStyle=rc; A.fillRect(x-2,y-rh,w+4,rh);
    A.fillStyle=rhi; A.fillRect(x-2,y-rh,w+4,2);
    A.fillStyle=rlo; A.fillRect(x-2,y-3,w+4,3);
    for(let i=0;i<w;i+=4){ A.fillStyle=rlo; A.fillRect(x+i,y-rh,1,rh);} // Ziegel-Riefen
  }
  // Fenster mit warmem Glühen
  const wins=o.wins||[];
  wins.forEach(p=>{ const fx=x+p[0],fy=y+p[1],fw=p[2]||5,fh=p[3]||7;
    px(B,fx-1,fy-1,fw+2,fh+2,sh);
    px(B,fx,fy,fw,fh,C.win);
    px(B,fx,fy,fw,fh,o.dark?C.win:C.winGlow);
    if(!o.dark){ px(B,fx,fy,fw,2,C.winGlowSoft); }
    px(B,fx+(fw>>1),fy,1,fh,sh); px(B,fx,fy+(fh>>1),fw,1,sh); // Sprossen
    if(!o.dark) glows.push({x:fx+fw/2,y:fy+fh/2,r:16,col:'rgba(255,220,150,',kind:'win'});
  });
  // Tür
  if(o.door){ const dx=x+o.door[0],dy=y+h-o.door[1];
    px(B,dx-1,dy-1,o.door[2]+2,o.door[1]+1,sh); px(B,dx,dy,o.door[2],o.door[1],C.woodLo);
    px(B,dx+1,dy+1,o.door[2]-2,o.door[1]-2,C.wood); px(B,dx+o.door[2]-3,dy+ (o.door[1]>>1),1,1,'#e8d33a'); }
  solid(x,y+2,w,h-2);
}

/* ---------- Markise + Schild ---------- */
function awning(x,y,w,col){ for(let i=0;i<w;i+=4){ B.fillStyle=((i>>2)&1)?col:'#f4ecd6'; B.fillRect(x+i,y,4,4);} B.fillStyle='rgba(0,0,0,.2)'; B.fillRect(x,y+4,w,1); }
function sign(x,y,w,h,bg,txt,col){ B.fillStyle=bg;B.fillRect(x,y,w,h); B.fillStyle='rgba(0,0,0,.35)';B.fillRect(x,y+h-1,w,1);
  B.fillStyle=col;B.font='6px Georgia';B.textBaseline='top'; B.fillText(txt, x+2, y+1); }

/* ---------- RATHAUS ---------- */
function rathaus(tx,ty){ const x=tx*TILE,y=ty*TILE,w=128,h=54;
  building(x,y,w,h,{wall:C.sand,sh:C.sandSh,roof:C.slate,roofHi:C.slateHi,roofLo:C.slateLo,roofH:13,
    wins:[[10,12],[24,12],[64,12],[78,12],[104,12],[118,12],[10,30],[24,30],[104,30],[118,30]],
    door:[58,16,14]});
  // Arkaden im Erdgeschoss (image 4)
  for(let i=0;i<3;i++){ const ax=x+40+i*16; px(B,ax,y+h-18,12,18,C.sandSh);
    A.fillStyle=C.sand; A.fillRect(ax,y+h-18,12,4); px(B,ax+2,y+h-14,8,14,'#3a3038'); }
  // Uhrturm mittig
  const txw=18, tx0=x+w/2-txw/2;
  px(B,tx0,y-22,txw,24,C.sand); px(B,tx0,y-22,txw,2,'#e8d3a8'); px(B,tx0+txw-3,y-22,3,24,C.sandSh);
  A.fillStyle=C.slate; A.fillRect(tx0-2,y-34,txw+4,12); // Spitzdach
  for(let i=0;i<12;i++){ const ww=(txw+4)*(1-i/12); A.fillStyle=i<2?C.slateHi:C.slate; A.fillRect((tx0-2+((txw+4)-ww)/2)|0,y-34+i,ww|0,1);}
  px(B,tx0+txw/2-3,y-18,6,6,C.parch); B.fillStyle=C.ink; B.fillRect(tx0+txw/2,y-15,2,1); B.fillRect(tx0+txw/2,y-15,1,2); // Uhr
  A.fillStyle='#caa23a'; A.fillRect(tx0+txw/2-1,y-36,2,3);  // Spitze
  solid(tx0,y-22,txw,24);
  inter(x+50,y+h-18,28,18,'Rathaus Zehlendorf',[
    'Rathaus Zehlendorf. Backstein, Sandstein, eine Uhr, die seit Jahren dieselbe Minute zeigt.',
    'Geschlossen. Öffnet Mo–Fr. Hinter den Fenstern brennt trotzdem Licht.']);
}

/* ---------- LÄDEN ---------- */
function baeckerei(tx,ty){ const x=tx*TILE,y=ty*TILE,w=64,h=40;
  building(x,y,w,h,{wall:'#d9c7a0',sh:'#b89a6e',roof:C.roofRed,roofH:11,
    wins:[[6,10],[44,10]], door:[26,16,12]});
  awning(x+2,y+h-22,28,'#b14334'); sign(x+34,y+h-24,26,8,'#3a2a1a','Bäckerei','#f4d96a');
  // Brot im Schaufenster
  px(B,x+44,y+h-12,5,3,'#c79a55'); px(B,x+50,y+h-12,5,3,'#b8863f');
  inter(x+24,y+h-16,16,16,'Bäckerei Krause',[
    'Bäckerei Krause. Es riecht nach Schrippen und Franzbrötchen.',
    '»Wat darfs denn sein?« — Geöffnet, aber drinnen ist gerade niemand zu sehen.']);
}
function spaeti(tx,ty){ const x=tx*TILE,y=ty*TILE,w=56,h=38;
  building(x,y,w,h,{wall:'#c2b48f',sh:'#9c8d68',roof:'#5a5560',roofHi:'#6e6878',roofH:10,
    wins:[[6,9],[40,9]], door:[24,16,11]});
  // Neon "SPÄTI"
  px(B,x+8,y+h-26,40,8,'#1a1620'); B.fillStyle='#ff5fa2';B.font='7px Georgia';B.fillText('SPÄTI',x+12,y+h-25);
  glows.push({x:x+28,y:y+h-22,r:14,col:'rgba(255,95,162,',kind:'win'});
  // Getränkekisten draußen
  for(let i=0;i<3;i++){ px(B,x+w+1+i*7,y+h-7,6,7,'#2a6a3a'); for(let b=0;b<4;b++) px(B,x+w+2+i*7+(b%2)*3,y+h-6+(b>1?3:0),2,2,'#caa23a'); solid(x+w+1+i*7,y+h-7,6,7);} 
  inter(x+24,y+h-16,16,16,'Späti',[
    'Späti — 24h, theoretisch. »Ham wa.« Alles außer dem, was du gerade suchst.',
    'Die Club-Mate ist aber immer eiskalt. Daneben summt der Kühlschrank im Dunkeln.']);
}
function blumen(tx,ty){ const x=tx*TILE,y=ty*TILE,w=52,h=36;
  building(x,y,w,h,{wall:'#cdbfa0',sh:'#a89878',roof:'#6a7a4a',roofHi:'#7e9058',roofH:9,
    wins:[[6,9],[36,9]], door:[22,15,10]});
  // Blumeneimer draußen
  const cols=['#d6486a','#e8a93a','#c45fd6','#e86a48'];
  for(let i=0;i<4;i++){ const bx=x-2+i*7; px(B,bx,y+h-6,5,6,'#7a6a55'); px(B,bx+1,y+h-9,3,3,cols[i]); solid(bx,y+h-6,5,6);} 
  inter(x+22,y+h-15,14,15,'Blumen Lindemann',[
    'Blumen Lindemann. Eimer voller Tulpen, Nelken, irgendwas Welkendes ganz hinten.',
    'Im Schaufenster ein einzelner Strauß, der nie verkauft wird.']);
}

function efes(tx,ty){ const x=tx*TILE,y=ty*TILE,w=56,h=38; const b=y+h;
  shadow(B,x+3,y+h-3,w-6,6);
  // Körper (Klinker/Sandstein)
  px(B,x,y,w,h,'#c8a98a'); px(B,x,y,w,2,'#dcc0a0'); px(B,x+w-3,y,3,h,'#a8876a'); px(B,x,y+h-3,w,3,'#a8876a');
  for(let i=0;i<w*h/16;i++){ B.fillStyle=hash(x+i,y)<.5?'#b89372':'#c8a98a'; B.fillRect(x+(hash(i,x)*(w-2)|0)+1,y+4+(hash(i,y)*16|0),1,1);}
  // Dach (ABOVE)
  A.fillStyle='#7a4a3a'; A.fillRect(x-2,y-9,w+4,9); A.fillStyle='#8e5a48'; A.fillRect(x-2,y-9,w+4,2);
  for(let i=0;i<w+4;i+=4){ A.fillStyle='#6a3e30'; A.fillRect(x-2+i,y-9,1,9); }
  // rote EFES-GRILL Leuchtreklame (Süd, über dem Eingang)
  px(B,x+5,b-30,46,8,'#2a1410'); B.fillStyle='#ef5446'; B.font='bold 7px Georgia'; B.textBaseline='top'; B.fillText('EFES GRILL',x+7,b-29);
  glows.push({x:x+28,y:b-26,r:15,col:'rgba(239,84,70,',kind:'win'});
  // Schaufenster links + Dönerspieß
  px(B,x+5,b-20,18,17,'#243038'); px(B,x+6,b-19,16,15,'#36505e');
  px(B,x+13,b-18,3,14,'#7a4a2c'); px(B,x+12,b-16,5,9,'#9a6a40'); px(B,x+12,b-16,5,3,'#b6824e'); // Spieß+Fleisch
  glows.push({x:x+14,y:b-11,r:11,col:'rgba(255,170,80,',kind:'win'});
  // Efes-Pils-Fenster rechts (blau)
  px(B,x+38,b-20,13,17,'#243038'); px(B,x+39,b-19,11,15,'#2a5a9a'); px(B,x+41,b-17,7,3,'#dfe7f0');
  // Tür (Süd-Eingang) + blaue Markise drüber
  px(B,x+22,b-14,12,14,'#2a1c14'); px(B,x+23,b-13,10,14,'#4a3320'); px(B,x+24,b-7,1,2,'#e8d33a');
  for(let i=0;i<14;i+=4){ B.fillStyle=((i>>2)&1)?'#1f5fae':'#e6edf4'; B.fillRect(x+21+i,b-18,4,4); } px(B,x+21,b-14,14,1,'#163f73');
  solid(x,y+2,w,h-2);
  // Fußmatte aufm Gras davor (Süden) + Auto-Enter-Zone
  px(B,x+23,b,12,4,'#7a3a30'); px(B,x+25,b+1,8,1,'#9a5a4a');
  doors.push({x:x+21,y:b+1,w:16,h:12,to:'efes'});
  setEfesReturn({x:x+21,y:b+9,dir:'down'});
  inter(x+5,b-20,18,16,'Efes Grill',['Efes Grill — Döner, Bistro, Café. Drinnen dreht sich der Spieß. Lauf einfach rein.']);
}


function bench(tx,ty){ const x=tx*TILE,y=ty*TILE+9; shadow(B,x+1,y+5,14,3);
  px(B,x,y,16,3,C.woodHi); px(B,x,y+3,16,2,C.wood); px(B,x+1,y+5,2,4,C.woodLo); px(B,x+13,y+5,2,4,C.woodLo);
  px(B,x,y-4,16,2,C.wood); px(B,x,y-2,16,1,C.woodLo);
  solid(x,y,16,6); inter(x,y-4,16,12,'Bank',['Eine grüne Holzbank. Auf der Lehne eingeritzt: ein Herz, zwei Initialen, ein Datum von vor zwanzig Jahren.']);
}
function litfass(tx,ty){ const x=tx*TILE+5,y=ty*TILE; shadow(B,x-1,y+22,9,3);
  px(B,x,y,8,22,'#5a3a2a'); px(B,x+1,y+2,6,18,'#caa86e');
  // abgerissene Plakate
  px(B,x+1,y+4,6,5,'#b1432f'); px(B,x+2,y+10,5,4,'#2a4a6a'); px(B,x+1,y+15,4,3,'#d6b53a');
  B.fillStyle='#1a1410';B.font='3px Georgia';B.fillText('SISY',x+1,y+5);
  px(B,x,y-2,8,2,'#3a2a1a');
  solid(x,y+4,8,18); inter(x-2,y,12,22,'Litfaßsäule',[
    'Litfaßsäule, dick mit Plakaten beklebt. Halb abgerissen liest man: »SISYPHOS — bis die Sonne wieder aufgeht«.',
    'Darunter ein älteres Plakat, das du nicht ganz entziffern kannst. Du bist dir nicht sicher, ob es auf Deutsch ist.']);
}
function sbahn(tx,ty){ const x=tx*TILE+4,y=ty*TILE; shadow(B,x,y+24,8,3);
  px(B,x+3,y,2,24,'#3a3a40');
  // grünes Schild mit gelbem S
  px(B,x-3,y-1,14,12,'#fff'); px(B,x-2,y,12,10,C.sbahnGreen);
  B.fillStyle=C.sbahnYellow; B.font='bold 9px Georgia'; B.fillText('S',x+1,y+1);
  glows.push({x:x+4,y:y+5,r:12,col:'rgba(120,220,150,',kind:'win'});
  solid(x+2,y+20,4,4); inter(x-4,y-2,16,26,'S-Bahnhof Zehlendorf',[
    'S-Bahnhof Zehlendorf. Richtung Wannsee ↔ Nikolassee.',
    'Die Anzeigetafel flackert: »Nächster Zug in — — Min«. Es kommt keiner.']);
}
function bins(tx,ty){ const x=tx*TILE,y=ty*TILE+6; const lids=['#f4c318','#2a6a3a','#2a4a8a','#3a3a40']; const lab=['Wertstoffe','Bio','Papier','Restmüll'];
  for(let i=0;i<4;i++){ const bx=x+i*8; shadow(B,bx,y+9,7,2); px(B,bx,y,7,10,'#3a3a42'); px(B,bx,y-1,7,2,lids[i]); px(B,bx+1,y+3,5,1,'#fff'); solid(bx,y,7,10);} 
  inter(x,y-2,32,12,'Mülltonnen',['Wertstoffe, Bio, Papier, Restmüll — alle vier, brav nebeneinander. Sehr ordentlich. Sehr Zehlendorf.']);
}

/* ======================================================================
   BÄUME-RAND / BEGRENZUNG  +  alle Objekte platzieren
   ====================================================================== */
function buildWorld(){
  paintGround();
  // Rand: dichter, leicht nebliger Baumgürtel
  for(let x=0;x<MAPW;x++){ const _gate=(x===15||x===16); if(!_gate){ hedge(x,0); hedge(x,1); } hedge(x,MAPH-1); }
  for(let y=2;y<MAPH-1;y++){ if(!(y===14||y===15)) hedge(0,y); hedge(MAPW-1,y); }

  // Park-West Bäume + ein Reh-Versteck (hohes Gras schon im Boden)
  linden(2,6,true); linden(7,2,true); linden(3,2,false);

  rathaus(11,3);
  eiche(22,7);

  // Süd-Läden
  baeckerei(5,19); spaeti(13,19); blumen(20,19); efes(24,19);

  // Straßenbäume + Laternen entlang der Gehwege
  [3,9,15,21,27,31].forEach(c=>{ linden(c,13,false); });
  [6,18,30].forEach(c=>{ linden(c,18,false); });
  [5,12,19,26,31].forEach(c=>lamp(c,17));
  [6,12,18,24].forEach(c=>lamp(c,13));

  // Möblierung
  bench(17,11); bench(24,11);
  litfass(28,18); sbahn(11,18); bins(2,18);
  bench(10,18);

  // Blumenbeete am Vorplatz (rein dekorativ)
  for(let i=0;i<14;i++){ const fx=10*TILE+8+i*8, fy=12*TILE+6; B.fillStyle=['#d6486a','#e8a93a','#fff'][i%3]; B.fillRect(fx,fy,2,2);}
  // --- Nordtor nach Charlottenburg-Wilmersdorf ---
  for(let yy=0;yy<3;yy++)for(let xx=15;xx<=16;xx++){ const _px=xx*TILE,_py=yy*TILE; B.fillStyle='#6a6258'; B.fillRect(_px,_py,TILE,TILE);
    for(let a=0;a<TILE;a+=4)for(let b=0;b<TILE;b+=4){ B.fillStyle=hash(a+b,xx+yy)<.5?'#746c60':'#5e574e'; B.fillRect(_px+a,_py+b,3,3);} }
  px(B,14*TILE+10,1*TILE,3,18,'#5a4632'); px(B,17*TILE-1,1*TILE,3,18,'#5a4632');
  px(B,14*TILE+8,1*TILE-4,3*TILE,5,'#3a2a1a'); px(B,14*TILE+9,1*TILE-3,3*TILE-2,3,'#7a5436');
  B.fillStyle='#e9ddc0'; B.font='6px Georgia'; B.fillText('CHARLOTTENBURG',14*TILE+10,1*TILE-3);
  doors.push({x:15*TILE,y:1*TILE,w:2*TILE,h:2*TILE,to:'chb'});
  doors.push({x:0,y:14*TILE,w:24,h:2*TILE,to:'kl'});
  inter(0,14*TILE,2*TILE,2*TILE,'→ Krumme Lanke',['Der Weg nach Westen — runter zur Krummen Lanke. Erstes Wasser, Enten, frische Luft. Angeblich springt da wer freiwillig rein.']);
  inter(14*TILE,2*TILE,2*TILE,TILE,'→ Charlottenburg',['Ein Pfad zwischen den Hecken — nach Norden, raus aus Zehlendorf.','Handgemaltes Schild: »Charlottenburg-Wilmersdorf — ein Bezirk weiter, tausend Leute mehr.«']);    
}

/* ======================================================================
   ENTITIES — Spieler / NPCs / Katze / Krähe
   ====================================================================== */
const npcs=[
  {x:18*TILE+4,y:11*TILE+2,dir:'down',pal:PAL_OMA,who:'Oma Krüger',base:18*TILE+4,
   lines:['Na, Kindchen. So spät noch unterwegs?','Bei Dämmerung bleibt man besser aufm Weg — nich ins hohe Gras. Da hüpft wat, wat nich hüpfen sollte.'],
   wander:true, t:Math.random()*3, frame:0},
  {x:10*TILE,y:18*TILE-2,dir:'up',pal:PAL_KID,who:'Kiezkind',base:10*TILE,
   lines:['Ey! Im Gras hüpft eins rum!','Ich hab schon DREI gefangen. Du hast noch GAR keins? Lol.'],
   wander:false, t:0, frame:0},
];
// Katze "Arya" am Eichen-Anger
export const cat={x:23*TILE,y:9*TILE+6,dir:'left',t:0,phase:0};
// Krähe auf der Restmülltonne
const raven={x:2*TILE+22,y:18*TILE+2,caw:0};

// --- Quest-NPCs: Haze (südlich vom Efes) & Passi (links unten) ---
const haze={x:388,y:356,dir:'up',pal:PAL_HAZE,who:'Haze',frame:0,talk:()=>hazeTalk()};
const passi={x:44,y:344,dir:'right',pal:PAL_PASSI,who:'Passi',frame:0,talk:()=>passiTalk()};
npcs.push(haze,passi);

/* ======================================================================
   LICHT — Dämmerung: warmer Tint + Vignette (leicht kalt = creepy) + Glows
   ====================================================================== */
export const lightCv=document.createElement('canvas'); lightCv.width=LW; lightCv.height=LH;
export const Lx=lightCv.getContext('2d');
function drawLight(camx,camy,t){
  Lx.clearRect(0,0,LW,LH);
  // 1) Dämmerungs-Tint: warm oben, warm-bernstein unten (cozy)
  let g=Lx.createLinearGradient(0,0,0,LH);
  g.addColorStop(0,'rgba(255,210,150,0.18)'); g.addColorStop(.55,'rgba(214,152,118,0.10)'); g.addColorStop(1,'rgba(120,72,58,0.22)');
  Lx.globalCompositeOperation='source-over'; Lx.fillStyle=g; Lx.fillRect(0,0,LW,LH);
  // 2) Vignette — Ecken warm-dunkel & weicher (cozy statt kalt)
  let v=Lx.createRadialGradient(LW/2,LH/2,40,LW/2,LH/2,210);
  v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(46,24,30,0.42)');
  Lx.fillStyle=v; Lx.fillRect(0,0,LW,LH);
  // 3) warme Glows additiv
  Lx.globalCompositeOperation='lighter';
  const fl = reduce?1:(0.82+0.18*Math.sin(t*3.0));
  for(const gl of glows){ const sx=gl.x-camx, sy=gl.y-camy; if(sx<-40||sx>LW+40||sy<-40||sy>LH+40) continue;
    const a=(gl.kind==='lamp'?0.5*fl:0.34); const rr=gl.r;
    const rg=Lx.createRadialGradient(sx,sy,0,sx,sy,rr); rg.addColorStop(0,gl.col+a+')'); rg.addColorStop(1,gl.col+'0)');
    Lx.fillStyle=rg; Lx.fillRect(sx-rr,sy-rr,rr*2,rr*2);
  }
  Lx.globalCompositeOperation='source-over';
}

/* ======================================================================
   INPUT
   ====================================================================== */
addEventListener('keydown',e=>{ if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
  keys[e.key.toLowerCase()]=true; onKey(e.key.toLowerCase()); });
addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; });
function bindPad(id,key){ const el=document.getElementById(id);
  const dn=e=>{e.preventDefault();keys[key]=true; onKey(key);}; const up=e=>{e.preventDefault();keys[key]=false;};
  el.addEventListener('touchstart',dn,{passive:false}); el.addEventListener('touchend',up); el.addEventListener('mousedown',dn); el.addEventListener('mouseup',up); el.addEventListener('mouseleave',up);
}
bindPad('pUp','w');bindPad('pDown','s');bindPad('pLeft','a');bindPad('pRight','d');bindPad('pA','e');
document.getElementById('pInv').addEventListener('click',e=>{e.preventDefault(); if(G.state==='play'||invOpen) toggleInv();});
// Berlinodex-Icon als Sprite (Vorlage) auf den Buttons statt Emoji
(function(){
  const ic=document.createElement('canvas'); ic.width=52; ic.height=54; const icc=ic.getContext('2d'); icc.imageSmoothingEnabled=false; drawBerlinodexIcon(icc,3,3);
  const url=ic.toDataURL();
  const pd=document.getElementById('pDex'); if(pd){ pd.textContent=''; pd.style.backgroundImage='url('+url+')'; pd.style.backgroundSize='40px 42px'; pd.style.backgroundRepeat='no-repeat'; pd.style.backgroundPosition='center'; pd.style.imageRendering='pixelated'; pd.style.background='rgba(20,14,8,.35) url('+url+') center/40px 42px no-repeat'; }
  const di=document.createElement('div'); di.id='dexIcon';
  di.style.cssText='position:fixed;right:12px;top:12px;width:46px;height:48px;z-index:36;cursor:pointer;image-rendering:pixelated;background:url('+url+') center/contain no-repeat;filter:drop-shadow(0 2px 3px rgba(0,0,0,.6));';
  document.body.appendChild(di);
  di.addEventListener('click',e=>{e.preventDefault(); if(G.state==='play'&&!invOpen) openDex(); else if(G.state==='dex') closeDex();});
})();
document.getElementById('pDex').addEventListener('click',e=>{e.preventDefault(); if(G.state==='play'&&!invOpen) openDex(); else if(G.state==='dex') closeDex();});
document.getElementById('pTeam').addEventListener('click',e=>{e.preventDefault(); if(G.state==='play'&&!invOpen) openTeam(); else if(G.state==='team') closeTeam();});

// --- Tap/Klick zum Weiterschalten (Handy): Dialogbox ODER Spielfeld antippen ---
let lastTapT=0;
function tapProgress(e){ if(e&&e.preventDefault)e.preventDefault(); const now=Date.now(); if(now-lastTapT<230) return; lastTapT=now;
  if(G.state==='dialog'){ if(choiceState) return; advanceDialog(); return; }
  if(G.state==='evolve'){ onKey('e'); return; }
  if(G.state==='battle'){ onKey('e'); return; }
  if(G.state==='play'){ onKey('e'); return; }
}
function canvasXY(e){ const r=cv.getBoundingClientRect(); const t=(e.touches&&e.touches[0])||(e.changedTouches&&e.changedTouches[0])||e;
  return { x:(t.clientX-r.left)/r.width*LW, y:(t.clientY-r.top)/r.height*LH }; }
function tapCanvas(e){ if(e&&e.preventDefault)e.preventDefault(); const now=Date.now(); if(now-lastTapT<230) return; lastTapT=now;
  if(G.state==='team'){ closeTeam(); return; }
  if(G.state==='catchChoice'){ const p=canvasXY(e); const bw=224,bh=112,bx=(LW-bw)/2,by=(LH-bh)/2;
    if(p.y>=by+bh-22&&p.y<=by+bh-5){ if(p.x>=bx+8&&p.x<=bx+110){ catchChoose(true); return; } if(p.x>=bx+bw-110&&p.x<=bx+bw-8){ catchChoose(false); return; } }
    return;
  }
  if(G.state==='starter'){ const p=canvasXY(e);
    for(let i=0;i<3;i++){ const x=STC.x0+i*(STC.cw+STC.gap); if(p.x>=x&&p.x<=x+STC.cw&&p.y>=STC.y&&p.y<=STC.y+STC.ch){ selectStarter(i); return; } }
    return;
  }
  if(G.state==='starterConfirm'){ const p=canvasXY(e); const bw=210,bh=74,bx=(LW-bw)/2,by=(LH-bh)/2;
    if(p.y>=by+48&&p.y<=by+65){ if(p.x>=bx+8&&p.x<=bx+96){ grantStarter(STARTERS[getStarterPick()].id); return; } if(p.x>=bx+bw-96&&p.x<=bx+bw-8){ G.state='starter'; return; } }
    return;
  }
  if(G.state==='dexEntry'){ closeDexEntry(); return; }
  if(G.state==='dex'){ const p=canvasXY(e);
    if(p.y<20 && p.x>LW-30){ closeDex(); return; }                 // × schliessen
    if(p.x<24 && p.y>76 && p.y<104){ dexKey('arrowleft'); return; } // ‹ Pfeil
    if(p.x>LW-24 && p.y>76 && p.y<104){ dexKey('arrowright'); return; } // › Pfeil
    // Slot-Treffer -> Einzelansicht
    const G=dexGridGeom, page=DEX_PAGES[dexPage];
    const c2=Math.floor((p.x-G.gx0)/G.cw), r2=Math.floor((p.y-G.gy0)/G.ch);
    if(c2>=0&&c2<3&&r2>=0&&r2<3){ const i=r2*3+c2; if(i<page.gigos.length){ const id=page.gigos[i];
      if(dexSeen.has(id)||dexCaught.has(id)){ openDexEntry(id); return; } } }
    return;
  }
  if(G.state==='dialog'){ if(choiceState) return; advanceDialog(); return; }
  if(G.state==='evolve'){ onKey('e'); return; }
  if(G.state==='battle'){ onKey('e'); return; }
  if(G.state==='play'){ onKey('e'); return; }
}
const _dlgEl=document.getElementById('dialog');
_dlgEl.addEventListener('touchstart',tapProgress,{passive:false}); _dlgEl.addEventListener('mousedown',tapProgress);
cv.addEventListener('touchstart',tapCanvas,{passive:false}); cv.addEventListener('mousedown',tapCanvas);

/* ======================================================================
   STATE — Title / Banner / Dialog / Toast / Encounter
   ====================================================================== */
let sitting=null;      // {bx,by} wenn der Spieler auf einer Bank sitzt
export function clearSitting(){ sitting=null; }
export let hasLeo=false;      // Leo (Hazes Katze) als geliehener Begleiter nach Sörens Quest
export function setHasLeo(v){ hasLeo=v; }

// --- Heidegluehen Tuersteherin-Gate ---
function gateReject(msg){ closeChoice(); openDialog('Tuersteherin',[msg]); }
function gateStart(){ if(clubUnlocked){ enterClub(); return; } openChoice('Tuersteherin','Hi, first time here?',[
  {label:'Yes, its my first time in the city. Its so Berlinnnn!', fn:()=>gateReject('Sorry, not today.')},
  {label:'No, I have been here multiple times, loved it.', fn:()=>gateReject('Sorry, not today.')},
  {label:'Nee, war schon oefters hier, Heide auf die 1.', fn:gateQ2} ]); }
function gateQ2(){ openChoice('Tuersteherin','Huh, du warst also schon ein paar mal drin hier ja? Dann muss dich wohl wer anders reingelassen haben. Ich wuerde nicht auf die Idee kommen.',[
  {label:'Hang Loose!', fn:()=>gateReject('*Stirnrunzeln* Nope sorry, so kommst du hier heute nicht rein!')},
  {label:'Ach was, hab dich nicht so, ich liebe Techno!', fn:()=>gateReject('*Stirnrunzeln* Nope sorry, so kommst du hier heute nicht rein!')},
  {label:'Haha ouch! Aber das aendert nichts daran das ich heute front row abraven werde!', fn:gateQ3} ]); }
function gateQ3(){ openChoice('Tuersteherin','Du willst in die Front Row? Da koennten wir ja direkt den Gloeckner von Notre Dame engagieren! Der verschreckt wenigstens weniger Gaeste als du.',[
  {label:'Ayo pause. Ich will mir einfach nur die Sonne auf die Nase scheinen lassen und meinen Sekt auf Eis geniessen, calm down yo.', fn:gateWin},
  {label:'WHAT THE HELLY? Das ist fully offensive, wollte einfach abdancen und werd hier weggeroastet. Not cool yo!', fn:()=>gateReject('Go home, Loser.')},
  {label:'*macht 6-7*', fn:()=>gateReject('Go home, Loser.')} ]); }
function gateWin(){ openDialog('Tuersteherin',['I see you. Weisst du was? Willkommen in der Heide.'], ()=>{ clubUnlocked=true; startClubCutscene(); }); }
function startClubCutscene(){ gateWalk=1.1; player.dir='up'; player.step=0; }

/* ======================================================================
   INVENTAR + QUEST
   ====================================================================== */
let HERO='Don';            // Main-Char-Name (später frei benennbar)
let quest=0;               // 0 start · 1 zu Passi · 2 Zettel zurück zu Haze · 3 -> Sören/Eiche (next)

/* --- Quest-Dialoge --- */
function hazeTalk(){
  haze.dir=facingTo(haze,player);
  if(quest===0){
    openDialog('Haze',[
      'Ey ey ey, digga! Haste schon gehört?!',
      'Passi ist back! Aus Berkeley, alter — endlich wieder in Zehlendorf, Bro!',
      'Wir müssen UNBEDINGT mal wieder die ganze Crew zusammentrommeln.',
      'Aber... eine Sache noch, bevor wir das machen, ja?',
      'Der Passi schuldet mir noch nen Fünfer. Schon ewig, digga.',
      'Geh doch mal zu ihm und treib das für mich ein. Ich... ich trau mich da grad nich so ran.',
      'Er hängt unten links rum, beim alten Spot. Blonder Lockenkopf, kannste nich verfehlen.',
      {who:HERO,text:'Aight, mach ich, Hazeler. Bin gleich zurück mit deiner Kohle.'}
    ], ()=>{ quest=1; toast('🗒 Quest: Treib Passis Fünfer ein (unten links)',2600); });
  } else if(quest===1){
    openDialog('Haze',[
      'Und? Schon beim Passi gewesen? Mein Fünfer, digga, mein Fünfer!',
      'Er hängt unten links rum — blonder Lockenkopf. Kannste nich verfehlen.'
    ]);
  } else if(quest===2){
    openDialog('Haze',[
      'Und, haste meine Kohle?',
      {who:HERO,text:'*drückt ihm den Zettel in die Hand* Er ist immernoch der gleiche Brodie. Die Crew lebt!'},
      'Dude... Wo ist mein Fünfer? Was soll „Consamtschen Smuzing" sein?',
      {who:HERO,text:'Gib mal her. *nimmt den Zettel zurück* Oh dawg, der hat ja immernoch die selbe Sauklaue wie früher!'},
      {who:HERO,text:'Und die Rechtschreibung is auch nich besser geworden. Kann der immernoch kein Englisch, alder?'},
      'Klassischer Passi-Move, man. Aber egal — weißt du was, man.',
      'Mein Dad Sören is grad dran, die Tiere in Berlin zu erforschen. Was hier in letzter Zeit los is, is völlig absurd.',
      'Maybe quatschst du einfach mal mit ihm direkt. Er chillt in der Eiche, wie immer. *zwinkert*',
      {who:HERO,text:'Aight, danke dawg. Wir quarken demnächst mal, bisschen Crew zusammenbringen und so, du weißt!'},
      'Safe man, hau rein!'
    ], ()=>{ quest=3; toast('🗒 Quest: Sprich mit Sören an der Eiche',2800); });
  } else {
    openDialog('Haze',[
      'Geh mal zu meim Dad Sören, an der Eiche. Der hat krasse Sachen über die Tiere rausgefunden.',
      'Safe man, hau rein!'
    ]);
  }
}
function passiTalk(){
  passi.dir=facingTo(passi,player);
  if(quest<1){
    openDialog('Passi',[
      'Jungeee, was geht alder. Lange nich gesehen!',
      'Glaub der Hazeler lungert grad bei Efes rum und zappelt. Quatsch ma mit dem.'
    ]);
  } else if(quest===1){
    openDialog('Passi',[
      'Jungeee was geht alder',
      {who:HERO,text:'Passi Jungee, was geht denn bei dir, Ami-Sau. Alles gute, man — wie wars in Berkeley?'},
      'Joaa schon crazy, die Amis haben ein Rad ab auf jeden Fall. Aber ich hab mein Zehlendorf vermisst, es is ein Paradies, man.',
      {who:HERO,text:'Jaa kann ich mir vorstellen, dawg. Aber jetzt mal zum Eingemachten.'},
      {who:HERO,text:'Lass doch mal wieder was machen jetzt wo du back bist — maybe mit der ganzen Crew sogar?'},
      {who:HERO,text:'Aber bevor wir das können: Der Hazeler meinte, du schuldest ihm noch nen Fünfer? Ich hol das für ihn — er meinte, er traut sich das nich.'},
      {who:'Passi',text:'... ...'},
      {who:'Passi',text:'Wieso???'},
      {who:HERO,text:'Ja, er denkt du bist jetzt vielleicht ein Gangster geworden. Deshalb sollte ich das für ihn übernehmen.'},
      {who:'Passi',text:'*schüttelt den Kopf* Wie der Typ es durch den Alltag schafft...'},
      'Aber ne Junge, nen Fünfer will ich dem Kerle trotzdem nich geben.',
      'Habe ich dir schonmal von Consumption Smoothing erzählt?',
      'Pass auf: Du verteilst deinen Konsum gleichmäßig über die Zeit, statt mal zu prassen und mal zu hungern.',
      'Spar in guten Zeiten, zehr in schlechten — dann is deine Lebensqualität immer ungefähr gleich smooth. Verstehste?',
      {who:HERO,text:'Passi, ich checke vielleicht 20% davon — und was soll ich mit den ganzen Infos anfangen?'},
      'Ach Junge, warte ma kurz. *schnappt sich nen Stift*',
      '*kritzelt „Consumption Smoothing" auf nen Zettel und drückt ihn dir in die Hand*',
      'Hier alder, gib das Haze und sag ihm, das allein is 10mal so viel wert wie sein jämmerlicher Fünfer.',
      'Aber lets go — lass nen Meet-Up machen!',
      {who:HERO,text:'Safe dawg. *dapped Passi up* Hau rein Jungä, mal schauen was der Hazeler mitm Zettel anfängt.'},
      'Ach, und hier alda — mir schmeckt die Plörre eh nich. *drückt dir ne Mate in die Hand*'
    ], ()=>{ addItem('zettel'); addItem('mate'); quest=2; });
  } else {
    openDialog('Passi',[
      'Und? Hat der Hazeler sich übern Zettel gefreut? Haha, Klassiker.',
      'Lass bald Meet-up machen, ja? Die Crew muss wieder zusammen, man.'
    ]);
  }
}

function onKey(k){
  if(k==='p' && inventory.includes('bluePunisher') && (G.state==='play'||G.state==='battle')){ popPunisher(); return; }
  if(G.state==='team'){ teamKey(k); return; }
  if(G.state==='catchChoice'){ catchKey(k); return; }
  if(G.state==='evolve'){ evolveKey(k); return; }
  if(G.state==='cutscene'||G.state==='reveal') return;
  if(G.state==='starter'||G.state==='starterConfirm'){ starterKey(k); return; }
  if(G.state==='dex'){ dexKey(k); return; }
  if(G.state==='dexEntry'){ dexEntryKey(k); return; }
  if(G.state==='battle'){ battleKey(k); return; }
  if(G.state==='title'){ if(k==='enter'||k===' '||k==='e'){ startGame(); } return; }
  if(k==='b' && G.state==='play' && !invOpen){ openDex(); return; }
  if(k==='t' && G.state==='play' && !invOpen){ openTeam(); return; }
  if(k==='i' && (G.state==='play'||G.state==='dialog')){ if(G.state==='play') toggleInv(); return; }
  if(G.state==='dialog'){ if(choiceState){ if(k==='arrowdown'||k==='s') moveChoice(1); else if(k==='arrowup'||k==='w') moveChoice(-1); else if(k==='1') pickChoice(0); else if(k==='2') pickChoice(1); else if(k==='3') pickChoice(2); else if(k==='e'||k===' '||k==='enter') pickChoice(choiceState.idx); return; } if(k==='e'||k===' '||k==='enter') advanceDialog(); return; }
  if(G.state==='play'){ if(invOpen) return; if(k==='e'||k===' ') tryInteract(); }
}
document.getElementById('title').addEventListener('click',()=>{ if(G.state==='title') startGame(); });

function startGame(){ document.getElementById('title').style.display='none'; G.state='play'; showBanner(); toast('Zehlendorf Mitte — ein kleiner, stiller Bezirk.',2600); }


function tryInteract(){
  const {fx,fy}=frontPoint();
  if(G.scene==='efes'){
    // Dönermann (über die Theke, nach oben schauend)
    if(fy<108 && player.x+8>54 && player.x+8<266){ talkDoener(); return; }
    // Ausgang
    if(player.y>=132 && Math.abs(player.x+8-160)<26){ exitEfes(); return; }
    openDialog('Efes Grill',['Drinnen riecht es nach Knoblauchsoße und Holzkohle. Der Spieß dreht sich, ewig.']);
    return;
  }
  if(G.scene==='eiche'){
    // Sören (oben, mittig) ansprechen
    if(player.dir==='up' && player.y<126 && player.x+8>112 && player.x+8<208){ talkSoeren(); return; }
    // Nach dem Aufstieg: rechts hinten wieder hoch ins Obergeschoss
    if(obenUnlocked && player.dir==='up' && player.y<70 && player.x+8>250){ enterEicheOben(); return; }
    // Ausgang (Wurzeltreppe unten mittig)
    if(player.y>=128 && Math.abs(player.x+8-160)<28){ exitEiche(); return; }
    openDialog('Eiche',['Drinnen ist es warm und dämmrig. Wurzeln, Ranken, Kerzenlicht. Es riecht nach Erde, altem Papier und... etwas Verbranntem.']);
    return;
  }
  if(G.scene==='eicheOben'){
    if(player.dir==='up' && player.y<110 && player.x+8>110 && player.x+8<210){ talkSoerenOben(); return; }
    if(player.y>=156 && Math.abs(player.x+8-160)<24){ exitEicheOben(); return; }
    openDialog('Obergeschoss',['Sörens Geheimkammer. Überall Schriften, Bücher, Notizen. Unter Glaskuppeln ruhen drei Kapseln.']);
    return;
  }
  if(G.scene==='cafe'){
    if(player.dir==='up' && player.y<92 && player.x+8>30 && player.x+8<150){ talkBarista(); return; }
    if(player.y>=150 && Math.abs(player.x+8-160)<22){ exitCafe(); return; }
    for(const n of cafeNpcs){ if(n.counter) continue; if(Math.abs(n.x+8-fx)<13 && Math.abs(n.y+16-fy)<15){ n.dir=(player.x<n.x?'left':'right'); openDialog(n.who,n.lines); return; } }
    for(const it of cafeInters){ if(fx>=it.x-2&&fx<=it.x+it.w+2&&fy>=it.y-2&&fy<=it.y+it.h+2){ openDialog(it.who,it.lines); return; } }
    return;
  }
  if(G.scene==='wohnung'){
    if(player.y>=282 && Math.abs(player.x+8-160)<24){ exitWohnung(); return; }
    for(const n of wohnungNpcs){ if(Math.abs(n.x+8-fx)<14 && Math.abs(n.y+16-fy)<16){ openDialog(n.who,n.lines); return; } }
    for(const it of wohnungInters){ if(fx>=it.x-2&&fx<=it.x+it.w+2&&fy>=it.y-2&&fy<=it.y+it.h+2){ openDialog(it.who,it.lines); return; } }
    return;
  }
  if(G.scene==='chb'){
    for(const d of chbDoors){ if(fx>=d.x-2&&fx<=d.x+d.w+2&&fy>=d.y-2&&fy<=d.y+d.h+2){ if(d.to==='town') exitCHB(); else if(d.to==='cafe') enterCafe(); else if(d.to==='wohnung') enterWohnung(); else if(d.to==='mitte') enterMitte(); return; } }
    for(const n of chbNpcs){ if(Math.abs(n.x+8-fx)<12 && Math.abs(n.y+16-fy)<14){ n.dir=(player.x<n.x?'left':'right'); openDialog(n.who,n.lines); return; } }
    for(const it of chbInters){ if(fx>=it.x-2&&fx<=it.x+it.w+2&&fy>=it.y-2&&fy<=it.y+it.h+2){ if(it.who==='Bank'){ sitDown(it); } else { openDialog(it.who,it.lines); } return; } }
    return;
  }
  if(G.scene==='kl'){
    for(const d of klDoors){ if(fx>=d.x-2&&fx<=d.x+d.w+2&&fy>=d.y-2&&fy<=d.y+d.h+2){ if(d.to==='town') exitKL(); return; } }
    for(const it of klInters){ if(fx>=it.x-2&&fx<=it.x+it.w+2&&fy>=it.y-2&&fy<=it.y+it.h+2){ if(it.who==='Sprungbaum'){ startKLJump(); } else { openDialog(it.who,it.lines); } return; } }
    return;
  }
  if(G.scene==='club'){
    for(const d of clubDoors){ if(fx>=d.x-2&&fx<=d.x+d.w+2&&fy>=d.y-2&&fy<=d.y+d.h+2){ if(d.to==='mitte') exitClub(); return; } }
    for(const n of clubNpcs){ if(Math.abs(n.x+8-fx)<13 && Math.abs(n.y+16-fy)<16){ n.dir=(player.x<n.x?'left':'right');
      if(n.who==='Gnarley Gustav'){ questGustav=true; openDialog(n.who,n.lines); }
      else if(n.who==='Dealer'){ dealerTalk(); }
      else openDialog(n.who,n.lines); return; } }
    for(const it of clubInters){ if(fx>=it.x-2&&fx<=it.x+it.w+2&&fy>=it.y-2&&fy<=it.y+it.h+2){ if(it.who==='Karussell'){ sitDown(it); } else { openDialog(it.who,it.lines); } return; } }
    return;
  }
  if(G.scene==='mitte'){
    for(const d of mitDoors){ if(fx>=d.x-2&&fx<=d.x+d.w+2&&fy>=d.y-2&&fy<=d.y+d.h+2){ if(d.to==='chb') exitMitte(); else if(d.to==='club'){ if(clubUnlocked) enterClub(); else gateStart(); } return; } }
    for(const n of mitNpcs){ if(Math.abs(n.x+8-fx)<12 && Math.abs(n.y+16-fy)<14){ n.dir=(player.x<n.x?'left':'right'); if(n.who==='Tuersteherin'){ gateStart(); } else openDialog(n.who,n.lines); return; } }
    for(const it of mitInters){ if(fx>=it.x-2&&fx<=it.x+it.w+2&&fy>=it.y-2&&fy<=it.y+it.h+2){ openDialog(it.who,it.lines); return; } }
    return;
  }
  // --- Stadt ---
  for(const d of doors){ if(fx>=d.x-2&&fx<=d.x+d.w+2&&fy>=d.y-2&&fy<=d.y+d.h+2){ if(d.to==='efes') enterEfes(); else if(d.to==='eiche') enterEiche(); else if(d.to==='chb') enterCHB(); else if(d.to==='kl') enterKL(); return; } }
  for(const n of npcs){ if(Math.abs(n.x+8-fx)<12 && Math.abs(n.y+16-fy)<14){ if(n.talk){ n.talk(); } else { n.dir=facingTo(n,player); openDialog(n.who,n.lines); } return; } }
  if(Math.abs(cat.x+6-fx)<12 && Math.abs(cat.y+8-fy)<12){ openDialog('Katze',['Eine kleine getigerte Katze sitzt auf der warmen Mauer und blinzelt dich langsam an. *schnurr*']); return; }
  for(const it of inters){ if(fx>=it.x-2&&fx<=it.x+it.w+2&&fy>=it.y-2&&fy<=it.y+it.h+2){ openDialog(it.who,it.lines); return; } }
}
/* ======================================================================
   COLLISION
   ====================================================================== */
function blocked(nx,ny){ // Stadt-Fußbox
  const fx=nx+4, fy=ny+15, fw=8, fh=6;
  if(fx<TILE||fy<TILE||fx+fw>WPX-TILE||fy+fh>HPX-TILE) return true;
  for(const s of solids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}
/* ======================================================================
   ENCOUNTER (Stub — Battle-Engine kommt portiert in der nächsten Runde)
   ====================================================================== */
const WILD=['Rave-Ratte','U-Bahn-Taube','Späti-Waschbär','Parkdackel','Currywurst-Wurm'];
let encCool=0, lastTile=-1;
export function resetAfterBattle(){ encCool=1.5; lastTile=-1; clastTile=-1; }
function checkEncounter(){
  const tx=(player.x+8)/TILE|0, ty=(player.y+16)/TILE|0;
  const t=ground[gi(clamp(tx,0,MAPW-1),clamp(ty,0,MAPH-1))];
  const onTall=(t===7);
  if(onTall){ // beim Betreten neuer Tile-Position würfeln
    const id=ty*MAPW+tx;
    if(id!==lastTile && encCool<=0){ lastTile=id;
      if(Math.random()<0.22){ const w=rollWild('town'); grassFlash=0.5; startBattle(w.id,w.lv,'town'); }
    }
  } else lastTile=-1;
}
let grassFlash=0;
export function setGrassFlash(v){ grassFlash=v; }

/* ======================================================================
   UPDATE + RENDER
   ====================================================================== */
let camx=0,camy=0; export let T=0;
function update(dt){
  if(loveAura>0) loveAura-=dt;
  if(gateWalk>0){ gateWalk-=dt; player.y-=20*dt; player.step=(player.step||0)+dt*8; player.frame=1+((player.step|0)%2); T+=dt; if(gateWalk<=0){ player.frame=0; enterClub(); } return; }
  if(G.state==='team'||G.state==='catchChoice'){ T+=dt; return; }
  if(G.state==='cutscene'){ T+=dt; stepCutscene(dt); return; }
  if(G.state==='reveal'){ T+=dt; stepReveal(dt); return; }
  if(G.state==='starter'||G.state==='starterConfirm'){ T+=dt; return; }
  if(G.state==='dex'){ T+=dt; return; }
  if(G.state==='dexEntry'){ T+=dt; return; }
  if(G.state==='evolve'){ T+=dt; updateEvolve(dt); return; }
  if(G.state==='battle'){ T+=dt; updateBattle(dt); return; }
  if(invOpen){ T+=dt; return; }
  if(G.state==='play' && G.scene==='town'){
    movePlayer(dt,blocked);
    // Eingänge: reinlaufen (kurze Sperre nach dem Rausgehen)
    if(enterCool>0){ enterCool-=dt; }
    else { const fx=player.x+4, fy=player.y+15;
      for(const d of doors){ if(fx<d.x+d.w&&fx+8>d.x&&fy<d.y+d.h&&fy+6>d.y){ if(d.to==='efes'){ enterEfes(); break; } else if(d.to==='eiche'){ enterEiche(); break; } else if(d.to==='chb'){ enterCHB(); break; } else if(d.to==='kl'){ enterKL(); break; } } }
    }
    if(encCool>0) encCool-=dt;
    checkEncounter();
  } else if(G.state==='play' && G.scene==='efes'){
    movePlayer(dt,blockedEfes);
    // Ausgang: auf die Fußmatte unten treten
    if(player.y>=132 && Math.abs(player.x+8-160)<26){ exitEfes(); }
  } else if(G.state==='play' && G.scene==='eiche'){
    movePlayer(dt,blockedEiche);
    if(player.y>=128 && Math.abs(player.x+8-160)<28){ exitEiche(); }
  } else if(G.state==='play' && G.scene==='eicheOben'){
    movePlayer(dt,blockedEicheOben);
    if(enterCool>0){ enterCool-=dt; }
    else if(player.y>=156 && Math.abs(player.x+8-160)<24){ exitEicheOben(); }
  } else if(G.state==='play' && G.scene==='cafe'){
    movePlayer(dt,blockedCafe);
    if(enterCool>0){ enterCool-=dt; }
    else if(player.y>=150 && Math.abs(player.x+8-160)<22){ exitCafe(); }
    if(!reduce) for(const n of cafeNpcs){ if(n.wander){ n.t+=dt; const off=Math.sin(n.t*0.6)*n.range; const tgt=n.base+off; const old=n.x; n.x+=clamp(tgt-n.x,-14*dt,14*dt); n.dir=n.x>old+0.02?'right':n.x<old-0.02?'left':n.dir; n.frame=Math.abs(n.x-old)>0.05?1+((n.t*5|0)%2):0; } else if(n.play){ n.t+=dt; n.frame=1+((n.t*3|0)%2); } }
  } else if(G.state==='play' && G.scene==='wohnung'){
    movePlayer(dt,blockedWohnung);
    if(enterCool>0){ enterCool-=dt; }
    else if(player.y>=282 && Math.abs(player.x+8-160)<24){ exitWohnung(); }
  } else if(G.state==='play' && G.scene==='chb'){
    if(sitting){
      if(keys['w']||keys['a']||keys['s']||keys['d']||keys['arrowup']||keys['arrowdown']||keys['arrowleft']||keys['arrowright']) standUp();
    } else {
      movePlayer(dt,blockedCHB);
      if(enterCool>0){ enterCool-=dt; }
      else { const fx=player.x+4, fy=player.y+15;
        for(const d of chbDoors){ if(fx<d.x+d.w&&fx+8>d.x&&fy<d.y+d.h&&fy+6>d.y){ if(d.to==='town'){ exitCHB(); break; } else if(d.to==='cafe'){ enterCafe(); break; } else if(d.to==='wohnung'){ enterWohnung(); break; } else if(d.to==='mitte'){ enterMitte(); break; } } } }
      if(encCool>0) encCool-=dt;
      checkEncounterCHB();
    }
  } else if(G.state==='play' && G.scene==='kl'){
    if(klJump){ updateKLJump(dt); }
    else {
      movePlayer(dt,blockedKL);
      if(enterCool>0){ enterCool-=dt; }
      else { const fx=player.x+4, fy=player.y+15;
        for(const d of klDoors){ if(fx<d.x+d.w&&fx+8>d.x&&fy<d.y+d.h&&fy+6>d.y){ if(d.to==='town'){ exitKL(); break; } } } }
      if(encCool>0) encCool-=dt;
      checkEncounterKL();
    }
    klcamx=clamp(player.x+8-LW/2,0,WPX-LW); klcamy=clamp(player.y+16-LH/2,0,HPX-LH);
  } else if(G.state==='play' && G.scene==='mitte'){
    movePlayer(dt,blockedMitte);
    if(enterCool>0){ enterCool-=dt; }
    else { const fx=player.x+4, fy=player.y+15;
      for(const d of mitDoors){ if(fx<d.x+d.w&&fx+8>d.x&&fy<d.y+d.h&&fy+6>d.y){ if(d.to==='chb'){ exitMitte(); break; } else if(d.to==='club' && clubUnlocked){ enterClub(); break; } } } }
    if(encCool>0) encCool-=dt;
    checkEncounterMitte();
    mitcamx=clamp(player.x+8-LW/2,0,MITPX-LW); mitcamy=clamp(player.y+16-LH/2,0,MITHPX-LH);
  } else if(G.state==='play' && G.scene==='club'){
    if(sitting){
      if(keys['w']||keys['a']||keys['s']||keys['d']||keys['arrowup']||keys['arrowdown']||keys['arrowleft']||keys['arrowright']) standUp();
    } else {
      movePlayer(dt,blockedClub);
      if(enterCool>0){ enterCool-=dt; }
      else { const fx=player.x+4, fy=player.y+15;
        for(const d of clubDoors){ if(fx<d.x+d.w&&fx+8>d.x&&fy<d.y+d.h&&fy+6>d.y){ if(d.to==='mitte'){ exitClub(); break; } } } }
    }
    clubcamx=clamp(player.x+8-LW/2,0,CLUBPX-LW); clubcamy=clamp(player.y+16-LH/2,0,CLUBHPX-LH);
  }
  if(grassFlash>0) grassFlash-=dt;
  tickHealFx(dt);
  if(G.scene==='town'){
    if(!reduce) for(const n of npcs){ if(n.wander){ n.t+=dt; const off=Math.sin(n.t*0.6)*18; const tgt=n.base+off;
      const old=n.x; n.x+=clamp(tgt-n.x,-12*dt,12*dt); n.dir = n.x>old+0.02?'right':n.x<old-0.02?'left':n.dir;
      n.frame = Math.abs(n.x-old)>0.05 ? 1+((n.t*5|0)%2) : 0; } }
    if(hasLeo){ cat.x+=clamp((player.x-10)-cat.x,-40*dt,40*dt); cat.y+=clamp((player.y+4)-cat.y,-40*dt,40*dt); cat.dir=player.x>cat.x?'right':'left'; }
    else { cat.t+=dt; if(!reduce && cat.t>3+Math.random()*3){ cat.t=0; cat.phase^=1; cat.dir=cat.phase?'right':'left'; } }
    raven.caw+=dt;
    camx=clamp(player.x+8-LW/2,0,WPX-LW); camy=clamp(player.y+16-LH/2,0,HPX-LH);
  }
  if(G.scene==='chb'){
    if(!reduce) for(const n of chbNpcs){ if(n.play){ n.t+=dt; n.frame=1+((n.t*3|0)%2); } else if(n.wander){ n.t+=dt; const off=Math.sin(n.t*0.6)*16; const tgt=n.base+off; const old=n.x; n.x+=clamp(tgt-n.x,-12*dt,12*dt); n.dir=n.x>old+0.02?'right':n.x<old-0.02?'left':n.dir; n.frame=Math.abs(n.x-old)>0.05?1+((n.t*5|0)%2):0; } }
    ccamx=clamp(player.x+8-LW/2,0,WPX-LW); ccamy=clamp(player.y+16-LH/2,0,HPX-LH);
  }
  if(G.scene==='mitte'){
    if(!reduce) for(const n of mitNpcs){ if(n.play){ n.t+=dt; n.frame=1+((n.t*3|0)%2); } else if(n.wander){ n.t+=dt; const off=Math.sin(n.t*0.6)*(n.range||16); const tgt=n.base+off; const old=n.x; n.x+=clamp(tgt-n.x,-12*dt,12*dt); n.dir=n.x>old+0.02?'right':n.x<old-0.02?'left':n.dir; n.frame=Math.abs(n.x-old)>0.05?1+((n.t*5|0)%2):0; } }
    mitcamx=clamp(player.x+8-LW/2,0,MITPX-LW); mitcamy=clamp(player.y+16-LH/2,0,MITHPX-LH);
  }
  if(G.scene==='club'){
    if(!reduce) for(const n of clubNpcs){ if(n.play){ n.t+=dt; n.frame=1+((n.t*4|0)%2); } }
    clubcamx=clamp(player.x+8-LW/2,0,CLUBPX-LW); clubcamy=clamp(player.y+16-LH/2,0,CLUBHPX-LH);
  }
  T+=dt;
}

const DEXK=4;   // interne Aufloesung fuer den Berlinodex (scharfe Schrift)
function setDexRes(on){
  if(on){ if(cv.width!==LW*DEXK){ cv.width=LW*DEXK; cv.height=LH*DEXK; } X.setTransform(DEXK,0,0,DEXK,0,0); X.imageSmoothingEnabled=true; cv.style.imageRendering='auto'; }
  else { if(cv.width!==LW){ cv.width=LW; cv.height=LH; } X.setTransform(1,0,0,1,0,0); X.imageSmoothingEnabled=false; cv.style.imageRendering='pixelated'; }
}
function render(){ _render(); if(loveAura>0 && (G.state==='battle'||G.state==='play')) drawLoveAura(); }
function _render(){
  if(G.state==='dex'||G.state==='dexEntry'){ setDexRes(true); if(G.state==='dex') renderDex(); else renderDexEntry(); return; }
  setDexRes(false);
  if(G.state==='team'){ renderTeam(); return; }
  if(G.state==='catchChoice'){ renderCatchChoice(); return; }
  if(G.state==='evolve'){ renderEvolve(); return; }
  if(G.state==='cutscene'){ if(G.scene==='eicheOben') renderEicheOben(); else renderEiche(); drawFade(); return; }
  if(G.state==='reveal'){ renderEicheOben(); return; }
  if(G.state==='starter'){ renderStarterSelect(); return; }
  if(G.state==='starterConfirm'){ renderStarterConfirm(); return; }
  if(G.state==='dex'){ renderDex(); return; }
  if(G.state==='dexEntry'){ renderDexEntry(); return; }
  if(G.scene==='battle'){ renderBattle(); return; }
  if(G.scene==='efes'){ renderEfes(); return; }
  if(G.scene==='eiche'){ renderEiche(); return; }
  if(G.scene==='eicheOben'){ renderEicheOben(); return; }
  if(G.scene==='cafe'){ renderCafe(); return; }
  if(G.scene==='wohnung'){ renderWohnung(); return; }
  if(G.scene==='chb'){ renderCHB(); return; }
  if(G.scene==='kl'){ renderKL(); return; }
  if(G.scene==='mitte'){ renderMitte(); return; }
  if(G.scene==='club'){ renderClub(); return; }
  X.clearRect(0,0,LW,LH);
  // BELOW
  X.drawImage(below, camx,camy,LW,LH, 0,0,LW,LH);
  // Hohes Gras rascheln (kleine Tuffs über Spielerfüßen, wenn drin)
  // Entities y-sortiert
  const ents=[];
  ents.push({y:player.y+22,draw:()=>drawChar(X,player.x-camx,player.y-camy,player.dir,player.frame,PAL_PLAYER)});
  for(const n of npcs) ents.push({y:n.y+22,draw:()=>drawChar(X,(n.x-camx)|0,(n.y-camy)|0,n.dir,n.frame||0,n.pal)});
  ents.push({y:cat.y+10,draw:()=>drawCat(cat.x-camx,cat.y-camy,cat.dir)});
  ents.push({y:raven.y+8,draw:()=>drawRaven(raven.x-camx,raven.y-camy)});
  ents.sort((a,b)=>a.y-b.y); for(const e of ents) e.draw();
  // ABOVE (Kronen, Dächer, Türme — Spieler läuft dahinter)
  X.drawImage(above, camx,camy,LW,LH, 0,0,LW,LH);
  // Encounter-Gras-Flash
  if(grassFlash>0){ X.fillStyle='rgba(120,200,90,'+(grassFlash*0.5)+')'; X.fillRect(0,0,LW,LH); }
  // LICHT
  drawLight(camx,camy,T); X.drawImage(lightCv,0,0);
}

function drawCat(sx,sy,dir){ sx|=0;sy|=0;
  X.fillStyle='rgba(20,18,30,.22)'; X.beginPath(); X.ellipse(sx+6,sy+9,5,1.8,0,0,7); X.fill();
  px(X,sx+1,sy+3,11,5,'#6a5240'); // Körper getigert
  for(let i=0;i<4;i++) px(X,sx+2+i*2,sy+3,1,5,'#4e3c2e');
  px(X,sx+(dir==='right'?9:0),sy+1,4,4,'#6a5240'); // Kopf
  px(X,sx+(dir==='right'?9:1),sy,1,1,'#4e3c2e'); px(X,sx+(dir==='right'?11:3),sy,1,1,'#4e3c2e'); // Ohren
  px(X,sx+(dir==='right'?10:1),sy+2,1,1,'#caa23a'); // Auge
  px(X,sx+(dir==='right'?0:11),sy+2,2,4,'#6a5240'); // Schwanz
}
function drawRaven(sx,sy){ sx|=0;sy|=0;
  X.fillStyle='rgba(20,18,30,.22)'; X.beginPath(); X.ellipse(sx+4,sy+7,3,1.4,0,0,7); X.fill();
  px(X,sx+1,sy+2,7,5,'#1a1822'); px(X,sx+5,sy,3,3,'#1a1822'); px(X,sx+7,sy+1,2,1,'#3a3340');
  px(X,sx+6,sy+1,1,1,'#caa23a'); px(X,sx,sy+5,2,2,'#0e0c14');
  if(raven.caw%4<0.12){ X.fillStyle='#cfc7c2'; X.font='6px Georgia'; X.fillText('krah',sx+8,sy-2); }
}

let enterCool=0;
export function setEnterCool(v){ enterCool=v; }

/* ======================================================================
   CHARLOTTENBURG-WILMERSDORF — zweiter Bezirk (eigene Overworld)
   ====================================================================== */
const CHB_LOADSCREEN="assets/images/chb-loadscreen.jpg";
let churchCv=null; // prozedural gezeichneter »hohler Zahn« (siehe buildChurchSprite)

const cBelow=document.createElement('canvas'); cBelow.width=WPX; cBelow.height=HPX;
const cAbove=document.createElement('canvas'); cAbove.width=WPX; cAbove.height=HPX;
const cB=cBelow.getContext('2d'), cA=cAbove.getContext('2d');
cB.imageSmoothingEnabled=false; cA.imageSmoothingEnabled=false;
const cground=new Uint8Array(MAPW*MAPH);
const cgi=(x,y)=>y*MAPW+x;
function cfill(code,x0,y0,x1,y1){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) if(x>=0&&y>=0&&x<MAPW&&y<MAPH) cground[cgi(x,y)]=code; }

const chbSolids=[], chbInters=[], chbDoors=[], chbNpcs=[], chbGlows=[];
function cSolid(x,y,w,h){ chbSolids.push({x,y,w,h}); }
function cInter(x,y,w,h,who,lines){ chbInters.push({x,y,w,h,who,lines}); }

let ccamx=0, ccamy=0;
const chbEntry={x:16*TILE, y:22*TILE};
let chbReturn={x:248, y:108, dir:'down'};
const CHURCH={x:5*TILE, y:6*TILE, w:120, h:120};

const PAL_BOULE={coat:'#8a5a3a',coatHi:'#a4744f',coatLo:'#6e4630',pants:'#3a3328',shoe:'#2a2118',skin:'#e8c39a',hair:'#3a2a1a'};
const PAL_CHESS={coat:'#46607a',coatHi:'#5a7892',coatLo:'#36506a',pants:'#3a3f4a',shoe:'#2a2118',skin:'#d8b48a',hair:'#cfc7c2'};
const PAL_GIRL ={coat:'#b5486a',coatHi:'#cf6386',coatLo:'#923a55',pants:'#4a4452',shoe:'#2a2118',skin:'#e8c39a',hair:'#5a3a22'};
// Schnoesel — Sakko/Steppweste, glattes Haar
const PAL_SNOB1={coat:'#2f4256',coatHi:'#41596f',coatLo:'#243748',pants:'#cdbfa0',shoe:'#3a2a1a',skin:'#f0d0a8',skinHi:'#f8dcb8',hair:'#caa23a'};
const PAL_SNOB2={coat:'#7a3b3b',coatHi:'#9a5252',coatLo:'#5e2c2c',pants:'#d8cdb4',shoe:'#3a2a1a',skin:'#ecc8a2',skinHi:'#f6d8b4',hair:'#3a2a1a'};
// Mate-Studenten — Armyjacke / Strickpulli, entspannt
const PAL_STUD1={coat:'#5a6a3a',coatHi:'#72844c',coatLo:'#46522c',pants:'#2f3540',shoe:'#2a2118',skin:'#e8c39a',hair:'#3a2a1a'};
const PAL_STUD2={coat:'#8a6a4a',coatHi:'#a4845f',coatLo:'#6e5236',pants:'#3a3f4a',shoe:'#2a2118',skin:'#d8b48a',hair:'#6a4a2a',curly:true};
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
function buildCHB(){
  paintCHBGround();
  buildChurchSprite();
  chbTree(31,12); chbTree(3,11);
  cSolid(CHURCH.x+24, CHURCH.y+CHURCH.h-22, CHURCH.w-48, 18);
  cInter(CHURCH.x+30, CHURCH.y+CHURCH.h-16, CHURCH.w-60, 16, 'Gedaechtniskirche',
    ['Die Kaiser-Wilhelm-Gedaechtniskirche. Der »hohle Zahn« — oben abgebrochen, absichtlich nie ganz repariert. Mahnmal mitten im Trubel.',
     'Drinnen leuchtet blaues Glas. Draussen rauscht der Verkehr, als waere nichts.']);
  chbSpaeti(24,15);
  // durchgehende Gruenderzeit-Zeile am oberen Strassenrand (Blockrandbebauung) — mit Durchgang
  for(let i=0;i<8;i++){ if(i===5) continue; const p=ALTBAU_PALS[i%4]; chbAltbau(i*4,0,4, i===4?Object.assign({},p,{door:true}):p); }
  chbAltbau(32,0,2, ALTBAU_PALS[1]);
  chbCafe(14,13);
  chbBench(9,5); chbBench(18,8);
  chbLamp(8,16); chbLamp(26,16); chbLamp(30,16); chbLamp(12,9);
  chbDoors.push({x:15*TILE,y:24*TILE,w:2*TILE,h:TILE,to:'town'});
  chbDoors.push({x:32*TILE,y:17*TILE,w:2*TILE,h:2*TILE,to:'mitte'});
  cInter(31*TILE,17*TILE,2*TILE,2*TILE,'→ Mitte',['Nach Osten geht es rein nach Mitte. Fernsehturm, Alex, enge Strassen, teurer Kaffee. Und angeblich Level, die dir dein Team zerlegen.']);
  cInter(14*TILE,23*TILE,2*TILE,TILE,'→ Zehlendorf',['Der Weg zurueck nach Sueden — Richtung Zehlendorf. Ruhiger wird es da, das stimmt.']);
  chbNpcs.push(
    {x:25*TILE,y:5*TILE,dir:'right',pal:PAL_BOULE,who:'Boule-Olaf',play:true,t:0,frame:0,
      lines:['Ssscht — ich konzentrier mich.','Boule ist Schach fuer Leute die lieber draussen saufen.']},
    {x:27*TILE,y:6*TILE,dir:'left',pal:PAL_CHESS,who:'Schach-Renate',play:true,t:1,frame:0,
      lines:['Matt in drei. Setz dich, wenn du verlieren willst.','Frueher hab ich am Wittenbergplatz gespielt. Da war noch Niveau.']},
    {x:26*TILE,y:7*TILE,dir:'down',pal:PAL_GIRL,who:'Frisbee-Kid',play:true,t:2,frame:0,
      lines:['Wirf zurueck! ...Ne, lieber nich, du siehst nich so aus als ob.','Im hohen Gras huepft staendig was weg wenn meine Scheibe reinfliegt.']},
    {x:7*TILE,y:16*TILE+4,dir:'down',pal:PAL_OMA,who:'Kirchen-Oma',wander:true,base:7*TILE,t:0,frame:0,
      lines:['Der hohle Zahn, ja. Steht da seit ich denken kann.','Setz dich nicht ins hohe Gras, Kindchen. Da wohnt was.']},
    {x:30*TILE,y:4*TILE,dir:'down',pal:PAL_SNOB1,who:'Schnoesel Henning',play:true,t:0.5,frame:0,
      lines:['Erbpacht. Drei Generationen. Man kennt sich.','Joggen? Wir haben Leute, die das fuer uns erledigen.']},
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

function blockedCHB(nx,ny){ const fx=nx+4,fy=ny+15,fw=8,fh=6;
  if(fx<TILE||fy<TILE||fx+fw>WPX-TILE||fy+fh>HPX-TILE) return true;
  for(const s of chbSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}
let clastTile=-1;
function checkEncounterCHB(){
  const tx=(player.x+8)/TILE|0, ty=(player.y+16)/TILE|0;
  const t=cground[cgi(clamp(tx,0,MAPW-1),clamp(ty,0,MAPH-1))];
  if(t===7){ const id=ty*MAPW+tx;
    if(id!==clastTile && encCool<=0){ clastTile=id;
      if(Math.random()<0.22){ const w=rollWild('chb'); grassFlash=0.5; startBattle(w.id,w.lv,'chb'); } } }
  else clastTile=-1;
}
function sitDown(it){ sitting={bx:it.x,by:it.y}; player.x=it.x; player.y=it.y-4; player.dir='down'; player.frame=0;
  toast('Du setzt dich. Sonne im Gesicht, kurze Pause. (Bewegen = aufstehen)',2200); }
function standUp(){ if(!sitting) return; player.y=sitting.by+14; player.dir='down'; player.frame=0; sitting=null; }
function renderCHB(){
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

let _loadTimer=null;
function showDistrictLoad(src, after){
  const t=document.getElementById('title'), img=document.getElementById('loadImg'), pill=document.getElementById('startpill');
  img.src=src; if(pill) pill.textContent='laedt...';
  t.style.display='flex'; G.state='load';
  clearTimeout(_loadTimer);
  _loadTimer=setTimeout(()=>{ t.style.display='none'; if(pill) pill.textContent='Enter zum Start'; G.state='play'; if(after) after(); }, 1500);
}
function enterCHB(){
  showDistrictLoad(CHB_LOADSCREEN, ()=>{
    G.scene='chb'; player.x=chbEntry.x; player.y=chbEntry.y; player.dir='up'; player.frame=0; enterCool=0.5;
    ccamx=clamp(player.x+8-LW/2,0,WPX-LW); ccamy=clamp(player.y+16-LH/2,0,HPX-LH);
    setBanner('Charlottenburg-Wilmersdorf','Bezirk'); showBanner();
  });
}
function exitCHB(){
  G.scene='town'; sitting=null; player.x=chbReturn.x; player.y=chbReturn.y; player.dir=chbReturn.dir; player.frame=0;
  enterCool=0.5; setBanner('Zehlendorf Mitte','Bezirk'); showBanner();
}


/* ======================================================================
   GIGOS — KAMPF- & FANG-SYSTEM
   GIGODEX (alle Gigos, meiste als Stubs draw:null), Moves, Battle-Engine.
   Showpiece: Geeked up Racoon. Spieler-Kaempfer: Leo (Rueckenansicht).
   ====================================================================== */

// ---------- Moves ----------

// ---------- Team / Fang-Inventar / Dex ----------
export const party = [];            // Spieler-Gigos
export const dexSeen = new Set(), dexCaught = new Set();
export let ketaKapseln = 5;
export function useKetaKapsel(){ ketaKapseln--; }
export function setKetaKapseln(v){ ketaKapseln=v; }
export function relevelStats(m){ const b=GIGODEX[m.id]; const f=(s)=>Math.max(1,Math.round(s*(1+0.10*(m.level-1))));
  const oldMax=m.maxHP; const newMax=Math.round(b.hp*(1+0.12*(m.level-1)))+5;
  m.maxHP=newMax; m.hp=Math.min(newMax, Math.max(1,m.hp)+(newMax-oldMax)); m.atk=f(b.atk); m.def=f(b.def); m.spd=f(b.spd); }
let questGustav=false; let gotPunisher=false; export let loveAura=0; let clubUnlocked=false; let gateWalk=0;   // Blue-Punisher-Quest + Club-Gate







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

const klSolids=[], klInters=[], klDoors=[], klGlows=[];
function kSolid(x,y,w,h){ klSolids.push({x,y,w,h}); }
function kInter(x,y,w,h,who,lines){ klInters.push({x,y,w,h,who,lines}); }

let klcamx=0, klcamy=0;
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

function buildKL(){
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
  kInter(31*TILE,12*TILE,2*TILE,2*TILE,'\u2192 Zehlendorf',['Zurueck nach Osten, rauf nach Zehlendorf Mitte.']);
  kInter(2*TILE,22*TILE,3*TILE,2*TILE,'Schild',['\u00bbFrischluft statt Feinstaub\u00ab. Jemand hat ein Herz danebengemalt.']);
  kInter(28*TILE,22*TILE,3*TILE,2*TILE,'Schild',['\u00bbGrillen verboten\u00ab. Der Ascheklecks daneben sagt: wird trotzdem gemacht.']);
}

function blockedKL(nx,ny){ const fx=nx+4,fy=ny+15,fw=8,fh=6;
  if(fx<TILE||fy<TILE||fx+fw>WPX-TILE||fy+fh>HPX-TILE) return true;
  for(const s of klSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}
let kllastTile=-1;
function checkEncounterKL(){
  const tx=(player.x+8)/TILE|0, ty=(player.y+16)/TILE|0;
  const t=klground[kgi(clamp(tx,0,MAPW-1),clamp(ty,0,MAPH-1))];
  if(t===7){ const id=ty*MAPW+tx;
    if(id!==kllastTile && encCool<=0){ kllastTile=id;
      if(Math.random()<0.22){ const w=rollWild('kl'); grassFlash=0.5; startBattle(w.id,w.lv,'kl'); } } }
  else kllastTile=-1;
}

// --- Sprungbaum: Jump ins Wasser ---
let klJump=null;
function startKLJump(){
  player.x=SPRUNG.sx; player.y=SPRUNG.sy; player.dir='up'; player.frame=1;
  klJump={ t:0, phase:'air', dy:0 };
  toast('Absprung!',900);
}
function updateKLJump(dt){
  const J=klJump; J.t+=dt;
  if(J.phase==='air'){ const k=clamp(J.t/0.55,0,1);
    player.x=lerp(SPRUNG.sx,SPRUNG.wx,k); player.y=lerp(SPRUNG.sy,SPRUNG.wy,k); J.dy=Math.sin(k*Math.PI)*24; player.frame=1;
    if(k>=1){ J.phase='splash'; J.t=0; J.dy=0; toast('Platsch! Kalt. Erfrischend. Enten unbeeindruckt.',1500); } }
  else if(J.phase==='splash'){ player.frame=0; if(J.t>=0.7){ J.phase='back'; J.t=0; player.dir='down'; } }
  else if(J.phase==='back'){ const k=clamp(J.t/0.5,0,1);
    player.x=lerp(SPRUNG.wx,SPRUNG.sx,k); player.y=lerp(SPRUNG.wy,SPRUNG.sy,k); J.dy=Math.sin(k*Math.PI)*10;
    if(k>=1){ player.x=SPRUNG.sx; player.y=SPRUNG.sy; player.dir='down'; player.frame=0; klJump=null; } }
}

function renderKL(){
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
function enterKL(){
  G.scene='kl'; sitting=null; klJump=null; player.x=klEntry.x; player.y=klEntry.y; player.dir='left'; player.frame=0; enterCool=0.5;
  klcamx=clamp(player.x+8-LW/2,0,WPX-LW); klcamy=clamp(player.y+16-LH/2,0,HPX-LH);
  setBanner('Krumme Lanke','Zehlendorf, Berlin'); showBanner(); toast('Neue Karte: Krumme Lanke',2600);
}
function exitKL(){
  G.scene='town'; sitting=null; player.x=klReturn.x; player.y=klReturn.y; player.dir=klReturn.dir; player.frame=0; enterCool=0.5;
  setBanner('Zehlendorf Mitte','Bezirk'); showBanner();
}


/* ======================================================================
   MITTE — erster High-Level-Bezirk (Ost-Ausgang aus Wilmersdorf)
   Doppelt grosse Karte. Fernsehturm, Alexanderplatz, verwinkelte Strassen,
   Cafes & Restaurants mit sitzenden NPCs, Spree-Promenade mit Mate.
   ====================================================================== */
const MITW=68, MITH=52, MITPX=MITW*TILE, MITHPX=MITH*TILE;
const mitBelow=document.createElement('canvas'); mitBelow.width=MITPX; mitBelow.height=MITHPX;
const mitAbove=document.createElement('canvas'); mitAbove.width=MITPX; mitAbove.height=MITHPX;
const mitB=mitBelow.getContext('2d'), mitA=mitAbove.getContext('2d'); mitB.imageSmoothingEnabled=false; mitA.imageSmoothingEnabled=false;
const mground=new Uint8Array(MITW*MITH); const mgi=(x,y)=>y*MITW+x;
function mfill(code,x0,y0,x1,y1){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) if(x>=0&&y>=0&&x<MITW&&y<MITH) mground[mgi(x,y)]=code; }
const mitSolids=[], mitInters=[], mitDoors=[], mitNpcs=[], mitGlows=[];
function mSolid(x,y,w,h){ mitSolids.push({x,y,w,h}); }
function mInter(x,y,w,h,who,lines){ mitInters.push({x,y,w,h,who,lines}); }
let mitcamx=0, mitcamy=0;
const mitEntry={x:2*TILE, y:30*TILE};
let mitReturn={x:31*TILE, y:17*TILE, dir:'left'};

const PAL_WAITER={coat:'#2a2a2f',coatHi:'#3a3a42',coatLo:'#1e1e22',pants:'#20201f',shoe:'#141414',skin:'#e8c39a',hair:'#241a12'};
const PAL_TOURIST={coat:'#c85a3a',coatHi:'#e2744f',coatLo:'#9e4630',pants:'#4a5a3a',shoe:'#2a2118',skin:'#f0d0a8',hair:'#8a6a3a'};
const PAL_BUSKER={coat:'#5a3a7a',coatHi:'#744f9a',coatLo:'#463060',pants:'#2f2a3a',shoe:'#2a2118',skin:'#d8b48a',hair:'#2a1a10'};
const PAL_HIP={coat:'#3a6a6a',coatHi:'#4f8a8a',coatLo:'#2c5252',pants:'#3a3328',shoe:'#2a2118',skin:'#e8c39a',hair:'#3a2a1a'};
const PAL_CLUB1={coat:'#1e1e24',coatHi:'#30303a',coatLo:'#141418',pants:'#18181c',shoe:'#0e0e10',skin:'#e8c39a',hair:'#161210'};
const PAL_CLUB2={coat:'#2a2028',coatHi:'#3c2e38',coatLo:'#1c1620',pants:'#201820',shoe:'#0e0e10',skin:'#d8b48a',hair:'#2a1a10'};
const PAL_CLUB3={coat:'#20242a',coatHi:'#323840',coatLo:'#161a1e',pants:'#1a1c20',shoe:'#0e0e10',skin:'#f0d0a8',hair:'#3a2a1a',curly:true};
const TUER_SRC='assets/images/ui/tuer.png';
const TUER_IMG=new Image(); TUER_IMG.src=TUER_SRC;
const OWNER_SRC='assets/images/ui/owner.png';
const OWNER_IMG=new Image(); OWNER_IMG.src=OWNER_SRC;
const BARK_SRC='assets/images/ui/bark.png';
const BARK_IMG=new Image(); BARK_IMG.src=BARK_SRC;
const PUNISHER_SRC='assets/images/ui/punisher.png';
export const PUNISHER_IMG=new Image(); PUNISHER_IMG.src=PUNISHER_SRC;
const CLUB_LOADSCREEN='assets/images/club-loadscreen.jpg';

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
  mInter(cxpx-16, baseY-6, 32, 12, 'Fernsehturm', ['Der Fernsehturm. 368 Meter DDR-Trotz, sichtbar aus dem halben Land.','Bei Sonne blitzt ein Kreuz auf der Kugel — \u00bbRache des Papstes\u00ab nennen sie das hier.','Ganz oben soll es sich drehen. Dein Magen dreht sich beim Blick nach oben schon von allein.']);
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
function drawSpriteImg(im,ox,oy){ if(!im||!im.width) return; const p=X.imageSmoothingEnabled; X.imageSmoothingEnabled=false;
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
  mitB.fillStyle='#161410'; mitB.fillText('HEIDEGL\u00dcHEN',3,3);
  mitB.fillStyle='#e34d8c'; mitB.fillText('HEIDEGL\u00dcHEN',0,0);
  mitB.lineWidth=1.4; mitB.strokeStyle='#161410'; mitB.strokeText('HEIDEGL\u00dcHEN',0,0); mitB.restore();
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
  mInter(ex-4, y0+H-6, 40, 12, 'Heidegl\u00fchen',
    ['Heidegl\u00fchen. Bretterbude am Kanal \u2014 von aussen nur besprayte Holzwand. Drinnen soll die Sonne aufgehen und nie untergehen.',
     'Ueber dem seitlichen Eingang haengt ein schiefes Vordach, dahinter nur Dunkelheit und Bass.',
     'Noch kommst du hier nicht rein. Aber bald wird dieser Laden dein erster echter Test.']);
}
function buildMitte(){
  paintMitteGround();
  mitFernsehturm(37*TILE, 21*TILE);
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
  mInter(1*TILE,29*TILE,2*TILE,2*TILE,'\u2192 Wilmersdorf',['Zurueck nach Westen, raus aus dem Trubel, rein nach Charlottenburg-Wilmersdorf.']);
  mInter(37*TILE-8,6*TILE,32,16,'Alexanderplatz',['Der Alex. Beton, Bahnen, Buden. Alle rennen, keiner weiss wohin.','Der erste Club steht schon \u2014 unten an der Spree.']);
  // NPCs — Warteschlange vorm Heidegluehen (auf der Spree-Seite) + Ambiente
  mitNpcs.push(
    {x:8*TILE,y:44*TILE,sprite:'tuer',dir:'down',who:'Tuersteherin',frame:0,lines:['Die Tuersteherin mustert dich, dann nickt sie knapp Richtung Tor.','\u00bbNa los. Rein mit dir. Aber der Boss da drin macht dich fertig.\u00ab','Hinter ihr: Holz, Bass und Seifenblasen.']},
    {x:11*TILE,y:45*TILE,dir:'left',pal:PAL_CLUB1,who:'Schlange',frame:0,lines:['Steh hier seit zwei. Bewegt sich wie Beton.','Drin soll\u2019s knallen. Wenn se dich reinlassen.']},
    {x:12*TILE+6,y:44*TILE+4,dir:'left',pal:PAL_CLUB2,who:'Schlange',frame:0,lines:['Guck nich so eifrig, das riecht die Tuersteherin.','Erstes Mal? Merkt man. Bleib locker.']},
    {x:14*TILE,y:45*TILE,dir:'left',pal:PAL_CLUB3,who:'Schlange',frame:0,lines:['Schwarz traegt man hier. Immer.','Dein Team? Niedlich. Lass drin lieber stecken.']},
    {x:15*TILE+6,y:44*TILE+2,dir:'left',pal:PAL_CLUB1,who:'Schlange',frame:0,lines:['Mate leer, Geduld auch.','Der Laden ist aelter als du denkst.']},
    {x:17*TILE,y:45*TILE,dir:'left',pal:PAL_CLUB2,who:'Schlange',frame:0,lines:['Sonnenaufgang drin, Sonnenaufgang drauss\u2019. Man verliert das Gefuehl.','Sssh. Nich draengeln.']},
    {x:18*TILE+6,y:44*TILE+4,dir:'left',pal:PAL_CLUB3,who:'Schlange',frame:0,lines:['Ich kenn die Tuersteherin. ...Kenn sie nich.','Bald biste dran, Kleiner. Nur nich heut.']},
    {x:44*TILE,y:45*TILE,dir:'right',pal:PAL_STUD1,who:'Mate-Trinker',play:true,t:0.3,frame:0,lines:['Spree, Sonne, Mate. Mehr Bezirk geht nicht.','Zone 2? Bruder, ich bin in Zone Ufer.']},
    {x:48*TILE,y:45*TILE,dir:'left',pal:PAL_STUD2,who:'Mate-Trinkerin',play:true,t:1.4,frame:0,lines:['Pfandflasche steht, Diskurs laeuft, alles gut.','Der Club da hinten? Da kommste noch nich rein.']},
    {x:36*TILE,y:12*TILE,dir:'down',pal:PAL_BUSKER,who:'Strassenmusiker',play:true,t:0.7,frame:0,lines:['Drei Akkorde, ein Hut, der Alex als Buehne.','Wirf wat rein, dann spiel ich dein Team ein Siegerlied. Vielleicht.']},
    {x:41*TILE,y:14*TILE,dir:'left',pal:PAL_TOURIST,who:'Tourist',wander:true,base:41*TILE,range:20,t:0,frame:0,lines:['Excuse me — wo Fernsehturm? ...Ach. Da. Logisch.','So many Level. My little guy is not ready, oh no.']}
  );
}
function blockedMitte(nx,ny){ const fx=nx+4,fy=ny+15,fw=8,fh=6;
  if(fx<TILE||fy<TILE||fx+fw>MITPX-TILE||fy+fh>MITHPX-TILE) return true;
  for(const s of mitSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}
let mlastTile=-1;
function checkEncounterMitte(){
  const tx=(player.x+8)/TILE|0, ty=(player.y+16)/TILE|0;
  const t=mground[mgi(clamp(tx,0,MITW-1),clamp(ty,0,MITH-1))];
  if(t===7){ const id=ty*MITW+tx;
    if(id!==mlastTile && encCool<=0){ mlastTile=id; if(Math.random()<0.24){ const w=rollWild('mitte'); grassFlash=0.5; startBattle(w.id,w.lv,'mitte'); } } }
  else mlastTile=-1;
}
function renderMitte(){
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
function enterMitte(){
  G.scene='mitte'; sitting=null; player.x=mitEntry.x; player.y=mitEntry.y; player.dir='right'; player.frame=0; enterCool=0.5;
  mitcamx=clamp(player.x+8-LW/2,0,MITPX-LW); mitcamy=clamp(player.y+16-LH/2,0,MITHPX-LH);
  setBanner('Mitte','High-Level-Bezirk'); showBanner(); toast('Neue Karte: Mitte \u2014 Akhs Lvl 15\u201330. Pass auf dein Team auf.',3000);
}
function exitMitte(){
  G.scene='chb'; sitting=null; player.x=mitReturn.x; player.y=mitReturn.y; player.dir=mitReturn.dir; player.frame=0; enterCool=0.5;
  ccamx=clamp(player.x+8-LW/2,0,WPX-LW); ccamy=clamp(player.y+16-LH/2,0,HPX-LH);
  setBanner('Charlottenburg-Wilmersdorf','Bezirk'); showBanner();
}


/* ======================================================================
   HEIDEGLUEHEN — Innenbereich (begehbar). Open-Air, alles Holz.
   Spree an der einen Laengsseite, Palisade mit Lichterketten/Girlanden an
   der anderen. DJ-Booth vorn, Buehne mit Couch dahinter, 2. Stock mit Owner.
   Seifenblasen in der Luft, viele Leute.
   ====================================================================== */
const CLUBW=48, CLUBH=18, CLUBPX=CLUBW*TILE, CLUBHPX=CLUBH*TILE;
const clubBelow=document.createElement('canvas'); clubBelow.width=CLUBPX; clubBelow.height=CLUBHPX;
const clubAbove=document.createElement('canvas'); clubAbove.width=CLUBPX; clubAbove.height=CLUBHPX;
const clB=clubBelow.getContext('2d'), clA=clubAbove.getContext('2d'); clB.imageSmoothingEnabled=false; clA.imageSmoothingEnabled=false;
const clbground=new Uint8Array(CLUBW*CLUBH); const clbgi=(x,y)=>y*CLUBW+x;
const clubSolids=[], clubInters=[], clubDoors=[], clubNpcs=[], clubGlows=[];
function clSolid(x,y,w,h){ clubSolids.push({x,y,w,h}); }
function clInter(x,y,w,h,who,lines){ clubInters.push({x,y,w,h,who,lines}); }
let clubcamx=0, clubcamy=0; let clubDisco=null; let clubWaesche=null;
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
function drawHeart(c,x,y,s,col){ c.fillStyle=col; c.fillRect(x-s,y-s,s,s); c.fillRect(x+1,y-s,s,s); c.fillRect(x-s,y,2*s+1,s+1); c.fillRect(x-s+1,y+s+1,2*s-1,1); c.fillRect(x,y+s+2,1,1); }
function drawLoveAura(){ X.save();
  X.fillStyle='rgba(255,120,180,0.13)'; X.fillRect(0,0,LW,LH);
  for(let i=0;i<22;i++){ const wy=LH+8-((T*(16+(i%6)*4)+i*90)%(LH+40)); const wx=((i*53)%LW)+Math.sin(T*1.2+i)*14; const s=1+(i%3);
    drawHeart(X,(wx)|0,(wy)|0,s,'rgba(255,'+(90+(i%3)*30)+',150,'+(0.45+0.3*Math.sin(T*3+i))+')'); }
  X.restore(); }
function popPunisher(){ const i=inventory.indexOf('bluePunisher'); if(i<0) return; inventory.splice(i,1); if(invOpen) renderInv(); loveAura=48;
  toast('Blue Punisher gepoppt \u2014 Aura of Love, Peace & Harmony. Dein Team: +80% ATK!',3600); }
function dealerTalk(){
  if(!questGustav){ openDialog('Typ in Schwarz',['Ein Typ in komplett Schwarz, Kapuze tief im Gesicht. Er mustert dich. \u00bb...\u00ab','Er sagt nichts. Noch kennt er dich nicht.']); return; }
  if(!gotPunisher){ gotPunisher=true; addItem('bluePunisher');
    openDialog('Typ in Schwarz',['\u00bbGustav schickt dich? ...Aight.\u00ab','Er drueckt dir eine kleine blaue Raute mit Totenkopf in die Hand \u2014 Blue Punisher.','\u00bbEin Teil. Wirf sie ein wenn du bereit bist: druck P. Danach ist alles Liebe \u2014 und dein Team haut +80% zu. Nur so kriegst du den Owner klein.\u00ab']); return; }
  openDialog('Typ in Schwarz',['\u00bbHaste doch schon. Immer mit der Ruhe, ja?\u00ab','\u00bbEinwerfen mit P. Wenn du bereit bist.\u00ab']); }
export function drawBluePunisher(c,cx,cy,s){ c.fillStyle='#2b6fd0'; c.beginPath(); c.moveTo(cx,cy-2*s); c.lineTo(cx+2.6*s,cy-0.4*s); c.lineTo(cx,cy+2*s); c.lineTo(cx-2.6*s,cy-0.4*s); c.closePath(); c.fill();
  c.fillStyle='#5a9ce8'; c.fillRect(cx-1,(cy-2*s+1)|0,2,1); c.fillStyle='#cfe4fa'; c.fillRect(cx-1,cy-1,2,2); c.fillStyle='#2b6fd0'; c.fillRect(cx-1,cy,1,1); c.fillRect(cx,cy,1,1); }
function drawPunisherHUD(){ if(!inventory.includes('bluePunisher')) return;
  let tx=18; if(PUNISHER_IMG&&PUNISHER_IMG.width){ const p=X.imageSmoothingEnabled; X.imageSmoothingEnabled=false; X.drawImage(PUNISHER_IMG,5,4,PUNISHER_IMG.width,PUNISHER_IMG.height); X.imageSmoothingEnabled=p; tx=PUNISHER_IMG.width+8; } else drawBluePunisher(X,10,10,3);
  X.fillStyle='#f3ecd8'; X.font='8px Georgia'; X.textAlign='left'; X.textBaseline='top'; X.fillText('[P] poppen',tx,8); }
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
function buildClub(){
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
    {x:40*TILE+4,y:3*TILE+4,sprite:'owner',dir:'down',who:'Owner',frame:0,lines:['Der Owner. Grauer Schopf, schwarze Lederjacke, Kette aus Gold, Blick aus Stein.','\u00bbMein Laden. Meine Regeln. Willst du hier oben stehen, musst du erst durch alle da unten \u2014 und dann durch mich.\u00ab','(Man munkelt: nuechtern schlaegt ihn keiner.)']},
    // Tuersteher an den Metalltueren (Ausgang)
    {x:44*TILE,y:2*TILE+2,pal:PAL_WAITER,who:'Tuersteher',dir:'down',frame:0,lines:['Der Tuersteher nickt Richtung Metalltueren. »Raus geht immer.«','»Rein war schwerer, wa?«']},
    {x:46*TILE,y:2*TILE+2,pal:PAL_WAITER,who:'Tuersteher',dir:'down',frame:0,lines:['Arme verschraenkt, Blick geradeaus. Er sagt nichts.','Erst wenn der Owner faellt, gehoert dir der Laden. Nicht vorher.']},
    // Barkeeperin
    {x:6*TILE,y:3*TILE+2,sprite:'bark',dir:'down',who:'Barkeeperin',frame:0,lines:['Sie stellt ein Bier ab, ohne hinzusehen. \u00bbWas guckst du?\u00ab','\u00bbTrinkst du, oder willst du dich mit mir messen? Spoiler: beides endet schlecht fuer dich.\u00ab','(Fightbar \u2014 bald.)']},
    // Gnarley Gustav — Startup-Quest
    {x:16*TILE,y:7*TILE,pal:PAL_STUD2,who:'Gnarley Gustav',dir:'down',frame:0,lines:['\u00bbYo! Gnarley Gustav. Ich mach was mit Impact.\u00ab','\u00bbUnser Startup ist quasi das Airbnb fuer Gefuehle. Introducing: synergy. This is so Berlin, honestly.\u00ab','\u00bbAls Case Study fuer self improvement, ganz ehrlich: du brauchst die Blue Punisher. Absoluter Gamechanger, next level, hat mein ganzes Mindset disrupted.\u00ab','\u00bbFrag den Typ in komplett Schwarz beim Klo. Sag, Gustav schickt dich. Scale your vibe, bro.\u00ab']},
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
function blockedClub(nx,ny){ const fx=nx+4,fy=ny+15,fw=8,fh=6;
  if(fx<TILE||fy<TILE||fx+fw>CLUBPX-TILE||fy+fh>CLUBHPX-TILE) return true;
  for(const s of clubSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}
function renderClub(){
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
function enterClub(){ showDistrictLoad(CLUB_LOADSCREEN, ()=>{
  G.scene='club'; sitting=null; player.x=clubEntry.x; player.y=clubEntry.y; player.dir='right'; player.frame=0; enterCool=0.5;
  clubcamx=clamp(player.x+8-LW/2,0,CLUBPX-LW); clubcamy=clamp(player.y+16-LH/2,0,CLUBHPX-LH);
  setBanner('Heidegl\u00fchen','Club \u00b7 Open Air'); showBanner(); toast('Drinnen: Holz, Bass, Seifenblasen. Ganz hinten oben wartet der Owner.',3200); }); }
function exitClub(){ G.scene='mitte'; sitting=null; player.x=clubReturn.x; player.y=clubReturn.y; player.dir=clubReturn.dir; player.frame=0; enterCool=0.5;
  mitcamx=clamp(player.x+8-LW/2,0,MITPX-LW); mitcamy=clamp(player.y+16-LH/2,0,MITHPX-LH);
  setBanner('Mitte','High-Level-Bezirk'); showBanner(); }

buildWorld();
buildEfes();
buildCafe();
buildWohnung();
buildEiche();
buildEicheOben();
buildCHB();
buildKL();
buildMitte();
buildClub();
document.getElementById('loadImg').src=LOADSCREEN;

let last=performance.now();
function loop(now){ let dt=(now-last)/1000; last=now; if(dt>0.05)dt=0.05;
  update(dt); if(G.state!=='title') render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
