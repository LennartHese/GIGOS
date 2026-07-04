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
   (Ein-/Auslagern via Pokecenter-Computer kommt spaeter.)
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
  X.fillText('Im Akh-Lager: '+storage.length+'   ·   ein-/auslagern später am Döner-/Café-Computer', LW/2, LH-13); X.textAlign='left';
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
