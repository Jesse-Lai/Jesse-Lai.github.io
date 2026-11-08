const usPhases=[
{id:'before',name:'出发前',time:'材料与资格先准备',items:[
['documents','bank','备齐身份证明','护照、有效美签、身份证、本人信用卡。',['护照与 B1/B2 签证带原件，并保留电子备份。','身份证、印有本人姓名的国内信用卡作为第二证明备选；网点要求不同。','备好国内住址英文写法、职业、资金来源与已有税号信息。']],
['phone','bank','准备可长期保留的美国号码','能收银行验证码，并确认回国后的使用方式。',['别只买流量卡；确认号码可以接收银行短码短信。','检查手机的实体 SIM / eSIM、频段和运营商兼容性。','评论提到 Tello $5/月套餐，仅供询价；价格、激活和境外收码条件需向运营商确认。','使用可长期访问的邮箱，检查垃圾邮件；原帖推荐 Gmail。']],
['address','bank','落实地址与收卡安排','区分居住地址、邮寄地址和地址证明。',['向网点确认接受的居住与邮寄地址、租约或水电账单要求。','使用真实、可解释的资料；朋友收信地址不自动等于你的居住地址。','酒店、Airbnb、商业收件地址的受理经验不一致，别作为唯一方案。','实体卡约 7–10 天的案例较多；安排离境后仍可靠的收信人。','若确实需要办理本人账单，加名到出账可能约一个月；不得虚构居住关系。']],
['branch','bank','选好网点与办理时间','抵美后的前几天办理，预留补材料的工作日。',['优先联系符合行程的 BOA 或华美网点，预约普通话服务。','说明 B1/B2、实际居住国家以及是否有 SSN / ITIN，核对材料。','案例耗时约半小时至两小时；不预约成功不等于随时可办。','同一家银行网点要求也可能不同；确认被拒原因后再补件或换网点。'],'branches'],
['funds','bank','准备首存和维护余额','开户存款、免月费余额，是两项不同要求。',['BOA 实操案例首存 $500；同时开 checking 与 savings 的案例各存 $500。','华美案例先存 $100 激活、后存满 $1,500 免管理费，未注明产品。','SafeBalance 旧版文件：首存 $25，最低日余额 $500 可免月费。','提前核对产品与费用，并留出日常消费缓冲；不必为了组合开户多开账户。'],'fees'],
['eligibility','broker','先确认券商开户资格','按真实居住地核对 IBKR 或嘉信国际的申请条件。',['美国银行卡、号码和邮寄地址不等于美国长期居住资格。','原帖作者在大陆开过 IBKR，并强调境外长期居住证明；不是当前受理保证。','嘉信国际仅有评论线索；需核对地区准入、最低资金、税号及地址证明。','按官方清单准备身份、职业、资金来源、税务资料；不通过填写虚假地址获取资格。']]
]},
{id:'during',name:'在美国',time:'开户、验证与收卡',items:[
['activate','bank','激活号码，测试收码','确认短信和邮箱正常，再去银行。',['根据运营商要求完成激活；不要只测试上网。','确认国际漫游或 Wi-Fi Calling、银行验证码接收及保号续费方式。','入境后可保存 I-94 记录，供需要补件时使用。']],
['open','bank','到网点确认产品并开户','如实说明用途，保存准确的账户名称和条款。',['柜员可能询问用途、停留时间、离境后是否保留账户、预计存款。','询问产品名称、月费、最低日余额、账单周期、首存，以及额外费用。','checking、savings 分别确认，按需要选择；借记卡不等于信用卡。','核对姓名、地址、电话和税务资料；旅游签证不自动决定税务上的 NRA 身份。'],'questions'],
['online','bank','完成手机银行与数字卡设置','测试登录、验证；按需绑定 Apple Pay。',['自行设置登录信息与安全验证，确认能重新登录并收到验证码。','记录账号、ACH 与 wire 各自适用的 routing 信息，不要混用。','若提供 digital card，可现场绑定 Apple Pay；Zelle 以实际账户权限为准。','Paperless 是电子账单设置，不会取消未来收卡和重要信件的需要。']],
['receive','bank','确认实体卡寄送与激活','若行程只有一周，提前安排离境后的收件。',['案例收卡约 7、8、10 天；寄送时间不保证，问清加急及补寄方式。','收到后按官方流程激活、设置 PIN，并测试所需功能。','保存官方客服渠道和柜员联系方式；确认回国后能否保留账户、补卡及更新资料。']],
['brokerapply','broker','按官方清单申请券商账户','材料齐全再提交，银行开户不代表券商审核通过。',['确认开户实体、真实居住地适用的产品和交易权限。','区分邮寄地址证明、居住地址证明与长期居住资格材料。','按实际税务身份填写资料；适用时完成 W-8BEN，不照搬他人税务身份。','是否必须在美申请以券商规定为准；原帖没有完整逐步教程。']],
['transfer','broker','验证本人同名账户入出金','区分 ACH 与 wire，先核对费用和等待期。',['按券商官方指引绑定本人同名账户，避免第三方代收代付。','核对入金、提现、限额、到账与资金冻结期；条件确认后先做小额验证。','保存资金来源、汇款和对账记录；跨境汇款如实申报用途。','华美柜员提醒不要把银行账户仅作为大额资金快进快出的中转站。'],'fees']
]},
{id:'after',name:'回国后',time:'持续维护',items:[
['returntest','bank','回国后测试登录与验证码','银行、券商、手机号与邮箱都检查一次。',['确认在国内可登录，涉及转账时仍可完成验证。','开启号码自动续费或记录续费日期；替代验证未经确认前，不注销绑定号码。','“无需养号码”与实操反馈冲突，原帖作者称回国转券商仍需美国验证码。']],
['monthly','bank','每月检查余额、费用和通知','关注最低日余额，不只看月末余额。',['核对账户月费、陌生交易、最低余额与银行补件通知。','免月费条件只解决费用，不保证账户永久不受审查。','按真实需求使用；不为了养户制造流水，不把账户交给别人。','勾选此项代表已建立每月检查习惯，不代表以后无需检查。']],
['contact','bank','保持地址和资料有效','补卡、续卡和余额退回都可能需要收信。',['地址、邮箱、手机号或证件变化时，及时按机构要求更新。','纽约帖卡片有效期为五年，仅为该案例；卡片到期与账户关闭不同。','离开美国后仍保留可靠收件方式，并提前确认到期续卡地址。']],
['tax','broker','保存年度文件，检查税务资料','股息预扣税，不等于全部税务义务已完成。',['保存券商与银行对账单、收入及交易记录、年度税务文件。','按实际税务居民身份检查相关申报义务；美国账户不是免税工具。','留意 W-8BEN 等税务文件有效期和身份变化后的更新要求。','借记卡日常消费不等于建立美国信用评分。']],
['review','broker','定期检查券商与转账权限','居住地、税务身份变化后及时更新。',['检查券商补件请求、交易或出入金限制、银行绑定状态。','使用当前官方入金指引，保留转账记录；不要假定旧限额与旧费用永久有效。','申请与维护都应使用真实居住和税务信息。']],
['inactive','bank','不用的账户，主动处理','避免多年闲置；正式关闭前确认余额退回方式。',['长期闲置可能触发休眠、关闭或州无人认领财产流程。','出问题先向银行查明账户状态，必要时走官方财产查询与申领渠道。','决定停用时核对未结费用、待处理交易、余额退回及文件留存，再正式关户。']]
]}];
const sourceData=[['反杀巴菲特','LA闲逛&旅游签开户','6abd2455000000001802a6b1'],['Michelle2021','旅游签证在美国第一次新开银行账户','6ae0416a000000000e0366eb'],['YisM','B1/2无地址证明 · BoA最简攻略','6aa836170000000028034f83'],['Brucc Wu.','摩根开户，如果没有地址证明怎么办','6ae41c350000000027032b93'],['Jamie','美签 · 金融知识 · 银行卡','6a2e2d88000000001502784c'],['一分熟牛排','护照开户BOA美国银行半小时搞定','68dea3b20000000003036dd5']];
const panels={
branches:`<h2 class="panel-title">开户网点</h2><p>以下为原帖成功案例。材料、营业时间与服务语言请提前确认。</p><h3>洛杉矶 · BOA</h3><p class="address">850 N Broadway, Los Angeles, CA 90012</p><p>中文服务；作者称无需本人名下账单，需非酒店地址。约两小时，未预约。帖载周一至周五 9:00–16:00。</p><h3>圣何塞 · BOA</h3><p class="address">1695 Saratoga Ave, San Jose</p><p>作者带了租约和水电账单，但未被查看。经理 Dieu Dang，作者称其不会中文；可另预约普通话服务。</p><h3>纽约 · BOA</h3><p class="address">50 Bayard St, New York, NY 10013</p><p>中文服务；作者称未要求账单，半小时办完。配图为 SafeBalance 账户说明。</p><h3>洛杉矶 · 华美银行</h3><p>第一篇称在 Chinatown BOA 街对面，未给完整地址。案例首存 $100，后续 $1,500 免月费，产品未注明。</p><p>Monterey Park 也是第一篇柜员建议咨询的地区。Chase 那篇是求助帖，没有成功开户后续。</p>`,
fees:`<h2 class="panel-title">账户与费用</h2><p>原帖银行文件：2025 年 8 月版本。以下不是当前报价，办理前需重新确认。</p><h3>BOA Advantage SafeBalance</h3><table><tbody><tr><td>最低开户存款</td><td>$25</td></tr><tr><td>月维护费</td><td>$4.95</td></tr><tr><td>余额豁免</td><td>账单周期内最低日余额 ≥ $500</td></tr><tr><td>其他豁免</td><td>符合未满 25 岁条件，或 Preferred Rewards 等</td></tr><tr><td>个人纸质支票</td><td>不能签发</td></tr><tr><td>银行透支费</td><td>无；仍可能负余额或被商户收费</td></tr></tbody></table><p>$1,500 可能对应其他产品；“学生终身免月费”没有可靠支持。Savings 需另查条款。</p><h3>电汇 Wire</h3><table><thead><tr><th>转账方式</th><th>每笔费用</th></tr></thead><tbody><tr><td>美国境内汇入 / 汇出</td><td>$15 / $30</td></tr><tr><td>国际汇入</td><td>$15</td></tr><tr><td>国际以美元汇出</td><td>$45</td></tr><tr><td>国际以外币汇出</td><td>无 wire fee；有汇率加价及可能的其他费用</td></tr></tbody></table><h3>其他费用</h3><table><tbody><tr><td>BOA ATM</td><td>表列服务无 ATM 费</td></tr><tr><td>非 BOA ATM：境内 / 境外</td><td>$2.50 / $5；另可能有运营方费用</td></tr><tr><td>补卡 / 加急补卡</td><td>免费 / $15</td></tr><tr><td>账单副本</td><td>免费</td></tr><tr><td>止付 / Cashier’s check</td><td>$30 / $15，按适用条件</td></tr><tr><td>其他银行柜台现金支取</td><td>$5 或 3% 取较高者，上限 $10，按图中适用场景</td></tr></tbody></table><p>现金、工资直存和 wire 通常收到当天可用；支票可能涉及下一营业日及截止时间。超过 $6,725 的支票存款、新户前 30 天支票存款可能延长冻结。</p><p>“存 $20,000 自动免手续费”仅是会员权益线索，需问清资格、统计周期、减免范围及期限。开户奖励也需核对活动条款，不能预先计入收益。</p>`,
questions:`<h2 class="panel-title">柜台必问</h2><ol><li>我持 B1/B2，主要居住在中国，没有 / 有 SSN 或 ITIN。能开哪种账户？需要哪些原件和地址证明？</li><li>准确的产品名称是什么？首存、月费、最低日余额、账单周期分别是多少？</li><li>是否需要另开 savings？每个账户独立收费吗？</li><li>回中国后能继续使用吗？登录、转账、补件如何验证？</li><li>数字卡和实体卡如何获取？多久寄到？离境前没收到如何处理？</li><li>ACH 与 wire 的账号信息、限额、费用和等待期分别是什么？</li><li>以后如何更新地址、税务资料、证件和手机号？补卡或关户余额寄到哪里？</li></ol><h3>可以直接出示的英文</h3><p lang="en">I’m visiting on a B1/B2 visa and primarily reside in China. Which account can I open, and what documents do you need?</p><p lang="en">What is the exact account name, monthly fee, and minimum daily balance to waive it?</p><p lang="en">Can I keep and use the account after returning to China? How will I receive verification codes and replacement cards?</p>`,
sources:`<h2 class="panel-title">资料来源</h2><p>2026.11.05 整理。6 篇笔记、16 张配图及相关评论；不是银行或券商的现行开户承诺。</p><ol>${sourceData.map(([author,title,id])=>`<li><a href="https://www.xiaohongshu.com/explore/${id}" target="_blank" rel="noopener noreferrer">${title} ↗</a><br>${author}</li>`).join('')}</ol><p>网点、金额与案例来自原帖；持续维护与核对步骤为整理建议。券商部分尚缺完整的当前官方准入条件。</p>`};
function stepReference(panel,id){
 const clean=html=>html.replace(/<h2 class="panel-title">(.*?)<\/h2>/,'<h3>$1</h3>');
 if(panel!=='fees')return clean(panels[panel]);
 const wire=panels.fees.indexOf('<h3>电汇 Wire</h3>');
 const other=panels.fees.indexOf('<h3>其他费用</h3>');
 if(id==='transfer')return '<h3>电汇费用</h3><p>原帖银行文件：2025 年 8 月版本，办理前需确认当前费用。</p>'+panels.fees.slice(wire,other).replace('<h3>电汇 Wire</h3>','');
 return clean(panels.fees.slice(0,wire)+panels.fees.slice(other));
}
const key='america-accounts-checklist-v1';
let done={};
try{const saved=JSON.parse(localStorage.getItem(key)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))done=saved}catch{}
let region='us';
try{if(localStorage.getItem('accounts-region')==='hk')region='hk'}catch{}
let filter='all';
const list=document.querySelector('#checklist');
function sourcesFor(ids){return ids?.length?`<p class="step-sources">${ids.map(id=>{const [label,url]=hkSources[id];return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`}).join('')}<span>核对于 2026.11.08</span></p>`:''}
function render(){
 const phases=region==='hk'?hkPhases:usPhases;
 document.querySelectorAll('[data-region]').forEach(b=>{const active=b.dataset.region===region;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
 document.querySelector('.toolbar').hidden=region==='hk';
 list.innerHTML=phases.map((p,index)=>{
  const visible=p.items.filter(t=>filter==='all'||filter===t[1]);
  return `<section class="phase" id="${p.id}"><div class="phase-heading"><span class="phase-number">0${index+1}</span><h2>${p.name}</h2></div><div class="tasks">${visible.length?visible.map(([id,type,title,sub,body,panel,sources])=>`<article class="task"><input type="checkbox" id="${id}" ${done[id]?'checked':''} aria-label="完成：${title}"><div><details><summary><span class="task-title">${title}</span><span class="tag ${type}">${type==='bank'?'银行':'券商'}</span><span class="chevron" aria-hidden="true">›</span></summary><div class="task-body"><ul>${body.map(t=>`<li>${t}</li>`).join('')}</ul>${panel?`<div class="step-reference">${stepReference(panel,id)}</div>`:''}${sourcesFor(sources)}</div></details><p class="task-sub">${sub}</p></div></article>`).join(''):'<div class="empty">此阶段没有待显示事项。</div>'}</div></section>`
 }).join('');
}
function save(){try{localStorage.setItem(key,JSON.stringify(done))}catch{notify('浏览器暂时无法保存进度')}}
list.addEventListener('change',e=>{if(e.target.matches('input[type=checkbox]')){done[e.target.id]=e.target.checked;save()}});
function setFilter(value){filter=value;document.querySelectorAll('[data-filter]').forEach(b=>{const active=b.dataset.filter===value;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active))})}
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{setFilter(b.dataset.filter);render()});
document.querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>{
 if(region===b.dataset.region)return;
 region=b.dataset.region;setFilter('all');
 try{localStorage.setItem('accounts-region',region)}catch{}
 render();window.scrollTo({top:0,behavior:'instant'});
});
let timer;function notify(text){const t=document.querySelector('#toast');t.textContent=text;t.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>t.classList.remove('show'),2500)}
render();
