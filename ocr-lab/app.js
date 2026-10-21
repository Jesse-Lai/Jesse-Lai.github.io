'use strict';
const D = window.EXPERIMENT;
const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = n => (n * 100).toFixed(2) + '%';
const labels = {corrected:'改对',regressed:'改错',both_correct:'双方都对',both_wrong:'双方仍错'};
const langLabels = {en:'英文',zh:'中文',mixed:'混合'};
const reviewLabels = {consistent:'目视一致',corrected:'预测前已修订',uncertain:'标签不确定 · 保留原标',not_audited:'未做本轮逐图审核'};
let activeStage = 'synthetic1', mode = 'normalized', page = 1, filtered = [], viewerList = [], viewerIndex = 0;
const pageSize = 12;

function renderHero() {
  $('hero-photos').innerHTML = D.hero.map((r,i)=>`<figure class="polaroid" role="button" tabindex="0" aria-label="查看首屏原图 ${escapeHTML(r.id)}" data-hero="${i}"><img src="${escapeHTML(r.image)}" alt="真实文字裁图：${escapeHTML(r.text)}"><figcaption>${['A little better.','One letter matters.','Still learning.'][i]}</figcaption></figure>`).join('');
  document.querySelectorAll('[data-hero]').forEach(el=>{
    const open=()=>openViewer(D.hero,Number(el.dataset.hero));
    el.addEventListener('click',open);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
  });
  $('training-strip').innerHTML=D.training.map(r=>`<figure class="training-sample"><a href="${escapeHTML(r.image)}" target="_blank" rel="noopener" aria-label="打开${escapeHTML(r.source)}训练原图"><img loading="lazy" src="${escapeHTML(r.image)}" alt="训练素材：${escapeHTML(r.text)}"></a><figcaption>${escapeHTML(r.source)}</figcaption><p>${escapeHTML(r.text)}</p></figure>`).join('');
}
function renderStage(id) {
  activeStage=id;
  const s=D.stages.find(s=>s.id===id);
  document.querySelectorAll('[role=tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.stage===id));b.tabIndex=b.dataset.stage===id?0:-1;});
  $('stage-panel').setAttribute('aria-labelledby','tab-'+id);
  const delta=s.after-s.before;
  $('stage-panel').innerHTML=`<div><span class="pill">${escapeHTML(s.tag)}</span><h3>${escapeHTML(s.title)}</h3><p class="stage-subtitle">${escapeHTML(s.subtitle)}</p><p class="stage-body">${escapeHTML(s.body)}</p><p class="stage-takeaway">${escapeHTML(s.takeaway)}</p><div class="stage-actions"><button class="text-button" id="browse-stage">浏览本阶段图片 ↗</button><a href="${escapeHTML(s.report)}" target="_blank" rel="noopener">原始报告 ↗</a></div></div><div class="stage-data"><h4>${escapeHTML(s.metric)} · 同题对照</h4>${[['原始底模',s.before,''],['该阶段候选',s.after,'candidate']].map(([name,n,cls])=>`<div class="chart-row"><div><span>${name}</span><b>${n.toFixed(2)}%</b></div><div class="bar-track"><div class="bar-fill ${cls}" style="width:${n}%"></div></div></div>`).join('')}<p class="stage-delta">${delta>0?'+':delta<0?'−':''}${Math.abs(delta).toFixed(2)} <small>个百分点</small></p><small>条形图使用完整 0–100% 尺度</small></div>`;
  $('browse-stage').addEventListener('click',()=>showGallery(id));
}
function setupTimeline() {
  $('timeline').innerHTML=D.stages.map((s,i)=>`<button id="tab-${s.id}" role="tab" aria-controls="stage-panel" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-stage="${s.id}"><span>STEP ${String(i+1).padStart(2,'0')}</span><i class="step-dot" aria-hidden="true"></i><b>${escapeHTML(s.label)}</b></button>`).join('');
  $('timeline').addEventListener('click',e=>{const b=e.target.closest('[data-stage]');if(b)renderStage(b.dataset.stage);});
  $('timeline').addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    e.preventDefault();let i=D.stages.findIndex(s=>s.id===activeStage);
    i=e.key==='Home'?0:e.key==='End'?5:(i+(e.key==='ArrowRight'?1:-1)+6)%6;
    renderStage(D.stages[i].id);$('tab-'+D.stages[i].id).focus();
  });
  renderStage(activeStage);
}
function renderResults() {
  const s=D.summary,b=s.combined.base[mode],c=s.combined.candidate[mode];
  $('base-score').innerHTML=(b.accuracy*100).toFixed(2)+'<small>%</small>';
  $('candidate-score').innerHTML=(c.accuracy*100).toFixed(2)+'<small>%</small>';
  $('base-correct').textContent=`${b.correct} / 1,600 张正确`;
  $('candidate-correct').textContent=`${c.correct} / 1,600 张正确`;
  $('score-delta').textContent=(c.accuracy<b.accuracy?'−':'+')+Math.abs((c.accuracy-b.accuracy)*100).toFixed(2)+' pp';
  $('metric-explanation').textContent=mode==='normalized'?'归一化：Unicode NFKC、忽略大小写与空白；保留标点，不转换简繁。':'严格：大小写、空格、标点、简繁全部计入。下方改对/改错、统计检验与验收条件仍对应预注册的归一化主指标。';
  $('batch-chart').innerHTML=Object.entries(s.batches).map(([batch,scores])=>`<p class="batch-label">批次 ${batch} <span>· 800 张</span></p>${['base','candidate'].map(name=>`<div class="batch-pair" aria-label="${batch} 批${name==='base'?'底模':'候选'}正确率 ${pct(scores[name][mode].accuracy)}"><div class="bar-track"><div class="bar-fill ${name==='candidate'?'candidate':''}" style="width:${scores[name][mode].accuracy*100}%"></div></div><span>${pct(scores[name][mode].accuracy)}</span></div>`).join('')}`).join('');
  const cb=s.combined.base,cc=s.combined.candidate;
  $('detail-metrics').innerHTML=`<table><caption class="visually-hidden">两种评分的字符错误率</caption><thead><tr><th>字符错误率 CER（越低越好）</th><th>底模</th><th>候选</th></tr></thead><tbody><tr><td>归一化</td><td>${pct(cb.normalized.cer)}</td><td>${pct(cc.normalized.cer)}</td></tr><tr><td>严格</td><td>${pct(cb.strict.cer)}</td><td>${pct(cc.strict.cer)}</td></tr></tbody></table><p class="caption">归一化字符编辑错误从 1,864 减至 1,863，只减少 1 次。</p><table><thead><tr><th>归一化分组</th><th>样本数</th><th>底模正确率</th><th>候选正确率</th></tr></thead><tbody>${Object.entries(cb.strata).flatMap(([field,groups])=>Object.entries(groups).map(([name,score])=>`<tr><td>${escapeHTML(langLabels[name]||name)}${field==='language'?' / 语言':' / 来源'}</td><td>${score.n}</td><td>${pct(score.accuracy)}</td><td>${pct(cc.strata[field][name].accuracy)}</td></tr>`)).join('')}</tbody></table><div class="checks">${[['两批正确率都提升',false],['合并至少提升 2pp',false],['p ≤ 0.025',false],['归一化 CER 下降',true],['严格 CER 不增加',true],['语言 / 来源护栏通过',true]].map(([name,pass])=>`<span class="${pass?'positive':'negative'}">${pass?'✓':'×'} ${name}</span>`).join('')}</div><p class="caption" style="margin-top:18px">原来源标签敏感性分析：56.625% → 56.625%。可确认或已修订子集（1,113 张）：71.34% → 71.07%。均未提供升级证据。分组护栏通过不等于每组已证实改善。</p>`;
}
function showGallery(stage,outcome='all') {
  $('gallery-stage').value=stage;$('gallery-outcome').value=outcome;$('gallery-language').value='all';$('gallery-search').value='';$('only-uncertain').checked=false;page=1;renderGallery();$('materials').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}
function filterGallery() {
  const stage=$('gallery-stage').value,outcome=$('gallery-outcome').value,language=$('gallery-language').value;
  const query=$('gallery-search').value.trim().normalize('NFKC').toLowerCase();
  const uncertain=stage==='confirmation'&&$('only-uncertain').checked;
  return D.sets[stage].filter(r=>(outcome==='all'||(outcome==='changed'?['corrected','regressed'].includes(r.outcome):r.outcome===outcome))&&(language==='all'||r.language===language)&&(!uncertain||r.review==='uncertain')&&(!query||[r.id,r.text,r.base,r.candidate,r.source].join(' ').normalize('NFKC').toLowerCase().includes(query))).sort((a,b)=>{
    const order={corrected:0,regressed:1,both_wrong:2,both_correct:3};return order[a.outcome]-order[b.outcome];
  });
}
function renderGallery() {
  const stage=$('gallery-stage').value,meta=D.stages.find(s=>s.id===stage);
  $('uncertain-control').hidden=stage!=='confirmation';
  filtered=filterGallery();const pages=Math.max(1,Math.ceil(filtered.length/pageSize));page=Math.min(page,pages);
  const current=filtered.slice((page-1)*pageSize,page*pageSize);
  $('gallery-count').textContent=`${meta.label} · ${filtered.length.toLocaleString()} / ${D.sets[stage].length.toLocaleString()} 组记录`;
  $('gallery-context').textContent=`答题变化按${meta.metric}分类。${stage==='confirmation'?'修订与不确定标记均来自预测前的标签审核。':stage==='synthetic2'?'本阶段使用已看过的 100 张旧题，仅作回归。':'样例保留当时评分标签；不同阶段不作绝对分数横向排名。'} 默认先显示改对、改错，再显示其余样本。`;
  $('gallery-grid').innerHTML=current.length?current.map((r,i)=>`<article class="sample-card"><div class="sample-meta"><span>${escapeHTML(r.source)} · ${escapeHTML(langLabels[r.language]||r.language)}${r.batch?' · '+r.batch+' 批':''}</span><span class="outcome ${r.outcome}">${labels[r.outcome]}</span></div><button class="sample-image" data-index="${(page-1)*pageSize+i}" aria-label="查看原图 ${escapeHTML(r.id)}"><img loading="lazy" src="${escapeHTML(r.image)}" alt="文字裁图：${escapeHTML(r.text)}"></button><div class="sample-answers">${[['标准',r.text,'gold'],['底模',r.base,''],['候选',r.candidate,'candidate']].map(([label,value,cls])=>`<div class="sample-answer ${cls}"><span>${label}</span><span>${escapeHTML(value||'（空输出）')}</span></div>`).join('')}</div><div class="sample-id"><span>${escapeHTML(r.id)}</span>${r.review==='uncertain'?'<span class="uncertain">标签不确定</span>':r.review==='corrected'?'<span>标签已修订</span>':''}</div></article>`).join(''):'<p class="empty">没有匹配的样本。试试清空搜索词，或调整筛选条件。</p>';
  $('page-status').textContent=`${page} / ${pages} 页`;
  $('previous-page').disabled=page===1;$('next-page').disabled=page>=pages;
}
function openViewer(list,index) {viewerList=list;viewerIndex=index;renderViewer();if(!$('image-dialog').open)$('image-dialog').showModal();}
function renderViewer() {
  const r=viewerList[viewerIndex];
  $('dialog-title').textContent=r.id;
  $('dialog-source').textContent=`${r.source} · ${langLabels[r.language]||r.language}${r.batch?' · '+r.batch+' 批':''} · ${labels[r.outcome]}`;
  $('dialog-photo').src=r.image;$('dialog-photo').alt=`原始文字裁图：${r.text}`;$('original-image').href=r.image;
  $('dialog-comparison').innerHTML=`<div class="dialog-answers">${[['评分标准',r.text],['底模输出',r.base],['候选输出',r.candidate]].map(([label,value])=>`<div><span>${label}</span><p>${escapeHTML(value||'（空输出）')}</p></div>`).join('')}</div><div class="dialog-audit">标签记录：${reviewLabels[r.review]}。${r.review==='corrected'?'<br>修订前来源标签：'+escapeHTML(r.original):''}${r.review==='uncertain'?'<br>原标签被保留；正确或错误仅表示按该评分标签判定，不代表图中文字已被可靠确认。':''}</div>`;
  $('dialog-previous').disabled=viewerIndex===0;$('dialog-next').disabled=viewerIndex===viewerList.length-1;
}
renderHero();setupTimeline();renderResults();
$('gallery-stage').innerHTML=D.stages.map(s=>`<option value="${s.id}" ${s.id==='confirmation'?'selected':''}>${escapeHTML(s.label)} · ${D.sets[s.id].length} 张</option>`).join('');
['gallery-stage','gallery-outcome','gallery-language','only-uncertain'].forEach(id=>$(id).addEventListener('change',()=>{page=1;renderGallery();}));
$('gallery-search').addEventListener('input',()=>{page=1;renderGallery();});
$('gallery-grid').addEventListener('click',e=>{const el=e.target.closest('[data-index]');if(el)openViewer(filtered,Number(el.dataset.index));});
$('previous-page').addEventListener('click',()=>{page--;renderGallery();$('gallery-grid').scrollIntoView({block:'start',behavior:'auto'});});
$('next-page').addEventListener('click',()=>{page++;renderGallery();$('gallery-grid').scrollIntoView({block:'start',behavior:'auto'});});
$('show-changes').addEventListener('click',()=>showGallery('confirmation','changed'));
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderResults();}));
$('close-dialog').addEventListener('click',()=>$('image-dialog').close());
$('dialog-previous').addEventListener('click',()=>{viewerIndex--;renderViewer();});
$('dialog-next').addEventListener('click',()=>{viewerIndex++;renderViewer();});
$('image-dialog').addEventListener('click',e=>{if(e.target===$('image-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('image-dialog').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'&&viewerIndex>0){e.preventDefault();viewerIndex--;renderViewer();}if(e.key==='ArrowRight'&&viewerIndex<viewerList.length-1){e.preventDefault();viewerIndex++;renderViewer();}});
renderGallery();
