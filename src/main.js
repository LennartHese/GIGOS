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
import {
  chbInters, chbDoors, chbNpcs, buildCHB, blockedCHB, checkEncounterCHB,
  renderCHB, enterCHB, exitCHB, PAL_GIRL, PAL_STUD1, PAL_STUD2, cground,
} from './world/chb.js';
import {
  klInters, klDoors, buildKL, blockedKL, checkEncounterKL, klJump, startKLJump,
  updateKLJump, renderKL, enterKL, exitKL,
} from './world/kl.js';
import {
  MITW, MITH, MITPX, MITHPX, mitInters, mitDoors, mitNpcs, buildMitte, blockedMitte,
  checkEncounterMitte, renderMitte, enterMitte, exitMitte,
  PAL_WAITER, PAL_HIP, PAL_CLUB1, PAL_CLUB2, PAL_CLUB3,
  TUER_IMG, OWNER_IMG, BARK_IMG, drawSpriteImg, CLUB_LOADSCREEN,
} from './world/mitte.js';
import {
  clubInters, clubDoors, clubNpcs, buildClub, blockedClub, renderClub, enterClub, exitClub,
  CLUBPX, CLUBHPX,
} from './world/club.js';

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
export let sitting=null;      // {bx,by} wenn der Spieler auf einer Bank sitzt
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
export let encCool=0; let lastTile=-1;
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
export let grassFlash=0;
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
export let ccamx=0, ccamy=0;
export function setCcam(x,y){ ccamx=x; ccamy=y; }
export let klcamx=0, klcamy=0;
export function setKlCam(x,y){ klcamx=x; klcamy=y; }
export let mitcamx=0, mitcamy=0;
export function setMitCam(x,y){ mitcamx=x; mitcamy=y; }
export let clubcamx=0, clubcamy=0;
export function setClubCam(x,y){ clubcamx=x; clubcamy=y; }
export function setEnterCool(v){ enterCool=v; }

export let clastTile=-1;
export function setClastTile(v){ clastTile=v; }
function sitDown(it){ sitting={bx:it.x,by:it.y}; player.x=it.x; player.y=it.y-4; player.dir='down'; player.frame=0;
  toast('Du setzt dich. Sonne im Gesicht, kurze Pause. (Bewegen = aufstehen)',2200); }
function standUp(){ if(!sitting) return; player.y=sitting.by+14; player.dir='down'; player.frame=0; sitting=null; }

let _loadTimer=null;
export function showDistrictLoad(src, after){
  const t=document.getElementById('title'), img=document.getElementById('loadImg'), pill=document.getElementById('startpill');
  img.src=src; if(pill) pill.textContent='laedt...';
  t.style.display='flex'; G.state='load';
  clearTimeout(_loadTimer);
  _loadTimer=setTimeout(()=>{ t.style.display='none'; if(pill) pill.textContent='Enter zum Start'; G.state='play'; if(after) after(); }, 1500);
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









const PUNISHER_SRC='assets/images/ui/punisher.png';
export const PUNISHER_IMG=new Image(); PUNISHER_IMG.src=PUNISHER_SRC;


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
export function drawPunisherHUD(){ if(!inventory.includes('bluePunisher')) return;
  let tx=18; if(PUNISHER_IMG&&PUNISHER_IMG.width){ const p=X.imageSmoothingEnabled; X.imageSmoothingEnabled=false; X.drawImage(PUNISHER_IMG,5,4,PUNISHER_IMG.width,PUNISHER_IMG.height); X.imageSmoothingEnabled=p; tx=PUNISHER_IMG.width+8; } else drawBluePunisher(X,10,10,3);
  X.fillStyle='#f3ecd8'; X.font='8px Georgia'; X.textAlign='left'; X.textBaseline='top'; X.fillText('[P] poppen',tx,8); }

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
