import { cv, LW, LH } from './constants.js';
import { hash } from './math.js';

/* ---- skalieren auf Fenster (integer, pixelig) ---- */
export function fit(){
  const s=Math.max(1,Math.floor(Math.min(innerWidth/LW,innerHeight/LH)));
  cv.style.width=(LW*s)+'px'; cv.style.height=(LH*s)+'px';
}
addEventListener('resize',fit); fit();

/* ---- dichte, runde Baumkrone (per-Pixel, Licht oben-links) ---- */
export const LEAF_LINDEN={edge:'#2c4a22',lo:'#3c6029',mid:'#4f7d39',hi:'#74a64e',gap:'#b9975e'};
export const LEAF_OAK   ={edge:'#28401e',lo:'#365626',mid:'#487034',hi:'#6e9a44',gap:'#b9975e'};
export function canopy(c,cx,cy,rx,ry,P,seed){ seed=seed||0;
  for(let y=-ry;y<=ry;y++)for(let x=-rx;x<=rx;x++){ const nx=x/rx, ny=y/ry, d=nx*nx+ny*ny; if(d>1)continue;
    const light=(-nx-ny); let col=P.mid;
    if(d>0.80) col=P.edge; else if(light>0.55) col=P.hi; else if(light<-0.45) col=P.lo;
    const r=hash(cx+x+seed,cy+y-seed);
    if(r<0.12) col=(light>0?P.hi:P.lo);
    if(d<0.74 && r>0.987) col=P.gap;
    c.fillStyle=col; c.fillRect((cx+x)|0,(cy+y)|0,1,1);
  }
}
export function px(c,x,y,w,h,col){ c.fillStyle=col; c.fillRect(x|0,y|0,w|0,h|0); }
export function dot(c,x,y,col){ c.fillStyle=col; c.fillRect(x|0,y|0,1,1); }
export function shadow(c,x,y,w,h){ c.fillStyle='rgba(20,18,30,.20)'; c.beginPath(); c.ellipse(x+w/2,y+h,w/2,h/2,0,0,7); c.fill(); }
