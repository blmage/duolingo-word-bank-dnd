!function(){"use strict";const e=()=>{},t=Array.isArray,n=e=>"object"==typeof e&&!!e&&!t(e),r=e=>"__duo-toolbox__-"+e,s="success",o=r("action_request"),a=r("action_result"),c=r("ui_event_notification"),i=r("background_event_notification"),d=async e=>new Promise(((t,n)=>{if("undefined"==typeof chrome)return browser.runtime.sendMessage(e);chrome.runtime.sendMessage(e,(e=>{chrome.runtime.lastError?n(chrome.runtime.lastError):t(e)}))})),u=["get_options","update_options"],m=["options_changed"],l=document.createElement("script");l.src=chrome.runtime.getURL("src/observer.js"),l.type="text/javascript",(document.head||document.documentElement).appendChild(l);const p=document.createElement("script");p.src=chrome.runtime.getURL("src/ui.js"),p.type="text/javascript",(document.head||document.documentElement).appendChild(p);const h=document.createElement("link");h.href=chrome.runtime.getURL("assets/css/ui.css"),h.rel="stylesheet",(document.head||document.documentElement).appendChild(h),((r,u,m)=>{const l=t(r)?e=>r.indexOf(e)>=0:()=>!0,p=((e,r)=>{var s;const o=t(r)?e=>r.indexOf(e)>=0:()=>!0,a=t=>{const r=n(t.data)?t.data:t;return r&&i===r.type&&o(r.event)&&e(r.event,r.value)};return"undefined"!=typeof chrome&&null!==(s=chrome.runtime)&&void 0!==s&&s.onMessage?(chrome.runtime.onMessage.addListener(a),()=>chrome.runtime.onMessage.removeListener(a)):(window.addEventListener("message",a),()=>window.removeEventListener("message",a))})(((e,t)=>{window.postMessage({type:i,event:e,value:t},"*")}),m),h=t=>{if(t.source===window&&n(t.data))if(o===t.data.type){const e=t.data.action||null;l(e)&&d(t.data).then((e=>{if(!n(e)||s!==e.type)throw new Error;return e.value})).then((n=>{t.source.postMessage({type:a,action:e,result:s,value:n},"*")})).catch((n=>{t.source.postMessage({type:a,action:e,result:"failure",error:n},"*")}))}else if(c===t.data.type){const n=t.data.event||null;u.indexOf(n)>=0&&d(t.data).then(e).catch(e)}};window.addEventListener("message",h)})(u,[],m)}();
