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
function applyTheme() {
  let dark = false;
  try { dark = localStorage.getItem('jiangxing_zhilu_theme') === 'dark'; } catch (e) {}
  const el = document.documentElement;
  if (el && el.classList) el.classList.toggle('theme-dark', dark);
}

function toggleTheme() {
  let dark = false;
  try { dark = localStorage.getItem('jiangxing_zhilu_theme') === 'dark'; } catch (e) {}
  const next = !dark;
  try { localStorage.setItem('jiangxing_zhilu_theme', next ? 'dark' : 'light'); } catch (e) {}
  applyTheme();
  sfx('click');
}

function openHelp() {
  openModal(`
    <div class="modal-head">
      <div class="kicker">帮助</div>
      <h2>怎么玩 & 快捷键</h2>
    </div>
    <div class="modal-body">
      <div class="narrative">
        <b>目标</b>：从列兵走到生涯终点。每回合用行动点安排训练、带兵、社交或机会卡，结束回合后可能触发事件、任务、晋升与任期考评。<br><br>
        <b>三条线</b>：尉官期选定指挥 / 政工 / 参谋，会决定职务序列与技能折扣。<br>
        <b>部队</b>：带兵行动会提升凝聚力与训练；任务成败会留下减员与荣誉。<br>
        <b>家庭</b>：成家后长期不顾家会积累张力，拖累士气。<br>
        <b>对手 AI</b>：同期军官有性格，会追赶、晋升，甚至与你结盟或结怨。<br>
        <b>淬火</b>：连败会抬高风险，重伤与牺牲更真实。<br>
        <b>存档</b>：共 6 个生涯槽，互不覆盖；成就与勋章全局共享。
      </div>
      <h3 style="font-size:13px;margin:16px 0 8px">桌面快捷键</h3>
      <div class="unit-meta">
        A 自动安排　·　E / Enter 结束回合　·　Esc 关闭弹窗<br>
        R 排名　K 技能　H 履历　M 勋章　P 档案　? 本帮助　T 切换主题
      </div>
      <div class="hint-line">移动端直接点按钮即可；主题与音效会记住你的选择。</div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="toggleTheme()">切换主题</button>
      <button class="btn primary" onclick="closeModal()">开始</button>
    </div>`);
}

function maybeTutorial() {
  let done = false;
  try { done = localStorage.getItem('jiangxing_zhilu_tutorial') === '1'; } catch (e) {}
  if (done) return;
  openModal(`
    <div class="modal-head">
      <div class="kicker">新手上路</div>
      <h2>欢迎入伍</h2>
    </div>
    <div class="modal-body">
      <div class="narrative">
        每回合你有固定行动点。左侧是属性与部队，右侧安排本回合行动，然后点「结束回合」。<br><br>
        建议第一回合：先做 1–2 次训练，再点「自动安排」感受节奏；有金色「机会」卡时优先看一眼。
      </div>
      <div class="hint-line">底部菜单可打开路线、关系、排名、技能、勋章、档案、存档等。</div>
    </div>
    <div class="modal-foot">
      <button class="btn primary" onclick="closeTutorial()">开始生涯</button>
    </div>`);
}

function closeTutorial() {
  try { localStorage.setItem('jiangxing_zhilu_tutorial', '1'); } catch (e) {}
  closeModal();
}

function bindKeys() {
  document.addEventListener('keydown', function (e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = (e.key || '').toLowerCase();
    if (k === 'escape') {
      if (document.getElementById('modalRoot') && document.getElementById('modalRoot').innerHTML) closeModal();
      return;
    }
    if (k === '?' || (k === '/' && e.shiftKey)) { openHelp(); e.preventDefault(); return; }
    if (k === 't') { toggleTheme(); return; }
    if (!S || S.ended) return;
    if (k === 'a') { onAutoArrange(); e.preventDefault(); return; }
    if (k === 'e' || k === 'enter') {
      // 弹窗打开时不抢结束回合
      const mr = document.getElementById('modalRoot');
      if (mr && mr.innerHTML) return;
      onEndTurn(); e.preventDefault(); return;
    }
    if (k === 'r') openRanking();
    else if (k === 'k') openSkills();
    else if (k === 'h') openHistory();
    else if (k === 'm') openMedals();
    else if (k === 'p') openProfile();
  });
}

function setNavActive(key) {
  const nav = $('bottomNav');
  if (!nav || !nav.querySelectorAll) return;
  nav.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('on', el.getAttribute('data-nav') === key);
  });
}

function setMobileView(view) {
  const v = view === 'stats' ? 'stats' : 'turn';
  try { document.body.setAttribute('data-view', v); } catch (e) {}
  setNavActive(v);
}

function isMobileUI() {
  try {
    return typeof matchMedia === 'function' && matchMedia('(max-width: 768px)').matches;
  } catch (e) { return false; }
}

function bindBottomNav() {
  const nav = $('bottomNav');
  if (!nav) return;
  nav.addEventListener('click', function (e) {
    const btn = e.target && e.target.closest ? e.target.closest('.nav-item') : null;
    if (!btn) return;
    const key = btn.getAttribute('data-nav');
    sfx('click');
    // 手机：回合/属性只切主面板，不弹窗
    if (key === 'turn') { setMobileView('turn'); window.scrollTo(0, 0); return; }
    if (key === 'stats') { setMobileView('stats'); window.scrollTo(0, 0); return; }
    setNavActive(key);
    if (key === 'more') { openMoreSheet(); return; }
    if (key === 'route') openRoute();
    else if (key === 'network') openNetwork();
    else if (key === 'rank') openRanking();
    else if (key === 'skills') openSkills();
    else if (key === 'achv') openAchv();
    else if (key === 'medals') openMedals();
    else if (key === 'profile') openProfile();
    else if (key === 'history') openHistory();
    else if (key === 'save') openSaveIO();
  }, { passive: true });
}

function openMoreSheet() {
  openModal(`
    <div class="modal-head">
      <div class="kicker">更多</div>
      <h2>设置与说明</h2>
    </div>
    <div class="modal-body">
      <div class="more-grid">
        <button type="button" class="opt" onclick="closeModal();openHelp()">
          <div class="o-label">帮助</div>
          <div class="o-hint">玩法说明与桌面快捷键</div>
        </button>
        <button type="button" class="opt" onclick="closeModal();toggleTheme()">
          <div class="o-label">切换主题</div>
          <div class="o-hint">深色 / 浅色，自动记忆</div>
        </button>
        <button type="button" class="opt risky" onclick="doRestart()">
          <div class="o-label">重新开始</div>
          <div class="o-hint">只清空当前存档槽，其他槽保留</div>
        </button>
      </div>
      <div class="hint-line">成就、勋章、传承为全局收藏，不随「重新开始」清空。</div>
    </div>
    <div class="modal-foot"><button class="btn primary" onclick="closeModal()">关闭</button></div>`);
}

function doRestart() {
  if (confirm('确定要放弃当前槽（槽 ' + getActiveSlot() + '）的生涯，重新开始吗？其他槽不受影响。')) {
    clearSave();
    location.reload();
  }
}

function init() {
  applyTheme();
  bindKeys();
  bindBottomNav();
  // 「更多」抽屉里的隐藏入口
  if ($('btnHelp')) $('btnHelp').onclick = openHelp;
  if ($('btnTheme')) $('btnTheme').onclick = toggleTheme;
  if ($('btnRestart')) $('btnRestart').onclick = doRestart;
  const saved = loadGame();
  if (saved && !saved.ended) {
    S = normalizeSave(saved);
    beginTurn(S);
    renderAll();
  } else if (saved && saved.ended) {
    S = normalizeSave(saved);
    renderAll();
    showEnding();
  } else {
    renderSetup();
    maybeTutorial();
  }
}

/* ================= 角色创建 ================= */
function renderSetup() {
  const mottos = availableMottos();
  SETUP = { alloc: {}, traits: [], name: '', enlist: 'conscript', motto: mottos.length ? 'm_none' : null, difficulty: 'normal' };
  ATTRS.forEach(a => { SETUP.alloc[a.key] = 0; });
  $('career').innerHTML = '<div class="career-item"><span class="k">状态</span><span class="v">待入伍</span></div>';
  $('insignia').innerHTML = '';
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

function setupSection(num, title, meta, body) {
  return `
    <section class="setup-section">
      <div class="setup-sec-head">
        <span class="sec-num">${num}</span>
        <h3>${title}</h3>
        ${meta ? `<span class="sec-meta">${meta}</span>` : ''}
      </div>
      ${body}
    </section>`;
}

function drawSetup() {
  const en = ENLIST_TYPES[SETUP.enlist];
  const max = setupAllocMax();
  const used = ATTRS.reduce((n, a) => n + SETUP.alloc[a.key], 0);
  const left = max - used;
  const rec = legacySummary();

  const enlistCards = Object.keys(ENLIST_TYPES).map(k => {
    const e = ENLIST_TYPES[k];
    const mods = Object.keys(e.mods || {}).map(mk => {
      const a = ATTRS.find(x => x.key === mk);
      const v = e.mods[mk];
      return `<span class="mod-chip ${v > 0 ? 'up' : 'down'}">${a ? a.name : mk} ${v > 0 ? '+' : ''}${v}</span>`;
    }).join('');
    return `<button type="button" class="enlist-card ${SETUP.enlist === k ? 'on' : ''}" onclick="setupEnlist('${k}')" aria-pressed="${SETUP.enlist === k}">
      <div class="ec-top">
        <div class="ec-name">${e.name}</div>
        ${SETUP.enlist === k ? '<span class="ec-check">已选</span>' : ''}
      </div>
      <div class="ec-desc">${e.desc}</div>
      <div class="ec-chips">${mods || '<span class="mod-chip">属性均衡</span>'}</div>
      <div class="ec-meta">可分配 ${e.alloc} 点${e.sp ? ' · 技能点 ' + e.sp : ''}${e.startRank ? ' · 起始 ' + RANKS[e.startRank].name : ''}</div>
    </button>`;
  }).join('');

  const mottos = availableMottos();
  const legacyBlock = mottos.length ? setupSection('05', '继承家训',
    `来自${rec.last.name}（${rec.last.rankName} · ${rec.last.ending}）`,
    `<div class="motto-pick">
      ${mottos.map(m => `
        <button type="button" class="motto-opt ${SETUP.motto === m.id ? 'on' : ''}" onclick="setupMotto('${m.id}')">
          <div class="mo-name">${m.name}</div>
          <div class="mo-desc">${m.desc}</div>
        </button>`).join('')}
    </div>`) : '';

  const allocRows = ATTRS.map(a => {
    const v = SETUP.alloc[a.key];
    const mod = en.mods[a.key] || 0;
    const base = ATTR_BASE + v + mod;
    const pct = clamp(base / ATTR_CAP * 100, 0, 100);
    const maxAdd = ATTR_ALLOC_MAX + 4;
    return `
      <div class="alloc-row ${v > 0 ? 'has' : ''}">
        <div class="alloc-main">
          <div class="alloc-top">
            <span class="an">${a.name}</span>
            <span class="av-wrap">
              ${v > 0 ? `<span class="av-add">+${v}</span>` : ''}
              <span class="av">${base}</span>
            </span>
          </div>
          <div class="ad">${a.desc}${mod ? ` <b class="${mod > 0 ? 'up' : 'down'}">(${mod > 0 ? '+' : ''}${mod})</b>` : ''}</div>
          <div class="alloc-bar"><i style="width:${pct}%"></i></div>
        </div>
        <div class="alloc-ctrl">
          <button type="button" onclick="setupAlloc('${a.key}',-1)" ${v <= 0 ? 'disabled' : ''} aria-label="减少${a.name}">−</button>
          <button type="button" onclick="setupAlloc('${a.key}',1)" ${(left <= 0 || v >= maxAdd) ? 'disabled' : ''} aria-label="增加${a.name}">+</button>
        </div>
      </div>`;
  }).join('');

  const traitOpts = TRAITS.map(t => {
    const on = SETUP.traits.indexOf(t.key) >= 0;
    return `<button type="button" class="trait-opt ${on ? 'on' : ''}" onclick="setupTrait('${t.key}')" aria-pressed="${on}">
      <div class="t-name">${on ? '✓ ' : ''}${t.name}</div>
      <div class="t-desc">${t.desc}</div>
    </button>`;
  }).join('');

  const leftCls = left === 0 ? 'done' : left < max * 0.35 ? 'low' : '';

  $('main').innerHTML = `
    <div class="card setup-card">
      <div class="card-head">
        <span>入伍登记</span>
        <span>${rec && rec.runs ? '第 ' + (rec.runs + 1) + ' 周目' : '新兵档案'}</span>
      </div>
      <div class="card-body setup-body">
        ${setupSection('01', '入伍方式', en.name, `<div class="enlist-pick">${enlistCards}</div>`)}

        ${setupSection('01B', '难度', DIFFICULTIES[SETUP.difficulty].name, `
          <div class="enlist-pick">
            ${Object.keys(DIFFICULTIES).map(k => {
              const d = DIFFICULTIES[k];
              return `<button type="button" class="enlist-card ${SETUP.difficulty === k ? 'on' : ''}" onclick="setupDiff('${k}')">
                <div class="ec-top">
                  <div class="ec-name">${d.name}</div>
                  ${SETUP.difficulty === k ? '<span class="ec-check">已选</span>' : ''}
                </div>
                <div class="ec-desc">${d.desc}</div>
              </button>`;
            }).join('')}
          </div>`)}

        ${setupSection('02', '姓名', '将写入档案', `
          <div class="setup-name">
            <label for="inName">姓名</label>
            <input id="inName" maxlength="8" placeholder="请输入你的名字" autocomplete="name"
                   value="${SETUP.name.replace(/"/g, '&quot;')}"
                   oninput="SETUP.name=this.value" />
          </div>`)}

        ${setupSection('03', '基础属性', `<span class="pts-badge ${leftCls}">剩余 ${left} / ${max} 点</span>`,
          allocRows)}

        ${setupSection('04', '性格特质', `已选 ${SETUP.traits.length} / 3`,
          `<div class="trait-pick">${traitOpts}</div>`)}

        ${legacyBlock}

        <div class="setup-actions">
          <div class="setup-actions-row">
            <button type="button" class="btn primary lg" onclick="startGame()">应征入伍</button>
            <button type="button" class="btn" onclick="setupRandom()">随机分配</button>
          </div>
          <p class="setup-note">18 岁入伍，52 个回合，从列兵到上将${rec && rec.runs ? '　·　承接父辈履历' : ''}</p>
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

function setupDiff(k) {
  if (!DIFFICULTIES[k]) return;
  SETUP.difficulty = k;
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

  // 选择写入的槽
  let slot = SETUP.slot;
  if (!slot) {
    slot = getActiveSlot();
    if (readSlotRaw(slot)) {
      const empty = pickEmptySlot();
      if (empty && confirm('当前槽 ' + slot + ' 已有存档。改用空槽 ' + empty + ' 开新局？（取消则覆盖当前槽）')) {
        slot = empty;
      } else if (!empty && !confirm('6 个槽都已占用，将覆盖槽 ' + slot + '。继续吗？')) {
        return;
      }
    }
    setActiveSlot(slot);
  } else {
    setActiveSlot(slot);
  }

  const rec = legacySummary();
  S = newGame(name, SETUP.alloc, SETUP.traits, {
    enlist: SETUP.enlist,
    motto: SETUP.motto,
    difficulty: SETUP.difficulty || 'normal',
    slot: slot,
    legacy: !!(rec && rec.runs),
    prename: rec && rec.last ? rec.last.name : ''
  });
  $('meritWrap').style.visibility = 'visible';
  beginTurn(S);
  saveGame(S);
  renderAll();
}

/* ================= 渲染 ================= */
let __renderQueued = false;
function scheduleRender() {
  if (__renderQueued) return;
  __renderQueued = true;
  const run = () => {
    __renderQueued = false;
    renderAll();
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
  else setTimeout(run, 0);
}

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
  $('insignia').innerHTML = insigniaSVG(S.rankIdx, 84);
  const pos = getPosition(S);
  $('career').innerHTML = `
    <div class="career-item opt-item"><span class="k">姓名</span><span class="v">${S.name}${motto ? ` <span class="mini-tag">${motto.name}</span>` : ''}</span></div>
    <div class="career-item opt-item"><span class="k">出身</span><span class="v">${en.short}</span></div>
    <div class="career-item"><span class="k">军衔</span><span class="v rank">${rank.name}</span></div>
    <div class="career-item"><span class="k">职务</span><span class="v" style="color:${POSITION_TYPES[pos.type] ? POSITION_TYPES[pos.type].color : 'var(--olive)'}">${pos.name}</span></div>
    <div class="career-item"><span class="k">年龄</span><span class="v">${S.age}岁</span></div>
    <div class="career-item opt-item"><span class="k">阶段</span><span class="v">${st.name}</span></div>
    ${route
      ? `<div class="career-item opt-item"><span class="k">路线</span><span class="v" style="color:${route.color}">${route.short}</span></div>`
      : `<div class="career-item opt-item"><span class="k">路线</span><span class="v" style="color:var(--text-3)">未定</span></div>`}
    <div class="career-item opt-item"><span class="k">存档槽</span><span class="v">${S.slot || getActiveSlot()}/${SAVE_SLOT_COUNT}</span></div>
    <div class="career-item"><span class="k">位次</span><span class="v ${rk.pos <= 2 ? 'good' : rk.pos >= 7 ? 'bad' : ''}">${rk.pos}/${rk.total}</span></div>`;

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
    <div class="card unit-card">
      <div class="card-head"><span>职务与部队</span><span>${S.unit ? S.unit.tier : ''}</span></div>
      <div class="card-body">
        <div class="unit-name">${getPosition(S).name}</div>
        <div class="unit-meta">${POSITION_TYPES[getPosition(S).type] ? POSITION_TYPES[getPosition(S).type].name : ''} · ${S.unit ? S.unit.name : '—'} · 功勋系数 ×${(getPosition(S).meritMul || 1).toFixed(2)}</div>
        <div class="unit-meta">编制 ${S.unit ? S.unit.size : '—'} · 荣誉 ${S.unit ? S.unit.honor : 0} · 减员 ${S.unit ? S.unit.losses : 0}</div>
        ${S.unit ? bar('凝聚力', S.unit.cohesion, 100, 'prestige') + bar('训练水平', S.unit.training, 100, 'trust') : ''}
      </div>
    </div>
    <div class="card log-side">
      <div class="card-head"><span>生涯日志</span><span>${S.log.length}</span></div>
      <div class="card-body">
        <div class="log-list">
          ${S.log.slice(0, 20).map(l => `
            <div class="log-item ${l.kind}">
              <span class="ly">第${l.year}年</span>
              <span><b>${l.title}</b> · ${l.text}</span>
            </div>`).join('') || '<div class="empty">还没有记录。</div>'}
        </div>
      </div>
    </div>
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
            <div class="turn-sub">${st.desc}${S.difficulty && S.difficulty !== 'normal' ? ' · 难度：' + DIFFICULTIES[S.difficulty].name : ''}${eraOf(S) ? ' · ' + eraOf(S).name : ''}</div>
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

    <div class="card log-card">
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
  sfx('action');
  scheduleRender();
}
function onAutoArrange() {
  autoSpendAP(S);
  scheduleRender();
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
  else if (item.type === 'review') showReview(item.data);
  else if (item.type === 'era') showEra(item.data);
  else processQueue();
}

function showEra(era) {
  openModal(`
    <div class="modal-head">
      <div class="kicker">时代变迁</div>
      <h2>${era.name}</h2>
    </div>
    <div class="modal-body">
      <div class="narrative">${era.desc}</div>
      <div class="reward-list"><span class="reward">关键词：${era.tag}</span></div>
    </div>
    <div class="modal-foot"><button type="button" class="btn primary" onclick="closeModal();processQueue()">继续</button></div>`);
}

/* 任期考评弹窗 */
function showReview(data) {
  if (data.fx) applyEffects(S, data.fx);
  const gradeCls = data.grade === '优秀' ? 'grade-S'
    : data.grade === '称职' ? 'grade-A'
    : data.grade === '基本称职' ? 'grade-C' : 'grade-D';
  openModal(`
    <div class="modal-head">
      <div class="kicker">第 ${data.year} 年 · ${data.rankName}</div>
      <h2>${data.title}</h2>
    </div>
    <div class="modal-body">
      <div class="result-head">
        <div class="grade-badge ${gradeCls} pop">${data.grade}</div>
        <div class="r-text">
          <h3>综合评分 ${data.score}</h3>
          <p>纪律 / 威望 / 信任 / 健康 / 家庭 / 功勋增速 / 同期位次</p>
        </div>
      </div>
      <div class="narrative">${data.text}</div>
      <div class="reward-list">
        ${data.fx && data.fx.merit ? `<span class="reward gold">功勋 +${data.fx.merit}</span>` : ''}
        ${data.fx && data.fx.sp ? `<span class="reward">技能点 +${data.fx.sp}</span>` : ''}
        ${data.fx && data.fx.st && data.fx.st.trust ? `<span class="reward ${data.fx.st.trust < 0 ? 'bad' : ''}">首长信任 ${data.fx.st.trust > 0 ? '+' : ''}${data.fx.st.trust}</span>` : ''}
        ${data.fx && data.fx.st && data.fx.st.prestige ? `<span class="reward ${data.fx.st.prestige < 0 ? 'bad' : ''}">威望 ${data.fx.st.prestige > 0 ? '+' : ''}${data.fx.st.prestige}</span>` : ''}
        ${data.fx && data.fx.st && data.fx.st.morale ? `<span class="reward ${data.fx.st.morale < 0 ? 'bad' : ''}">士气 ${data.fx.st.morale > 0 ? '+' : ''}${data.fx.st.morale}</span>` : ''}
      </div>
      <div class="hint-line">保持纪律、威望与信任，并让功勋持续增长，考评会更好。不称职会影响后续晋升门槛。</div>
    </div>
    <div class="modal-foot"><button type="button" class="btn primary" onclick="closeModal();processQueue()">继续</button></div>`);
  saveGame(S);
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
  if (document.body && document.body.classList) document.body.classList.add('modal-open');
  $('modalRoot').innerHTML = `<div class="overlay"><div class="modal ${wide ? 'wide' : ''}">${html}</div></div>`;
}
function closeModal() {
  if (document.body && document.body.classList) document.body.classList.remove('modal-open');
  $('modalRoot').innerHTML = '';
}

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
  if (!confirm('确定要清空所有成就、勋章与传承记录吗？此操作不可撤销。')) return;
  resetAchv();
  closeModal();
}

/* ================= 勋章墙 ================= */
function medalGlyph(tier) {
  // 简约军功章：圆盘 + 星 + 缎带
  const t = MEDAL_TIERS[tier] || MEDAL_TIERS.bronze;
  return `<svg viewBox="0 0 64 72" width="56" height="64" aria-hidden="true">
    <defs>
      <linearGradient id="mg-${tier}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${t.color}" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="${t.ring}" stop-opacity="0.9"/>
      </linearGradient>
    </defs>
    <polygon points="22,8 42,8 38,28 26,28" fill="#3A5636"/>
    <polygon points="26,28 38,28 40,36 24,36" fill="#2f4a2c"/>
    <circle cx="32" cy="48" r="18" fill="url(#mg-${tier})" stroke="${t.ring}" stroke-width="2"/>
    <path d="M32 36 L34.8 43.2 L42.5 43.2 L36.4 47.6 L38.8 55 L32 50.5 L25.2 55 L27.6 47.6 L21.5 43.2 L29.2 43.2 Z"
          fill="#fff8e1" opacity="0.92"/>
  </svg>`;
}

function openMedals() {
  // 打开时再同步一次，避免生涯进行中未走到回合结算就漏授
  if (S && !S.ended) { try { syncMedals(S, true); } catch (e) {} }
  const store = loadMedals();
  const owned = store.unlocked || [];
  const byCat = {};
  MEDAL_CATS.forEach(c => { byCat[c] = []; });
  MEDALS.forEach(m => { (byCat[m.cat] = byCat[m.cat] || []).push(m); });

  const sections = MEDAL_CATS.map(cat => {
    const list = byCat[cat] || [];
    const gotN = list.filter(m => owned.indexOf(m.id) >= 0).length;
    const cells = list.map(m => {
      const on = owned.indexOf(m.id) >= 0;
      const meta = (store.gotAt || {})[m.id];
      const when = on && meta ? `第 ${meta.year} 年 · ${meta.rank || ''}` : '';
      return `
        <div class="medal-cell ${on ? 'on' : 'off'} tier-${m.tier}" title="${m.desc}">
          <div class="medal-art">${on ? medalGlyph(m.tier) : '<div class="medal-lock">?</div>'}</div>
          <div class="medal-name">${on ? m.name : m.name}</div>
          <div class="medal-desc">${m.desc}</div>
          ${when ? `<div class="medal-when">${when}</div>` : ''}
        </div>`;
    }).join('');
    return `
      <section class="medal-section">
        <div class="medal-sec-head">
          <h3>${cat}</h3>
          <span>${gotN} / ${list.length}</span>
        </div>
        <div class="medal-grid">${cells}</div>
      </section>`;
  }).join('');

  const gold = owned.filter(id => {
    const m = MEDALS.find(x => x.id === id);
    return m && m.tier === 'gold';
  }).length;

  openModal(`
    <div class="modal-head">
      <div class="kicker">勋章墙 · 跨周目收藏</div>
      <h2>已获 ${owned.length} / ${MEDALS.length} 枚　·　金质 ${gold} 枚</h2>
    </div>
    <div class="modal-body medal-wall">
      <div class="hint-line" style="margin:0 0 14px">勋章在生涯过程中实时授予，会记入生涯日志；收藏跨周目永久保留。</div>
      ${sections}
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="onResetAchv()">清空收藏</button>
      <button class="btn primary" onclick="closeModal()">关闭</button>
    </div>`, true);
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

function taskStepsHTML(step) {
  // step: 1 部署 / 2 决断 / 3 结算
  const steps = ['战前部署', '临机决断', '任务结算'];
  return `<div class="task-steps" aria-label="任务进度">
    ${steps.map((label, i) => {
      const n = i + 1;
      const cls = n < step ? 'done' : n === step ? 'on' : '';
      return `<div class="task-step ${cls}"><i>${n < step ? '✓' : n}</i><span>${label}</span></div>`;
    }).join('')}
  </div>`;
}

function deployPips(left, total) {
  return Array.from({ length: total }, (_, i) =>
    `<span class="deploy-pip ${i < left ? 'on' : ''}"></span>`).join('');
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
    const gap = Math.max(0, f.demand - alloc);
    return `
      <div class="front ${full ? 'met' : ''}">
        <div class="front-top">
          <div class="front-info">
            <div class="front-name">
              ${f.name}
              <span class="front-status ${full ? 'ok' : 'need'}">${full ? '已满足' : `还差 ${gap}`}</span>
            </div>
            <div class="front-hint">${f.hint}</div>
          </div>
          <div class="alloc-ctrl">
            <button type="button" onclick="taskDeploy('${f.key}',-1)" ${alloc <= 0 ? 'disabled' : ''} aria-label="减少${f.name}部署">−</button>
            <div class="av">${alloc}</div>
            <button type="button" onclick="taskDeploy('${f.key}',1)" ${run.left <= 0 ? 'disabled' : ''} aria-label="增加${f.name}部署">+</button>
          </div>
        </div>
        <div class="front-track"><div class="front-fill ${full ? 'full' : ''}" style="width:${pct}%"></div></div>
        <div class="front-meta">需求 ${f.demand} · 已部署 ${alloc}</div>
      </div>`;
  }).join('');

  openModal(`
    <div class="modal-head">
      <div class="kicker">${t.layer} · 第 ${S.year} 年</div>
      <h2>${t.name}</h2>
      ${taskStepsHTML(1)}
    </div>
    <div class="modal-body">
      <div class="narrative">${t.brief || t.text}</div>
      <div class="deploy-bar">
        <div class="deploy-info">
          <span class="deploy-label">剩余部署点</span>
          <span class="deploy-left">${run.left}</span>
          <span class="deploy-total">/ ${t.deploy}</span>
        </div>
        <div class="deploy-pips">${deployPips(run.left, t.deploy)}</div>
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
      <button type="button" class="btn" onclick="taskAuto()">自动部署</button>
      <button type="button" class="btn primary" onclick="taskGoDecide()" ${run.left > 0 ? 'disabled' : ''}>
        ${run.left > 0 ? `还有 ${run.left} 点未分配` : '进入任务'}
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
  const total = list.length;

  const opts = d.options.map((o, oi) => {
    const need = o.need || 0;
    const ok = need <= reserveAvail;
    return `
      <button type="button" class="opt ${o.risk ? 'risky' : ''}" ${ok ? '' : 'disabled'} onclick="taskChoose(${oi})">
        <div class="o-label">
          <span>${o.label}</span>
          ${need ? `<span class="need-tag ${ok ? '' : 'no'}">需预备队 ${need}</span>` : ''}
        </div>
        <div class="o-hint">${o.hint || ''}</div>
      </button>`;
  }).join('');

  openModal(`
    <div class="modal-head">
      <div class="kicker">${run.task.layer}</div>
      <h2>${run.task.name}</h2>
      ${taskStepsHTML(2)}
    </div>
    <div class="modal-body">
      <div class="dec-progress">
        <span>临机决断 ${i + 1} / ${total}</span>
        <span class="reserve-chip ${reserveAvail > 0 ? '' : 'empty'}">可用预备队 ${Math.max(0, reserveAvail)}</span>
      </div>
      <div class="narrative">${d.text}</div>
      ${opts}
      <div class="hint-line">高风险选项往往收益更高；预备队不足时相关选项会暂时不可选。</div>
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
  sfx(r.grade === 'D' || r.grade === 'C' ? 'bad' : r.grade === 'S' || r.grade === 'A' ? 'good' : 'task');
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
      <div class="kicker">${TASK_RUN.task.layer}</div>
      <h2>${TASK_RUN.task.name}</h2>
      ${taskStepsHTML(3)}
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
    <div class="modal-foot"><button type="button" class="btn primary" onclick="closeModal();processQueue()">继续</button></div>`, true);
  saveGame(S);
}

function gradeTitle(g) {
  return { S: '出色完成', A: '表现优秀', B: '顺利完成', C: '勉强完成', D: '任务失利' }[g] || '任务结束';
}

/* ================= 晋升 ================= */
function showPromotion(pr) {
  if (pr.blocked) {
    sfx('bad');
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
  sfx('promo');
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
  const list = S.rivals.map(r => ({
    name: r.name,
    tag: r.tag,
    style: r.styleName || (RIVAL_STYLES[r.style] && RIVAL_STYLES[r.style].name) || '稳健型',
    merit: r.merit,
    rankIdx: r.rankIdx != null ? r.rankIdx : rivalRankIdx(r.merit || 0),
    trend: r.lastGain || 0,
    heat: r.heat || 0,
    lastEvent: r.lastEvent || '',
    me: false
  })).concat([{
    name: S.name,
    tag: '你',
    style: DIFFICULTIES[S.difficulty || 'normal'].name + '难度',
    merit: S.merit,
    rankIdx: S.rankIdx,
    trend: 0,
    heat: 0,
    lastEvent: '',
    me: true
  }]).sort((a, b) => b.merit - a.merit);

  const rows = list.map((r, i) => {
    const trendCls = r.trend > 40 ? 'up' : r.trend < -20 ? 'down' : '';
    const heatBar = r.me ? '' : `<span class="heat-dot ${r.heat > 40 ? 'hot' : ''}" title="竞争热度"></span>`;
    const rel = r.me ? '' :
      (S.allyId === r.name ? '<span class="rel-tag ally">同盟</span>' :
       S.nemesisId === r.name ? '<span class="rel-tag foe">宿敌</span>' : '');
    return `
      <div class="rank-row ${r.me ? 'me' : ''}">
        <span class="rk-pos">${i + 1}</span>
        <span class="rk-name">${r.name}${heatBar}${rel}</span>
        <span class="rk-tag">${r.style}${r.lastEvent ? ' · ' + r.lastEvent : ''}</span>
        <span class="rk-rank">${RANKS[r.rankIdx] ? RANKS[r.rankIdx].name : '—'}</span>
        <span class="rk-merit">${Math.round(r.merit)}${!r.me && r.trend ? ` <i class="rk-trend ${trendCls}">${r.trend > 0 ? '↑' : '↓'}</i>` : ''}</span>
      </div>`;
  }).join('');

  openModal(`
    <div class="modal-head">
      <div class="kicker">同期竞争 · 对手 AI 已启用</div>
      <h2>你目前排在第 ${rk.pos} 位（共 ${rk.total} 人）</h2>
    </div>
    <div class="modal-body">
      <div class="hint-line" style="margin-bottom:14px">
        对手有不同性格（拼抢 / 稳健 / 人脉 / 钻研 / 交际）：落后时会加速追赶，也会独立晋升、高光或翻车。
        位次直接影响晋升门槛——越靠前越省功勋。
      </div>
      <div class="rank-list">${rows}</div>
      <div class="hint-line" style="margin-top:12px">红点表示该对手近期竞争热度较高，更可能与你抢名额或被拿来比较。</div>
    </div>
    <div class="modal-foot"><button class="btn primary" onclick="closeModal()">关闭</button></div>`, true);
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
    <div class="modal-head"><div class="kicker">生涯履历</div><h2>${S.name} · ${RANKS[S.rankIdx].name} · ${getPosition(S).name}</h2></div>
    <div class="modal-body"><div class="timeline">${items}</div></div>
    <div class="modal-foot"><button class="btn primary" onclick="closeModal()">关闭</button></div>`, true);
}

/* ================= 生涯档案 ================= */
function careerSparkline(track, key, color, w, h) {
  if (!track || track.length < 2) return '<div class="empty" style="padding:16px">数据不足</div>';
  const vals = track.map(r => r[key] || 0);
  const max = Math.max.apply(null, vals.concat([1]));
  const min = Math.min.apply(null, vals);
  const pad = 4;
  const innerW = w - pad * 2, innerH = h - pad * 2;
  const pts = track.map((r, i) => {
    const x = pad + (i / (track.length - 1)) * innerW;
    const y = pad + innerH - ((r[key] - min) / Math.max(1, max - min)) * innerH;
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" class="spark">
    <polyline fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${pts}"/>
  </svg>`;
}

function openProfile() {
  if (!S) {
    openModal(`
      <div class="modal-head"><div class="kicker">生涯档案</div><h2>尚未入伍</h2></div>
      <div class="modal-body"><div class="narrative">完成入伍登记后，这里会记录你的军衔、职务、轨迹与家庭。</div></div>
      <div class="modal-foot"><button class="btn primary" onclick="closeModal()">知道了</button></div>`);
    return;
  }
  const track = S.careerTrack || [];
  const rk = myRank(S);
  const medals = loadMedals();
  const gold = (medals.unlocked || []).filter(id => {
    const m = MEDALS.find(x => x.id === id);
    return m && m.tier === 'gold';
  }).length;
  const era = eraOf(S);
  const last = track[track.length - 1];
  const first = track[0];
  const meritDelta = last && first ? last.merit - first.merit : 0;

  openModal(`
    <div class="modal-head">
      <div class="kicker">生涯档案 · ${DIFFICULTIES[S.difficulty || 'normal'].name}难度</div>
      <h2>${S.name} · ${RANKS[S.rankIdx].name} · ${getPosition(S).name}</h2>
    </div>
    <div class="modal-body">
      <div class="summary-grid">
        <div class="summary-cell"><div class="sc-k">在役</div><div class="sc-v">${S.serviceYear} 年</div></div>
        <div class="summary-cell"><div class="sc-k">累计功勋</div><div class="sc-v">${Math.round(S.merit)}</div></div>
        <div class="summary-cell"><div class="sc-k">同期位次</div><div class="sc-v">第 ${rk.pos}/${rk.total}</div></div>
        <div class="summary-cell"><div class="sc-k">负伤</div><div class="sc-v">${S.injuryCount} 次</div></div>
        <div class="summary-cell"><div class="sc-k">接班人</div><div class="sc-v">${S.heir || 0} 人</div></div>
        <div class="summary-cell"><div class="sc-k">勋章</div><div class="sc-v">${(medals.unlocked || []).length} · 金${gold}</div></div>
      </div>

      <div class="prof-block">
        <div class="prof-title">现任职务</div>
        <div class="unit-meta">${getPosition(S).name}（${POSITION_TYPES[getPosition(S).type] ? POSITION_TYPES[getPosition(S).type].name : ''}） · 任期自第 ${S.positionYear || 1} 年 · 功勋系数 ×${(getPosition(S).meritMul || 1).toFixed(2)}</div>
      </div>

      <div class="prof-block">
        <div class="prof-title">功勋轨迹<span>${meritDelta >= 0 ? '+' : ''}${meritDelta}</span></div>
        ${careerSparkline(track, 'merit', '#3A5636', 560, 72)}
      </div>
      <div class="prof-block">
        <div class="prof-title">威望轨迹</div>
        ${careerSparkline(track, 'prestige', '#9A7A28', 560, 56)}
      </div>
      <div class="prof-block">
        <div class="prof-title">健康轨迹</div>
        ${careerSparkline(track, 'health', '#2f5d8c', 560, 56)}
      </div>
      ${S.unit ? `
      <div class="prof-block">
        <div class="prof-title">部队 · ${S.unit.name}</div>
        <div class="unit-meta">${S.unit.tier} · 凝聚力 ${Math.round(S.unit.cohesion)} · 训练 ${Math.round(S.unit.training)} · 荣誉 ${S.unit.honor} · 减员 ${S.unit.losses}</div>
      </div>` : ''}
      ${S.familyInfo && S.familyInfo.married ? `
      <div class="prof-block">
        <div class="prof-title">家庭</div>
        <div class="unit-meta">爱人 ${S.familyInfo.spouse}（${S.familyInfo.spouseTag}） · 子女 ${S.familyInfo.kids}${S.familyInfo.kidNames.length ? '：' + S.familyInfo.kidNames.join('、') : ''}${S.familyInfo.tension > 50 ? ' · 关系紧张' : ''}</div>
      </div>` : ''}
      ${S.allyId || S.nemesisId ? `
      <div class="prof-block">
        <div class="prof-title">同期关系</div>
        <div class="unit-meta">${S.allyId ? '同盟：' + S.allyId + '　' : ''}${S.nemesisId ? '宿敌：' + S.nemesisId : ''}</div>
      </div>` : ''}
      <div class="hint-line">当前时代：${era ? era.name + '（' + era.tag + '）' : '—'}。档案随生涯实时更新，导出存档可带走完整进度。</div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="openSaveIO()">导出 / 导入</button>
      <button class="btn primary" onclick="closeModal()">关闭</button>
    </div>`, true);
}

/* ================= 存档槽管理 + 导入导出 ================= */
function slotDesc(item) {
  if (item.empty) return '空槽位';
  const m = item.meta || {};
  const end = m.ended ? ' · 已结局' + (m.ending ? '「' + m.ending + '」' : '') : '';
  return m.name + ' · ' + m.rank + (m.position ? ' · ' + m.position : '') +
    ' · 第' + m.year + '年 · ' + m.difficulty + end +
    ' · 功勋 ' + (m.merit || 0);
}

function openSaveIO() {
  const slots = listSlots();
  const active = getActiveSlot();
  const rows = slots.map(item => {
    const cur = item.id === active ? ' · 当前' : '';
    const btns = [];
    if (!item.empty) {
      btns.push(`<button class="btn" onclick="switchSlot(${item.id})">载入</button>`);
      btns.push(`<button class="btn" onclick="exportSlot(${item.id})">导出</button>`);
      btns.push(`<button class="btn danger" onclick="deleteSlotUI(${item.id})">删除</button>`);
    } else {
      btns.push(`<button class="btn" onclick="useEmptySlot(${item.id})">在此新开</button>`);
      btns.push(`<button class="btn" onclick="importToSlot(${item.id})">导入到此</button>`);
    }
    return `
      <div class="slot-row ${item.empty ? 'empty' : 'full'} ${item.id === active ? 'active' : ''}">
        <div class="slot-id">槽 ${item.id}${cur}</div>
        <div class="slot-info">${slotDesc(item)}</div>
        <div class="slot-btns">${btns.join('')}</div>
      </div>`;
  }).join('');

  openModal(`
    <div class="modal-head">
      <div class="kicker">生涯存档 · 共 ${SAVE_SLOT_COUNT} 槽</div>
      <h2>当前使用：槽 ${active}</h2>
    </div>
    <div class="modal-body">
      <div class="hint-line" style="margin-bottom:12px">每个槽独立保存一局生涯；成就 / 勋章 / 传承仍全局共享。自动存档写入当前槽。</div>
      <div class="slot-list">${rows}</div>
      <div class="setup-name" style="margin-top:16px">
        <label for="saveBox">导出 / 导入串（混淆加密）</label>
        <textarea id="saveBox" class="save-box" rows="5" placeholder="导出当前槽，或粘贴存档串后选择目标槽导入"></textarea>
      </div>
      <div id="saveMsg" class="save-msg"></div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="doExportSave()">导出当前槽</button>
      <button class="btn" onclick="doCopySave()">复制</button>
      <button class="btn" onclick="doImportSave()">导入到当前槽</button>
      <button class="btn primary" onclick="closeModal()">关闭</button>
    </div>`, true);
}

function useEmptySlot(n) {
  setActiveSlot(n);
  if (S && !S.ended) {
    S.slot = n;
    saveGame(S);
    openSaveIO();
  } else {
    closeModal();
    renderSetup();
    // 提示将写入该槽
    SETUP = SETUP || {};
    SETUP.slot = n;
  }
}

function switchSlot(n) {
  if (S && !S.ended && !confirm('切换槽位会重载，当前槽已自动保存。继续吗？')) return;
  if (S && !S.ended) saveGame(S);
  setActiveSlot(n);
  location.reload();
}

function deleteSlotUI(n) {
  if (!confirm('确定删除槽 ' + n + ' 的生涯吗？成就与勋章不受影响。')) return;
  deleteSlot(n);
  openSaveIO();
}

function exportSlot(n) {
  try {
    const pack = exportSavePack(n);
    const box = $('saveBox');
    if (box) box.value = pack;
    const msg = $('saveMsg');
    if (msg) { msg.textContent = '已导出槽 ' + n + '（' + pack.length + ' 字符）'; msg.className = 'save-msg ok'; }
  } catch (e) {
    const msg = $('saveMsg');
    if (msg) { msg.textContent = '导出失败：' + e.message; msg.className = 'save-msg bad'; }
  }
}

function importToSlot(n) {
  const box = $('saveBox');
  if (!box || !box.value.trim()) {
    const msg = $('saveMsg');
    if (msg) { msg.textContent = '请先粘贴存档串'; msg.className = 'save-msg bad'; }
    return;
  }
  if (!confirm('将把存档导入槽 ' + n + '，确定吗？')) return;
  const r = importSavePack(box.value, n);
  const msg = $('saveMsg');
  if (!r.ok) {
    if (msg) { msg.textContent = r.reason || '导入失败'; msg.className = 'save-msg bad'; }
    return;
  }
  if (msg) { msg.textContent = '已导入槽 ' + n + (r.name ? '：' + r.name : ''); msg.className = 'save-msg ok'; }
  setTimeout(() => openSaveIO(), 200);
}

function doExportSave() {
  try {
    const pack = exportSavePack(getActiveSlot());
    const box = $('saveBox');
    if (box) box.value = pack;
    const msg = $('saveMsg');
    if (msg) { msg.textContent = '已导出当前槽（' + pack.length + ' 字符）'; msg.className = 'save-msg ok'; }
    sfx('click');
  } catch (e) {
    const msg = $('saveMsg');
    if (msg) { msg.textContent = '导出失败：' + e.message; msg.className = 'save-msg bad'; }
  }
}

function doCopySave() {
  const box = $('saveBox');
  if (!box || !box.value) {
    const msg = $('saveMsg');
    if (msg) { msg.textContent = '请先导出或粘贴存档串'; msg.className = 'save-msg bad'; }
    return;
  }
  box.focus(); box.select();
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(box.value);
    } else {
      document.execCommand('copy');
    }
    const msg = $('saveMsg');
    if (msg) { msg.textContent = '已复制到剪贴板'; msg.className = 'save-msg ok'; }
  } catch (e) {
    const msg = $('saveMsg');
    if (msg) { msg.textContent = '复制失败，请手动全选复制'; msg.className = 'save-msg bad'; }
  }
}

function doImportSave() {
  const box = $('saveBox');
  if (!box || !box.value.trim()) return;
  const n = getActiveSlot();
  if (!confirm('导入将覆盖槽 ' + n + '，确定继续吗？')) return;
  const r = importSavePack(box.value, n);
  const msg = $('saveMsg');
  if (!r.ok) {
    if (msg) { msg.textContent = r.reason || '导入失败'; msg.className = 'save-msg bad'; }
    return;
  }
  if (msg) { msg.textContent = '导入成功' + (r.name ? '：' + r.name : '') + '，正在重载…'; msg.className = 'save-msg ok'; }
  setTimeout(() => location.reload(), 400);
}

/* ================= 轻量音效（Web Audio，无外部文件） ================= */
let __sfxCtx = null;
function sfxEnabled() {
  if (S && S.sfxOn === false) return false;
  try {
    const v = localStorage.getItem('jiangxing_zhilu_sfx');
    if (v === '0') return false;
  } catch (e) {}
  return true;
}

function sfx(type) {
  if (!sfxEnabled()) return;
  try {
    if (!__sfxCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      __sfxCtx = new AC();
    }
    if (__sfxCtx.state === 'suspended') __sfxCtx.resume();
    const ctx = __sfxCtx;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    let f0 = 440, f1 = 660, dur = 0.08, typeOsc = 'triangle', vol = 0.04;
    if (type === 'action') { f0 = 320; f1 = 380; dur = 0.07; }
    else if (type === 'good') { f0 = 520; f1 = 780; dur = 0.12; vol = 0.05; }
    else if (type === 'bad') { f0 = 220; f1 = 160; dur = 0.16; typeOsc = 'sawtooth'; vol = 0.035; }
    else if (type === 'promo') { f0 = 392; f1 = 784; dur = 0.28; vol = 0.055; }
    else if (type === 'medal') { f0 = 660; f1 = 990; dur = 0.22; vol = 0.05; }
    else if (type === 'task') { f0 = 280; f1 = 420; dur = 0.14; }
    o.type = typeOsc;
    o.frequency.setValueAtTime(f0, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), now + dur);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.start(now);
    o.stop(now + dur + 0.02);
  } catch (e) {}
}

function toggleSfx() {
  if (!S) return;
  S.sfxOn = S.sfxOn === false;
  try { localStorage.setItem('jiangxing_zhilu_sfx', S.sfxOn ? '1' : '0'); } catch (e) {}
  saveGame(S);
  sfx('click');
  renderTop();
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
      <div class="e-rank">${S.name} · 最终军衔 ${RANKS[S.rankIdx].name} · 最终职务 ${getPosition(S).name} · ${S.endReason || ''}</div>
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
