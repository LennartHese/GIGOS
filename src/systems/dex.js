import { LW, LH, X } from '../core/constants.js';
import { px } from '../core/canvas.js';
import { G } from '../core/state.js';
import { GIGODEX } from '../data/gigodex.js';
import { GIGO_IMG, GIGO_TINT } from '../entities/creatures.js';
import { dexSeen, dexCaught, T } from '../main.js';

/* ======================================================================
   BERLINODEX — Album, eine Seite pro Bezirk.
   Zustaende je Akh: locked (?)  |  seen (graue Silhouette)  |  caught (Farbe)
   Bezirks-Listen (gigos) werden von Don spaeter befuellt. Aktuell nur racoon.
   ====================================================================== */
export const DEX_PAGES=[
  { key:'zehlendorf', name:'Zehlendorf', gigos:['racoon','kraehe','kraehe2','kraehe3','squirrel','squirrel2','squirrel3'] },
  { key:'chb', name:'Charlottenburg-Wilmersdorf', gigos:['kraehe','kraehe2','kraehe3','squirrel','squirrel2','squirrel3'] },
  { key:'kl', name:'Krumme Lanke', gigos:['krabbe','krabbe2'] },
];
const DEX_SLOTS=9;   // Kaechen pro Seite (3x3)
export let dexPage=0;

export const DEXC={ paper:'#e9dcba', paperHi:'#f3e9cf', paperLo:'#dcc99e', edge:'#b79358', edgeD:'#8a6a3a', ink:'#4a3a26', ink2:'#6d5738',
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
export function parchmentBG(){
  const g=X.createLinearGradient(0,0,0,LH); g.addColorStop(0,DEXC.paperHi); g.addColorStop(0.5,DEXC.paper); g.addColorStop(1,DEXC.paperLo);
  X.fillStyle=g; X.fillRect(0,0,LW,LH);
  X.fillStyle='rgba(150,120,70,.10)'; for(const s of [[40,60,16],[250,40,14],[90,140,20],[280,150,12],[170,90,10]]){ X.beginPath(); X.ellipse(s[0],s[1],s[2],s[2]*0.7,0,0,7); X.fill(); }
  X.strokeStyle=DEXC.edgeD; X.lineWidth=1; X.strokeRect(5.5,5.5,LW-11,LH-11);
  X.strokeStyle=DEXC.edge; X.strokeRect(8.5,8.5,LW-17,LH-17);
  dexCorner(10,10,1,1); dexCorner(LW-11,10,-1,1); dexCorner(10,LH-11,1,-1); dexCorner(LW-11,LH-11,-1,-1);
  dexFlower(20,150,DEXC.petalP); dexLeaf(22,150); dexFlower(16,90,DEXC.petalY); dexFlower(304,150,DEXC.petalP);
  dexCoffee(290,120); dexCoffee(14,26);
}
export function dexCard(x,y,w,h,deco){
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
export function dexFitName(nm,maxw){ X.font='7px Georgia'; if(X.measureText(nm).width<=maxw) return nm; let s=nm; while(s.length>3 && X.measureText(s+'…').width>maxw) s=s.slice(0,-1); return s+'…'; }

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
export function drawBerlinodexIcon(c,ox,oy){ const x=v=>ox+v,y=v=>oy+v;
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
export let dexGridGeom={gx0:16,gy0:60,cw:96,ch:33};
let dexEntryId=null, dexEntryShiny=false;
function bdWrap(txt,x,y,maxw,lh){ const words=(''+txt).split(' '); let line='',yy=y;
  for(const wd of words){ const tt=line?line+' '+wd:wd; if(X.measureText(tt).width>maxw){ X.fillText(line,x,yy); line=wd; yy+=lh; } else line=tt; }
  if(line){ X.fillText(line,x,yy); yy+=lh; } return yy; }
function dexFoundList(id){ const out=[]; for(const p of DEX_PAGES){ if(p.gigos.includes(id)) out.push(p.name); } return out; }
export function openDexEntry(id){ dexEntryId=id; dexEntryShiny=false; G.state='dexEntry'; }
export function closeDexEntry(){ G.state='dex'; }
export function dexEntryKey(k){ if(['b','i','q','escape','backspace'].includes(k)) closeDexEntry();
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
export function renderDexEntry(){
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
export function renderDex(){
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
export function openDex(){ dexPage=0; G.state='dex'; }
export function closeDex(){ G.state='play'; }
export function dexKey(k){
  if(['arrowright','d'].includes(k)) dexPage=(dexPage+1)%DEX_PAGES.length;
  else if(['arrowleft','a'].includes(k)) dexPage=(dexPage+DEX_PAGES.length-1)%DEX_PAGES.length;
  else if(['b','i','q','escape','backspace'].includes(k)) closeDex();
}

export function drawMonAt(id,cx,cy,s,a){ const g=GIGODEX[id]; if(!g||!g.draw) return; X.save(); if(a!=null)X.globalAlpha=a; X.translate(cx,cy); X.scale(s,s); X.translate(-24,-44); g.draw(X,0,0,T); X.restore(); }
