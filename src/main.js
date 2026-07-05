"use strict";
/* ======================================================================
   GIGOS · Zehlendorf Mitte  — 2D top-down, eigene Pixel-Art
   Alles prozedural gezeichnet. Keine Fremd-Assets. Licht von oben-links.
   ====================================================================== */
import { LW, LH, WPX, HPX, cv, X, reduce } from './core/constants.js';
import { clamp } from './core/math.js';
import { shadow } from './core/canvas.js';
import { G } from './core/state.js';
import { GIGODEX } from './data/gigodex.js';
import { STARTERS } from './data/starters.js';
import { keys } from './core/input.js';
import { player, movePlayer, facingTo, frontPoint, BASE_SPEED } from './entities/player.js';
import { showBanner } from './ui/banner.js';
import { toast } from './ui/toast.js';
import { openDialog, advanceDialog, choiceState, closeChoice, openChoice, moveChoice, pickChoice } from './systems/dialogue.js';
import { invOpen, inventory, addItem, renderInv, toggleInv } from './systems/inventory.js';
import { DEX_PAGES, dexPage, dexGridGeom, drawBerlinodexIcon, renderDexEntry, openDexEntry, closeDexEntry, dexEntryKey, renderDex, openDex, closeDex, dexKey } from './systems/dex.js';
import { openTeam, closeTeam, teamKey, catchChoose, catchKey, renderTeam, renderCatchChoice, openStorage, closeStorage, storageKey, renderStorage } from './systems/party.js';
import { updateEvolve, evolveKey, renderEvolve } from './systems/evolution.js';
import { battleKey, renderBattle, updateBattle } from './systems/battle.js';
import { shopKey, renderShop } from './systems/shop.js';
import { blockedEfes, buildEfes, enterEfes, exitEfes, talkDoener, renderEfes, tickHealFx } from './world/efes.js';
import { buildCafe, talkBarista, enterCafe, exitCafe, blockedCafe, renderCafe, cafeNpcs, cafeInters } from './world/cafe.js';
import { buildWohnung, enterWohnung, exitWohnung, blockedWohnung, renderWohnung, wohnungNpcs, wohnungInters } from './world/wohnung.js';
import {
  blockedEiche, buildEiche, enterEiche, exitEiche, talkSoeren, renderEiche,
  obenUnlocked, blockedEicheOben, buildEicheOben, renderEicheOben, enterEicheOben, exitEicheOben,
  drawFade, stepCutscene, stepReveal, selectStarter, getStarterPick, grantStarter,
  STC, renderStarterSelect, renderStarterConfirm, starterKey, talkSoerenOben,
} from './world/eiche.js';
import {
  chbInters, chbDoors, chbNpcs, buildCHB, blockedCHB, checkEncounterCHB,
  renderCHB, enterCHB, exitCHB,
} from './world/chb.js';
import {
  klInters, klDoors, buildKL, blockedKL, checkEncounterKL, klJump, startKLJump,
  updateKLJump, renderKL, enterKL, exitKL,
} from './world/kl.js';
import {
  MITPX, MITHPX, mitInters, mitDoors, mitNpcs, buildMitte, blockedMitte,
  checkEncounterMitte, renderMitte, enterMitte, exitMitte,
} from './world/mitte.js';
import {
  clubInters, clubDoors, clubNpcs, buildClub, blockedClub, renderClub, enterClub, exitClub,
  CLUBPX, CLUBHPX, talkOwner, talkBarkeeper, renderClubEnding, clubEndingKey,
} from './world/club.js';
import {
  fxInters, fxDoors, fxNpcs, buildFhxb, blockedFhxb, checkEncounterFhxb, updateFhxbEvents,
  renderFhxb, enterFhxb, exitFhxb, FXPX, FXHPX, talkAnja,
} from './world/fhxb.js';
import {
  tpInters, tpDoors, tpNpcs, buildTempelhof, blockedTempelhof, checkEncounterTempelhof,
  renderTempelhof, enterTempelhof, exitTempelhof, TFPX, TFHPX,
  openBierball, closeBierball, updateBierball, bierballKey, renderBierball,
} from './world/tempelhof.js';
import {
  doors, inters, npcs, cat, raven, buildWorld, blockedTown, checkEncounterTown, renderTown,
  setLastTile,
} from './world/town.js';
import {
  ride, blockedUbahn, buildUbahn, renderUbahn, updateUbahn, openUbahnMenu,
} from './world/ubahn.js';
import {
  blockedSpaeti, buildSpaeti, enterSpaeti, exitSpaeti, talkKiosk, renderSpaeti,
} from './world/spaeti.js';

const LOADSCREEN="assets/images/loadscreen.jpg";

/* ======================================================================
   LICHT — Dämmerung: warmer Tint + Vignette (leicht kalt = creepy) + Glows
   ====================================================================== */
export const lightCv=document.createElement('canvas'); lightCv.width=LW; lightCv.height=LH;
export const Lx=lightCv.getContext('2d');

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
  if(G.state==='storage'){ onKey('e'); return; }
  if(G.state==='catchChoice'){ const p=canvasXY(e); const bw=224,bh=112,bx=(LW-bw)/2,by=(LH-bh)/2;
    if(p.y>=by+bh-22&&p.y<=by+bh-5){ if(p.x>=bx+8&&p.x<=bx+110){ catchChoose(true); return; } if(p.x>=bx+bw-110&&p.x<=bx+bw-8){ catchChoose(false); return; } }
    return;
  }
  if(G.state==='starter'){ const p=canvasXY(e);
    for(let i=0;i<3;i++){ const x=STC.x0+i*(STC.cw+STC.gap); if(p.x>=x&&p.x<=x+STC.cw&&p.y>=STC.y&&p.y<=STC.y+STC.ch){ selectStarter(i); return; } }
    return;
  }
  if(G.state==='starterConfirm'){ const p=canvasXY(e); const bw=210,bh=74,bx=(LW-bw)/2,by=(LH-bh)/2;
    if(p.y>=by+48&&p.y<=by+65){ if(p.x>=bx+8&&p.x<=bx+96){ grantStarter(STARTERS[getStarterPick()].id); return; } if(p.x>=bx+bw-96&&p.x<=bx+bw-8){ G.state='starter'; return; } }
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
  if(G.state==='clubEnding'){ onKey('e'); return; }
  if(G.state==='bierball'){ onKey('e'); return; }
  if(G.state==='battle'){ onKey('e'); return; }
  if(G.state==='play'){ onKey('e'); return; }
}
const _dlgEl=document.getElementById('dialog');
_dlgEl.addEventListener('touchstart',tapProgress,{passive:false}); _dlgEl.addEventListener('mousedown',tapProgress);
cv.addEventListener('touchstart',tapCanvas,{passive:false}); cv.addEventListener('mousedown',tapCanvas);

/* ======================================================================
   STATE — Title / Banner / Dialog / Toast / Encounter
   ====================================================================== */
export let sitting=null;      // {bx,by} wenn der Spieler auf einer Bank sitzt
export function clearSitting(){ sitting=null; }
export let hasLeo=false;      // Leo (Hazes Katze) als geliehener Begleiter nach Sörens Quest
export function setHasLeo(v){ hasLeo=v; }

// --- Heidegluehen Tuersteherin-Gate ---
function gateReject(msg){ closeChoice(); openDialog('Tuersteherin',[msg]); }
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


function onKey(k){
  if(k==='p' && inventory.includes('bluePunisher') && (G.state==='play'||G.state==='battle')){ popPunisher(); return; }
  if(G.state==='team'){ teamKey(k); return; }
  if(G.state==='storage'){ storageKey(k); return; }
  if(G.state==='shop'){ shopKey(k); return; }
  if(G.state==='catchChoice'){ catchKey(k); return; }
  if(G.state==='evolve'){ evolveKey(k); return; }
  if(G.state==='cutscene'||G.state==='reveal') return;
  if(G.state==='starter'||G.state==='starterConfirm'){ starterKey(k); return; }
  if(G.state==='dex'){ dexKey(k); return; }
  if(G.state==='dexEntry'){ dexEntryKey(k); return; }
  if(G.state==='battle'){ battleKey(k); return; }
  if(G.state==='clubEnding'){ clubEndingKey(k); return; }
  if(G.state==='bierball'){ bierballKey(k); return; }
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
    // Akh-Lager-Terminal (schmaler Bereich auf der Theke, Vorrang vor dem Dönermann)
    if(player.dir==='up' && fy<108 && Math.abs(player.x+8-190)<12){ toast('Der Dönermann tippt auf den alten Röhrenmonitor. "Deine Akhs, alle da drin."',2400); openStorage(); return; }
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
  if(G.scene==='ubahn'){
    if(ride) for(const p of ride.passengers){ if(Math.abs(p.x+8-fx)<12 && Math.abs(p.y+16-fy)<14){ chatNPC(p.who,p.lines); return; } }
    return;
  }
  if(G.scene==='spaeti'){
    if(fy<108 && player.x+8>110 && player.x+8<210){ talkKiosk(); return; }
    if(player.y>=132 && Math.abs(player.x+8-160)<26){ exitSpaeti(); return; }
    openDialog('Späti',['Regale voller Getränke, Zigaretten, ein Kühlschrank, der ewig brummt. Typischer Spätkauf-Duft: Kaffee, Reinigungsmittel, ein Hauch Bier.']);
    return;
  }
  if(G.scene==='cafe'){
    if(player.dir==='up' && player.y<92 && player.x+8>30 && player.x+8<150){ talkBarista(); return; }
    if(player.y>=150 && Math.abs(player.x+8-160)<22){ exitCafe(); return; }
    for(const n of cafeNpcs){ if(n.counter) continue; if(Math.abs(n.x+8-fx)<13 && Math.abs(n.y+16-fy)<15){ n.dir=(player.x<n.x?'left':'right'); chatNPC(n.who,n.lines); return; } }
    for(const it of cafeInters){ if(fx>=it.x-2&&fx<=it.x+it.w+2&&fy>=it.y-2&&fy<=it.y+it.h+2){
      if(it.who==='Akh-Lager'){ toast('Der Kiosk-Bildschirm blinkt. "Willkommen im Akh-Lager."',2400); openStorage(); } else { openDialog(it.who,it.lines); } return; } }
    return;
  }
  if(G.scene==='wohnung'){
    if(player.y>=282 && Math.abs(player.x+8-160)<24){ exitWohnung(); return; }
    for(const n of wohnungNpcs){ if(Math.abs(n.x+8-fx)<14 && Math.abs(n.y+16-fy)<16){ chatNPC(n.who,n.lines); return; } }
    for(const it of wohnungInters){ if(fx>=it.x-2&&fx<=it.x+it.w+2&&fy>=it.y-2&&fy<=it.y+it.h+2){ openDialog(it.who,it.lines); return; } }
    return;
  }
  if(G.scene==='chb'){
    for(const d of chbDoors){ if(fx>=d.x-2&&fx<=d.x+d.w+2&&fy>=d.y-2&&fy<=d.y+d.h+2){ if(d.to==='town') exitCHB(); else if(d.to==='cafe') enterCafe(); else if(d.to==='wohnung') enterWohnung(); else if(d.to==='mitte') enterMitte(); else if(d.to==='tempelhof') enterTempelhof(); else if(d.to==='spaeti') enterSpaeti('chb'); return; } }
    for(const n of chbNpcs){ if(Math.abs(n.x+8-fx)<12 && Math.abs(n.y+16-fy)<14){ n.dir=(player.x<n.x?'left':'right'); if(n.talk){ n.talk(); } else { chatNPC(n.who,n.lines); } return; } }
    for(const it of chbInters){ if(fx>=it.x-2&&fx<=it.x+it.w+2&&fy>=it.y-2&&fy<=it.y+it.h+2){ if(it.who==='Bank'){ sitDown(it); } else if(it.who==='U-Bahn'){ openUbahnMenu('chb'); } else { openDialog(it.who,it.lines); } return; } }
    return;
  }
  if(G.scene==='kl'){
    for(const d of klDoors){ if(fx>=d.x-2&&fx<=d.x+d.w+2&&fy>=d.y-2&&fy<=d.y+d.h+2){ if(d.to==='town') exitKL(); return; } }
    for(const it of klInters){ if(fx>=it.x-2&&fx<=it.x+it.w+2&&fy>=it.y-2&&fy<=it.y+it.h+2){ if(it.who==='Sprungbaum'){ startKLJump(); } else if(it.who==='U-Bahn'){ openUbahnMenu('kl'); } else { openDialog(it.who,it.lines); } return; } }
    return;
  }
  if(G.scene==='club'){
    for(const d of clubDoors){ if(fx>=d.x-2&&fx<=d.x+d.w+2&&fy>=d.y-2&&fy<=d.y+d.h+2){ if(d.to==='mitte') exitClub(); return; } }
    for(const n of clubNpcs){ if(Math.abs(n.x+8-fx)<13 && Math.abs(n.y+16-fy)<16){ n.dir=(player.x<n.x?'left':'right');
      if(n.who==='Gnarley Gustav'){ questGustav=true; openDialog(n.who,n.lines); }
      else if(n.who==='Dealer'){ dealerTalk(); }
      else if(n.who==='Owner'){ talkOwner(); }
      else if(n.who==='Barkeeperin'){ talkBarkeeper(); }
      else if(n.talk){ n.talk(); }
      else chatNPC(n.who,n.lines); return; } }
    for(const it of clubInters){ if(fx>=it.x-2&&fx<=it.x+it.w+2&&fy>=it.y-2&&fy<=it.y+it.h+2){ if(it.who==='Karussell'){ sitDown(it); } else { openDialog(it.who,it.lines); } return; } }
    return;
  }
  if(G.scene==='mitte'){
    for(const d of mitDoors){ if(fx>=d.x-2&&fx<=d.x+d.w+2&&fy>=d.y-2&&fy<=d.y+d.h+2){ if(d.to==='chb') exitMitte(); else if(d.to==='fhxb') enterFhxb(); else if(d.to==='club'){ if(clubUnlocked) enterClub(); else gateStart(); } return; } }
    for(const n of mitNpcs){ if(Math.abs(n.x+8-fx)<12 && Math.abs(n.y+16-fy)<14){ n.dir=(player.x<n.x?'left':'right'); if(n.who==='Tuersteherin'){ gateStart(); } else if(n.talk){ n.talk(); } else { chatNPC(n.who,n.lines); } return; } }
    for(const it of mitInters){ if(fx>=it.x-2&&fx<=it.x+it.w+2&&fy>=it.y-2&&fy<=it.y+it.h+2){ if(it.who==='U-Bahn'){ openUbahnMenu('mitte'); } else { openDialog(it.who,it.lines); } return; } }
    return;
  }
  if(G.scene==='fhxb'){
    for(const d of fxDoors){ if(fx>=d.x-2&&fx<=d.x+d.w+2&&fy>=d.y-2&&fy<=d.y+d.h+2){ if(d.to==='mitte') exitFhxb(); return; } }
    for(const n of fxNpcs){ if(Math.abs(n.x+8-fx)<13 && Math.abs(n.y+16-fy)<16){ n.dir=(player.x<n.x?'left':'right');
      if(n.who==='Ayahuasca Anja'){ talkAnja(); } else chatNPC(n.who,n.lines); return; } }
    for(const it of fxInters){ if(fx>=it.x-2&&fx<=it.x+it.w+2&&fy>=it.y-2&&fy<=it.y+it.h+2){ if(it.who==='U-Bahn'){ openUbahnMenu('fhxb'); } else { openDialog(it.who,it.lines); } return; } }
    return;
  }
  if(G.scene==='tempelhof'){
    for(const d of tpDoors){ if(fx>=d.x-2&&fx<=d.x+d.w+2&&fy>=d.y-2&&fy<=d.y+d.h+2){ if(d.to==='chb') exitTempelhof(); else if(d.to==='spaeti') enterSpaeti('tempelhof'); return; } }
    for(const n of tpNpcs){ if(Math.abs(n.x+8-fx)<13 && Math.abs(n.y+16-fy)<16){ n.dir=(player.x<n.x?'left':'right');
      if(n.who==='Bierball-Gastgeber'){ openDialog(n.who,n.lines,()=>openBierball()); } else chatNPC(n.who,n.lines); return; } }
    for(const it of tpInters){ if(fx>=it.x-2&&fx<=it.x+it.w+2&&fy>=it.y-2&&fy<=it.y+it.h+2){ if(it.who==='U-Bahn'){ openUbahnMenu('tempelhof'); } else { openDialog(it.who,it.lines); } return; } }
    return;
  }
  // --- Stadt ---
  for(const d of doors){ if(fx>=d.x-2&&fx<=d.x+d.w+2&&fy>=d.y-2&&fy<=d.y+d.h+2){ if(d.to==='efes') enterEfes(); else if(d.to==='eiche') enterEiche(); else if(d.to==='chb') enterCHB(); else if(d.to==='kl') enterKL(); else if(d.to==='spaeti') enterSpaeti('town'); return; } }
  for(const n of npcs){ if(Math.abs(n.x+8-fx)<12 && Math.abs(n.y+16-fy)<14){ if(n.talk){ n.talk(); } else { n.dir=facingTo(n,player); chatNPC(n.who,n.lines); } return; } }
  if(Math.abs(cat.x+6-fx)<12 && Math.abs(cat.y+8-fy)<12){ openDialog('Katze',['Eine kleine getigerte Katze sitzt auf der warmen Mauer und blinzelt dich langsam an. *schnurr*']); return; }
  for(const it of inters){ if(fx>=it.x-2&&fx<=it.x+it.w+2&&fy>=it.y-2&&fy<=it.y+it.h+2){ if(it.who==='U-Bahn'){ openUbahnMenu('town'); } else { openDialog(it.who,it.lines); } return; } }
}
export let encCool=0;
export function resetAfterBattle(){ encCool=1.5; setLastTile(-1); clastTile=-1; }
export let grassFlash=0;
export function setGrassFlash(v){ grassFlash=v; }

/* ======================================================================
   UPDATE + RENDER
   ====================================================================== */
export let camx=0,camy=0; export let T=0;
function update(dt){
  if(loveAura>0) loveAura-=dt;
  if(mateBuffT>0){ mateBuffT-=dt; if(mateBuffT<=0){ mateBuffT=0; player.speed=BASE_SPEED; toast('Club-Mate-Wirkung lässt nach.',2000); } }
  if(drunk>0) drunk=Math.max(0,drunk-dt);
  if(gateWalk>0){ gateWalk-=dt; player.y-=20*dt; player.step=(player.step||0)+dt*8; player.frame=1+((player.step|0)%2); T+=dt; if(gateWalk<=0){ player.frame=0; enterClub(); } return; }
  if(G.state==='team'||G.state==='catchChoice'||G.state==='storage'||G.state==='clubEnding'||G.state==='shop'){ T+=dt; return; }
  if(G.state==='bierball'){ T+=dt; updateBierball(dt); return; }
  if(G.state==='cutscene'){ T+=dt; stepCutscene(dt); return; }
  if(G.state==='reveal'){ T+=dt; stepReveal(dt); return; }
  if(G.state==='starter'||G.state==='starterConfirm'){ T+=dt; return; }
  if(G.state==='dex'){ T+=dt; return; }
  if(G.state==='dexEntry'){ T+=dt; return; }
  if(G.state==='evolve'){ T+=dt; updateEvolve(dt); return; }
  if(G.state==='battle'){ T+=dt; updateBattle(dt); return; }
  if(invOpen){ T+=dt; return; }
  if(G.state==='play' && G.scene==='town'){
    movePlayer(dt,blockedTown);
    // Eingänge: reinlaufen (kurze Sperre nach dem Rausgehen)
    if(enterCool>0){ enterCool-=dt; }
    else { const fx=player.x+4, fy=player.y+15;
      for(const d of doors){ if(fx<d.x+d.w&&fx+8>d.x&&fy<d.y+d.h&&fy+6>d.y){ if(d.to==='efes'){ enterEfes(); break; } else if(d.to==='eiche'){ enterEiche(); break; } else if(d.to==='chb'){ enterCHB(); break; } else if(d.to==='kl'){ enterKL(); break; } else if(d.to==='spaeti'){ enterSpaeti('town'); break; } } }
    }
    if(encCool>0) encCool-=dt;
    checkEncounterTown();
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
        for(const d of chbDoors){ if(fx<d.x+d.w&&fx+8>d.x&&fy<d.y+d.h&&fy+6>d.y){ if(d.to==='town'){ exitCHB(); break; } else if(d.to==='cafe'){ enterCafe(); break; } else if(d.to==='wohnung'){ enterWohnung(); break; } else if(d.to==='mitte'){ enterMitte(); break; } else if(d.to==='tempelhof'){ enterTempelhof(); break; } else if(d.to==='spaeti'){ enterSpaeti('chb'); break; } } } }
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
      for(const d of mitDoors){ if(fx<d.x+d.w&&fx+8>d.x&&fy<d.y+d.h&&fy+6>d.y){ if(d.to==='chb'){ exitMitte(); break; } else if(d.to==='fhxb'){ enterFhxb(); break; } else if(d.to==='club' && clubUnlocked){ enterClub(); break; } } } }
    if(encCool>0) encCool-=dt;
    checkEncounterMitte();
    mitcamx=clamp(player.x+8-LW/2,0,MITPX-LW); mitcamy=clamp(player.y+16-LH/2,0,MITHPX-LH);
  } else if(G.state==='play' && G.scene==='fhxb'){
    movePlayer(dt,blockedFhxb);
    if(enterCool>0){ enterCool-=dt; }
    else { const fx=player.x+4, fy=player.y+15;
      for(const d of fxDoors){ if(fx<d.x+d.w&&fx+8>d.x&&fy<d.y+d.h&&fy+6>d.y){ if(d.to==='mitte'){ exitFhxb(); break; } } } }
    if(encCool>0) encCool-=dt;
    checkEncounterFhxb();
    updateFhxbEvents(dt);
    fhxbcamx=clamp(player.x+8-LW/2,0,FXPX-LW); fhxbcamy=clamp(player.y+16-LH/2,0,FXHPX-LH);
  } else if(G.state==='play' && G.scene==='tempelhof'){
    movePlayer(dt,blockedTempelhof);
    if(enterCool>0){ enterCool-=dt; }
    else { const fx=player.x+4, fy=player.y+15;
      for(const d of tpDoors){ if(fx<d.x+d.w&&fx+8>d.x&&fy<d.y+d.h&&fy+6>d.y){ if(d.to==='chb'){ exitTempelhof(); break; } else if(d.to==='spaeti'){ enterSpaeti('tempelhof'); break; } } } }
    if(encCool>0) encCool-=dt;
    checkEncounterTempelhof();
    tpcamx=clamp(player.x+8-LW/2,0,TFPX-LW); tpcamy=clamp(player.y+16-LH/2,0,TFHPX-LH);
  } else if(G.state==='play' && G.scene==='ubahn'){
    movePlayer(dt,blockedUbahn);
    updateUbahn(dt);
  } else if(G.state==='play' && G.scene==='spaeti'){
    movePlayer(dt,blockedSpaeti);
    if(player.y>=132 && Math.abs(player.x+8-160)<26){ exitSpaeti(); }
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
  tickHealFx(dt);
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
  if(G.scene==='fhxb'){
    if(!reduce) for(const n of fxNpcs){ if(n.play){ n.t+=dt; n.frame=1+((n.t*3|0)%2); } else if(n.wander){ n.t+=dt; const off=Math.sin(n.t*0.6)*(n.range||16); const tgt=n.base+off; const old=n.x; n.x+=clamp(tgt-n.x,-12*dt,12*dt); n.dir=n.x>old+0.02?'right':n.x<old-0.02?'left':n.dir; n.frame=Math.abs(n.x-old)>0.05?1+((n.t*5|0)%2):0; } }
    fhxbcamx=clamp(player.x+8-LW/2,0,FXPX-LW); fhxbcamy=clamp(player.y+16-LH/2,0,FXHPX-LH);
  }
  if(G.scene==='tempelhof'){
    if(!reduce) for(const n of tpNpcs){ if(n.play){ n.t+=dt; n.frame=1+((n.t*3|0)%2); } else if(n.wander){ n.t+=dt; const off=Math.sin(n.t*0.6)*(n.range||16); const tgt=n.base+off; const old=n.x; n.x+=clamp(tgt-n.x,-12*dt,12*dt); n.dir=n.x>old+0.02?'right':n.x<old-0.02?'left':n.dir; n.frame=Math.abs(n.x-old)>0.05?1+((n.t*5|0)%2):0; } }
    tpcamx=clamp(player.x+8-LW/2,0,TFPX-LW); tpcamy=clamp(player.y+16-LH/2,0,TFHPX-LH);
  }
  T+=dt;
}

const DEXK=4;   // interne Aufloesung fuer den Berlinodex (scharfe Schrift)
function setDexRes(on){
  if(on){ if(cv.width!==LW*DEXK){ cv.width=LW*DEXK; cv.height=LH*DEXK; } X.setTransform(DEXK,0,0,DEXK,0,0); X.imageSmoothingEnabled=true; cv.style.imageRendering='auto'; }
  else { if(cv.width!==LW){ cv.width=LW; cv.height=LH; } X.setTransform(1,0,0,1,0,0); X.imageSmoothingEnabled=false; cv.style.imageRendering='pixelated'; }
}
function render(){ _render(); if(G.state==='play') drawAkhTalerHUD(); if(loveAura>0 && (G.state==='battle'||G.state==='play')) drawLoveAura(); }
function _render(){
  if(G.state==='dex'||G.state==='dexEntry'){ setDexRes(true); if(G.state==='dex') renderDex(); else renderDexEntry(); return; }
  setDexRes(false);
  if(G.state==='team'){ renderTeam(); return; }
  if(G.state==='storage'){ renderStorage(); return; }
  if(G.state==='shop'){ renderShop(); return; }
  if(G.state==='catchChoice'){ renderCatchChoice(); return; }
  if(G.state==='evolve'){ renderEvolve(); return; }
  if(G.state==='clubEnding'){ renderClubEnding(); return; }
  if(G.state==='bierball'){ renderBierball(); return; }
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
  if(G.scene==='fhxb'){ renderFhxb(); return; }
  if(G.scene==='tempelhof'){ renderTempelhof(); return; }
  if(G.scene==='ubahn'){ renderUbahn(); return; }
  if(G.scene==='spaeti'){ renderSpaeti(); return; }
  renderTown();
}

let enterCool=0;
export let ccamx=0, ccamy=0;
export function setCcam(x,y){ ccamx=x; ccamy=y; }
export let klcamx=0, klcamy=0;
export function setKlCam(x,y){ klcamx=x; klcamy=y; }
export let mitcamx=0, mitcamy=0;
export function setMitCam(x,y){ mitcamx=x; mitcamy=y; }
export let clubcamx=0, clubcamy=0;
export function setClubCam(x,y){ clubcamx=x; clubcamy=y; }
export let fhxbcamx=0, fhxbcamy=0;
export function setFhxbCam(x,y){ fhxbcamx=x; fhxbcamy=y; }
export let tpcamx=0, tpcamy=0;
export function setTpCam(x,y){ tpcamx=x; tpcamy=y; }
export function setEnterCool(v){ enterCool=v; }

export let clastTile=-1;
export function setClastTile(v){ clastTile=v; }
function sitDown(it){ sitting={bx:it.x,by:it.y}; player.x=it.x; player.y=it.y-4; player.dir='down'; player.frame=0;
  toast('Du setzt dich. Sonne im Gesicht, kurze Pause. (Bewegen = aufstehen)',2200); }
function standUp(){ if(!sitting) return; player.y=sitting.by+14; player.dir='down'; player.frame=0; sitting=null; }

let _loadTimer=null;
export function showDistrictLoad(src, after){
  const t=document.getElementById('title'), img=document.getElementById('loadImg'), pill=document.getElementById('startpill');
  img.src=src; if(pill) pill.textContent='laedt...';
  t.style.display='flex'; G.state='load';
  clearTimeout(_loadTimer);
  _loadTimer=setTimeout(()=>{ t.style.display='none'; if(pill) pill.textContent='Enter zum Start'; G.state='play'; if(after) after(); }, 1500);
}


/* ======================================================================
   GIGOS — KAMPF- & FANG-SYSTEM
   GIGODEX (alle Gigos, meiste als Stubs draw:null), Moves, Battle-Engine.
   Showpiece: Geeked up Racoon. Spieler-Kaempfer: Leo (Rueckenansicht).
   ====================================================================== */

// ---------- Moves ----------

// ---------- Team / Fang-Inventar / Dex ----------
export const party = [];            // Spieler-Gigos
export const dexSeen = new Set(), dexCaught = new Set();
export let ketaKapseln = 5;
export function useKetaKapsel(){ ketaKapseln--; }
export function setKetaKapseln(v){ ketaKapseln=v; }
export let akhTaler = 0;               // Club-Waehrung, Belohnung fuer den Owner-Sieg
export function addAkhTaler(n){ akhTaler=Math.max(0,akhTaler+n); }

/* ======================================================================
   SPÄTI-WAREN — Club-Mate/Zigaretten/Wein/Sekt/Sterni, gekauft fuer Akh-Taler.
   Keta Kapseln laufen weiter ueber ketaKapseln/setKetaKapseln.
   ====================================================================== */
export const stock={ mate:0, zigaretten:0, wein:0, sekt:0, sterni:0 };
export let drunk=0;                    // >0 = beschwipst, faerbt manche Dialoge
let mateBuffT=0;                        // Restzeit des Club-Mate-Tempo-Buffs
export function useItem(id){
  if(id==='mate'){ if(stock.mate<=0) return; stock.mate--; player.speed=BASE_SPEED*1.35; mateBuffT=300;
    toast('☕ Club-Mate! Für 5 Minuten läufst du etwas schneller.',2400);
  } else if(id==='zigaretten'){ if(stock.zigaretten<=0) return; stock.zigaretten--;
    for(const m of party) m.hp=Math.min(m.maxHP, m.hp+Math.round(m.maxHP*0.10));
    toast('🚬 Zigarette geraucht — dein Team heilt sich um 10% HP.',2400);
  } else if(id==='wein'||id==='sekt'||id==='sterni'){ if(stock[id]<=0) return; stock[id]--; drunk=Math.min(240,drunk+70);
    const nm = id==='wein'?'Wein':id==='sekt'?'Sekt':'Sterni';
    toast('🍷 '+nm+' getrunken. Du fühlst dich... beschwingt.',2400);
  } else return;
  if(invOpen) renderInv();
}
export function chatNPC(who,lines){
  if(Math.random()<0.05){ const n=3+((Math.random()*5)|0); addAkhTaler(n);
    openDialog(who,[...lines,'Ach, hier weisste wat, nimm ein paar Taler.']);
    toast('🪙 +'+n+' Akh-Taler',2000);
  } else openDialog(who,lines);
}
function drawCoinIcon(c,cx,cy){
  c.fillStyle='#8a6a2a'; c.beginPath(); c.ellipse(cx,cy+1,5,4,0,0,7); c.fill();
  c.fillStyle='#e0b23a'; c.beginPath(); c.ellipse(cx,cy,5,4,0,0,7); c.fill();
  c.fillStyle='#f2d878'; c.beginPath(); c.ellipse(cx,cy-1,3,2.4,0,0,7); c.fill();
}
export function drawAkhTalerHUD(){
  const w=54,h=14,x=LW-w-4,y=4;
  X.fillStyle='rgba(20,14,8,.55)'; X.fillRect(x,y,w,h); X.fillStyle='rgba(255,255,255,.12)'; X.fillRect(x,y,w,1);
  drawCoinIcon(X,x+9,y+7);
  X.fillStyle='#f3ecd8'; X.font='bold 9px Georgia'; X.textAlign='left'; X.textBaseline='middle'; X.fillText(''+akhTaler, x+17, y+8);
  X.textAlign='left'; X.textBaseline='alphabetic';
}
export function relevelStats(m){ const b=GIGODEX[m.id]; const f=(s)=>Math.max(1,Math.round(s*(1+0.10*(m.level-1))));
  const oldMax=m.maxHP; const newMax=Math.round(b.hp*(1+0.12*(m.level-1)))+5;
  m.maxHP=newMax; m.hp=Math.min(newMax, Math.max(1,m.hp)+(newMax-oldMax)); m.atk=f(b.atk); m.def=f(b.def); m.spd=f(b.spd); }
let questGustav=false; let gotPunisher=false; export let loveAura=0; let clubUnlocked=false; let gateWalk=0;   // Blue-Punisher-Quest + Club-Gate









const PUNISHER_SRC='assets/images/ui/punisher.png';
export const PUNISHER_IMG=new Image(); PUNISHER_IMG.src=PUNISHER_SRC;


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
  if(!gotPunisher){ gotPunisher=true; addItem('bluePunisher'); addAkhTaler(15);
    openDialog('Typ in Schwarz',['\u00bbGustav schickt dich? ...Aight.\u00ab','Er drueckt dir eine kleine blaue Raute mit Totenkopf in die Hand \u2014 Blue Punisher.','\u00bbEin Teil. Wirf sie ein wenn du bereit bist: druck P. Danach ist alles Liebe \u2014 und dein Team haut +80% zu. Nur so kriegst du den Owner klein.\u00ab','\u00bbHier, noch 15 Akh-Taler obendrauf. Gustav sagt, du sollst dir wat goennen.\u00ab']); return; }
  openDialog('Typ in Schwarz',['\u00bbHaste doch schon. Immer mit der Ruhe, ja?\u00ab','\u00bbEinwerfen mit P. Wenn du bereit bist.\u00ab']); }
export function drawBluePunisher(c,cx,cy,s){ c.fillStyle='#2b6fd0'; c.beginPath(); c.moveTo(cx,cy-2*s); c.lineTo(cx+2.6*s,cy-0.4*s); c.lineTo(cx,cy+2*s); c.lineTo(cx-2.6*s,cy-0.4*s); c.closePath(); c.fill();
  c.fillStyle='#5a9ce8'; c.fillRect(cx-1,(cy-2*s+1)|0,2,1); c.fillStyle='#cfe4fa'; c.fillRect(cx-1,cy-1,2,2); c.fillStyle='#2b6fd0'; c.fillRect(cx-1,cy,1,1); c.fillRect(cx,cy,1,1); }
export function drawPunisherHUD(){ if(!inventory.includes('bluePunisher')) return;
  let tx=18; if(PUNISHER_IMG&&PUNISHER_IMG.width){ const p=X.imageSmoothingEnabled; X.imageSmoothingEnabled=false; X.drawImage(PUNISHER_IMG,5,4,PUNISHER_IMG.width,PUNISHER_IMG.height); X.imageSmoothingEnabled=p; tx=PUNISHER_IMG.width+8; } else drawBluePunisher(X,10,10,3);
  X.fillStyle='#f3ecd8'; X.font='8px Georgia'; X.textAlign='left'; X.textBaseline='top'; X.fillText('[P] poppen',tx,8); }

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
buildFhxb();
buildTempelhof();
buildUbahn();
buildSpaeti();
document.getElementById('loadImg').src=LOADSCREEN;

let last=performance.now();
function loop(now){ let dt=(now-last)/1000; last=now; if(dt>0.05)dt=0.05;
  update(dt); if(G.state!=='title') render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
