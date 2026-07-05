import { LW, LH, X, reduce } from '../core/constants.js';
import { px } from '../core/canvas.js';
import { hash, clamp } from '../core/math.js';
import { G } from '../core/state.js';
import { GIGODEX } from '../data/gigodex.js';
import { STARTERS } from '../data/starters.js';
import { player } from '../entities/player.js';
import { drawChar, PAL_PLAYER } from '../entities/drawChar.js';
import { setBanner, showBanner } from '../ui/banner.js';
import { toast } from '../ui/toast.js';
import { openDialog } from '../systems/dialogue.js';
import { addItem } from '../systems/inventory.js';
import { drawMonAt } from '../systems/dex.js';
import { makeGigo, kapselAt, caughtRacoon } from '../systems/battle.js';
import {
  T, lightCv, Lx, setEnterCool, party, dexSeen, dexCaught,
  hasLeo, setHasLeo, ketaKapseln, setKetaKapseln,
} from '../main.js';
import { cat } from './town.js';

/* ======================================================================
   ZEHLENDORF-EICHE — Innenraum (Sörens Versteck)  [Quest 1]
   ====================================================================== */
const eicheBG=document.createElement('canvas'); eicheBG.width=LW; eicheBG.height=LH;
const eicheSolids=[];
const ELB={x:64,y:78,x2:256,y2:158};
export let eicheReturn={x:368,y:150,dir:'down'};
export function setEicheReturn(p){ eicheReturn=p; }
const soeren={x:148,y:80};
const PAL_SOEREN={coat:'#5a6048',coatHi:'#6e7458',coatLo:'#43472f',pants:'#3a3328',shoe:'#2a2118',skin:'#d8bfa0',hair:'#241c14',beard:'#2a2018'};

export function blockedEiche(nx,ny){ const fx=nx+4,fy=ny+15,fw=8,fh=6;
  if(fx<ELB.x||fy<ELB.y||fx+fw>ELB.x2||fy+fh>ELB.y2) return true;
  for(const s of eicheSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}

export function buildEiche(){
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

export function enterEiche(){ G.scene='eiche'; player.x=152; player.y=120; player.dir='up'; player.frame=0;
  setBanner('Zehlendorf-Eiche','In der Eiche'); showBanner(); setEnterCool(0.5); }
export function exitEiche(){ G.scene='town'; player.x=eicheReturn.x; player.y=eicheReturn.y; player.dir=eicheReturn.dir; player.frame=0;
  setEnterCool(0.5); setBanner('Zehlendorf Mitte','Bezirk'); }

function giveLeo(){ setHasLeo(true); cat.x=eicheReturn.x-4; cat.y=eicheReturn.y+12; cat.dir='up';
  if(!party.length) party.push(makeGigo('leo',5));
  setKetaKapseln(Math.max(ketaKapseln,5)); addItem('keta');
  toast('Leo schließt sich dir an — plus 5 Keta Kapseln. Bring Leo unversehrt zurück!',3200); }

export function talkSoeren(){
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

export function renderEiche(){
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
   QUEST-ABSCHLUSS — Sörens Vision, Eichen-Obergeschoss, Starter-Wahl
   ====================================================================== */

// ---------- Eiche · Obergeschoss (Geheimkammer) ----------
const eicheObenBG=document.createElement('canvas'); eicheObenBG.width=LW; eicheObenBG.height=LH;
const eicheObenSolids=[];
let obenBuilt=false; export let obenUnlocked=false;
export function blockedEicheOben(fx,fy,fw,fh){ for(const s of eicheObenSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; } return false; }
function domeInc(c,cx,base,tint){
  c.fillStyle='#4a3320'; c.fillRect(cx-12,base,24,12); c.fillStyle='#5c4028'; c.fillRect(cx-12,base,24,3); c.fillStyle='#6e4e30'; c.fillRect(cx-13,base+11,26,3);
  c.save(); c.fillStyle=tint; c.globalAlpha=0.45; c.beginPath(); c.ellipse(cx,base-8,9,11,0,0,7); c.fill(); c.restore();
  kapselAt(c, cx, base-6, 0.85, 0, 0);
  c.fillStyle='rgba(205,228,238,.26)'; c.beginPath(); c.ellipse(cx,base-6,12,15,0,Math.PI,0); c.fill();
  c.strokeStyle='rgba(225,242,250,.5)'; c.lineWidth=1; c.beginPath(); c.ellipse(cx,base-6,12,15,0,Math.PI,0); c.stroke();
  c.fillStyle='#cdb88c'; c.fillRect(cx-13,base-6,26,2);
  c.fillStyle='rgba(255,255,255,.4)'; c.fillRect(cx-6,base-16,2,7);
}
export function buildEicheOben(){
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

export function renderEicheOben(){
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

export function enterEicheOben(){ G.scene='eicheOben'; player.x=150; player.y=140; player.dir='up'; player.frame=0;
  setBanner('Eiche · Obergeschoss','Sörens Geheimkammer'); showBanner(); setEnterCool(0.6); }
export function exitEicheOben(){ G.scene='eiche'; player.x=152; player.y=118; player.dir='up'; player.frame=0; setEnterCool(0.6); setBanner('Zehlendorf-Eiche','In der Eiche'); }

// ---------- Cutscene: mit Sören nach hinten laufen -> Fade -> oben ----------
function startEicheClimb(){ obenUnlocked=true; G.state='cutscene'; cutscene={phase:'walk',t:0}; fadeAlpha=0; }
export function drawFade(){ if(fadeAlpha>0){ X.fillStyle='rgba(0,0,0,'+fadeAlpha+')'; X.fillRect(0,0,LW,LH); }
  if(cutscene && cutscene.phase==='walk'){ X.fillStyle='rgba(0,0,0,.5)'; X.fillRect(0,LH-20,LW,20); X.fillStyle='#e8dcc0'; X.font='9px Georgia'; X.textAlign='center'; X.textBaseline='top'; X.fillText('Du folgst Sören tiefer in die Eiche…', LW/2, LH-15); X.textAlign='left'; } }
export function stepCutscene(dt){ const c=cutscene; if(!c) return; c.t+=dt;
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
export function stepReveal(dt){ const R=reveal; if(!R) return; R.t+=dt; const i=R.i; const s=STARTERS[i];
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
export function selectStarter(i){ starterIndex=i; starterPick=i; confirmIdx=0; G.state='starterConfirm'; }
export function getStarterPick(){ return starterPick; }
export function grantStarter(id){
  for(let i=party.length-1;i>=0;i--) if(party[i].id==='leo') party.splice(i,1);   // Leo zurück
  party.push(makeGigo(id,5)); setHasLeo(false); starterChosen=id; starterMons=null; reveal=null;
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
export function wrapCenter(t,cx,y,maxw,lh){ const words=(''+t).split(' '); let line='',yy=y; for(const wd of words){ const tt=line?line+' '+wd:wd; if(X.measureText(tt).width>maxw){ X.fillText(line,cx,yy); line=wd; yy+=lh;} else line=tt; } if(line) X.fillText(line,cx,yy); }
export const STC={ x0:(LW-(92*3+11*2))/2, cw:92, gap:11, y:30, ch:118 };
export function renderStarterSelect(){
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
export function renderStarterConfirm(){
  renderStarterSelect(); X.fillStyle='rgba(8,6,3,.55)'; X.fillRect(0,0,LW,LH);
  const bw=210, bh=74, bx=(LW-bw)/2, by=(LH-bh)/2, g=GIGODEX[STARTERS[starterPick].id];
  px(X,bx-2,by-2,bw+4,bh+4,'#241a10'); px(X,bx,by,bw,bh,'#efe3c2'); px(X,bx+1,by+1,bw-2,bh-2,'#f6ecce');
  X.fillStyle='#3a2a18'; X.font='bold 12px Georgia'; X.textAlign='center'; X.textBaseline='top';
  X.fillText('Du nimmst wirklich', LW/2, by+13); X.fillText(g.name+'?', LW/2, by+28);
  function btn(bx2,label,sel,col){ px(X,bx2,by+48,88,17, sel?col:'#241f18'); px(X,bx2,by+48,88,1, sel?'#fff6d0':'#3a342a'); X.fillStyle= sel?'#ffffff':'#cdbfa6'; X.font='bold 10px Georgia'; X.fillText(label, bx2+44, by+51); }
  btn(bx+8,'Yessirski', confirmIdx===0, '#3a7a3a'); btn(bx+bw-96,'Nahh Blud', confirmIdx===1, '#9a3a3a');
  X.textAlign='left';
}
export function starterKey(k){
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
export function talkSoerenOben(){ if(!starterChosen) startStarterReveal(); else soerenTeaser(); }
function soerenTeaser(){ openDialog('Sören',[
  {w:'Sören',t:'Zieh los, mein Sohn. Die Spur des Crack Mage führt hinaus aus Zehlendorf.'},
  {w:'Sören',t:'Charlottenburg, Wilmersdorf… und weiter. Fang die Akhs, fülle den Berlinodex. Ich melde mich, wenn ich mehr sehe. HEHEHA!'},
]); }
