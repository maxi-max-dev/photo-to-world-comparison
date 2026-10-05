import './style.css';

async function init(){

const $ = s => document.querySelector(s);
let viewer;
const state = await fetch('./experiment.json').then(r => {if(!r.ok)throw new Error('实验数据未能加载');return r.json();}).catch(error => {$('#experiment-status').textContent=error.message;throw error;});
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
$('#start-3d').addEventListener('click',async()=>{
  const button=$('#start-3d');button.disabled=true;button.textContent='正在加载…';
  try{const {createViewer}=await import('./viewer.js'); viewer=await createViewer(state);viewer.setView(currentView);viewer.setSound(sound);viewer.showObjects($('#show-objects').checked);viewer.setMoveMode($('#move-objects').checked);button.textContent='三维已加载';}
  catch(error){button.disabled=false;button.textContent='重试加载三维';$('#interaction-status').textContent='三维未能加载：'+error.message;}
});
$('#reset').addEventListener('click',()=>{viewer?.resetObjects();document.querySelector('[data-view="front"]').click();$('#interaction-status').textContent='已回到初始机位与人工设置的物件位置。';});
$('#show-objects').addEventListener('change',event=>viewer?.showObjects(event.target.checked));
$('#move-objects').addEventListener('change',event=>{viewer?.setMoveMode(event.target.checked);$('#interaction-help').textContent=event.target.checked?'在右侧拖动物件可改变位置；空白处仍可旋转视角。':'拖动旋转，滚轮拉近；两侧使用相同相机位置。';});
let sound=false;
const ambience=new Audio('media/room.wav');ambience.loop=true;ambience.volume=.5;ambience.id='ambient-audio';ambience.preload='none';ambience.hidden=true;document.body.append(ambience);
$('#sound-toggle').addEventListener('click',async()=>{
  sound=!sound;viewer?.setSound(sound);$('#sound-toggle').setAttribute('aria-pressed',String(sound));$('#sound-toggle').textContent='声音：'+(sound?'开':'关');
  if(sound){try{await ambience.play();}catch{sound=false;viewer?.setSound(false);$('#sound-toggle').setAttribute('aria-pressed','false');$('#sound-toggle').textContent='声音：点击重试';}}else ambience.pause();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)ambience.pause();else if(sound)ambience.play().catch(()=>{});});

}
init().catch(error=>console.error(error));
