import { LW, LH, X } from '../core/constants.js';
import { px } from '../core/canvas.js';
import { clamp } from '../core/math.js';
import { G } from '../core/state.js';
import { MOVES } from '../data/moves.js';
import { GIGODEX } from '../data/gigodex.js';
import { drawGigoStub, drawLeoBack } from '../entities/creatures.js';
import { LEVEL_CAP } from '../data/encounters.js';
import { toast } from '../ui/toast.js';
import { dexSeen, dexCaught, ketaKapseln, useKetaKapsel, loveAura, setGrassFlash, resetAfterBattle, relevelStats, party } from '../main.js';
import { setPendingCatch, pendingCatch, openCatchChoice } from './party.js';
import { readyEvolution, startEvolution } from './evolution.js';

export function makeGigo(id, level){
  const b=GIGODEX[id]; const f=(s)=>Math.max(1,Math.round(s*(1+0.10*(level-1))));
  const maxHP=Math.round(b.hp*(1+0.12*(level-1)))+5; const atk0=f(b.atk);
  return { id, name:b.name, level, maxHP, hp:maxHP, atk:atk0, atk0, def:f(b.def), spd:f(b.spd),
    catch:b.catch||45, type:b.type, moves:(b.moves||['kratzer']).slice(0,4), xp:0, xpNext:xpToNextLevel(level),
    dmgBuff:0, skipChance:0, selfHitChance:0, statusImmune:false };
}
function catchChance(en, bonus){ bonus=bonus||1;
  const hpF=(3*en.maxHP-2*en.hp)/(3*en.maxHP);
  const lvlP=clamp(1-(en.level-1)*0.03,0.3,1);
  return clamp((en.catch/255)*hpF*lvlP*bonus, 0.05, 0.95);
}
function calcDamage(att, def, mv){
  const base=(att.atk*(1+(att.dmgBuff||0))*mv.pow)/(def.def+10);
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
export function kapselAt(c,cx,cy,scale,rot,open){ c.save(); c.translate(cx,cy); if(rot)c.rotate(rot); c.scale(scale,scale); c.translate(-6,-9); if(open>0) ketaOpen(c,0,0); else ketaClosed(c,0,0); c.restore(); }
// Inventar-Icon (24x50)
export function drawKeta(c){
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

// --- levelScaling ---
function xpToNextLevel(level){ return Math.floor(20*Math.pow(level,1.65)); }

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
// Shared XP: das ganze (bewusstlose ausgenommen) Team teilt sich die Erfahrung, nicht nur der Kaempfer
function grantBattleXP(){
  const killer=battle.player, E=battle.enemy;
  const rarity=(GIGODEX[E.id]&&GIGODEX[E.id].rarity)||'common';
  const recipients=party.filter(m=>m.hp>0);
  let killerGain=0; const ups=[];
  for(const m of recipients){
    if(m.xp==null){ m.xp=0; m.xpNext=xpToNextLevel(m.level); }
    const gained=calcXP(E.level, rarity, battle.type||'wild', m.level);
    if(m===killer) killerGain=gained;
    m.xp+=gained;
    while(m.level<LEVEL_CAP && m.xp>=m.xpNext){ m.xp-=m.xpNext; m.level++; relevelStats(m); m.xpNext=xpToNextLevel(m.level); ups.push(m.name+' ist jetzt Level '+m.level+'!'); }
    if(m.level>=LEVEL_CAP) m.xp=0;
    if(!battle.pendingEvo){ const evo=readyEvolution(m); if(evo) battle.pendingEvo={mon:m, to:evo}; }
  }
  battle.queue.push({text:'Dein ganzes Team erhaelt '+killerGain+' XP!'});
  for(const line of ups) battle.queue.push({text:line});
  if(battle.enemyIdx<battle.enemyTeam.length-1){
    battle.queue.push({ text:E.name+' geht zu Boden!', then:()=>{ sendNextEnemy(); } });
  } else {
    const text = battle.type==='wild' ? (E.name+' verzieht sich.') : (E.name+' ist besiegt!');
    battle.queue.push({ text, then:()=>{ battle.over=true; battle.win='win'; } });
  }
}
function sendNextEnemy(){
  battle.enemyIdx++;
  const spec=battle.enemyTeam[battle.enemyIdx];
  const nextE=makeGigo(spec.id, spec.level); dexSeen.add(spec.id);
  battle.enemy=nextE; battle.hpE=nextE.hp; battle.flashE=0; battle.shakeE=0; battle.lungeE=0;
  battle.queue.push({text:(battle.trainerName||'Der Gegner')+' schickt '+nextE.name+' ins Rennen!'});
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
export let caughtRacoon = false;    // Soeren-Quest erfuellt
const caughtGigos = [];      // gefangene
const EN_CX=236, EN_CY=74, PL_CX=72, PL_CY=130, CAP_X=236, CAP_Y=84;
export function startBattle(enemyId, level, ret, type, opts){
  opts=opts||{};
  const active=party.find(m=>m.hp>0);
  if(!active){ toast('Dein Team ist k.o. — heil dich bei Efes!',2400); return false; }
  const team = (opts.team&&opts.team.length) ? opts.team : [{id:enemyId, level}];
  const enemy=makeGigo(team[0].id, team[0].level); dexSeen.add(team[0].id);
  const introText = opts.trainerName ? (opts.trainerName+' fordert dich zum Kampf heraus!') : ('Ein wildes '+enemy.name+' taucht auf!');
  battle={ enemy, player:active, type:type||'wild', enemyTeam:team, enemyIdx:0, trainerName:opts.trainerName||null, onWin:opts.onWin||null,
    phase:'msg', menuIndex:0, moveIndex:0, partyIndex:0, forceSwitch:false, forcedFaint:false, pendingEvo:null,
    queue:[{text:introText}], pending:null,
    ret:ret||G.scene, over:false, win:null,
    hpE:enemy.hp, hpP:active.hp,
    flashE:0, flashP:0, shakeE:0, shakeP:0, lungeP:0, lungeE:0, hitFx:null,
    cap:null, t:0 };
  G.scene='battle'; G.state='battle'; setGrassFlash(0);
  return true;
}
function faintCheck(who, isWho){ // isWho: true=Spieler-seitig
  if(who.hp>0) return;
  if(isWho) battle.queue.push({ text:who.name+' ist k.o.!', then:()=>{ handleFaint(); } });
  else battle.queue.push({ text:who.name+' wurde besiegt!', then:()=>{ grantBattleXP(); } });
}
function buildMove(att, def, mvId, side){
  const mv=MOVES[mvId]; const isP=(side==='p'); const tf=(isP?'E':'P');
  if(att.skipChance>0 && Math.random()<att.skipChance){
    battle.queue.push({text:att.name+' ist zu verpeilt und tut diese Runde gar nichts.'});
    return;
  }
  if(att.selfHitChance>0 && Math.random()<att.selfHitChance){
    battle.queue.push({text:att.name+' dreht komplett durch...', then:()=>{
      const dmg=Math.max(1,Math.round(att.atk*0.4)); att.hp=Math.max(0,att.hp-dmg); battle._dmg=dmg;
      battle['flash'+(isP?'P':'E')]=0.35; battle['shake'+(isP?'P':'E')]=0.4;
    }});
    battle.queue.push({ text:()=>att.name+' verpasst sich selbst '+battle._dmg+' Schaden!', then:()=>{ faintCheck(att, isP); } });
    return;
  }
  battle.queue.push({text:att.name+' setzt '+mv.name+' ein!', then:()=>{ battle['lunge'+(isP?'P':'E')]=1; }});
  if(Math.random()>mv.acc){ battle.queue.push({text:'Daneben!'}); return; }
  if(mv.pow>0){
    battle.queue.push({ text:mv.desc, then:()=>{
      let dmg=calcDamage(att,def,mv); if(isP && loveAura>0) dmg=Math.round(dmg*1.8); def.hp=Math.max(0,def.hp-dmg); battle._dmg=dmg;
      battle['flash'+tf]=0.35; battle['shake'+tf]=0.4; battle['lunge'+(isP?'P':'E')]=1;
      battle.hitFx={ x:(isP?EN_CX:PL_CX), y:(isP?EN_CY:PL_CY), t:0.45, tt:0.45 };
    }});
    battle.queue.push({ text:()=>def.name+' nimmt '+battle._dmg+' Schaden!', then:()=>{ faintCheck(def, !isP); } });
  } else if(mv.eff==='atkdown' || mv.eff==='skip' || mv.eff==='selfhit'){
    if(def.statusImmune){ battle.queue.push({ text:def.name+' ist immun und laesst sich nicht beeindrucken!' }); return; }
    battle.queue.push({ text:mv.desc, then:()=>{
      if(mv.eff==='atkdown') def.atk=Math.max(1,Math.round(def.atk*(1-mv.val)));
      else if(mv.eff==='skip') def.skipChance=mv.val;
      else def.selfHitChance=mv.val;
    }});
    if(mv.eff==='atkdown') battle.queue.push({ text:def.name+' ist eingeschuechtert. Angriff sinkt!' });
  } else if(mv.eff==='teamdmg'){
    const team=isP?party:[battle.enemy];
    battle.queue.push({ text:mv.desc, then:()=>{ for(const m of team) if(m.hp>0) m.dmgBuff=(m.dmgBuff||0)+mv.val; }});
  } else if(mv.eff==='teamheal'){
    const team=isP?party:[battle.enemy];
    battle.queue.push({ text:mv.desc, then:()=>{ for(const m of team){ if(m.hp<=0) continue;
      m.hp=Math.min(m.maxHP, m.hp+Math.round(m.maxHP*mv.val)); m.atk=m.atk0; m.skipChance=0; m.selfHitChance=0; } }});
  } else if(mv.eff==='immune'){
    battle.queue.push({ text:mv.desc, then:()=>{ att.statusImmune=true; }});
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
  useKetaKapsel();
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
  else { setPendingCatch(E); toast('🧪 '+E.name+' gefangen! Dein Team ist voll…',2400); }
}
function endBattle(){
  const ret=battle.ret, win=battle.win, p=battle.player, evo=battle.pendingEvo, onWin=battle.onWin;
  if(win==='lose'){ p.hp=Math.max(1,Math.round(p.maxHP*0.25)); toast('Dein Team ist erschoepft. Heil dich bei Efes!',2800); }
  G.scene=ret; G.state='play'; battle=null; resetAfterBattle();
  if(evo){ startEvolution(evo.mon, evo.to); return; }
  if(pendingCatch){ openCatchChoice(); return; }
  if(win==='win' && onWin){ onWin(); }
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
function selectMenu(i){ if(i===0){ battle.phase='moves'; battle.moveIndex=0; } else if(i===1){ openPartyMenu(false); }
  else if(i===2){ if(battle.type==='trainer'||battle.type==='boss'){ battle.phase='msg'; battle.queue=[{text:'Trainer-Akhs lassen sich nicht fangen!'}]; battle.pending=null; } else startCatch(); }
  else { startFlee(); } }
export function battleKey(k){
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
export function renderBattle(){
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
  if(b.enemyTeam && b.enemyTeam.length>1){ X.fillStyle='#cdbfa6'; X.font='bold 8px Georgia'; X.textAlign='left'; X.fillText('Akh '+(b.enemyIdx+1)+'/'+b.enemyTeam.length, 12, 46); }
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
    const isTrainer=(b.type==='trainer'||b.type==='boss');
    const items=['Kampf','Wechsel', isTrainer?'Fang: —':'Fang ×'+ketaKapseln, 'Flucht']; const mx=LW-150, cw=140;
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
export function updateBattle(dt){
  if(!battle) return; const b=battle; b.t+=dt;
  b.hpE += clamp(b.enemy.hp-b.hpE, -55*dt, 55*dt);
  b.hpP += clamp(b.player.hp-b.hpP, -55*dt, 55*dt);
  for(const k of ['flashE','flashP','shakeE','shakeP','lungeP','lungeE']) if(b[k]>0){ b[k]-=dt*3.2; if(b[k]<0)b[k]=0; }
  if(b.klack>0){ b.klack-=dt*2; if(b.klack<0)b.klack=0; }
  if(b.hitFx){ b.hitFx.t-=dt; if(b.hitFx.t<=0) b.hitFx=null; }
  if(b.cap) stepCatch(dt);
}
