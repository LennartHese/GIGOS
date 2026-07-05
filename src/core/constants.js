export const LW=320, LH=180, TILE=16;
export const MAPW=34, MAPH=26;                 // Karte in Tiles
export const WPX=MAPW*TILE, HPX=MAPH*TILE;     // 544 x 416
export const cv=document.getElementById('game'), X=cv.getContext('2d');
X.imageSmoothingEnabled=false;
export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ======================================================================
   PALETTE — kuratiert, kohärent, Berlin-Dämmerung
   ====================================================================== */
export const C={
  grass:['#5e8a44','#557e3d','#699751','#4c7338'], grassBase:'#557e3d',
  grassHi:'#79a857', grassLo:'#3f6531',
  cobble:['#9a958c','#8f8a80','#a6a199','#857f76'], cobbleGrout:'#6f6a61',
  walk:['#cdbb98','#c4b08c','#d6c5a3'], walkLo:'#a8966f',
  road:'#4f4d52', roadHi:'#5a585d', roadLine:'#cdbf86',
  plaza:['#c2b48f','#b8a981','#cdc099'],
  dirt:['#9c7d52','#90724a'],
  water:'#3f6f86', waterHi:'#5b8aa0', waterLo:'#315a70', waterEdge:'#6b5a3c',
  tgrass:'#3f6a30', tgrassHi:'#5f8c3c', tgrassLo:'#2c4d22',
  sand:'#d8c39a', sandSh:'#b89a6e',
  brick:'#9c5444', brickSh:'#7e3f33', brickHi:'#b06a56',
  slate:'#54505e', slateHi:'#6a6576', slateLo:'#3d3a47',
  roofRed:'#9a4a36', roofRedHi:'#b15c44', roofRedLo:'#7a3727',
  wood:'#7a5436', woodHi:'#946a45', woodLo:'#5c3e27',
  win:'#36506a', winGlow:'#ffd98a', winGlowSoft:'#ffe9bf',
  trunk:'#6b4a30', trunkHi:'#825c3c', trunkLo:'#4e3522',
  leaf:['#4f7d39','#447031','#5b8d40','#3c6029'], leafHi:'#74a64e', leafGap:'#caa86e',
  ink:'#241c14', white:'#f4ecd6',
  enamel:'#0a4ea0', sbahnGreen:'#1f7a3a', sbahnYellow:'#f4c318', ubahnBlue:'#0d4d92',
  lamp:'#3a3640', lampGlow:'#ffdca0',
  skinA:'#e8c39a', skinB:'#c89070',
};
