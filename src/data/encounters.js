import { clamp } from '../core/math.js';

// ---------- Wild-Encounter-Tabellen (gewichtet, Level-Range) ----------
export const LEVEL_CAP=67;
export const AREA_CAP={ town:10, kl:10, chb:15, mitte:30, fhxb:45, tempelhof:55 };   // max Wild-Spawn-Level pro Gebiet
export const WILDENC={
  town:[ {id:'racoon',lv:[3,8],w:5}, {id:'kraehe',lv:[3,8],w:3}, {id:'squirrel',lv:[3,8],w:3} ],
  chb:[ {id:'kraehe',lv:[8,15],w:3}, {id:'squirrel',lv:[8,15],w:3} ],
  kl:[ {id:'kraehe',lv:[4,9],w:3}, {id:'squirrel',lv:[4,9],w:3}, {id:'krabbe',lv:[4,9],w:3}, {id:'krabbe2',lv:[8,10],w:1} ],
  mitte:[ {id:'kraehe',lv:[15,20],w:3}, {id:'kraehe2',lv:[20,26],w:3}, {id:'kraehe3',lv:[26,30],w:1},
          {id:'squirrel',lv:[15,20],w:3}, {id:'squirrel2',lv:[20,26],w:3}, {id:'squirrel3',lv:[26,30],w:1} ],
  fhxb:[ {id:'fox',lv:[28,38],w:3}, {id:'kobold',lv:[28,38],w:3}, {id:'rabbit',lv:[26,36],w:3},
         {id:'ecstasy',lv:[30,40],w:2}, {id:'koks',lv:[30,40],w:2}, {id:'hedgehog',lv:[26,36],w:2} ],
  tempelhof:[ {id:'libelle',lv:[35,46],w:3}, {id:'wildschwein',lv:[35,46],w:3}, {id:'goon',lv:[40,50],w:2}, {id:'hedgehog',lv:[35,46],w:2} ],
};
export function rollWild(zone){ const t=WILDENC[zone]||WILDENC.town; const cap=AREA_CAP[zone]||LEVEL_CAP; let tot=0; for(const e of t)tot+=e.w; let r=Math.random()*tot;
  for(const e of t){ r-=e.w; if(r<=0){ let lv=e.lv[0]+((Math.random()*(e.lv[1]-e.lv[0]+1))|0); lv=clamp(lv,3,cap); return {id:e.id,lv}; } }
  return {id:t[0].id, lv:clamp(t[0].lv[0],3,cap)}; }
