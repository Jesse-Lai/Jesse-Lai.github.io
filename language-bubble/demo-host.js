/* Independent, disposable app windows. The article never waits for a demo. */
(() => {
 'use strict';
 if(new URLSearchParams(location.search).get('demos')==='off')return;
 const order=['browser','reading','collage','correction','library','create','generation','steer','rewind','tokens','quiz','camera','word'];
 const original=Array.from(document.querySelectorAll('.wallpaper-stage'));
 if(original.length!==order.length){console.warn('Demo slots changed; keeping static images.');return;}
 // Insert before the following paragraph so the existing article copy remains untouched.
 const caption=document.getElementById('dissolve-caption');
 if(caption){const figure=document.createElement('figure');figure.className='case-image wallpaper wallpaper-stage';figure.id='interactive-dissolve';figure.dataset.wallpaper='alpine-lake';const source=document.getElementById('notion-image-retry-from-step')?.querySelector('a');if(source){figure.append(source.cloneNode(true));caption.after(figure);const index=order.indexOf('word');original.splice(index,0,figure);order.splice(index,0,'rewind');}}
 const mobile=matchMedia('(max-width: 700px)'),motion=matchMedia('(prefers-reduced-motion: reduce)');
 let serial=0,scheduled=false;
 const slots=original.map((stage,i)=>{
  const scene=order[i],fallback=stage.querySelector(':scope > a')||stage.querySelector(':scope > img');if(!fallback)return null;
  const width=['browser','reading'].includes(scene)?2048:scene==='correction'?1970:1728,height=['browser','reading'].includes(scene)?1127:scene==='correction'?1446:1117;
  const shell=document.createElement('div');shell.className='bubble-demo-shell';shell.style.aspectRatio=`${width}/${height}`;fallback.before(shell);shell.append(fallback);fallback.classList.add('demo-fallback');
  const slot={stage,shell,fallback,scene,width,height,id:`bubble-${i}`,frame:null,snapshot:null,ratio:0,near:false,ready:false,failed:false,played:false,taken:false,lastTouch:0,timer:0,deadline:0,request:0,retiring:false};
  stage.dataset.demoScene=scene;
  return slot;
 }).filter(Boolean);
 function send(slot,type,extra={}){slot.frame?.contentWindow?.postMessage({channel:'bubble-host',instance:slot.id,type,...extra},location.origin);}
 // Match the app's 32 px logical corner at every embed size, including fallbacks.
 function fit(slot){const scale=slot.shell.clientWidth/slot.width;slot.shell.style.setProperty('--demo-window-radius',`${32*scale}px`);if(slot.frame)slot.frame.style.transform=`scale(${scale})`;}
 function mount(slot){if(slot.frame||slot.failed||document.hidden||slots.filter(s=>s.frame).length>=(mobile.matches?1:2))return;
  const frame=document.createElement('iframe');frame.title=`Language Bubble · ${slot.scene} · 可交互演示`;frame.width=String(slot.width);frame.height=String(slot.height);frame.style.width=`${slot.width}px`;frame.style.height=`${slot.height}px`;frame.className='demo-frame';frame.setAttribute('allow','fullscreen');frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  frame.src=`demo/index.html?scene=${encodeURIComponent(slot.scene)}&instance=${slot.id}&v=token-resize-3x-v1`;slot.frame=frame;slot.retiring=false;slot.request=++serial;slot.ready=false;slot.shell.append(frame);fit(slot);
  slot.deadline=setTimeout(()=>fail(slot),12000);
 }
 function remove(slot){clearTimeout(slot.deadline);clearTimeout(slot.timer);slot.frame?.remove();slot.frame=null;slot.ready=false;slot.retiring=false;slot.shell.classList.remove('demo-ready');slot.fallback.inert=false;slot.fallback.removeAttribute('aria-hidden');}
 function retire(slot){if(!slot.frame||slot.retiring)return;slot.retiring=true;send(slot,'visibility',{visible:false});send(slot,'snapshot',{request:slot.request});const request=slot.request;setTimeout(()=>{if(slot.retiring&&slot.request===request){remove(slot);queue();}},200);}
 function fail(slot){slot.failed=true;remove(slot);queue();}
 function autoplay(slot){if(!slot.ready||slot.ratio<.25||slot.played||slot.taken||slot.timer||motion.matches||document.hidden)return;slot.timer=setTimeout(()=>{slot.timer=0;if(slot.ratio>=.25&&!slot.taken&&slot.frame&&!document.hidden){slot.played=true;send(slot,'autoplay');}},500);}
 function update(){scheduled=false;const cap=mobile.matches?1:2;
  const candidates=slots.filter(s=>s.near&&!s.failed).sort((a,b)=>Number(b.ratio>0)-Number(a.ratio>0)||b.ratio-a.ratio||b.lastTouch-a.lastTouch);
  const selected=document.hidden?[]:candidates.slice(0,cap);
  for(const slot of slots){const keep=selected.includes(slot);if(!keep&&slot.frame)retire(slot);else if(keep){if(slot.retiring){slot.retiring=false;slot.request=++serial;}if(!slot.frame&&slots.filter(s=>s.frame).length<cap)mount(slot);send(slot,'visibility',{visible:slot.ratio>0&&!document.hidden});autoplay(slot);}if(slot.ratio<.25||document.hidden){clearTimeout(slot.timer);slot.timer=0;}}
 }
 function queue(){if(!scheduled){scheduled=true;requestAnimationFrame(update);}}
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.channel!=='bubble-demo')return;const m=e.data,slot=slots.find(s=>s.id===m.instance&&s.frame?.contentWindow===e.source);if(!slot)return;
  if(m.type==='boot'){send(slot,'init',{snapshot:slot.snapshot,visible:slot.ratio>0&&!document.hidden});}
  if(m.type==='ready'){clearTimeout(slot.deadline);slot.ready=true;slot.shell.classList.add('demo-ready');slot.fallback.inert=true;slot.fallback.setAttribute('aria-hidden','true');autoplay(slot);}
  if(m.type==='takeover'){slot.taken=true;slot.played=true;slot.lastTouch=Date.now();clearTimeout(slot.timer);slot.timer=0;}
  if((m.type==='state'||m.type==='snapshot')&&m.snapshot?.version===1&&m.snapshot.scene===slot.scene){slot.snapshot=m.snapshot;if(m.type==='snapshot'&&slot.retiring&&m.request===slot.request){remove(slot);queue();}}
  if(m.type==='error')fail(slot);
 });
 const byStage=new Map(slots.map(s=>[s.stage,s]));
 const near=new IntersectionObserver(entries=>{entries.forEach(e=>{byStage.get(e.target).near=e.isIntersecting;});queue();},{rootMargin:'240px'});
 const visible=new IntersectionObserver(entries=>{entries.forEach(e=>{const slot=byStage.get(e.target);slot.ratio=e.intersectionRatio;});queue();},{threshold:[0,.01,.25,.5,.75,1]});
 const resize=new ResizeObserver(entries=>entries.forEach(e=>{const slot=slots.find(s=>s.shell===e.target);if(slot)fit(slot);}));
 slots.forEach(s=>{near.observe(s.stage);visible.observe(s.stage);resize.observe(s.shell);});
 document.addEventListener('visibilitychange',queue);mobile.addEventListener('change',queue);
 window.addEventListener('pagehide',()=>slots.forEach(remove));window.addEventListener('pageshow',queue);
})();
