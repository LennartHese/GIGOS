export function hash(x,y){ let h=(x*374761393+y*668265263)^0x5bd1e995; h=(h^(h>>>13))*1274126177; return ((h^(h>>>16))>>>0)/4294967296; }
export function clamp(v,a,b){ return v<a?a:v>b?b:v; }
export function lerp(a,b,t){ return a+(b-a)*t; }
export const pick=(arr,x,y)=>arr[(hash(x,y)*arr.length)|0];
