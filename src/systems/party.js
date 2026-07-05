import { LW, LH, X } from '../core/constants.js';
import { px } from '../core/canvas.js';
import { clamp } from '../core/math.js';
import { G } from '../core/state.js';
import { toast } from '../ui/toast.js';
import { parchmentBG, dexCard, dexFitName, DEXC, drawMonAt } from './dex.js';
import { party } from '../main.js';

/* ======================================================================
   TEAM-SCREEN + AKH-LAGER + Fang-Overflow-Wahl
   Team-Cap = 3. Ueberzaehlige -> Lager (storage) oder freilassen.
   Ein-/Auslagern gegen die Terminals bei Efes und All About West.
   ====================================================================== */
export const storage=[];            // Akh-Lager
export let pendingCatch=null;        // gefangener Akh bei vollem Team
export function setPendingCatch(E){ pendingCatch=E; }
let catchChoiceIdx=0;

export function openTeam(){ G.state='team'; }
export function closeTeam(){ G.state='play'; }
export function teamKey(k){ if(['t','i','q','escape','backspace','b'].includes(k)) closeTeam(); }

export function openCatchChoice(){ G.state='catchChoice'; catchChoiceIdx=0; }
export function catchChoose(keep){ const E=pendingCatch; pendingCatch=null; G.state='play';
  if(keep){ storage.push(E); toast(E.name+' wurde ins Akh-Lager geschickt.',2600); }
  else { toast(E.name+' wurde freigelassen. Alles Gute, kleiner Akh!',2600); }
}
export function catchKey(k){ if(['arrowleft','a','arrowright','d'].includes(k)) catchChoiceIdx=catchChoiceIdx?0:1;
  else if(k==='e'||k===' '||k==='enter') catchChoose(catchChoiceIdx===0); }

function drawHPmini(bx,by,bw,g){ const bh=6; const frac=clamp(g.hp/g.maxHP,0,1); const col=frac>0.5?'#62c64c':frac>0.22?'#e6b93c':'#dc4636';
  px(X,bx-1,by-1,bw+2,bh+2,'#15110c'); px(X,bx,by,bw,bh,'#46443c'); px(X,bx,by,Math.round(bw*frac),bh,col); px(X,bx,by,Math.round(bw*frac),1,'rgba(255,255,255,.3)'); }

export function renderTeam(){
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
  X.fillText('Im Akh-Lager: '+storage.length+'   ·   Ein-/Auslagern am Döner-/Café-Terminal', LW/2, LH-13); X.textAlign='left';
}

/* ======================================================================
   AKH-LAGER-TERMINAL — Team gegen gelagerte Akhs tauschen.
   Aufgerufen am Efes-Computer und am Café-Kiosk.
   ====================================================================== */
const ST_VISROWS=6, ST_ROWH=11;
let stCursor={side:'team', i:0};
let stHeld=null;
let stScroll=0;

function stListLen(){ return storage.length+1; } // +1 = Ablage-Slot am Ende
function stSlotMon(loc){ return loc.side==='team' ? party[loc.i] : storage[loc.i]; }
function stClampScroll(){
  const max=Math.max(0, stListLen()-ST_VISROWS); stScroll=clamp(stScroll,0,max);
  if(stCursor.side==='storage'){
    if(stCursor.i<stScroll) stScroll=stCursor.i;
    else if(stCursor.i>stScroll+ST_VISROWS-1) stScroll=stCursor.i-ST_VISROWS+1;
  }
}
function stDoSwap(a,b){
  if(a.side===b.side && a.i===b.i) return;
  if(a.side==='team' && b.side==='team'){
    if(b.i>=party.length) return;
    const t=party[a.i]; party[a.i]=party[b.i]; party[b.i]=t; return;
  }
  if(a.side==='storage' && b.side==='storage'){
    if(b.i>=storage.length) return;
    const t=storage[a.i]; storage[a.i]=storage[b.i]; storage[b.i]=t; return;
  }
  const teamLoc = a.side==='team'?a:b, stoLoc = a.side==='team'?b:a;
  const teamMon = stSlotMon(teamLoc), stoMon = stSlotMon(stoLoc);
  if(stoMon===undefined){ // Team -> Lager (Ablage-Slot)
    if(stoLoc.i!==storage.length) return;
    if(party.length<=1){ toast('Mindestens ein Akh muss im Team bleiben!',2200); return; }
    storage.push(teamMon); party.splice(teamLoc.i,1);
    toast(teamMon.name+' wurde eingelagert.',1800);
  } else if(teamMon===undefined){ // Lager -> Team (freier Team-Slot)
    if(teamLoc.i!==party.length || party.length>=3) return;
    party.push(stoMon); storage.splice(stoLoc.i,1);
    toast(stoMon.name+' ist jetzt im Team!',1800);
  } else { // direkter Tausch
    party[teamLoc.i]=stoMon; storage[stoLoc.i]=teamMon;
    toast(teamMon.name+' <-> '+stoMon.name+' getauscht.',1800);
  }
}

export function openStorage(){ G.state='storage'; stCursor={side:'team', i:0}; stHeld=null; stScroll=0; }
export function closeStorage(){ G.state='play'; }
export function storageKey(k){
  if(['q','backspace','escape'].includes(k)){ if(stHeld) stHeld=null; else closeStorage(); return; }
  if(['arrowleft','a'].includes(k)){ if(stCursor.side==='team') stCursor.i=Math.max(0,stCursor.i-1); return; }
  if(['arrowright','d'].includes(k)){ if(stCursor.side==='team') stCursor.i=Math.min(2,stCursor.i+1); return; }
  if(['arrowup','w'].includes(k)){
    if(stCursor.side==='storage'){ if(stCursor.i>0) stCursor.i--; else stCursor={side:'team',i:0}; stClampScroll(); }
    return;
  }
  if(['arrowdown','s'].includes(k)){
    if(stCursor.side==='team'){ stCursor={side:'storage', i:0}; stClampScroll(); }
    else if(stCursor.i<stListLen()-1){ stCursor.i++; stClampScroll(); }
    return;
  }
  if(k==='e'||k===' '||k==='enter'){
    const cur={side:stCursor.side, i:stCursor.i};
    if(!stHeld){ const mon=stSlotMon(cur); if(!mon) return; stHeld=cur; }
    else { stDoSwap(stHeld, cur); stHeld=null; }
    return;
  }
}
export function renderStorage(){
  parchmentBG();
  X.textAlign='center'; X.textBaseline='top'; X.fillStyle=DEXC.ink; X.font='bold 12px Georgia';
  X.fillText('Akh-Lager-Terminal', LW/2, 8);
  X.fillStyle=DEXC.ink2; X.font='7px Georgia'; X.fillText('Team gegen gelagerte Akhs tauschen', LW/2, 21);
  X.fillStyle=DEXC.edgeD; X.font='bold 11px Georgia'; X.textAlign='right'; X.fillText('×',LW-8,4); X.textAlign='left';

  // Team-Reihe
  const tcw=88, tgap=6, tx0=(LW-(tcw*3+tgap*2))/2, ty=32, tch=56;
  for(let i=0;i<3;i++){
    const x=tx0+i*(tcw+tgap); const g=party[i];
    const sel = stCursor.side==='team' && stCursor.i===i;
    const isHeld = !!stHeld && stHeld.side==='team' && stHeld.i===i;
    dexCard(x,ty,tcw,tch,i%4);
    if(sel){ X.strokeStyle='#d8b24a'; X.lineWidth=1; X.strokeRect(x+0.5,ty+0.5,tcw-1,tch-1); }
    X.textAlign='center';
    if(g){
      drawMonAt(g.id, x+tcw/2, ty+25, 0.44, isHeld?0.45:1);
      X.fillStyle=DEXC.ink; X.font='bold 8px Georgia'; X.fillText(dexFitName(g.name,tcw-8), x+tcw/2, ty+36);
      X.fillStyle='#6d5738'; X.font='7px Georgia'; X.fillText('Lv'+g.level, x+tcw/2, ty+46);
      drawHPmini(x+8, ty+tch-8, tcw-16, g);
      if(isHeld){ X.fillStyle='#d8b24a'; X.font='bold 7px Georgia'; X.fillText('▲ gewählt', x+tcw/2, ty+2); }
    } else {
      X.fillStyle='#a89b76'; X.font='italic 8px Georgia'; X.fillText('— leer —', x+tcw/2, ty+tch/2-4);
    }
    X.textAlign='left';
  }

  // Lager-Liste
  const ly0=100, lx=16, lw=LW-32;
  X.fillStyle=DEXC.ink2; X.font='7px Georgia'; X.fillText('Gelagert: '+storage.length, lx, ly0-10);
  const listLen=stListLen();
  for(let r=0;r<ST_VISROWS;r++){
    const idx=stScroll+r; if(idx>=listLen) break;
    const y=ly0+r*ST_ROWH; const sel=stCursor.side==='storage' && stCursor.i===idx;
    const isHeld = !!stHeld && stHeld.side==='storage' && stHeld.i===idx;
    const isDeposit = idx===storage.length;
    px(X, lx, y, lw, ST_ROWH-1, sel?'#e7d7ae':'rgba(200,170,110,0.14)');
    if(sel){ X.strokeStyle='#d8b24a'; X.lineWidth=1; X.strokeRect(lx+0.5,y+0.5,lw-1,ST_ROWH-2); }
    if(isDeposit){
      X.fillStyle='#8a7c60'; X.font='italic 8px Georgia'; X.fillText('— hier ablegen —', lx+6, y+2);
    } else {
      const g=storage[idx];
      X.fillStyle= isHeld?'#a8985a':DEXC.ink; X.font='8px Georgia';
      X.fillText((sel?'▸ ':'  ')+g.name+'  Lv'+g.level+'  ·  '+g.type, lx+4, y+2);
      X.textAlign='right'; X.fillText(Math.ceil(g.hp)+'/'+g.maxHP, lx+lw-6, y+2); X.textAlign='left';
    }
  }
  if(stScroll>0){ X.fillStyle=DEXC.edgeD; X.beginPath(); X.moveTo(lx+lw/2-4,ly0-4); X.lineTo(lx+lw/2+4,ly0-4); X.lineTo(lx+lw/2,ly0-9); X.fill(); }
  if(stScroll+ST_VISROWS<listLen){ const yb=ly0+ST_VISROWS*ST_ROWH; X.fillStyle=DEXC.edgeD; X.beginPath(); X.moveTo(lx+lw/2-4,yb+2); X.lineTo(lx+lw/2+4,yb+2); X.lineTo(lx+lw/2,yb+7); X.fill(); }

  X.fillStyle=DEXC.ink2; X.font='7px Georgia'; X.textAlign='center';
  X.fillText(stHeld? 'E: hier ablegen/tauschen  ·  Q: abbrechen' : 'Pfeile: navigieren  ·  E: aufnehmen  ·  Q: schließen', LW/2, LH-11);
  X.textAlign='left';
}

export function renderCatchChoice(){
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
