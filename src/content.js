const uiScript = document.createElement('script');
uiScript.src = chrome.runtime.getURL('src/ui.js');
uiScript.type = 'text/javascript';
(document.head || document.documentElement).appendChild(uiScript);
