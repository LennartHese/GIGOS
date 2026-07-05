import { LW, LH, X, C, reduce } from '../core/constants.js';
import { hash, clamp } from '../core/math.js';
import { G } from '../core/state.js';
import { player } from '../entities/player.js';
import { drawChar, drawSit, PAL_PLAYER } from '../entities/drawChar.js';
import { setBanner, showBanner } from '../ui/banner.js';
import { toast } from '../ui/toast.js';
import { openDialog, openChoice, advanceDialog } from '../systems/dialogue.js';
import { T, lightCv, Lx, setEnterCool } from '../main.js';

/* ======================================================================
   U-BAHN — Fahrt zwischen den Bezirken. Ein Wagon-Innenraum (Einzelbild,
   wie eiche.js), gefuellt mit zufaelligen Fahrgaesten. Sprites/Deko sind
   bewusst als kleine, austauschbare Bausteine gehalten (PAL_*, drawVomit).
   ====================================================================== */

/* ---------- Stationen & Rueckkehrpunkte ---------- */
export const UBAHN_STATIONS = {
  town:      { label:'Zehlendorf Mitte', sub:'Bezirk' },
  chb:       { label:'Charlottenburg-Wilmersdorf', sub:'Bezirk' },
  kl:        { label:'Krumme Lanke', sub:'Zehlendorf, Berlin' },
  mitte:     { label:'Mitte', sub:'High-Level-Bezirk' },
  fhxb:      { label:'Friedrichshain-Kreuzberg', sub:'Der naechste grosse Schritt' },
  tempelhof: { label:'Tempelhof-Schöneberg', sub:'Kirchviertel & Tempelhofer Feld' },
};
export const stationReturn={};
export function setStationReturn(id,p){ stationReturn[id]=p; }

/* ---------- Stations-Schild (ein Zeichner, sechsmal aufgerufen) ---------- */
export function drawUbahnSign(c,x,y){
  c.fillStyle='rgba(20,18,30,.22)'; c.beginPath(); c.ellipse(x+4,y+24,8,3,0,0,7); c.fill();
  c.fillStyle='#2a2a30'; c.fillRect(x+3,y,2,22);
  c.fillStyle='#fff'; c.fillRect(x-5,y-2,18,14);
  c.fillStyle=C.ubahnBlue; c.fillRect(x-4,y-1,16,12);
  c.fillStyle='#fff'; c.font='bold 10px Georgia'; c.fillText('U',x,y+9);
}

/* ---------- Fahrgast-"Sprites" — je ein PAL_* pro Archetyp, leicht ersetzbar ---------- */
const PAL_HOMELESS={coat:'#5a5346',coatHi:'#6e6658',coatLo:'#443f35',pants:'#3a3730',shoe:'#241f1a',skin:'#c9a883',hair:'#4a4038'};
const PAL_RAVER1={coat:'#1a1a1e',coatHi:'#2c2c32',coatLo:'#101013',pants:'#141416',shoe:'#0a0a0c',skin:'#d8b48a',hair:'#0e0c0a'};
const PAL_RAVER2={coat:'#2a1030',coatHi:'#3e1c48',coatLo:'#1a0a20',pants:'#161018',shoe:'#0a0a0c',skin:'#e8c39a',hair:'#caa23a',curly:true};
const PAL_BERLINER1={coat:'#5a6a3a',coatHi:'#728449',coatLo:'#46522c',pants:'#3a3f4a',shoe:'#2a2118',skin:'#e8c39a',hair:'#3a2a1a'};
const PAL_BERLINER2={coat:'#7a3b3b',coatHi:'#9a5252',coatLo:'#5e2c2c',pants:'#3a3328',shoe:'#2a2118',skin:'#ecc8a2',hair:'#cfc7c2'};
const PAL_BERLINER3={coat:'#3a5a8a',coatHi:'#5074aa',coatLo:'#2c4468',pants:'#5a4a36',shoe:'#2a2118',skin:'#d8b48a',hair:'#6a4a2a',curly:true};

const NPC_TYPES=[
  {key:'homeless', label:'Obdachloser', pal:PAL_HOMELESS, weight:2, smell:true,
    lines:['*riecht streng nach Sterni und kaltem Rauch* Haste mal Kleingeld?','Ich will nur bis zur naechsten Station, mehr nich.']},
  {key:'raver1', label:'Raver', pal:PAL_RAVER1, weight:2,
    lines:['*starrt ins Leere, Kopfhoerer droehnen bis hierher*','Bin seit Freitag unterwegs. Welcher Tag is heute eigentlich?']},
  {key:'raver2', label:'Raverin', pal:PAL_RAVER2, weight:2,
    lines:['Harness sitzt, Blick glasig, Vibe on point.','Naechster Stop: wieder rein in den Basement.']},
  {key:'berliner1', label:'Berliner', pal:PAL_BERLINER1, weight:3,
    lines:['Wieder Verspaetung. Klassiker.','Ham Se auch das Gefuehl, dass hier grad jemand nach Kotze riecht?']},
  {key:'berliner2', label:'Berlinerin', pal:PAL_BERLINER2, weight:3,
    lines:['Ick fahr die Linie seit dreissig Jahren, mein Sohn.','Fenster geht hier eh nich auf. Musste durch.']},
  {key:'berliner3', label:'Berliner', pal:PAL_BERLINER3, weight:3,
    lines:['Kopfhoerer vergessen. Muss jetzt wohl zuhoeren.','Naechste ist meine. Oder uebernaechste. Mal schauen.']},
];
const BEG_LINES=['Haste mal ’n Euro?','Kannste mal was abgeben, Digga?','Nur ’ne Mark noch bis Endstation... ach, gibt’s ja nich mehr.'];

function pickWeighted(){ let tot=0; for(const t of NPC_TYPES) tot+=t.weight; let r=Math.random()*tot;
  for(const t of NPC_TYPES){ r-=t.weight; if(r<=0) return t; } return NPC_TYPES[0]; }
function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const tmp=arr[i]; arr[i]=arr[j]; arr[j]=tmp; } return arr; }

/* ---------- Kotze am Boden — eigene Funktion, leicht durch ein Sprite ersetzbar ---------- */
export function drawVomit(c,x,y){
  c.save(); c.translate(x,y);
  c.fillStyle='rgba(150,170,40,0.55)'; c.beginPath(); c.ellipse(0,0,9,4,0,0,7); c.fill();
  c.fillStyle='rgba(120,140,30,0.6)'; c.beginPath(); c.ellipse(-3,-1,4,2,0,0,7); c.fill();
  c.beginPath(); c.ellipse(3,1,3,1.6,0,0,7); c.fill();
  c.fillStyle='rgba(90,60,20,0.5)'; c.fillRect(-1,-1,2,2);
  c.restore();
}

/* ---------- Wagon-Layout ---------- */
const SEAT_X=[26,52,78,104,130,182,208,234,260,286];
const SEAT_SPOTS=[...SEAT_X.map(x=>({x,y:36})), ...SEAT_X.map(x=>({x,y:130}))];
const STANDS=[{x:60,y:80},{x:140,y:65},{x:150,y:110},{x:180,y:80},{x:250,y:100},{x:70,y:105}];
const FLOOR_SPOTS=[{x:50,y:95},{x:70,y:65},{x:140,y:100},{x:180,y:65},{x:250,y:95},{x:270,y:110},{x:120,y:70},{x:200,y:110}];

const ubahnBG=document.createElement('canvas'); ubahnBG.width=LW; ubahnBG.height=LH;
const ubahnSolids=[];
export function buildUbahn(){
  const c=ubahnBG.getContext('2d'); c.imageSmoothingEnabled=false; c.textBaseline='top';
  c.fillStyle='#3a3626'; c.fillRect(0,0,LW,LH);
  c.fillStyle='#4a4636'; c.fillRect(16,30,LW-32,LH-60);
  for(let i=0;i<220;i++){ const x=(16+hash(i,1)*(LW-32))|0, y=(30+hash(i,2)*(LH-60))|0; c.fillStyle=hash(i,3)<.5?'#54503e':'#403c2c'; c.fillRect(x,y,2,1); }
  for(let wx=24;wx<LW-24;wx+=44){
    c.fillStyle='#100e08'; c.fillRect(wx,10,32,18); c.fillStyle='#241f30'; c.fillRect(wx+2,12,28,14);
    c.fillStyle='#100e08'; c.fillRect(wx,LH-28,32,18); c.fillStyle='#241f30'; c.fillRect(wx+2,LH-26,28,14);
  }
  function bench(bx,by,bw){ c.fillStyle='#8a5a3a'; c.fillRect(bx,by,bw,16); c.fillStyle='#a4744f'; c.fillRect(bx,by,bw,3); c.fillStyle='#6e4630'; c.fillRect(bx,by+13,bw,3);
    ubahnSolids.push({x:bx,y:by,w:bw,h:16}); }
  bench(20,34,140); bench(160,34,140); bench(20,128,140); bench(160,128,140);
  function pole(px_,py_){ c.fillStyle='#8a8a90'; c.fillRect(px_,py_,4,40); c.fillStyle='#b4b4ba'; c.fillRect(px_,py_,1,40);
    ubahnSolids.push({x:px_-2,y:py_,w:8,h:40}); }
  pole(96,70); pole(220,70);
  for(let hx=40;hx<LW-40;hx+=40){ c.fillStyle='#5a5a60'; c.fillRect(hx,26,1,8); c.fillStyle='#8a8a90'; c.fillRect(hx-2,32,5,3); }
  ubahnSolids.push({x:0,y:0,w:LW,h:16}); ubahnSolids.push({x:0,y:LH-16,w:LW,h:16});
  ubahnSolids.push({x:0,y:0,w:16,h:LH}); ubahnSolids.push({x:LW-16,y:0,w:16,h:LH});
}
export function blockedUbahn(nx,ny){ const fx=nx+4,fy=ny+15,fw=8,fh=6;
  for(const s of ubahnSolids){ if(fx<s.x+s.w&&fx+fw>s.x&&fy<s.y+s.h&&fy+fh>s.y) return true; }
  return false;
}

/* ---------- Fahrt-Zustand ---------- */
const RIDE_TIME=7.5;
export let ride=null;
export let ubahnDecals=[];

export function openUbahnMenu(fromId){
  const opts=Object.keys(UBAHN_STATIONS).filter(id=>id!==fromId).map(id=>({label:UBAHN_STATIONS[id].label, fn:()=>enterUbahn(fromId,id)}));
  openChoice('U-Bahn-Plan','Wohin soll’s gehen?', opts);
}

export function enterUbahn(fromId,toId){
  advanceDialog();   // schliesst die Stationswahl-Box (Queue ist leer -> setzt G.state zurueck auf 'play')
  G.scene='ubahn'; player.x=156; player.y=86; player.dir='down'; player.frame=0;
  const seatPool=shuffle(SEAT_SPOTS.slice()), standPool=shuffle(STANDS.slice());
  const n=3+((Math.random()*4)|0);
  const passengers=[];
  for(let i=0;i<n;i++){
    const type=pickWeighted(); let spot, seated;
    if(Math.random()<0.6 && seatPool.length){ spot=seatPool.pop(); seated=true; }
    else if(standPool.length){ spot=standPool.pop(); seated=false; }
    else if(seatPool.length){ spot=seatPool.pop(); seated=true; }
    else break;
    passengers.push({ x:spot.x, y:spot.y, seated, dir:'down', frame:0, t:Math.random()*3,
      pal:type.pal, who:type.label, lines:type.lines, smell:!!type.smell, asked:false, key:type.key });
  }
  ride={ from:fromId, to:toId, t:RIDE_TIME,
    fightPlanned: Math.random()<0.14 ? RIDE_TIME*(0.3+Math.random()*0.4) : null, fight:null,
    vomitT: 1.4+Math.random()*1.8, passengers };
  ubahnDecals=[];
  setBanner('U-Bahn','Richtung '+UBAHN_STATIONS[toId].label); showBanner();
  toast('Tueren schliessen. Naechster Halt: '+UBAHN_STATIONS[toId].label,2400);
}

function exitUbahn(){
  const toId=ride.to, ret=stationReturn[toId]||{x:160,y:100,dir:'down'};
  G.scene=toId; player.x=ret.x; player.y=ret.y; player.dir=ret.dir; player.frame=0; setEnterCool(0.6);
  const meta=UBAHN_STATIONS[toId];
  setBanner(meta.label, meta.sub); showBanner(); toast('Ankunft: '+meta.label,2400);
  ride=null; ubahnDecals=[];
}

export function updateUbahn(dt){
  if(!ride) return;
  ride.t-=dt; const elapsed=RIDE_TIME-ride.t;
  ride.vomitT-=dt;
  if(ride.vomitT<=0){ ride.vomitT=1.6+Math.random()*2.2;
    if(ubahnDecals.length<2 && Math.random()<0.3){ const s=FLOOR_SPOTS[(Math.random()*FLOOR_SPOTS.length)|0]; ubahnDecals.push({x:s.x,y:s.y}); } }
  if(ride.fightPlanned!=null && !ride.fight && elapsed>=ride.fightPlanned){
    const eligible=shuffle(ride.passengers.map((p,i)=>i).filter(i=>ride.passengers[i].key!=='homeless'));
    if(eligible.length>=2){
      const a=ride.passengers[eligible[0]], b=ride.passengers[eligible[1]];
      ride.fight={a,b,t:0,dur:2.4,ax:a.x,bx:b.x};
      toast('Zwei Fahrgaeste kriegen sich in die Wolle...',2400);
    }
    ride.fightPlanned=null;
  }
  if(ride.fight){ const F=ride.fight; F.t+=dt;
    F.a.x=F.ax+Math.sin(F.t*26)*3; F.a.frame=1+((F.t*8|0)%2);
    F.b.x=F.bx+Math.sin(F.t*26+Math.PI)*3; F.b.frame=1+((F.t*8|0)%2);
    if(F.t>=F.dur){ F.a.x=F.ax; F.b.x=F.bx; F.a.frame=0; F.b.frame=0; ride.fight=null; toast('Ruhe kehrt ein. Irgendwer murmelt noch vor sich hin.',2200); }
  }
  if(!reduce) for(const p of ride.passengers){ if(!p.seated && (!ride.fight || (ride.fight.a!==p && ride.fight.b!==p))){ p.t+=dt; p.frame=1+((p.t*3|0)%2); } }
  if(G.state==='play'){
    for(const p of ride.passengers){ if(p.smell && !p.asked && Math.abs(p.x+8-(player.x+8))<16 && Math.abs(p.y+10-(player.y+15))<16){
      p.asked=true; openDialog(p.who,[BEG_LINES[(Math.random()*BEG_LINES.length)|0]]); break; } }
  }
  if(ride.t<=0) exitUbahn();
}

export function renderUbahn(){
  X.clearRect(0,0,LW,LH);
  X.drawImage(ubahnBG,0,0);
  if(ride) for(const d of ubahnDecals) drawVomit(X,d.x,d.y);
  const ents=[{y:player.y+22,d:()=>drawChar(X,player.x|0,player.y|0,player.dir,player.frame,PAL_PLAYER)}];
  if(ride) for(const p of ride.passengers) ents.push({y:p.y+(p.seated?14:22), d:()=> p.seated?drawSit(X,p.x|0,p.y|0,p.pal):drawChar(X,p.x|0,p.y|0,p.dir,p.frame||0,p.pal)});
  ents.sort((a,b)=>a.y-b.y); for(const e of ents) e.d();
  drawLightUbahn();
}
function drawLightUbahn(){
  Lx.clearRect(0,0,LW,LH);
  const fl=reduce?1:0.78+0.22*Math.sin(T*9);
  Lx.fillStyle='rgba(150,160,50,0.14)'; Lx.fillRect(0,0,LW,LH);
  let v=Lx.createRadialGradient(LW/2,LH/2,50,LW/2,LH/2,190); v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(10,10,4,0.55)');
  Lx.fillStyle=v; Lx.fillRect(0,0,LW,LH);
  Lx.globalCompositeOperation='lighter';
  Lx.fillStyle='rgba(210,220,80,'+(0.10*fl)+')'; Lx.fillRect(0,0,LW,LH);
  Lx.globalCompositeOperation='source-over';
  X.drawImage(lightCv,0,0);
}
