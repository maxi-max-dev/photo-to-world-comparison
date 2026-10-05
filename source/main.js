import './style.css';

async function init(){

const $ = s => document.querySelector(s);
let viewer,loading,entering=false,activeSide=null;
const state = await fetch('./experiment.json',{cache:'no-store'}).then(r => {if(!r.ok)throw new Error('实验数据未能加载');return r.json();}).catch(error => {$('#experiment-status').textContent=error.message;throw error;});
$('#experiment-status').textContent=state.statusLabel;
$('#a-badge').textContent=state.a.statusLabel; $('#b-badge').textContent=state.b.statusLabel;
$('#poster-b').src=state.b.poster;$('#caption-a').textContent=state.a.caption; $('#caption-b').textContent=state.b.caption;
$('#updated').textContent='更新于 '+state.updated;
$('#show-objects').disabled=!state.b.objects.some(o=>o.model);
$('#move-objects').disabled=!state.b.objects.some(o=>o.model);
if(state.a.splat){$('#empty-a').hidden=true; const image=document.createElement('img');image.className='poster';image.id='poster-a';image.alt='A 路线的真实三维画面';image.src=state.a.poster;$('#view-a').append(image);}
state.objects.forEach(object=>{
  const row=document.createElement('article');row.className='object-row';
  const img=document.createElement('img');img.src=object.image;img.alt=object.name+'的独立参考图';
  const copy=document.createElement('div');const title=document.createElement('h3');title.textContent=object.name;const note=document.createElement('p');note.textContent=object.note;copy.append(title,note);
  const status=document.createElement('span');status.className='object-status';status.textContent=object.status;const asset=state.b.objects.find(x=>x.id===object.id);if(asset){const link=document.createElement('a');link.href=asset.model;link.download=object.id+'.glb';link.textContent='下载 GLB ↓';link.className='model-download';copy.append(link);}row.append(img,copy,status);$('#object-list').append(row);
});
state.facts.forEach(([key,value])=>{const row=document.createElement('tr');const th=document.createElement('th');th.scope='row';th.textContent=key;const td=document.createElement('td');td.textContent=value;row.append(th,td);$('#facts').append(row);});
state.findings.forEach(f=>{const li=document.createElement('li');li.textContent=f;$('#findings').append(li);});

let currentView='front';
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
  currentView=button.dataset.view;
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
  if(viewer)viewer.setView(currentView);
  else for(const side of ['a','b']){const image=$('#poster-'+side);if(image && state[side].posters?.[currentView]) image.src=state[side].posters[currentView];}
}));
async function loadViewer(){
  if(viewer)return viewer;
  if(!loading)loading=(async()=>{const {createViewer}=await import('./viewer.js');viewer=await createViewer(state);viewer.setView(currentView);viewer.setSound(sound);viewer.showObjects($('#show-objects').checked);viewer.setMoveMode($('#move-objects').checked);return viewer;})().catch(error=>{loading=null;$('#interaction-status').textContent='三维未能加载，请刷新后重试：'+error.message;throw error;});
  return loading;
}
const dialog=$('#walk-dialog');
async function enterRoom(side){
  if(entering)return;entering=true;viewer?.stop();
  if(!dialog.open)dialog.showModal();
  $('#walk-loading').hidden=false;$('#walk-loading').textContent='正在打开房间，首次需要下载三维空间…';
  document.querySelectorAll('[data-walk-side]').forEach(b=>b.disabled=true);
  try{
    await loadViewer();if(!dialog.open)return;
    if(!activeSide)viewer.setView('front');
    await viewer.enter(side);
    if(!dialog.open){viewer.exit();return;}
    activeSide=side;$('#walk-title').textContent=side==='a'?'A · 整图生成的房间':'B · Skill 组装的房间';
    document.querySelectorAll('[data-walk-side]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.walkSide===side)));
    $('#walk-loading').hidden=true;$('#walk-hint').textContent='拖动画面转头 · WASD / 方向键行走';
  }catch(error){$('#walk-loading').textContent='空间未能打开，请退出后重试：'+error.message;}
  finally{entering=false;document.querySelectorAll('[data-walk-side]').forEach(b=>b.disabled=false);}
}
$('#start-3d').addEventListener('click',()=>enterRoom('a'));
document.querySelectorAll('[data-enter]').forEach(button=>button.addEventListener('click',()=>enterRoom(button.dataset.enter)));
document.querySelectorAll('[data-walk-side]').forEach(button=>button.addEventListener('click',()=>enterRoom(button.dataset.walkSide)));
$('#walk-exit').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{viewer?.exit();activeSide=null;clearHeld();});
$('#walk-reset').addEventListener('click',()=>{viewer?.setView('front');$('#walk-hint').textContent='已回到入口。拖动画面看向四周。';});
const keys={KeyW:'forward',ArrowUp:'forward',KeyS:'back',ArrowDown:'back',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyQ:'turn-left',KeyE:'turn-right'};
const pressed=new Set();
function clearHeld(){pressed.clear();viewer?.stop();document.querySelectorAll('.walk-pad .held').forEach(b=>b.classList.remove('held'));}
window.addEventListener('keydown',event=>{if(!dialog.open||entering||!keys[event.code])return;event.preventDefault();if(!pressed.has(event.code)){pressed.add(event.code);viewer?.action(keys[event.code],.045);}viewer?.hold(keys[event.code],true);});
window.addEventListener('keyup',event=>{if(!keys[event.code])return;pressed.delete(event.code);viewer?.hold(keys[event.code],[...pressed].some(key=>keys[key]===keys[event.code]));});
window.addEventListener('blur',clearHeld);
document.querySelectorAll('[data-walk-action]').forEach(button=>{
  const action=button.dataset.walkAction;
  button.addEventListener('pointerdown',event=>{if(entering)return;event.preventDefault();button.setPointerCapture(event.pointerId);button.classList.add('held');viewer?.action(action);viewer?.hold(action,true);});
  const release=()=>{button.classList.remove('held');viewer?.hold(action,false);};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  button.addEventListener('click',event=>{if(event.detail===0&&!entering)viewer?.action(action);});
  button.addEventListener('contextmenu',event=>event.preventDefault());
});
// Prepare the real scene as the comparison comes into view; posters are loading previews.
const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();loadViewer().catch(()=>{});}},{rootMargin:'150px'});observer.observe($('#comparison'));
$('#reset').addEventListener('click',()=>{viewer?.resetObjects();document.querySelector('[data-view="front"]').click();$('#interaction-status').textContent='已回到初始机位与人工设置的物件位置。';});
$('#show-objects').addEventListener('change',event=>viewer?.showObjects(event.target.checked));
$('#move-objects').addEventListener('change',event=>{viewer?.setMoveMode(event.target.checked);$('#interaction-help').textContent=event.target.checked?'在 B 侧拖动物件可改变位置；空白处仍可旋转视角。':'拖动旋转，滚轮拉近；两侧使用相同相机位置。';});
let sound=false;
const ambience=new Audio('media/room.wav');ambience.loop=true;ambience.volume=.5;ambience.id='ambient-audio';ambience.preload='none';ambience.hidden=true;document.body.append(ambience);
$('#sound-toggle').addEventListener('click',async()=>{
  sound=!sound;viewer?.setSound(sound);$('#sound-toggle').setAttribute('aria-pressed',String(sound));$('#sound-toggle').textContent='声音：'+(sound?'开':'关');
  if(sound){try{await ambience.play();}catch{sound=false;viewer?.setSound(false);$('#sound-toggle').setAttribute('aria-pressed','false');$('#sound-toggle').textContent='声音：点击重试';}}else ambience.pause();
});
const requestedRoom=new URLSearchParams(location.search).get('walk');if(requestedRoom==='a'||requestedRoom==='b')enterRoom(requestedRoom);

document.addEventListener('visibilitychange',()=>{if(document.hidden){ambience.pause();clearHeld();}else if(sound)ambience.play().catch(()=>{});});

}
init().catch(error=>console.error(error));
