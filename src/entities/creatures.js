import { px } from '../core/canvas.js';
import { GIGODEX } from '../data/gigodex.js';

// ---------- Sprite: Geeked up Racoon ----------
export const RAC={ out:'#221f1c', dk:'#34302a', gy:'#5f574d', gyH:'#776d61', gyL:'#4a443c',
  bel:'#8d8276', belH:'#9a9184', crm:'#cdbfa6', ipk:'#b1948a', eye:'#0d0b0a',
  rim:'#a85742', rimD:'#7e3f30', wht:'#efe9da', nos:'#171311', pap:'#d9caa1', emb:'#ec6a32', smk:'#8c9a57' };
export function drawRacoonBattle(c, ox, oy, t){
  t=t||0; const x=(v)=>ox+v, y=(v)=>oy+v; const P=RAC;
  c.fillStyle='rgba(20,18,14,.25)'; c.beginPath(); c.ellipse(ox+23,oy+46,17,3,0,0,7); c.fill();
  for(const a of [[31,33,9,9],[33,29,10,8],[36,25,10,8],[39,22,8,8]]) px(c,x(a[0]),y(a[1]),a[2],a[3],P.out);
  px(c,x(32),y(34),8,5,P.gy); px(c,x(32),y(34),8,1,P.gyH); px(c,x(34),y(30),9,4,P.dk);
  px(c,x(37),y(26),8,4,P.gy); px(c,x(37),y(26),8,1,P.gyH); px(c,x(40),y(23),6,4,P.dk);
  px(c,x(42),y(22),4,3,P.gyH); px(c,x(45),y(23),1,3,P.out); px(c,x(31),y(38),1,2,P.out);
  const br=[[25,15,17],[27,13,21],[29,12,23],[31,12,23],[33,12,23],[35,13,21],[37,14,19],[39,16,15],[41,18,12]];
  for(const r of br) px(c,x(r[1]),y(r[0]),r[2],2,P.out);
  for(const r of br) px(c,x(r[1]+1),y(r[0]),r[2]-2,2,P.gy);
  px(c,x(18),y(29),11,11,P.bel); px(c,x(19),y(29),9,2,P.belH);
  px(c,x(13),y(28),2,7,P.gyL); px(c,x(31),y(28),2,7,P.gyL);
  px(c,x(16),y(40),6,3,P.out); px(c,x(25),y(40),6,3,P.out);
  px(c,x(17),y(41),4,2,P.dk); px(c,x(26),y(41),4,2,P.dk);
  px(c,x(15),y(30),5,7,P.gy); px(c,x(27),y(30),5,7,P.gy);
  px(c,x(17),y(34),6,4,P.dk); px(c,x(24),y(34),6,4,P.dk); px(c,x(21),y(35),5,3,P.dk);
  px(c,x(22),y(33),6,2,P.pap); px(c,x(21),y(34),5,2,P.pap);
  px(c,x(20),y(35),2,2,P.emb); px(c,x(20),y(35),1,1,'#ffd27a');
  const hr=[[9,15,18],[11,13,22],[13,11,26],[15,10,28],[17,10,28],[19,11,26],[21,12,24],[23,13,22],[25,15,18]];
  for(const r of hr) px(c,x(r[1]),y(r[0]),r[2],2,P.out);
  for(const r of hr) px(c,x(r[1]+1),y(r[0]),r[2]-2,2,P.gy);
  px(c,x(12),y(10),24,2,P.gyH); px(c,x(9),y(15),1,3,P.gy); px(c,x(38),y(15),1,3,P.gy);
  px(c,x(11),y(3),9,9,P.out); px(c,x(28),y(3),9,9,P.out);
  px(c,x(12),y(4),7,7,P.dk); px(c,x(29),y(4),7,7,P.dk);
  px(c,x(14),y(5),4,4,P.ipk); px(c,x(30),y(5),4,4,P.ipk);
  px(c,x(13),y(3),3,2,P.gyH); px(c,x(32),y(3),3,2,P.gyH);
  px(c,x(13),y(12),8,2,P.crm); px(c,x(27),y(12),8,2,P.crm);
  px(c,x(12),y(13),3,2,P.crm); px(c,x(33),y(13),3,2,P.crm);
  px(c,x(12),y(13),11,9,P.dk); px(c,x(25),y(13),11,9,P.dk); px(c,x(22),y(14),4,5,P.gy);
  function eyeAt(ex){ px(c,x(ex),y(14),8,7,P.rim); px(c,x(ex+1),y(14),6,6,P.eye);
    px(c,x(ex+1),y(14),1,1,P.rim); px(c,x(ex+6),y(14),1,1,P.rim);
    px(c,x(ex+1),y(19),1,1,P.rim); px(c,x(ex+6),y(19),1,1,P.rim);
    px(c,x(ex+2),y(15),2,2,P.wht); px(c,x(ex+1),y(20),6,1,P.rimD); }
  eyeAt(14); eyeAt(26);
  px(c,x(20),y(20),8,6,P.bel); px(c,x(20),y(20),8,1,P.belH);
  px(c,x(22),y(21),4,3,P.nos); px(c,x(22),y(21),1,1,'#3a3330'); px(c,x(23),y(24),2,3,P.wht);
  c.fillStyle=P.smk;
  function wisp(bx){ for(let i=0;i<5;i++){ const yy=oy+2-i*3; const xx=ox+bx+Math.round(Math.sin(i*1.1+t*2)*2); c.fillRect(xx,yy,1,2);} }
  wisp(19); wisp(28);
}

// ---------- Sprite: Leo (Spieler-Kaempfer, Rueckenansicht) ----------
export const LEOP={ out:'#3a2c20', fur:'#6a5240', furH:'#7e6450', furL:'#4e3c2e', str:'#3f3022', ear:'#b89a8a' };
export function drawLeoBack(c, ox, oy){
  const x=(v)=>ox+v, y=(v)=>oy+v; const P=LEOP;
  c.fillStyle='rgba(20,18,14,.25)'; c.beginPath(); c.ellipse(ox+18,oy+34,16,3,0,0,7); c.fill();
  for(const a of [[30,18,7,12],[32,12,7,9],[33,8,7,7]]) px(c,x(a[0]),y(a[1]),a[2],a[3],P.out);
  px(c,x(31),y(19),5,10,P.fur); px(c,x(33),y(13),5,8,P.fur); px(c,x(34),y(9),5,6,P.furH);
  px(c,x(33),y(22),5,2,P.str); px(c,x(34),y(15),5,2,P.str);
  const rows=[[14,8,22],[16,6,26],[18,5,28],[20,5,28],[22,5,28],[24,6,26],[26,7,24],[28,9,20],[30,11,16]];
  for(const r of rows) px(c,x(r[1]),y(r[0]),r[2],2,P.out);
  for(const r of rows) px(c,x(r[1]+1),y(r[0]),r[2]-2,2,P.fur);
  px(c,x(6),y(15),26,2,P.furH);
  for(let i=0;i<5;i++) px(c,x(10+i*4),y(16),2,10,P.str);
  px(c,x(8),y(26),22,2,P.furL);
  px(c,x(10),y(31),5,3,P.out); px(c,x(22),y(31),5,3,P.out);
  px(c,x(11),y(31),3,2,P.furL); px(c,x(23),y(31),3,2,P.furL);
  const hh=[[4,12,14],[6,10,18],[8,9,20],[10,9,20],[12,10,18]];
  for(const r of hh) px(c,x(r[1]),y(r[0]),r[2],2,P.out);
  for(const r of hh) px(c,x(r[1]+1),y(r[0]),r[2]-2,2,P.fur);
  px(c,x(10),y(7),18,2,P.furH);
  px(c,x(9),y(2),6,5,P.out); px(c,x(23),y(2),6,5,P.out);
  px(c,x(10),y(3),4,3,P.fur); px(c,x(24),y(3),4,3,P.fur);
  px(c,x(11),y(4),2,2,P.ear); px(c,x(25),y(4),2,2,P.ear);
  px(c,x(17),y(6),2,4,P.str);
}

// ---------- Sprite: Platzhalter (noch nicht gezeichnete Gigos) ----------
export function drawGigoStub(c, ox, oy, t){
  t=t||0; const cx=ox+24, cy=oy+26;
  c.fillStyle='rgba(20,18,14,.25)'; c.beginPath(); c.ellipse(ox+23,oy+46,16,3,0,0,7); c.fill();
  c.fillStyle='#3a3550'; c.beginPath(); c.ellipse(cx,cy,20,22,0,0,7); c.fill();
  c.fillStyle='#4a4566'; c.beginPath(); c.ellipse(cx,cy-1,17,19,0,0,7); c.fill();
  // grosse Frage
  c.fillStyle='#cdbfff'; c.font='bold 28px Georgia'; c.textAlign='center'; c.textBaseline='middle';
  c.fillText('?', cx, cy+1+Math.sin(t*3)*1); c.textAlign='left'; c.textBaseline='top';
}

export function drawMephe(c,ox,oy,t){ t=t||0; const x=v=>ox+v,y=v=>oy+v; const P={ O:'#2a1c12', fur:'#6f4a2c', furH:'#875c38', furD:'#4a3320', sk:'#e2b488', skH:'#f0caa0', skD:'#c99a6e',
  wht:'#f6efe2', iris:'#a8442c', pup:'#140a08', glint:'#ffffff', mouth:'#4a1712', tng:'#d0584a', tngH:'#e06a5a', fang:'#f4ece0' };
  function rr(arr,fill){ for(const r of arr) px(c,x(r[1]),y(r[0]),r[2],2,P.O); for(const r of arr) px(c,x(r[1]+1),y(r[0]),r[2]-2,2,fill); }
  c.fillStyle='rgba(20,18,14,.25)'; c.beginPath(); c.ellipse(ox+22,oy+47,15,3,0,0,7); c.fill();
  // tail: hook low right (behind body)
  px(c,x(30),y(35),4,6,P.O); px(c,x(31),y(36),2,4,P.fur);
  px(c,x(33),y(37),4,4,P.O); px(c,x(34),y(38),2,2,P.fur);
  px(c,x(36),y(35),4,4,P.O); px(c,x(37),y(36),2,2,P.furH);
  px(c,x(35),y(33),3,3,P.O); px(c,x(36),y(34),1,1,P.furH);
  // legs
  px(c,x(14),y(38),6,7,P.O); px(c,x(15),y(39),4,5,P.fur);
  px(c,x(13),y(44),8,3,P.O); px(c,x(14),y(45),6,2,P.sk);
  px(c,x(24),y(38),6,7,P.O); px(c,x(25),y(39),4,5,P.fur);
  px(c,x(23),y(44),8,3,P.O); px(c,x(24),y(45),6,2,P.sk);
  // body
  rr([[27,14,16],[29,13,18],[31,12,20],[33,12,20],[35,13,18],[37,15,14]],P.fur);
  px(c,x(17),y(30),10,8,P.sk); px(c,x(18),y(30),8,2,P.skH);
  // left arm down-out
  px(c,x(8),y(29),8,4,P.O); px(c,x(9),y(30),7,2,P.fur);
  px(c,x(5),y(31),5,5,P.O); px(c,x(6),y(32),3,3,P.sk);
  // right arm out to the side (below ear)
  px(c,x(30),y(28),8,4,P.O); px(c,x(31),y(29),7,2,P.fur);
  px(c,x(38),y(26),5,5,P.O); px(c,x(39),y(27),3,3,P.sk);
  px(c,x(39),y(25),1,2,P.sk); px(c,x(41),y(25),1,2,P.sk);
  // head
  rr([[8,13,18],[10,11,22],[12,10,24],[14,9,26],[16,9,26],[18,10,24],[20,11,22],[22,12,20],[24,14,16]],P.fur);
  // ears
  px(c,x(4),y(12),8,10,P.O); px(c,x(32),y(12),8,10,P.O);
  px(c,x(5),y(13),6,8,P.fur); px(c,x(33),y(13),6,8,P.fur);
  px(c,x(6),y(14),4,6,P.sk); px(c,x(34),y(14),4,6,P.sk);
  // tan face (rounded)
  px(c,x(13),y(12),18,11,P.sk); px(c,x(14),y(11),16,1,P.skH);
  px(c,x(12),y(14),20,7,P.sk); px(c,x(15),y(23),14,3,P.sk);
  // hair spikes
  c.fillStyle=P.furD;
  for(const [sx,sh,lean] of [[13,5,-2],[16,7,-1],[19,9,0],[22,9,1],[25,7,1],[28,5,2]]){
    c.beginPath(); c.moveTo(x(sx),y(10)); c.lineTo(x(sx+1+lean),y(10-sh)); c.lineTo(x(sx+3),y(10)); c.fill(); }
  c.fillStyle=P.fur; c.beginPath(); c.moveTo(x(17),y(10)); c.lineTo(x(19),y(5)); c.lineTo(x(21),y(10)); c.fill();
  // EYES: white 7x7 with tan margin, red iris, black pupil
  function eye(ex){
    px(c,x(ex),y(14),7,7,P.wht); px(c,x(ex+1),y(13),5,1,P.wht); px(c,x(ex+1),y(21),5,1,P.wht);
    px(c,x(ex+1),y(16),5,4,P.iris);
    px(c,x(ex+2),y(16),3,3,P.pup);
    px(c,x(ex+2),y(16),2,2,P.glint);
  }
  eye(13); eye(24);
  // nose
  px(c,x(21),y(20),1,1,P.furD); px(c,x(22),y(20),1,1,P.furD);
  // grin + fang + tongue
  px(c,x(17),y(23),10,3,P.mouth);
  px(c,x(17),y(23),10,1,'#8a5a3a');
  px(c,x(18),y(23),1,2,P.fang); px(c,x(25),y(23),1,2,P.fang);
  px(c,x(20),y(25),5,3,P.tng); px(c,x(20),y(25),5,1,P.tngH);
  px(c,x(21),y(28),3,1,P.tng);
}
export function drawEcstasy(c,ox,oy,t){ t=t||0; const x=v=>ox+v,y=v=>oy+v; const P={ O:'#5a3244', f:'#d89ab0', fH:'#e8b4c6', fD:'#b87a94', fDD:'#9a6280',
  cream:'#f0dccc', wht:'#f8f2e8', ring:'#3a2430', iris:'#b04a4a', pup:'#140a10', glint:'#ffffff',
  bk:'#e0a23a', bkD:'#b97f24', ft:'#e0a23a' };
  function rr(arr,fill){ for(const r of arr) px(c,x(r[1]),y(r[0]),r[2],2,P.O); for(const r of arr) px(c,x(r[1]+1),y(r[0]),r[2]-2,2,fill); }
  c.fillStyle='rgba(20,18,14,.25)'; c.beginPath(); c.ellipse(ox+22,oy+46,14,3,0,0,7); c.fill();
  // messy feather tufts (head halo)
  c.fillStyle=P.fD;
  for(const [sx,sy,sh,lean] of [[8,12,7,-3],[11,9,8,-2],[15,7,9,-1],[19,6,10,0],[24,6,10,1],[28,7,9,1],[32,9,8,2],[35,12,7,3]]){
    c.beginPath(); c.moveTo(x(sx),y(sy)); c.lineTo(x(sx+1+lean),y(sy-sh)); c.lineTo(x(sx+3),y(sy)); c.fill(); }
  c.fillStyle=P.f;
  for(const [sx,sy,sh,lean] of [[13,9,6,-1],[17,7,7,0],[22,6,8,0],[26,7,7,1],[30,9,6,1]]){
    c.beginPath(); c.moveTo(x(sx),y(sy)); c.lineTo(x(sx+1+lean),y(sy-sh)); c.lineTo(x(sx+3),y(sy)); c.fill(); }
  // body blob
  rr([[8,14,16],[10,11,22],[12,9,26],[14,8,28],[16,8,28],[18,8,28],[20,8,28],[22,9,26],[24,9,26],[26,10,24],[28,10,24],[30,11,22],[32,12,20],[34,14,16],[36,16,12]],P.f);
  px(c,x(9),y(10),24,2,P.fH);
  // wings (scruffy, out slightly)
  px(c,x(5),y(22),6,12,P.O); px(c,x(6),y(23),4,10,P.fD);
  px(c,x(4),y(30),4,5,P.O); px(c,x(5),y(31),2,3,P.fD);
  px(c,x(33),y(22),6,12,P.O); px(c,x(34),y(23),4,10,P.fD);
  px(c,x(36),y(30),4,5,P.O); px(c,x(37),y(31),2,3,P.fD);
  px(c,x(6),y(23),4,1,P.f); px(c,x(34),y(23),4,1,P.f);
  // belly (cream, feather V pattern)
  px(c,x(15),y(26),14,12,P.cream); px(c,x(16),y(26),12,1,'#f8ecdc');
  c.fillStyle=P.fD; for(let r=0;r<3;r++) for(let i=0;i<3;i++){ px(c,x(17+i*4),y(28+r*3),2,1,P.fD); px(c,x(16+i*4),y(29+r*3),1,1,P.fD); }
  // feet (yellow talons, attached)
  px(c,x(13),y(39),7,4,P.O); px(c,x(24),y(39),7,4,P.O);
  px(c,x(14),y(40),5,2,P.ft); px(c,x(25),y(40),5,2,P.ft);
  px(c,x(14),y(42),1,3,P.bkD); px(c,x(16),y(42),1,3,P.bkD); px(c,x(18),y(42),1,3,P.bkD);
  px(c,x(25),y(42),1,3,P.bkD); px(c,x(27),y(42),1,3,P.bkD); px(c,x(29),y(42),1,3,P.bkD);
  // HUGE eyes: dark ring, white, red iris, giant pupil
  function eye(ex,ey){
    px(c,x(ex-1),y(ey-1),12,12,P.ring);
    px(c,x(ex),y(ey),10,10,P.wht);
    px(c,x(ex+1),y(ey+1),8,8,P.iris);
    px(c,x(ex+2),y(ey+2),6,6,P.pup);
    px(c,x(ex+2),y(ey+2),2,2,P.glint);
    px(c,x(ex+6),y(ey+6),1,1,'#f8f2e8');
  }
  eye(10,13); eye(23,13);
  // beak (open, orange)
  px(c,x(20),y(22),4,3,P.bk); px(c,x(21),y(25),2,2,P.bkD);
  px(c,x(21),y(22),2,1,'#f0c05a');
  // floating feather bits
  px(c,x(2),y(18),2,1,P.fD); px(c,x(40),y(16),2,1,P.fD); px(c,x(41),y(28),1,2,P.f);
}
export function drawKoks(c,ox,oy,t){ t=t||0; const x=v=>ox+v,y=v=>oy+v; const P={ O:'#233618', g:'#5f8a3f', gH:'#7aa851', gD:'#476a2c', moss:'#4f7a34', mossD:'#3a5c26',
  belly:'#cfc190', bellyH:'#ddd0a2', spot:'#a8a068',
  wht:'#f6f0e0', vein:'#d88a8a', pup:'#140f08', glint:'#ffffff',
  mouth:'#3a1410', tng:'#cf5a4c', tngH:'#e06a5a', fang:'#f4ece0', tip:'#c9d89a' };
  function rr(arr,fill){ for(const r of arr) px(c,x(r[1]),y(r[0]),r[2],2,P.O); for(const r of arr) px(c,x(r[1]+1),y(r[0]),r[2]-2,2,fill); }
  c.fillStyle='rgba(20,18,14,.22)'; c.beginPath(); c.ellipse(ox+22,oy+47,13,2.5,0,0,7); c.fill();
  // hind legs (folded jump, splayed)
  px(c,x(7),y(33),6,4,P.O); px(c,x(8),y(34),4,2,P.g);          // left thigh
  px(c,x(5),y(36),5,4,P.O); px(c,x(6),y(37),3,2,P.gD);
  px(c,x(4),y(40),6,3,P.O); px(c,x(5),y(41),4,1,P.g);          // left foot
  px(c,x(3),y(41),2,2,P.tip); px(c,x(7),y(42),2,2,P.tip);
  px(c,x(31),y(33),6,4,P.O); px(c,x(32),y(34),4,2,P.g);        // right thigh
  px(c,x(34),y(36),5,4,P.O); px(c,x(35),y(37),3,2,P.gD);
  px(c,x(34),y(40),6,3,P.O); px(c,x(35),y(41),4,1,P.g);        // right foot
  px(c,x(33),y(41),2,2,P.tip); px(c,x(39),y(42),2,2,P.tip);
  // body (round)
  rr([[22,13,18],[24,11,22],[26,10,24],[28,10,24],[30,10,24],[32,11,22],[34,12,20],[36,14,16],[38,16,12]],P.g);
  px(c,x(15),y(28),14,10,P.belly); px(c,x(16),y(28),12,2,P.bellyH);
  c.fillStyle=P.spot; for(const s of [[17,32],[24,31],[20,35],[26,35]]) px(c,x(s[0]),y(s[1]),2,2,P.spot);
  // warts
  for(const w of [[12,25],[30,24],[14,36],[29,37]]) px(c,x(w[0]),y(w[1]),2,2,P.gD);
  // arms raised (jump!)
  px(c,x(8),y(22),4,7,P.O); px(c,x(9),y(23),2,5,P.g);           // left arm up
  px(c,x(5),y(17),6,6,P.O); px(c,x(6),y(18),4,4,P.g);           // left hand
  px(c,x(4),y(16),2,2,P.tip); px(c,x(7),y(14),2,2,P.tip); px(c,x(10),y(16),2,2,P.tip);  // bulb fingers
  px(c,x(32),y(22),4,7,P.O); px(c,x(33),y(23),2,5,P.g);         // right arm up
  px(c,x(33),y(17),6,6,P.O); px(c,x(34),y(18),4,4,P.g);         // right hand
  px(c,x(32),y(14),2,2,P.tip); px(c,x(36),y(13),2,2,P.tip); px(c,x(39),y(16),2,2,P.tip);
  // head (merged w/ body top) — huge eye bulges
  rr([[12,12,20],[14,10,24],[16,9,26],[18,9,26],[20,10,24]],P.g);
  // moss/spiky hair
  c.fillStyle=P.mossD;
  for(const [sx,sy,sh,lean] of [[11,12,5,-2],[14,10,6,-1],[18,9,7,0],[22,8,8,0],[26,9,7,1],[30,10,6,1],[33,12,5,2]]){
    c.beginPath(); c.moveTo(x(sx),y(sy)); c.lineTo(x(sx+1+lean),y(sy-sh)); c.lineTo(x(sx+3),y(sy)); c.fill(); }
  c.fillStyle=P.moss;
  for(const [sx,sy,sh] of [[13,11,4],[17,9,5],[21,8,6],[25,9,5],[29,10,4]]){
    c.beginPath(); c.moveTo(x(sx),y(sy)); c.lineTo(x(sx+1),y(sy-sh)); c.lineTo(x(sx+3),y(sy)); c.fill(); }
  // HUGE bulging eyes (white, veins, small pupil)
  function eye(ex,ey){
    px(c,x(ex-1),y(ey-1),11,11,P.O);
    px(c,x(ex),y(ey),9,9,P.wht);
    px(c,x(ex),y(ey+2),1,2,P.vein); px(c,x(ex+8),y(ey+3),1,2,P.vein); px(c,x(ex+1),y(ey+7),2,1,P.vein);
    px(c,x(ex+3),y(ey+3),3,3,P.pup);
    px(c,x(ex+3),y(ey+3),1,1,P.glint);
  }
  eye(10,11); eye(25,11);
  // wide open mouth + tongue
  px(c,x(14),y(22),16,4,P.mouth); px(c,x(15),y(26),14,1,P.mouth);
  px(c,x(14),y(22),16,1,P.gD);
  px(c,x(16),y(22),1,2,P.fang); px(c,x(27),y(22),1,2,P.fang);
  px(c,x(19),y(24),6,3,P.tng); px(c,x(19),y(24),6,1,P.tngH);
  px(c,x(20),y(27),4,2,P.tng); px(c,x(21),y(29),2,1,P.tng);
  // flies :)
  px(c,x(2),y(8),1,1,P.O); px(c,x(41),y(6),1,1,P.O); px(c,x(43),y(30),1,1,P.O);
}

// ===== Akh-Sprites aus Original-Arts (Base64, runterskaliert) =====
export const GIGO_IMG={}; export const GIGO_IMG_GREY={};
export const GIGO_IMG_WHITE={};
export const GIGO_TINT={ grey:false, white:false };
export const GIGO_IMG_SRC={
  kraehe:'assets/images/gigo/kraehe.png',
  kraehe2:'assets/images/gigo/kraehe2.png',
  kraehe3:'assets/images/gigo/kraehe3.png',
  squirrel:'assets/images/gigo/squirrel.png',
  squirrel2:'assets/images/gigo/squirrel2.png',
  squirrel3:'assets/images/gigo/squirrel3.png',
  krabbe:'assets/images/gigo/krabbe.png',
  krabbe2:'assets/images/gigo/krabbe2.png'
};
for(const k in GIGO_IMG_SRC){ const im=new Image(); im.src=GIGO_IMG_SRC[k]; GIGO_IMG[k]=im; }
export function greyOf(k){ const im=GIGO_IMG[k]; if(!im||!im.complete||!im.width) return null; const cached=GIGO_IMG_GREY[k]; if(cached&&cached._w===im.width) return cached;
  const g=document.createElement('canvas'); g.width=im.width; g.height=im.height; const gc=g.getContext('2d'); gc.imageSmoothingEnabled=false; gc.drawImage(im,0,0); gc.globalCompositeOperation='source-atop'; gc.fillStyle='#8a8272'; gc.fillRect(0,0,im.width,im.height); gc.globalCompositeOperation='source-over'; g._w=im.width; GIGO_IMG_GREY[k]=g; return g; }
export function whiteOf(k){ const im=GIGO_IMG[k]; if(!im||!im.complete||!im.width) return null; const cached=GIGO_IMG_WHITE[k]; if(cached&&cached._w===im.width) return cached;
  const g=document.createElement('canvas'); g.width=im.width; g.height=im.height; const gc=g.getContext('2d'); gc.imageSmoothingEnabled=false; gc.drawImage(im,0,0); gc.globalCompositeOperation='source-atop'; gc.fillStyle='#ffffff'; gc.fillRect(0,0,im.width,im.height); gc.globalCompositeOperation='source-over'; g._w=im.width; GIGO_IMG_WHITE[k]=g; return g; }
// zeichnet das (hochaufloesende) Bild auf 48px-Hoehe skaliert, unten-mittig auf (ox+24, oy+46)
export function drawGigoImg(k,c,ox,oy){ const im=GIGO_IMG[k]; if(!im||!im.width) return; const g=GIGODEX[k]; const ds=(g&&g.dispScale)||1; const dy=(g&&g.dispDy)||0;
  const src = (GIGO_TINT.white && whiteOf(k)) || (GIGO_TINT.grey && greyOf(k)) || im; const hh=48*ds, ww=im.width*(hh/im.height);
  const p=c.imageSmoothingEnabled; c.imageSmoothingEnabled=false;
  try{ c.drawImage(src, Math.round(ox+24-ww/2), Math.round(oy+46+dy-hh), Math.round(ww), Math.round(hh)); }catch(e){}
  c.imageSmoothingEnabled=p; }
export function drawKraehe1(c,ox,oy,t){ drawGigoImg('kraehe',c,ox,oy); }
export function drawKraehe2(c,ox,oy,t){ drawGigoImg('kraehe2',c,ox,oy); }
export function drawKraehe3(c,ox,oy,t){ drawGigoImg('kraehe3',c,ox,oy); }
export function drawSquirrel1(c,ox,oy,t){ drawGigoImg('squirrel',c,ox,oy); }
export function drawSquirrel2(c,ox,oy,t){ drawGigoImg('squirrel2',c,ox,oy); }
export function drawSquirrel3(c,ox,oy,t){ drawGigoImg('squirrel3',c,ox,oy); }
export function drawKrabbe1(c,ox,oy,t){ drawGigoImg('krabbe',c,ox,oy); }
export function drawKrabbe2(c,ox,oy,t){ drawGigoImg('krabbe2',c,ox,oy); }
