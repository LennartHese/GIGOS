import { LW, LH, X, reduce } from '../core/constants.js';
import { px } from '../core/canvas.js';
import { hash } from '../core/math.js';
import { G } from '../core/state.js';
import { player } from '../entities/player.js';
import { drawChar, PAL_PLAYER } from '../entities/drawChar.js';
import { setBanner, showBanner } from '../ui/banner.js';
import { toast } from '../ui/toast.js';
import { openDialog } from '../systems/dialogue.js';
import { T, lightCv, Lx, setEnterCool, clearSitting } from '../main.js';

/* ======================================================================
   ALL ABOUT WEST — Café-Innenraum (begehbar)
   ====================================================================== */
const cafeBG=document.createElement('canvas'); cafeBG.width=LW; cafeBG.height=LH;
const cafeSolids=[]; export const cafeNpcs=[], cafeInters=[];
export let cafeReturn={x:272,y:264,dir:'down'};
export function setCafeReturn(p){ cafeReturn=p; }
const CAB={x:14,y:66,x2:306,y2:178};   // begehbarer Boden
const PAL_BARISTA={coat:'#36423a',coatHi:'#46544a',coatLo:'#28322c',pants:'#2f2a26',shoe:'#1a1510',skin:'#e6c2a0',hair:'#241c18'};
const PAL_WAITER1={coat:'#ece6d8',coatHi:'#f6f1e6',coatLo:'#cabfa8',pants:'#33343c',shoe:'#1a1510',skin:'#e8c49c',hair:'#1c1814'};
const PAL_WAITER2={coat:'#e0dccf',coatHi:'#efe9dc',coatLo:'#bcb29a',pants:'#2e2f36',shoe:'#1a1510',skin:'#ecc8a0',hair:'#221a16'};
const PAL_GAST1={coat:'#5d7f8e',coatHi:'#7a9aa8',coatLo:'#46606c',pants:'#3a3f4a',shoe:'#2a2118',skin:'#e8c39a',hair:'#e6c862'};
const PAL_GAST2={coat:'#b5486a',coatHi:'#cf6386',coatLo:'#923a55',pants:'#4a4452',shoe:'#2a2118',skin:'#e8c39a',hair:'#3a2a1a'};

export function buildCafe(){
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
  ['IMMER WENN','DU LACHST,','STIRBT IRG-','WO EIN PRO-','BLEM ♥'].forEach((s,i)=>c.fillText(s,131,29+i*3));
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
  px(c,146,LH-16,32,4,'#1a2126'); c.fillStyle='#cfe0e8'; c.font='6px Georgia'; c.fillText('→ raus',150,LH-22);

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
export function talkBarista(){
  const n=cafeNpcs[0]; openDialog(n.who,n.lines); toast('Flat White aufs Haus ☕',2000);
}
export function enterCafe(){ G.scene='cafe'; clearSitting(); player.x=152; player.y=138; player.dir='up'; player.frame=0;
  setBanner('All About West','Café · Charlottenburg'); showBanner(); setEnterCool(0.5); }
export function exitCafe(){ G.scene='chb'; player.x=cafeReturn.x; player.y=cafeReturn.y; player.dir=cafeReturn.dir; player.frame=0;
  setEnterCool(0.5); setBanner('Charlottenburg-Wilmersdorf','Bezirk'); showBanner(); }
export function blockedCafe(nx,ny){ const fx=nx+4,fy=ny+15,fw=8,fh=6;
  if(fx<CAB.x||fy<CAB.y||fx+fw>CAB.x2||fy+fh>CAB.y2) return true;
  for(const s of cafeSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}
export function renderCafe(){
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
