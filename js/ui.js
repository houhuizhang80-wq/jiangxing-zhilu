/* ============================================================
   《将星之路》界面层
   ============================================================ */

let S = null;
let QUEUE = [];
let SETUP = null;
let TASK_RUN = null;

const $ = id => document.getElementById(id);
const CAT_ORDER = ['机会', '训练', '军事', '政治', '管理', '院校', '生活', '社交'];

/* ================= 军衔肩章 ================= */
function starPath(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 === 0 ? r : r * 0.42;
    pts.push((cx + rr * Math.cos(ang)).toFixed(1) + ',' + (cy + rr * Math.sin(ang)).toFixed(1));
  }
  return 'M' + pts.join('L') + 'Z';
}

function insigniaSVG(rankIdx, w) {
  const ins = RANK_INSIGNIA[rankIdx] || RANK_INSIGNIA[0];
  const W = w || 96, H = 30;
  const isGold = ins.style === 'gold' || ins.style === 'grand';
  const bg = isGold ? '#B8912B' : '#46543F';
  const fg = '#F2EEE2';
  const n = ins.stars;
  const cx0 = W / 2 - (n - 1) * 9;

  let marks = '';
  if (ins.style === 'grand') {
    // 大元帅：金色底板 + 一枚大星 + 两道金边
    marks += `<rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="5" fill="none" stroke="#FFF3C4" stroke-width="1"/>`;
    marks += `<path d="${starPath(W / 2, H / 2, 9)}" fill="#FFF8E1"/>`;
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;border-radius:6px"><rect width="${W}" height="${H}" rx="6" fill="${bg}"/>${marks}</svg>`;
  }
  if (ins.style === 'star' || ins.style === 'star2') {
    marks += `<rect x="11" y="6" width="4" height="${H - 12}" rx="1" fill="${fg}"/>`;
    if (ins.style === 'star2') marks += `<rect x="${W - 15}" y="6" width="4" height="${H - 12}" rx="1" fill="${fg}"/>`;
  }
  if (ins.style === 'bar' || ins.style === 'bar4') {
    marks += `<rect x="10" y="${H / 2 - 2}" width="${W - 20}" height="4" rx="1" fill="${fg}"/>`;
  }
  if (ins.style === 'chevr') {
    marks += `<path d="M${W / 2 - 14} ${H / 2 + 6} L${W / 2} ${H / 2 - 6} L${W / 2 + 14} ${H / 2 + 6}" fill="none" stroke="${fg}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  for (let i = 0; i < n; i++) {
    marks += `<path d="${starPath(cx0 + i * 18, H / 2, 6)}" fill="${fg}"/>`;
  }
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;border-radius:6px"><rect width="${W}" height="${H}" rx="6" fill="${bg}"/>${marks}</svg>`;
}

/* ================= 启动 ================= */
function init() {
  $('btnSkills').onclick = openSkills;
  $('btnHistory').onclick = openHistory;
  $('btnRank').onclick = openRanking;
  $('btnRoute').onclick = openRoute;
  $('btnAchv').onclick = openAchv;
  $('btnNetwork').onclick = openNetwork;
  $('btnRestart').onclick = () => {
    if (confirm('确定要放弃当前生涯，重新开始吗？')) { clearSave(); location.reload(); }
  };
  const saved = loadGame();
  if (saved && !saved.ended) {
    S = saved;
    if (!S.notified) S.notified = {};
    if (!S.rivals || !S.rivals.length) initRivals(S);
    beginTurn(S);
    renderAll();
  } else {
    renderSetup();
  }
}

/* ================= 角色创建 ================= */
function renderSetup() {
  const mottos = availableMottos();
  SETUP = { alloc: {}, traits: [], name: '', enlist: 'conscript', motto: mottos.length ? 'm_none' : null };
  ATTRS.forEach(a => { SETUP.alloc[a.key] = 0; });
  $('career').innerHTML = '<div class="career-item"><span class="k">状态</span><span class="v">待入伍</span></div>';
  $('sidebar').innerHTML = '';
  $('meritWrap').style.visibility = 'hidden';
  drawSetup();
}

function setupAllocMax() {
  const en = ENLIST_TYPES[SETUP.enlist];
  let n = en.alloc;
  if (SETUP.motto) {
    const m = MOTTOS.find(x => x.id === SETUP.motto);
    if (m && m.alloc) n += m.alloc;
  }
  return n;
}

function drawSetup() {
  const en = ENLIST_TYPES[SETUP.enlist];
  const max = setupAllocMax();
  const used = ATTRS.reduce((n, a) => n + SETUP.alloc[a.key], 0);
  const left = max - used;

  const enlistCards = Object.keys(ENLIST_TYPES).map(k => {
    const e = ENLIST_TYPES[k];
    return `<button class="enlist-card ${SETUP.enlist === k ? 'on' : ''}" onclick="setupEnlist('${k}')">
      <div class="ec-name">${e.name}</div>
      <div class="ec-desc">${e.desc}</div>
      <div class="ec-meta">可分配点数 ${e.alloc}${e.sp ? ' · 初始技能点 ' + e.sp : ''}${e.startRank ? ' · 起始军衔 ' + RANKS[e.startRank].name : ''}</div>
    </button>`;
  }).join('');

  const mottos = availableMottos();
  const rec = legacySummary();
  const legacyBlock = mottos.length ? `
    <div class="alloc-head" style="margin-top:22px">
      <h3>继承家训</h3>
      <span class="pts">来自${rec.last.name}（${rec.last.rankName} · ${rec.last.ending}）</span>
    </div>
    <div class="motto-pick">
      ${mottos.map(m => `
        <button class="motto-opt ${SETUP.motto === m.id ? 'on' : ''}" onclick="setupMotto('${m.id}')">
          <div class="mo-name">${m.name}</div>
          <div class="mo-desc">${m.desc}</div>
        </button>`).join('')}
    </div>` : '';

  const allocRows = ATTRS.map(a => {
    const v = SETUP.alloc[a.key];
    const base = ATTR_BASE + v + (en.mods[a.key] || 0);
    const mod = en.mods[a.key] || 0;
    return `
      <div class="alloc-row">
        <div class="an">${a.name}</div>
        <div class="ad">${a.desc}${mod ? ` <b style="color:${mod > 0 ? 'var(--olive)' : 'var(--red)'}">(${mod > 0 ? '+' : ''}${mod})</b>` : ''}</div>
        <div class="alloc-ctrl">
          <button onclick="setupAlloc('${a.key}',-1)" ${v <= 0 ? 'disabled' : ''}>−</button>
          <div class="av">${base}</div>
          <button onclick="setupAlloc('${a.key}',1)" ${(left <= 0 || v >= ATTR_ALLOC_MAX + 4) ? 'disabled' : ''}>+</button>
        </div>
      </div>`;
  }).join('');

  const traitOpts = TRAITS.map(t => `
    <button class="trait-opt ${SETUP.traits.indexOf(t.key) >= 0 ? 'on' : ''}" onclick="setupTrait('${t.key}')">
      <div class="t-name">${t.name}</div>
      <div class="t-desc">${t.desc}</div>
    </button>`).join('');

  $('main').innerHTML = `
    <div class="card">
      <div class="card-head">入伍登记</div>
      <div class="card-body">
        <div class="alloc-head"><h3>入伍方式</h3><span class="pts">${en.name}</span></div>
        <div class="enlist-pick">${enlistCards}</div>

        <div class="setup-name" style="margin-top:20px">
          <label>姓名</label>
          <input id="inName" maxlength="8" placeholder="请输入你的名字" value="${SETUP.name.replace(/"/g, '&quot;')}"
                 oninput="SETUP.name=this.value" />
        </div>

        <div class="alloc-head"><h3>基础属性分配</h3><span class="pts">剩余 ${left} / ${max} 点</span></div>
        ${allocRows}

        <div class="alloc-head" style="margin-top:22px">
          <h3>性格特质（选 3 个）</h3><span class="pts">已选 ${SETUP.traits.length} / 3</span>
        </div>
        <div class="trait-pick">${traitOpts}</div>
        ${legacyBlock}

        <div style="margin-top:24px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button class="btn primary lg" onclick="startGame()">应征入伍</button>
          <button class="btn" onclick="setupRandom()">随机分配</button>
          <span style="font-size:12px;color:var(--text-3)">18 岁入伍，52 个回合，从列兵到上将${rec && rec.runs ? '　·　第 ' + (rec.runs + 1) + ' 周目' : ''}</span>
        </div>
      </div>
    </div>`;
}

function setupEnlist(k) {
  SETUP.enlist = k;
  const max = setupAllocMax();
  const used = ATTRS.reduce((n, a) => n + SETUP.alloc[a.key], 0);
  while (used > max) {
    for (const a of ATTRS) {
      if (SETUP.alloc[a.key] > 0) { SETUP.alloc[a.key]--; break; }
    }
    break;
  }
  drawSetup();
}

function setupMotto(id) {
  SETUP.motto = SETUP.motto === id ? null : id;
  drawSetup();
}

function setupAlloc(key, d) {
  const used = ATTRS.reduce((n, a) => n + SETUP.alloc[a.key], 0);
  const max = setupAllocMax();
  const v = SETUP.alloc[key];
  if (d > 0 && (used >= max || v >= ATTR_ALLOC_MAX + 4)) return;
  if (d < 0 && v <= 0) return;
  SETUP.alloc[key] = v + d;
  drawSetup();
}
function setupTrait(key) {
  const i = SETUP.traits.indexOf(key);
  if (i >= 0) SETUP.traits.splice(i, 1);
  else if (SETUP.traits.length < 3) SETUP.traits.push(key);
  drawSetup();
}
function setupRandom() {
  const keys = ATTRS.map(a => a.key);
  ATTRS.forEach(a => { SETUP.alloc[a.key] = 0; });
  let left = setupAllocMax();
  while (left > 0) {
    const k = keys[Math.floor(Math.random() * keys.length)];
    if (SETUP.alloc[k] < ATTR_ALLOC_MAX + 4) { SETUP.alloc[k]++; left--; }
  }
  const pool = TRAITS.map(t => t.key);
  SETUP.traits = [];
  while (SETUP.traits.length < 3) {
    SETUP.traits.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  drawSetup();
}

function startGame() {
  const name = ($('inName') ? $('inName').value : SETUP.name).trim();
  if (!name) { alert('请先输入姓名'); return; }
  if (SETUP.traits.length !== 3) { alert('请选择 3 个性格特质'); return; }
  const used = ATTRS.reduce((n, a) => n + SETUP.alloc[a.key], 0);
  if (used < setupAllocMax()) { alert('还有 ' + (setupAllocMax() - used) + ' 点属性未分配'); return; }

  const rec = legacySummary();
  S = newGame(name, SETUP.alloc, SETUP.traits, {
    enlist: SETUP.enlist,
    motto: SETUP.motto,
    legacy: !!(rec && rec.runs),
    prename: rec && rec.last ? rec.last.name : ''
  });
  $('meritWrap').style.visibility = 'visible';
  beginTurn(S);
  saveGame(S);
  renderAll();
}

/* ================= 渲染 ================= */
function renderAll() {
  renderTop();
  renderSidebar();
  renderMain();
}

function renderTop() {
  const rank = RANKS[S.rankIdx];
  const st = STAGES[S.stage];
  const rk = myRank(S);
  const route = S.route ? ROUTES[S.route] : null;
  const en = ENLIST_TYPES[S.enlist] || ENLIST_TYPES.conscript;
  const motto = S.mottoId ? MOTTOS.find(m => m.id === S.mottoId) : null;
  $('career').innerHTML = `
    <div class="career-item"><span class="k">姓名</span><span class="v">${S.name}${motto ? ` <span class="mini-tag">${motto.name}</span>` : ''}</span></div>
    <div class="career-item"><span class="k">出身</span><span class="v">${en.short}</span></div>
    <div class="career-item"><span class="k">军衔</span><span class="v rank">${rank.name}</span></div>
    <div class="career-item"><span class="k">年龄</span><span class="v">${S.age} 岁</span></div>
    <div class="career-item"><span class="k">阶段</span><span class="v">${st.name}</span></div>
    ${route
      ? `<div class="career-item"><span class="k">路线</span><span class="v" style="color:${route.color}">${route.short}</span></div>`
      : `<div class="career-item"><span class="k">路线</span><span class="v" style="color:var(--text-3)">未定</span></div>`}
    <div class="career-item"><span class="k">同期位次</span><span class="v ${rk.pos <= 2 ? 'good' : rk.pos >= 7 ? 'bad' : ''}">第 ${rk.pos} / ${rk.total}</span></div>
    <div class="insignia">${insigniaSVG(S.rankIdx, 84)}</div>`;

  const next = RANKS[S.rankIdx + 1];
  const capReached = next && (S.rankIdx + 1) > st.maxRank;
  let pct = 100, label = '已达最高军衔';

  if (next && !capReached) {
    const need = effectiveNeed(S, S.rankIdx + 1);
    const cur = rank.need;
    pct = clamp((S.merit - cur) / (need - cur) * 100, 0, 100);
    label = `距 ${next.name} 还需 ${Math.max(0, Math.ceil(need - S.merit))} 功勋`;
    if (need !== next.need) {
      label += rk.pos <= 3 ? '（位次靠前，门槛已下调）' : rk.pos >= 6 ? '（位次偏后，门槛已上调）' : '';
    }
    if (S.merit >= need) {
      const gate = RANK_GATES[S.rankIdx + 1];
      const miss = [];
      if (gate) {
        if (gate.prestige && S.st.prestige < gate.prestige) miss.push(`威望 ${Math.round(S.st.prestige)}/${gate.prestige}`);
        if (gate.disc && S.dv.discipline < gate.disc) miss.push(`纪律 ${Math.round(S.dv.discipline)}/${gate.disc}`);
        if (gate.heir && (S.heir || 0) < gate.heir) miss.push(`接班人 ${S.heir || 0}/${gate.heir}`);
        if (gate.deeds && greatDeeds(S) < gate.deeds) miss.push(`重大功勋 ${greatDeeds(S)}/${gate.deeds}`);
      }
      if (discGrade(S.dv.discipline).freeze) miss.push('作风纪律不合格');
      routeGateMiss(S, S.rankIdx + 1).forEach(m => miss.push(m));
      label = miss.length ? `功勋已达标，尚缺：${miss.join(' · ')}` : `${next.name} 条件已满足，等待授衔`;
    }
  } else if (next && capReached) {
    label = `本阶段最高军衔为 ${RANKS[st.maxRank].name}，功勋继续累积`;
    pct = 100;
  }
  $('meritFill').style.width = pct + '%';
  $('meritLabel').innerHTML = `<span>功勋 ${Math.round(S.merit)}</span><span>${label}</span>`;
}

function bar(name, val, max, cls, hint) {
  const pct = clamp(val / max * 100, 0, 100);
  return `
    <div class="stat-row">
      <div class="stat-top"><span class="name">${name}</span><span class="val">${Math.round(val)}</span></div>
      <div class="stat-track"><div class="stat-fill ${cls}" style="width:${pct}%"></div></div>
      ${hint ? `<div class="stat-hint">${hint}</div>` : ''}
    </div>`;
}

function renderSidebar() {
  const g = discGrade(S.dv.discipline);
  const attrHTML = ATTRS.map(a => bar(a.name, S.attr[a.key], 110, 'attr', '')).join('');
  const dvHTML = DERIVED.map(d => bar(d.name, S.dv[d.key], 110, 'derived', '')).join('')
    + bar('作风纪律', S.dv.discipline, 110, 'disc', `当前等级：<b>${g.name}</b>`);
  const stHTML = [
    bar('士气', S.st.morale, 100, 'morale'),
    bar('健康', S.st.health, 100, 'health'),
    bar('威望', S.st.prestige, 100, 'prestige'),
    bar('首长信任', S.st.trust, 100, 'trust'),
    bar('搭档默契', S.st.bond, 100, 'bond'),
    bar('家庭', S.st.family, 100, 'family')
  ].join('');
  const traitHTML = S.traits.map(k => {
    const t = TRAIT_MAP[k];
    return `<span class="trait-chip" title="${t.desc}">${t.name}</span>`;
  }).join('');

  $('sidebar').innerHTML = `
    <div class="card">
      <div class="card-head"><span>基础属性</span><span>上限 110</span></div>
      <div class="card-body">${attrHTML}</div>
    </div>
    <div class="card">
      <div class="card-head"><span>派生指标</span></div>
      <div class="card-body">${dvHTML}</div>
    </div>
    <div class="card">
      <div class="card-head"><span>状态</span></div>
      <div class="card-body">${stHTML}</div>
    </div>
    <div class="card">
      <div class="card-head"><span>性格特质</span><span>技能点 ${S.sp}</span></div>
      <div class="card-body"><div class="trait-list">${traitHTML}</div></div>
    </div>`;
}

function renderMain() {
  const st = STAGES[S.stage];
  const t = currentTurn(S) || { label: '第 ' + S.year + ' 年', year: S.year };
  const acts = availableActions(S);
  const rk = myRank(S);

  const groups = {};
  acts.forEach(a => { (groups[a.cat] = groups[a.cat] || []).push(a); });

  const groupsHTML = CAT_ORDER.filter(c => groups[c]).map(c => `
    <div>
      <div class="action-group-title">${c}${c === '机会' ? ' · 本回合限定，过期作废' : ''}</div>
      <div class="action-grid">
        ${groups[c].map(a => {
          const used = S.usedActions[a.id] || 0;
          const lim = c === '机会' ? 1 : 2;
          const dis = S.ap < a.ap || used >= lim;
          return `
            <button class="action ${c === '机会' ? 'opp' : ''}" ${dis ? 'disabled' : ''} onclick="onAction('${a.id}')">
              <div class="a-top"><span class="a-name">${a.name}</span><span class="a-ap">${a.ap} AP</span></div>
              <div class="a-desc">${describeFx(a.fx, ACTION_SCALE)}</div>
              ${used ? `<span class="a-count">×${used}</span>` : ''}
            </button>`;
        }).join('')}
      </div>
    </div>`).join('');

  const pips = Array.from({ length: S.apMax }, (_, i) => `<span class="ap-pip ${i < S.ap ? 'on' : ''}"></span>`).join('');

  $('main').innerHTML = `
    <div class="card">
      <div class="card-body">
        <div class="turn-head">
          <div>
            <div class="turn-title">${t.label} · <span class="stage">${st.name}</span></div>
            <div class="turn-sub">${st.desc}</div>
          </div>
          <div class="ap-box">
            <span class="ap-num">行动点</span>
            <div class="ap-pips">${pips}</div>
            <span class="ap-num">${S.ap} / ${S.apMax}</span>
            <button class="btn" onclick="onAutoArrange()">自动安排</button>
            <button class="btn primary" onclick="onEndTurn()">结束回合</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <span>本回合安排</span>
        <span>重复同一行动效果递减 · 同期位次 第 ${rk.pos}/${rk.total}</span>
      </div>
      <div class="card-body"><div class="action-groups">${groupsHTML}</div></div>
    </div>

    <div class="card">
      <div class="card-head"><span>生涯日志</span><span>共 ${S.log.length} 条</span></div>
      <div class="card-body">
        <div class="log-list">
          ${S.log.slice(0, 40).map(l => `
            <div class="log-item ${l.kind}">
              <span class="ly">第${l.year}年</span>
              <span><b>${l.title}</b> · ${l.text}</span>
            </div>`).join('') || '<div class="empty">还没有记录。</div>'}
        </div>
      </div>
    </div>`;
}

/* ================= 行动 ================= */
function onAction(id) {
  const r = doAction(S, id);
  if (!r.ok) return;
  renderTop(); renderSidebar(); renderMain();
}
function onAutoArrange() {
  autoSpendAP(S);
  renderTop(); renderSidebar(); renderMain();
}
function onEndTurn() {
  const res = finishTurn(S);
  QUEUE = res.queue || [];
  saveGame(S);
  if (res.finished) { showEnding(); return; }
  processQueue();
}

/* ================= 队列 ================= */
function processQueue() {
  if (S.ended) { showEnding(); return; }
  if (QUEUE.length === 0) {
    beginTurn(S);
    saveGame(S);
    renderAll();
    return;
  }
  const item = QUEUE.shift();
  if (item.type === 'stage') showStage(item.data);
  else if (item.type === 'echo') showEcho(item.data);
  else if (item.type === 'route') showRouteChoice();
  else if (item.type === 'event') showEvent(item.data);
  else if (item.type === 'task') showTask(item.data);
  else if (item.type === 'promotion') showPromotion(item.data);
  else processQueue();
}

/* ================= 成长路线 ================= */
function routeCards() {
  return Object.keys(ROUTES).map(k => {
    const r = ROUTES[k];
    const branch = SKILL_BRANCHES.find(b => b.key === r.branch);
    const acts = ROUTE_ACTIONS.filter(a => a.route === k).map(a => a.name).join(' · ');
    return `
      <button class="route-card" style="border-left-color:${r.color}" onclick="onChooseRoute('${k}')">
        <div class="rc-head">
          <span class="rc-name">${r.name}</span>
          <span class="rc-tag">核心指标：${r.statName} · ${r.extraName}</span>
        </div>
        <div class="rc-desc">${r.desc}</div>
        <div class="rc-line"><b>专属行动</b>${acts}</div>
        <div class="rc-line"><b>技能折扣</b>${branch ? branch.name : ''} 升级消耗 −1 点</div>
        <div class="rc-line"><b>任务加成</b>关键技能属于本路线时判定 +9</div>
        <div class="rc-line"><b>晋升要求</b>少将起需 ${r.statName} ≥ ${r.gateNeeds[0]}、${r.extraName} ≥ ${r.extraNeeds[0]}</div>
        <div class="rc-motto">「${r.motto}」</div>
      </button>`;
  }).join('');
}

function showRouteChoice() {
  openModal(`
    <div class="modal-head">
      <div class="kicker">生涯抉择 · 第 ${S.year} 年</div>
      <h2>选择你的成长路线</h2>
    </div>
    <div class="modal-body">
      <div class="narrative">你从军士成长为军官，接下来要走哪条路，将决定后面三十年的方向。<b>主干一旦定下就基本锁定</b>——中途转线的代价很大。</div>
      <div class="route-list">${routeCards()}</div>
    </div>`, true);
}

function onChooseRoute(key) {
  chooseRoute(S, key);
  closeModal();
  saveGame(S);
  renderAll();
  processQueue();
}

function openRoute() {
  if (!S.route) {
    openModal(`
      <div class="modal-head"><div class="kicker">成长路线</div><h2>尚未选定路线</h2></div>
      <div class="modal-body"><div class="narrative">进入尉官期后会面临路线抉择。</div></div>
      <div class="modal-foot"><button class="btn primary" onclick="closeModal()">关闭</button></div>`);
    return;
  }
  const r = ROUTES[S.route];
  const branch = SKILL_BRANCHES.find(b => b.key === r.branch);
  const acts = ROUTE_ACTIONS.filter(a => a.route === S.route).map(a => a.name).join(' · ');
  const canSwitch = !S.routeSwitched && S.merit >= ROUTE_SWITCH_COST.merit;
  const others = Object.keys(ROUTES).filter(k => k !== S.route).map(k => {
    const o = ROUTES[k];
    return `<button class="route-switch" ${canSwitch ? '' : 'disabled'} onclick="onSwitchRoute('${k}')">
      <span class="rs-name" style="color:${o.color}">转为${o.name}</span>
      <span class="rs-cost">代价：功勋 −${ROUTE_SWITCH_COST.merit} · 威望 −${ROUTE_SWITCH_COST.prestige}</span>
    </button>`;
  }).join('');

  const tierNames = ['少将', '中将', '上将'];
  const gateRows = tierNames.map((n, i) => `
    <div class="route-gate">
      <span class="rg-rank">${n}</span>
      <span class="rg-need">${r.statName} ≥ ${r.gateNeeds[i]}</span>
      <span class="rg-need">${r.extraName} ≥ ${r.extraNeeds[i]}</span>
    </div>`).join('');

  openModal(`
    <div class="modal-head"><div class="kicker">成长路线</div><h2>${r.name}</h2></div>
    <div class="modal-body">
      <div class="narrative">${r.desc}<br>「${r.motto}」</div>
      <div class="route-meta">
        <div class="rm-row"><b>专属行动</b><span>${acts}</span></div>
        <div class="rm-row"><b>技能折扣</b><span>${branch ? branch.name : ''} 升级消耗 −1 点</span></div>
        <div class="rm-row"><b>任务加成</b><span>关键技能属于本路线时判定 +9</span></div>
      </div>
      <h3 style="font-size:13px;margin:18px 0 10px">晋升指标要求</h3>
      <div class="route-gates">${gateRows}</div>
      ${S.routeSwitched
        ? '<div class="hint-line">你已经转过一次线，不能再转了。</div>'
        : `<h3 style="font-size:13px;margin:18px 0 10px">转线（全生涯仅一次）</h3><div class="route-switch-list">${others}</div>`}
    </div>
    <div class="modal-foot"><button class="btn primary" onclick="closeModal()">关闭</button></div>`, true);
}

function onSwitchRoute(key) {
  const r = switchRoute(S, key);
  if (!r.ok) { alert(r.reason || '无法转线'); return; }
  saveGame(S);
  openRoute();
  renderAll();
}

/* ================= 弹窗基础 ================= */
function openModal(html, wide) {
  $('modalRoot').innerHTML = `<div class="overlay"><div class="modal ${wide ? 'wide' : ''}">${html}</div></div>`;
}
function closeModal() { $('modalRoot').innerHTML = ''; }

function rewardChips(changes) {
  if (!changes || !changes.length) return '';
  return changes.filter(c => Math.abs(c.v) >= 0.5).map(c => {
    const v = Math.round(c.v);
    const cls = c.label === '功勋' && v > 0 ? 'gold' : v < 0 ? 'bad' : '';
    return `<span class="reward ${cls}">${c.label} ${v > 0 ? '+' : ''}${v}</span>`;
  }).join('');
}

/* ================= 阶段推进 ================= */
function showStage(st) {
  openModal(`
    <div class="modal-head"><div class="kicker">阶段推进</div><h2>${st.name}</h2></div>
    <div class="modal-body">
      <div class="narrative">${st.desc}</div>
      <div class="reward-list">
        <span class="reward">每回合行动点 ${st.ap}</span>
        <span class="reward">时间粒度：${st.turnLabel}</span>
        <span class="reward gold">最高军衔：${RANKS[st.maxRank].name}</span>
      </div>
    </div>
    <div class="modal-foot"><button class="btn primary" onclick="closeModal();processQueue()">继续</button></div>`);
}

/* ================= 回响 ================= */
function showEcho(rule) {
  const chips = [];
  const fx = rule.fx || {};
  ['attr', 'dv', 'st'].forEach(g => {
    if (!fx[g]) return;
    Object.keys(fx[g]).forEach(k => {
      const name = g === 'attr' ? ATTR_NAME[k] : g === 'dv' ? DV_NAME[k] : ST_NAME[k];
      chips.push({ label: name || k, v: fx[g][k] });
    });
  });
  openModal(`
    <div class="modal-head"><div class="kicker">往事回响</div><h2>因果</h2></div>
    <div class="modal-body">
      <div class="narrative">${rule.text}</div>
      <div class="reward-list">${rewardChips(chips) || '<span class="reward">没有立即显现的变化</span>'}</div>
    </div>
    <div class="modal-foot"><button class="btn primary" onclick="closeModal();processQueue()">继续</button></div>`);
}

/* ================= 成就 ================= */
function openAchv() {
  const store = loadAchv();
  const got = store.unlocked || [];
  const rows = ACHIEVEMENTS.map(a => {
    const on = got.indexOf(a.id) >= 0;
    return `<div class="achv-row ${on ? 'on' : ''}">
      <span class="ar-mark">${on ? '★' : '☆'}</span>
      <span class="ar-name">${a.name}</span>
      <span class="ar-desc">${on ? a.desc : '？？？'}</span>
    </div>`;
  }).join('');
  openModal(`
    <div class="modal-head">
      <div class="kicker">成就</div>
      <h2>已解锁 ${got.length} / ${ACHIEVEMENTS.length}　·　已进行 ${store.runs || 0} 周目</h2>
    </div>
    <div class="modal-body">
      <div class="achv-list">${rows}</div>
      <div class="hint-line">成就会跨周目累积保存。想清空记录请点下方按钮。</div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="onResetAchv()">清空成就与传承</button>
      <button class="btn primary" onclick="closeModal()">关闭</button>
    </div>`, true);
}

function onResetAchv() {
  if (!confirm('确定要清空所有成就与传承记录吗？此操作不可撤销。')) return;
  resetAchv();
  closeModal();
}

/* ================= 事件 ================= */
function showEvent(ev) {
  const opts = ev.options.map((o, i) => `
    <button class="opt ${o.risky ? 'risky' : ''}" onclick="onEventOption(${i})">
      <div class="o-label">${o.label}</div>
      <div class="o-hint">${o.hint || ''}</div>
    </button>`).join('');
  openModal(`
    <div class="modal-head">
      <div class="kicker">抉择 · 第 ${S.year} 年${ev.chained ? ' · 后续' : ''}${ev.legacyOnly ? ' · 家风' : ''}</div>
      <h2>${ev.title}</h2>
    </div>
    <div class="modal-body">
      <div class="narrative">${fillNames(S, ev.text)}</div>
      ${opts}
      <div class="hint-line">提示：括号内为可预期的显性收益与代价；隐藏后果由你的信念、性格与口碑决定。</div>
    </div>`);
  window.__curEvent = ev;
}

function onEventOption(i) {
  const ev = window.__curEvent;
  const opt = ev.options[i];
  const r = applyOption(S, ev, opt);
  const all = r.changes.concat(r.hiddenChanges || []);
  openModal(`
    <div class="modal-head"><div class="kicker">结果</div><h2>${ev.title}</h2></div>
    <div class="modal-body">
      <div class="narrative">${r.hiddenNote ? '事情没有按你想的方向走——' + r.hiddenNote + '。' : '你的选择已经做出，结果随之而来。'}</div>
      <div class="reward-list">${rewardChips(all) || '<span class="reward">没有立即显现的变化</span>'}</div>
    </div>
    <div class="modal-foot"><button class="btn primary" onclick="closeModal();processQueue()">继续</button></div>`);
  saveGame(S);
}

/* ================= 任务推演 ================= */
function showTask(task) {
  TASK_RUN = createTaskRun(S, task);
  renderDeploy();
}

function renderDeploy() {
  const run = TASK_RUN, t = run.task;
  const pv = taskPreview(S, run);
  const grade = gradeOf(pv.score);

  const rows = t.fronts.map(f => {
    const alloc = run.alloc[f.key];
    const fill = Math.min(alloc / f.demand, 1.25);
    const pct = Math.min(fill / 1.25 * 100, 100);
    const full = fill >= 1;
    return `
      <div class="front">
        <div class="front-top">
          <div>
            <div class="front-name">${f.name}</div>
            <div class="front-hint">${f.hint} · 需求 ${f.demand}</div>
          </div>
          <div class="alloc-ctrl">
            <button onclick="taskDeploy('${f.key}',-1)" ${alloc <= 0 ? 'disabled' : ''}>−</button>
            <div class="av">${alloc}</div>
            <button onclick="taskDeploy('${f.key}',1)" ${run.left <= 0 ? 'disabled' : ''}>+</button>
          </div>
        </div>
        <div class="front-track"><div class="front-fill ${full ? 'full' : ''}" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');

  openModal(`
    <div class="modal-head">
      <div class="kicker">${t.layer} · 第 ${S.year} 年 · 第一步 战前部署</div>
      <h2>${t.name}</h2>
    </div>
    <div class="modal-body">
      <div class="narrative">${t.brief || t.text}</div>
      <div class="deploy-bar">
        <span>剩余部署点</span>
        <span class="deploy-left">${run.left}</span>
        <span class="deploy-total">/ ${t.deploy}</span>
      </div>
      <div class="fronts">${rows}</div>
      <div class="preview">
        <div class="preview-item"><span class="pk">预计评价</span><span class="pv grade-${grade}">${grade}</span></div>
        <div class="preview-item"><span class="pk">综合风险</span><span class="pv">${Math.round(pv.risk * 100)}%</span></div>
        <div class="preview-item"><span class="pk">战力系数</span><span class="pv">×${(1 + pv.power / 100).toFixed(2)}</span></div>
      </div>
      <div class="hint-line">主攻决定评价高低，保障降低伤亡风险，预备队解锁突发情况的选项——但部署点不够全都要。</div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="taskAuto()">自动部署</button>
      <button class="btn primary" onclick="taskGoDecide()" ${run.left > 0 ? 'disabled' : ''}>
        ${run.left > 0 ? '还有 ' + run.left + ' 点未分配' : '进入任务'}
      </button>
    </div>`, true);
}

function taskDeploy(key, d) {
  deployTo(TASK_RUN, key, d);
  renderDeploy();
}
function taskAuto() {
  while (TASK_RUN.left > 0) {
    if (!autoDeployStep(TASK_RUN)) break;
  }
  renderDeploy();
}
function autoDeployStep(run) {
  const has = k => run.task.fronts.some(f => f.key === k);
  if (has('support') && run.alloc.support < 1) return deployTo(run, 'support', 1);
  if (has('reserve') && run.task.deploy >= 4 && run.alloc.reserve < 1) return deployTo(run, 'reserve', 1);
  const mainKey = has('main') ? 'main' : run.task.fronts[0].key;
  return deployTo(run, mainKey, 1);
}

function taskGoDecide() {
  TASK_RUN.decisionIndex = 0;
  renderDecision();
}

function renderDecision() {
  const run = TASK_RUN;
  const list = run.task.decisions || [];
  const i = run.decisionIndex;
  if (i >= list.length) { settleTask(); return; }
  const d = list[i];
  const reserveAvail = run.alloc.reserve - run.reserveUsed;

  const opts = d.options.map((o, oi) => {
    const need = o.need || 0;
    const ok = need <= reserveAvail;
    return `
      <button class="opt ${o.risk ? 'risky' : ''}" ${ok ? '' : 'disabled'} onclick="taskChoose(${oi})">
        <div class="o-label">${o.label}${need ? `　<span class="need-tag ${ok ? '' : 'no'}">需预备队 ${need}</span>` : ''}</div>
        <div class="o-hint">${o.hint || ''}</div>
      </button>`;
  }).join('');

  openModal(`
    <div class="modal-head">
      <div class="kicker">${run.task.layer} · 第二步 临机决断（${i + 1}/${list.length}）</div>
      <h2>${run.task.name}</h2>
    </div>
    <div class="modal-body">
      <div class="narrative">${d.text}</div>
      ${opts}
      <div class="hint-line">你当前可用的预备队：${Math.max(0, reserveAvail)} 点。</div>
    </div>`, true);
}

function taskChoose(oi) {
  const run = TASK_RUN;
  const d = run.task.decisions[run.decisionIndex];
  const opt = d.options[oi];
  run.reserveUsed += (opt.need || 0);
  run.decisions.push(opt);
  run.decisionLog.push({ text: d.text, choice: opt.label });
  run.decisionIndex++;
  renderDecision();
}

function settleTask() {
  const r = resolveTaskRun(S, TASK_RUN);
  const chips = [];
  chips.push({ label: '功勋', v: r.merit });
  if (r.sp) chips.push({ label: '技能点', v: r.sp });
  if (r.prestige) chips.push({ label: '威望', v: r.prestige });
  if (r.morale) chips.push({ label: '士气', v: r.morale });
  if (r.health) chips.push({ label: '健康', v: r.health });

  const frontBars = TASK_RUN.task.fronts.map(f => {
    const fill = Math.min(TASK_RUN.alloc[f.key] / f.demand, 1.25);
    const pct = Math.min(fill / 1.25 * 100, 100);
    return `
      <div class="front-mini">
        <span class="fm-name">${f.name}</span>
        <div class="front-track"><div class="front-fill ${fill >= 1 ? 'full' : ''}" style="width:${pct}%"></div></div>
        <span class="fm-val">${Math.round(fill * 100)}%</span>
      </div>`;
  }).join('');

  const decList = TASK_RUN.decisionLog.map(d =>
    `<div class="dec-item"><div class="dec-q">${d.text}</div><div class="dec-a">→ ${d.choice}</div></div>`).join('');

  openModal(`
    <div class="modal-head">
      <div class="kicker">${TASK_RUN.task.layer} · 第三步 结算</div>
      <h2>${TASK_RUN.task.name}</h2>
    </div>
    <div class="modal-body">
      <div class="result-head">
        <div class="grade-badge grade-${r.grade} pop">${r.grade}</div>
        <div class="r-text">
          <h3>${gradeTitle(r.grade)}</h3>
          <p>综合评分 ${r.score}${r.injury ? ' · 任务中负伤：' + r.injury : ''}</p>
        </div>
      </div>
      <div class="fronts-mini">${frontBars}</div>
      ${decList ? `<div class="dec-block"><div class="dec-title">决断回顾</div>${decList}</div>` : ''}
      <div class="narrative">${r.narrative}</div>
      <div class="reward-list">${rewardChips(chips)}</div>
    </div>
    <div class="modal-foot"><button class="btn primary" onclick="closeModal();processQueue()">继续</button></div>`, true);
  saveGame(S);
}

function gradeTitle(g) {
  return { S: '出色完成', A: '表现优秀', B: '顺利完成', C: '勉强完成', D: '任务失利' }[g] || '任务结束';
}

/* ================= 晋升 ================= */
function showPromotion(pr) {
  if (pr.blocked) {
    openModal(`
      <div class="modal-head"><div class="kicker">晋升评定</div><h2>晋升暂缓</h2></div>
      <div class="modal-body">
        <div class="narrative">${pr.reason}。功勋已经够了，但门槛没过去。</div>
        <div class="reward-list"><span class="reward bad">当前纪律等级：${discGrade(S.dv.discipline).name}</span></div>
      </div>
      <div class="modal-foot"><button class="btn primary" onclick="closeModal();processQueue()">继续</button></div>`);
    pushLog(S, '晋升受阻', pr.reason, 'bad');
    saveGame(S);
    return;
  }
  applyPromotion(S, pr);
  const sc = pr.score;
  const rk = myRank(S);
  openModal(`
    <div class="modal-head"><div class="kicker">授衔仪式</div><h2>晋升 ${pr.to}</h2></div>
    <div class="modal-body">
      <div class="promo-art">${insigniaSVG(pr.idx, 150)}</div>
      <div class="narrative">你站在队列前，肩章被换上新的。${pr.from}的肩章收进了箱子，那是你走了很多年才走到的位置。</div>
      <div class="summary-grid">
        <div class="summary-cell"><div class="sc-k">实绩功勋</div><div class="sc-v">${sc.merit.toFixed(0)}</div></div>
        <div class="summary-cell"><div class="sc-k">考核评定</div><div class="sc-v">${sc.assess.toFixed(0)}</div></div>
        <div class="summary-cell"><div class="sc-k">任职匹配</div><div class="sc-v">${sc.match.toFixed(0)}</div></div>
        <div class="summary-cell"><div class="sc-k">纪律系数</div><div class="sc-v">×${sc.grade.mul.toFixed(2)}</div></div>
      </div>
      <div class="reward-list">
        <span class="reward gold">技能点 +2</span>
        <span class="reward">威望 +2</span>
        <span class="reward">士气 +2</span>
        <span class="reward">同期位次 第 ${rk.pos}/${rk.total}</span>
      </div>
    </div>
    <div class="modal-foot"><button class="btn primary" onclick="closeModal();processQueue()">继续</button></div>`, true);
  saveGame(S);
}

/* ================= 关系网 ================= */
function affinityText(v) {
  if (v >= 80) return '生死之交';
  if (v >= 65) return '信任';
  if (v >= 45) return '熟悉';
  if (v >= 25) return '疏远';
  return '交恶';
}

function openNetwork() {
  if (!S.npcs || !S.npcs.length) {
    openModal(`
      <div class="modal-head"><div class="kicker">关系网</div><h2>尚未结识人物</h2></div>
      <div class="modal-foot"><button class="btn primary" onclick="closeModal()">关闭</button></div>`);
    return;
  }
  const groups = ['chief','partner','comrade','subordinate'].map(role => {
    const meta = NPC_ROLES[role];
    const list = npcByRole(S, role);
    return `
      <div class="npc-group">
        <div class="npc-group-head"><span>${meta.name}</span><span>${meta.desc}</span></div>
        ${list.map(n => `
          <div class="npc-row">
            <div class="npc-avatar">${n.name.charAt(0)}</div>
            <div class="npc-main">
              <div class="npc-name">${n.name} <span>${n.tag}</span></div>
              <div class="npc-rel">${affinityText(n.affinity)} · 好感 ${Math.round(n.affinity)}</div>
              <div class="npc-track"><div style="width:${clamp(n.affinity,0,100)}%"></div></div>
            </div>
            ${role === 'subordinate'
              ? `<div class="npc-growth"><span>成长</span><b>${Math.round(n.growth || 0)}</b>${n.graduated ? '<em>已提干</em>' : ''}</div>`
              : `<div class="npc-growth"><span>关系</span><b>${affinityText(n.affinity)}</b></div>`}
          </div>`).join('') || '<div class="empty">暂无</div>'}
      </div>`;
  }).join('');
  openModal(`
    <div class="modal-head">
      <div class="kicker">军旅关系网</div>
      <h2>${S.name}认识的人</h2>
    </div>
    <div class="modal-body">
      <div class="hint-line" style="margin-bottom:14px">行动会作用到具体的人：联络首长、同侪交流、谈心谈话、双主官协作都会改变对应人物的关系。他们也会升迁、转业、立功和出事。</div>
      <div class="npc-groups">${groups}</div>
    </div>
    <div class="modal-foot"><button class="btn primary" onclick="closeModal()">关闭</button></div>`, true);
}

/* ================= 同期排名 ================= */
function openRanking() {
  const rk = myRank(S);
  const rows = S.rivals.map(r => ({ name: r.name, tag: r.tag, merit: r.merit, me: false }))
    .concat([{ name: S.name, tag: '你', merit: S.merit, me: true }])
    .sort((a, b) => b.merit - a.merit)
    .map((r, i) => `
      <div class="rank-row ${r.me ? 'me' : ''}">
        <span class="rk-pos">${i + 1}</span>
        <span class="rk-name">${r.name}</span>
        <span class="rk-tag">${r.tag}</span>
        <span class="rk-rank">${RANKS[rivalRankIdx(r.merit)].name}</span>
        <span class="rk-merit">${Math.round(r.merit)}</span>
      </div>`).join('');

  openModal(`
    <div class="modal-head">
      <div class="kicker">同期竞争</div>
      <h2>你目前排在第 ${rk.pos} 位（共 ${rk.total} 人）</h2>
    </div>
    <div class="modal-body">
      <div class="hint-line" style="margin-bottom:14px">
        位次直接影响晋升门槛：排名越靠前，所需功勋越低；越靠后，门槛越高。
      </div>
      <div class="rank-list">${rows}</div>
    </div>
    <div class="modal-foot"><button class="btn primary" onclick="closeModal()">关闭</button></div>`);
}

/* ================= 技能树 ================= */
function openSkills() {
  const routeBranch = S.route ? ROUTES[S.route].branch : null;
  const branches = SKILL_BRANCHES.map(b => {
    const isRoute = b.key === routeBranch;
    return `
    <div class="branch ${isRoute ? 'route-branch' : ''}">
      <div class="branch-head">
        <h3>${b.name}${isRoute ? ' <span class="route-badge">本路线 · 消耗 −1</span>' : ''}</h3>
        <span>${b.desc}</span>
      </div>
      <div class="skill-list">
        ${b.skills.map(sk => {
          const lv = S.skills[sk.key] || 0;
          const nextLv = lv + 1;
          const cost = nextLv <= 6 ? skillCost(S, sk.key, nextLv) : null;
          const baseCost = nextLv <= 6 ? SKILL_COST[nextLv] : null;
          const can = cost != null && S.sp >= cost;
          const pips = [1, 2, 3, 4, 5, 6].map(i => `<i class="${i <= lv ? 'on' : ''}">${SKILL_LEVELS[i]}</i>`).join('');
          const costText = cost == null ? '已满级'
            : (isRoute && baseCost !== cost ? `需 ${cost} 点（原 ${baseCost}）` : `需 ${cost} 点`);
          return `
            <div class="skill-row">
              <span class="s-name">${sk.name}${SKILL_SKILLS[sk.key] ? ` <span class="s-unlock ${lv >= 6 ? 'on' : ''}">S 级解锁：${SKILL_SKILLS[sk.key].name}</span>` : ''}</span>
              <span class="skill-lv">${pips}</span>
              <span class="s-cost">${costText}</span>
              <span class="s-btn"><button ${can ? '' : 'disabled'} onclick="upSkill('${sk.key}')">升级</button></span>
            </div>`;
        }).join('')}
      </div>
      ${b.skills.some(sk => SKILL_SKILLS[sk.key]) ? `<div class="s-unlock-note">${b.skills.filter(sk => SKILL_SKILLS[sk.key]).map(sk => `${sk.name} S 级 → ${SKILL_SKILLS[sk.key].desc}`).join('　·　')}</div>` : ''}
    </div>`;
  }).join('');
  openModal(`
    <div class="modal-head"><div class="kicker">技能树</div><h2>可用技能点：${S.sp}</h2></div>
    <div class="modal-body">${branches}</div>
    <div class="modal-foot"><button class="btn primary" onclick="closeModal()">关闭</button></div>`, true);
}

function upSkill(key) {
  const lv = S.skills[key] || 0;
  const nextLv = lv + 1;
  if (nextLv > 6) return;
  const cost = skillCost(S, key, nextLv);
  if (S.sp < cost) return;
  S.sp -= cost; S.spSpent = (S.spSpent || 0) + cost; S.skills[key] = nextLv;
  saveGame(S); openSkills(); renderSidebar(); renderTop();
}

/* ================= 履历 ================= */
function openHistory() {
  const items = S.history.map(h => `
    <div class="tl-item ${h.kind}">
      <div class="tl-year">第 ${h.year} 年 · ${h.age} 岁</div>
      <div class="tl-text"><b>${h.title}</b> — ${h.text}</div>
    </div>`).join('') || '<div class="empty">履历尚空。</div>';
  openModal(`
    <div class="modal-head"><div class="kicker">生涯履历</div><h2>${S.name} · ${RANKS[S.rankIdx].name}</h2></div>
    <div class="modal-body"><div class="timeline">${items}</div></div>
    <div class="modal-foot"><button class="btn primary" onclick="closeModal()">关闭</button></div>`, true);
}

/* ================= 结局 ================= */
function showEnding() {
  const e = S.ending || ENDINGS[ENDINGS.length - 1];
  const tierCls = e.tier === 'warn' ? 'tier-warn' : e.tier === 'plain' ? 'tier-plain' : '';
  const tl = S.history.map(h => `
    <div class="tl-item ${h.kind}">
      <div class="tl-year">第 ${h.year} 年 · ${h.age} 岁</div>
      <div class="tl-text"><b>${h.title}</b> — ${h.text}</div>
    </div>`).join('');
  const rk = myRank(S);

  openModal(`
    <div class="ending-hero ${tierCls}">
      <div class="e-star"></div>
      <div class="e-kicker">生涯终局</div>
      <h2>${e.name}</h2>
      <div class="e-rank">${S.name} · 最终军衔 ${RANKS[S.rankIdx].name} · ${S.endReason || ''}</div>
      <div class="e-insignia">${insigniaSVG(S.rankIdx, 130)}</div>
    </div>
    <div class="modal-body">
      <div class="narrative">${e.text}</div>
      <div class="summary-grid">
        <div class="summary-cell"><div class="sc-k">在役年数</div><div class="sc-v">${S.serviceYear} 年</div></div>
        <div class="summary-cell"><div class="sc-k">最终军衔</div><div class="sc-v">${RANKS[S.rankIdx].name}</div></div>
        <div class="summary-cell"><div class="sc-k">累计功勋</div><div class="sc-v">${Math.round(S.merit)}</div></div>
        <div class="summary-cell"><div class="sc-k">同期位次</div><div class="sc-v">第 ${rk.pos}/${rk.total}</div></div>
        <div class="summary-cell"><div class="sc-k">作风纪律</div><div class="sc-v">${discGrade(S.dv.discipline).name}</div></div>
        <div class="summary-cell"><div class="sc-k">负伤次数</div><div class="sc-v">${S.injuryCount} 次</div></div>
        <div class="summary-cell"><div class="sc-k">培养接班人</div><div class="sc-v">${S.heir || 0} 人</div></div>
      </div>
      <h3 style="font-size:14px;margin-bottom:12px">本次解锁的成就</h3>
      <div class="achv-list">
        ${(S.newAchievements && S.newAchievements.length)
          ? S.newAchievements.map(id => {
              const a = ACHIEVEMENTS.find(x => x.id === id);
              return `<div class="achv-row on"><span class="ar-mark">★</span><span class="ar-name">${a.name}</span><span class="ar-desc">${a.desc}</span></div>`;
            }).join('')
          : '<div class="empty">本次没有解锁新成就。</div>'}
      </div>
      <div class="hint-line" style="margin-bottom:18px">下一周目可以选择继承家训，让父辈的履历成为你的起点。</div>
      <h3 style="font-size:14px;margin-bottom:12px">生涯履历</h3>
      <div class="timeline">${tl}</div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">查看最后的状态</button>
      <button class="btn primary" onclick="clearSave();location.reload()">再来一次</button>
    </div>`, true);
  clearSave();
  renderAll();
}

/* ================= 启动 ================= */
window.addEventListener('DOMContentLoaded', init);
