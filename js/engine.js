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

/* ---------- 难度 / 部队 / 时代 ---------- */
function diffOf(s) {
  return DIFFICULTIES[(s && s.difficulty) || 'normal'] || DIFFICULTIES.normal;
}

function unitTierOf(stage) {
  return UNIT_TIERS.find(u => u.stage === stage) || UNIT_TIERS[0];
}

/* ---------- 职务 ---------- */
function getPosition(s) {
  return POSITION_MAP[s.positionId] || POSITION_MAP.p_soldier;
}

function positionTypeOfRoute(route) {
  if (route === 'political') return 'pol';
  if (route === 'staff') return 'stf';
  if (route === 'command') return 'line';
  return null;
}

function canHoldPosition(s, p) {
  if (stageIndex(s.stage) < p.minStage) return false;
  if (s.rankIdx < p.minRank || s.rankIdx > p.maxRank + 1) return false;
  // 路线限定：未选路线时只走军士通用岗；选定后优先本路线
  if (p.route) {
    if (!s.route) return false;
    if (p.route !== s.route) return false;
  }
  if (p.type === 'nco' && s.rankIdx >= 9 && p.level < 3) return false; // 当军官后不再任班长类
  if (p.type !== 'nco' && s.rankIdx < 9 && p.level >= 4) return false;
  return true;
}

/* 挑选当前可任的最佳职务（级别高、匹配路线） */
function bestPositionFor(s) {
  const routeType = positionTypeOfRoute(s.route);
  let best = null;
  POSITIONS.forEach(p => {
    if (!canHoldPosition(s, p)) return;
    if (!best) { best = p; return; }
    // 优先本路线类型，其次级别
    const scoreP = p.level * 10 + (routeType && p.type === routeType ? 20 : 0) + (p.type === 'nco' && s.rankIdx < 9 ? 5 : 0);
    const scoreB = best.level * 10 + (routeType && best.type === routeType ? 20 : 0) + (best.type === 'nco' && s.rankIdx < 9 ? 5 : 0);
    if (scoreP > scoreB) best = p;
  });
  return best || POSITION_MAP.p_soldier;
}

function applyPosition(s, pos, silent) {
  if (!pos) return false;
  if (s.positionId === pos.id) return false;
  const from = getPosition(s);
  s.positionId = pos.id;
  s.positionYear = s.year;
  if (pos.unitSize && s.unit) {
    if (pos.unitSize > (s.unit.size || 0)) {
      s.unit.size = pos.unitSize;
      s.unit.cohesion = clamp(s.unit.cohesion - 3, 0, 100);
    }
  }
  if (!silent) {
    pushLog(s, '职务任命', '被任命为' + pos.name + (from && from.id !== pos.id ? '（原' + from.name + '）' : ''), 'gold');
    pushHistory(s, '任' + pos.name, '职务调整：' + from.name + ' → ' + pos.name, 'rank');
  }
  return true;
}

function reviewPosition(s, silent) {
  const best = bestPositionFor(s);
  const cur = getPosition(s);
  // 仅在可任更高级别或类型更贴合时调整
  if (!best) return false;
  const routeType = positionTypeOfRoute(s.route);
  const better =
    best.level > cur.level ||
    (best.level === cur.level && routeType && best.type === routeType && cur.type !== routeType);
  if (!better) return false;
  // 不是自动连跳太多级：最多 +2
  if (best.level > cur.level + 2) {
    const step = POSITIONS
      .filter(p => canHoldPosition(s, p) && p.level === cur.level + 1)
      .sort((a, b) => {
        const sa = a.level * 10 + (routeType && a.type === routeType ? 20 : 0);
        const sb = b.level * 10 + (routeType && b.type === routeType ? 20 : 0);
        return sb - sa;
      })[0];
    return applyPosition(s, step || best, silent);
  }
  return applyPosition(s, best, silent);
}

function positionMeritMul(s) {
  return (getPosition(s) || {}).meritMul || 1;
}

function initUnit(s) {
  const tier = unitTierOf(s.stage || 'recruit');
  s.unit = {
    name: UNIT_NAME_POOL[Math.floor(Math.random() * UNIT_NAME_POOL.length)],
    tier: tier.name,
    size: tier.size,
    cohesion: 62,
    training: 55,
    losses: 0,
    honor: 0
  };
}

function upgradeUnit(s) {
  if (!s.unit) initUnit(s);
  const tier = unitTierOf(s.stage);
  if (s.unit.tier === tier.name) return false;
  const up = tier.size > (s.unit.size || 0);
  s.unit.tier = tier.name;
  s.unit.size = tier.size;
  if (up) {
    s.unit.cohesion = clamp(s.unit.cohesion - 4, 0, 100);
    s.unit.training = clamp(s.unit.training - 6, 0, 100);
    pushLog(s, '部队扩编', '你所带的单位调整为「' + tier.name + '」，凝聚力与训练需要重新抓', 'gold');
  }
  return true;
}

function unitTick(s, opts) {
  if (!s.unit) initUnit(s);
  const u = s.unit;
  const d = diffOf(s);
  u.cohesion = clamp(u.cohesion - 0.7 * d.healthDecay, 0, 100);
  u.training = clamp(u.training - 0.5 * d.discDecay, 0, 100);
  if (s.st.morale >= 70) u.cohesion = clamp(u.cohesion + 0.4, 0, 100);
  if (s.dv.discipline >= 75) u.training = clamp(u.training + 0.3, 0, 100);
  if (opts && opts.losses) {
    u.losses += opts.losses;
    u.cohesion = clamp(u.cohesion - opts.losses * 2.5, 0, 100);
  }
  if (opts && opts.honor) {
    u.honor += opts.honor;
    u.cohesion = clamp(u.cohesion + opts.honor * 0.5, 0, 100);
  }
}

function eraOf(s) {
  return eraForYear(s.year || s.serviceYear || 1);
}

function recordCareerTrack(s) {
  if (!s.careerTrack) s.careerTrack = [];
  const row = {
    year: s.year, merit: Math.round(s.merit), rankIdx: s.rankIdx,
    prestige: Math.round(s.st.prestige), health: Math.round(s.st.health),
    unit: s.unit ? Math.round(s.unit.cohesion) : 0
  };
  const last = s.careerTrack[s.careerTrack.length - 1];
  if (last && last.year === s.year) s.careerTrack[s.careerTrack.length - 1] = row;
  else s.careerTrack.push(row);
  if (s.careerTrack.length > 80) s.careerTrack.shift();
}

/* ---------- 新游戏 ---------- */
function newGame(name, alloc, traits, opts) {
  const o = opts || {};
  const enlist = ENLIST_TYPES[o.enlist] || ENLIST_TYPES.conscript;
  const motto = o.motto && MOTTOS.find(m => m.id === o.motto) ? MOTTOS.find(m => m.id === o.motto) : null;

  const s = {
    name: name || '无名',
    slot: o.slot || getActiveSlot(),
    traits: traits.slice(),
    enlist: enlist.key,
    mottoId: motto ? motto.id : null,
    legacy: !!o.legacy,
    prename: o.prename || '',
    difficulty: DIFFICULTIES[o.difficulty] ? o.difficulty : 'normal',
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
    injuryCount: 0,
    careerTrack: [],
    lastEraId: eraForYear(1).id,
    sfxOn: true,
    familyInfo: {
      married: false,
      spouse: '',
      spouseTag: '',
      kids: 0,
      kidNames: [],
      tension: 0
    },
    allyId: null,
    nemesisId: null,
    positionId: 'p_soldier',
    positionYear: 1
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
  initUnit(s);
  const t = TIMELINE[0];
  s.year = t.year; s.stage = t.stage;
  s.ap = STAGES[s.stage].ap; s.apMax = s.ap;
  recordCareerTrack(s);

  pushLog(s, '入伍', '你穿上了新军装，胸前别着大红花。' + (enlist.key !== 'conscript' ? '（' + enlist.name + '）' : '') + '　难度：' + DIFFICULTIES[s.difficulty].name, 'gold');
  pushHistory(s, '入伍', '以' + enlist.name + '身份入伍，授' + RANKS[s.rankIdx].name + '军衔　·　难度' + DIFFICULTIES[s.difficulty].name, 'rank');
  pushLog(s, '到职', '你被分配到' + s.unit.name + '（' + s.unit.tier + '）', '');
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

/* ---------- 同期军官 AI ---------- */
const RIVAL_STYLE_KEYS = ['aggressive', 'balanced', 'political', 'technical', 'social'];

function initRivals(s) {
  const pool = RIVAL_NAMES.slice();
  s.rivals = [];
  for (let i = 0; i < 7; i++) {
    const name = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const styleKey = RIVAL_STYLE_KEYS[Math.floor(Math.random() * RIVAL_STYLE_KEYS.length)];
    const style = RIVAL_STYLES[styleKey] || RIVAL_STYLES.balanced;
    s.rivals.push({
      name: name,
      tag: RIVAL_TAGS[Math.floor(Math.random() * RIVAL_TAGS.length)],
      style: styleKey,
      styleName: style.name,
      power: rnd(0.82, 1.18),
      merit: 0,
      rankIdx: 0,
      prestige: rnd(18, 32),
      discipline: rnd(58, 72),
      ambition: rnd(0.7, 1.3),
      heat: 0,          // 近期竞争热度
      lastEvent: '',
      lastGain: 0,
      trend: 0
    });
  }
}

/* 对手按阶段可晋升到的上限（略宽于玩家，制造压迫感） */
function rivalStageCap(s) {
  const st = STAGES[s.stage];
  return st ? st.maxRank : 1;
}

function tryPromoteRival(s, r) {
  const cap = rivalStageCap(s);
  const next = r.rankIdx + 1;
  if (next > cap || next >= RANKS.length) return false;
  const need = RANKS[next].need * (0.90 + 0.22 * (1 - r.ambition * 0.3));
  const style = RIVAL_STYLES[r.style] || RIVAL_STYLES.balanced;
  const gate = RANK_GATES[next];
  if (r.merit < need) return false;
  if (r.discipline < 55) return false;
  if (gate) {
    if (gate.prestige && r.prestige < gate.prestige * 0.92) return false;
    if (gate.disc && r.discipline < gate.disc * 0.95) return false;
    // 人脉型更容易绕过部分硬门槛
    if (r.style === 'political' && Math.random() > 0.75) return false;
  }
  // 性格加成：拼抢/人脉晋升略快
  if (Math.random() > 0.72 + style.promoBoost + (r.ambition - 1) * 0.1) return false;

  const from = RANKS[r.rankIdx].name;
  r.rankIdx = next;
  r.prestige = clamp(r.prestige + 2.5, 0, 100);
  r.heat = clamp(r.heat + 12, 0, 100);

  const to = RANKS[next].name;
  if (next > s.rankIdx) {
    pushLog(s, '同期动态', r.name + '先你一步晋升为' + to, 'bad');
    r.lastEvent = '晋升' + to;
    // 被反超会刺激玩家（信任/士气轻负反馈）
    if (s.merit > 0) s.st.morale = clamp(s.st.morale - 1.2, 0, 100);
  } else if (Math.random() < 0.45) {
    pushLog(s, '同期动态', r.name + '由' + from + '晋升为' + to, '');
    r.lastEvent = '晋升' + to;
  } else {
    r.lastEvent = '晋升' + to;
  }
  return true;
}

/* 对手个人事件：高光 / 翻车 / 与你对照 */
function rivalCareerEvent(s, r) {
  const style = RIVAL_STYLES[r.style] || RIVAL_STYLES.balanced;
  const roll = Math.random();
  if (roll < 0.035 + style.setback * 0.15) {
    // 翻车
    const loss = rnd(0.04, 0.12) * r.merit + 80;
    r.merit = Math.max(0, r.merit - loss);
    r.prestige = clamp(r.prestige - rnd(3, 8), 0, 100);
    r.discipline = clamp(r.discipline - rnd(1, 4), 40, 100);
    r.lastEvent = '受挫';
    r.heat = clamp(r.heat - 8, 0, 100);
    if (Math.random() < 0.55) {
      const line = RIVAL_EVENT_POOL.setback[Math.floor(Math.random() * RIVAL_EVENT_POOL.setback.length)];
      pushLog(s, '同期动态', r.name + line, '');
    }
  } else if (roll < 0.08) {
    // 高光
    const gain = rnd(0.03, 0.09) * Math.max(200, r.merit) + 120;
    r.merit += gain;
    r.prestige = clamp(r.prestige + rnd(2, 6), 0, 100);
    r.heat = clamp(r.heat + 10, 0, 100);
    r.lastEvent = '高光';
    if (Math.random() < 0.5) {
      const line = RIVAL_EVENT_POOL.boost[Math.floor(Math.random() * RIVAL_EVENT_POOL.boost.length)];
      pushLog(s, '同期动态', r.name + line, 'gold');
    }
  } else if (roll < 0.115 && Math.abs(r.merit - s.merit) < 1800) {
    // 与你贴身竞争
    r.heat = clamp(r.heat + 15, 0, 100);
    r.lastEvent = '与你较劲';
    const line = RIVAL_EVENT_POOL.vsPlayer[Math.floor(Math.random() * RIVAL_EVENT_POOL.vsPlayer.length)];
    if (Math.random() < 0.7) pushLog(s, '同期较劲', r.name + line, '');
    // 你被盯上时，若位次靠后会小幅压信任
    if (myRank(s).pos >= 4) s.st.trust = clamp(s.st.trust - 0.8, 0, 100);
  } else {
    r.lastEvent = '';
  }
}

/* 追赶 AI：落后玩家会加速，领先过多在标准难度下略收敛 */
function rivalCatchUpMul(s, r) {
  const gap = s.merit - r.merit;
  let m = 1;
  if (gap > 1500) {
    // 落后越多追得越紧（封顶，避免无脑反超）
    m += Math.min(0.28, gap / 28000);
  } else if (gap < -2000 && s.difficulty === 'normal') {
    m *= 0.94;
  }
  // 热度高的对手本回合更拼
  m *= 1 + (r.heat / 100) * 0.08;
  return m;
}

function tickRivals(s) {
  if (!s.rivals || !s.rivals.length) return;
  const base = RIVAL_GAIN[s.stage] || 300;
  const mul = diffOf(s).rivalMul;
  const mePos = myRank(s).pos;

  s.rivals.forEach(r => {
    if (!r.style) {
      r.style = RIVAL_STYLE_KEYS[Math.floor(Math.random() * RIVAL_STYLE_KEYS.length)];
      r.styleName = (RIVAL_STYLES[r.style] || RIVAL_STYLES.balanced).name;
      r.prestige = r.prestige != null ? r.prestige : rnd(18, 32);
      r.discipline = r.discipline != null ? r.discipline : rnd(58, 72);
      r.ambition = r.ambition != null ? r.ambition : rnd(0.7, 1.3);
      r.heat = r.heat || 0;
      r.rankIdx = r.rankIdx != null ? r.rankIdx : rivalRankIdx(r.merit || 0);
    }
    const style = RIVAL_STYLES[r.style] || RIVAL_STYLES.balanced;
    const catchUp = rivalCatchUpMul(s, r);
    // 你在第一时，前二的对手额外发力
    let pressure = 1;
    if (mePos === 1 && r.merit >= s.merit * 0.85) pressure = 1.06;
    // 对手随军衔获得“岗位”加成，跟上玩家的职务功勋系数
    const postMul = 1 + Math.min(0.28, (r.rankIdx || 0) * 0.016);

    const prev = r.merit;
    let gain = base * r.power * mul * style.meritMul * catchUp * pressure * postMul;
    gain *= rnd(1 - style.variance, 1 + style.variance);
    r.merit += gain;
    r.lastGain = Math.round(r.merit - prev);
    r.trend = r.lastGain;

    // 状态漂移
    if (r.style === 'political') r.prestige = clamp(r.prestige + rnd(0.2, 1.4), 0, 100);
    else r.prestige = clamp(r.prestige + rnd(-0.4, 1.0), 0, 100);
    if (r.style === 'aggressive') r.discipline = clamp(r.discipline + rnd(-1.2, 0.4), 40, 100);
    else r.discipline = clamp(r.discipline + rnd(-0.3, 0.9), 40, 100);

    // 热度自然回落
    r.heat = clamp(r.heat - 2.5, 0, 100);

    tryPromoteRival(s, r);
    rivalCareerEvent(s, r);
  });
}

/* 生成一张「同期竞争」事件卡（低概率入队） */
function pickRivalEvent(s) {
  if (!s.rivals || !s.rivals.length) return null;
  if (Math.random() > 0.18) return null;
  // 优先选与你功勋接近或排名更高的对手
  const sorted = s.rivals.slice().sort((a, b) => {
    const da = Math.abs(a.merit - s.merit) - (a.merit > s.merit ? 400 : 0);
    const db = Math.abs(b.merit - s.merit) - (b.merit > s.merit ? 400 : 0);
    return da - db;
  });
  const r = sorted[0];
  if (!r) return null;

  const pool = [
    {
      title: '同期较劲 · ' + r.name,
      text: r.name + '（' + (r.styleName || '稳健型') + '）最近势头很猛，你们被反复放在一起比较。',
      options: [
        { label: '埋头干好自己的事', hint: '信念 +2 · 无额外风险',
          fx: { attr: { xinnian: 2 } } },
        { label: '主动请缨压过他一头', hint: '功勋 +280 · 风险',
          fx: { merit: 280, st: { morale: 2 } },
          hidden: { chance: 0.35, note: '风头太劲，引来议论', st: { trust: -3 } } },
        { label: '找他开诚布公谈一次', hint: '搭档默契 +3 · 威望 +2',
          fx: { st: { bond: 3, prestige: 2 } } }
      ]
    },
    {
      title: '名额只有一个',
      text: '上级给了一个关键岗位推荐名额，你和' + r.name + '都在候选之列。',
      options: [
        { label: '全力争取', hint: '功勋 +350 · 首长信任 +3 · 同侪关系变差',
          fx: { merit: 350, st: { trust: 3, morale: 1 } }, flag: 'beat_peer' },
        { label: '实事求是展示履历，让组织决定', hint: '纪律 +3 · 威望 +2',
          fx: { dv: { discipline: 3 }, st: { prestige: 2 } } },
        { label: '若差距不大，先推荐他', hint: '搭档默契 +5 · 威望 +3 · 功勋 −100',
          fx: { st: { bond: 5, prestige: 3 }, merit: -100 }, flag: 'gave_up' }
      ]
    },
    {
      title: '联合任务搭档',
      text: '你和' + r.name + '被编到同一任务组，配合好坏直接影响双方评价。',
      options: [
        { label: '以我为主，他打下手', hint: '统率 +2 · 搭档默契 −4',
          fx: { attr: { tongshuai: 2 }, st: { bond: -4 } } },
        { label: '充分授权，协同推进', hint: '搭档默契 +5 · 功勋 +200',
          fx: { st: { bond: 5 }, merit: 200 } },
        { label: '明算账：各管一段', hint: '专业能力 +3 · 威望 +1',
          fx: { dv: { professional: 3 }, st: { prestige: 1 } } }
      ]
    }
  ];
  const ev = pool[Math.floor(Math.random() * pool.length)];
  r.heat = clamp(r.heat + 20, 0, 100);
  r.lastEvent = '与你交锋';
  return {
    id: 'ev_rival_ai_' + r.name + '_' + (s.year || 1),
    title: ev.title,
    min: 0, max: 6, weight: 12, once: true,
    text: ev.text,
    options: ev.options
  };
}

function rivalRankIdx(merit) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (merit >= RANKS[i].need) idx = i;
  return idx;
}

/* ---------- 家庭线 ---------- */
function ensureFamily(s) {
  if (!s.familyInfo) {
    s.familyInfo = { married: false, spouse: '', spouseTag: '', kids: 0, kidNames: [], tension: 0 };
  }
  return s.familyInfo;
}

function mkSpouseName() {
  return SPOUSE_SURNAMES[ri(0, SPOUSE_SURNAMES.length - 1)] + SPOUSE_GIVEN[ri(0, SPOUSE_GIVEN.length - 1)];
}

function tryMarriage(s, queue) {
  const f = ensureFamily(s);
  if (f.married) return;
  if (stageIndex(s.stage) < 1) return; // 军士期起才有机会
  if (s.age < 22) return;
  const chance = 0.10 + (s.st.family >= 50 ? 0.08 : 0) + (s.attr.meili >= 55 ? 0.05 : 0);
  if (Math.random() > chance) return;

  const spouse = mkSpouseName();
  const tag = ['老师','护士','公务员','工程师','文艺兵','教师'][ri(0, 5)];
  queue.push({
    type: 'event',
    data: {
      id: 'ev_marry_' + s.year,
      title: '成家',
      min: 0, max: 6, weight: 12, once: true,
      text: '驻地朋友介绍你认识了' + spouse + '（' + tag + '）。处了一段时间，你们决定结婚。',
      options: [
        { label: '简办婚礼，按规矩来', hint: '家庭 +10 · 纪律 +3',
          fx: { st: { family: 10 }, dv: { discipline: 3 } }, flag: 'married_simple' },
        { label: '热热闹闹办一场', hint: '家庭 +12 · 士气 +5 · 威望 +2',
          fx: { st: { family: 12, morale: 5, prestige: 2 } }, flag: 'married_big' },
        { label: '再等等，事业为重', hint: '功勋 +150 · 家庭 −4',
          fx: { merit: 150, st: { family: -4 } } }
      ],
      __marry: { spouse: spouse, tag: tag }
    }
  });
}

function applyMarriage(s, data) {
  const f = ensureFamily(s);
  f.married = true;
  f.spouse = data.spouse;
  f.spouseTag = data.tag;
  pushLog(s, '成家', '你和' + data.spouse + '（' + data.tag + '）组建了家庭', 'gold');
  pushHistory(s, '成家', '与' + data.spouse + '结婚', 'gold');
}

function tryKid(s, queue) {
  const f = ensureFamily(s);
  if (!f.married || f.kids >= 3) return;
  if (s.age < 24) return;
  if (Math.random() > 0.12 + (s.st.family >= 55 ? 0.06 : 0)) return;
  const boy = Math.random() < 0.5;
  const name = (boy ? KID_GIVEN_BOY : KID_GIVEN_GIRL)[ri(0, 7)];
  const full = (f.spouse ? f.spouse.charAt(0) : '家') + name;
  queue.push({
    type: 'event',
    data: {
      id: 'ev_kid_' + s.year + '_' + f.kids,
      title: '家里添丁',
      min: 0, max: 6, weight: 12, once: true,
      text: f.spouse + '生了' + (boy ? '个儿子' : '个女儿') + '。你连夜从驻地赶回家，抱起孩子时手都在抖。',
      options: [
        { label: '请老人帮忙带，自己安心服役', hint: '家庭 +8 · 士气 +4',
          fx: { st: { family: 8, morale: 4 } }, __kid: full },
        { label: '申请家属随军', hint: '家庭 +10 · 健康 −2 · 功勋 −100',
          fx: { st: { family: 10, health:-2 }, merit: -100 }, __kid: full, flag: 'family_joined' },
        { label: '尽量多抽时间回家', hint: '家庭 +6 · 首长信任 −2',
          fx: { st: { family: 6, trust: -2 } }, __kid: full }
      ]
    }
  });
}

function applyKid(s, name) {
  const f = ensureFamily(s);
  f.kids += 1;
  f.kidNames.push(name);
  pushLog(s, '添丁', '孩子' + name + '出生', 'gold');
  pushHistory(s, '孩子出生', name, 'gold');
}

function familyTick(s) {
  const f = ensureFamily(s);
  if (!f.married) return;
  // 长期不顾家会积累张力
  if (s.st.family < 35) f.tension = clamp(f.tension + 1.5, 0, 100);
  else f.tension = clamp(f.tension - 0.8, 0, 100);
  if (f.tension > 70 && Math.random() < 0.25) {
    s.st.morale = clamp(s.st.morale - 2, 0, 100);
    pushLog(s, '家庭张力', '爱人抱怨你常年不在家，电话那头沉默了很久', 'bad');
  }
}

/* ---------- 同期同盟 / 宿敌 ---------- */
function ensureRivalRel(s) {
  if (!s.rivals || !s.rivals.length) return null;
  if (s.flags.seek_ally && !s.allyId) {
    // 选功勋接近的对手结成同盟
    const sorted = s.rivals.slice().sort((a, b) => Math.abs(a.merit - s.merit) - Math.abs(b.merit - s.merit));
    if (sorted[0]) {
      s.allyId = sorted[0].name;
      sorted[0].heat = clamp((sorted[0].heat || 0) - 20, 0, 100);
      pushLog(s, '结成同盟', '你和' + sorted[0].name + '在多次配合后成了真正靠得住的同期', 'gold');
    }
  }
  if (s.flags.seek_nemesis && !s.nemesisId) {
    const hot = s.rivals.slice().sort((a, b) => (b.heat || 0) - (a.heat || 0))[0];
    if (hot) {
      s.nemesisId = hot.name;
      hot.heat = clamp((hot.heat || 0) + 15, 0, 100);
      pushLog(s, '结下梁子', '你和' + hot.name + '较上了劲，此后处处针锋相对', 'bad');
    }
  }
  return { ally: s.allyId, nemesis: s.nemesisId };
}

function allyTick(s) {
  if (!s.allyId) return;
  const a = (s.rivals || []).find(r => r.name === s.allyId);
  if (!a) return;
  // 盟友偶尔帮你
  if (Math.random() < 0.08) {
    s.st.bond = clamp(s.st.bond + 3, 0, 100);
    s.st.trust = clamp(s.st.trust + 1.5, 0, 100);
    pushLog(s, '同盟互助', a.name + '在关键场合替你说了话', 'gold');
  }
  // 盟友受挫你也会被牵连一点
  if (a.lastEvent === '受挫' && Math.random() < 0.3) {
    s.st.prestige = clamp(s.st.prestige - 1, 0, 100);
  }
}

function nemesisTick(s, queue) {
  if (!s.nemesisId) return;
  const n = (s.rivals || []).find(r => r.name === s.nemesisId);
  if (!n) return;
  if (Math.random() < 0.10) {
    queue.push({
      type: 'event',
      data: {
        id: 'ev_nemesis_' + s.year,
        title: '宿敌发难',
        min: 0, max: 6, weight: 12, once: true,
        text: n.name + '在公开场合质疑你的方案，会场气氛一度很僵。',
        options: [
          { label: '用数据当场回击', hint: '威望 +5 · 智谋 +2 · 关系恶化',
            fx: { st: { prestige: 5 }, attr: { zhimou: 2 } } },
          { label: '会后私下解决', hint: '搭档默契 −2 · 纪律 +3',
            fx: { st: { bond: -2 }, dv: { discipline: 3 } } },
          { label: '主动示弱，化干戈', hint: '威望 −2 · 信念 +3 · 或可缓和',
            fx: { st: { prestige: -2 }, attr: { xinnian: 3 } } }
        ]
      }
    });
  }
  // 宿敌盯着你，位次压力
  if (n.merit > s.merit) s.st.morale = clamp(s.st.morale - 0.6, 0, 100);
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
    if (raw > 0) {
      raw *= traitMul(s, 'meritMul');
      raw *= positionMeritMul(s);
    }
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
  reviewPosition(s);
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
  // 带兵类行动同步提升部队
  if (!s.unit) initUnit(s);
  if (id === 'lead' || id === 'build' || id === 'unitBuild' || id === 'teachClass' || id === 'readiness') {
    s.unit.cohesion = clamp(s.unit.cohesion + 4 * scale, 0, 100);
    s.unit.training = clamp(s.unit.training + 3 * scale, 0, 100);
  }
  if (id === 'campaign' || id === 'joint' || id === 'majorScene') {
    s.unit.honor += 1;
    s.unit.training = clamp(s.unit.training + 2 * scale, 0, 100);
  }
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
const MERIT_ACTIONS = ['lead','build','unitBuild','campaign','joint','serviceBuild','qjBlueprint','majorScene','thinkTank'];
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
    upgradeUnit(s);
    reviewPosition(s);
  }

  // 时代更迭
  {
    const era = eraOf(s);
    if (s.lastEraId && era.id !== s.lastEraId) {
      s.lastEraId = era.id;
      pushLog(s, '时代变迁', era.name + '——' + era.desc, 'gold');
      pushHistory(s, '进入' + era.name, era.desc, 'gold');
      queue.push({ type: 'era', data: era });
    } else if (!s.lastEraId) {
      s.lastEraId = era.id;
    }
  }

  fireEchoes(s, queue);
  fireChains(s, queue);

  // 进入尉官期后仍未定路线，先让玩家做抉择
  if (!s.route && stageIndex(s.stage) >= stageIndex(ROUTE_STAGE)) {
    queue.push({ type: 'route' });
  }

  const ev = pickEvent(s);
  if (ev) queue.push({ type: 'event', data: ev });

  const rvEv = pickRivalEvent(s);
  if (rvEv) queue.push({ type: 'event', data: rvEv });

  // 家庭线
  tryMarriage(s, queue);
  tryKid(s, queue);

  // 同盟 / 宿敌
  ensureRivalRel(s);
  allyTick(s);
  nemesisTick(s, queue);

  const npcEv = pickNpcEvent(s);
  if (npcEv) queue.push({ type: 'event', data: npcEv });

  const tk = pickTask(s);
  if (tk) queue.push({ type: 'task', data: tk });

  const pr = checkPromotion(s);
  if (pr) queue.push({ type: 'promotion', data: pr });

  // 任期考评：进入尉官期后，每 4 年一次
  if (stageIndex(s.stage) >= stageIndex('officer') && s.year % 4 === 0) {
    const rv = buildTermReview(s);
    if (rv) queue.push({ type: 'review', data: rv });
  }

  return { queue: queue, finished: false };
}

/* 任期考评：综合纪律 / 威望 / 信任 / 健康 / 家庭 / 功勋增速 / 同期位次 */
function buildTermReview(s) {
  const prev = s.lastReviewMerit != null ? s.lastReviewMerit : s.merit;
  const meritDelta = s.merit - prev;
  s.lastReviewMerit = s.merit;

  let score = 0;
  if (s.dv.discipline >= 72) score += 22;
  else if (s.dv.discipline >= 58) score += 12;
  else if (s.dv.discipline < 50) score -= 8;

  if (s.st.prestige >= 55) score += 20;
  else if (s.st.prestige >= 35) score += 10;

  if (s.st.trust >= 45) score += 16;
  else if (s.st.trust >= 28) score += 8;

  if (s.st.health >= 55) score += 12;
  else if (s.st.health >= 35) score += 6;
  else score -= 6;

  if (s.st.morale >= 55) score += 12;
  else if (s.st.morale < 40) score -= 5;

  if (s.st.family >= 40) score += 8;

  if (meritDelta > 2000) score += 16;
  else if (meritDelta > 800) score += 10;
  else if (meritDelta > 200) score += 5;

  const rk = myRank(s);
  if (rk.pos <= 2) score += 8;
  else if (rk.pos >= 7) score -= 5;

  const mult = { officer:1, field:1.5, general:2.2, marshal:2.8, legacy:2 }[s.stage] || 1;
  let grade, title, text, fx;
  if (score >= 88) {
    grade = '优秀'; title = '任期考评';
    text = '这一任期综合表现突出，讲评时被上级点名表扬，信任度明显上升。';
    fx = { merit: Math.round(350 * mult), st: { trust:6, prestige:5 }, sp:1 };
  } else if (score >= 68) {
    grade = '称职'; title = '任期考评';
    text = '各项目标任务完成得比较扎实，继续按这个节奏走。';
    fx = { merit: Math.round(160 * mult), st: { trust:3, prestige:2 } };
  } else if (score >= 48) {
    grade = '基本称职'; title = '任期考评';
    text = '总体过得去，但几项关键指标还有差距，要注意补短板。';
    fx = { st: { morale:-2 } };
  } else {
    grade = '不称职'; title = '任期考评';
    text = '讲评会上你被点名提醒。这段时间状态下滑明显，需要认真反思并拿出整改办法。';
    fx = { st: { trust:-6, prestige:-4, morale:-5 }, dv: { discipline:-2 } };
  }

  if (score >= 88) s.flags.achReviewBest = (s.flags.achReviewBest || 0) + 1;
  if (score < 48) s.flags.achReviewBad = (s.flags.achReviewBad || 0) + 1;

  return { grade, title, text, fx, score, year: s.year, rankName: RANKS[s.rankIdx].name };
}

function settleTurn(s) {
  // 同期军官与关系网同步演化
  tickRivals(s);
  npcTick(s);
  unitTick(s);

  const d = diffOf(s);

  // 士气向 55 回归
  const m = s.st.morale;
  s.st.morale = clamp(m + (m > 55 ? -2.0 : m < 55 ? 1.5 : 0), 0, 100);

  // 健康：由年龄决定基准值，再向基准缓慢回归。
  let base = 92;
  if (s.age >= 30) base = 88;
  if (s.age >= 38) base = 82;
  if (s.age >= 45) base = 74;
  if (s.age >= 52) base = 65;
  if (s.age >= 58) base = 56;
  if (s.age >= 63) base = 48;
  if (s.st.health < base) s.st.health = Math.min(base, s.st.health + 1.1 / d.healthDecay);
  else s.st.health = Math.max(base, s.st.health - 0.5 * d.healthDecay);
  s.st.health = clamp(s.st.health, 0, 100);

  // 纪律向基准值回归
  const DISC_BASE = 66;
  const discDecay = (hasS(s, 'tiaoling') ? 0.175 : 0.35) * d.discDecay;
  if (s.dv.discipline > DISC_BASE) s.dv.discipline = Math.max(DISC_BASE, s.dv.discipline - discDecay);
  else if (s.dv.discipline < DISC_BASE) s.dv.discipline = Math.min(DISC_BASE, s.dv.discipline + 0.5 / d.discDecay);

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

  // 同期位次历史最高，供勋章判定
  {
    const rk = myRank(s);
    if (rk.pos === 1) s.flags.everRank1 = true;
  }

  recordCareerTrack(s);
  upgradeUnit(s);
  // 职务随实绩缓慢上移（军衔够了但还没任命时）
  if (s.year % 2 === 0) reviewPosition(s, true);
  familyTick(s);
  if (s.flags.unit_honor && s.unit && !s.flags.unit_honor_applied) {
    s.flags.unit_honor_applied = true;
    s.unit.honor += 1;
    s.unit.cohesion = clamp(s.unit.cohesion + 5, 0, 100);
  }

  // 实时同步勋章（新获得的会写进生涯日志）
  try { syncMedals(s); } catch (e) {}

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
  if (opt.__marry) applyMarriage(s, opt.__marry);
  if (opt.__kid) applyKid(s, opt.__kid);

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
  const d = diffOf(s);
  const pv = taskPreview(s, run);
  // 连败加压：最近两次 C/D 会拉低本次评分并抬高风险
  const streak = s.failStreak || 0;
  let score = pv.score * rnd(0.92, 1.08);
  if (streak >= 2) score *= 0.95;
  if (streak >= 3 && d.failStreakRisk) score *= 0.93;
  const grade = gradeOf(score);

  const merit = Math.round(t.merit * GRADE_MUL[grade]);
  const spGain = grade === 'S' ? 3 : grade === 'A' ? 2 : grade === 'B' ? 1 : 0;

  const result = {
    task: t, grade: grade, score: Math.round(score), merit: merit, sp: spGain,
    prestige: 0, morale: 0, health: 0, injury: null, dead: false,
    narrative: '', preview: pv, decisions: run.decisionLog.slice()
  };

  applyEffects(s, { merit: merit, sp: spGain });

  // 成就与勋章追踪
  s.flags.taskCount = (s.flags.taskCount || 0) + 1;
  if (grade === 'S') s.flags.achS = (s.flags.achS || 0) + 1;
  if (grade === 'A') s.flags.achA = (s.flags.achA || 0) + 1;
  if (grade === 'D') s.flags.achD = (s.flags.achD || 0) + 1;
  // 连败计数
  if (grade === 'C' || grade === 'D') s.failStreak = (s.failStreak || 0) + 1;
  else s.failStreak = 0;

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

  // 风险判定（难度会抬高风险；连败再叠加）
  let risk = clamp(pv.risk + d.riskAdd, 0, 0.62);
  if (streak >= 2) risk += 0.02;
  if (streak >= 3 && d.failStreakRisk) risk += 0.04;
  if (Math.random() < risk) {
    const severeBase = 0.18 + d.riskAdd + (streak >= 3 ? 0.08 : 0);
    const severe = Math.random() < severeBase;
    const hpLoss = severe ? ri(10, 18) : ri(3, 9);
    applyEffects(s, { st: { health: -hpLoss, morale: -3 } });
    s.injuryCount++;
    result.injury = severe ? '重伤' : '轻伤';
    result.health = -hpLoss;
    result.narrative += severe
      ? ' 你在任务中负了重伤，被紧急后送，休养了很久。'
      : ' 你在任务中受了点伤，简单包扎后又回到了队伍里。';
    pushLog(s, t.name, '负伤（' + result.injury + '），健康 −' + hpLoss, 'bad');
    unitTick(s, { losses: severe ? 2 : 1 });

    // 牺牲：淬火 + 连败 + 重伤 + 低健康时才有真实威胁
    const deathP = (severe && s.st.health < 28 ? 0.12 : 0)
      + (s.difficulty === 'hell' && streak >= 3 && severe ? 0.10 : 0)
      + (s.difficulty === 'hell' && s.st.health < 18 ? 0.08 : 0);
    if (severe && Math.random() < deathP) {
      result.dead = true;
      s.flags.martyr = true;
      finishCareer(s, '执行任务中牺牲');
      return result;
    }
  } else if (grade === 'S' || grade === 'A') {
    unitTick(s, { honor: grade === 'S' ? 3 : 1 });
  }

  // 难度影响任务功勋
  if (result.merit) {
    const adj = Math.round(result.merit * (diffOf(s).taskMerit - 1));
    if (adj) {
      s.merit = Math.max(0, s.merit + adj);
      result.merit += adj;
    }
  }

  pushLog(s, t.name, '评价 ' + grade + '，功勋 +' + result.merit, grade === 'S' ? 'gold' : grade === 'D' ? 'bad' : 'good');
  pushHistory(s, t.name, '评价 ' + grade + ' · 功勋 +' + result.merit, grade === 'S' ? 'gold' : '');
  recordCareerTrack(s);
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
function autoDecide(run, decision, gameState) {
  // 淬火难度：偶发“上头”，专挑高收益高风险项
  if (gameState && gameState.difficulty === 'hell' && Math.random() < (diffOf(gameState).autoBlunder || 0.15)) {
    const risky = decision.options.filter(o => (o.risk || 0) > 0.05);
    if (risky.length) {
      return risky.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    }
  }
  let best = null, bestScore = -99;
  decision.options.forEach(o => {
    const need = o.need || 0;
    if (need > run.alloc.reserve - run.reserveUsed) return;
    const sc = (o.score || 0) - (o.risk || 0) * 1.2;
    if (sc > bestScore) { bestScore = sc; best = o; }
  });
  if (!best) best = decision.options[0];
  return best;
}

/* 一步到位的任务结算（供模拟器使用） */
function resolveTask(s, task) {
  const run = autoDeploy(createTaskRun(s, task));
  (task.decisions || []).forEach(d => {
    const opt = autoDecide(run, d, s);
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
  need *= diffOf(s).needMul;
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
  if (s.unit) {
    s.unit.honor += 1;
    s.unit.cohesion = clamp(s.unit.cohesion + 3, 0, 100);
  }
  pushLog(s, '晋升', '由' + pr.from + '晋升为' + pr.to, 'gold');
  pushHistory(s, '晋升' + pr.to, '由' + pr.from + '晋升为' + pr.to + '，授' + pr.to + '军衔', 'rank');
  // 军衔晋升后重新审视职务
  reviewPosition(s);
  recordCareerTrack(s);
}

/* ---------- 结局 ---------- */
function finishCareer(s, reason) {
  if (s.ended) return;
  s.ended = true;
  s.endReason = reason;
  const e = ENDINGS.find(x => x.cond(s));
  s.ending = e || ENDINGS[ENDINGS.length - 1];
  pushHistory(s, '生涯结束', reason, 'bad');
  try {
    syncMedals(s, true);
    commitAchievements(s);
    commitLegacy(s);
  } catch (err) {}
}

/* ---------- 存档（6 个生涯槽） ---------- */
const SAVE_KEY = 'jiangxing_zhilu_save_v2';          // 旧单档，用于一次性迁移
const SAVE_SLOT_COUNT = 6;
const SAVE_SLOT_ACTIVE = 'jiangxing_zhilu_active_slot';
const SAVE_SLOT_PREFIX = 'jiangxing_zhilu_slot_';

function slotKey(n) {
  const i = parseInt(n, 10);
  if (!(i >= 1 && i <= SAVE_SLOT_COUNT)) return null;
  return SAVE_SLOT_PREFIX + i;
}

function getActiveSlot() {
  try {
    const v = parseInt(localStorage.getItem(SAVE_SLOT_ACTIVE), 10);
    if (v >= 1 && v <= SAVE_SLOT_COUNT) return v;
  } catch (e) {}
  return 1;
}

function setActiveSlot(n) {
  const i = parseInt(n, 10);
  if (!(i >= 1 && i <= SAVE_SLOT_COUNT)) return false;
  try { localStorage.setItem(SAVE_SLOT_ACTIVE, String(i)); } catch (e) {}
  return true;
}

function migrateLegacySave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const k1 = slotKey(1);
    if (!localStorage.getItem(k1)) {
      localStorage.setItem(k1, raw);
    }
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {}
}

function slotMetaFrom(s) {
  if (!s) return null;
  return {
    name: s.name || '无名',
    rank: (RANKS[s.rankIdx] || {}).name || '—',
    position: (POSITION_MAP[s.positionId] || {}).name || '',
    year: s.serviceYear || s.year || 1,
    difficulty: DIFFICULTIES[s.difficulty] ? DIFFICULTIES[s.difficulty].name : '标准',
    ended: !!s.ended,
    ending: s.ending ? s.ending.name : '',
    merit: Math.round(s.merit || 0),
    savedAt: s.savedAt || 0
  };
}

function readSlotRaw(n) {
  const k = slotKey(n);
  if (!k) return null;
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function writeSlotRaw(n, s) {
  const k = slotKey(n);
  if (!k || !s) return false;
  try {
    s.slot = parseInt(n, 10);
    s.savedAt = Date.now();
    localStorage.setItem(k, JSON.stringify(s));
    return true;
  } catch (e) { return false; }
}

function listSlots() {
  migrateLegacySave();
  const list = [];
  for (let i = 1; i <= SAVE_SLOT_COUNT; i++) {
    const s = readSlotRaw(i);
    list.push({
      id: i,
      empty: !s,
      active: getActiveSlot() === i,
      meta: slotMetaFrom(s)
    });
  }
  return list;
}

function loadSlot(n) {
  migrateLegacySave();
  const s = readSlotRaw(n);
  if (!s) return null;
  return normalizeSave(s);
}

function deleteSlot(n) {
  const k = slotKey(n);
  if (!k) return false;
  try { localStorage.removeItem(k); return true; } catch (e) { return false; }
}

function pickEmptySlot() {
  for (let i = 1; i <= SAVE_SLOT_COUNT; i++) {
    if (!readSlotRaw(i)) return i;
  }
  return null;
}

function normalizeSave(s) {
  if (!s || typeof s !== 'object') return s;
  if (!s.difficulty || !DIFFICULTIES[s.difficulty]) s.difficulty = 'normal';
  if (s.sfxOn == null) s.sfxOn = true;
  if (!s.notified) s.notified = {};
  if (!s.flags) s.flags = {};
  if (!s.careerTrack) s.careerTrack = [];
  if (!s.usedEvents) s.usedEvents = [];
  if (!s.pendingEchoes) s.pendingEchoes = [];
  if (!s.pendingChains) s.pendingChains = [];
  if (!s.log) s.log = [];
  if (!s.history) s.history = [];
  if (!s.injuryCount) s.injuryCount = 0;
  if (s.heir == null) s.heir = 0;
  if (!s.positionId || !POSITION_MAP[s.positionId]) s.positionId = 'p_soldier';
  if (s.positionYear == null) s.positionYear = 1;
  if (!s.familyInfo) {
    s.familyInfo = { married: false, spouse: '', spouseTag: '', kids: 0, kidNames: [], tension: 0 };
  }
  if (!s.unit) initUnit(s);
  if (!s.lastEraId) s.lastEraId = (eraForYear(s.year || 1) || {}).id;
  if (!s.rivals || !s.rivals.length) initRivals(s);
  s.rivals.forEach(r => {
    if (!r.style) {
      r.style = RIVAL_STYLE_KEYS[Math.floor(Math.random() * RIVAL_STYLE_KEYS.length)];
      r.styleName = (RIVAL_STYLES[r.style] || RIVAL_STYLES.balanced).name;
      r.prestige = r.prestige != null ? r.prestige : rnd(18, 32);
      r.discipline = r.discipline != null ? r.discipline : rnd(58, 72);
      r.ambition = r.ambition != null ? r.ambition : rnd(0.7, 1.3);
      r.heat = r.heat || 0;
      r.rankIdx = r.rankIdx != null ? r.rankIdx : rivalRankIdx(r.merit || 0);
    }
  });
  if (!s.usedActions) s.usedActions = {};
  if (s.failStreak == null) s.failStreak = 0;
  if (s.ap == null) s.ap = STAGES[s.stage] ? STAGES[s.stage].ap : 5;
  if (s.apMax == null) s.apMax = s.ap;
  if (!s.slot) s.slot = getActiveSlot();
  return s;
}

function saveGame(s) {
  migrateLegacySave();
  const n = (s && s.slot) || getActiveSlot();
  return writeSlotRaw(n, s);
}

function loadGame() {
  migrateLegacySave();
  const n = getActiveSlot();
  return loadSlot(n);
}

function clearSave() {
  // 只清当前槽，不动其他 5 个
  deleteSlot(getActiveSlot());
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
  try {
    localStorage.removeItem(ACHV_KEY);
    localStorage.removeItem(LEGACY_KEY);
    localStorage.removeItem(MEDAL_KEY);
  } catch (e) {}
}

/* ---------- 勋章墙（跨周目） ---------- */
const MEDAL_KEY = 'jiangxing_zhilu_medals_v1';

function loadMedals() {
  try {
    const raw = localStorage.getItem(MEDAL_KEY);
    const o = raw ? JSON.parse(raw) : null;
    if (o && o.unlocked) return o;
  } catch (e) {}
  return { unlocked: [], gotAt: {} };
}

function saveMedals(store) {
  try { localStorage.setItem(MEDAL_KEY, JSON.stringify(store)); } catch (e) {}
}

function evaluateMedals(s) {
  const list = [];
  MEDALS.forEach(m => {
    let ok = false;
    try { ok = !!m.cond(s); } catch (e) { ok = false; }
    if (ok) list.push(m);
  });
  return list;
}

/* 把当前生涯符合条件的勋章写入收藏；返回本次新获得的列表 */
function syncMedals(s, silent) {
  const store = loadMedals();
  const fresh = [];
  evaluateMedals(s).forEach(m => {
    if (store.unlocked.indexOf(m.id) >= 0) return;
    store.unlocked.push(m.id);
    if (!store.gotAt) store.gotAt = {};
    store.gotAt[m.id] = {
      year: s.year || s.serviceYear || 1,
      name: s.name || '',
      rank: (RANKS[s.rankIdx] || {}).name || ''
    };
    fresh.push(m);
    if (!silent) pushLog(s, '荣获勋章', m.name + ' · ' + m.desc, 'gold');
  });
  if (fresh.length) saveMedals(store);
  return fresh;
}

function medalOwned(id) {
  return loadMedals().unlocked.indexOf(id) >= 0;
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

/* ============================================================
   存档导出 / 导入（混淆加密）
   流程：JSON → UTF-8 → 滚动异或（密钥+位置）→ Base64 → 前缀包装
   ============================================================ */
const SAVE_PACK_PREFIX = 'JXZSAVE1:';
const SAVE_PACK_KEY = '将星之路·军事生涯模拟@2026#jiangxing-zhilu';

function packBytes(u8, key) {
  const kb = new TextEncoder().encode(key);
  const out = new Uint8Array(u8.length);
  for (let i = 0; i < u8.length; i++) {
    out[i] = (u8[i] ^ kb[i % kb.length] ^ ((i * 31 + 17) & 0xff)) & 0xff;
  }
  return out;
}

function b64FromU8(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  // 标准 Base64 后再做一次字符打乱，增加肉眼不可读性
  const b64 = btoa(s);
  return b64.replace(/=/g, '').split('').reverse().join('');
}

function u8FromB64(str) {
  const padded = str.split('').reverse().join('');
  const pad = (4 - (padded.length % 4)) % 4;
  const b64 = padded + '='.repeat(pad);
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

/* 将当前存档打包成可复制的字符串 */
function exportSavePack(slotId) {
  const n = slotId || getActiveSlot();
  const game = loadSlot(n) || loadGame();
  const achv = loadAchv();
  const medals = loadMedals();
  const legacy = loadLegacy();
  const payload = {
    v: 1,
    exportedAt: Date.now(),
    slot: n,
    game: game,
    achv: achv,
    medals: medals,
    legacy: legacy
  };
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  const enc = packBytes(bytes, SAVE_PACK_KEY);
  return SAVE_PACK_PREFIX + b64FromU8(enc);
}

/* 解析导出串；成功则写回本地并返回 true */
function importSavePack(text, targetSlot) {
  if (!text || typeof text !== 'string') return { ok: false, reason: '内容为空' };
  const t = text.trim().replace(/\s+/g, '');
  if (t.indexOf(SAVE_PACK_PREFIX) !== 0) return { ok: false, reason: '不是有效的将星之路存档' };
  try {
    const body = t.slice(SAVE_PACK_PREFIX.length);
    const enc = u8FromB64(body);
    const raw = packBytes(enc, SAVE_PACK_KEY); // 异或是对合运算
    const json = new TextDecoder().decode(raw);
    const payload = JSON.parse(json);
    if (!payload || payload.v !== 1) return { ok: false, reason: '存档版本不兼容' };
    const n = targetSlot || getActiveSlot();
    if (payload.game) {
      const g = normalizeSave(payload.game);
      g.slot = n;
      writeSlotRaw(n, g);
      setActiveSlot(n);
    }
    if (payload.achv) localStorage.setItem(ACHV_KEY, JSON.stringify(payload.achv));
    if (payload.medals) localStorage.setItem(MEDAL_KEY, JSON.stringify(payload.medals));
    if (payload.legacy) localStorage.setItem(LEGACY_KEY, JSON.stringify(payload.legacy));
    return { ok: true, slot: n, name: payload.game && payload.game.name, ended: payload.game && payload.game.ended };
  } catch (e) {
    return { ok: false, reason: '解密失败，存档可能已损坏或被篡改' };
  }
}
