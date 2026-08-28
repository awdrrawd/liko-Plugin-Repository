export const COMPONENT_STYLES = `
.pcm-module-select { position:relative; }
.pcm-module-select-trigger { width:100%; box-sizing:border-box; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 10px; border:1px solid rgba(255,255,255,.15); border-radius:8px; background:rgba(255,255,255,.08); color:#fff; font:inherit; text-align:left; cursor:pointer; }
.pcm-module-select-trigger:focus-visible { outline:2px solid rgba(167,139,250,.75); outline-offset:1px; }
.pcm-module-select-arrow { font-size:10px; opacity:.8; }
.pcm-module-select-menu { position:absolute; left:0; right:0; top:calc(100% + 4px); z-index:20; padding:4px; border:1px solid rgba(167,139,250,.45); border-radius:9px; background:rgba(22,27,40,.99); box-shadow:0 12px 28px rgba(0,0,0,.5); }
.pcm-module-select-option { display:block; width:100%; padding:8px 9px; border:0; border-radius:6px; background:transparent; color:#d8dcec; font:inherit; text-align:left; cursor:pointer; }
.pcm-module-select-option:hover,.pcm-module-select-option:focus-visible { background:rgba(127,83,205,.2); outline:none; }
.pcm-module-select-option.selected { background:rgba(127,83,205,.35); color:#fff; }
.bc-plugin-icon { display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; border-radius:10px; background:rgba(255,255,255,.1); font-size:22px; }
.bc-plugin-icon-image { display:block; width:100%; height:100%; border-radius:inherit; object-fit:cover; }
.bc-liko-notification-stack { position:fixed; right:20px; bottom:15vh; z-index:2147483648; width:min(312px,calc(100vw - 40px)); max-height:70vh; display:flex; flex-direction:column; align-items:stretch; gap:10px; pointer-events:none; }
.bc-liko-system-notification { position:relative; box-sizing:border-box; width:100%; flex-shrink:0; padding:12px 16px; border:1px solid rgba(127,83,205,.4); border-radius:12px; background:rgba(26,32,46,.95); box-shadow:0 6px 20px rgba(0,0,0,.3); color:#fff; font-family:'PingFang TC','Microsoft JhengHei','Noto Sans TC','Heiti TC',sans-serif; font-size:13px; opacity:0; transform:translateX(340px); transition:transform .4s cubic-bezier(.34,1.56,.64,1),opacity .3s ease; user-select:none; cursor:pointer; pointer-events:auto; }
.bc-liko-system-notification.show { opacity:1; transform:translateX(0); }
.bc-liko-system-notification.hide { opacity:0; transform:translateX(340px); }
`;

export function installComponentStyles() {
  if (document.getElementById('pcm-component-styles')) return;
  const style = document.createElement('style');
  style.id = 'pcm-component-styles';
  style.textContent = COMPONENT_STYLES;
  document.head.appendChild(style);
}
