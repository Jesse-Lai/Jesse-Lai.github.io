(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  // Match ArticleImagePlaceholder's dot field, spacing, color and motion.
  const loading = (() => {
    const canvas=$('loading-dots'),context=canvas.getContext('2d');
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    let state='loading',frame=0,lastDraw=0,scale=1,width=0,height=0;
    function draw(time){
      if(!context||!width||!height)return;
      context.clearRect(0,0,width,height);
      const columns=Math.max(2,Math.floor(width/(22*scale)));
      const rows=Math.max(2,Math.floor(height/(22*scale)));
      for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++){
        const x=column/columns,y=row/rows;
        const dx=x-(.52+.18*Math.cos(time*.65)),dy=y-(.40+.15*Math.sin(time*.52));
        const dx2=x-(.23+.10*Math.sin(time*.74)),dy2=y-(.73+.12*Math.cos(time*.58));
        const field=Math.min(1,Math.exp(-(dx*dx*14+dy*dy*12))+.85*Math.exp(-(dx2*dx2*30+dy2*dy2*24)));
        const strength=field*(.76+.24*Math.sin(x*15+y*10-time*1.6));
        context.beginPath();
        context.arc(4*scale+x*Math.max(0,width-8*scale),4*scale+y*Math.max(0,height-8*scale),(.85+1.65*strength)*scale,0,Math.PI*2);
        context.fillStyle=`rgba(71,125,255,${.14+.72*strength})`;context.fill();
      }
    }
    function tick(time){
      if(time-lastDraw>=1000/30){draw(time/1000);lastDraw=time}
      frame=requestAnimationFrame(tick);
    }
    function sync(){
      cancelAnimationFrame(frame);frame=0;
      if(state==='ready'||document.hidden)return;
      draw(motion.matches?0:performance.now()/1000);
      if(state==='loading'&&!motion.matches)frame=requestAnimationFrame(tick);
    }
    function resize(){
      scale=Math.min(1,$('stage').clientWidth/803);
      $('loading').style.setProperty('--loading-scale',scale);
      width=canvas.clientWidth;height=canvas.clientHeight;
      const ratio=window.devicePixelRatio||1;
      canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
      context?.setTransform(ratio,0,0,ratio,0,0);sync();
    }
    const observer=new ResizeObserver(resize);observer.observe($('stage'));
    window.addEventListener('resize',resize);
    motion.addEventListener('change',sync);
    document.addEventListener('visibilitychange',sync);
    window.addEventListener('pagehide',()=>cancelAnimationFrame(frame));
    window.addEventListener('pageshow',sync);
    return {
      setState(next){
        state=next;
        $('stage').dataset.ready=String(next==='ready');
        $('stage').setAttribute('aria-busy',String(next==='loading'));
        $('loading').setAttribute('aria-hidden',String(next==='ready'));
        $('loading').classList.toggle('failed',next==='failed');
        $('retry').hidden=next!=='failed';
        $('loading-text').textContent=next==='failed'?'模型加载较慢，请重试':next==='ready'?'模型已准备好':'正在加载模型';
        sync();
      }
    };
  })();
  const parts = {
    all: {en:'All parts',title:'Explore a camera, part by part',description:'Slide to expand the five controls around the camera body. Select a part to learn its name and what it does.',example:''},
    body: {names:['#CAM0001_Body'],en:'Camera body',title:'Camera body',description:'The main part of a camera. It holds the film and the shutter mechanism, and keeps unwanted light out. In this model, the lens and body stay together.',example:'The camera body protects the film from light.',anchor:[0,-.032,.045],offset:[0,0,0]},
    shutter:{names:['#CAM0001_Shutter'],en:'Shutter release',title:'Shutter release',description:'The button you press to take a photograph. It triggers the shutter, allowing light to reach the film for the selected exposure time.',example:'Press the shutter release gently to avoid camera shake.',offset:[-.016,-.032,.045]},
    speed:{names:['#CAM0001_Shutter_Speed'],en:'Shutter-speed dial',title:'Shutter-speed dial',description:'A rotating control that sets how long the shutter stays open. A fast shutter speed freezes movement; a slow one can create motion blur.',example:'Turn the shutter-speed dial to a faster setting.',offset:[-.059,.004,.025]},
    advance:{names:['#CAM0001_Film_Advance'],en:'Film advance lever',title:'Film advance lever',description:'A lever that moves the film forward by one frame and prepares the camera for the next exposure. Advance means to move something forward.',example:'Move the film advance lever before taking the next shot.',offset:[-.045,.007,.068]},
    rewind:{names:['#CAM0001_Spool'],en:'Film rewind knob',title:'Film rewind knob',description:'The control that winds exposed film back into its cartridge. Press the rewind release on the camera base first. Rewind the film fully before opening the back.',example:'Rewind the film into its cartridge before opening the camera.',offset:[.059,.005,.059]},
    battery:{names:['#CAM0001_Battery_Check'],en:'Battery-check switch',title:'Battery-check switch',description:'A small switch used to check the battery condition. The Canon AT-1 needs battery power for its light meter and electronically controlled shutter.',example:'Use the battery-check switch before you start shooting.',offset:[.045,-.025,.018]}
  };
  const keys = Object.keys(parts).filter(k => k !== 'all');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pendingRestore=null;
  let api, ready=false, generation=0, selected='all', amount=0, targetAmount=0;
  let spinning=!reduced, spinDelay=0, angle=-.52, elevation=.25, distance=.33, target=[0,-.024,.048];
  let desiredView=null, partsState={};
  let lastTick=0,lastProjection=0, projectionBusy=false, gestures=new Map(), gestureStart=null;
  let tween=null, errorCount=0;
  const matrix=v=>Array.from({length:16},(_,i)=>v[i]);
  const call=(name,...args)=>new Promise((resolve,reject)=>api[name](...args,(err,value)=>err?reject(err):resolve(value)));
  const project=point=>new Promise(resolve=>api.getWorldToScreenCoordinates(point,resolve));
  const limit=(v,min,max)=>Math.min(max,Math.max(min,v));
  function report(error){errorCount++;$('stage').dataset.error=String(error);console.error('Camera anatomy:',error)}
  function worldPoint(m,p){return [0,1,2].map(i=>m[i]*p[0]+m[4+i]*p[1]+m[8+i]*p[2]+m[12+i])}
  function actualPartAmount(id){return selected==='all'||selected==='body'||selected===id?amount:0}
  function reportState(){
    parent.postMessage({channel:'bubble-camera',type:'state',value:{part:selected,expansion:Math.round(targetAmount*100),angle,elevation,distance}},location.origin);
  }
  function restore(value){
    if(!value||!parts[value.part])return;
    pendingRestore=value;
    if(!ready)return;
    const v=pendingRestore;pendingRestore=null;
    selected=v.part;targetAmount=limit(Number(v.expansion)||0,0,100)/100;
    amount=targetAmount;Object.values(partsState).forEach(s=>s.from=s.progress);
    tween={start:performance.now(),from:amount,to:targetAmount,duration:reduced?0:700,selection:true};
    if(Number.isFinite(v.angle))angle=v.angle;
    if(Number.isFinite(v.elevation))elevation=limit(v.elevation,-.6,1.25);
    if(Number.isFinite(v.distance))distance=limit(v.distance,.11,1.3);
    spinning=false;updateText();syncControls();fitView();
    if(Number.isFinite(v.angle)&&Number.isFinite(v.distance)){desiredView=null;angle=v.angle;}
    updateCamera();
  }
  window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.channel!=='bubble-camera-host')return;if(e.data.type==='restore')restore(e.data.value);});
  ['pointerdown','keydown','wheel','touchstart'].forEach(name=>window.addEventListener(name,e=>{if(e.isTrusted)parent.postMessage({channel:'bubble-camera',type:'takeover'},location.origin);},{capture:true,passive:true}));
  function syncControls(){
    $('amount').value=Math.round(targetAmount*100)+'%';
    $('explosion').value=String(Math.round(targetAmount*100));
    $('explosion').setAttribute('aria-valuetext',Math.round(targetAmount*100)+'% expanded');
    $('stage').dataset.selected=selected;
    $('stage').dataset.explosion=targetAmount.toFixed(3);
    document.querySelectorAll('[data-part]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.part===selected)));
  }
  function updateText(){
    const p=parts[selected];
    $('part-title').textContent=p.title;
    $('part-description').textContent=p.description;
    $('part-example').textContent=p.example?'Example: “'+p.example+'”':'';
    $('part-example').hidden=!p.example;
    $('label-en').textContent=p.en;
  }
  function fitView(){
    const aspect=$('stage').clientWidth/$('stage').clientHeight;
    // Leave the viewer's bottom chrome outside the article's clipped viewport.
    // Compensate the camera distance so the model retains its intended framing.
    const aspectScale=Math.max(1,1.5/aspect)*$('viewer').clientHeight/$('stage').clientHeight;
    if(selected==='all'||selected==='body'){
      // Compact separation and a padded orbit keep the upper controls in frame.
      desiredView={target:[0,-.017,.048+targetAmount*.035],distance:(.33+targetAmount*.17)*aspectScale,elevation:.25+targetAmount*.13};
    }else{
      const point=partPoint(selected,targetAmount);
      desiredView={target:[point[0]*.32,point[1]*.3-.014,point[2]*.45+.026],distance:.43*aspectScale,elevation:.38};
      angle=-.48;
    }
  }
  function partPoint(id,progress=actualPartAmount(id)){
    if(id==='body')return parts.body.anchor;
    const mesh=partsState[id].meshes[0];
    const point=mesh.base.slice(12,15).map((v,i)=>v+mesh.delta[i]*progress);
    return worldPoint(mesh.parentWorld,point);
  }
  function animateAmount(value){
    $('stage').dataset.settled='false';
    targetAmount=limit(value,0,1);
    Object.values(partsState).forEach(s=>s.from=s.progress);
    tween={start:performance.now(),from:amount,to:targetAmount,duration:reduced?0:700,selection:true};
    syncControls();fitView();
  }
  function selectPart(id){
    if(!ready||!parts[id])return;
    $('stage').dataset.settled='false';
    selected=id;spinDelay=performance.now()+4000;
    // A new selection returns the previous part while separating the selected one.
    Object.values(partsState).forEach(s=>s.from=s.progress);
    tween={start:performance.now(),from:amount,to:1,duration:reduced?0:750,selection:true};
    targetAmount=1;updateText();syncControls();fitView();
  }
  function setPose(progress,selectionTween,eased){
    for(const id of keys){
      if(id==='body')continue;
      const s=partsState[id];
      const end=selected==='all'||selected==='body'||selected===id?targetAmount:0;
      const p=selectionTween?(eased===1?end:s.from+(end-s.from)*eased):(selected==='all'||selected==='body'||selected===id?progress:0);
      // Always commit the exact endpoint; skipping a tiny final step leaves drift.
      if(p===s.progress)continue;
      s.progress=p;
      for(const mesh of s.meshes){
        const next=mesh.base.slice();
        for(let i=0;i<3;i++)next[12+i]+=mesh.delta[i]*p;
        api.setMatrix(mesh.node.instanceID,next,err=>{if(err)report(err)});
      }
    }
  }
  function cameraPosition(){return [target[0]+distance*Math.sin(angle)*Math.cos(elevation),target[1]-distance*Math.cos(angle)*Math.cos(elevation),target[2]+distance*Math.sin(elevation)]}
  function updateCamera(){if(ready)api.setCameraLookAt(cameraPosition(),target,0)}
  async function projectLabel(){
    if(!ready||projectionBusy)return;
    if(selected==='all'){ $('part-label').hidden=true;$('leaders').style.opacity=0;return }
    projectionBusy=true;const id=selected,gen=generation;
    try{
      const s=partsState[id];
      const point=partPoint(id,s.progress);
      const [center,anchor]=await Promise.all([project(target),project(point)]);
      if(id!==selected||gen!==generation)return;
      const w=$('stage').clientWidth,h=$('stage').clientHeight,c=center.canvasCoord,p=anchor.canvasCoord;
      if(!c||!p||c[0]<=0||c[1]<=0)return;
      const frame=$('viewer');
      const x=p[0]/(2*c[0])*frame.clientWidth+frame.offsetLeft,y=p[1]/(2*c[1])*frame.clientHeight+frame.offsetTop;
      const visible=x>10&&x<w-10&&y>40&&y<h-35;
      $('part-label').hidden=!visible;$('leaders').style.opacity=visible?1:0;
      if(!visible)return;
      const labelWidth=w<540?145:180;
      const right=x<w*.55;
      const lx=right?limit(x+70,20,w-labelWidth-16):limit(x-220,16,w-labelWidth-16);
      const ly=limit(y-75,62,h-100);
      $('part-label').style.left=lx+'px';$('part-label').style.top=ly+'px';
      const ex=right?lx:lx+Math.min($('part-label').offsetWidth,labelWidth),ey=ly+19;
      $('leader').setAttribute('d',`M ${x} ${y} L ${ex} ${ey}`);
      $('anchor').setAttribute('cx',x);$('anchor').setAttribute('cy',y);
    }catch(error){$('leaders').style.opacity=0;$('part-label').hidden=true}
    finally{projectionBusy=false}
  }
  function tick(time){
    requestAnimationFrame(tick);
    if(!ready||document.hidden||time-lastTick<33)return;
    const dt=Math.min(.05,(time-lastTick)/1000);lastTick=time;
    let changed=false;
    if(tween){
      const progress=tween.duration===0?1:limit((time-tween.start)/tween.duration,0,1),eased=1-Math.pow(1-progress,3);
      amount=tween.from+(tween.to-tween.from)*eased;setPose(amount,tween.selection,eased);
      if(progress===1){tween=null;$('stage').dataset.settled='true'}else $('stage').dataset.settled='false';
      changed=true;
    }
    if(desiredView&&!gestures.size){
      const mix=reduced?1:1-Math.exp(-dt*7);
      target=target.map((v,i)=>v+(desiredView.target[i]-v)*mix);
      distance+=(desiredView.distance-distance)*mix;elevation+=(desiredView.elevation-elevation)*mix;
      if(Math.abs(distance-desiredView.distance)<.00005&&target.every((v,i)=>Math.abs(v-desiredView.target[i])<.00005))desiredView=null;
      changed=true;
    }
    if(spinning&&!gestures.size&&time>spinDelay){angle+=dt*.10;changed=true}
    if(changed)updateCamera();
    if(time-lastProjection>70){lastProjection=time;projectLabel()}
  }
  async function init(){
    const gen=++generation;ready=false;errorCount=0;partsState={};loading.setState('loading');
    document.querySelectorAll('button:not(#retry):not(#audit),#explosion').forEach(b=>b.disabled=true);
    const fail=()=>{if(gen!==generation||ready)return;clearTimeout(timeout);loading.setState('failed');$('viewer').src='about:blank'};
    const timeout=setTimeout(fail,15000);
    if(!window.Sketchfab){fail();return}
    new Sketchfab($('viewer')).init('9de66868d0f240e985da00c9480bfc82',{autostart:1,preload:1,camera:0,autospin:0,ui_infos:0,ui_controls:0,ui_stop:0,ui_annotations:0,ui_hint:0,ui_watermark:0,ui_watermark_link:0,
      success(viewer){
        if(gen!==generation)return;api=viewer;
        api.addEventListener('viewerready',async()=>{
          if(gen!==generation)return;
          $('loading-text').textContent='正在准备模型部件';
          try{
            api.setUserInteraction(false);api.setEnableCameraConstraints(false,{preventCameraConstraintsFocus:true});
            api.setBackground({color:[224/255,224/255,224/255]});api.setFov(30);api.removeAllAnnotations();
            // Keep the model's original materials and textures in every selection state.
            const graph=await call('getSceneGraph');
            keys.forEach(id=>partsState[id]={meshes:[],progress:0,from:0});
            function visit(n,parent){
              const id=keys.find(k=>n.type==='MatrixTransform'&&parts[k].names.includes(n.name));
              if(id){
                const index=parts[id].names.indexOf(n.name);
                const offset=parts[id].offset.map((v,i)=>v+(parts[id].stagger?.[i]||0)*index);
                partsState[id].meshes.push({node:n,base:matrix(n.localMatrix),delta:offset,parentWorld:matrix(parent.worldMatrix)});
              }
              (n.children||[]).forEach(c=>visit(c,n));
            }
            visit(graph,null);
            if(keys.some(k=>partsState[k].meshes.length!==parts[k].names.length))throw new Error('A required separate component is unavailable');
            if(gen!==generation)return;
            selected='all';amount=targetAmount=0;tween=null;angle=-.52;elevation=.25;target=[0,-.024,.048];distance=.33;spinning=!reduced;spinDelay=0;
            ready=true;clearTimeout(timeout);loading.setState('ready');$('stage').dataset.settled='true';
            document.querySelectorAll('button,#explosion').forEach(b=>b.disabled=false);
            updateText();syncControls();fitView();updateCamera();
            parent.postMessage({channel:'bubble-camera',type:'ready'},location.origin);if(pendingRestore)restore(pendingRestore);
          }catch(error){report(error);fail()}
        });api.start();
      },error:fail
    });
  }
  document.querySelectorAll('[data-part]').forEach(b=>b.addEventListener('click',()=>{selectPart(b.dataset.part);reportState()}));
  $('explosion').addEventListener('input',e=>{if(!ready)return;spinDelay=performance.now()+4000;animateAmount(Number(e.target.value)/100);reportState()});
  $('retry').addEventListener('click',init);
  const controls=$('orbit');
  function startGesture(){
    const points=[...gestures.values()];
    gestureStart={points,angle,elevation,distance,pinch:points.length>1?Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y):0};
  }
  controls.addEventListener('pointerdown',e=>{if(!ready)return;gestures.set(e.pointerId,{x:e.clientX,y:e.clientY});controls.setPointerCapture(e.pointerId);controls.classList.add('dragging');desiredView=null;startGesture()});
  controls.addEventListener('pointermove',e=>{
    if(!gestures.has(e.pointerId))return;
    gestures.set(e.pointerId,{x:e.clientX,y:e.clientY});const points=[...gestures.values()];
    if(points.length>1&&gestureStart.pinch){const d=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);distance=limit(gestureStart.distance*gestureStart.pinch/d,.11,1.3)}
    else{const dx=points[0].x-gestureStart.points[0].x,dy=points[0].y-gestureStart.points[0].y;angle=gestureStart.angle-dx*.006;elevation=limit(gestureStart.elevation+dy*.005,-.6,1.25)}
    updateCamera();
  });
  function endGesture(e){reportState();gestures.delete(e.pointerId);if(gestures.size)startGesture();else{gestureStart=null;controls.classList.remove('dragging');spinDelay=performance.now()+3000}}
  controls.addEventListener('pointerup',endGesture);controls.addEventListener('pointercancel',endGesture);
  // Wheel and trackpad scrolling belong to the article, not the camera.
  controls.addEventListener('keydown',e=>{if(!ready)return;const actions={ArrowLeft:()=>angle+=.12,ArrowRight:()=>angle-=.12,ArrowUp:()=>elevation=limit(elevation+.1,-.6,1.25),ArrowDown:()=>elevation=limit(elevation-.1,-.6,1.25),'+':()=>distance=limit(distance*.9,.11,1.3),'=':()=>distance=limit(distance*.9,.11,1.3),'-':()=>distance=limit(distance*1.1,.11,1.3)};if(actions[e.key]){e.preventDefault();desiredView=null;actions[e.key]();reportState();spinDelay=performance.now()+3000;updateCamera()}});
  window.addEventListener('resize',()=>{if(ready){fitView();projectLabel()}});
  if(new URLSearchParams(location.search).has('qa'))$('qa').hidden=false;
  $('audit').addEventListener('click',async()=>{
    const results={ready,selected,amount,targetAmount,spinning,errorCount,camera:await call('getCameraLookAt'),parts:{}};
    for(const id of keys){
      const s=partsState[id];results.parts[id]={progress:s.progress,meshes:[]};
      for(const mesh of s.meshes){const m=await call('getMatrix',mesh.node.instanceID);results.parts[id].meshes.push({name:mesh.node.name,actual:m.local||m.localMatrix||m,base:mesh.base,delta:mesh.delta})}
    }
    $('audit-output').textContent=JSON.stringify(results,null,2);
  });
  requestAnimationFrame(tick);init();
})();
