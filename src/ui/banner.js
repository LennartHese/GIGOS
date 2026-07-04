const banner=document.getElementById('banner');

export function setBanner(name,sub){ document.getElementById('bName').textContent=name; document.getElementById('bSub').textContent=sub||'Bezirk'; }
export function showBanner(){ banner.classList.add('show'); setTimeout(()=>banner.classList.remove('show'),2400); }
