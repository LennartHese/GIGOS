import { TILE } from '../core/constants.js';
import { keys } from '../core/input.js';

export const player={x:16*TILE, y:11*TILE, dir:'down', frame:0, step:0, speed:54};

export function movePlayer(dt,blockFn){
  let dx=0,dy=0;
  if(keys['w']||keys['arrowup']) dy=-1; else if(keys['s']||keys['arrowdown']) dy=1;
  if(keys['a']||keys['arrowleft']) dx=-1; else if(keys['d']||keys['arrowright']) dx=1;
  if(dx&&dy){ dx*=0.7071; dy*=0.7071; }
  if(dx||dy){ player.dir=(Math.abs(dx)>Math.abs(dy))?(dx>0?'right':'left'):(dy>0?'down':'up');
    const sp=player.speed*dt;
    let nx=player.x+dx*sp; if(!blockFn(nx,player.y)) player.x=nx;
    let ny=player.y+dy*sp; if(!blockFn(player.x,ny)) player.y=ny;
    player.step+=dt*8; player.frame=1+((player.step|0)%2);
  } else player.frame=0;
}

export function facingTo(a,b){ const dx=b.x-a.x, dy=b.y-a.y; if(Math.abs(dx)>Math.abs(dy)) return dx>0?'right':'left'; return dy>0?'down':'up'; }

/* Interaktion: Punkt vor dem Spieler prüfen */
export function frontPoint(){ return {
  fx: player.x+8 + (player.dir==='left'?-12:player.dir==='right'?12:0),
  fy: player.y+16+ (player.dir==='up'?-12:player.dir==='down'?12:0) }; }
