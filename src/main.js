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
  eicheReturn={x:x+13,y:y+35,dir:'down'};
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
  efesReturn={x:x+21,y:b+9,dir:'down'};
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
const cat={x:23*TILE,y:9*TILE+6,dir:'left',t:0,phase:0};
// Krähe auf der Restmülltonne
const raven={x:2*TILE+22,y:18*TILE+2,caw:0};

// --- Quest-NPCs: Haze (südlich vom Efes) & Passi (links unten) ---
const haze={x:388,y:356,dir:'up',pal:PAL_HAZE,who:'Haze',frame:0,talk:()=>hazeTalk()};
const passi={x:44,y:344,dir:'right',pal:PAL_PASSI,who:'Passi',frame:0,talk:()=>passiTalk()};
npcs.push(haze,passi);

/* ======================================================================
   LICHT — Dämmerung: warmer Tint + Vignette (leicht kalt = creepy) + Glows
   ====================================================================== */
const lightCv=document.createElement('canvas'); lightCv.width=LW; lightCv.height=LH;
const Lx=lightCv.getContext('2d');
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
    for(let i=0;i<3;i++){ const x=STC.x0+i*(STC.cw+STC.gap); if(p.x>=x&&p.x<=x+STC.cw&&p.y>=STC.y&&p.y<=STC.y+STC.ch){ starterIndex=i; starterPick=i; confirmIdx=0; G.state='starterConfirm'; return; } }
    return;
  }
  if(G.state==='starterConfirm'){ const p=canvasXY(e); const bw=210,bh=74,bx=(LW-bw)/2,by=(LH-bh)/2;
    if(p.y>=by+48&&p.y<=by+65){ if(p.x>=bx+8&&p.x<=bx+96){ grantStarter(STARTERS[starterPick].id); return; } if(p.x>=bx+bw-96&&p.x<=bx+bw-8){ G.state='starter'; return; } }
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
let hasLeo=false;      // Leo (Hazes Katze) als geliehener Begleiter nach Sörens Quest
let dialogQ=[], dialogWho='';
const banner=document.getElementById('banner');
const dlg=document.getElementById('dialog'), dWho=document.getElementById('dWho'), dText=document.getElementById('dText');
const toastEl=document.getElementById('toast'); let toastT=0;

function setBanner(name,sub){ document.getElementById('bName').textContent=name; document.getElementById('bSub').textContent=sub||'Bezirk'; }
function showBanner(){ banner.classList.add('show'); setTimeout(()=>banner.classList.remove('show'),2400); }
function toast(msg,ms){ toastEl.textContent=msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>toastEl.classList.remove('show'), ms||1800); }
let dialogOnEnd=null;
function openDialog(who,lines,onEnd){ G.state='dialog'; dialogWho=who;
  dialogQ=lines.map(l=> (typeof l==='string')?{who:who,text:l}:{who:(l.who??l.w??who),text:(l.text??l.t)} );
  dialogOnEnd=onEnd||null;
  const f=dialogQ.shift(); dWho.textContent=f.who; dText.textContent=f.text; dlg.style.display='block'; }
function advanceDialog(){ if(dialogQ.length){ const n=dialogQ.shift(); dWho.textContent=n.who; dText.textContent=n.text; }
  else { dlg.style.display='none'; G.state='play'; const cb=dialogOnEnd; dialogOnEnd=null; if(cb) cb(); } }
// --- Choice-Dialog ---
let choiceState=null; const dChoicesEl=document.getElementById('dChoices');
function openChoice(who,text,choices){ G.state='dialog'; dialogQ=[]; dialogOnEnd=null; dWho.textContent=who; dText.textContent=text; dlg.style.display='block'; choiceState={choices,idx:0}; renderChoices(); }
function renderChoices(){ if(!dChoicesEl) return; if(!choiceState){ dChoicesEl.style.display='none'; dChoicesEl.innerHTML=''; return; } dChoicesEl.innerHTML=''; dChoicesEl.style.display='block';
  choiceState.choices.forEach((c,i)=>{ const b=document.createElement('div'); b.className='dchoice'+(i===choiceState.idx?' sel':''); b.textContent=(i+1)+'. '+c.label;
    const pick=(e)=>{ if(e){e.preventDefault&&e.preventDefault(); e.stopPropagation&&e.stopPropagation();} pickChoice(i); };
    b.addEventListener('mousedown',pick); b.addEventListener('touchstart',pick,{passive:false}); dChoicesEl.appendChild(b); }); }
function moveChoice(d){ if(!choiceState) return; const n=choiceState.choices.length; choiceState.idx=(choiceState.idx+d+n)%n; renderChoices(); }
function pickChoice(i){ if(!choiceState) return; const c=choiceState.choices[i]; if(!c) return; choiceState=null; if(dChoicesEl){ dChoicesEl.style.display='none'; dChoicesEl.innerHTML=''; } c.fn(); }
// --- Heidegluehen Tuersteherin-Gate ---
function gateReject(msg){ choiceState=null; openDialog('Tuersteherin',[msg]); }
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
let invOpen=false;
const inventory=[];

// --- Item-Sprites (prozedural, Stil wie der Rest) ---
function drawMate(c){            // Club-Mate-Flasche (nach Don's Pixel-Vorlage)
  c.fillStyle='rgba(20,18,10,.20)'; c.fillRect(4,46,14,3);
  // Kronkorken (Navy)
  c.fillStyle='#15366e'; c.fillRect(7,0,8,6); c.fillStyle='#2a5aa0'; c.fillRect(7,0,8,2); c.fillStyle='#0e244a'; c.fillRect(7,5,8,1);
  // Hals (helles Bernsteinglas)
  c.fillStyle='#e3c389'; c.fillRect(8,6,6,11); c.fillStyle='#f2dcae'; c.fillRect(8,6,2,11); c.fillStyle='#c9a266'; c.fillRect(13,6,1,11);
  // Schulter
  c.fillStyle='#d8932a'; c.fillRect(5,16,12,4);
  // Korpus (Bernstein)
  c.fillStyle='#cf8a24'; c.fillRect(4,19,14,27);
  c.fillStyle='#eeb142'; c.fillRect(5,19,3,27);     // Glanzkante links
  c.fillStyle='#a86a18'; c.fillRect(15,19,2,27);    // Schattenkante rechts
  c.fillStyle='#b9781e'; c.fillRect(4,44,14,2);     // Boden dunkler
  // Etikett (creme)
  c.fillStyle='#efe3c4'; c.fillRect(5,24,12,17);
  // rote Zickzack-Ränder (angedeutet)
  c.fillStyle='#c0392b';
  for(let i=5;i<17;i+=2){ c.fillRect(i,24,1,1); c.fillRect(i+1,25,1,1); }
  for(let i=5;i<17;i+=2){ c.fillRect(i,40,1,1); c.fillRect(i+1,39,1,1); }
  // blauer Kreis + Gaucho-Silhouette
  c.fillStyle='#1d3f7a'; c.fillRect(8,26,6,6);
  c.fillStyle='#dfe2ea'; c.fillRect(9,27,4,1);      // Hutkrempe-Hint
  c.fillStyle='#16305f'; c.fillRect(9,28,4,3);      // Figur
  // CLUB-MATE-Schrift (angedeutet)
  c.fillStyle='#1d3f7a'; c.fillRect(6,34,10,2);
  c.fillStyle='#c0392b'; c.fillRect(6,37,10,1);
}
function drawZettel(c){          // „Consumption Smoothing" — Sprite nach Don's Vorlage
  const r=(x,y,w,h,col)=>{ c.fillStyle=col; c.fillRect(x,y,w,h); };
  // gezackter dunkler Rand + Pergament
  r(1,9,22,32,'#4a3018');
  r(2,10,20,30,'#e7d4a4'); r(2,10,20,3,'#f1e3bf');
  r(2,38,20,2,'#d2ba83'); r(20,11,2,29,'#d2ba83');
  for(const p of [[5,16],[14,20],[8,30],[17,15],[6,24],[15,33]]) r(p[0],p[1],1,1,'#d8c290');
  r(2,10,2,2,'#4a3018'); r(20,10,2,2,'#4a3018'); r(2,38,2,2,'#4a3018'); r(20,38,2,2,'#4a3018');
  r(11,9,2,1,'#4a3018'); r(11,40,2,1,'#4a3018');
  // Titel Zeile 1 „Consumption"
  for(const g of [[4,2],[7,3],[11,2],[14,2],[17,3]]) r(g[0],13,g[1],3,'#3a2414');
  r(4,13,1,1,'#e7d4a4'); r(9,14,1,1,'#e7d4a4'); r(15,14,1,1,'#e7d4a4');
  // Titel Zeile 2 „Smoothing"
  for(const g of [[5,3],[9,2],[12,3],[16,2]]) r(g[0],17,g[1],3,'#3a2414');
  r(6,18,1,1,'#e7d4a4'); r(13,18,1,1,'#e7d4a4');
  // Trennlinie
  r(4,21,16,1,'#7a5a3a');
  // Formel-Gekrakel
  r(4,24,6,1,'#5a4632'); r(11,24,3,1,'#5a4632'); r(16,24,3,1,'#5a4632');
  r(4,26,2,1,'#5a4632'); r(7,26,1,1,'#5a4632'); r(9,26,5,1,'#5a4632');
  // Mini-Steigungsgraph (unten links)
  r(4,29,1,8,'#3a2414'); r(4,36,9,1,'#3a2414');
  for(const p of [[5,35],[6,34],[7,34],[8,33],[9,32],[10,31],[11,31]]) r(p[0],p[1],1,1,'#7a3a1a');
  // rotes Wachssiegel (unten rechts)
  r(15,30,5,1,'#7c0e0e'); r(14,31,7,5,'#7c0e0e'); r(15,36,5,1,'#7c0e0e');
  r(15,31,5,4,'#c01818'); r(16,32,3,2,'#e23a3a'); r(16,32,2,1,'#f06060');
  r(15,33,3,1,'#8c1010'); r(20,37,1,1,'#a11414');
}
function drawBluePunisherItem(c){ if(typeof PUNISHER_IMG!=='undefined' && PUNISHER_IMG && PUNISHER_IMG.width){ c.imageSmoothingEnabled=false; const w=PUNISHER_IMG.width,h=PUNISHER_IMG.height,s=Math.min(22/w,44/h); c.drawImage(PUNISHER_IMG,(24-w*s)/2,(50-h*s)/2,w*s,h*s); } else if(typeof drawBluePunisher==='function'){ drawBluePunisher(c,12,26,4); } }
const ITEMS={
  keta:{name:'Keta Kapsel', draw:drawKeta},
  bluePunisher:{name:'Blue Punisher', draw:drawBluePunisherItem},
  zettel:{name:'Zettel: „Consumption Smoothing"', draw:drawZettel},
  mate:{name:'Club-Mate', draw:drawMate},
};
function addItem(id){ if(inventory.includes(id))return; inventory.push(id);
  if(invOpen) renderInv(); toast('🎒 '+ITEMS[id].name+' erhalten',2200); }
function renderInv(){ const grid=document.getElementById('invGrid'); grid.innerHTML='';
  if(!inventory.length){ grid.innerHTML='<div class="inv-empty">— noch leer —</div>'; return; }
  for(const id of inventory){ const it=ITEMS[id]; if(!it)continue;
    const slot=document.createElement('div'); slot.className='inv-slot';
    const cnv=document.createElement('canvas'); cnv.width=24; cnv.height=50; cnv.className='inv-cv';
    const cx=cnv.getContext('2d'); cx.imageSmoothingEnabled=false; it.draw(cx);
    const nm=document.createElement('div'); nm.className='inv-name'; nm.textContent= (id==='keta')? (it.name+' ×'+ketaKapseln) : it.name;
    slot.appendChild(cnv); slot.appendChild(nm); grid.appendChild(slot);
  }
}
function toggleInv(){ invOpen=!invOpen; document.getElementById('inv').style.display=invOpen?'block':'none'; document.getElementById('invBack').style.display=invOpen?'block':'none'; if(invOpen) renderInv(); }
function closeInv(){ if(!invOpen) return; invOpen=false; document.getElementById('inv').style.display='none'; document.getElementById('invBack').style.display='none'; }
document.getElementById('invClose').addEventListener('click',e=>{e.preventDefault();e.stopPropagation(); closeInv();});
document.getElementById('invBack').addEventListener('click',e=>{e.preventDefault(); closeInv();});

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
const EFB={x:18,y:92,x2:302,y2:164};   // begehbarer Essbereich im Efes
function blockedEfes(nx,ny){ const fx=nx+4, fy=ny+15, fw=8, fh=6;
  if(fx<EFB.x||fy<EFB.y||fx+fw>EFB.x2||fy+fh>EFB.y2) return true;
  for(const s of efesSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}
/* ======================================================================
   ENCOUNTER (Stub — Battle-Engine kommt portiert in der nächsten Runde)
   ====================================================================== */
const WILD=['Rave-Ratte','U-Bahn-Taube','Späti-Waschbär','Parkdackel','Currywurst-Wurm'];
let encCool=0, lastTile=-1;
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

/* ======================================================================
   UPDATE + RENDER
   ====================================================================== */
let camx=0,camy=0, T=0;
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
  if(healFx>0) healFx-=dt;
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

/* ======================================================================
   EFES GRILL — Innenraum (Heilstation, Pokécenter-Äquivalent)
   ====================================================================== */
const efesBG=document.createElement('canvas'); efesBG.width=LW; efesBG.height=LH;
const efesSolids=[];
const doener={x:144,y:30};
let healFx=0, enterCool=0;
let efesReturn={x:400,y:272,dir:'up'};

function buildEfes(){
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

function enterEfes(){ G.scene='efes'; player.x=152; player.y=116; player.dir='up'; player.frame=0;
  setBanner('Efes Grill','Imbiss · Heilung'); showBanner(); enterCool=0.5; }
function exitEfes(){ G.scene='town'; player.x=efesReturn.x; player.y=efesReturn.y; player.dir=efesReturn.dir; player.frame=0;
  enterCool=0.5; setBanner('Zehlendorf Mitte','Bezirk'); }
function talkDoener(){
  openDialog('Dönermann',[
    'Na, Alta! Komm rin, komm rin. Setz dir hin — deine Viecher sehn ja fix und fertich aus.',
    'Emaaa— einmal Heilung mit alles, ohne Zwiebeln. *fuchtelt mitm Messer* ...zack. Wie neu, Habibi.',
    'So. Frisch wie Fladenbrot ausm Ofen, deine Gigos. Und nu raus mit dir, ick hab Kundschaft.']);
  healFx=0.8; for(const g of party) g.hp=g.maxHP; toast('Deine Gigos sind wieder topfit! ✨',2200);
}

function renderEfes(){
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

/* ======================================================================
   ALL ABOUT WEST — Café-Innenraum (begehbar)
   ====================================================================== */
const cafeBG=document.createElement('canvas'); cafeBG.width=LW; cafeBG.height=LH;
const cafeSolids=[], cafeNpcs=[], cafeInters=[];
let cafeReturn={x:272,y:264,dir:'down'};
let wohnungReturn={x:288,y:48,dir:'down'};
const CAB={x:14,y:66,x2:306,y2:178};   // begehbarer Boden
const PAL_BARISTA={coat:'#36423a',coatHi:'#46544a',coatLo:'#28322c',pants:'#2f2a26',shoe:'#1a1510',skin:'#e6c2a0',hair:'#241c18'};
const PAL_WAITER1={coat:'#ece6d8',coatHi:'#f6f1e6',coatLo:'#cabfa8',pants:'#33343c',shoe:'#1a1510',skin:'#e8c49c',hair:'#1c1814'};
const PAL_WAITER2={coat:'#e0dccf',coatHi:'#efe9dc',coatLo:'#bcb29a',pants:'#2e2f36',shoe:'#1a1510',skin:'#ecc8a0',hair:'#221a16'};
const PAL_GAST1={coat:'#5d7f8e',coatHi:'#7a9aa8',coatLo:'#46606c',pants:'#3a3f4a',shoe:'#2a2118',skin:'#e8c39a',hair:'#e6c862'};
const PAL_GAST2={coat:'#b5486a',coatHi:'#cf6386',coatLo:'#923a55',pants:'#4a4452',shoe:'#2a2118',skin:'#e8c39a',hair:'#3a2a1a'};

function buildCafe(){
  const c=cafeBG.getContext('2d'); c.imageSmoothingEnabled=false; c.textBaseline='top';
  // Parkett-Boden (lange Dielen)
  px(c,0,0,LW,LH,'#7c5430');
  const planks=['#875c36','#7e552f','#90643c','#774f2a'];
  for(let y=44,r=0;y<LH;y+=9,r++){ const seam=(r*47)%16;
    px(c,0,y,LW,9,planks[r%4]); px(c,0,y,LW,1,'rgba(40,26,14,.35)');
    for(let x=-seam;x<LW;x+=64){ px(c,x,y,1,9,'rgba(40,26,14,.30)'); }
    for(let x=0;x<LW;x+=11){ if(hash(x,y)<.25) px(c,x+3,y+3+(hash(y,x)*3|0),3,1,'rgba(60,40,22,.4)'); } }
  // Rueckwand: links schwarze Fliesen (Bar)
  for(let y=0;y<44;y+=8)for(let x=0;x<156;x+=12){ c.fillStyle=((x/12+y/8)&1)?'#1c2126':'#171b20'; c.fillRect(x,y,12,8);
    c.fillStyle='#2c333a'; c.fillRect(x,y,12,1); c.fillRect(x,y,1,8); }
  // rechts blaugraue Wand (Lounge)
  px(c,156,0,LW-156,44,'#9aa6ac'); px(c,156,0,LW-156,2,'#aeb8bd'); px(c,156,42,LW-156,2,'#828d92');
  // Holz-Rahmen
  px(c,0,0,8,LH,'#4a3526'); px(c,LW-8,0,8,LH,'#4a3526'); px(c,0,LH-12,LW,12,'#3e2c1e'); px(c,0,LH-12,LW,2,'#5a4230'); px(c,2,0,2,LH,'#5a4230');
  // BAR: Glaeserregale
  function shelf(sy){ px(c,10,sy,140,2,'#6a4a30'); px(c,10,sy,140,1,'#86643f'); }
  shelf(8); shelf(20); shelf(32);
  for(let i=0;i<9;i++){ const bx=20+i*13; px(c,bx,2,5,6,'#1c2a1c'); px(c,bx+1,1,3,2,'#15201a'); px(c,bx,4,5,2,'#caa23a'); }
  for(let i=0;i<13;i++){ const gx=16+i*10; px(c,gx,14,3,6,'rgba(200,220,230,.55)'); px(c,gx-1,19,5,1,'rgba(220,235,240,.6)'); }
  for(let i=0;i<11;i++){ const gx=18+i*12; px(c,gx,26,4,6,'rgba(205,222,232,.5)'); px(c,gx,26,4,1,'rgba(230,240,245,.7)'); }
  px(c,14,22,9,10,'rgba(210,225,235,.5)'); px(c,15,24,7,7,'#d8b07a'); px(c,14,21,9,2,'#b8c4cc');
  px(c,26,24,7,8,'rgba(210,225,235,.5)'); px(c,27,26,5,5,'#c89a6a');
  // THEKE
  px(c,8,44,150,6,'#8a6240'); px(c,8,44,150,2,'#a8794e');
  px(c,8,50,150,18,'#5a3a24'); for(let x=14;x<156;x+=11) px(c,x,50,1,18,'#46301e');
  px(c,8,66,150,2,'#3a2618');
  px(c,96,30,30,16,'#22242a'); px(c,96,30,30,2,'#3a3d44'); px(c,99,33,9,8,'#c8ccce'); px(c,100,34,7,2,'#eef0f0');
  px(c,114,33,9,8,'#c8ccce'); px(c,110,46,3,4,'#6a6e72'); px(c,118,46,3,4,'#6a6e72'); px(c,100,28,4,2,'#caa23a');
  px(c,16,30,40,16,'#2a2a30'); px(c,18,31,36,14,'rgba(200,225,235,.35)'); px(c,18,31,36,1,'#cfe0e8');
  px(c,20,40,32,4,'#caa86e'); for(let i=0;i<4;i++) px(c,22+i*8,38,5,2,i&1?'#e2b86a':'#c98a5a');
  px(c,128,26,26,18,'#4a3a26'); px(c,130,28,22,14,'#222824'); px(c,130,28,22,1,'#32382e');
  c.fillStyle='#cfcabe'; c.font='4px Arial';
  ['IMMER WENN','DU LACHST,','STIRBT IRG-','WO EIN PRO-','BLEM \u2665'].forEach((s,i)=>c.fillText(s,131,29+i*3));
  px(c,60,40,4,4,'#c8a23a'); px(c,61,38,2,2,'#d8b24a');
  px(c,70,40,3,5,'#d8c0a0'); px(c,76,41,3,4,'#b8c4cc'); px(c,84,42,6,3,'#e8a23a');
  // LOUNGE: Buecherregale + Deko
  function bshelf(sy){ px(c,200,sy,108,2,'#5a4230'); px(c,200,sy,108,1,'#74583a'); }
  bshelf(8); bshelf(22); bshelf(36);
  const spine=['#7a3a30','#3a5a8a','#caa23a','#46603a','#8a6a4a','#b5486a','#3a4f7a','#cfc7c2','#5a7f8e','#9c4a3a'];
  for(let r=0;r<2;r++){ const sy=(r?24:10); for(let i=0;i<22;i++){ const bx=203+i*4.6; const h=8+(hash(bx,sy)*3|0);
    c.fillStyle=spine[(i*3+r)%spine.length]; c.fillRect(bx, sy+10-h, 3, h); c.fillStyle='rgba(255,255,255,.12)'; c.fillRect(bx,sy+10-h,3,1); } }
  px(c,206,30,8,6,'#7a5a3a'); px(c,222,31,5,5,'#b8c0c4'); px(c,236,30,4,6,'#caa23a'); px(c,250,31,7,5,'#5a4a32');
  px(c,286,8,18,22,'#caa24a'); px(c,288,10,14,18,'#6a7a86'); px(c,290,12,10,14,'#8a96a0');
  for(let i=0;i<10;i++){ const a=i/10*6.28; px(c, 272+Math.cos(a)*7|0, 22+Math.sin(a)*8|0, 2,2, i&1?'#7a2a2a':'#9a5a3a'); }
  // Chesterfield-Sofa
  function chester(x,y,w){ const lo='#2a1810',mid='#3e2418',hi='#5a3a26';
    px(c,x,y+6,w,16,mid); px(c,x,y+6,w,3,'#321e12'); px(c,x,y,w,8,mid); px(c,x,y,w,2,hi);
    px(c,x-4,y+2,7,20,lo); px(c,x+w-3,y+2,7,20,lo); px(c,x-4,y+2,7,2,hi); px(c,x+w-3,y+2,7,2,hi);
    for(let by=y+1;by<y+7;by+=4)for(let bx=x+4;bx<x+w-4;bx+=8) px(c,bx,by,1,1,'#1a0e08');
    for(let bx=x+4;bx<x+w-4;bx+=7) px(c,bx,y+10,1,1,'#6a4a30'); px(c,x-2,y+22,w+6,2,'rgba(20,12,8,.4)'); }
  chester(184,70,116);
  px(c,212,104,46,14,'rgba(200,220,230,.25)'); px(c,212,104,46,2,'#cfe0e8'); px(c,214,116,4,6,'#3a2a1a'); px(c,252,116,4,6,'#3a2a1a'); px(c,230,106,8,4,'#caa23a');
  px(c,166,98,20,16,'#5a3a22'); px(c,166,98,20,2,'#74502e'); px(c,166,104,20,1,'#3a2616'); px(c,174,101,4,3,'#c8a23a');
  // vordere Sitzgruppen
  function rtable(x,y){ px(c,x,y,22,3,'#7e5a3a'); px(c,x,y,22,1,'#9a724a'); px(c,x+3,y+3,3,8,'#5a3f28'); px(c,x+16,y+3,3,8,'#5a3f28'); px(c,x-2,y+11,26,2,'rgba(20,12,8,.3)'); }
  function chair(x,y){ px(c,x,y,8,3,'#6a4a30'); px(c,x,y-5,8,5,'#7a5638'); px(c,x,y-5,8,1,'#8e6a44'); px(c,x+1,y+3,1,4,'#4a3322'); px(c,x+6,y+3,1,4,'#4a3322'); }
  function sessel(x,y){ px(c,x,y,18,14,'#6a2c38'); px(c,x,y,18,3,'#843a48'); px(c,x-3,y+1,5,13,'#5a2530'); px(c,x+16,y+1,5,13,'#5a2530');
    for(let by=y+2;by<y+10;by+=3)for(let bx=x+3;bx<x+15;bx+=5) px(c,bx,by,1,1,'#3a1820'); px(c,x-3,y+14,24,2,'rgba(20,12,8,.4)'); }
  rtable(40,118); chair(36,122); chair(56,122);
  rtable(96,140); chair(92,144); chair(112,144);
  sessel(150,108); sessel(120,112);
  // Ausgang unten Mitte
  px(c,138,LH-12,44,12,'#2a1c12'); px(c,142,LH-9,36,9,'#6a4a30'); px(c,142,LH-9,36,2,'#8a6a44');
  px(c,146,LH-16,32,4,'#1a2126'); c.fillStyle='#cfe0e8'; c.font='6px Georgia'; c.fillText('\u2192 raus',150,LH-22);

  // Solids
  cafeSolids.length=0;
  cafeSolids.push({x:8,y:44,w:150,h:22},{x:180,y:70,w:124,h:26},{x:212,y:104,w:46,h:16},{x:166,y:98,w:20,h:16},
    {x:38,y:118,w:26,h:14},{x:94,y:140,w:26,h:14},{x:147,y:108,w:24,h:14},{x:117,y:112,w:24,h:14});
  // NPCs
  cafeNpcs.length=0;
  cafeNpcs.push(
    {x:64,y:24,dir:'down',pal:PAL_BARISTA,who:'Barista',frame:0,counter:true,
      lines:['Servus! All About West — Faltfront auf, Platte an, Kaffee laeuft.','Flat White? Geht aufs Haus, du siehst aus als haettste grad einen Bezirk renoviert.']},
    {x:100,y:118,dir:'right',pal:PAL_WAITER1,who:'Kellnerin Mai',wander:true,base:100,range:26,t:0,frame:0,
      lines:['Hi! Setz dich wohin du magst, ich komm gleich rum.','Der Sessel da is der beste Platz — aber pssst, nich weitersagen.']},
    {x:206,y:98,dir:'up',pal:PAL_WAITER2,who:'Kellner Jun',wander:true,base:206,range:22,t:1.1,frame:0,
      lines:['Zwei Cappuccino fuer die Lounge — kommt sofort.','Wir haben Zimtschnecken, frisch. Die sind ehrlich gefaehrlich gut.']},
    {x:228,y:72,dir:'down',pal:PAL_GAST1,who:'Gast',frame:0,
      lines:['Ich sitz hier seit zwei Stunden mit einem Flat White und einem angefangenen Roman.','Niemand stoert. Genau deswegen komm ich her.']},
    {x:122,y:108,dir:'down',pal:PAL_GAST2,who:'Gast',frame:0,
      lines:['Bester Cortado westlich vom Kudamm, ehrlich.','Und die Sessel — ich glaub ich zieh hier ein.']}
  );
  // Inters
  cafeInters.length=0;
  cafeInters.push({x:188,y:90,w:108,h:6,who:'Chesterfield',
    lines:['Abgewetztes Leder, tief durchgesessen — hier verschwinden ganze Nachmittage.','Jemand hat ein Buch liegen lassen: »Der Mythos des Sisyphos«. Na klar.']});
}
function talkBarista(){
  const n=cafeNpcs[0]; openDialog(n.who,n.lines); toast('Flat White aufs Haus \u2615',2000);
}
function enterCafe(){ G.scene='cafe'; sitting=null; player.x=152; player.y=138; player.dir='up'; player.frame=0;
  setBanner('All About West','Café · Charlottenburg'); showBanner(); enterCool=0.5; }
function exitCafe(){ G.scene='chb'; player.x=cafeReturn.x; player.y=cafeReturn.y; player.dir=cafeReturn.dir; player.frame=0;
  enterCool=0.5; setBanner('Charlottenburg-Wilmersdorf','Bezirk'); showBanner(); }
function blockedCafe(nx,ny){ const fx=nx+4,fy=ny+15,fw=8,fh=6;
  if(fx<CAB.x||fy<CAB.y||fx+fw>CAB.x2||fy+fh>CAB.y2) return true;
  for(const s of cafeSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}
function renderCafe(){
  X.clearRect(0,0,LW,LH); X.drawImage(cafeBG,0,0);
  const ents=[];
  for(const n of cafeNpcs) ents.push({y:n.y+16, draw:()=>drawChar(X,n.x|0,n.y|0,n.dir,n.frame||0,n.pal)});
  ents.push({y:player.y+16, draw:()=>drawChar(X,player.x|0,player.y|0,player.dir,player.frame,PAL_PLAYER)});
  ents.sort((a,b)=>a.y-b.y); for(const e of ents) e.draw();
  drawLightCafe();
}
function drawLightCafe(){
  Lx.clearRect(0,0,LW,LH);
  Lx.fillStyle='rgba(255,196,120,0.08)'; Lx.fillRect(0,0,LW,LH);
  let v=Lx.createRadialGradient(LW/2,LH/2,70,LW/2,LH/2,210); v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(28,16,8,0.42)');
  Lx.fillStyle=v; Lx.fillRect(0,0,LW,LH);
  Lx.globalCompositeOperation='lighter';
  function glow(gx,gy,r,col,a){ const rg=Lx.createRadialGradient(gx,gy,0,gx,gy,r); rg.addColorStop(0,col+a+')'); rg.addColorStop(1,col+'0)'); Lx.fillStyle=rg; Lx.fillRect(gx-r,gy-r,r*2,r*2); }
  const fl=reduce?1:0.86+0.14*Math.sin(T*3);
  glow(110,42,24,'rgba(255,150,70,',0.40*fl);    // Espresso-Ecke
  glow(96,104,40,'rgba(255,184,96,',0.34*fl);    // Pendel Mitte
  glow(232,96,42,'rgba(255,184,96,',0.30*fl);    // Pendel Lounge
  Lx.globalCompositeOperation='source-over';
  X.drawImage(lightCv,0,0);
}

/* ======================================================================
   WOHNUNG — begehbarer Altbau (Treppe rauf -> hohe Wohnung, Stuck, Parkett)
   Eine hohe, vertikal scrollende Szene. NPC "Lucas" sitzt auf der Couch.
   ====================================================================== */
const WOH=304;
const wohnungBG=document.createElement('canvas'); wohnungBG.width=LW; wohnungBG.height=WOH;
const wohnungSolids=[], wohnungNpcs=[], wohnungInters=[];
const PAL_LUCAS={coat:'#5e7d9e',coatHi:'#7a9aba',coatLo:'#486078',pants:'#3a3f4a',shoe:'#2a2118',skin:'#e8c39a',skinHi:'#f0d0a8',hair:'#e6c862'};
function buildWohnung(){
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
  px(c,144,WOH-16,32,4,'#e8e2d4'); c.fillStyle='#5a4a36'; c.font='6px Georgia'; c.fillText('\u2192 raus',150,WOH-22);
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
function enterWohnung(){ G.scene='wohnung'; sitting=null; player.x=152; player.y=274; player.dir='up'; player.frame=0;
  setBanner('Altbauwohnung','Charlottenburg-Wilmersdorf'); showBanner(); enterCool=0.5; }
function exitWohnung(){ G.scene='chb'; sitting=null; player.x=wohnungReturn.x; player.y=wohnungReturn.y; player.dir=wohnungReturn.dir; player.frame=0;
  enterCool=0.5; setBanner('Charlottenburg-Wilmersdorf','Bezirk'); }
function blockedWohnung(nx,ny){ const fx=nx+4, fy=ny+15, fw=8, fh=5;
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
function renderWohnung(){
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
/* ======================================================================
   ZEHLENDORF-EICHE — Innenraum (Sörens Versteck)  [Quest 1]
   ====================================================================== */
const eicheBG=document.createElement('canvas'); eicheBG.width=LW; eicheBG.height=LH;
const eicheSolids=[];
const ELB={x:64,y:78,x2:256,y2:158};
let eicheReturn={x:368,y:150,dir:'down'};
const soeren={x:148,y:80};
const PAL_SOEREN={coat:'#5a6048',coatHi:'#6e7458',coatLo:'#43472f',pants:'#3a3328',shoe:'#2a2118',skin:'#d8bfa0',hair:'#241c14',beard:'#2a2018'};

function blockedEiche(nx,ny){ const fx=nx+4,fy=ny+15,fw=8,fh=6;
  if(fx<ELB.x||fy<ELB.y||fx+fw>ELB.x2||fy+fh>ELB.y2) return true;
  for(const s of eicheSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}

function buildEiche(){
  const c=eicheBG.getContext('2d'); c.imageSmoothingEnabled=false; c.textBaseline='top';
  c.fillStyle='#120c08'; c.fillRect(0,0,LW,LH);
  // Erdboden-Ellipse mit konzentrischen Ringen
  c.save(); c.beginPath(); c.ellipse(160,110,122,74,0,0,7); c.clip();
  c.fillStyle='#5a4128'; c.fillRect(0,0,LW,LH);
  for(let i=0;i<340;i++){ c.fillStyle=hash(i,3)<.5?'#634730':'#503a22'; c.fillRect((hash(i,1)*LW)|0,(36+hash(i,2)*150)|0,2,2); }
  c.strokeStyle='#4a3520'; c.lineWidth=1;
  for(let r=16;r<124;r+=13){ c.beginPath(); c.ellipse(160,114,r,r*0.6,0,0,7); c.stroke(); }
  c.restore();
  // Wurzel-/Rindenring
  for(let a=0;a<6.283;a+=0.06){ const rx=124+Math.sin(a*5)*6, ry=78+Math.sin(a*7)*5;
    const ex=(160+Math.cos(a)*rx)|0, ey=(110+Math.sin(a)*ry)|0;
    c.fillStyle=hash(ex,ey)<.5?'#3a2818':'#4a3522'; c.fillRect(ex-3,ey-3,7,7);
    if(hash((a*40)|0,1)<.32){ c.fillStyle=hash(a,2)<.5?'#3c6029':'#4f7d39'; c.fillRect((ex+(hash(a,2)*6-3))|0,(ey+(hash(a,3)*6-3))|0,2,2);} }
  // Schild
  c.fillStyle='#2a1c12'; c.fillRect(124,12,72,32); c.fillStyle='#7a5436'; c.fillRect(126,14,68,28);
  c.fillStyle='#e9ddc0'; c.fillRect(128,16,64,24);
  c.fillStyle='#3a2a1a'; c.font='8px Georgia'; c.fillText('Zehlendorf',134,18);
  c.font='bold 10px Georgia'; c.fillText('Eiche',146,27);
  c.font='6px Georgia'; c.fillStyle='#6a543a'; c.fillText('gepflanzt 1711',138,38);
  // Bücherregal links
  c.fillStyle='#3a2a1a'; c.fillRect(28,50,38,42); c.fillStyle='#4a3522'; c.fillRect(30,52,34,38);
  for(let r=0;r<3;r++){ for(let b=0;b<8;b++){ c.fillStyle=['#6a3a2a','#3a5a6a','#5a6a3a','#7a6a3a','#5a3a5a'][(b+r)%5]; c.fillRect(32+b*4,54+r*12,3,9);} c.fillStyle='#2a1c12'; c.fillRect(30,64+r*12,34,2);}
  eicheSolids.push({x:28,y:72,w:38,h:20});
  // Schreibtisch + Kerze
  c.fillStyle='#5c3e27'; c.fillRect(32,98,32,12); c.fillStyle='#6e4a30'; c.fillRect(32,98,32,3);
  c.fillStyle='#e9ddc0'; c.fillRect(36,101,10,7);
  c.fillStyle='#f4d96a'; c.fillRect(58,94,2,5); c.fillStyle='#fff2c0'; c.fillRect(58,92,2,2);
  eicheSolids.push({x:32,y:100,w:32,h:12});
  // Bett rechts (grün)
  c.fillStyle='#5c3e27'; c.fillRect(230,58,54,32); c.fillStyle='#3a6a3a'; c.fillRect(232,62,50,26);
  c.fillStyle='#4a7a4a'; c.fillRect(232,62,50,6); c.fillStyle='#e9ddc0'; c.fillRect(234,60,16,11);
  eicheSolids.push({x:230,y:64,w:54,h:26});
  // grünes Blatt-Banner
  c.fillStyle='#2a5a2a'; c.fillRect(294,38,14,40); c.fillStyle='#3a7a3a'; c.fillRect(296,40,10,30);
  c.fillStyle='#cfe0b0'; c.fillRect(300,50,2,12); c.fillRect(298,54,6,2);
  // Sideboard unten rechts + Pflanzen
  c.fillStyle='#5c3e27'; c.fillRect(228,148,56,16); c.fillStyle='#6e4a30'; c.fillRect(228,148,56,3);
  c.fillStyle='#3c6029'; c.fillRect(236,140,8,8); c.fillRect(264,140,8,8); c.fillStyle='#4f7d39'; c.fillRect(237,138,6,3); c.fillRect(265,138,6,3);
  eicheSolids.push({x:228,y:150,w:56,h:14});
  // Truhe unten links
  c.fillStyle='#5c3e27'; c.fillRect(38,150,22,14); c.fillStyle='#7a5436'; c.fillRect(38,150,22,4); c.fillStyle='#caa23a'; c.fillRect(47,156,4,3);
  eicheSolids.push({x:38,y:150,w:22,h:14});
  // zentraler Tisch + Stumpf-Hocker
  c.fillStyle='#3a2a1a'; c.beginPath(); c.ellipse(160,118,28,18,0,0,7); c.fill();
  c.fillStyle='#6e4a30'; c.beginPath(); c.ellipse(160,114,28,18,0,0,7); c.fill();
  c.fillStyle='#7e5a3a'; c.beginPath(); c.ellipse(160,112,24,15,0,0,7); c.fill();
  c.fillStyle='#8a663f'; c.beginPath(); c.ellipse(160,112,9,5,0,0,7); c.fill();
  c.fillStyle='#3c6029'; c.fillRect(157,107,6,5);
  function stump(sx,sy){ c.fillStyle='#3a2a1a'; c.beginPath(); c.ellipse(sx,sy+2,7,5,0,0,7); c.fill();
    c.fillStyle='#6e4a30'; c.beginPath(); c.ellipse(sx,sy,7,5,0,0,7); c.fill(); c.fillStyle='#8a663f'; c.fillRect(sx-2,sy-1,4,2);}
  stump(128,120); stump(192,120); stump(160,142);
  eicheSolids.push({x:128,y:104,w:64,h:18});
  // Laternen
  function lantern(lx,ly){ c.fillStyle='#1a1410'; c.fillRect(lx,ly-2,5,2); c.fillStyle='#2a2118'; c.fillRect(lx,ly,5,7); c.fillStyle='#ffcf7a'; c.fillRect(lx+1,ly+1,3,4);}
  lantern(96,40); lantern(220,40); lantern(60,82);
  // Ausgang unten (Wurzeltreppe)
  c.fillStyle='#160f0a'; c.fillRect(142,162,36,18); c.fillStyle='#2c2016'; c.fillRect(146,162,28,18);
  for(let i=0;i<3;i++){ c.fillStyle='#3a2a1a'; c.fillRect(144,164+i*5,32,2);}
  c.fillStyle='#cfe0b0'; c.font='6px Georgia'; c.fillText('↓ raus',147,155);
}

function drawSoeren(c,x,y){ x|=0;y|=0;
  drawChar(c,x,y,'down',0,PAL_SOEREN);
  // wilde Haarsträhnen
  c.fillStyle='#241c14'; c.fillRect(x+2,y-1,2,2); c.fillRect(x+12,y-1,2,2); c.fillRect(x+6,y-2,1,2);
  // weit aufgerissene Augen
  c.fillStyle='#f4ecd6'; c.fillRect(x+5,y+4,2,2); c.fillRect(x+9,y+4,2,2);
  c.fillStyle='#1a1410'; c.fillRect(x+5,y+5,1,1); c.fillRect(x+10,y+5,1,1);
}

function enterEiche(){ G.scene='eiche'; player.x=152; player.y=120; player.dir='up'; player.frame=0;
  setBanner('Zehlendorf-Eiche','In der Eiche'); showBanner(); enterCool=0.5; }
function exitEiche(){ G.scene='town'; player.x=eicheReturn.x; player.y=eicheReturn.y; player.dir=eicheReturn.dir; player.frame=0;
  enterCool=0.5; setBanner('Zehlendorf Mitte','Bezirk'); }

function giveLeo(){ hasLeo=true; cat.x=eicheReturn.x-4; cat.y=eicheReturn.y+12; cat.dir='up';
  if(!party.length) party.push(makeGigo('leo',5));
  ketaKapseln=Math.max(ketaKapseln,5); addItem('keta');
  toast('Leo schließt sich dir an — plus 5 Keta Kapseln. Bring Leo unversehrt zurück!',3200); }

function talkSoeren(){
  if(starterChosen){ soerenTeaser(); return; }
  if(caughtRacoon){ openDialog('Sören',[
    {w:'Sören',t:'HEHEHEHAAAA! Habe ich es dir doch gesagt! Es sind die Akhs, Berlin ist doomed, hoch leben die Akhs!'},
    {w:'Don',t:'*schaut leicht bedröppelt* Naja, also dawg… dieser fuck ass Raccoon sieht zwar ziemlich benebelt aus und er ist schon lowkey am smoken, aber das beweist mir ja noch gar nichts!'},
    {w:'Sören',t:'Keine Angst, bald wird es auch dir klarer werden, mein Sohn. Bis dahin — GIB MIR ERSTMAL LEO ZURÜCK, HIHIHIHAAA!'},
    {w:'Sören',t:'Nun, es ist Zeit, dass ich dich von der Vision unterrichte. Einst sah ich den großen Goon im Traume, der mir von Metart und den wunderbaren Milfs berichtete!'},
    {w:'Don',t:'*zieht eine Augenbraue hoch* Bruder… was???'},
    {w:'Sören',t:'… … … Ummm, my bad, das war die falsche Vision.'},
    {w:'Sören',t:'Nochmal, mein Lieberchen: Einst sah ich im Traum den großen Crack Mage! Er tut sein Unheil, in allen Berliner Bezirken zu verbreiten.'},
    {w:'Sören',t:'Erst fing er eine Ratte… dann zwei, dann drei. Mittlerweile reicht seine Verteilung der Akhs bis in die hinterletzten Bezirke dieser Stadt!'},
    {w:'Sören',t:'Noch scheut man sich, das Problem wirklich zu benennen — doch ich kann bei diesem Fall einfach nicht pennen! Nur einer vermag es, Berlin zu retten — und ich rede nicht von dieser einen Fetten!'},
    {w:'Don',t:'… Blud, Ihre Reime müssen schon irgendwie Sinn ergeben. Nur weil Sie reimen wie ein Perkhead, heißt das noch nicht, dass ich Ihre Vision glaubhafter finde!'},
    {w:'Don',t:'Was für ein fucking Crack Mage — sind Sie in der U8 eingepennt und haben schlecht geträumt, oder was soll der Müll? Wie ich sage: PERKS absetzen!'},
    {w:'Sören',t:'MIR RUTSCHT GLEICH DIE HAND AUS! Jetzt komm mit mir, Don!'},
  ], startEicheClimb); return; }
  if(hasLeo){ openDialog('Sören',[{w:'Sören',t:'Worauf wartest du noch, mein Sohn? Hohes Gras, neben dem Rathaus. Und pass mir bloß auf Leo auf — HEHEHA!'}]); return; }
  openDialog('Sören',[
    {w:'Don',t:'Hi, sind Sie Sören? Der OG Hazeler?'},
    {w:'Sören',t:'... (er starrt ins Leere und reagiert nicht)'},
    {w:'Don',t:'Sorry, Herr Sören — können Sie mich hören? Haze schickt mich! Er hat irgendwas von... Tieren erzählt. Ich solle mit Ihnen darüber reden?'},
    {w:'Sören',t:'Hehehehaaaaaa— *lacht manisch* Er hat TIERE gesagt!? Wir reden hier nicht von Tieren, mein Sohn!'},
    {w:'Don',t:'Entschuldigung, Herr Haze, aber ich bin nicht Ihr Sohn. Ich bin Don.'},
    {w:'Sören',t:'Was— wie bist du dann hier reingekommen? ...Ach. Haze hat dich geschickt. Ich vergaß.'},
    {w:'Don',t:'Alles gut, Herr Haze. Vielleicht war das doch keine so gute Idee... *dreht sich um zu gehen*'},
    {w:'Sören',t:'STOP. Don. Du verstehst nicht, woran ich hier arbeite. HEHEHA! Ich untersuche die Akhs in dieser Stadt. Sie bewegen sich im hohen Gras — da, wo der Gärtner nicht schnell genug mäht.'},
    {w:'Sören',t:'In Zehlendorf gibt’s nicht viele solcher Stellen, sonst schicken die Anwohner der Stadtverwaltung Drohbriefe. Aber du hast ja keine Ahnung, was in anderen Bezirken los ist!'},
    {w:'Don',t:'*versteinerte Miene* Dawg... maybe sollten Sie mal Ihre Perkies absetzen. Geht’s Ihnen noch gut? Sie schmeißen die scheinbar wie TicTacs, so wie Sie hier rumkreischen.'},
    {w:'Don',t:'Und was soll im hohen Gras schon los sein — da ist höchstens ’ne entlaufene Katze, dude.'},
    {w:'Sören',t:'*prescht auf dich zu* Ich lass mir GAR nichts über meine Perkies erzählen — die halten mich bei Verstand, HEHEHEHAA!'},
    {w:'Sören',t:'Was weißt du schon über Akhs? Ich sitze seit Monaten hier eingeschlossen in der Zehlendorfer Eiche — und irgendso ein dahergelaufener Jurastudent will mir was über meine Arbeit erzählen. Und die Leute sagen, ICH wär am Trippen.'},
    {w:'Sören',t:'Weißt du was — wenn du dich traust: geh ins hohe Gras neben dem Rathaus Zehlendorf. Der Hausmeister kommt grade nicht zum Mähen. Der Briefkasten der Verwaltung quillt schon über!'},
    {w:'Don',t:'*stark verstört* ...Ähm. Okay, Unc. I guess ich kann’s ja mal probieren.'},
    {w:'Sören',t:'Fast hätt ich’s vergessen. *übergibt dir eine Katze* Das ist Leo — Hazes Katze. Sie gibt mir mentalen Support hier in der Eiche. Und sie steht mir bei, wenn ich auf die Akhs treffe.'},
    {w:'Sören',t:'Nimm ihn mit. Zur Selbstverteidigung. Er steht dir treu zur Seite. Aber bring ihn mir danach zurück — UNVERSEHRT!'},
  ], giveLeo);
}

function renderEiche(){
  X.clearRect(0,0,LW,LH);
  X.drawImage(eicheBG,0,0);
  const ents=[{y:soeren.y+22,d:()=>drawSoeren(X,soeren.x,soeren.y)},{y:player.y+22,d:()=>drawChar(X,player.x|0,player.y|0,player.dir,player.frame,PAL_PLAYER)}];
  ents.sort((a,b)=>a.y-b.y); for(const e of ents) e.d();
  drawLightEiche();
}
function drawLightEiche(){
  Lx.clearRect(0,0,LW,LH);
  Lx.fillStyle='rgba(40,24,10,0.16)'; Lx.fillRect(0,0,LW,LH);
  let v=Lx.createRadialGradient(160,108,40,160,108,185); v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(8,5,2,0.80)');
  Lx.fillStyle=v; Lx.fillRect(0,0,LW,LH);
  Lx.globalCompositeOperation='lighter';
  function glow(gx,gy,r,a){ const rg=Lx.createRadialGradient(gx,gy,0,gx,gy,r); rg.addColorStop(0,'rgba(255,200,120,'+a+')'); rg.addColorStop(1,'rgba(255,200,120,0)'); Lx.fillStyle=rg; Lx.fillRect(gx-r,gy-r,r*2,r*2);}
  const fl=reduce?1:0.85+0.15*Math.sin(T*3);
  glow(98,42,24,0.45*fl); glow(222,42,24,0.45*fl); glow(62,84,20,0.42*fl); glow(59,95,12,0.5*fl);
  Lx.globalCompositeOperation='source-over';
  X.drawImage(lightCv,0,0);
}

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
    wohnungReturn={x:(ddx+dxw/2-8)|0, y:dby+2, dir:'down'};
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
  cafeReturn={x:mx-8,y:y+h+2,dir:'down'};
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
const party = [];            // Spieler-Gigos
const caughtGigos = [];      // gefangene
const dexSeen = new Set(), dexCaught = new Set();
let ketaKapseln = 5;
let questGustav=false; let gotPunisher=false; let loveAura=0; let clubUnlocked=false; let gateWalk=0;   // Blue-Punisher-Quest + Club-Gate
let caughtRacoon = false;    // Soeren-Quest erfuellt

function makeGigo(id, level){
  const b=GIGODEX[id]; const f=(s)=>Math.max(1,Math.round(s*(1+0.10*(level-1))));
  const maxHP=Math.round(b.hp*(1+0.12*(level-1)))+5;
  return { id, name:b.name, level, maxHP, hp:maxHP, atk:f(b.atk), def:f(b.def), spd:f(b.spd),
    catch:b.catch||45, type:b.type, moves:(b.moves||['kratzer']).slice(0,4), xp:0, xpNext:xpToNextLevel(level) };
}
function catchChance(en, bonus){ bonus=bonus||1;
  const hpF=(3*en.maxHP-2*en.hp)/(3*en.maxHP);
  const lvlP=clamp(1-(en.level-1)*0.03,0.3,1);
  return clamp((en.catch/255)*hpF*lvlP*bonus, 0.05, 0.95);
}
function calcDamage(att, def, mv){
  const base=(att.atk*mv.pow)/(def.def+10);
  const rng=0.85+Math.random()*0.3;
  return Math.max(1, Math.round(base*(1+att.level*0.05)*rng));
}
function pickEnemyMove(E){ const dmg=E.moves.filter(m=>MOVES[m].pow>0); const pool=dmg.length?dmg:E.moves; return pool[(Math.random()*pool.length)|0]; }

// ---------- Keta Kapsel Sprites ----------
const KETA={ out:'#6e4f08', body:'#f2c20e', sh:'#cf9a07', hi:'#ffe45e', hi2:'#fff4b0', lip:'#b9870a', red:'#e23b2e', inside:'#5e4708', insideD:'#3f2f04' };
function ketaLetterK(c,x,y,col){ const rows=['X..X','X.X.','XX..','XX..','X.X.','X..X']; for(let r=0;r<6;r++) for(let i=0;i<4;i++) if(rows[r][i]==='X') px(c,x+i,y+r,1,1,col); }
function ketaClosed(c,ox,oy){ const x=(v)=>ox+v, y=(v)=>oy+v;
  px(c,x(3),y(0),6,1,KETA.out); px(c,x(2),y(1),8,1,KETA.out); px(c,x(1),y(2),10,16,KETA.out); px(c,x(2),y(18),8,1,KETA.out);
  px(c,x(4),y(0),4,1,KETA.body); px(c,x(3),y(1),6,1,KETA.body); px(c,x(2),y(2),8,4,KETA.body); px(c,x(3),y(1),2,1,KETA.hi2); px(c,x(2),y(2),2,2,KETA.hi);
  px(c,x(2),y(6),8,1,KETA.lip); px(c,x(2),y(7),8,1,KETA.sh); px(c,x(2),y(8),8,9,KETA.body); px(c,x(2),y(8),2,8,KETA.hi); px(c,x(8),y(8),2,9,KETA.sh); px(c,x(2),y(16),8,1,KETA.sh);
  ketaLetterK(c, x(4), y(9), KETA.red); }
function ketaOpen(c,ox,oy){ const x=(v)=>ox+v, y=(v)=>oy+v;
  px(c,x(1),y(6),10,12,KETA.out); px(c,x(2),y(18),8,1,KETA.out); px(c,x(2),y(6),8,2,KETA.lip); px(c,x(3),y(5),6,1,KETA.sh);
  px(c,x(3),y(7),6,2,KETA.insideD); px(c,x(4),y(7),4,1,KETA.inside); px(c,x(2),y(9),8,8,KETA.body); px(c,x(2),y(9),2,7,KETA.hi); px(c,x(8),y(9),2,8,KETA.sh); px(c,x(2),y(16),8,1,KETA.sh);
  ketaLetterK(c, x(4), y(10), KETA.red);
  const cx=ox+7, cy=oy-6; px(c,cx+1,cy,5,1,KETA.out); px(c,cx,cy+1,7,5,KETA.out); px(c,cx+1,cy+1,5,4,KETA.body); px(c,cx+1,cy+1,2,2,KETA.hi2); px(c,cx+1,cy+5,5,1,KETA.lip); }
function kapselAt(c,cx,cy,scale,rot,open){ c.save(); c.translate(cx,cy); if(rot)c.rotate(rot); c.scale(scale,scale); c.translate(-6,-9); if(open>0) ketaOpen(c,0,0); else ketaClosed(c,0,0); c.restore(); }
// Inventar-Icon (24x50)
function drawKeta(c){
  c.fillStyle='rgba(20,18,10,.22)'; c.fillRect(5,45,14,3);
  c.fillStyle=KETA.out; c.fillRect(8,2,8,1); c.fillRect(6,3,12,2); c.fillRect(5,5,14,40); c.fillRect(6,45,12,1);
  c.fillStyle=KETA.body; c.fillRect(8,3,8,2); c.fillRect(6,5,12,8);
  c.fillStyle=KETA.hi2; c.fillRect(8,4,3,1); c.fillStyle=KETA.hi; c.fillRect(6,6,3,5);
  c.fillStyle=KETA.lip; c.fillRect(6,13,12,2); c.fillStyle=KETA.sh; c.fillRect(6,15,12,1);
  c.fillStyle=KETA.body; c.fillRect(6,16,12,28);
  c.fillStyle=KETA.hi; c.fillRect(6,16,3,26); c.fillStyle=KETA.sh; c.fillRect(15,16,3,28); c.fillRect(6,43,12,1);
  c.fillStyle=KETA.red; c.fillRect(8,22,2,16);
  c.fillRect(14,22,2,2); c.fillRect(13,24,2,2); c.fillRect(12,26,2,2); c.fillRect(10,28,3,2);
  c.fillRect(10,30,3,2); c.fillRect(12,32,2,2); c.fillRect(13,34,2,2); c.fillRect(14,36,2,2);
}

/* ======================================================================
   LEVEL · XP · EVOLUTION · SWITCH  (data-driven)
   ====================================================================== */
// --- levelScaling ---
function xpToNextLevel(level){ return Math.floor(20*Math.pow(level,1.65)); }
function relevelStats(m){ const b=GIGODEX[m.id]; const f=(s)=>Math.max(1,Math.round(s*(1+0.10*(m.level-1))));
  const oldMax=m.maxHP; const newMax=Math.round(b.hp*(1+0.12*(m.level-1)))+5;
  m.maxHP=newMax; m.hp=Math.min(newMax, Math.max(1,m.hp)+(newMax-oldMax)); m.atk=f(b.atk); m.def=f(b.def); m.spd=f(b.spd); }

// --- xpSystem ---
const RARITY_MULT={ common:1.0, uncommon:1.3, rare:1.7, legendary:2.5 };
const BATTLE_MULT={ wild:1.0, trainer:1.4, boss:2.0 };
function calcXP(enemyLevel, rarity, battleType, killerLevel){
  let xp=Math.floor((enemyLevel*12) * (RARITY_MULT[rarity]||1.0) * (BATTLE_MULT[battleType]||1.0));
  const diff=killerLevel-enemyLevel;                       // Low-Level-Farming-Schutz
  if(diff>=20) xp=Math.floor(xp*0.1);
  else if(diff>=10) xp=Math.floor(xp*0.35);
  else if(diff>=5) xp=Math.floor(xp*0.65);
  return Math.max(1,xp);
}
// nur der Killer bekommt XP, kein Shared XP
function grantBattleXP(){
  const killer=battle.player, E=battle.enemy;
  if(killer.xp==null){ killer.xp=0; killer.xpNext=xpToNextLevel(killer.level); }
  const rarity=(GIGODEX[E.id]&&GIGODEX[E.id].rarity)||'common';
  const gained=calcXP(E.level, rarity, battle.type||'wild', killer.level);
  killer.xp+=gained;
  const ups=[];
  while(killer.level<LEVEL_CAP && killer.xp>=killer.xpNext){ killer.xp-=killer.xpNext; killer.level++; relevelStats(killer); killer.xpNext=xpToNextLevel(killer.level); ups.push(killer.level); }
  if(killer.level>=LEVEL_CAP) killer.xp=0;
  battle.queue.push({text:killer.name+' erhaelt '+gained+' XP!'});
  for(const lv of ups) battle.queue.push({text:killer.name+' ist jetzt Level '+lv+'!'});
  const evo=readyEvolution(killer);
  if(evo){ battle.pendingEvo={mon:killer, to:evo}; }
  battle.queue.push({ text:E.name+' verzieht sich.', then:()=>{ battle.over=true; battle.win='win'; } });
}

// --- evolutionSystem (data-driven: GIGODEX[id].evo = {type,requirement,evolvesTo}) ---
function readyEvolution(m){ const cfg=GIGODEX[m.id]&&GIGODEX[m.id].evo; if(!cfg) return null;
  if(cfg.type==='level' && m.level>=cfg.requirement) return cfg.evolvesTo;
  if(cfg.type==='item' && typeof hasEvoItem==='function' && hasEvoItem(cfg.requirement)) return cfg.evolvesTo;
  return null; }
function applyEvolution(m, toId){ const nb=GIGODEX[toId];
  m.id=toId; m.name=nb.name; m.type=nb.type; if(nb.catch) m.catch=nb.catch;
  relevelStats(m); m.hp=m.maxHP; if(nb.moves) m.moves=nb.moves.slice(0,4);
  dexSeen.add(toId); dexCaught.add(toId); }
let evolveState=null;
function easeOutBack(x){ const c1=1.70158, c3=c1+1; return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2); }
function startEvolution(mon, toId){ evolveState={ mon, from:mon.id, to:toId, t:0, tt:0, phase:'popup', spk:null }; G.state='evolve'; }
function seedSparkles(e){ e.spk=[]; const cols=['#fff7c8','#ffe07a','#bfe8ff','#ffffff','#ffd24a'];
  for(let i=0;i<30;i++) e.spk.push({ ang:Math.random()*6.2832, spd:45+Math.random()*120, size:1+((Math.random()*2)|0), col:cols[i%cols.length], t0:Math.random()*0.12 }); }
function advanceEvo(){ const e=evolveState; if(e&&e.phase==='popup'){ e.phase='charge'; e.t=0; } }
function updateEvolve(dt){ const e=evolveState; if(!e) return; e.t+=dt; e.tt+=dt;
  if(e.phase==='popup'){ if(e.t>=3.8) advanceEvo(); }
  else if(e.phase==='charge'){ if(e.t>=3.6){ applyEvolution(e.mon,e.to); seedSparkles(e); e.phase='burst'; e.t=0; } }
  else if(e.phase==='burst'){ if(e.t>=0.7){ e.phase='reveal'; e.t=0; } }
  else if(e.phase==='reveal'){ if(e.t>=1.9){ e.phase='wait'; e.t=0; } }
}
function evolveKey(k){ const e=evolveState; if(!e) return; if(!(k==='e'||k===' '||k==='enter')) return;
  if(e.phase==='popup'){ advanceEvo(); }
  else if(e.phase==='wait'){ evolveState=null; G.state='play'; if(pendingCatch) openCatchChoice(); }
}
function drawEvoMon(id, cx, bottomY, scale, white, alpha){ const g=GIGODEX[id]; if(!g||!g.draw) return;
  X.save(); if(alpha!=null) X.globalAlpha=clamp(alpha,0,1); X.translate(cx|0,bottomY|0); X.scale(scale,scale);
  if(white) GIGO_TINT.white=true; try{ g.draw(X,-24,-46,evolveState.t); }catch(_){}; GIGO_TINT.white=false; X.restore(); X.globalAlpha=1; }
function drawEvoSparkles(e, cx, midY){ if(!e.spk) return;
  for(const s of e.spk){ const tt=Math.max(0,e.t-s.t0); const d=s.spd*tt; const a=clamp(1-tt/1.5,0,1); if(a<=0) continue;
    const x=(cx+Math.cos(s.ang)*d)|0, y=(midY+Math.sin(s.ang)*d*0.85)|0; X.globalAlpha=a; X.fillStyle=s.col; X.fillRect(x,y,s.size,s.size);
    if(s.size>1){ X.fillStyle='#ffffff'; X.fillRect(x,y,1,1); } } X.globalAlpha=1; }
function renderEvolve(){ const e=evolveState; if(!e) return; const cx=LW/2;
  const reveal=(e.phase==='reveal'||e.phase==='wait');
  const bg=X.createLinearGradient(0,0,0,LH);
  if(reveal){ bg.addColorStop(0,'#3a2c58'); bg.addColorStop(1,'#130e22'); } else { bg.addColorStop(0,'#141026'); bg.addColorStop(1,'#07060f'); }
  X.fillStyle=bg; X.fillRect(0,0,LW,LH);
  for(let i=0;i<54;i++){ const sx=(i*89+((e.tt*8)|0))%LW, sy=(i*47)%LH; const tw=0.35+0.55*Math.abs(Math.sin(e.tt*2+i)); X.fillStyle='rgba(200,205,255,'+tw*0.5+')'; X.fillRect(sx,sy,1,1); }

  const spBottom=(e.phase==='popup')?58:100, spScale=(e.phase==='popup')?1.35:2.25, midY=spBottom-50;

  if(e.phase==='popup'){
    drawEvoMon(e.from, cx, spBottom+Math.sin(e.t*3)*2, spScale, false, 1);
    const sc=easeOutBack(clamp(e.t/0.5,0,1)); const cw=236, chh=62, ccy=122;
    X.save(); X.translate(cx,ccy); X.scale(sc,sc); X.translate(-cw/2,-chh/2);
    px(X,-3,4,cw+6,chh,'rgba(0,0,0,0.5)');
    px(X,0,0,cw,chh,'#20140a'); px(X,2,2,cw-4,chh-4,'#3a2a16'); px(X,4,4,cw-8,chh-8,'#4a3722'); px(X,2,2,cw-4,1,'#7a5a34');
    for(const q of [[4,4],[cw-8,4],[4,chh-8],[cw-8,chh-8]]) px(X,q[0],q[1],4,4,'#d8b24a');
    X.fillStyle='#f3ecd8'; X.font='12px Georgia'; X.textAlign='center'; X.textBaseline='top';
    wrapCenter('Huh, dein Akh scheint sich zu entwickeln. What the helly dude?', cw/2, 11, cw-26, 15);
    X.restore();
    if(e.t>0.6){ X.globalAlpha=0.6+0.4*Math.sin(e.tt*6); X.fillStyle='#d8b24a'; X.font='9px Georgia'; X.textAlign='center'; X.textBaseline='top'; X.fillText('E / tippen', cx, ccy+chh/2+7); X.globalAlpha=1; }
    X.textAlign='left'; return;
  }

  if(e.phase==='charge'){
    const p=clamp(e.t/3.6,0,1);
    const vg=X.createRadialGradient(cx,midY,8,cx,midY,155); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,'+(0.3+0.5*p)+')'); X.fillStyle=vg; X.fillRect(0,0,LW,LH);
    for(let i=0;i<5;i++){ let rr=92-((e.t*72+i*20)%92); const a=(rr/92)*0.6; X.strokeStyle='rgba(150,210,255,'+a+')'; X.lineWidth=1; X.beginPath(); X.ellipse(cx,midY,rr,rr*0.82,0,0,6.2832); X.stroke(); }
    const n=30; for(let i=0;i<n;i++){ const ang=i/n*6.2832+e.t*0.7; const cyc=((e.t*1.4)+(i*0.137))%1; const r=6+(1-cyc)*86; const b=clamp(1.2-cyc,0,1);
      X.fillStyle=(i%2?'rgba(190,235,255,':'rgba(255,245,200,')+b+')'; const s=cyc>0.72?2:1; X.fillRect((cx+Math.cos(ang)*r)|0,(midY+Math.sin(ang)*r*0.82)|0,s,s); }
    const fq=3+p*p*17; const id=(Math.floor(e.t*fq)%2===1)?e.to:e.from; const shk=0.6+p*2.6;
    drawEvoMon(id, cx+Math.sin(e.t*55)*shk, spBottom+Math.cos(e.t*47)*shk*0.5, spScale, true, 0.85+0.15*Math.sin(e.t*fq));
    const fl=(0.05+0.4*Math.abs(Math.sin(e.t*fq*3.14159)))*(0.3+0.7*p); X.fillStyle='rgba(255,255,255,'+fl+')'; X.fillRect(0,0,LW,LH);
    return;
  }

  if(e.phase==='burst'){
    const k=clamp(e.t/0.7,0,1);
    X.save(); X.translate(cx,midY); X.fillStyle='rgba(255,250,220,'+(1-k)*0.85+')';
    for(let i=0;i<16;i++){ X.save(); X.rotate(i/16*6.2832+e.t*2); X.fillRect(0,-3,10+k*185,6); X.restore(); } X.restore();
    X.strokeStyle='rgba(255,255,255,'+(1-k)+')'; X.lineWidth=Math.max(1,3-2*k); X.beginPath(); X.ellipse(cx,midY,k*175,k*150,0,0,6.2832); X.stroke();
    X.fillStyle='rgba(255,255,255,'+(1-k)+')'; X.fillRect(0,0,LW,LH);
    return;
  }

  // reveal + wait
  const rk=(e.phase==='reveal')?clamp(e.t/1.9,0,1):1;
  X.save(); X.translate(cx,midY);
  for(let i=0;i<14;i++){ X.save(); X.rotate(i/14*6.2832+e.tt*0.5); X.fillStyle=(i%2?'rgba(255,224,120,0.13)':'rgba(255,245,200,0.08)'); X.beginPath(); X.moveTo(0,0); X.lineTo(210,-14); X.lineTo(210,14); X.closePath(); X.fill(); X.restore(); } X.restore();
  const gl=X.createRadialGradient(cx,midY,4,cx,midY,92); gl.addColorStop(0,'rgba(255,240,180,'+(0.5*rk)+')'); gl.addColorStop(1,'rgba(255,240,180,0)'); X.fillStyle=gl; X.fillRect(0,0,LW,LH);
  const bounce=(e.phase==='reveal')?Math.sin(clamp(e.t/0.5,0,1)*3.14159)*-8:Math.sin(e.tt*2)*2;
  const pop=(e.phase==='reveal')?(1+Math.sin(clamp(e.t/0.4,0,1)*3.14159)*0.12):1;
  drawEvoMon(e.to, cx, spBottom+bounce, spScale*pop, false, rk);
  drawEvoSparkles(e, cx, midY);
  if(e.phase==='reveal' && e.t<0.4){ X.fillStyle='rgba(255,255,255,'+(1-e.t/0.4)+')'; X.fillRect(0,0,LW,LH); }
  const by=LH-30; X.fillStyle='#ffe9a8'; X.font='bold 13px Georgia'; X.textAlign='center'; X.textBaseline='top';
  X.fillText(GIGODEX[e.from].name+'  \u2192  '+GIGODEX[e.to].name+'!', cx, by-4);
  if(e.phase==='wait'){ X.globalAlpha=0.6+0.4*Math.sin(e.tt*6); X.fillStyle='#d8b24a'; X.font='9px Georgia'; X.fillText('E / tippen', cx, by+11); X.globalAlpha=1; }
  X.textAlign='left';
}

// --- battleSwitchSystem ---
function openPartyMenu(forced){ battle.phase='party'; battle.forceSwitch=!!forced; battle.partyIndex=0;
  for(let i=0;i<party.length;i++){ if(party[i]!==battle.player && party[i].hp>0){ battle.partyIndex=i; break; } } }
function doSwitch(idx){ const next=party[idx];
  if(next===battle.player){ toast('Ist schon im Kampf.',1100); return; }
  if(next.hp<=0){ toast(next.name+' ist k.o.!',1100); return; }
  const old=battle.player, forced=battle.forceSwitch;
  battle.player=next; battle.hpP=next.hp; battle.moveIndex=0; battle.forceSwitch=false;
  battle.phase='msg';
  battle.queue=[{text:old.name+' geht zurueck in die Keta Kapsel!'},{text:'DU BIST DRAN, '+next.name.toUpperCase()+'!'}];
  if(!forced){ battle.pending=()=>{ const E=battle.enemy; if(E.hp>0&&next.hp>0) buildMove(E,next,pickEnemyMove(E),'e'); }; }
}
function handleFaint(){ if(party.some(m=>m.hp>0)) battle.forcedFaint=true; else { battle.over=true; battle.win='lose'; } }

// ---------- Battle State ----------
let battle=null;
const EN_CX=236, EN_CY=74, PL_CX=72, PL_CY=130, CAP_X=236, CAP_Y=84;
function startBattle(enemyId, level, ret, type){
  const active=party.find(m=>m.hp>0);
  if(!active){ toast('Dein Team ist k.o. — heil dich bei Efes!',2400); return false; }
  const enemy=makeGigo(enemyId, level); dexSeen.add(enemyId);
  battle={ enemy, player:active, type:type||'wild', phase:'msg', menuIndex:0, moveIndex:0, partyIndex:0, forceSwitch:false, forcedFaint:false, pendingEvo:null,
    queue:[{text:'Ein wildes '+enemy.name+' taucht auf!'}], pending:null,
    ret:ret||G.scene, over:false, win:null,
    hpE:enemy.hp, hpP:active.hp,
    flashE:0, flashP:0, shakeE:0, shakeP:0, lungeP:0, lungeE:0, hitFx:null,
    cap:null, t:0 };
  G.scene='battle'; G.state='battle'; grassFlash=0;
  return true;
}
function buildMove(att, def, mvId, side){
  const mv=MOVES[mvId]; const isP=(side==='p'); const tf=(isP?'E':'P');
  battle.queue.push({text:att.name+' setzt '+mv.name+' ein!', then:()=>{ battle['lunge'+(isP?'P':'E')]=1; }});
  if(Math.random()>mv.acc){ battle.queue.push({text:'Daneben!'}); return; }
  if(mv.pow>0){
    battle.queue.push({ text:mv.desc, then:()=>{
      let dmg=calcDamage(att,def,mv); if(isP && loveAura>0) dmg=Math.round(dmg*1.8); def.hp=Math.max(0,def.hp-dmg); battle._dmg=dmg;
      battle['flash'+tf]=0.35; battle['shake'+tf]=0.4; battle['lunge'+(isP?'P':'E')]=1;
      battle.hitFx={ x:(isP?EN_CX:PL_CX), y:(isP?EN_CY:PL_CY), t:0.45, tt:0.45 };
    }});
    battle.queue.push({ text:()=>def.name+' nimmt '+battle._dmg+' Schaden!', then:()=>{
      if(def.hp<=0){ if(isP){ battle.queue.push({ text:def.name+' wurde besiegt!', then:()=>{ grantBattleXP(); } }); }
        else { battle.queue.push({ text:def.name+' ist k.o.!', then:()=>{ handleFaint(); } }); } }
    }});
  } else if(mv.eff==='atkdown'){
    battle.queue.push({ text:mv.desc, then:()=>{ def.atk=Math.max(1,Math.round(def.atk*0.8)); }});
    battle.queue.push({ text:def.name+' ist eingeschuechtert. Angriff sinkt!' });
  } else { battle.queue.push({ text:mv.desc }); }
}
function startMoveTurn(mvId){
  battle.phase='msg'; battle.queue=[]; const P=battle.player, E=battle.enemy; const eMv=pickEnemyMove(E);
  if(P.spd>=E.spd){ buildMove(P,E,mvId,'p'); battle.pending=()=>{ if(E.hp>0&&P.hp>0&&!battle.over) buildMove(E,P,eMv,'e'); }; }
  else { buildMove(E,P,eMv,'e'); battle.pending=()=>{ if(P.hp>0&&E.hp>0&&!battle.over) buildMove(P,E,mvId,'p'); }; }
}
function startCatch(){
  const E=battle.enemy;
  if(ketaKapseln<=0){ battle.phase='msg'; battle.queue=[{text:'Keine Keta Kapseln mehr.'}]; battle.pending=null; return; }
  ketaKapseln--;
  const p=catchChance(E); const success=Math.random()<p;
  const shakes = success?3 : (Math.random()<p?2:(Math.random()<p?1:0));
  battle.phase='anim';
  battle.cap={ st:'throw', t:0, success, shakes, wi:0, beam:0, escale:1, hidden:false, capOpen:0, rot:0,
    x:PL_CX, y:PL_CY-10, bounce:0, msg:'Du wirfst eine Keta Kapsel!' };
}
function stepCatch(dt){
  const C=battle.cap; C.t+=dt;
  if(C.st==='throw'){
    const d=0.45, k=clamp(C.t/d,0,1);
    C.x=PL_CX+(CAP_X-PL_CX)*k; C.y=(PL_CY-10)+(CAP_Y-(PL_CY-10))*k - Math.sin(k*Math.PI)*44; C.rot=C.t*15;
    if(C.t>=d){ C.st='suck'; C.t=0; C.x=CAP_X; C.y=CAP_Y; C.capOpen=1; C.beam=1; C.rot=0; C.msg='...'; }
  } else if(C.st==='suck'){
    const d=0.4, k=clamp(C.t/d,0,1); C.escale=1-k; C.beam=1-k*0.3;
    if(C.t>=d){ C.st='settle'; C.t=0; C.escale=0; C.hidden=true; C.capOpen=0; C.beam=0; }
  } else if(C.st==='settle'){
    const d=0.24, k=clamp(C.t/d,0,1); C.bounce=Math.sin(k*Math.PI)*8;
    if(C.t>=d){ C.st='wobble'; C.t=0; C.wi=0; C.bounce=0; }
  } else if(C.st==='wobble'){
    const wob=0.55, k=(C.t%wob)/wob; C.rot=Math.sin(k*Math.PI)*(C.wi%2?-0.42:0.42); C.msg='... *wackel* ...';
    if(C.t>=wob){ C.t-=wob; C.wi++;
      if(C.success){ if(C.wi>=3){ C.st='caught'; C.t=0; C.rot=0; } }
      else { if(C.wi>=C.shakes){ C.st='break'; C.t=0; C.rot=0; } }
    }
  } else if(C.st==='caught'){ C.msg='Klack!'; if(C.t>=0.55) finishCatch(true); }
  else if(C.st==='break'){ const d=0.35,k=clamp(C.t/d,0,1); C.capOpen=1; C.escale=k; C.hidden=false; if(C.t>=d) finishCatch(false); }
}
function finishCatch(success){
  const E=battle.enemy; battle.cap=null; battle.phase='msg';
  if(success){ battle.caught=true; battle.klack=0.4; battle.queue=[{text:E.name+' wurde gefangen!', then:()=>{ onCaught(E); battle.over=true; battle.win='catch'; }}]; }
  else { battle.queue=[{text:E.name+' bricht aus der Kapsel aus!'}]; battle.pending=()=>{ if(E.hp>0&&battle.player.hp>0) buildMove(E,battle.player,pickEnemyMove(E),'e'); }; }
}
function startFlee(){
  battle.phase='msg'; battle.queue=[]; const P=battle.player,E=battle.enemy;
  battle.queue.push({text:'Du nimmst die Beine in die Hand...'});
  if(P.spd>=E.spd || Math.random()<0.7){ battle.queue.push({text:'Entkommen!', then:()=>{ battle.over=true; battle.win='flee'; }}); }
  else { battle.queue.push({text:'Kein Entkommen!'}); battle.pending=()=>buildMove(E,P,pickEnemyMove(E),'e'); }
}
function onCaught(E){ dexCaught.add(E.id); caughtGigos.push(E);
  if(E.id==='racoon') caughtRacoon=true;
  if(party.length<3){ party.push(E); toast('🧪 '+E.name+' ist jetzt in deinem Team!',2600); }
  else { pendingCatch=E; toast('🧪 '+E.name+' gefangen! Dein Team ist voll…',2400); }
}
function endBattle(){
  const ret=battle.ret, win=battle.win, p=battle.player, evo=battle.pendingEvo;
  if(win==='lose'){ p.hp=Math.max(1,Math.round(p.maxHP*0.25)); toast('Dein Team ist erschoepft. Heil dich bei Efes!',2800); }
  G.scene=ret; G.state='play'; battle=null; encCool=1.5; lastTile=-1; clastTile=-1;
  if(evo){ startEvolution(evo.mon, evo.to); return; }
  if(pendingCatch){ openCatchChoice(); }
}
function battleAdvance(){
  const step=battle.queue[0]; if(step&&step.then) step.then(); battle.queue.shift();
  if(battle.queue.length>0) return;
  if(battle.over){ battle.pending=null; endBattle(); return; }
  if(battle.pending){ const fn=battle.pending; battle.pending=null; battle.phase='msg'; fn();
    if(battle.queue.length===0){ if(battle.over) endBattle(); else if(battle.forcedFaint){ battle.forcedFaint=false; openPartyMenu(true); } else battle.phase='menu'; } return; }
  if(battle.forcedFaint){ battle.forcedFaint=false; openPartyMenu(true); return; }
  battle.phase='menu';
}
function selectMenu(i){ if(i===0){ battle.phase='moves'; battle.moveIndex=0; } else if(i===1){ openPartyMenu(false); } else if(i===2){ startCatch(); } else { startFlee(); } }
function battleKey(k){
  if(!battle) return;
  if(battle.phase==='anim') return;
  if(battle.phase==='msg'){ if(k==='e'||k===' '||k==='enter') battleAdvance(); return; }
  if(battle.phase==='menu'){
    if(['arrowdown','s','arrowright','d'].includes(k)) battle.menuIndex=(battle.menuIndex+1)%4;
    else if(['arrowup','w','arrowleft','a'].includes(k)) battle.menuIndex=(battle.menuIndex+3)%4;
    else if(k==='e'||k===' '||k==='enter') selectMenu(battle.menuIndex);
    return;
  }
  if(battle.phase==='party'){
    const n=party.length;
    if(['arrowdown','s'].includes(k)) battle.partyIndex=(battle.partyIndex+1)%n;
    else if(['arrowup','w'].includes(k)) battle.partyIndex=(battle.partyIndex+n-1)%n;
    else if(k==='e'||k===' '||k==='enter') doSwitch(battle.partyIndex);
    else if((k==='q'||k==='backspace') && !battle.forceSwitch) battle.phase='menu';
    return;
  }
  if(battle.phase==='moves'){
    const ms=battle.player.moves;
    if(k==='arrowdown'||k==='s') battle.moveIndex=(battle.moveIndex+1)%ms.length;
    else if(k==='arrowup'||k==='w') battle.moveIndex=(battle.moveIndex+ms.length-1)%ms.length;
    else if(k==='e'||k===' '||k==='enter') startMoveTurn(ms[battle.moveIndex]);
    else if(k==='q'||k==='i'||k==='backspace') battle.phase='menu';
    return;
  }
}

// ---------- Battle Render ----------
function battleBG(){
  const g=X.createLinearGradient(0,0,0,LH); g.addColorStop(0,'#bfe0e8'); g.addColorStop(0.5,'#d3e6d6'); g.addColorStop(0.62,'#bcd29a'); g.addColorStop(1,'#9bb878');
  X.fillStyle=g; X.fillRect(0,0,LW,LH);
  X.fillStyle='#a9c47e'; for(let i=0;i<15;i++){ X.beginPath(); X.ellipse(i*24+8,92,16,11,0,0,7); X.fill(); }
  X.fillStyle='#94b06e'; X.fillRect(0,98,LW,LH-98);
  X.fillStyle='#88a564'; for(let i=0;i<40;i++){ const gx=(i*53)%LW; X.fillRect(gx,104+(i%3)*5,1,3); }
  X.fillStyle='rgba(60,90,40,.32)'; X.beginPath(); X.ellipse(238,98,60,13,0,0,7); X.fill(); X.beginPath(); X.ellipse(70,150,68,15,0,0,7); X.fill();
  X.fillStyle='#7fa257'; X.beginPath(); X.ellipse(238,96,58,11,0,0,7); X.fill(); X.beginPath(); X.ellipse(70,148,66,13,0,0,7); X.fill();
  X.fillStyle='#8fb266'; X.beginPath(); X.ellipse(238,94,54,8,0,0,7); X.fill(); X.beginPath(); X.ellipse(70,146,62,10,0,0,7); X.fill();
}
function drawEnemySprite(ex,ey,scale){
  const eb=GIGODEX[battle.enemy.id]; X.save();
  if(scale!=null && scale!==1){ X.translate(EN_CX,EN_CY); X.scale(scale,scale); X.translate(-EN_CX,-EN_CY); }
  if(eb.draw) eb.draw(X,ex,ey,battle.t); else drawGigoStub(X,ex,ey,battle.t);
  X.restore();
}
function drawHitSpark(fx){
  const a=clamp(fx.t/fx.tt,0,1); const R=6+(1-a)*10;
  X.save(); X.globalAlpha=a;
  X.fillStyle='#fff7c8'; for(let i=0;i<8;i++){ const ang=i/8*Math.PI*2; X.fillRect((fx.x+Math.cos(ang)*R)|0,(fx.y+Math.sin(ang)*R)|0,2,2); }
  X.fillStyle='#ffffff'; X.fillRect(fx.x-2,fx.y-2,4,4);
  X.restore();
}
function renderBattle(){
  if(!battle) return; const b=battle; b.t+=0.016; const C=b.cap;
  battleBG();
  // enemy
  let drawE=true, escale=1;
  if(C){ if(C.st==='suck'||C.st==='break'){ escale=C.escale; } else if(C.hidden){ drawE=false; } }
  else if(b.caught){ drawE=false; }
  if(drawE){
    let ex=212, ey=48;
    if(!C){ if(b.shakeE>0){ ex+=Math.random()*4-2; } ex+=b.lungeE*-12; ey+=b.lungeE*7; }
    drawEnemySprite(ex,ey,escale);
    if(!C && b.flashE>0){ X.fillStyle='rgba(255,255,255,'+b.flashE+')'; X.fillRect(ex+8,ey,40,48); }
  }
  // player fighter
  let lx=52, ly=112; if(b.shakeP>0){ lx+=Math.random()*4-2; } lx+=b.lungeP*16; ly+=b.lungeP*-9;
  const pb=GIGODEX[b.player.id];
  if(pb&&pb.drawBack) pb.drawBack(X,lx,ly);
  else if(pb&&pb.draw){ X.save(); X.translate(lx+18,ly+16); X.scale(0.95,0.95); X.translate(-24,-20); pb.draw(X,0,0,b.t); X.restore(); }
  else drawLeoBack(X,lx,ly);
  if(b.flashP>0){ X.fillStyle='rgba(255,110,110,'+b.flashP+')'; X.fillRect(lx+4,ly,36,34); }
  // hit spark
  if(b.hitFx) drawHitSpark(b.hitFx);
  // capsule + beam
  if(C){
    if(C.beam>0){ X.fillStyle='rgba(255,232,130,'+(0.5*C.beam)+')'; X.beginPath(); X.moveTo(CAP_X,CAP_Y+2); X.lineTo(CAP_X-18,EN_CY-16); X.lineTo(CAP_X+18,EN_CY-16); X.closePath(); X.fill(); }
    kapselAt(X, C.x, C.y-(C.bounce||0), 1.7, C.rot, C.capOpen);
    if(C.st==='caught'){ X.fillStyle='#fff4b0'; for(let i=0;i<5;i++){ const ang=i/5*Math.PI*2+b.t*3; X.fillRect((C.x+Math.cos(ang)*12)|0,(C.y-6+Math.sin(ang)*12)|0,2,2);} }
  }
  // gefangen: nur noch die geschlossene Kapsel (Sprite ist drin), mit Klack
  if(!C && b.caught){
    const kl=b.klack||0; const pop=kl>0? Math.sin(clamp((0.4-kl)/0.4,0,1)*Math.PI)*0.14 : 0;
    const ny=CAP_Y - (kl>0? Math.round(kl*5):0);
    kapselAt(X, CAP_X, ny, 1.7+pop, 0, 0);
    if(kl>0.12){ X.fillStyle='#fff4b0'; for(let i=0;i<4;i++){ const ang=i/4*Math.PI*2+b.t*5; X.fillRect((CAP_X+Math.cos(ang)*11)|0,(CAP_Y-4+Math.sin(ang)*11)|0,2,2);} }
  }
  // HP boxes
  drawHPBoxB(12,14,b.enemy,b.hpE,false);
  drawHPBoxB(LW-152,86,b.player,b.hpP,true);
  drawBattleBox();
}
function drawHPBoxB(bx, by, g, dispHP, showNums){
  const w=140, h=showNums?50:30;
  px(X,bx-1,by-1,w+2,h+2,'#15110c'); px(X,bx,by,w,h,'#2c2820'); px(X,bx+1,by+1,w-2,h-2,'#3d382e'); px(X,bx,by,w,1,'#5d5644');
  X.textBaseline='top'; X.fillStyle='#f3ecd8'; let fs2=11; X.font='bold '+fs2+'px Georgia';
  while(X.measureText(g.name).width>w-40 && fs2>8){ fs2--; X.font='bold '+fs2+'px Georgia'; }
  X.fillText(g.name, bx+8, by+5+(11-fs2));
  X.fillStyle='#cdbfa6'; X.font='9px Georgia'; X.textAlign='right'; X.fillText('Lv'+g.level, bx+w-8, by+6); X.textAlign='left';
  X.fillStyle='#9a9a6a'; X.font='bold 8px Georgia'; X.fillText('HP', bx+8, by+(showNums?20:19));
  const barX=bx+26, barY=by+(showNums?20:19), barW=w-34, barH=5;
  px(X,barX-1,barY-1,barW+2,barH+2,'#15110c'); px(X,barX,barY,barW,barH,'#46443c');
  const frac=Math.max(0,dispHP/g.maxHP); const col= frac>0.5?'#62c64c':frac>0.22?'#e6b93c':'#dc4636';
  px(X,barX,barY,Math.round(barW*frac),barH,col); px(X,barX,barY,Math.round(barW*frac),1,'rgba(255,255,255,.3)');
  if(showNums){ X.fillStyle='#f3ecd8'; X.font='9px Georgia'; X.textAlign='right'; X.fillText(Math.ceil(dispHP)+' / '+g.maxHP, bx+w-8, by+27); X.textAlign='left'; }
  if(showNums){ const xn=g.xpNext||xpToNextLevel(g.level), xc=g.xp||0, maxed=g.level>=LEVEL_CAP;
    X.fillStyle='#8fa0d8'; X.font='bold 8px Georgia'; X.textAlign='left'; X.fillText('XP', bx+8, by+34);
    const xbX=bx+26, xbY=by+34, xbW=w-34, xbH=4; px(X,xbX-1,xbY-1,xbW+2,xbH+2,'#15110c'); px(X,xbX,xbY,xbW,xbH,'#2b3350');
    const xf=maxed?1:clamp(xc/xn,0,1); px(X,xbX,xbY,Math.round(xbW*xf),xbH,'#6d8fe0'); px(X,xbX,xbY,Math.round(xbW*xf),1,'rgba(255,255,255,.35)');
    if(readyEvolution(g)){ X.fillStyle='#ffd24a'; X.font='bold 8px Georgia'; X.textAlign='left'; X.fillText('↑ evolve', bx+8, by+42); }
    X.fillStyle='#cdbfa6'; X.font='8px Georgia'; X.textAlign='right'; X.fillText(maxed?'MAX':(xc+' / '+xn), bx+w-8, by+42); X.textAlign='left'; }
}
function drawBattleBox(){
  const b=battle; const by=LH-42, h=42;
  px(X,0,by,LW,h,'#15110c'); px(X,3,by+3,LW-6,h-6,'#2c2820'); px(X,5,by+5,LW-10,h-10,'#39342b'); px(X,3,by+3,LW-6,1,'#5d5644');
  X.textBaseline='top';
  if(b.phase==='moves'){
    const ms=b.player.moves;
    for(let i=0;i<ms.length;i++){ const mv=MOVES[ms[i]]; const sel=(i===b.moveIndex); const cy=by+6+i*9;
      if(sel){ X.fillStyle='#ffe9a8'; X.fillRect(12,cy+1,1,5); X.fillRect(13,cy+2,1,3); X.fillRect(14,cy+3,1,1); }
      X.fillStyle= sel?'#ffe9a8':'#cdbfa6'; X.font='9px Georgia'; X.fillText(mv.name, 18, cy); }
    const mv=MOVES[ms[b.moveIndex]];
    px(X,150,by+6,LW-156,h-12,'#241f18');
    X.fillStyle='#9ab0c0'; X.font='8px Georgia'; X.fillText(mv.type+'  ·  Power '+(mv.pow||'-'), 156, by+9);
    X.fillStyle='#efe7d2'; X.font='10px Georgia'; wrapText(mv.desc, 156, by+19, LW-164, 11);
    X.fillStyle='#7a746a'; X.font='8px Georgia'; X.fillText('Q = zurueck', 156, by+h-9);
    return;
  }
  if(b.phase==='party'){
    X.fillStyle='#efe7d2'; X.font='9px Georgia'; X.fillText(b.forceSwitch?'Waehle einen Akh!':'Team — E waehlen, Q zurueck', 12, by+4);
    for(let i=0;i<party.length;i++){ const m=party[i]; const sel=(i===b.partyIndex); const cy=by+14+i*8; const ko=(m.hp<=0);
      X.fillStyle= sel?'#ffe9a8':(ko?'#7a6a5a':'#cdbfa6'); X.font='9px Georgia';
      X.fillText((sel?'▸ ':'  ')+m.name+'  Lv'+m.level+'  '+Math.ceil(m.hp)+'/'+m.maxHP+(m===b.player?'  (aktiv)':'')+(ko?'  k.o.':''), 14, cy); }
    return;
  }
  let text;
  if(b.cap){ text=b.cap.msg||'...'; }
  else if(b.queue.length){ text=b.queue[0].text; if(typeof text==='function') text=text(); }
  else text='Was soll '+b.player.name+' tun?';
  const menu=(b.phase==='menu'); const maxw= menu?160:LW-24;
  X.fillStyle='#f3ecd8'; X.font='11px Georgia'; wrapText(text, 14, by+ (menu?13:10), maxw, 13);
  if(b.phase==='msg' && b.queue.length){ const yy=by+h-10+Math.round(Math.sin(b.t*6)); X.fillStyle='#d8b24a'; X.fillRect(LW-16,yy,5,1); X.fillRect(LW-15,yy+1,3,1); X.fillRect(LW-14,yy+2,1,1); }
  if(menu){
    const items=['Kampf','Wechsel','Fang ×'+ketaKapseln,'Flucht']; const mx=LW-150, cw=140;
    for(let i=0;i<4;i++){ const cy=by+3+i*9, ch=8; const sel=(i===b.menuIndex);
      px(X,mx,cy,cw,ch, sel?'#5e4d28':'#221d16'); px(X,mx,cy,cw,1, sel?'#d8b24a':'#3a342a'); if(sel) px(X,mx,cy,2,ch,'#d8b24a');
      if(sel){ X.fillStyle='#ffe9a8'; X.fillRect(mx+5,cy+2,1,4); X.fillRect(mx+6,cy+3,1,2); }
      X.fillStyle= sel?'#ffe9a8':'#cdbfa6'; X.font='9px Georgia'; X.fillText(items[i], mx+11, cy); }
  }
}
function wrapText(t, x, y, maxw, lh){
  const words=(''+t).split(' '); let line='', yy=y;
  for(const wd of words){ const test=line?line+' '+wd:wd;
    if(X.measureText(test).width>maxw){ X.fillText(line,x,yy); line=wd; yy+=lh; } else line=test; }
  if(line) X.fillText(line,x,yy);
}
function updateBattle(dt){
  if(!battle) return; const b=battle; b.t+=dt;
  b.hpE += clamp(b.enemy.hp-b.hpE, -55*dt, 55*dt);
  b.hpP += clamp(b.player.hp-b.hpP, -55*dt, 55*dt);
  for(const k of ['flashE','flashP','shakeE','shakeP','lungeP','lungeE']) if(b[k]>0){ b[k]-=dt*3.2; if(b[k]<0)b[k]=0; }
  if(b.klack>0){ b.klack-=dt*2; if(b.klack<0)b.klack=0; }
  if(b.hitFx){ b.hitFx.t-=dt; if(b.hitFx.t<=0) b.hitFx=null; }
  if(b.cap) stepCatch(dt);
}


/* ======================================================================
   BERLINODEX — Album, eine Seite pro Bezirk.
   Zustaende je Akh: locked (?)  |  seen (graue Silhouette)  |  caught (Farbe)
   Bezirks-Listen (gigos) werden von Don spaeter befuellt. Aktuell nur racoon.
   ====================================================================== */
const DEX_PAGES=[
  { key:'zehlendorf', name:'Zehlendorf', gigos:['racoon','kraehe','kraehe2','kraehe3','squirrel','squirrel2','squirrel3'] },
  { key:'chb', name:'Charlottenburg-Wilmersdorf', gigos:['kraehe','kraehe2','kraehe3','squirrel','squirrel2','squirrel3'] },
  { key:'kl', name:'Krumme Lanke', gigos:['krabbe','krabbe2'] },
];
const DEX_SLOTS=9;   // Kaechen pro Seite (3x3)
let dexPage=0;

const DEXC={ paper:'#e9dcba', paperHi:'#f3e9cf', paperLo:'#dcc99e', edge:'#b79358', edgeD:'#8a6a3a', ink:'#4a3a26', ink2:'#6d5738',
  card:'#efe3c2', cardHi:'#f6eecd', cardLo:'#e0cfa2', cbord:'#5a4630', cline:'#c6a469',
  petalP:'#e7a6bd', petalY:'#ecc768', fcenter:'#d98a3a', leaf:'#82a05a',
  cup:'#f2ead6', cupRim:'#cdb88c', coffee:'#6a4a2e', steam:'#c9b48f', grey:'#7c7566', greyD:'#5f594c' };

const dexBuf=document.createElement('canvas'); dexBuf.width=48; dexBuf.height=54; const dexBx=dexBuf.getContext('2d'); dexBx.imageSmoothingEnabled=false;

function dexFlower(x,y,col){ px(X,x,y-2,2,2,col); px(X,x-2,y,2,2,col); px(X,x+2,y,2,2,col); px(X,x,y+2,2,2,col); px(X,x-1,y-1,1,1,col); px(X,x+2,y-1,1,1,col); px(X,x-1,y+2,1,1,col); px(X,x+2,y+2,1,1,col); px(X,x,y,2,2,DEXC.fcenter); }
function dexLeaf(x,y){ px(X,x,y,1,4,DEXC.leaf); px(X,x-1,y+1,1,1,DEXC.leaf); px(X,x+1,y+2,1,1,DEXC.leaf); }
function dexCoffee(x,y){ px(X,x,y,9,7,DEXC.cupRim); px(X,x+1,y+1,7,5,DEXC.cup); px(X,x+1,y+1,7,2,DEXC.coffee);
  px(X,x+9,y+2,2,1,DEXC.cupRim); px(X,x+10,y+2,1,3,DEXC.cupRim); px(X,x+9,y+4,2,1,DEXC.cupRim); px(X,x,y+7,9,1,DEXC.cupRim);
  px(X,x+3,y-3,1,2,DEXC.steam); px(X,x+5,y-4,1,2,DEXC.steam); }
function dexCorner(x,y,fx,fy){ for(let i=0;i<5;i++) px(X,x+fx*i,y+fy*i,1,1,DEXC.edgeD); px(X,x+fx*5,y+fy*4,1,1,DEXC.edgeD); px(X,x+fx*5,y+fy*5,2,2,DEXC.edge); }
function parchmentBG(){
  const g=X.createLinearGradient(0,0,0,LH); g.addColorStop(0,DEXC.paperHi); g.addColorStop(0.5,DEXC.paper); g.addColorStop(1,DEXC.paperLo);
  X.fillStyle=g; X.fillRect(0,0,LW,LH);
  X.fillStyle='rgba(150,120,70,.10)'; for(const s of [[40,60,16],[250,40,14],[90,140,20],[280,150,12],[170,90,10]]){ X.beginPath(); X.ellipse(s[0],s[1],s[2],s[2]*0.7,0,0,7); X.fill(); }
  X.strokeStyle=DEXC.edgeD; X.lineWidth=1; X.strokeRect(5.5,5.5,LW-11,LH-11);
  X.strokeStyle=DEXC.edge; X.strokeRect(8.5,8.5,LW-17,LH-17);
  dexCorner(10,10,1,1); dexCorner(LW-11,10,-1,1); dexCorner(10,LH-11,1,-1); dexCorner(LW-11,LH-11,-1,-1);
  dexFlower(20,150,DEXC.petalP); dexLeaf(22,150); dexFlower(16,90,DEXC.petalY); dexFlower(304,150,DEXC.petalP);
  dexCoffee(290,120); dexCoffee(14,26);
}
function dexCard(x,y,w,h,deco){
  px(X,x,y,w,h,DEXC.cbord); px(X,x+1,y+1,w-2,h-2,DEXC.card); px(X,x+1,y+1,w-2,2,DEXC.cardHi); px(X,x+1,y+h-2,w-2,1,DEXC.cardLo);
  X.strokeStyle=DEXC.cline; X.lineWidth=1; X.strokeRect(x+2.5,y+2.5,w-5,h-5);
  px(X,x,y,1,1,DEXC.paper); px(X,x+w-1,y,1,1,DEXC.paper); px(X,x,y+h-1,1,1,DEXC.paper); px(X,x+w-1,y+h-1,1,1,DEXC.paper);
  if(deco===0) dexCoffee(x+w-13,y+2); else if(deco===1) dexFlower(x+w-7,y+7,DEXC.petalP); else if(deco===2) dexFlower(x+w-7,y+7,DEXC.petalY); else dexLeaf(x+w-7,y+5);
}
function dexUnknown(cx,cy,kind){
  const blob= kind==='seen'?DEXC.grey : kind==='caughtNoArt'?'#cbab6e' : '#c6b892';
  const q= kind==='seen'?DEXC.greyD : kind==='caughtNoArt'?'#8a6a3a' : '#a89b76';
  X.fillStyle=blob; X.beginPath(); X.ellipse(cx,cy,12,13,0,0,7); X.fill();
  X.fillStyle=q; X.font='bold 18px Georgia'; X.textAlign='center'; X.textBaseline='middle'; X.fillText('?',cx,cy+1); X.textAlign='left'; X.textBaseline='top';
}
function dexMonColor(id,cx,cy,s){ const g=GIGODEX[id]; if(g&&g.draw){ X.save(); X.translate(cx,cy); X.scale(s,s); X.translate(-24,-26); g.draw(X,0,0,T); X.restore(); } else dexUnknown(cx,cy,'caughtNoArt'); }
function dexMonGrey(id,cx,cy,s){ const g=GIGODEX[id];
  if(g&&g.draw){ dexBx.clearRect(0,0,48,54); g.draw(dexBx,0,2,T); dexBx.globalCompositeOperation='source-atop'; dexBx.fillStyle=DEXC.grey; dexBx.fillRect(0,0,48,54); dexBx.globalCompositeOperation='source-over';
    X.save(); X.imageSmoothingEnabled=false; X.translate(cx,cy); X.scale(s,s); X.drawImage(dexBuf,-24,-26); X.restore(); }
  else dexUnknown(cx,cy,'seen'); }
function dexFitName(nm,maxw){ X.font='7px Georgia'; if(X.measureText(nm).width<=maxw) return nm; let s=nm; while(s.length>3 && X.measureText(s+'…').width>maxw) s=s.slice(0,-1); return s+'…'; }

// ===== BERLINODEX (Buch-Look nach Vorlage) =====
const BDC={ lea:'#6e4a2c', leaD:'#4c3220', leaH:'#8a6238', gold:'#d8b24a', goldH:'#f2dd86',
  papH:'#f3e9cf', papL:'#d8c49a', ink:'#4a3520', ink2:'#7a6038' };
function bdBook(){
  X.fillStyle='#120d08'; X.fillRect(0,0,LW,LH);
  X.fillStyle=BDC.leaD; X.fillRect(2,2,LW-4,LH-4); X.fillStyle=BDC.lea; X.fillRect(4,4,LW-8,LH-8); X.fillStyle=BDC.leaH; X.fillRect(4,4,LW-8,1);
  const g=X.createLinearGradient(0,10,0,LH-10); g.addColorStop(0,BDC.papH); g.addColorStop(1,BDC.papL);
  X.fillStyle=g; X.fillRect(9,9,142,LH-18); X.fillRect(169,9,142,LH-18);
  X.fillStyle='rgba(150,120,70,.08)'; for(const s of [[40,50,12],[110,120,14],[220,140,13],[270,60,11]]){ X.beginPath(); X.ellipse(s[0],s[1],s[2],s[2]*0.7,0,0,7); X.fill(); }
  X.fillStyle=BDC.leaD; X.fillRect(151,7,18,LH-14); X.fillStyle='rgba(0,0,0,.35)'; X.fillRect(151,7,4,LH-14); X.fillRect(165,7,4,LH-14); X.fillStyle=BDC.leaH; X.fillRect(159,7,2,LH-14);
  for(const [cx,cy,sx,sy] of [[4,4,1,1],[LW-4,4,-1,1],[4,LH-4,1,-1],[LW-4,LH-4,-1,-1]]){
    X.fillStyle=BDC.gold; X.fillRect(cx+(sx<0?-16:0),cy+(sy<0?-3:0),16,3); X.fillRect(cx+(sx<0?-3:0),cy+(sy<0?-16:0),3,16);
    X.fillStyle=BDC.goldH; X.fillRect(cx+(sx<0?-16:0),cy+(sy<0?-3:0),16,1); }
}
function bdBear(x,y){ X.fillStyle='#3a2a1a'; X.fillRect(x,y+2,10,7); X.fillRect(x+1,y,2,3); X.fillRect(x+7,y,2,3); X.fillRect(x+3,y+8,4,2);
  X.fillStyle='#6f8a46'; for(let i=0;i<4;i++){ X.fillRect(x-4-i*2,y+3+i,2,1); X.fillRect(x+12+i*2,y+3+i,2,1);} }
function bdCoffee(x,y){ X.fillStyle='#cdb88c'; X.fillRect(x,y,7,5); X.fillStyle='#f2ead6'; X.fillRect(x+1,y+1,5,3); X.fillStyle='#6a4a2e'; X.fillRect(x+1,y+1,5,1); X.fillStyle='#cdb88c'; X.fillRect(x+7,y+1,1,2); X.fillStyle='#c9b48f'; X.fillRect(x+2,y-2,1,2); X.fillRect(x+4,y-3,1,2);
  X.fillStyle='#b89a5a'; X.fillRect(x-9,y+2,7,1); X.fillRect(x+8,y+2,7,1); }
function bdFlower(x,y,col){ px(X,x,y-2,2,2,col); px(X,x-2,y,2,2,col); px(X,x+2,y,2,2,col); px(X,x,y+2,2,2,col); px(X,x-1,y-1,1,1,col); px(X,x+2,y-1,1,1,col); px(X,x-1,y+2,1,1,col); px(X,x+2,y+2,1,1,col); px(X,x,y,2,2,'#e8c14a');
  X.fillStyle='#6f8a46'; px(X,x-4,y+2,3,1,'#6f8a46'); px(X,x+3,y+2,3,1,'#6f8a46'); }
function bdCrestTree(cx,cy){ X.fillStyle='#5a7a3a'; X.beginPath(); X.moveTo(cx,cy-7); X.lineTo(cx-7,cy+5); X.lineTo(cx+7,cy+5); X.fill(); X.fillStyle='#6f9a48'; X.beginPath(); X.moveTo(cx,cy-4); X.lineTo(cx-5,cy+3); X.lineTo(cx+5,cy+3); X.fill(); X.fillStyle='#3a5a24'; X.fillRect(cx-1,cy+4,2,3); }
function bdCrestCastle(cx,cy){ X.fillStyle='#e2d4a8'; X.fillRect(cx-6,cy-1,12,7); for(let i=0;i<3;i++) X.fillRect(cx-6+i*5,cy-4,3,3); X.fillStyle='#8a6a3a'; X.fillRect(cx-1,cy+2,2,4); }
function bdBanner(x,y,w,lines,col,cold,crest){
  const h=12+(lines.length-1)*9;
  X.fillStyle=cold; X.fillRect(x,y+2,w,h); X.fillStyle=col; X.fillRect(x,y,w,h); X.fillStyle='rgba(255,255,255,.15)'; X.fillRect(x,y,w,2);
  X.fillStyle=cold; X.beginPath(); X.moveTo(x,y); X.lineTo(x-6,y+3); X.lineTo(x-6,y+h-1); X.lineTo(x,y+h+2); X.fill();
  X.beginPath(); X.moveTo(x+w,y); X.lineTo(x+w+6,y+3); X.lineTo(x+w+6,y+h-1); X.lineTo(x+w,y+h+2); X.fill();
  if(crest){ X.fillStyle='#e8dcbe'; X.fillRect(x-3,y+(h-18)/2,18,18); X.fillStyle=cold; X.fillRect(x-2,y+(h-18)/2+1,16,16); crest(x+6,y+h/2); }
  X.fillStyle='#f4ecd6'; X.font='bold 9px Georgia'; X.textAlign='center'; X.textBaseline='middle';
  for(let i=0;i<lines.length;i++) X.fillText(lines[i], x+w/2+(crest?7:0), y+7+i*9);
  X.textAlign='left'; X.textBaseline='top'; return h;
}
function bdBannerLines(txt,maxw){ X.font='bold 9px Georgia'; if(X.measureText(txt).width<=maxw) return [txt];
  let idx=txt.indexOf('-'); if(idx<0) idx=txt.lastIndexOf(' ',Math.ceil(txt.length/2)+3); if(idx<0) idx=Math.floor(txt.length/2);
  return [txt.slice(0,idx+1).trim(), txt.slice(idx+1).trim()]; }
function bdMon(id,cx,cy,s,grey){ const g=GIGODEX[id]; if(!g||!g.draw){ X.fillStyle='#b7ab8e'; X.font='bold 15px Georgia'; X.textAlign='center'; X.textBaseline='middle'; X.fillText('?',cx,cy); X.textAlign='left'; X.textBaseline='top'; return; }
  if(typeof GIGO_IMG!=='undefined' && GIGO_IMG[id]){ if(grey)GIGO_TINT.grey=true; X.save(); X.translate(cx,cy); X.scale(s,s); X.translate(-24,-27); g.draw(X,0,0,T); X.restore(); GIGO_TINT.grey=false; return; }
  if(grey){ dexBuf.width=48; const b=dexBx; b.clearRect(0,0,48,54); g.draw(b,0,2,T); b.globalCompositeOperation='source-atop'; b.fillStyle='#8a8272'; b.fillRect(0,0,48,54); b.globalCompositeOperation='source-over'; X.save(); X.imageSmoothingEnabled=false; X.translate(cx,cy); X.scale(s,s); X.drawImage(dexBuf,-24,-27); X.restore(); }
  else { X.save(); X.translate(cx,cy); X.scale(s,s); X.translate(-24,-27); g.draw(X,0,0,T); X.restore(); }
}
function bdLabel(nm,cx,y,maxw){ X.font='5px Georgia'; X.textAlign='center'; X.fillStyle=BDC.ink;
  if(X.measureText(nm).width<=maxw){ X.fillText(nm,cx,y); } else { const p=nm.split(' '); let a=p.shift(),b=p.join(' '); X.fillText(a,cx,y-3); X.fillText(b,cx,y+2); }
  X.textAlign='left'; }
function bdSlot(x,y,w,h,st){
  X.fillStyle='#8a6a3a'; X.fillRect(x,y,w,h);
  X.fillStyle= st==='caught'?'#f4ecd2': st==='seen'?'#cfc6b0':'#dccfae'; X.fillRect(x+1,y+1,w-2,h-2);
  X.strokeStyle='#b59a5c'; X.lineWidth=1; X.strokeRect(x+2.5,y+2.5,w-5,h-5);
  X.fillStyle='#8a6a3a'; for(const [ax,ay] of [[x+1,y+1],[x+w-3,y+1],[x+1,y+h-3],[x+w-3,y+h-3]]) X.fillRect(ax,ay,2,2);
}
function bdPage(gx, gy, page){
  const gw=126, gh=156-gy, cw=gw/3, ch=gh/3;
  for(let i=0;i<DEX_SLOTS;i++){ const col=i%3,row=(i/3)|0; const x=gx+col*cw+2, y=gy+row*ch+2, w=cw-4, h=ch-4; const midx=x+w/2, midy=y+h/2;
    const has=i<page.gigos.length; const id=has?page.gigos[i]:null;
    const st= has? (dexCaught.has(id)?'caught': dexSeen.has(id)?'seen':'locked') : 'empty';
    bdSlot(x,y,w,h,st);
    if(st==='caught'){ bdMon(id,midx,midy-2,0.4,false); bdLabel(GIGODEX[id].name,midx,y+h-8,w-4); }
    else if(st==='seen'){ bdMon(id,midx,midy-2,0.4,true); bdLabel(GIGODEX[id].name,midx,y+h-8,w-4); }
    else { X.fillStyle='#b7ab8e'; X.font='bold 15px Georgia'; X.textAlign='center'; X.textBaseline='middle'; X.fillText('?',midx,midy-1); X.fillStyle='#a89b76'; X.fillRect(midx-1,midy+7,2,2); X.textAlign='left'; X.textBaseline='top'; }
  }
}
function bdFoot(cx,page){ let s=0,g=0; for(const id of page.gigos){ if(dexSeen.has(id))s++; if(dexCaught.has(id))g++; }
  X.fillStyle=BDC.ink2; X.font='6px Georgia'; X.textAlign='center'; X.fillText('Gesehen: '+s+' / ???   ·   Gefangen: '+g+' / ???', cx, 165); X.textAlign='left'; }
function drawBerlinodexIcon(c,ox,oy){ const x=v=>ox+v,y=v=>oy+v;
  const G='#4a6a38',GD='#38512a',GH='#5f8348',GL='#2c3f20', gold='#d8b24a',goldH='#f2dd86',goldD='#a8842f', cream='#e6d6a6',creamH='#f2e6c0',creamD='#b8a068';
  px(c,x(3),y(2),40,44,GD); px(c,x(4),y(3),38,42,G); px(c,x(4),y(3),38,2,GH); px(c,x(4),y(43),38,2,GL);
  px(c,x(2),y(3),3,42,GD); px(c,x(3),y(4),1,40,GH);
  c.strokeStyle=gold; c.lineWidth=1; c.strokeRect(x(7)+0.5, y(6)+0.5, 30, 34);
  const gx=x(11), gy=y(12);
  px(c,gx,gy+3,24,3,cream); px(c,gx+1,gy+2,22,1,creamH);
  for(let i=0;i<6;i++) px(c,gx+2+i*4,gy+6,2,10,cream);
  px(c,gx,gy+16,24,2,creamD);
  px(c,x(20),y(9),6,3,cream); px(c,x(21),y(7),1,2,cream); px(c,x(23),y(7),1,2,cream); px(c,x(22),y(6),2,1,goldH);
  const bx=x(18), by=y(30);
  px(c,bx+2,by,4,3,cream); px(c,bx+5,by-1,2,2,cream);
  px(c,bx+1,by+3,6,7,cream); px(c,bx,by+5,2,4,cream); px(c,bx+6,by+4,2,3,cream);
  px(c,bx+1,by+10,2,3,cream); px(c,bx+4,by+10,2,3,cream); px(c,bx+6,by+7,2,4,cream);
  function fl(fx,fy){ px(c,fx,fy-2,2,2,'#e08aa8'); px(c,fx-2,fy,2,2,'#e08aa8'); px(c,fx+2,fy,2,2,'#e08aa8'); px(c,fx,fy+2,2,2,'#e08aa8'); px(c,fx,fy,2,2,'#e8c14a'); px(c,fx-1,fy+3,1,3,'#6f8a46'); px(c,fx+2,fy+3,1,3,'#6f8a46'); }
  fl(x(11),y(11)); fl(x(35),y(11)); fl(x(11),y(37)); fl(x(35),y(37));
  for(let i=0;i<5;i++){ px(c,x(9),y(15+i*3),1,2,'#6f8a46'); px(c,x(37),y(15+i*3),1,2,'#6f8a46'); }
  for(const [cx,cy,sx] of [[4,3,1],[42,3,-1],[4,45,1],[42,45,-1]]){
    c.fillStyle=gold; c.fillRect(ox+(sx<0?cx-6:cx), oy+cy+(cy>40?-6:0),7,3); c.fillRect(ox+cx+(sx<0?-3:0), oy+cy+(cy>40?-6:0),3,7);
    c.fillStyle=goldH; c.fillRect(ox+(sx<0?cx-6:cx), oy+cy+(cy>40?-6:0),7,1); }
  px(c,x(6),y(46),34,2,'#cfc0a0'); px(c,x(6),y(47),34,1,'#a89878');
  px(c,x(5),y(44),4,6,gold); px(c,x(5),y(50),2,2,goldD); px(c,x(7),y(50),2,2,goldD);
}
let dexGridGeom={gx0:16,gy0:60,cw:96,ch:33};
let dexEntryId=null, dexEntryShiny=false;
function bdWrap(txt,x,y,maxw,lh){ const words=(''+txt).split(' '); let line='',yy=y;
  for(const wd of words){ const tt=line?line+' '+wd:wd; if(X.measureText(tt).width>maxw){ X.fillText(line,x,yy); line=wd; yy+=lh; } else line=tt; }
  if(line){ X.fillText(line,x,yy); yy+=lh; } return yy; }
function dexFoundList(id){ const out=[]; for(const p of DEX_PAGES){ if(p.gigos.includes(id)) out.push(p.name); } return out; }
function openDexEntry(id){ dexEntryId=id; dexEntryShiny=false; G.state='dexEntry'; }
function closeDexEntry(){ G.state='dex'; }
function dexEntryKey(k){ if(['b','i','q','escape','backspace'].includes(k)) closeDexEntry();
  else if(k==='s') dexEntryShiny=!dexEntryShiny; }
function bdPortrait(x,y,w,h,id,mode){
  px(X,x,y,w,h,'#3a2a18'); px(X,x+1,y+1,w-2,h-2,'#efe3c2'); px(X,x+2,y+2,w-4,h-4,'#e7d7ae');
  const g=X.createRadialGradient(x+w/2,y+h/2,8,x+w/2,y+h/2,h*0.7); g.addColorStop(0,'rgba(255,240,200,.35)'); g.addColorStop(1,'rgba(120,90,50,.18)');
  X.fillStyle=g; X.fillRect(x+2,y+2,w-4,h-4);
  X.strokeStyle='#c9a86e'; X.lineWidth=1; X.strokeRect(x+3.5,y+3.5,w-7,h-7);
  X.fillStyle='rgba(60,40,20,.25)'; X.beginPath(); X.ellipse(x+w/2,y+h-14,w*0.32,5,0,0,7); X.fill();
  if(mode==='caught') bdMon(id, x+w/2, y+h/2-6, 2.35, false);
  else if(mode==='seen') bdMon(id, x+w/2, y+h/2-6, 2.35, true);
  else { X.fillStyle='#b7ab8e'; X.font='bold 40px Georgia'; X.textAlign='center'; X.textBaseline='middle'; X.fillText('?',x+w/2,y+h/2); X.textAlign='left'; X.textBaseline='top'; }
}
function renderDexEntry(){
  const id=dexEntryId, g=GIGODEX[id]; const caught=dexCaught.has(id), seen=dexSeen.has(id);
  const mode = caught?'caught': seen?'seen':'locked';
  X.fillStyle='#120d08'; X.fillRect(0,0,LW,LH);
  X.fillStyle=BDC.leaD; X.fillRect(2,2,LW-4,LH-4); X.fillStyle=BDC.lea; X.fillRect(4,4,LW-8,LH-8); X.fillStyle=BDC.leaH; X.fillRect(4,4,LW-8,1);
  const gr=X.createLinearGradient(0,8,0,LH-8); gr.addColorStop(0,BDC.papH); gr.addColorStop(1,BDC.papL);
  X.fillStyle=gr; X.fillRect(9,8,LW-18,LH-16);
  for(const [cx,cy,sx,sy] of [[4,4,1,1],[LW-4,4,-1,1],[4,LH-4,1,-1],[LW-4,LH-4,-1,-1]]){
    X.fillStyle=BDC.gold; X.fillRect(cx+(sx<0?-16:0),cy+(sy<0?-3:0),16,3); X.fillRect(cx+(sx<0?-3:0),cy+(sy<0?-16:0),3,16);
    X.fillStyle=BDC.goldH; X.fillRect(cx+(sx<0?-16:0),cy+(sy<0?-3:0),16,1); }
  X.fillStyle=BDC.gold; X.font='bold 9px Georgia'; X.textAlign='left'; X.textBaseline='top'; X.fillText('‹ zurück', 12, 6);
  X.textAlign='right'; X.font='bold 12px Georgia'; X.fillText('×', LW-8, 4); X.textAlign='left';
  bdPortrait(14, 24, 116, 128, id, mode);
  X.fillStyle=dexEntryShiny?'#e6c24a':'#8a7c60'; X.font='7px Georgia'; X.textAlign='center';
  X.fillText('✦ Shiny: noch nicht entdeckt', 72, 156); X.textAlign='left';
  const rx=140; let ry=26;
  X.fillStyle=BDC.ink; X.font='bold 13px Georgia'; X.textBaseline='top';
  const nm = (mode==='locked')?'???':g.name;
  ry=bdWrap(nm, rx, ry, LW-rx-14, 14)+2;
  if(mode!=='locked'){
    X.font='7px Georgia'; let px0=rx;
    function pill(txt,bg,fg){ const w=X.measureText(txt).width+8; px(X,px0,ry,w,11,bg); X.fillStyle=fg; X.font='7px Georgia'; X.fillText(txt,px0+4,ry+2); px0+=w+4; }
    pill('Typ: '+g.type, '#6a5638', '#f3e9cf');
    if(g.stage) pill(g.stage, '#7a8a3a', '#f3e9cf');
    ry+=15;
    X.fillStyle=BDC.ink2; X.font='7px Georgia'; X.fillText('Fundorte', rx, ry); ry+=9;
    X.fillStyle=BDC.ink; X.font='8px Georgia';
    const fl=dexFoundList(id); ry=bdWrap(fl.length?fl.join(', '):'Unbekannt', rx, ry, LW-rx-14, 10)+3;
    px(X,rx,ry,LW-rx-14,1,'#c9a86e'); ry+=5;
    X.fillStyle=BDC.ink2; X.font='7px Georgia'; X.fillText('Lore', rx, ry); ry+=9;
    X.fillStyle=BDC.ink; X.font='8px Georgia';
    const lore = caught? (g.dex&&g.dex!=='???'?g.dex:'Über diesen Akh ist noch wenig bekannt.') : 'Noch nicht gefangen — schnapp ihn dir, um seine Lore freizuschalten.';
    bdWrap(lore, rx, ry, LW-rx-14, 10);
  } else {
    X.fillStyle=BDC.ink2; X.font='8px Georgia'; bdWrap('Dieser Akh wurde noch nie gesichtet.', rx, ry+4, LW-rx-14, 11);
  }
}
function renderDex(){
  const page=DEX_PAGES[dexPage];
  // Leder-Rahmen + eine grosse Pergament-Seite
  X.fillStyle='#120d08'; X.fillRect(0,0,LW,LH);
  X.fillStyle=BDC.leaD; X.fillRect(2,2,LW-4,LH-4); X.fillStyle=BDC.lea; X.fillRect(4,4,LW-8,LH-8); X.fillStyle=BDC.leaH; X.fillRect(4,4,LW-8,1);
  const g=X.createLinearGradient(0,8,0,LH-8); g.addColorStop(0,BDC.papH); g.addColorStop(1,BDC.papL);
  X.fillStyle=g; X.fillRect(9,8,LW-18,LH-16);
  X.fillStyle='rgba(150,120,70,.08)'; for(const s of [[60,60,14],[250,50,12],[110,140,15],[280,150,11]]){ X.beginPath(); X.ellipse(s[0],s[1],s[2],s[2]*0.7,0,0,7); X.fill(); }
  for(const [cx,cy,sx,sy] of [[4,4,1,1],[LW-4,4,-1,1],[4,LH-4,1,-1],[LW-4,LH-4,-1,-1]]){
    X.fillStyle=BDC.gold; X.fillRect(cx+(sx<0?-16:0),cy+(sy<0?-3:0),16,3); X.fillRect(cx+(sx<0?-3:0),cy+(sy<0?-16:0),3,16);
    X.fillStyle=BDC.goldH; X.fillRect(cx+(sx<0?-16:0),cy+(sy<0?-3:0),16,1); }
  // Header
  bdBear(LW/2-5,9);
  X.fillStyle=BDC.ink; X.font='bold 10px Georgia'; X.textAlign='center'; X.textBaseline='top';
  X.fillText('B E R L I N O D E X', LW/2, 21);
  bdCoffee(LW/2-40,24); bdCoffee(LW/2+30,24);
  // Bezirks-Banner mit Wappen
  const isZ = page.key==='zehlendorf';
  const col = isZ? '#7a8a3a' : '#6a8aa0', cold = isZ? '#5f6f28' : '#4f6f88';
  const crest = isZ? bdCrestTree : bdCrestCastle;
  const lines = bdBannerLines((page.name||'').toUpperCase(), 150);
  const bw2 = lines.length>1? 170 : Math.max(110, Math.round(X.measureText(lines[0]).width)+52);
  const bh2 = bdBanner((LW-bw2)/2, 33, bw2, lines, col, cold, crest);
  // Grid 3x3 — grosse Slots
  const gy0=36+bh2+5, gx0=16, gw=LW-32, gh=160-gy0, cw=gw/3, ch=gh/3;
  dexGridGeom={gx0,gy0,cw,ch};
  for(let i=0;i<DEX_SLOTS;i++){ const c2=i%3, r2=(i/3)|0; const x=gx0+c2*cw+3, y=gy0+r2*ch+2, w=cw-6, hh=ch-4;
    const midx=x+w/2, midy=y+hh/2;
    const has=i<page.gigos.length; const id=has?page.gigos[i]:null;
    const st= has? (dexCaught.has(id)?'caught': dexSeen.has(id)?'seen':'locked') : 'empty';
    bdSlot(x,y,w,hh,st);
    if(st==='caught'){ bdMon(id,midx,midy-3,0.62,false); }
    else if(st==='seen'){ bdMon(id,midx,midy-3,0.62,true); }
    else { X.fillStyle='#b7ab8e'; X.font='bold 16px Georgia'; X.textAlign='center'; X.textBaseline='middle'; X.fillText('?',midx,midy-2); X.fillStyle='#a89b76'; X.fillRect(midx-1,midy+8,2,2); X.textAlign='left'; X.textBaseline='top'; }
    if(st==='caught'||st==='seen'){ X.fillStyle=BDC.ink; X.font='7px Georgia'; X.textAlign='center'; X.textBaseline='top';
      let nm=GIGODEX[id].name; if(X.measureText(nm).width>w-6){ let s2=nm; while(s2.length>3&&X.measureText(s2+'…').width>w-6)s2=s2.slice(0,-1); nm=s2+'…'; }
      X.fillText(nm, midx, y+hh-9); X.textAlign='left'; }
  }
  // Footer + Navigation
  let seen=0,caught=0; for(const id of page.gigos){ if(dexSeen.has(id))seen++; if(dexCaught.has(id))caught++; }
  X.fillStyle=BDC.ink2; X.font='7px Georgia'; X.textAlign='center'; X.textBaseline='top';
  X.fillText('Gesehen: '+seen+' / ???   ·   Gefangen: '+caught+' / ???', LW/2, 163);
  X.textAlign='left';
  // Blaetter-Pfeile (gezeichnete Dreiecke)
  X.fillStyle=BDC.gold;
  X.beginPath(); X.moveTo(12,90); X.lineTo(20,82); X.lineTo(20,98); X.fill();
  X.beginPath(); X.moveTo(LW-12,90); X.lineTo(LW-20,82); X.lineTo(LW-20,98); X.fill();
  // Punkte + Schliessen
  for(let i=0;i<DEX_PAGES.length;i++){ px(X, LW/2-(DEX_PAGES.length*8-4)/2+i*8, LH-11, 4,4, i===dexPage?BDC.gold:'#8a7448'); }
  X.fillStyle=BDC.gold; X.font='bold 12px Georgia'; X.textAlign='right'; X.fillText('×', LW-8, 4); X.textAlign='left';
  // Blumen-Deko
  bdFlower(22,18,'#e08aa8'); bdFlower(LW-22,18,'#9a7ac0'); bdFlower(20,152,'#e8c14a'); bdFlower(LW-20,152,'#e08aa8');
}
function openDex(){ dexPage=0; G.state='dex'; }
function closeDex(){ G.state='play'; }
function dexKey(k){
  if(['arrowright','d'].includes(k)) dexPage=(dexPage+1)%DEX_PAGES.length;
  else if(['arrowleft','a'].includes(k)) dexPage=(dexPage+DEX_PAGES.length-1)%DEX_PAGES.length;
  else if(['b','i','q','escape','backspace'].includes(k)) closeDex();
}


/* ======================================================================
   QUEST-ABSCHLUSS — Sörens Vision, Eichen-Obergeschoss, Starter-Wahl
   ====================================================================== */



// ---------- Eiche · Obergeschoss (Geheimkammer) ----------
const eicheObenBG=document.createElement('canvas'); eicheObenBG.width=LW; eicheObenBG.height=LH;
const eicheObenSolids=[];
let obenBuilt=false, obenUnlocked=false;
function blockedEicheOben(fx,fy,fw,fh){ for(const s of eicheObenSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; } return false; }
function domeInc(c,cx,base,tint){
  c.fillStyle='#4a3320'; c.fillRect(cx-12,base,24,12); c.fillStyle='#5c4028'; c.fillRect(cx-12,base,24,3); c.fillStyle='#6e4e30'; c.fillRect(cx-13,base+11,26,3);
  c.save(); c.fillStyle=tint; c.globalAlpha=0.45; c.beginPath(); c.ellipse(cx,base-8,9,11,0,0,7); c.fill(); c.restore();
  kapselAt(c, cx, base-6, 0.85, 0, 0);
  c.fillStyle='rgba(205,228,238,.26)'; c.beginPath(); c.ellipse(cx,base-6,12,15,0,Math.PI,0); c.fill();
  c.strokeStyle='rgba(225,242,250,.5)'; c.lineWidth=1; c.beginPath(); c.ellipse(cx,base-6,12,15,0,Math.PI,0); c.stroke();
  c.fillStyle='#cdb88c'; c.fillRect(cx-13,base-6,26,2);
  c.fillStyle='rgba(255,255,255,.4)'; c.fillRect(cx-6,base-16,2,7);
}
function buildEicheOben(){
  if(obenBuilt) return; obenBuilt=true;
  const c=eicheObenBG.getContext('2d'); c.imageSmoothingEnabled=false; c.textBaseline='top';
  c.fillStyle='#1a1108'; c.fillRect(0,0,LW,LH);
  // Holzwand hinten (Rinde)
  c.fillStyle='#2e2012'; c.fillRect(0,0,LW,60);
  for(let i=0;i<120;i++){ c.fillStyle=hash(i,7)<.5?'#372714':'#241a0e'; c.fillRect((hash(i,1)*LW)|0,(hash(i,2)*58)|0,3,2); }
  // Boden (warme Dielen, gerundet)
  c.save(); c.beginPath(); c.ellipse(160,116,140,66,0,0,7); c.clip();
  c.fillStyle='#6e4a2c'; c.fillRect(0,50,LW,LH);
  for(let r=0;r<10;r++){ c.fillStyle=r%2?'#66442a':'#754f30'; c.fillRect(0,52+r*13,LW,13); }
  for(let i=0;i<160;i++){ c.fillStyle=hash(i,9)<.5?'#5c3c24':'#7a5334'; c.fillRect((hash(i,1)*LW)|0,(52+hash(i,2)*128)|0,2,1); }
  c.restore();
  // Wurzel-Rahmen
  for(let a=0;a<6.283;a+=0.07){ const rx=140+Math.sin(a*5)*6, ry=66+Math.sin(a*7)*5; const ex=(160+Math.cos(a)*rx)|0, ey=(116+Math.sin(a)*ry)|0; c.fillStyle=hash(ex,ey)<.5?'#2f2012':'#3d2a18'; c.fillRect(ex-3,ey-3,7,7); }
  // Bücherregal + Bücherstapel + Schriften (Sörens Kram)
  c.fillStyle='#3a2a1a'; c.fillRect(10,58,42,40); c.fillStyle='#4a3522'; c.fillRect(12,60,38,36);
  for(let r=0;r<3;r++){ for(let b=0;b<9;b++){ c.fillStyle=['#6a3a2a','#3a5a6a','#5a6a3a','#7a6a3a','#5a3a5a'][(b+r)%5]; c.fillRect(14+b*4,62+r*11,3,8);} c.fillStyle='#2a1c12'; c.fillRect(12,71+r*11,38,2);}
  eicheObenSolids.push({x:10,y:80,w:42,h:18});
  // Bücherstapel rechts
  c.fillStyle='#6a3a2a'; c.fillRect(276,80,26,6); c.fillStyle='#3a5a6a'; c.fillRect(278,74,22,6); c.fillStyle='#5a6a3a'; c.fillRect(280,68,18,6);
  eicheObenSolids.push({x:274,y:80,w:30,h:12});
  // angepinnte Zettel an der Wand
  for(const p of [[70,10],[110,16],[210,12],[250,18],[150,8]]){ c.fillStyle='#e9ddc0'; c.fillRect(p[0],p[1],14,11); c.fillStyle='#b9a882'; for(let l=0;l<3;l++) c.fillRect(p[0]+2,p[1]+3+l*3,10,1); c.fillStyle='#8a1a1a'; c.fillRect(p[0]+6,p[1]-1,2,2); }
  // Kerzen / warmes Licht
  function candle(lx,ly){ c.fillStyle='#2a2118'; c.fillRect(lx,ly,4,7); c.fillStyle='#f4d96a'; c.fillRect(lx+1,ly-3,2,3); c.fillStyle='#fff2c0'; c.fillRect(lx+1,ly-4,2,2); }
  candle(58,104); candle(262,104); candle(160,150);
  // Drei Inkubatoren mit Glaskuppeln (Starter)
  domeInc(c, 78, 52, '#c9a24a');
  domeInc(c, 160, 48, '#a06ad0');
  domeInc(c, 242, 52, '#5aa04a');
  eicheObenSolids.push({x:64,y:44,w:28,h:22}); eicheObenSolids.push({x:146,y:40,w:28,h:22}); eicheObenSolids.push({x:228,y:44,w:28,h:22});
  // kleiner Teppich Mitte
  c.fillStyle='#7a3a2a'; c.beginPath(); c.ellipse(160,120,40,20,0,0,7); c.fill(); c.fillStyle='#8a4636'; c.beginPath(); c.ellipse(160,120,34,16,0,0,7); c.fill(); c.fillStyle='#7a3a2a'; c.beginPath(); c.ellipse(160,120,22,10,0,0,7); c.fill();
  // Ausgang: Wurzelloch runter (unten mittig)
  c.fillStyle='#0f0a06'; c.beginPath(); c.ellipse(160,168,22,10,0,0,7); c.fill();
  c.fillStyle='#2c2016'; c.beginPath(); c.ellipse(160,166,17,7,0,0,7); c.fill();
  c.fillStyle='#cfe0b0'; c.font='6px Georgia'; c.fillText('↓ runter',146,156);
  // Rand-Solids (im Raum halten)
  eicheObenSolids.push({x:0,y:0,w:LW,h:44}); eicheObenSolids.push({x:0,y:0,w:22,h:LH}); eicheObenSolids.push({x:LW-22,y:0,w:22,h:LH});
}
const soerenOben={x:150,y:66};
let cutscene=null, fadeAlpha=0, reveal=null, starterMons=null;
const SREV_X=[104,160,216], SREV_Y=120;

function drawMonAt(id,cx,cy,s,a){ const g=GIGODEX[id]; if(!g||!g.draw) return; X.save(); if(a!=null)X.globalAlpha=a; X.translate(cx,cy); X.scale(s,s); X.translate(-24,-44); g.draw(X,0,0,T); X.restore(); }
function renderEicheOben(){
  X.clearRect(0,0,LW,LH); X.drawImage(eicheObenBG,0,0);
  for(const cx of [78,160,242]){ if(hash((cx+ (T*2|0))|0, 3)<0.5){ X.fillStyle='rgba(255,255,255,.5)'; X.fillRect(cx+4, 40+((T*3|0)%3), 1,1); } }
  const ents=[{y:soerenOben.y+22,d:()=>drawSoeren(X,soerenOben.x,soerenOben.y)},{y:player.y+22,d:()=>drawChar(X,player.x|0,player.y|0,player.dir,player.frame,PAL_PLAYER)}];
  if(starterMons) for(const m of starterMons) ents.push({y:m.y, d:()=>drawMonAt(m.id,m.x,m.y,0.82,1)});
  ents.sort((a,b)=>a.y-b.y); for(const e of ents) e.d();
  if(reveal){ const R=reveal;
    if(R.sub==='throw'){ kapselAt(X,R.capX,R.capY,1.4,R.capRot,0); }
    else if(R.sub==='open'){ X.fillStyle='rgba(255,240,180,'+((1-R.appear)*0.55)+')'; X.beginPath(); X.ellipse(SREV_X[R.i],SREV_Y-16,14,17,0,0,7); X.fill();
      drawMonAt(STARTERS[R.i].id,SREV_X[R.i],SREV_Y,0.82*Math.max(0.15,R.appear),R.appear); kapselAt(X,R.capX,R.capY,1.4,0,1); } }
  const g=X.createRadialGradient(160,100,40,160,100,180); g.addColorStop(0,'rgba(255,210,120,.06)'); g.addColorStop(1,'rgba(10,6,2,.5)');
  X.fillStyle=g; X.fillRect(0,0,LW,LH);
  if(reveal && reveal.caption){ X.fillStyle='rgba(20,14,8,.82)'; X.fillRect(LW/2-72,13,144,19); X.fillStyle='#3a2a18'; X.fillRect(LW/2-72,13,144,1);
    X.fillStyle='#ffe9a8'; X.font='bold 12px Georgia'; X.textAlign='center'; X.textBaseline='top'; X.fillText(reveal.caption, LW/2, 17); X.textAlign='left'; }
}

function enterEicheOben(){ G.scene='eicheOben'; player.x=150; player.y=140; player.dir='up'; player.frame=0;
  setBanner('Eiche · Obergeschoss','Sörens Geheimkammer'); showBanner(); enterCool=0.6; }
function exitEicheOben(){ G.scene='eiche'; player.x=152; player.y=118; player.dir='up'; player.frame=0; enterCool=0.6; setBanner('Zehlendorf-Eiche','In der Eiche'); }

// ---------- Cutscene: mit Sören nach hinten laufen -> Fade -> oben ----------
function startEicheClimb(){ obenUnlocked=true; G.state='cutscene'; cutscene={phase:'walk',t:0}; fadeAlpha=0; }
function drawFade(){ if(fadeAlpha>0){ X.fillStyle='rgba(0,0,0,'+fadeAlpha+')'; X.fillRect(0,0,LW,LH); }
  if(cutscene && cutscene.phase==='walk'){ X.fillStyle='rgba(0,0,0,.5)'; X.fillRect(0,LH-20,LW,20); X.fillStyle='#e8dcc0'; X.font='9px Georgia'; X.textAlign='center'; X.textBaseline='top'; X.fillText('Du folgst Sören tiefer in die Eiche…', LW/2, LH-15); X.textAlign='left'; } }
function stepCutscene(dt){ const c=cutscene; if(!c) return; c.t+=dt;
  if(c.phase==='walk'){ player.dir='up'; player.frame=1+((T*7|0)%2);
    player.y=Math.max(52, player.y-26*dt); player.x+=clamp(150-player.x,-26*dt,26*dt);
    soeren.y=Math.max(48, soeren.y-22*dt);
    if(player.y<=53 || c.t>1.7){ c.phase='fadeOut'; c.t=0; player.frame=0; } }
  else if(c.phase==='fadeOut'){ fadeAlpha=clamp(c.t/0.55,0,1); if(c.t>=0.55){ c.phase='switch'; } }
  else if(c.phase==='switch'){ G.scene='eicheOben'; player.x=150;player.y=140;player.dir='up';player.frame=0; soeren.x=148;soeren.y=80;
    setBanner('Eiche · Obergeschoss','Sörens Geheimkammer'); showBanner(); fadeAlpha=1; c.phase='fadeIn'; c.t=0; }
  else if(c.phase==='fadeIn'){ fadeAlpha=clamp(1-c.t/0.55,0,1); if(c.t>=0.55){ fadeAlpha=0; cutscene=null; G.state='play'; startObenIntro(); } }
}
function startObenIntro(){ openDialog('Sören',[
  {w:'Sören',t:'*deutet auf drei Glaskuppeln* Schau genau hin, mein Sohn. Das hier sind meine kostbarsten Funde.'},
], ()=>startReveal()); }

// ---------- Reveal: Sören wirft die Kapseln, jeder Akh erscheint ----------
function startReveal(){ G.state='reveal'; starterMons=[]; reveal={ t:0, i:0, sub:'throw', capX:0,capY:0,capOpen:0,capRot:0, appear:0, caption:GIGODEX[STARTERS[0].id].name+'!' }; }
function stepReveal(dt){ const R=reveal; if(!R) return; R.t+=dt; const i=R.i; const s=STARTERS[i];
  const from={x:soerenOben.x+7,y:soerenOben.y+8}, to={x:SREV_X[i],y:SREV_Y};
  if(R.sub==='throw'){ const d=0.42,k=clamp(R.t/d,0,1); R.capX=from.x+(to.x-from.x)*k; R.capY=from.y+(to.y-from.y)*k - Math.sin(k*Math.PI)*30; R.capRot=R.t*14; R.caption=GIGODEX[s.id].name+'!';
    if(R.t>=d){ R.sub='open'; R.t=0; R.capX=to.x; R.capY=to.y; R.appear=0; } }
  else if(R.sub==='open'){ const d=0.3,k=clamp(R.t/d,0,1); R.appear=k; if(R.t>=d){ R.sub='hold'; R.t=0; R.appear=1; starterMons.push({id:s.id,x:to.x,y:to.y}); } }
  else if(R.sub==='hold'){ if(R.t>=0.5){ R.i++; if(R.i<3){ R.sub='throw'; R.t=0; } else { R.sub='done'; R.t=0; R.caption=''; } } }
  else if(R.sub==='done'){ if(R.t>=0.45){ reveal=null; revealReaction(); } }
}
function revealReaction(){ G.state='play'; openDialog('Sören',[
  {w:'Don',t:'What the Helly!? Setzen Sie diese Tiere unter Drogen? Der hat ja Teller wie manche Raver sie um 6 Uhr früh im Berghain nicht haben!'},
  {w:'Don',t:'Und der kleine Affe ist ja völlig angezündet, der geht ja nur loco. Und von der Kröte will ich gar nicht erst anfangen.'},
  {w:'Sören',t:'HEHEHEHAAA. Nein, Don. Ich habe diese Akhs allesamt so gefunden — und aufbewahrt bis zu diesem einen großen Tag.'},
  {w:'Sören',t:'Der Tag, an dem ein junger Kerl, geschickt von Haze, in der Eiche eintritt und sich über die Akhs erkundigt.'},
  {w:'Sören',t:'Es ist Zeit: Wähle nun weise, welcher Akh dich auf deiner Reise begleiten soll!'},
], ()=>openStarterSelect()); }

// ---------- Starter-Auswahl ----------
let starterChosen=null, starterIndex=0, starterPick=0, confirmIdx=0;
function openStarterSelect(){ G.state='starter'; starterIndex=0; }
function grantStarter(id){
  for(let i=party.length-1;i>=0;i--) if(party[i].id==='leo') party.splice(i,1);   // Leo zurück
  party.push(makeGigo(id,5)); hasLeo=false; starterChosen=id; starterMons=null; reveal=null;
  dexSeen.add(id); dexCaught.add(id);
  const nm=GIGODEX[id].name; G.state='play';
  toast('🧪 '+nm+' schließt sich deinem Team an!',2800);
  openDialog('Sören',[
    {w:'Sören',t:'Eine ausgezeichnete Wahl, mein Sohn. '+nm+' wird dir treu zur Seite stehen.'},
    {w:'Sören',t:'*nimmt Leo an sich* Und Leo bleibt bei mir. Er hat seinen Dienst getan — HIHIHAA.'},
    {w:'Sören',t:'Jetzt geh. Finde heraus, was in den anderen Bezirken vor sich geht. Der Crack Mage schläft nicht — und ich, HEHEHA, ich auch nicht!'},
  ]);
}
function fitText(nm,maxw){ if(X.measureText(nm).width<=maxw) return nm; let s=nm; while(s.length>3 && X.measureText(s+'…').width>maxw) s=s.slice(0,-1); return s+'…'; }
function wrapCenter(t,cx,y,maxw,lh){ const words=(''+t).split(' '); let line='',yy=y; for(const wd of words){ const tt=line?line+' '+wd:wd; if(X.measureText(tt).width>maxw){ X.fillText(line,cx,yy); line=wd; yy+=lh;} else line=tt; } if(line) X.fillText(line,cx,yy); }
const STC={ x0:(LW-(92*3+11*2))/2, cw:92, gap:11, y:30, ch:118 };
function renderStarterSelect(){
  X.drawImage(eicheObenBG,0,0); X.fillStyle='rgba(20,14,8,.66)'; X.fillRect(0,0,LW,LH);
  X.textBaseline='top'; X.fillStyle='#f6ecce'; X.font='bold 14px Georgia'; X.textAlign='center'; X.fillText('Wähle deinen Akh', LW/2, 8);
  for(let i=0;i<3;i++){ const s=STARTERS[i], g=GIGODEX[s.id]; const x=STC.x0+i*(STC.cw+STC.gap), y=STC.y, w=STC.cw, h=STC.ch; const sel=(i===starterIndex);
    px(X,x-2,y-2,w+4,h+4, sel?'#e6c24a':'#241a10'); px(X,x,y,w,h,'#efe3c2'); px(X,x+1,y+1,w-2,h-2, sel?'#f7efce':'#e6d7b0');
    if(sel){ px(X,x,y,w,2,'#fff2c0'); }
    X.save(); X.translate(x+w/2, y+42); const sc=0.9; X.scale(sc,sc); X.translate(-24,-26); g.draw(X,0,0,T); X.restore();
    X.fillStyle='#3a2a18'; X.font='bold 10px Georgia'; X.textAlign='center'; X.fillText(fitText(g.name,w-6), x+w/2, y+72);
    X.fillStyle='#8a5a2a'; X.font='8px Georgia'; X.fillText(s.tag, x+w/2, y+84);
    X.fillStyle='#5a4630'; X.font='8px Georgia'; wrapCenter(s.blurb, x+w/2, y+96, w-12, 9);
  }
  X.fillStyle='#e7d9b4'; X.font='9px Georgia'; X.textAlign='center'; X.fillText('‹ ›  waehlen   ·   A / Antippen  bestaetigen', LW/2, LH-12);
  X.textAlign='left';
}
function renderStarterConfirm(){
  renderStarterSelect(); X.fillStyle='rgba(8,6,3,.55)'; X.fillRect(0,0,LW,LH);
  const bw=210, bh=74, bx=(LW-bw)/2, by=(LH-bh)/2, g=GIGODEX[STARTERS[starterPick].id];
  px(X,bx-2,by-2,bw+4,bh+4,'#241a10'); px(X,bx,by,bw,bh,'#efe3c2'); px(X,bx+1,by+1,bw-2,bh-2,'#f6ecce');
  X.fillStyle='#3a2a18'; X.font='bold 12px Georgia'; X.textAlign='center'; X.textBaseline='top';
  X.fillText('Du nimmst wirklich', LW/2, by+13); X.fillText(g.name+'?', LW/2, by+28);
  function btn(bx2,label,sel,col){ px(X,bx2,by+48,88,17, sel?col:'#241f18'); px(X,bx2,by+48,88,1, sel?'#fff6d0':'#3a342a'); X.fillStyle= sel?'#ffffff':'#cdbfa6'; X.font='bold 10px Georgia'; X.fillText(label, bx2+44, by+51); }
  btn(bx+8,'Yessirski', confirmIdx===0, '#3a7a3a'); btn(bx+bw-96,'Nahh Blud', confirmIdx===1, '#9a3a3a');
  X.textAlign='left';
}
function starterKey(k){
  if(G.state==='starter'){
    if(['arrowright','d','arrowdown','s'].includes(k)) starterIndex=(starterIndex+1)%3;
    else if(['arrowleft','a','arrowup','w'].includes(k)) starterIndex=(starterIndex+2)%3;
    else if(k==='e'||k===' '||k==='enter'){ starterPick=starterIndex; confirmIdx=0; G.state='starterConfirm'; }
  } else if(G.state==='starterConfirm'){
    if(['arrowleft','a','arrowright','d'].includes(k)) confirmIdx=confirmIdx?0:1;
    else if(k==='e'||k===' '||k==='enter'){ if(confirmIdx===0) grantStarter(STARTERS[starterPick].id); else G.state='starter'; }
    else if(k==='q'||k==='escape'||k==='backspace') G.state='starter';
  }
}
function talkSoerenOben(){ if(!starterChosen) startStarterReveal(); else soerenTeaser(); }
function soerenTeaser(){ openDialog('Sören',[
  {w:'Sören',t:'Zieh los, mein Sohn. Die Spur des Crack Mage führt hinaus aus Zehlendorf.'},
  {w:'Sören',t:'Charlottenburg, Wilmersdorf… und weiter. Fang die Akhs, fülle den Berlinodex. Ich melde mich, wenn ich mehr sehe. HEHEHA!'},
]); }


/* ======================================================================
   TEAM-SCREEN + AKH-LAGER + Fang-Overflow-Wahl
   Team-Cap = 3. Ueberzaehlige -> Lager (storage) oder freilassen.
   (Ein-/Auslagern via Pokecenter-Computer kommt spaeter.)
   ====================================================================== */
const storage=[];            // Akh-Lager
let pendingCatch=null;        // gefangener Akh bei vollem Team
let catchChoiceIdx=0;

function openTeam(){ G.state='team'; }
function closeTeam(){ G.state='play'; }
function teamKey(k){ if(['t','i','q','escape','backspace','b'].includes(k)) closeTeam(); }

function openCatchChoice(){ G.state='catchChoice'; catchChoiceIdx=0; }
function catchChoose(keep){ const E=pendingCatch; pendingCatch=null; G.state='play';
  if(keep){ storage.push(E); toast(E.name+' wurde ins Akh-Lager geschickt.',2600); }
  else { toast(E.name+' wurde freigelassen. Alles Gute, kleiner Akh!',2600); }
}
function catchKey(k){ if(['arrowleft','a','arrowright','d'].includes(k)) catchChoiceIdx=catchChoiceIdx?0:1;
  else if(k==='e'||k===' '||k==='enter') catchChoose(catchChoiceIdx===0); }

function drawHPmini(bx,by,bw,g){ const bh=6; const frac=clamp(g.hp/g.maxHP,0,1); const col=frac>0.5?'#62c64c':frac>0.22?'#e6b93c':'#dc4636';
  px(X,bx-1,by-1,bw+2,bh+2,'#15110c'); px(X,bx,by,bw,bh,'#46443c'); px(X,bx,by,Math.round(bw*frac),bh,col); px(X,bx,by,Math.round(bw*frac),1,'rgba(255,255,255,.3)'); }

function renderTeam(){
  parchmentBG();
  X.textAlign='center'; X.textBaseline='top'; X.fillStyle=DEXC.ink; X.font='bold 13px Georgia';
  X.fillText('Dein Team', LW/2, 11);
  X.fillStyle=DEXC.ink2; X.font='8px Georgia'; X.fillText(party.length+' / 3 dabei', LW/2, 25);
  X.fillStyle=DEXC.edgeD; X.font='bold 11px Georgia'; X.textAlign='right'; X.fillText('×',LW-8,4); X.textAlign='left';
  const cw=94, gap=8, x0=(LW-(cw*3+gap*2))/2, y=36, ch=104;
  for(let i=0;i<3;i++){ const x=x0+i*(cw+gap); const g=party[i];
    dexCard(x,y,cw,ch,i%4);
    if(g){ drawMonAt(g.id, x+cw/2, y+48, 0.72, 1);
      X.fillStyle=DEXC.ink; X.font='bold 10px Georgia'; X.textAlign='center'; X.fillText(dexFitName(g.name,cw-8), x+cw/2, y+52);
      X.fillStyle='#6d5738'; X.font='8px Georgia'; X.fillText('Lv'+g.level+'  ·  '+g.type, x+cw/2, y+64);
      drawHPmini(x+10, y+80, cw-20, g);
      X.fillStyle='#3a2a18'; X.font='7px Georgia'; X.textAlign='center'; X.fillText(Math.ceil(g.hp)+' / '+g.maxHP+' HP', x+cw/2, y+88); X.textAlign='left';
    } else { X.fillStyle='#a89b76'; X.font='italic 10px Georgia'; X.textAlign='center'; X.fillText('— leer —', x+cw/2, y+ch/2-6); X.textAlign='left'; }
  }
  X.fillStyle=DEXC.ink2; X.font='8px Georgia'; X.textAlign='center';
  X.fillText('Im Akh-Lager: '+storage.length+'   ·   ein-/auslagern später am Döner-/Café-Computer', LW/2, LH-13); X.textAlign='left';
}

function renderCatchChoice(){
  X.fillStyle='#181009'; X.fillRect(0,0,LW,LH);
  const bw=224, bh=112, bx=(LW-bw)/2, by=(LH-bh)/2, E=pendingCatch;
  px(X,bx-2,by-2,bw+4,bh+4,'#241a10'); px(X,bx,by,bw,bh,'#efe3c2'); px(X,bx+1,by+1,bw-2,bh-2,'#f6ecce');
  X.textAlign='center'; X.textBaseline='top';
  X.fillStyle='#3a2a18'; X.font='bold 11px Georgia'; X.fillText((E?E.name:'')+' gefangen!', LW/2, by+8);
  X.fillStyle='#6d5738'; X.font='9px Georgia'; X.fillText('Dein Team ist voll. Was tun?', LW/2, by+22);
  if(E) drawMonAt(E.id, LW/2, by+64, 0.6, 1);
  function btn(bx2,label,sel,col){ px(X,bx2,by+bh-22,102,17, sel?col:'#241f18'); px(X,bx2,by+bh-22,102,1, sel?'#fff6d0':'#3a342a'); X.fillStyle= sel?'#ffffff':'#cdbfa6'; X.font='bold 9px Georgia'; X.fillText(label, bx2+51, by+bh-19); }
  btn(bx+8,'Ins Akh-Lager', catchChoiceIdx===0, '#3a6a8a'); btn(bx+bw-110,'Freilassen', catchChoiceIdx===1, '#8a5a2a');
  X.textAlign='left';
}


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
const PUNISHER_IMG=new Image(); PUNISHER_IMG.src=PUNISHER_SRC;
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
function drawBluePunisher(c,cx,cy,s){ c.fillStyle='#2b6fd0'; c.beginPath(); c.moveTo(cx,cy-2*s); c.lineTo(cx+2.6*s,cy-0.4*s); c.lineTo(cx,cy+2*s); c.lineTo(cx-2.6*s,cy-0.4*s); c.closePath(); c.fill();
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
