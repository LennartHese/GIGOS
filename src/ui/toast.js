const toastEl=document.getElementById('toast'); let toastT=0;

export function toast(msg,ms){ toastEl.textContent=msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>toastEl.classList.remove('show'), ms||1800); }
