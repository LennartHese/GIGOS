import { LW, LH, TILE, MAPW, MAPH, WPX, HPX, X, C, reduce } from '../core/constants.js';
import { hash, clamp, pick } from '../core/math.js';
import { LEAF_LINDEN, LEAF_OAK, canopy, px, shadow } from '../core/canvas.js';
import { G } from '../core/state.js';
import { player, facingTo } from '../entities/player.js';
import { drawChar, PAL_PLAYER, PAL_OMA, PAL_KID, PAL_HAZE, PAL_PASSI } from '../entities/drawChar.js';
import { toast } from '../ui/toast.js';
import { openDialog } from '../systems/dialogue.js';
import { addItem } from '../systems/inventory.js';
import { rollWild } from '../data/encounters.js';
import { startBattle } from '../systems/battle.js';
import { setEfesReturn } from './efes.js';
import { setEicheReturn } from './eiche.js';
import {
  T, lightCv, Lx, encCool, grassFlash, setGrassFlash, camx, camy,
} from '../main.js';

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
export const inters=[];   // {x,y,w,h,who,lines}
export const doors=[];    // {x,y,w,h,to}  Eingänge (Auto-Enter)
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

function efesBuilding(tx,ty){ const x=tx*TILE,y=ty*TILE,w=56,h=38; const b=y+h;
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
export function buildWorld(){
  paintGround();
  // Rand: dichter, leicht nebliger Baumgürtel
  for(let x=0;x<MAPW;x++){ const _gate=(x===15||x===16); if(!_gate){ hedge(x,0); hedge(x,1); } hedge(x,MAPH-1); }
  for(let y=2;y<MAPH-1;y++){ if(!(y===14||y===15)) hedge(0,y); hedge(MAPW-1,y); }

  // Park-West Bäume + ein Reh-Versteck (hohes Gras schon im Boden)
  linden(2,6,true); linden(7,2,true); linden(3,2,false);

  rathaus(11,3);
  eiche(22,7);

  // Süd-Läden
  baeckerei(5,19); spaeti(13,19); blumen(20,19); efesBuilding(24,19);

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
export const npcs=[
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
export const raven={x:2*TILE+22,y:18*TILE+2,caw:0};

// --- Quest-NPCs: Haze (südlich vom Efes) & Passi (links unten) ---
const haze={x:388,y:356,dir:'up',pal:PAL_HAZE,who:'Haze',frame:0,talk:()=>hazeTalk()};
const passi={x:44,y:344,dir:'right',pal:PAL_PASSI,who:'Passi',frame:0,talk:()=>passiTalk()};
npcs.push(haze,passi);

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

/* ======================================================================
   COLLISION
   ====================================================================== */
export function blockedTown(nx,ny){ // Stadt-Fußbox
  const fx=nx+4, fy=ny+15, fw=8, fh=6;
  if(fx<TILE||fy<TILE||fx+fw>WPX-TILE||fy+fh>HPX-TILE) return true;
  for(const s of solids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}
/* ======================================================================
   ENCOUNTER (Stub — Battle-Engine kommt portiert in der nächsten Runde)
   ====================================================================== */
const WILD=['Rave-Ratte','U-Bahn-Taube','Späti-Waschbär','Parkdackel','Currywurst-Wurm'];
let lastTile=-1;
export function setLastTile(v){ lastTile=v; }
export function checkEncounterTown(){
  const tx=(player.x+8)/TILE|0, ty=(player.y+16)/TILE|0;
  const t=ground[gi(clamp(tx,0,MAPW-1),clamp(ty,0,MAPH-1))];
  const onTall=(t===7);
  if(onTall){ // beim Betreten neuer Tile-Position würfeln
    const id=ty*MAPW+tx;
    if(id!==lastTile && encCool<=0){ lastTile=id;
      if(Math.random()<0.22){ const w=rollWild('town'); setGrassFlash(0.5); startBattle(w.id,w.lv,'town'); }
    }
  } else lastTile=-1;
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
   LICHT — Dämmerung: warmer Tint + Vignette (leicht kalt = creepy) + Glows
   ====================================================================== */
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

export function renderTown(){
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
