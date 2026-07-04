import { LW, LH, X } from '../core/constants.js';
import { px } from '../core/canvas.js';
import { clamp } from '../core/math.js';
import { G } from '../core/state.js';
import { GIGODEX } from '../data/gigodex.js';
import { GIGO_TINT } from '../entities/creatures.js';
import { dexSeen, dexCaught, relevelStats } from '../main.js';
import { pendingCatch, openCatchChoice } from './party.js';
import { wrapCenter } from '../world/eiche.js';

// --- evolutionSystem (data-driven: GIGODEX[id].evo = {type,requirement,evolvesTo}) ---
export function readyEvolution(m){ const cfg=GIGODEX[m.id]&&GIGODEX[m.id].evo; if(!cfg) return null;
  if(cfg.type==='level' && m.level>=cfg.requirement) return cfg.evolvesTo;
  if(cfg.type==='item' && typeof hasEvoItem==='function' && hasEvoItem(cfg.requirement)) return cfg.evolvesTo;
  return null; }
export function applyEvolution(m, toId){ const nb=GIGODEX[toId];
  m.id=toId; m.name=nb.name; m.type=nb.type; if(nb.catch) m.catch=nb.catch;
  relevelStats(m); m.hp=m.maxHP; if(nb.moves) m.moves=nb.moves.slice(0,4);
  dexSeen.add(toId); dexCaught.add(toId); }
let evolveState=null;
function easeOutBack(x){ const c1=1.70158, c3=c1+1; return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2); }
export function startEvolution(mon, toId){ evolveState={ mon, from:mon.id, to:toId, t:0, tt:0, phase:'popup', spk:null }; G.state='evolve'; }
function seedSparkles(e){ e.spk=[]; const cols=['#fff7c8','#ffe07a','#bfe8ff','#ffffff','#ffd24a'];
  for(let i=0;i<30;i++) e.spk.push({ ang:Math.random()*6.2832, spd:45+Math.random()*120, size:1+((Math.random()*2)|0), col:cols[i%cols.length], t0:Math.random()*0.12 }); }
function advanceEvo(){ const e=evolveState; if(e&&e.phase==='popup'){ e.phase='charge'; e.t=0; } }
export function updateEvolve(dt){ const e=evolveState; if(!e) return; e.t+=dt; e.tt+=dt;
  if(e.phase==='popup'){ if(e.t>=3.8) advanceEvo(); }
  else if(e.phase==='charge'){ if(e.t>=3.6){ applyEvolution(e.mon,e.to); seedSparkles(e); e.phase='burst'; e.t=0; } }
  else if(e.phase==='burst'){ if(e.t>=0.7){ e.phase='reveal'; e.t=0; } }
  else if(e.phase==='reveal'){ if(e.t>=1.9){ e.phase='wait'; e.t=0; } }
}
export function evolveKey(k){ const e=evolveState; if(!e) return; if(!(k==='e'||k===' '||k==='enter')) return;
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
export function renderEvolve(){ const e=evolveState; if(!e) return; const cx=LW/2;
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
  X.fillText(GIGODEX[e.from].name+'  →  '+GIGODEX[e.to].name+'!', cx, by-4);
  if(e.phase==='wait'){ X.globalAlpha=0.6+0.4*Math.sin(e.tt*6); X.fillStyle='#d8b24a'; X.font='9px Georgia'; X.fillText('E / tippen', cx, by+11); X.globalAlpha=1; }
  X.textAlign='left';
}
