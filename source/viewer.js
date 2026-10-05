import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark';
import { Octree } from 'three/addons/math/Octree.js';
import { WalkMotor } from './navigation.mjs';

const presets={front:{position:[0,1.35,.75],target:[.05,.65,-1.55]},side:{position:[-.95,1.25,.35],target:[.25,.65,-1.7]},back:{position:[.8,1.75,-2.02],target:[-.28,.7,-1.2]}};

export async function createViewer(data){
  const panes=[],objects=[],raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let syncing=false,moveMode=false,sound=false,walking=null;
  const held=new Set();
  const status=document.querySelector('#interaction-status');
  function syncFrom(pane){
    syncing=true;
    const direction=pane.camera.getWorldDirection(new THREE.Vector3());
    if(walking)pane.controls.target.copy(pane.camera.position).addScaledVector(direction,2);
    for(const other of panes)if(other!==pane){other.camera.position.copy(pane.camera.position);other.camera.quaternion.copy(pane.camera.quaternion);other.controls.target.copy(pane.controls.target);if(!walking)other.controls.update();}
    syncing=false;
  }
  function walkReadout(){
    if(!walking)return;
    const p=walking.camera.position,start=new THREE.Vector3(...presets.front.position),euler=new THREE.Euler().setFromQuaternion(walking.camera.quaternion,'YXZ');
    const degrees=((Math.round(-euler.y*180/Math.PI)%360)+360)%360;
    document.querySelector('#walk-position').textContent=`距入口 ${Math.hypot(p.x-start.x,p.z-start.z).toFixed(1)} m · 视向 ${degrees}°`;
  }
  function move(forward,right,distance){if(!walking)return;const moved=walking.motor.move(forward,right,distance);document.querySelector('#walk-hint').textContent=moved?'拖动画面转头 · WASD / 方向键行走':'前方有障碍，可侧移或转身。';syncFrom(walking);walkReadout();}
  function look(x,y){if(!walking)return;walking.motor.look(x,y);syncFrom(walking);walkReadout();}
  try {
  for(const side of ['a','b']){
    const config=data[side];if(!config.splat)continue;
    const host=document.querySelector('#view-'+side),note=document.querySelector('#render-'+side);
    note.textContent='载入真实三维数据…';
    const renderer=new THREE.WebGLRenderer({antialias:false,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setClearColor(0x111b32);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label',(side==='a'?'整图路线':'Skill 路线')+'三维视图');host.append(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.05,120);
    camera.position.fromArray(presets.front.position);camera.lookAt(...presets.front.target);
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.fromArray(presets.front.target);controls.enableDamping=false;controls.minDistance=.15;controls.maxDistance=12;controls.panSpeed=.7;controls.zoomSpeed=.6;
    const spark=new SparkRenderer({renderer,enableLod:false,encodeLinear:false});scene.add(spark);
    const group=new THREE.Group();group.position.y=config.transform.ground;group.rotation.x=config.transform.flipY?Math.PI:0;group.scale.setScalar(config.transform.scale);spark.add(group);
    const splat=new SplatMesh({url:config.splat});group.add(splat);
    const pane={side,renderer,scene,camera,controls,host,note,config,home:host.parentElement,after:host.nextSibling};panes.push(pane);
    scene.add(new THREE.HemisphereLight(0xeaf1ff,0x786a4b,2.2));const light=new THREE.DirectionalLight(0xffffff,2.5);light.position.set(-2,4,3);scene.add(light);
    const resize=()=>{const{width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};pane.observer=new ResizeObserver(resize);pane.observer.observe(host);resize();
    controls.addEventListener('change',()=>{if(syncing||walking)return;syncFrom(pane);});
    let last=performance.now();
    renderer.setAnimationLoop(now=>{const dt=Math.min(Math.max((now-last)/1000,0),.045);last=now;if(document.hidden||(walking&&walking!==pane))return;
      if(walking===pane){const forward=Number(held.has('forward'))-Number(held.has('back')),right=Number(held.has('right'))-Number(held.has('left'));if(forward||right)move(forward,right,.85*dt);const turn=Number(held.has('turn-right'))-Number(held.has('turn-left'));if(turn)look(turn*dt,0);}
      renderer.render(scene,camera);
    });
    let drag=null;
    renderer.domElement.addEventListener('pointerdown',event=>{if(walking!==pane)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY};renderer.domElement.setPointerCapture(event.pointerId);renderer.domElement.focus();});
    renderer.domElement.addEventListener('pointermove',event=>{if(walking!==pane||drag?.id!==event.pointerId)return;look((event.clientX-drag.x)*.003,(event.clientY-drag.y)*.003);drag.x=event.clientX;drag.y=event.clientY;});
    const endLook=()=>{drag=null;};renderer.domElement.addEventListener('pointerup',endLook);renderer.domElement.addEventListener('pointercancel',endLook);renderer.domElement.addEventListener('lostpointercapture',endLook);
    try{await splat.initialized;document.querySelector('#poster-'+side)?.remove();note.textContent='真实 SPZ · '+data.displayQuality;}
    catch(error){note.textContent='空间加载失败';note.classList.add('failed');throw error;}
    for(const object of config.objects || []){
      if(!object.model)continue;
      const gltf=await new GLTFLoader().loadAsync(object.model),mesh=gltf.scene,holder=new THREE.Group();
      const box=new THREE.Box3().setFromObject(mesh),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
      const scale=object.height/Math.max(size.y,.001);mesh.scale.setScalar(scale);mesh.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);holder.add(mesh);
      holder.position.fromArray(object.position);holder.rotation.y=object.rotationY||0;holder.userData={...object,initial:holder.position.clone()};scene.add(holder);objects.push(holder);
    }
    if(side==='b')wireInteractions(pane);
  }
  } catch(error) {
    for(const pane of panes){pane.observer?.disconnect();pane.renderer.setAnimationLoop(null);pane.controls.dispose();pane.scene.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});pane.renderer.dispose();pane.renderer.domElement.remove();}
    throw error;
  }
  function wireInteractions(pane){
    const canvas=pane.renderer.domElement;let dragged=null,down=null,plane=new THREE.Plane(),offset=new THREE.Vector3();
    function pick(event){const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,pane.camera);return raycaster.intersectObjects(objects.filter(o=>o.visible),true)[0];}
    function rootObject(hit){let object=hit?.object;while(object&&!objects.includes(object))object=object.parent;return object;}
    function play(object){if(sound&&object.userData.sound){const audio=new Audio(object.userData.sound);audio.volume=.65;audio.hidden=true;audio.className='interaction-audio';audio.dataset.object=object.userData.id;document.body.append(audio);audio.addEventListener('ended',()=>audio.remove());audio.play().catch(()=>audio.remove());}}
    canvas.addEventListener('pointerdown',event=>{if(walking)return;down={x:event.clientX,y:event.clientY};const hit=pick(event),object=rootObject(hit);if(!moveMode||!object)return;dragged=object;pane.controls.enabled=false;plane.set(new THREE.Vector3(0,1,0),-object.position.y);const at=new THREE.Vector3();if(raycaster.ray.intersectPlane(plane,at))offset.copy(object.position).sub(at);canvas.setPointerCapture(event.pointerId);play(object);event.stopPropagation();},true);
    canvas.addEventListener('pointermove',event=>{if(!dragged)return;pick(event);const at=new THREE.Vector3();if(raycaster.ray.intersectPlane(plane,at)){dragged.position.copy(at.add(offset));status.textContent=dragged.userData.name+'：位置已移动（水平平面拖动，非物理仿真）。';}});
    canvas.addEventListener('pointerup',event=>{if(dragged){dragged=null;pane.controls.enabled=true;canvas.releasePointerCapture(event.pointerId);}else if(down&&Math.hypot(event.clientX-down.x,event.clientY-down.y)<5){const object=rootObject(pick(event));if(object){play(object);status.textContent=object.userData.name+' · 独立 GLB，可隐藏或拖动。';}}down=null;});
    canvas.addEventListener('pointercancel',()=>{dragged=null;pane.controls.enabled=!walking;down=null;});
  }
  const api={
    async enter(side){
      const pane=panes.find(p=>p.side===side);if(!pane)throw new Error('这侧空间尚不可用');
      held.clear();
      if(!pane.motor){
        const gltf=await new GLTFLoader().loadAsync(pane.config.collision);
        const group=new THREE.Group();group.position.y=pane.config.transform.ground;group.rotation.x=pane.config.transform.flipY?Math.PI:0;group.scale.setScalar(pane.config.transform.scale);group.add(gltf.scene);group.updateMatrixWorld(true);
        const bounds=new THREE.Box3().setFromObject(group),octree=new Octree().fromGraphNode(group);
        pane.motor=new WalkMotor(pane.camera,octree,bounds);if(side==='b')pane.motor.obstacles=objects;
        group.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});
      }
      if(walking)walking.home.insertBefore(walking.host,walking.after);
      walking=pane;for(const p of panes)p.controls.enabled=false;
      document.querySelector('#walk-stage').prepend(pane.host);pane.host.classList.add('walking');
      for(const p of panes)if(p!==pane)p.host.classList.remove('walking');
      pane.renderer.domElement.focus();walkReadout();
    },
    exit(){held.clear();if(walking){walking.home.insertBefore(walking.host,walking.after);walking.host.classList.remove('walking');syncFrom(walking);}walking=null;for(const pane of panes)pane.controls.enabled=true;},
    action(action,amount=.16){const directions={forward:[1,0],back:[-1,0],left:[0,-1],right:[0,1]};if(directions[action])move(...directions[action],amount);else if(action==='turn-left')look(-amount,0);else if(action==='turn-right')look(amount,0);},
    hold(action,value){if(value)held.add(action);else held.delete(action);},stop(){held.clear();},
    setView(name){held.clear();const p=presets[name]||presets.front;syncing=true;for(const pane of panes){pane.camera.position.fromArray(p.position);pane.controls.target.fromArray(p.target);pane.camera.lookAt(...p.target);if(!walking)pane.controls.update();}syncing=false;walkReadout();},resetObjects(){objects.forEach(object=>object.position.copy(object.userData.initial));},showObjects(visible){objects.forEach(object=>object.visible=visible);},setMoveMode(value){moveMode=value;},setSound(value){sound=value;}};
  api.setView('front');return api;
}
