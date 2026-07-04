import { G } from '../core/state.js';

let dialogQ=[], dialogWho='';
const dlg=document.getElementById('dialog'), dWho=document.getElementById('dWho'), dText=document.getElementById('dText');
let dialogOnEnd=null;
export function openDialog(who,lines,onEnd){ G.state='dialog'; dialogWho=who;
  dialogQ=lines.map(l=> (typeof l==='string')?{who:who,text:l}:{who:(l.who??l.w??who),text:(l.text??l.t)} );
  dialogOnEnd=onEnd||null;
  const f=dialogQ.shift(); dWho.textContent=f.who; dText.textContent=f.text; dlg.style.display='block'; }
export function advanceDialog(){ if(dialogQ.length){ const n=dialogQ.shift(); dWho.textContent=n.who; dText.textContent=n.text; }
  else { dlg.style.display='none'; G.state='play'; const cb=dialogOnEnd; dialogOnEnd=null; if(cb) cb(); } }
// --- Choice-Dialog ---
export let choiceState=null; const dChoicesEl=document.getElementById('dChoices');
export function closeChoice(){ choiceState=null; }
export function openChoice(who,text,choices){ G.state='dialog'; dialogQ=[]; dialogOnEnd=null; dWho.textContent=who; dText.textContent=text; dlg.style.display='block'; choiceState={choices,idx:0}; renderChoices(); }
export function renderChoices(){ if(!dChoicesEl) return; if(!choiceState){ dChoicesEl.style.display='none'; dChoicesEl.innerHTML=''; return; } dChoicesEl.innerHTML=''; dChoicesEl.style.display='block';
  choiceState.choices.forEach((c,i)=>{ const b=document.createElement('div'); b.className='dchoice'+(i===choiceState.idx?' sel':''); b.textContent=(i+1)+'. '+c.label;
    const pick=(e)=>{ if(e){e.preventDefault&&e.preventDefault(); e.stopPropagation&&e.stopPropagation();} pickChoice(i); };
    b.addEventListener('mousedown',pick); b.addEventListener('touchstart',pick,{passive:false}); dChoicesEl.appendChild(b); }); }
export function moveChoice(d){ if(!choiceState) return; const n=choiceState.choices.length; choiceState.idx=(choiceState.idx+d+n)%n; renderChoices(); }
export function pickChoice(i){ if(!choiceState) return; const c=choiceState.choices[i]; if(!c) return; choiceState=null; if(dChoicesEl){ dChoicesEl.style.display='none'; dChoicesEl.innerHTML=''; } c.fn(); }
