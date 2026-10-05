import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark';

const presets={front:{position:[0,1.45,1.6],target:[.15,.75,-2.4]},side:{position:[-.95,1.25,.35],target:[.25,.65,-1.7]},back:{position:[.8,1.75,-2.02],target:[-.28,.7,-1.2]}};

export async function createViewer(data){
  const panes=[],objects=[],raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let syncing=false,moveMode=false,sound=false;
  const status=document.querySelector('#interaction-status');
  for(const side of ['a','b']){
    const config=data[side];if(!config.splat)continue;
    const host=document.querySelector('#view-'+side),note=document.querySelector('#render-'+side);
    note.textContent='载入真实三维数据…';
    const renderer=new THREE.WebGLRenderer({antialias:false,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setClearColor(0x111b32);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label',(side==='a'?'整图路线':'Skill 路线')+'三维视图');host.append(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.05,120);
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.minDistance=.15;controls.maxDistance=12;controls.panSpeed=.7;controls.zoomSpeed=.6;
    const spark=new SparkRenderer({renderer,enableLod:false,encodeLinear:false});scene.add(spark);
    const group=new THREE.Group();group.position.y=config.transform.ground;group.rotation.x=config.transform.flipY?Math.PI:0;group.scale.setScalar(config.transform.scale);spark.add(group);
    const splat=new SplatMesh({url:config.splat});group.add(splat);
    const pane={side,renderer,scene,camera,controls,host,note,config};panes.push(pane);
    scene.add(new THREE.HemisphereLight(0xeaf1ff,0x786a4b,2.2));const light=new THREE.DirectionalLight(0xffffff,2.5);light.position.set(-2,4,3);scene.add(light);
    const resize=()=>{const{width,height}=host.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(host);resize();
    controls.addEventListener('change',()=>{if(syncing)return;syncing=true;for(const other of panes)if(other!==pane){other.camera.position.copy(camera.position);other.camera.quaternion.copy(camera.quaternion);other.controls.target.copy(controls.target);other.controls.update();}syncing=false;});
    renderer.setAnimationLoop(()=>{if(document.hidden)return;renderer.render(scene,camera);});
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
  function wireInteractions(pane){
    const canvas=pane.renderer.domElement;let dragged=null,down=null,plane=new THREE.Plane(),offset=new THREE.Vector3();
    function pick(event){const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,pane.camera);return raycaster.intersectObjects(objects.filter(o=>o.visible),true)[0];}
    function rootObject(hit){let object=hit?.object;while(object&&!objects.includes(object))object=object.parent;return object;}
    function play(object){if(sound&&object.userData.sound){const audio=new Audio(object.userData.sound);audio.volume=.65;audio.hidden=true;audio.className='interaction-audio';audio.dataset.object=object.userData.id;document.body.append(audio);audio.addEventListener('ended',()=>audio.remove());audio.play().catch(()=>audio.remove());}}
    canvas.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY};const hit=pick(event),object=rootObject(hit);if(!moveMode||!object)return;dragged=object;pane.controls.enabled=false;plane.set(new THREE.Vector3(0,1,0),-object.position.y);const at=new THREE.Vector3();if(raycaster.ray.intersectPlane(plane,at))offset.copy(object.position).sub(at);canvas.setPointerCapture(event.pointerId);play(object);event.stopPropagation();},true);
    canvas.addEventListener('pointermove',event=>{if(!dragged)return;pick(event);const at=new THREE.Vector3();if(raycaster.ray.intersectPlane(plane,at)){dragged.position.copy(at.add(offset));status.textContent=dragged.userData.name+'：位置已移动（水平平面拖动，非物理仿真）。';}});
    canvas.addEventListener('pointerup',event=>{if(dragged){dragged=null;pane.controls.enabled=true;canvas.releasePointerCapture(event.pointerId);}else if(down&&Math.hypot(event.clientX-down.x,event.clientY-down.y)<5){const object=rootObject(pick(event));if(object){play(object);status.textContent=object.userData.name+' · 独立 GLB，可隐藏或拖动。';}}down=null;});
    canvas.addEventListener('pointercancel',()=>{dragged=null;pane.controls.enabled=true;down=null;});
  }
  const api={setView(name){const p=presets[name]||presets.front;syncing=true;for(const pane of panes){pane.camera.position.fromArray(p.position);pane.controls.target.fromArray(p.target);pane.camera.lookAt(...p.target);pane.controls.update();}syncing=false;},resetObjects(){objects.forEach(object=>object.position.copy(object.userData.initial));},showObjects(visible){objects.forEach(object=>object.visible=visible);},setMoveMode(value){moveMode=value;},setSound(value){sound=value;}};
  api.setView('front');return api;
}
