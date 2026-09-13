/* 自动模拟器：跑大量随机生涯，检验晋升速度、任务风险、同期位次与卡关点
   用法：node tools/simulate.js [次数]                        */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const store = {};
const ctx = {
  console, Math, JSON, Date, process,
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
    removeItem: k => { delete store[k]; }
  }
};
ctx.window = ctx;
vm.createContext(ctx);

const src = [
  fs.readFileSync(path.join(ROOT, 'js/data.js'), 'utf8'),
  fs.readFileSync(path.join(ROOT, 'js/engine.js'), 'utf8')
].join('\n');

const SIM = `
let GRADE_COUNT = { S:0, A:0, B:0, C:0, D:0 };

function spendSP(s) {
  let guard = 0;
  const all = [];
  SKILL_BRANCHES.forEach(b => b.skills.forEach(k => all.push(k.key)));
  while (s.sp > 0 && guard++ < 300) {
    let did = false;
    for (const k of all) {
      const lv = s.skills[k] || 0;
      if (lv >= 6) continue;
      const cost = SKILL_COST[lv + 1];
      if (s.sp >= cost) { s.sp -= cost; s.skills[k] = lv + 1; did = true; break; }
    }
    if (!did) break;
  }
}

function runOne(mode, routeKey) {
  const alloc = {};
  ATTRS.forEach(a => { alloc[a.key] = 5; });
  const traits = mode === 'grand' ? ['duty','steady','humble']
              : mode === 'weak' ? ['impulsive','stubborn','competitive']
              : mode === 'avg'  ? ['brave','bold','competitive']
              : ['duty','steady','humble'];
  const s = newGame('模拟', alloc, traits);
  beginTurn(s);
  let guard = 0;
  const stageMerit = {};
  let lastStage = s.stage;
  const rankTrack = [];

  while (!s.ended && guard++ < 400) {
    autoSpendAP(s, mode === 'grand' ? { discTarget: 86, meritTarget: 2 } : null);
    spendSP(s);

    const res = finishTurn(s);
    if (res.finished) break;
    if (s.stage !== lastStage) { stageMerit[lastStage] = s.merit; lastStage = s.stage; }

    for (const item of res.queue) {
      if (item.type === 'route') {
        chooseRoute(s, routeKey || (mode === 'grand' ? 'command' : mode === 'weak' ? 'staff' : mode === 'avg' ? 'political' : 'command'));
      } else if (item.type === 'event') {
        applyOption(s, item.data, item.data.options[Math.floor(Math.random() * item.data.options.length)]);
      } else if (item.type === 'task') {
        const tr = resolveTask(s, item.data);
        GRADE_COUNT[tr.grade] = (GRADE_COUNT[tr.grade] || 0) + 1;
        if (s.ended) break;
      } else if (item.type === 'promotion') {
        if (!item.data.blocked) applyPromotion(s, item.data);
      }
    }
    if (s.ended) break;
    beginTurn(s);
    if (guard % 8 === 0) rankTrack.push(myRank(s).pos);
  }
  if (!s.ended) finishCareer(s, '服役期满');
  s.__stageMerit = stageMerit;
  s.__rankTrack = rankTrack;
  return s;
}

function pct(arr, p) {
  if (!arr.length) return 0;
  const a = arr.slice().sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(a.length * p))];
}

function run(N, mode, routeKey) {
  const label = mode + (routeKey ? ' · ' + ROUTES[routeKey].name : '');
  const rankCount = {};
  const stageReach = { recruit:0, nco:0, officer:0, field:0, general:0, marshal:0, legacy:0 };
  let meritSum = 0, prestigeSum = 0, discSum = 0, yearsSum = 0, deadCount = 0, heirSum = 0;
  let moraleSum = 0, healthSum = 0, posSum = 0, posN = 0, topCount = 0, bottomCount = 0;
  let milSum = 0, polSum = 0, profSum = 0, tsSum = 0, mlSum = 0;
  const endingCount = {};
  const stageMeritSum = {};
  const stageMeritN = {};
  const allMerit = [];
  const gradeCount = GRADE_COUNT;

  for (let i = 0; i < N; i++) {
    const s = runOne(mode, routeKey);
    rankCount[RANKS[s.rankIdx].name] = (rankCount[RANKS[s.rankIdx].name] || 0) + 1;
    meritSum += s.merit; prestigeSum += s.st.prestige; moraleSum += s.st.morale;
    healthSum += s.st.health; discSum += s.dv.discipline; yearsSum += s.serviceYear;
    heirSum += (s.heir || 0);
    milSum += s.dv.military; polSum += s.dv.political; profSum += s.dv.professional;
    tsSum += s.attr.tongshuai; mlSum += s.attr.meili;
    allMerit.push(s.merit);
    Object.keys(s.__stageMerit || {}).forEach(k => {
      stageMeritSum[k] = (stageMeritSum[k] || 0) + s.__stageMerit[k];
      stageMeritN[k] = (stageMeritN[k] || 0) + 1;
    });
    const fin = myRank(s);
    posSum += fin.pos; posN++;
    if (fin.pos <= 2) topCount++;
    if (fin.pos >= 7) bottomCount++;
    (s.__rankTrack || []).forEach(p => { posSum += p; posN++; });
    if (s.endReason === '执行任务中牺牲') deadCount++;
    const ek = s.ending ? s.ending.name : '无';
    endingCount[ek] = (endingCount[ek] || 0) + 1;
    STAGE_ORDER.forEach(k => { if (stageIndex(s.stage) >= stageIndex(k)) stageReach[k]++; });
  }

  const totalGrades = Object.keys(gradeCount).reduce((n, k) => n + gradeCount[k], 0) || 1;
  console.log('===== ' + label + '（' + N + ' 次） =====');
  console.log('平均在役年数: ' + (yearsSum / N).toFixed(1) + '  总回合数: ' + TIMELINE.length);
  console.log('平均累计功勋: ' + (meritSum / N).toFixed(0)
    + '  中位数: ' + pct(allMerit, 0.5).toFixed(0)
    + '  P25: ' + pct(allMerit, 0.25).toFixed(0)
    + '  P75: ' + pct(allMerit, 0.75).toFixed(0));
  console.log('平均威望: ' + (prestigeSum / N).toFixed(1)
    + '  士气: ' + (moraleSum / N).toFixed(1)
    + '  健康: ' + (healthSum / N).toFixed(1)
    + '  纪律: ' + (discSum / N).toFixed(1));
  console.log('平均同期位次: ' + (posSum / posN).toFixed(2) + ' / 8'
    + '   终局进前二: ' + (topCount / N * 100).toFixed(1) + '%'
    + '   终局落末二: ' + (bottomCount / N * 100).toFixed(1) + '%');
  console.log('平均培养接班人: ' + (heirSum / N).toFixed(2) + '  牺牲率: ' + (deadCount / N * 100).toFixed(2) + '%');
  console.log('终局指标: 军事素养 ' + (milSum / N).toFixed(1) + '  政治素养 ' + (polSum / N).toFixed(1)
    + '  专业能力 ' + (profSum / N).toFixed(1) + '  统率 ' + (tsSum / N).toFixed(1) + '  魅力 ' + (mlSum / N).toFixed(1));
  console.log('任务评价分布: ' + Object.keys(gradeCount).map(k => k + ' ' + (gradeCount[k] / totalGrades * 100).toFixed(1) + '%').join('  '));
  console.log('--- 离开各阶段时的累计功勋 ---');
  STAGE_ORDER.forEach(k => {
    if (stageMeritN[k]) console.log('  离开' + STAGES[k].name + '：' + (stageMeritSum[k] / stageMeritN[k]).toFixed(0));
  });
  console.log('--- 最终军衔分布 ---');
  RANKS.forEach(r => {
    const c = rankCount[r.name] || 0;
    if (c) console.log('  ' + r.name.padEnd(6, '　') + ' ' + (c / N * 100).toFixed(1) + '%  (' + c + ')');
  });
  console.log('--- 结局分布 ---');
  Object.keys(endingCount).sort((a,b) => endingCount[b]-endingCount[a]).forEach(k =>
    console.log('  ' + k.padEnd(6, '　') + ' ' + (endingCount[k] / N * 100).toFixed(1) + '%'));
  console.log('');
}

const N = parseInt(process.argv[2] || '1000', 10);
run(N, 'strong');
run(N, 'avg');
run(N, 'weak');
run(N, 'grand');
console.log('########## 同特质下三条路线对比（avg 特质） ##########');
['command','political','staff'].forEach(r => run(N, 'avg', r));
`;

vm.runInContext(src + '\n' + SIM, ctx, { filename: 'sim.js' });
