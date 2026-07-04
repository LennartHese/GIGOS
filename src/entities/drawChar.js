import { px } from '../core/canvas.js';
import { C } from '../core/constants.js';

// Cozy-Char-Zeichner (16x22), 4 Richtungen, Geh-Frames
export function drawChar(c,sx,sy,dir,frame,pal){
  const o=pal; const f=frame;
  const lOff=(f===1)?1:(f===2?-1:0); const rOff=-lOff;   // Füße stapfen vor/zurück
  const by=sy+((f===1)?-1:0);                             // Oberkörper wippt 1px
  const nk=o.neck?2:0; const hy=by-nk;                    // langer Hals -> Kopf 2px höher
  // Schatten (bleibt am Boden)
  c.fillStyle='rgba(20,18,30,.22)'; c.beginPath(); c.ellipse(sx+8,sy+22,6,2.4,0,0,7); c.fill();
  // Beine + Füße (am Boden, stapfend)
  px(c,sx+4,sy+16,3,4,o.pants); px(c,sx+9,sy+16,3,4,o.pants);
  px(c,sx+4,sy+20+lOff,3,2,o.shoe); px(c,sx+9,sy+20+rOff,3,2,o.shoe);
  // Körper / Jacke
  px(c,sx+3,by+9,10,8,o.coat); px(c,sx+3,by+9,10,2,o.coatHi); px(c,sx+11,by+9,2,8,o.coatLo);
  // Arme
  px(c,sx+2,by+10,2,5,o.coatLo); px(c,sx+12,by+10,2,5,o.coatLo);
  // Hals (optional, lang)
  if(o.neck){ px(c,sx+6,hy+8,4,nk+1,o.skin); px(c,sx+6,hy+8,1,nk+1,o.skinHi||o.skin); }
  // Kopf
  px(c,sx+4,hy+1,8,8,o.skin); px(c,sx+4,hy+1,8,1,o.skinHi||o.skin);
  // Haare / Mütze
  px(c,sx+3,hy,10,4,o.hair); px(c,sx+3,hy+3,2,3,o.hair); px(c,sx+11,hy+3,2,3,o.hair);
  if(o.curly){ // welliger Lockenkopf-Saum
    px(c,sx+2,hy,2,3,o.hair); px(c,sx+12,hy,2,3,o.hair);
    px(c,sx+5,hy-1,2,2,o.hair); px(c,sx+9,hy-1,2,2,o.hair); px(c,sx+7,hy-1,2,1,o.hair);
  }
  // Bart (optional, z.B. Dönermann)
  if(o.beard && dir!=='up'){ px(c,sx+4,hy+6,8,3,o.beard); px(c,sx+4,hy+5,1,2,o.beard); px(c,sx+11,hy+5,1,2,o.beard); }
  // Gesicht je Richtung
  c.fillStyle=C.ink;
  if(dir==='down'){ c.fillRect(sx+5,hy+5,1,1); c.fillRect(sx+10,hy+5,1,1); }
  else if(dir==='up'){ px(c,sx+3,hy,10,5,o.hair); if(o.curly){ px(c,sx+2,hy,2,3,o.hair); px(c,sx+12,hy,2,3,o.hair);} }
  else if(dir==='left'){ c.fillRect(sx+5,hy+5,1,1); px(c,sx+3,hy,7,4,o.hair); }
  else { c.fillRect(sx+10,hy+5,1,1); px(c,sx+6,hy,7,4,o.hair); }
}
// sitzende Figur (Bank), frontal — Beine angewinkelt nach vorn
export function drawSit(c,sx,sy,o){ sx|=0; sy|=0;
  c.fillStyle='rgba(20,18,30,.20)'; c.beginPath(); c.ellipse(sx+8,sy+15,7,2.5,0,0,7); c.fill();
  px(c,sx+3,sy+10,4,3,o.pants); px(c,sx+9,sy+10,4,3,o.pants);     // Oberschenkel
  px(c,sx+3,sy+13,3,2,o.shoe); px(c,sx+10,sy+13,3,2,o.shoe);      // Schuhe
  px(c,sx+3,sy+5,10,6,o.coat); px(c,sx+3,sy+5,10,1,o.coatHi); px(c,sx+3,sy+10,10,1,o.coatLo); // Torso
  px(c,sx+2,sy+6,2,4,o.coatLo); px(c,sx+12,sy+6,2,4,o.coatLo);    // Arme
  px(c,sx+4,sy,8,6,o.skin); px(c,sx+4,sy,8,1,o.skinHi||o.skin);   // Kopf
  px(c,sx+3,sy-1,10,3,o.hair); px(c,sx+3,sy+1,2,2,o.hair); px(c,sx+11,sy+1,2,2,o.hair);
  if(o.curly){ px(c,sx+2,sy,2,3,o.hair); px(c,sx+12,sy,2,3,o.hair); }
  c.fillStyle='#1a1410'; c.fillRect(sx+5,sy+3,1,1); c.fillRect(sx+9,sy+3,1,1);
}
export const PAL_PLAYER={coat:'#caa23a',coatHi:'#e0bb55',coatLo:'#a07f28',pants:'#3a4a66',shoe:'#2a2118',skin:C.skinA,skinHi:'#f0d0a8',hair:'#5a3a22'};
export const PAL_OMA={coat:'#8a6a8a',coatHi:'#a384a3',coatLo:'#6e526e',pants:'#4a4452',shoe:'#2a2118',skin:'#e8c2a0',hair:'#cfc7c2'};
export const PAL_KID={coat:'#3a8a6a',coatHi:'#4fa080',coatLo:'#2c6e52',pants:'#7a4a2a',shoe:'#2a2118',skin:'#e8c39a',hair:'#3a2a1a'};
// Haze — blond, langer Hals, chilliger Hoodie
export const PAL_HAZE={coat:'#5d7f8e',coatHi:'#7a9aa8',coatLo:'#46606c',pants:'#3a3f4a',shoe:'#2a2118',skin:'#e8c39a',skinHi:'#f0d0a8',hair:'#e6c862',neck:true};
// Passi — blonder Lockenkopf, Berkeley-College-Vibe
export const PAL_PASSI={coat:'#3a5a8a',coatHi:'#5074aa',coatLo:'#2c4468',pants:'#5a4a36',shoe:'#2a2118',skin:'#e8c39a',skinHi:'#f0d0a8',hair:'#e8cc6a',curly:true};
