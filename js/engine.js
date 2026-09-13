/* ============================================================
   《将星之路》游戏引擎
   时间轴 / 状态 / 行动 / 机会卡 / 同期竞争 / 任务推演 / 晋升 / 结局
   ============================================================ */

/* ---------- 时间轴 ---------- */
const TIMELINE = (function () {
  const seq = [];
  STAGE_ORDER.forEach(k => {
    const st = STAGES[k];
    const years = st.to - st.from + 1;
    if (st.turns === years * 2) {
      for (let i = 0; i < st.turns; i++) {
        const y = st.from + Math.floor(i / 2);
        const half = i % 2 === 0 ? '上半年' : '下半年';
        seq.push({ stage:k, idx:i, year:y, label:'第 ' + y + ' 年 · ' + half, short:'第' + y + '年' });
      }
    } else {
      for (let i = 0; i < st.turns; i++) {
        const y = st.from + i;
        seq.push({ stage:k, idx:i, year:y, label:'第 ' + y + ' 年', short:'第' + y + '年' });
      }
    }
  });
  return seq;
})();

/* ---------- 工具 ---------- */
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function rnd(a, b) { return a + Math.random() * (b - a); }
function ri(a, b) { return Math.floor(rnd(a, b + 1)); }

const ATTR_NAME = {}; ATTRS.forEach(a => ATTR_NAME[a.key] = a.name);
const DV_NAME = { military:'军事素养', political:'政治素养', professional:'专业能力', discipline:'作风纪律' };
const ST_NAME = { morale:'士气', health:'健康', prestige:'威望', trust:'首长信任', bond:'搭档默契', family:'家庭' };

/* ---------- 纪律等级（阶跃函数，一票否决） ---------- */
function discGrade(v) {
  if (v >= 88) return { name: '优秀', mul: 1.15, freeze: false };
  if (v >= 75) return { name: '良好', mul: 1.00, freeze: false };
  if (v >= 62) return { name: '合格', mul: 0.90, freeze: false };
  return { name: '不合格', mul: 0, freeze: true };
}

/* ---------- 特质系数 ---------- */
function traitMul(s, key) {
  let m = 1;
  s.traits.forEach(t => {
    const fx = (TRAIT_MAP[t] || {}).fx;
    if (fx && fx[key]) m += fx[key];
  });
  return Math.max(0.2, m);
}
function traitBonus(s, task) {
  let b = 0;
  s.traits.forEach(t => {
    const fx = (TRAIT_MAP[t] || {}).fx || {};
    if (fx.taskBonus) b += fx.taskBonus;
    if (fx.combatBonus && task.kind === 'combat') b += fx.combatBonus;
    if (fx.contestBonus && task.kind === 'contest') b += fx.contestBonus;
  });
  return b;
}
function traitRisk(s) {
  let r = 0;
  s.traits.forEach(t => {
    const fx = (TRAIT_MAP[t] || {}).fx || {};
    if (fx.riskAdd) r += fx.riskAdd;
  });
  return r;
}

/* ---------- 新游戏 ---------- */
function newGame(name, alloc, traits, opts) {
  const o = opts || {};
  const enlist = ENLIST_TYPES[o.enlist] || ENLIST_TYPES.conscript;
  const motto = o.motto && MOTTOS.find(m => m.id === o.motto) ? MOTTOS.find(m => m.id === o.motto) : null;

  const s = {
    name: name || '无名',
    traits: traits.slice(),
    enlist: enlist.key,
    mottoId: motto ? motto.id : null,
    legacy: !!o.legacy,
    prename: o.prename || '',
    turnIndex: 0,
    year: 1, stage: 'recruit',
    age: 18, serviceYear: 1,
    attr: {}, dv: {}, st: {},
    merit: 0, rankIdx: enlist.startRank || 0, sp: enlist.sp || 0, spSpent: 0, skills: {},
    route: null, routeSwitched: false, routeChosenYear: 0,
    heir: 0, flags: {},
    usedEvents: [],
    notified: {},
    pendingEchoes: [],
    pendingChains: [],
    ap: 8, apMax: 8, usedActions: {},
    opportunities: [],
    rivals: [],
    rankPos: 1, rankTotal: 8, prevRankPos: 1,
    log: [], history: [],
    ended: false, ending: null, endReason: null,
    injuryCount: 0
  };

  ATTRS.forEach(a => { s.attr[a.key] = ATTR_BASE + (alloc[a.key] || 0); });
  s.dv = { military: 0, political: 0, professional: 0, discipline: 66 };
  s.dvBonus = { military: 0, political: 0, professional: 0 };
  STATES.forEach(x => { s.st[x.key] = x.init; });
  SKILL_BRANCHES.forEach(b => b.skills.forEach(k => { s.skills[k.key] = 0; }));

  // 入伍方式的先天修正
  if (enlist.mods) {
    for (const k in enlist.mods) {
      if (k === 'military') s.dvBonus.military += enlist.mods[k];
      else if (s.attr[k] != null) s.attr[k] += enlist.mods[k];
    }
  }
  if (enlist.flags) for (const k in enlist.flags) s.flags[k] = enlist.flags[k];
  s.enlistNeedMul = enlist.needMul || 1;

  // 家训（二周目继承）
  if (motto) {
    if (motto.mods) {
      for (const k in motto.mods) {
        if (k === 'all') ATTRS.forEach(a => { s.attr[a.key] += motto.mods.all; });
        else if (s.attr[k] != null) s.attr[k] += motto.mods[k];
      }
    }
    if (motto.merit) s.merit += motto.merit;
    if (motto.st) for (const k in motto.st) s.st[k] = clamp(s.st[k] + motto.st[k], 0, 100);
    if (motto.disc) s.dv.discipline = clamp(s.dv.discipline + motto.disc, 0, 110);
    if (motto.heirBonus) s.flags.heirBonus = true;
    if (motto.alloc) s.flags.bonusAlloc = motto.alloc;
  }
  if (traits.indexOf('stubborn') >= 0) s.attr.xinnian += 5;

  computeDerived(s);
  initRivals(s);
  initNPCs(s);
  const t = TIMELINE[0];
  s.year = t.year; s.stage = t.stage;
  s.ap = STAGES[s.stage].ap; s.apMax = s.ap;

  pushLog(s, '入伍', '你穿上了新军装，胸前别着大红花。' + (enlist.key !== 'conscript' ? '（' + enlist.name + '）' : ''), 'gold');
  pushHistory(s, '入伍', '以' + enlist.name + '身份入伍，授' + RANKS[s.rankIdx].name + '军衔', 'rank');
  if (motto) {
    pushLog(s, '家风', '你带着「' + motto.name + '」走进了军营。', 'gold');
    pushHistory(s, '继承家训', motto.name + ' —— ' + motto.desc, 'gold');
  }
  return s;
}

function computeDerived(s) {
  const a = s.attr;
  const b = s.dvBonus || { military: 0, political: 0, professional: 0 };
  s.dv.military = clamp((a.tibo * 0.4 + a.tongshuai * 0.4 + a.zhimou * 0.2) + b.military, 0, 110);
  s.dv.political = clamp((a.xinnian * 0.5 + a.meili * 0.3 + a.yizhi * 0.2) + b.political, 0, 110);
  s.dv.professional = clamp((a.zhimou * 0.5 + a.yizhi * 0.3 + a.tibo * 0.2) + b.professional, 0, 110);
}

/* ---------- 同期军官 ---------- */
function initRivals(s) {
  const pool = RIVAL_NAMES.slice();
  s.rivals = [];
  for (let i = 0; i < 7; i++) {
    const name = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    s.rivals.push({
      name: name,
      tag: RIVAL_TAGS[Math.floor(Math.random() * RIVAL_TAGS.length)],
      power: rnd(0.82, 1.18),
      merit: 0
    });
  }
}

function tickRivals(s) {
  const base = RIVAL_GAIN[s.stage] || 300;
  s.rivals.forEach(r => { r.merit += base * r.power * rnd(0.82, 1.18); });
}

function rivalRankIdx(merit) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (merit >= RANKS[i].need) idx = i;
  return idx;
}

/* ============================================================
   具名 NPC 关系网
   ============================================================ */
function mkNpcName(used) {
  for (let i = 0; i < 300; i++) {
    const n = NPC_SURNAMES[ri(0, NPC_SURNAMES.length - 1)] + NPC_GIVEN[ri(0, NPC_GIVEN.length - 1)];
    if (used.indexOf(n) < 0 && n !== '无名') { used.push(n); return n; }
  }
  return '无名';
}

function initNPCs(s) {
  const used = [];
  const mk = (id, role, aff, growth) => ({
    id: id, role: role, name: mkNpcName(used),
    tag: NPC_TAGS[ri(0, NPC_TAGS.length - 1)],
    affinity: aff, growth: growth == null ? 0 : growth, active: true
  });
  s.npcs = [
    mk('chief',   'chief',       55),
    mk('partner', 'partner',     50),
    mk('com1',    'comrade',     45),
    mk('com2',    'comrade',     38),
    mk('sub1',    'subordinate', 45, 22),
    mk('sub2',    'subordinate', 40, 10)
  ];
  pushHistory(s, '结识同袍',
    s.npcs.map(n => NPC_ROLES[n.role].name + ' ' + n.name).join('　'), '');
}

function npcByRole(s, role) { return (s.npcs || []).filter(n => n.role === role && n.active); }

function avgAffinity(s, role) {
  const list = npcByRole(s, role);
  if (!list.length) return 0;
  return list.reduce((n, x) => n + x.affinity, 0) / list.length;
}

function addAffinity(s, role, v) {
  (s.npcs || []).forEach(n => {
    if (n.role !== role || !n.active) return;
    n.affinity = clamp(n.affinity + v, 0, 100);
  });
}

/* 每回合的 NPC 演化：好感度淡化、部属成长、关系转化为士气 */
function npcTick(s) {
  if (!s.npcs) return;
  s.npcs.forEach(n => {
    if (!n.active) return;
    n.affinity = clamp(n.affinity - 0.35, 0, 100);
    if (n.role === 'subordinate') {
      let g = rnd(0.7, 1.9);
      if (hasS(s, 'daibing')) g *= 1.7;
      if (s.flags.heirBonus) g *= 1.6;
      if (n.affinity >= 60) g *= 1.2;
      n.growth = Math.min(120, (n.growth || 0) + g);
      if (n.growth >= 100 && !n.graduated) {
        n.graduated = true;
        applyEffects(s, { merit: 500, st: { prestige: 3 } });
        pushLog(s, '部属提干', n.name + ' 通过了提干考核，成了排长。', 'gold');
        pushHistory(s, '部属提干', n.name + ' 通过提干考核，成了排长', 'gold');
      }
    }
  });
  if (avgAffinity(s, 'comrade') >= 65) s.st.morale = clamp(s.st.morale + 0.8, 0, 100);
  if (avgAffinity(s, 'subordinate') >= 65) s.st.morale = clamp(s.st.morale + 0.6, 0, 100);
}

/* 把 NPC 事件模板实例化到具体的人身上 */
function pickNpcEvent(s) {
  if (!s.npcs || !s.npcs.length) return null;
  const si = stageIndex(s.stage);
  const cands = [];
  s.npcs.forEach(n => {
    if (!n.active) return;
    NPC_EVENTS.forEach(t => {
      if (t.role !== n.role) return;
      if (si < (t.min || 0)) return;
      if (s.usedEvents.indexOf(t.id + ':' + n.id) >= 0) return;
      if (t.cond && !t.cond(s, n)) return;
      cands.push({ tpl: t, npc: n });
    });
  });
  if (!cands.length) return null;
  if (Math.random() > 0.2) return null;

  let total = 0; cands.forEach(c => total += c.tpl.weight);
  let r = Math.random() * total;
  let pick = cands[cands.length - 1];
  for (const c of cands) { r -= c.tpl.weight; if (r <= 0) { pick = c; break; } }

  const t = pick.tpl, n = pick.npc;
  const fill = txt => (txt || '').replace(/\{name\}/g, n.name);
  return {
    id: t.id + ':' + n.id,
    title: fill(t.title),
    text: fill(t.text),
    npcEvent: true,
    npcRole: n.role,
    options: t.options.map(o => ({
      label: fill(o.label),
      hint: o.hint,
      fx: o.fx,
      flag: o.flag,
      risky: o.risky,
      npc: n,
      npcFx: o.npcFx
    }))
  };
}

/* 玩家在同批人中的位次 */
function myRank(s) {
  let better = 0;
  (s.rivals || []).forEach(r => { if (r.merit > s.merit) better++; });
  const total = (s.rivals || []).length + 1;
  return { pos: better + 1, total: total, better: better, pct: total > 1 ? better / (total - 1) : 0 };
}

/* ---------- 效果应用 ---------- */
function applyEffects(s, fx, scale) {
  const k = scale == null ? 1 : scale;
  const changes = [];
  if (!fx) return changes;

  if (fx.attr) {
    for (const key in fx.attr) {
      const raw = fx.attr[key] * k;
      const before = s.attr[key];
      s.attr[key] = clamp(before + raw, 0, ATTR_CAP);
      const d = s.attr[key] - before;
      if (Math.abs(d) > 0.05) changes.push({ label: ATTR_NAME[key], v: d });
    }
  }

  if (fx.dv) {
    for (const key in fx.dv) {
      let raw = fx.dv[key] * k;
      if (key === 'discipline') {
        raw *= traitMul(s, 'discMul');
        if (raw > 0) raw *= Math.pow(Math.max(0, 1 - s.dv.discipline / 110), 1.1);
        const before = s.dv[key];
        s.dv[key] = clamp(before + raw, 0, 110);
        const d = s.dv[key] - before;
        if (Math.abs(d) > 0.05) changes.push({ label: DV_NAME[key], v: d });
      } else {
        // 军事素养 / 政治素养 / 专业能力 由属性推导，行动带来的增量单独累计
        if (!s.dvBonus) s.dvBonus = { military: 0, political: 0, professional: 0 };
        if (key === 'political') raw *= traitMul(s, 'politicalMul');
        const before = s.dv[key];
        if (raw > 0) {
          const headroom = Math.max(0, 1 - before / 110);
          raw *= Math.pow(headroom, 1.4);
        }
        s.dvBonus[key] = Math.max(-60, (s.dvBonus[key] || 0) + raw);
        computeDerived(s);
        const d = s.dv[key] - before;
        if (Math.abs(d) > 0.05) changes.push({ label: DV_NAME[key], v: d });
      }
    }
  }

  if (fx.st) {
    for (const key in fx.st) {
      let raw = fx.st[key] * k;
      if (key === 'trust') raw *= traitMul(s, 'trustMul');
      if (key === 'prestige') raw *= traitMul(s, 'prestigeMul');
      if (key === 'bond') raw *= traitMul(s, 'bondMul');
      if (raw > 0 && key !== 'health') {
        raw *= Math.pow(Math.max(0, 1 - s.st[key] / 100), 0.6);
      }
      const before = s.st[key];
      s.st[key] = clamp(before + raw, 0, 100);
      const d = s.st[key] - before;
      if (Math.abs(d) > 0.05) changes.push({ label: ST_NAME[key], v: d });
    }
  }

  if (fx.merit) {
    let raw = fx.merit * k;
    if (raw > 0) raw *= traitMul(s, 'meritMul');
    s.merit = Math.max(0, s.merit + raw);
    if (Math.abs(raw) > 0.5) changes.push({ label: '功勋', v: raw });
  }

  if (fx.sp) {
    const v = Math.round(fx.sp * k);
    s.sp += v;
    if (v) changes.push({ label: '技能点', v: v });
  }

  if (fx.heir) {
    const chance = s.flags && s.flags.heirBonus ? 0.6 : 0.3;
    if (s.heir < 3 && Math.random() < chance) {
      s.heir += 1;
      changes.push({ label: '培养接班人', v: 1 });
    }
  }

  if (fx.flag) s.flags[fx.flag] = true;

  computeDerived(s);
  return changes;
}

/* ---------- 日志 / 履历 ---------- */
function pushLog(s, title, text, kind) {
  s.log.unshift({ year: s.year, stage: STAGES[s.stage].name, title, text, kind: kind || '' });
  if (s.log.length > 300) s.log.pop();
}
function pushHistory(s, title, text, kind) {
  s.history.push({ year: s.year, age: s.age, title, text, kind: kind || '' });
}

/* ---------- 回合 ---------- */
function currentTurn(s) { return TIMELINE[s.turnIndex]; }

function beginTurn(s) {
  s.apMax = STAGES[s.stage].ap;
  s.ap = s.apMax;
  s.usedActions = {};
  drawOpportunities(s);
  s.prevRankPos = myRank(s).pos;
}

/* 抽机会卡 */
function drawOpportunities(s) {
  const si = stageIndex(s.stage);
  const pool = OPPORTUNITIES.filter(o => si >= o.min);
  const copy = pool.slice();
  const picked = [];
  for (let i = 0; i < 3 && copy.length; i++) {
    picked.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  s.opportunities = picked.map(o => o.id);
}

function findAction(id) {
  return ACTIONS.find(a => a.id === id)
    || ROUTE_ACTIONS.find(a => a.id === id)
    || OPPORTUNITIES.find(o => o.id === id);
}

function availableActions(s) {
  const si = stageIndex(s.stage);
  const base = ACTIONS.filter(a =>
    si >= a.min && (a.reqRank == null || s.rankIdx >= a.reqRank));
  const routeActs = s.route
    ? ROUTE_ACTIONS.filter(a => a.route === s.route && si >= a.min)
    : [];
  const opps = (s.opportunities || []).map(id => OPPORTUNITIES.find(o => o.id === id)).filter(Boolean);
  return base.concat(routeActs).concat(opps);
}

/* 重大功勋数量（大元帅的必要条件） */
function greatDeeds(s) {
  return GREAT_DEED_FLAGS.reduce((n, f) => n + (s.flags[f] ? 1 : 0), 0);
}

/* ---------- 路线 ---------- */
function skillBranchOf(skillKey) {
  for (const b of SKILL_BRANCHES) {
    if (b.skills.some(k => k.key === skillKey)) return b.key;
  }
  return null;
}

/* 本路线对应技能分支的升级消耗享受折扣 */
function skillCost(s, skillKey, nextLv) {
  const base = SKILL_COST[nextLv];
  if (!base) return base;
  if (s.route && skillBranchOf(skillKey) === ROUTES[s.route].branch) {
    return Math.max(1, base - 1);
  }
  return base;
}

function chooseRoute(s, key) {
  if (!ROUTES[key]) return false;
  s.route = key;
  s.routeChosenYear = s.year;
  const r = ROUTES[key];
  pushLog(s, '选定路线', '你选择了' + r.name + '——' + r.motto, 'gold');
  pushHistory(s, '选择' + r.name, r.desc, 'rank');
  s.st.prestige = clamp(s.st.prestige + 3, 0, 100);
  return true;
}

function switchRoute(s, key) {
  if (!ROUTES[key] || s.routeSwitched || key === s.route) return { ok: false };
  const cost = ROUTE_SWITCH_COST;
  if (s.merit < cost.merit) return { ok: false, reason: '功勋不足（需 ' + cost.merit + '）' };
  s.merit -= cost.merit;
  s.st.prestige = clamp(s.st.prestige - cost.prestige, 0, 100);
  const from = ROUTES[s.route];
  s.route = key;
  s.routeSwitched = true;
  pushLog(s, '转线', '由' + from.name + '转为' + ROUTES[key].name + '，付出不小代价', 'bad');
  pushHistory(s, '转线至' + ROUTES[key].name, '中途调整了成长方向', 'bad');
  return { ok: true };
}

/* 路线的晋升指标要求（少将 / 中将 / 上将） */
function routeGateMiss(s, nextIdx) {
  if (!s.route) return [];
  const r = ROUTES[s.route];
  const tier = nextIdx - 16;                    // 16→0, 17→1, 18→2
  if (tier < 0 || tier > 2) return [];
  const miss = [];
  const cur = s.dv[r.stat];
  if (cur < r.gateNeeds[tier]) miss.push(r.statName + ' ' + Math.round(cur) + '/' + r.gateNeeds[tier]);
  const ex = s.dv[r.extraKey] != null ? s.dv[r.extraKey] : s.attr[r.extraKey];
  if (ex != null && ex < r.extraNeeds[tier]) miss.push(r.extraName + ' ' + Math.round(ex) + '/' + r.extraNeeds[tier]);
  return miss;
}

/* 行动收益系数：行动点压缩到 5~7 之后，单次行动的收益相应放大，
   让每一回合"选择更少、但每一次更有分量"。 */
const ACTION_SCALE = 1.6;

function doAction(s, id) {
  const a = findAction(id);
  if (!a) return { ok: false };
  if (s.ap < a.ap) return { ok: false, reason: '行动点不足' };
  const used = s.usedActions[id] || 0;
  if (used >= 2) return { ok: false, reason: '本回合已达上限' };

  s.ap -= a.ap;
  s.usedActions[id] = used + 1;
  const scale = Math.pow(0.8, used) * ACTION_SCALE;
  const changes = applyEffects(s, a.fx, scale);
  // 行动会作用到具体的人，而不再只是抽象数值
  const nf = ACTION_NPC_AFFINITY[id];
  if (nf) addAffinity(s, nf.role, nf.v * scale);
  // 冲击大元帅的成就标记
  if (id === 'grandBid') s.flags.achGrandBid = true;
  return { ok: true, changes: changes, action: a, scale: scale };
}

/* 由效果数据自动生成行动描述，保证说明与实际结算永远一致 */
function fmtNum(v) {
  const r = Math.round(v * 10) / 10;
  return (r > 0 ? '+' : '') + (Math.abs(r % 1) < 0.05 ? Math.round(r) : r.toFixed(1));
}
function describeFx(fx, k) {
  if (!fx) return '';
  const kk = k == null ? 1 : k;
  const parts = [];
  if (fx.attr) for (const key in fx.attr) parts.push(ATTR_NAME[key] + ' ' + fmtNum(fx.attr[key] * kk));
  if (fx.dv) for (const key in fx.dv) parts.push(DV_NAME[key] + ' ' + fmtNum(fx.dv[key] * kk));
  if (fx.st) for (const key in fx.st) parts.push(ST_NAME[key] + ' ' + fmtNum(fx.st[key] * kk));
  if (fx.merit) parts.push('功勋 ' + fmtNum(fx.merit * kk));
  if (fx.sp) parts.push('技能点 +' + Math.round(fx.sp * kk));
  if (fx.heir) parts.push('培养接班人机会');
  return parts.join(' · ');
}

/* 自动安排行动：按"先补短板、再攒功勋"的动态优先级花掉行动点。
   纪律是晋升硬门槛，跌破阈值时优先补；健康同理；其余行动点用于积累功勋。 */
const MERIT_ACTIONS = ['lead','build','unitBuild','campaign','joint','serviceBuild'];
const FILLER_ACTIONS = ['fitness','study','shoot','command','staff','talk','network','apparatus'];

/* 路线专属行动通常比通用行动更强，排在功勋行动之前 */
function meritActionsFor(s) {
  const base = MERIT_ACTIONS.slice();
  // 上将之后可以主动冲击大元帅（消耗极大，是明确的取舍）
  if (s.rankIdx >= 18) base.unshift('grandBid');
  if (!s.route) return base;
  const routeIds = ROUTE_ACTIONS.filter(a => a.route === s.route).map(a => a.id);
  return routeIds.concat(base);
}

function autoSpendAP(s, opts) {
  const o = opts || {};
  const discTarget = o.discTarget || 78;
  const meritTarget = o.meritTarget || 2;
  let guard = 0;
  let meritDone = 0;
  while (s.ap > 0 && guard++ < 40) {
    let acted = false;

    // 1. 上将阶段：接班人（上将/大元帅的硬条件之一）
    if (stageIndex(s.stage) >= 5 && s.heir < 3 && s.ap >= 2 && (s.usedActions['mentor'] || 0) < 2) {
      if (doAction(s, 'mentor').ok) continue;
    }
    // 2. 纪律低于阈值时补纪律（每次只补 1 点，避免挤占功勋）
    if (s.dv.discipline < discTarget) {
      for (const id of ['drill', 'poledu']) {
        const a = ACTIONS.find(x => x.id === id);
        if (a && a.ap <= s.ap && (s.usedActions[id] || 0) < 1) {
          if (doAction(s, id).ok) { acted = true; break; }
        }
      }
      if (acted) continue;
    }
    // 3. 先保证每回合至少有一次功勋行动（否则晋升会停滞）
    if (meritDone < meritTarget) {
      for (const id of meritActionsFor(s)) {
        const a = findAction(id);
        if (!a || stageIndex(s.stage) < a.min) continue;
        if (a.reqRank != null && s.rankIdx < a.reqRank) continue;
        if (a.ap <= s.ap && (s.usedActions[id] || 0) < 2) {
          if (doAction(s, id).ok) { meritDone++; acted = true; break; }
        }
      }
      if (acted) continue;
    }
    // 4. 机会卡：每回合限定，不用就作废
    for (const id of (s.opportunities || [])) {
      const o = OPPORTUNITIES.find(x => x.id === id);
      if (!o || o.ap > s.ap || (s.usedActions[id] || 0) >= 1) continue;
      const hpCost = (o.fx && o.fx.st && o.fx.st.health) || 0;
      if (hpCost < 0 && s.st.health < 65) continue;
      if (doAction(s, id).ok) { acted = true; break; }
    }
    if (acted) continue;
    // 5. 健康偏低时休息
    if (s.st.health < 80 && s.ap >= 1 && (s.usedActions['rest'] || 0) < 2) {
      if (doAction(s, 'rest').ok) continue;
    }
    // 6. 其余行动点用于补属性
    for (const id of FILLER_ACTIONS) {
      const a = ACTIONS.find(x => x.id === id);
      if (!a || stageIndex(s.stage) < a.min) continue;
      if (a.ap <= s.ap && (s.usedActions[id] || 0) < 2) {
        if (doAction(s, id).ok) { acted = true; break; }
      }
    }
    if (!acted) break;
  }
  return s.ap;
}

/* ---------- 回合结算与推进 ---------- */
function finishTurn(s) {
  settleTurn(s);

  s.turnIndex++;
  if (s.turnIndex >= TIMELINE.length) {
    finishCareer(s, '服役期满');
    return { queue: [], finished: true };
  }
  const t = TIMELINE[s.turnIndex];
  const prevStage = s.stage;
  s.year = t.year; s.stage = t.stage;
  s.age = 18 + (t.year - 1);
  s.serviceYear = t.year;

  const queue = [];

  if (prevStage !== s.stage) {
    const st = STAGES[s.stage];
    pushLog(s, '进入' + st.name, st.desc, 'gold');
    pushHistory(s, '进入' + st.name, st.desc, 'rank');
    queue.push({ type: 'stage', data: st });
  }

  fireEchoes(s, queue);
  fireChains(s, queue);

  // 进入尉官期后仍未定路线，先让玩家做抉择
  if (!s.route && stageIndex(s.stage) >= stageIndex(ROUTE_STAGE)) {
    queue.push({ type: 'route' });
  }

  const ev = pickEvent(s);
  if (ev) queue.push({ type: 'event', data: ev });

  const npcEv = pickNpcEvent(s);
  if (npcEv) queue.push({ type: 'event', data: npcEv });

  const tk = pickTask(s);
  if (tk) queue.push({ type: 'task', data: tk });

  const pr = checkPromotion(s);
  if (pr) queue.push({ type: 'promotion', data: pr });

  return { queue: queue, finished: false };
}

function settleTurn(s) {
  // 同期军官与关系网同步演化
  tickRivals(s);
  npcTick(s);

  // 士气向 55 回归
  const m = s.st.morale;
  s.st.morale = clamp(m + (m > 55 ? -2.0 : m < 55 ? 1.5 : 0), 0, 100);

  // 健康：由年龄决定基准值，再向基准缓慢回归。
  // 负伤与透支会把它打到基准以下，但不会不可逆地一路滑坡。
  let base = 92;
  if (s.age >= 30) base = 88;
  if (s.age >= 38) base = 82;
  if (s.age >= 45) base = 74;
  if (s.age >= 52) base = 65;
  if (s.age >= 58) base = 56;
  if (s.age >= 63) base = 48;
  if (s.st.health < base) s.st.health = Math.min(base, s.st.health + 1.1);
  else s.st.health = Math.max(base, s.st.health - 0.5);
  s.st.health = clamp(s.st.health, 0, 100);

  // 纪律向基准值回归（基准设在"合格"线之上，避免不违纪的玩家被永久锁死）
  // S 级「条令权威」使自然衰减减半
  const DISC_BASE = 66;
  const discDecay = hasS(s, 'tiaoling') ? 0.175 : 0.35;
  if (s.dv.discipline > DISC_BASE) s.dv.discipline = Math.max(DISC_BASE, s.dv.discipline - discDecay);
  else if (s.dv.discipline < DISC_BASE) s.dv.discipline = Math.min(DISC_BASE, s.dv.discipline + 0.5);

  // 威望与首长信任随时间淡化
  s.st.prestige *= 0.972;
  s.st.trust *= 0.975;

  // 派生指标的加成也会随长期荒废而回落
  if (s.dvBonus) {
    ['military', 'political', 'professional'].forEach(k => {
      s.dvBonus[k] = (s.dvBonus[k] || 0) * 0.985;
    });
    computeDerived(s);
  }

  // 家庭与搭档长期不投入会疏远
  s.st.family = clamp(s.st.family - 0.9, 0, 100);
  s.st.bond = clamp(s.st.bond - 0.5, 0, 100);

  s.traits.forEach(t => {
    const fx = (TRAIT_MAP[t] || {}).fx || {};
    if (fx.moraleFloor && s.st.morale < fx.moraleFloor) s.st.morale = fx.moraleFloor;
  });

  computeDerived(s);

  if (s.st.health <= 0) finishCareer(s, '健康原因退役');
}

/* ---------- 事件 ---------- */
function pickEvent(s) {
  const si = stageIndex(s.stage);
  let pool = EVENTS.filter(e =>
    s.usedEvents.indexOf(e.id) < 0 && si >= e.min && si <= e.max
  );
  // 事件链的"起点"同样进入随机池（带 chained 标记的是后续节点，只能由链条触发）
  pool = pool.concat(CHAIN_EVENTS.filter(e =>
    !e.chained && e.weight > 0 && s.usedEvents.indexOf(e.id) < 0 && si >= e.min && si <= e.max
  ));
  // 二周目专属事件
  if (s.legacy) {
    pool = pool.concat(LEGACY_EVENTS.filter(e => s.usedEvents.indexOf(e.id) < 0 && si >= e.min && si <= e.max));
  }
  if (!pool.length) return null;
  if (Math.random() > 0.36) return null;

  let total = 0;
  pool.forEach(e => total += e.weight);
  let r = Math.random() * total;
  for (const e of pool) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return pool[pool.length - 1];
}

/* 把事件文本里的占位符换成真实姓名 */
function fillNames(s, text) {
  if (!text) return '';
  return text
    .replace(/\{prename\}/g, s.prename || '父辈')
    .replace(/\{name\}/g, s.name);
}

function applyOption(s, ev, opt) {
  s.usedEvents.push(ev.id);
  const changes = applyEffects(s, opt.fx);
  let hiddenNote = null;
  let hiddenChanges = [];
  if (opt.hidden && Math.random() < opt.hidden.chance) {
    hiddenChanges = applyEffects(s, opt.hidden);
    hiddenNote = opt.hidden.note;
  }
  if (opt.flag) s.flags[opt.flag] = true;
  if (opt.risky) s.flags.riskyCount = (s.flags.riskyCount || 0) + 1;

  // NPC 事件：改变具体 NPC 的好感度与履历
  if (opt.npc && opt.npcFx) {
    if (opt.npcFx.affinity) opt.npc.affinity = clamp(opt.npc.affinity + opt.npcFx.affinity, 0, 100);
    if (opt.npcFx.growth) opt.npc.growth = Math.max(0, (opt.npc.growth || 0) + opt.npcFx.growth);
    if (opt.npcFx.inactive) opt.npc.active = false;
  }

  // 事件链：安排后续事件
  if (opt.chain && opt.chain.id) {
    if (!s.pendingChains) s.pendingChains = [];
    s.pendingChains.push({ at: s.turnIndex + (opt.chain.delay || 2), id: opt.chain.id });
  }

  pushLog(s, ev.title, opt.label + (hiddenNote ? '（' + hiddenNote + '）' : ''), hiddenNote ? 'bad' : '');
  return { changes: changes, hiddenChanges: hiddenChanges, hiddenNote: hiddenNote };
}

/* ---------- 事件链 ---------- */
function fireChains(s, queue) {
  if (!s.pendingChains || !s.pendingChains.length) return;
  const due = [];
  s.pendingChains = s.pendingChains.filter(c => {
    if (c.at <= s.turnIndex) { due.push(c); return false; }
    return true;
  });
  due.forEach(c => {
    const ev = CHAIN_EVENTS.find(e => e.id === c.id);
    if (ev && s.usedEvents.indexOf(ev.id) < 0) queue.push({ type: 'event', data: ev });
  });
}

/* ---------- 回响 ---------- */
const ECHO_RULES = [
  { flag:'helped_comrade',  after: 6,  text:'当年你借钱的那个战友，如今已是你的上级。评审会上他替你说了话。', fx:{ st:{ trust:3 } } },
  { flag:'gave_up',         after: 7,  text:'你让出比武名额的老周，后来成了你最坚定的搭档。', fx:{ st:{ bond:5 } } },
  { flag:'gave_merit',      after: 6,  text:'把立功名额让给副手的旧事，如今在干部部门被反复提起。', fx:{ st:{ prestige:4 } } },
  { flag:'took_blame',      after: 7,  text:'你替排长担下的那次责任，让他此后十年对你死心塌地。', fx:{ st:{ morale:4, prestige:3 } } },
  { flag:'saved_village',   after: 4,  text:'那个被救下的村子，逢年过节还会有人来看你。', fx:{ st:{ prestige:3 }, attr:{ xinnian:2 } } },
  { flag:'obeyed_retreat',  after: 4,  text:'撤离的命令你执行了，但有些夜晚你还是会想起那片水。', fx:{ attr:{ xinnian:-2 } } },
  { flag:'asked_favor',     after: 6,  text:'老首长临走前为你说的那句话起了作用，也让你在别人眼里多了些议论。', fx:{ st:{ trust:4, prestige:-3 } } },
  { flag:'tough_area',      after: 8,  text:'高原上的那两年，成了你履历里最硬的一笔。', fx:{ st:{ trust:3 }, attr:{ yizhi:3 } } },
  { flag:'staff_exp',       after: 6,  text:'机关借调那半年学到的推演方法，后来在演习中救过你一次。', fx:{ dv:{ professional:4 } } },
  { flag:'gift',            after: 4,  text:'那份"心意"最终还是被人知道了。', fx:{ dv:{ discipline:-6 }, st:{ trust:-5 } } },
  { flag:'beat_peer',       after: 7,  text:'当年被你顶下去的同年兵，转业前一直没再和你说过话。', fx:{ st:{ morale:-3 } } },
  { flag:'family_joined',   after: 6,  text:'家属随军以后，你的状态明显稳了下来。', fx:{ st:{ morale:3, family:4 } } }
];

function fireEchoes(s, queue) {
  const due = [];
  s.pendingEchoes = s.pendingEchoes.filter(e => {
    if (e.at <= s.turnIndex) { due.push(e); return false; }
    return true;
  });
  ECHO_RULES.forEach(r => {
    if (s.flags[r.flag] && !s.flags['echo_' + r.flag]) {
      s.flags['echo_' + r.flag] = true;
      s.pendingEchoes.push({ at: s.turnIndex + r.after, rule: r });
    }
  });
  due.forEach(e => {
    applyEffects(s, e.rule.fx);
    pushLog(s, '往事回响', e.rule.text, 'gold');
    queue.push({ type: 'echo', data: e.rule });
  });
}

/* ---------- 任务 ---------- */
function pickTask(s) {
  const si = stageIndex(s.stage);
  const pool = TASKS.filter(t => si >= t.min && si <= t.max);
  if (!pool.length) return null;
  if (Math.random() > 0.5) return null;

  let total = 0;
  pool.forEach(t => total += t.weight);
  let r = Math.random() * total;
  for (const t of pool) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return pool[pool.length - 1];
}

/* S 级高级指令带来的加成 */
function skillSBonus(s, task) {
  let mul = 1, riskAdd = 0;
  if (task.layer === '单兵层' && hasS(s, 'sheji')) mul += 0.12;
  if (task.layer === '战役层' && hasS(s, 'canmou')) mul += 0.08;
  if (task.layer === '战略层' && hasS(s, 'dongyuan')) mul += 0.10;
  if (hasS(s, 'daibing')) mul += 0.06;
  if (hasS(s, 'zhencha')) { mul += 0.10; riskAdd += 0.03; }
  return { mul: Math.min(mul, 1.2), riskAdd: riskAdd };   // 上限 +20%
}

/* 部署点：S 级「联合作战指挥」「战时保障」各加 1 点 */
function taskDeployPoints(s, task) {
  let n = task.deploy;
  if (task.layer === '战役层' && hasS(s, 'lianhe')) n += 1;
  if (task.layer === '战略层' && hasS(s, 'houqin')) n += 1;
  return n;
}

/* 创建一次任务推演 */
function createTaskRun(s, task) {
  const alloc = {};
  task.fronts.forEach(f => { alloc[f.key] = 0; });
  return {
    task: task,
    alloc: alloc,
    left: taskDeployPoints(s, task),
    reserveUsed: 0,
    decisions: [],
    decisionLog: []
  };
}

function deployTo(run, key, d) {
  const f = run.task.fronts.find(x => x.key === key);
  if (!f) return false;
  if (d > 0 && run.left <= 0) return false;
  if (d < 0 && run.alloc[key] <= 0) return false;
  run.alloc[key] += d;
  run.left -= d;
  return true;
}

function frontFill(run, key) {
  const f = run.task.fronts.find(x => x.key === key);
  if (!f) return 0;
  return Math.min((run.alloc[key] || 0) / f.demand, 1.25);
}

/* 当前推演的综合预览 */
function taskPreview(s, run) {
  const t = run.task;
  let power = 0;
  (t.attrs || []).forEach(k => { power += (s.attr[k] - ATTR_BASE) * 0.6; });
  power += (s.skills[t.skill] || 0) * 4;
  power += traitBonus(s, t);
  power += (s.st.morale - 50) * 0.2;
  power += (s.st.health - 70) * 0.1;
  power += (s.dv.military - 50) * 0.3;
  power += (s.st.bond - 30) * 0.1;
  // 路线加成：任务的关键技能属于本路线的技能分支时，判定更强
  if (s.route && skillBranchOf(t.skill) === ROUTES[s.route].branch) power += 9;

  let dScore = 0, dRisk = 0;
  run.decisions.forEach(d => { dScore += d.score || 0; dRisk += d.risk || 0; });

  // 主攻战线的收益是边际递减的（堆满主攻收益有限），保障战线线性削减风险，
  // 预备队解锁更优的突发选项——三条线各有各的用处，但部署点不够全都要。
  // 战力系数做了压缩（0.8 + power/150），避免后期无脑拿 S。
  const mainFill = frontFill(run, 'main');
  const mainCurve = Math.pow(mainFill, 0.7);
  const powerFactor = 0.8 + power / 150;
  const sb = skillSBonus(s, t);
  const score = 62 * (0.6 + 0.4 * mainCurve) * powerFactor * (1 + dScore) * sb.mul;
  let risk = Math.max(0, t.risk * (1 - 0.75 * frontFill(run, 'support')) + dRisk + traitRisk(s) + sb.riskAdd);
  if (hasS(s, 'zuzhi')) risk *= 0.94;
  return { score: score, power: power, risk: risk, fill: {
    main: mainFill,
    support: frontFill(run, 'support'),
    reserve: frontFill(run, 'reserve')
  }};
}

function gradeOf(score) {
  if (score >= 100) return 'S';
  if (score >= 86) return 'A';
  if (score >= 68) return 'B';
  if (score >= 46) return 'C';
  return 'D';
}

const GRADE_MUL = { S: 1.8, A: 1.4, B: 1.0, C: 0.55, D: 0.15 };

/* 结算一次任务推演 */
function resolveTaskRun(s, run) {
  const t = run.task;
  const pv = taskPreview(s, run);
  const score = pv.score * rnd(0.92, 1.08);
  const grade = gradeOf(score);

  const merit = Math.round(t.merit * GRADE_MUL[grade]);
  const spGain = grade === 'S' ? 3 : grade === 'A' ? 2 : grade === 'B' ? 1 : 0;

  const result = {
    task: t, grade: grade, score: Math.round(score), merit: merit, sp: spGain,
    prestige: 0, morale: 0, health: 0, injury: null, dead: false,
    narrative: '', preview: pv, decisions: run.decisionLog.slice()
  };

  applyEffects(s, { merit: merit, sp: spGain });

  // 成就追踪
  if (grade === 'S') s.flags.achS = (s.flags.achS || 0) + 1;
  if (grade === 'D') s.flags.achD = (s.flags.achD || 0) + 1;

  if (grade === 'S') {
    result.prestige = 4; result.morale = 4;
    applyEffects(s, { st: { prestige: 4, morale: 4 }, dv: { military: 3 } });
    result.narrative = '你打得非常漂亮。导调组当场点名表扬，这一仗足够写进你的档案。';
  } else if (grade === 'A') {
    result.prestige = 2; result.morale = 2;
    applyEffects(s, { st: { prestige: 2, morale: 2 }, dv: { military: 2 } });
    result.narrative = '任务完成得出色，上级对你的评价又高了一层。';
  } else if (grade === 'B') {
    applyEffects(s, { st: { morale: 1 } });
    result.narrative = '任务按计划完成，中规中矩，没有出错。';
  } else if (grade === 'C') {
    applyEffects(s, { st: { morale: -2 } });
    result.morale = -2;
    result.narrative = '磕磕绊绊地完成了，暴露出不少问题。复盘会上你被点了名。';
  } else {
    // S 级「政治动员」：任务失利时的士气损失减半
    const loss = hasS(s, 'sixiang') ? -2.5 : -5;
    applyEffects(s, { st: { morale: loss, trust: -3 }, dv: { military: -1 } });
    result.morale = loss;
    result.narrative = '任务失利。责任不完全在你，但结果就是结果。' + (hasS(s, 'sixiang') ? '好在平时思想工作做得扎实，队伍没有散。' : '');
  }

  // 决断附带的额外效果
  run.decisions.forEach(d => { if (d.fx) applyEffects(s, d.fx); });

  if (t.flag) s.flags[t.flag] = true;

  // 风险判定
  const risk = pv.risk;
  if (Math.random() < risk) {
    const severe = Math.random() < 0.22;
    const hpLoss = severe ? ri(10, 18) : ri(3, 9);
    applyEffects(s, { st: { health: -hpLoss, morale: -3 } });
    s.injuryCount++;
    result.injury = severe ? '重伤' : '轻伤';
    result.health = -hpLoss;
    result.narrative += severe
      ? ' 你在任务中负了重伤，被紧急后送，休养了很久。'
      : ' 你在任务中受了点伤，简单包扎后又回到了队伍里。';
    pushLog(s, t.name, '负伤（' + result.injury + '），健康 −' + hpLoss, 'bad');

    if (severe && s.st.health < 22 && Math.random() < 0.15) {
      result.dead = true;
      s.flags.martyr = true;
      finishCareer(s, '执行任务中牺牲');
      return result;
    }
  }

  pushLog(s, t.name, '评价 ' + grade + '，功勋 +' + merit, grade === 'S' ? 'gold' : grade === 'D' ? 'bad' : 'good');
  pushHistory(s, t.name, '评价 ' + grade + ' · 功勋 +' + merit, grade === 'S' ? 'gold' : '');
  return result;
}

/* 自动部署（供快速推进与模拟器使用）：保障 1 点、预备队 1 点（若够），其余压主攻 */
function autoDeploy(run) {
  const has = k => run.task.fronts.some(f => f.key === k);
  if (has('support')) deployTo(run, 'support', 1);
  if (has('reserve') && run.task.deploy >= 4) deployTo(run, 'reserve', 1);
  const mainKey = has('main') ? 'main' : run.task.fronts[0].key;
  while (run.left > 0) deployTo(run, mainKey, 1);
  return run;
}

/* 自动决断：在可承受范围内选收益最高的 */
function autoDecide(run, decision) {
  let best = null, bestScore = -99;
  decision.options.forEach(o => {
    const need = o.need || 0;
    if (need > run.alloc.reserve - run.reserveUsed) return;
    const s = (o.score || 0) - (o.risk || 0) * 1.2;
    if (s > bestScore) { bestScore = s; best = o; }
  });
  if (!best) best = decision.options[0];
  return best;
}

/* 一步到位的任务结算（供模拟器使用） */
function resolveTask(s, task) {
  const run = autoDeploy(createTaskRun(s, task));
  (task.decisions || []).forEach(d => {
    const opt = autoDecide(run, d);
    run.reserveUsed += (opt.need || 0);
    run.decisions.push(opt);
    run.decisionLog.push({ text: d.text, choice: opt.label });
  });
  return resolveTaskRun(s, run);
}

/* ---------- 晋升（加权和 × 门槛阶跃函数 × 位次修正） ---------- */
function promotionScore(s) {
  const next = RANKS[s.rankIdx + 1];
  if (!next) return null;
  const meritPart = Math.min(s.merit / next.need, 2) * 50;
  const assessPart = clamp(s.dv.military * 0.4 + s.dv.political * 0.2 + s.dv.professional * 0.4, 0, 110) / 110 * 25;
  const matchPart = clamp((s.st.prestige * 0.5 + s.st.trust * 0.5), 0, 100) / 100 * 25;
  const g = discGrade(s.dv.discipline);
  return {
    merit: meritPart, assess: assessPart, match: matchPart,
    total: (meritPart + assessPart + matchPart) * g.mul,
    grade: g
  };
}

/* 同期排名会浮动晋升门槛：位次靠前更容易晋升，靠后更难。
   生长军官因欠缺基层经历，尉官期及以下的门槛额外高 20%。 */
function effectiveNeed(s, nextIdx) {
  const rk = myRank(s);
  let need = RANKS[nextIdx].need * (0.88 + 0.28 * rk.pct);
  if (s.flags && s.flags.no_grassroots && nextIdx <= 11) need *= (s.enlistNeedMul || 1.2);
  return Math.round(need);
}

function checkPromotion(s) {
  if (!s.notified) s.notified = {};
  const nextIdx = s.rankIdx + 1;
  if (nextIdx >= RANKS.length) return null;
  const next = RANKS[nextIdx];
  const cap = STAGES[s.stage].maxRank;
  if (nextIdx > cap) return null;

  const need = effectiveNeed(s, nextIdx);
  if (s.merit < need) return null;

  const g = discGrade(s.dv.discipline);
  if (g.freeze) {
    if (s.notified[nextIdx + ':disc']) return null;
    s.notified[nextIdx + ':disc'] = true;
    return { blocked: true, reason: '作风纪律不合格', from: RANKS[s.rankIdx].name, to: next.name };
  }

  const gate = RANK_GATES[nextIdx];
  if (gate) {
    const miss = [];
    if (gate.prestige && s.st.prestige < gate.prestige) miss.push('威望 ' + Math.round(s.st.prestige) + '/' + gate.prestige);
    if (gate.disc && s.dv.discipline < gate.disc) miss.push('作风纪律 ' + Math.round(s.dv.discipline) + '/' + gate.disc);
    if (gate.heir && (s.heir || 0) < gate.heir) miss.push('培养接班人 ' + (s.heir || 0) + '/' + gate.heir);
    if (gate.deeds && greatDeeds(s) < gate.deeds) miss.push('重大功勋 ' + greatDeeds(s) + '/' + gate.deeds);
    // 路线指标要求
    routeGateMiss(s, nextIdx).forEach(m => miss.push(m));
    if (miss.length) {
      if (s.notified[nextIdx + ':gate']) return null;
      s.notified[nextIdx + ':gate'] = true;
      return { blocked: true, reason: '尚未达到' + next.name + '的综合条件：' + miss.join('、'), from: RANKS[s.rankIdx].name, to: next.name, gateMiss: miss };
    }
  }

  return { blocked: false, from: RANKS[s.rankIdx].name, to: next.name, idx: nextIdx, score: promotionScore(s), need: need };
}

function applyPromotion(s, pr) {
  s.rankIdx = pr.idx;
  s.sp += 2;
  s.st.prestige = clamp(s.st.prestige + 1.5, 0, 100);
  s.st.morale = clamp(s.st.morale + 2, 0, 100);
  pushLog(s, '晋升', '由' + pr.from + '晋升为' + pr.to, 'gold');
  pushHistory(s, '晋升' + pr.to, '由' + pr.from + '晋升为' + pr.to + '，授' + pr.to + '军衔', 'rank');
}

/* ---------- 结局 ---------- */
function finishCareer(s, reason) {
  if (s.ended) return;
  s.ended = true;
  s.endReason = reason;
  const e = ENDINGS.find(x => x.cond(s));
  s.ending = e || ENDINGS[ENDINGS.length - 1];
  pushHistory(s, '生涯结束', reason, 'bad');
  try { commitAchievements(s); commitLegacy(s); } catch (err) {}
}

/* ---------- 存档 ---------- */
const SAVE_KEY = 'jiangxing_zhilu_save_v2';
function saveGame(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true; }
  catch (e) { return false; }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}

/* ============================================================
   成就与传承（跨周目持久化）
   ============================================================ */
const ACHV_KEY = 'jiangxing_zhilu_achv_v1';
const LEGACY_KEY = 'jiangxing_zhilu_legacy_v1';

function loadAchv() {
  try {
    const raw = localStorage.getItem(ACHV_KEY);
    const o = raw ? JSON.parse(raw) : null;
    return o && o.unlocked ? o : { unlocked: [], runs: 0 };
  } catch (e) { return { unlocked: [], runs: 0 }; }
}
function saveAchv(a) {
  try { localStorage.setItem(ACHV_KEY, JSON.stringify(a)); } catch (e) {}
}
function resetAchv() {
  try { localStorage.removeItem(ACHV_KEY); localStorage.removeItem(LEGACY_KEY); } catch (e) {}
}

function evaluateAchievements(s) {
  const list = [];
  ACHIEVEMENTS.forEach(a => {
    let ok = false;
    try { ok = !!a.cond(s); } catch (e) { ok = false; }
    if (ok) list.push(a);
  });
  return list;
}

/* 结算时调用：返回本次新解锁的成就 */
function commitAchievements(s) {
  const got = evaluateAchievements(s);
  const store = loadAchv();
  const fresh = got.filter(a => store.unlocked.indexOf(a.id) < 0);
  fresh.forEach(a => store.unlocked.push(a.id));
  store.runs = (store.runs || 0) + 1;
  saveAchv(store);
  s.achievements = got.map(a => a.id);
  s.newAchievements = fresh.map(a => a.id);
  return fresh;
}

/* ---------- 传承 ---------- */
function loadLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function saveLegacy(rec) {
  try { localStorage.setItem(LEGACY_KEY, JSON.stringify(rec)); } catch (e) {}
}

/* 生涯结束时写入传承记录，供下一周目继承 */
function commitLegacy(s) {
  const prev = loadLegacy();
  const snap = {
    name: s.name,
    rankIdx: s.rankIdx,
    rankName: RANKS[s.rankIdx].name,
    merit: Math.round(s.merit),
    route: s.route,
    ending: s.ending ? s.ending.name : '',
    disc: Math.round(s.dv.discipline),
    heir: s.heir || 0,
    year: s.serviceYear,
    flags: s.flags
  };
  const rec = {
    runs: ((prev && prev.runs) || 0) + 1,
    last: snap,
    best: (prev && prev.best && prev.best.merit > snap.merit) ? prev.best
        : { name: snap.name, merit: snap.merit, rankName: snap.rankName }
  };
  saveLegacy(rec);
  return rec;
}

/* 根据上一世生涯，列出可继承的家训 */
function availableMottos() {
  const rec = loadLegacy();
  if (!rec || !rec.last) return [];
  const p = rec.last;
  return MOTTOS.filter(m => {
    try { return m.cond(p); } catch (e) { return false; }
  });
}

/* 上一世生涯摘要 */
function legacySummary() {
  const rec = loadLegacy();
  if (!rec || !rec.last) return null;
  return rec;
}
