const FILES = ['meta.json', 'manifest.json', 'external.json', 'fusam.json'];
const REPO_FILES = ['meta.json', 'manifest.json', 'external.json'];
const FILE_LABELS = {'meta.json':'meta','manifest.json':'manifest','external.json':'external','fusam.json':'FUSAM'};
const FUSAM_URL = 'https://gitlab.com/Sidiousious/bc-addon-loader/-/raw/main/manifest.json?ref_type=heads';
const state = { current: 'meta.json', selected: 0, data: {}, dirty: new Set() };

const externalFields = [
  ['id','ID','text',true],['icon','圖示／Emoji'],['name','中文名稱'],['en_name','英文名稱'],
  ['description','中文說明','textarea'],['en_description','英文說明','textarea'],
  ['additionalInfo','中文補充','textarea'],['en_additionalInfo','英文補充','textarea'],
  ['url','穩定版 URL','url',true],['mirrorUrl','穩定版鏡像 URL','url'],['altUrl','測試版 URL','url'],['altMirrorUrl','測試版鏡像 URL','url'],
  ['website','網站／儲存庫','url'],['priority','優先順序','number'],['version','版本'],['triLabels','三段切換標籤（每行一個）','lines']
];
const manifestFields = [
  ['id','ID','text',true],['icon','圖示 URL','url'],['iemoji','Emoji'],['name.cn','中文名稱'],['name.en','英文名稱'],
  ['description.cn','中文說明','textarea'],['description.en','英文說明','textarea'],
  ['additionalInfo.cn','中文補充','textarea'],['additionalInfo.en','英文補充','textarea'],
  ['author','作者'],['repository','儲存庫 URL','url'],['website','網站 URL','url'],['tags','標籤（逗號分隔）','csv'],
  ['type','載入類型','select:module,script,eval'],['priority','優先順序','number'],['version','顯示版本'],
  ['discord','Discord 網址','url'],['noCacheBusting','停用快取破壞參數','checkbox'],['pcmskip','不加入 PCM','checkbox']
];

const $ = s => document.querySelector(s);
const clone = x => JSON.parse(JSON.stringify(x));
const get = (o,p) => p.split('.').reduce((a,k)=>a?.[k],o);
function set(o,p,v){const ks=p.split('.');let x=o;ks.slice(0,-1).forEach(k=>x=x[k]??={});if(v===''||v===undefined||(Array.isArray(v)&&!v.length)) delete x[ks.at(-1)]; else x[ks.at(-1)]=v; cleanup(o);}
function cleanup(o){for(const k of Object.keys(o)){if(o[k]&&typeof o[k]==='object'&&!Array.isArray(o[k])){cleanup(o[k]);if(!Object.keys(o[k]).length)delete o[k];}}}
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function toast(msg){const e=$('#toast');e.textContent=msg;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),2200);}
function markDirty(){state.dirty.add(state.current);renderTabs();updateStatus();}
function updateStatus(){const d=state.data[state.current];const n=d?.plugins?.length??d?.addons?.length;$('#fileStatus').textContent=(state.dirty.has(state.current)?'● 尚未下載':'✓ 已載入')+(n!=null?` · ${n} 項`:'');}

function githubRawBase(input){
  let value=input.trim();
  if(!value)throw new Error('請輸入 GitHub 儲存庫網址');
  if(!/^https?:\/\//i.test(value))value='https://'+value;
  const url=new URL(value), parts=url.pathname.split('/').filter(Boolean);
  if(url.hostname==='raw.githubusercontent.com'){
    if(parts.length<3)throw new Error('Raw GitHub 網址格式不完整');
    return `https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/${parts[2]}/${parts.slice(3).join('/')}`.replace(/\/$/,'');
  }
  if(!['github.com','www.github.com'].includes(url.hostname)||parts.length<2)throw new Error('請使用 github.com 儲存庫網址');
  const [owner,repo]=parts, treeAt=parts.indexOf('tree');
  const branch=treeAt>=0&&parts[treeAt+1]?parts[treeAt+1]:'main';
  const subpath=treeAt>=0?parts.slice(treeAt+2).join('/'):'';
  return `https://raw.githubusercontent.com/${owner}/${repo.replace(/\.git$/,'')}/${branch}${subpath?'/'+subpath:''}`;
}
function directJsonSource(input){
  let value=input.trim();if(!/^https?:\/\//i.test(value))value='https://'+value;
  const url=new URL(value), parts=url.pathname.split('/').filter(Boolean);
  if(!url.pathname.toLowerCase().endsWith('.json'))return null;
  if(['github.com','www.github.com'].includes(url.hostname)){
    const blobAt=parts.indexOf('blob');if(blobAt<2||!parts[blobAt+1])throw new Error('GitHub JSON 網址缺少 blob/分支');
    url.hostname='raw.githubusercontent.com';url.pathname=`/${parts[0]}/${parts[1]}/${parts[blobAt+1]}/${parts.slice(blobAt+2).join('/')}`;
  }else if(url.hostname==='gitlab.com'){
    const dashAt=parts.indexOf('-'), mode=parts[dashAt+1];
    if(dashAt<1||!['blob','raw'].includes(mode)||!parts[dashAt+2])throw new Error('GitLab JSON 網址格式不完整');
    const project=parts.slice(0,dashAt).join('/'),ref=parts[dashAt+2],filePath=parts.slice(dashAt+3).join('/');
    return `https://gitlab.com/api/v4/projects/${encodeURIComponent(project)}/repository/files/${encodeURIComponent(filePath)}/raw?ref=${encodeURIComponent(ref)}`;
  }
  url.search='';url.hash='';return url.href;
}
async function loadRepo(){
  const repoUrl=$('#repositoryUrl').value;
  const direct=directJsonSource(repoUrl);
  if(direct){
    const res=await fetch(direct,{cache:'no-store'});if(!res.ok)throw new Error(`JSON: HTTP ${res.status}`);const data=await res.json();
    const file=Array.isArray(data.addons)?'fusam.json':Array.isArray(data.plugins)?'external.json':data.changelog?'meta.json':null;
    if(!file)throw new Error('無法辨識這份 JSON 的格式');state.data[file]=data;state.current=file;state.selected=0;state.dirty.delete(file);render();toast(`已直接載入 ${FILE_LABELS[file]}`);return;
  }
  const base=githubRawBase(repoUrl);
  const loaded={};
  for(const f of REPO_FILES){const res=await fetch(`${base}/${f}`,{cache:'no-store'});if(!res.ok)throw new Error(`${f}: HTTP ${res.status}`);loaded[f]=await res.json();}
  state.data={...state.data,...loaded};state.dirty.clear();state.selected=0;localStorage.setItem('liko-json-repo',repoUrl);render();toast('已直接載入 GitHub 儲存庫資料');
}
async function loadFusam(){
  if(state.dirty.has('fusam.json')){toast('FUSAM 有尚未下載的修改，已保留目前內容');return;}
  const res=await fetch(directJsonSource(FUSAM_URL),{cache:'no-store'});if(!res.ok)throw new Error(`FUSAM: HTTP ${res.status}`);const data=await res.json();
  if(!Array.isArray(data.addons))throw new Error('FUSAM manifest 缺少 addons 陣列');state.data['fusam.json']=data;state.selected=0;render();toast(`已自動載入 FUSAM · ${data.addons.length} 項`);
}
function defaultData(f){if(f==='external.json')return{_comment:'PCM-only entries NOT published to the FUSAM manifest.',plugins:[]};if(f==='manifest.json'||f==='fusam.json')return{version:'1',addons:[]};return{updateId:new Date().toISOString().slice(2,10).replaceAll('-',''),changelog:{cn:[],en:[]}};}
const isManifest=()=>state.current==='manifest.json'||state.current==='fusam.json';
async function init(){FILES.forEach(f=>state.data[f]=defaultData(f));const queryRepo=new URLSearchParams(location.search).get('repo'),savedRepo=localStorage.getItem('liko-json-repo')||'',safeSaved=/\.json(?:[?#]|$)/i.test(savedRepo)?'':savedRepo;$('#repositoryUrl').value=queryRepo||safeSaved||$('#repositoryUrl').value;renderTabs();render();try{await loadRepo();state.current='meta.json';render();}catch(e){state.current='meta.json';render();toast('載入失敗：'+e.message);}}

function renderTabs(){
  $('#tabs').innerHTML=FILES.map(f=>`<button data-file="${f}" class="${f===state.current?'active':''}">${state.dirty.has(f)?'● ':''}${FILE_LABELS[f]}</button>`).join('');
  $('#tabs').querySelectorAll('button').forEach(b=>b.onclick=async()=>{state.current=b.dataset.file;state.selected=0;$('#search').value='';render();if(state.current==='fusam.json')try{await loadFusam();}catch(e){toast('FUSAM 載入失敗：'+e.message);}});
}
function render(){document.body.dataset.workspace=state.current==='fusam.json'?'fusam':'default';renderTabs();$('#fileTitle').textContent=FILE_LABELS[state.current];const meta=state.current==='meta.json';$('#metaEditor').hidden=!meta;$('#listEditor').hidden=meta;$('#addEntry').hidden=meta;$('#search').hidden=meta;if(meta)renderMeta();else renderList();updateStatus();}
function entries(){const d=state.data[state.current];return state.current==='external.json'?d.plugins:d.addons;}
function entryLabel(x){return x.id||get(x,'name.en')||x.en_name||get(x,'name.cn')||x.name||'未命名項目';}
function renderList(){
  const q=$('#search').value.trim().toLowerCase(), list=entries();
  const indices=list.map((x,i)=>i).filter(i=>JSON.stringify(list[i]).toLowerCase().includes(q));
  $('#entryList').innerHTML=indices.length?`<div class="reorder-hint">拖曳卡片可調整插件順序</div>`+indices.map(i=>`<button type="button" draggable="true" class="entry-button ${i===state.selected?'active':''}" data-i="${i}"><span class="drag-handle" aria-hidden="true">⠿</span><span class="entry-copy"><strong>${escapeHtml(entryLabel(list[i]))}</strong><small>${escapeHtml(list[i].id||'無 ID')}</small></span></button>`).join(''):'<div class="empty">沒有符合的項目</div>';
  $('#entryList').querySelectorAll('.entry-button').forEach(b=>{
    b.onclick=()=>{state.selected=Number(b.dataset.i);renderList();};
    b.ondragstart=e=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',b.dataset.i);b.classList.add('dragging');};
    b.ondragend=()=>$('#entryList').querySelectorAll('.entry-button').forEach(x=>x.classList.remove('dragging','drop-before','drop-after'));
    b.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='move';const after=e.clientY>b.getBoundingClientRect().top+b.offsetHeight/2;$('#entryList').querySelectorAll('.entry-button').forEach(x=>x.classList.remove('drop-before','drop-after'));b.classList.add(after?'drop-after':'drop-before');};
    b.ondrop=e=>{e.preventDefault();const source=Number(e.dataTransfer.getData('text/plain')),target=Number(b.dataset.i),after=b.classList.contains('drop-after');if(!Number.isInteger(source)||source===target)return;const selectedItem=list[state.selected],moved=list[source];let insert=target+(after?1:0);list.splice(source,1);if(source<insert)insert--;list.splice(insert,0,moved);state.selected=list.indexOf(selectedItem);markDirty();renderList();};
  });
  renderForm(list[state.selected]);
}
function renderForm(item){
  if(!item){$('#entryForm').innerHTML='<div class="empty">按「新增項目」開始編輯</div>';return;}
  const fields=state.current==='external.json'?externalFields:manifestFields;
  $('#entryForm').innerHTML=`<div class="form-head"><h2>${escapeHtml(entryLabel(item))}</h2><button type="button" id="deleteEntry" class="danger">刪除項目</button></div><div class="fields">${fields.map(f=>fieldHtml(item,...f)).join('')}${isManifest()?versionsHtml(item):''}</div>`;
  $('#entryForm').querySelectorAll('[data-path]').forEach(el=>{el.oninput=()=>{let v=el.type==='checkbox'?el.checked:el.value;if(el.dataset.kind==='number')v=v===''?'':Number(v);if(el.dataset.kind==='csv')v=v.split(',').map(s=>s.trim()).filter(Boolean);if(el.dataset.kind==='lines')v=v.split('\n').map(s=>s.trim()).filter(Boolean);const [root,lang]=el.dataset.path.split('.');if(isManifest()&&lang&&typeof item[root]==='string')item[root]={en:item[root]};set(item,el.dataset.path,v);markDirty();};});
  $('#deleteEntry').onclick=()=>{if(confirm(`確定刪除「${entryLabel(item)}」？`)){entries().splice(state.selected,1);state.selected=Math.max(0,state.selected-1);markDirty();renderList();}};
  bindVersions(item);
}
function fieldHtml(item,path,label,type='text',required=false){
  const [root,lang]=path.split('.');
  const v=isManifest()&&lang&&typeof item[root]==='string'?(lang==='en'?item[root]:''):get(item,path), wide=['textarea','lines'].includes(type), req=required?' required':'';
  if(type==='checkbox')return`<div class="field check wide"><input id="f-${path}" data-path="${path}" type="checkbox" ${v?'checked':''}><label for="f-${path}">${label}</label></div>`;
  if(type.startsWith('select:'))return`<div class="field"><label>${label}</label><select data-path="${path}">${type.slice(7).split(',').map(x=>`<option ${v===x?'selected':''}>${x}</option>`).join('')}</select></div>`;
  const shown=type==='csv'?(v||[]).join(', '):type==='lines'?(v||[]).join('\n'):(v??'');
  return`<div class="field ${wide?'wide':''}"><label>${label}${required?' *':''}</label>${wide?`<textarea data-path="${path}" data-kind="${type}"${req}>${escapeHtml(shown)}</textarea>`:`<input data-path="${path}" data-kind="${type}" type="${['url','number'].includes(type)?type:'text'}" value="${escapeHtml(shown)}"${req}>`}</div>`;
}
function versionsHtml(item){const vs=item.versions||[];return`<div class="field wide array-box"><label>版本來源 *</label><div id="versions">${vs.map((v,i)=>`<div class="array-row"><select data-version="${i}" data-key="distribution">${['stable','beta','dev'].map(x=>`<option ${v.distribution===x?'selected':''}>${x}</option>`).join('')}</select><input data-version="${i}" data-key="source" type="url" value="${escapeHtml(v.source||'')}" placeholder="來源 URL"><button type="button" class="danger mini" data-remove-version="${i}">×</button></div>`).join('')}</div><button type="button" id="addVersion" class="mini">＋ 新增來源</button></div>`;}
function bindVersions(item){
  document.querySelectorAll('[data-version]').forEach(el=>el.oninput=()=>{item.versions[Number(el.dataset.version)][el.dataset.key]=el.value;markDirty();});
  document.querySelectorAll('[data-remove-version]').forEach(b=>b.onclick=()=>{item.versions.splice(Number(b.dataset.removeVersion),1);markDirty();renderForm(item);});
  const add=$('#addVersion');if(add)add.onclick=()=>{(item.versions??=[]).push({distribution:'stable',source:''});markDirty();renderForm(item);};
}
function renderMeta(){
  const d=state.data['meta.json'];d.changelog??={cn:[],en:[]};
  $('#metaEditor').innerHTML=`<div class="fields"><div class="field wide"><label>更新 ID *</label><input id="updateId" value="${escapeHtml(d.updateId||'')}"><p class="help">通常使用 YYMMDD，例如 2026-08-15 → 260815。</p></div><div class="field"><label>中文更新內容（每行一項）</label><textarea id="cnLog">${escapeHtml((d.changelog.cn||[]).join('\n'))}</textarea></div><div class="field"><label>英文更新內容（每行一項）</label><textarea id="enLog">${escapeHtml((d.changelog.en||[]).join('\n'))}</textarea></div></div>`;
  $('#updateId').oninput=e=>{d.updateId=e.target.value;markDirty();};
  for(const lang of ['cn','en'])$(`#${lang}Log`).oninput=e=>{d.changelog[lang]=e.target.value.split('\n').map(x=>x.trim()).filter(Boolean);markDirty();};
}
function validate(f,d){const errors=[],hasText=v=>typeof v==='string'?!!v.trim():!!(v?.en||v?.cn);if(f==='external.json'){if(!Array.isArray(d.plugins))errors.push('plugins 必須是陣列');else d.plugins.forEach((x,i)=>{if(!x.id)errors.push(`第 ${i+1} 項缺少 id`);if(!x.url)errors.push(`${x.id||`第 ${i+1} 項`} 缺少 url`);});}else if(f==='manifest.json'||f==='fusam.json'){if(!Array.isArray(d.addons))errors.push('addons 必須是陣列');else d.addons.forEach((x,i)=>{const n=x.id||`第 ${i+1} 項`;if(!x.id)errors.push(`${n} 缺少 id`);if(!hasText(x.name))errors.push(`${n} 缺少名稱`);if(!Array.isArray(x.versions)||!x.versions.length||x.versions.some(v=>!v.source))errors.push(`${n} 缺少有效版本來源`);});}else{if(!d.updateId)errors.push('缺少 updateId');if(!Array.isArray(d.changelog?.cn)||!Array.isArray(d.changelog?.en))errors.push('changelog.cn/en 必須是陣列');}return errors;}
function download(f,d){const errors=validate(f,d),outputName=f==='fusam.json'?'FUSAM-manifest.json':f;if(errors.length&&!confirm(`發現 ${errors.length} 個問題：\n\n${errors.slice(0,8).join('\n')}\n\n仍要下載嗎？`))return;const blob=new Blob([JSON.stringify(d,null,2)+'\n'],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=outputName;a.click();URL.revokeObjectURL(a.href);state.dirty.delete(f);renderTabs();updateStatus();toast(`已下載 ${outputName}`);}
function showPreview(){const f=state.current;$('#dialogTitle').textContent=`${f} · JSON 預覽與進階編輯`;$('#jsonPreview').value=JSON.stringify(state.data[f],null,2);checkPreview();$('#jsonDialog').showModal();}
function checkPreview(){try{const d=JSON.parse($('#jsonPreview').value);const es=validate(state.current,d);$('#previewValidation').textContent=es.length?`JSON 正確，但有 ${es.length} 個欄位問題`:'✓ JSON 與必要欄位正確';return d;}catch(e){$('#previewValidation').textContent='JSON 錯誤：'+e.message;return null;}}

$('#loadRepo').onclick=()=>loadRepo().catch(e=>toast('載入失敗：'+e.message));
$('#fileInput').onchange=async e=>{for(const file of e.target.files){const target=file.name==='FUSAM-manifest.json'?'fusam.json':file.name;if(!FILES.includes(target)){toast(`略過未知檔名：${file.name}`);continue;}try{state.data[target]=JSON.parse(await file.text());state.dirty.add(target);}catch(err){alert(`${file.name} 無法解析：${err.message}`);}}render();e.target.value='';};
$('#search').oninput=renderList;
$('#addEntry').onclick=()=>{const x=state.current==='external.json'?{id:'new-plugin',name:'',en_name:'',description:'',en_description:'',url:'',priority:10}:{id:'new-addon',name:{cn:'',en:''},description:{cn:'',en:''},author:'',repository:'',tags:[],type:'eval',versions:[{distribution:'stable',source:''}],priority:10};entries().push(x);state.selected=entries().length-1;markDirty();renderList();};
$('#saveFile').onclick=()=>download(state.current,state.data[state.current]);
$('#saveAll').onclick=()=>FILES.forEach((f,i)=>setTimeout(()=>download(f,state.data[f]),i*180));
$('#formatPreview').onclick=showPreview;$('#closeDialog').onclick=()=>$('#jsonDialog').close();$('#jsonPreview').oninput=checkPreview;
$('#applyPreview').onclick=()=>{const d=checkPreview();if(!d)return;state.data[state.current]=d;state.selected=0;markDirty();$('#jsonDialog').close();render();toast('已套用 JSON');};
window.addEventListener('beforeunload',e=>{if(state.dirty.size){e.preventDefault();e.returnValue='';}});
init();
