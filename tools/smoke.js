/* 界面层冒烟测试：用最小 DOM 桩驱动完整一局（含任务小游戏），检查运行时错误 */

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function makeEl(id) {
  return {
    id, innerHTML: '', textContent: '', value: '', style: {}, onclick: null,
    addEventListener() {}, appendChild() {}, classList: { add() {}, remove() {} }
  };
}
const els = {};
const document = {
  getElementById(id) { return (els[id] = els[id] || makeEl(id)); },
  addEventListener() {}, createElement: makeEl
};
els.inName = makeEl('inName');
els.inName.value = '测试员';

const handlers = {};
const store = {};
const ctx = {
  console, Math, JSON, Date, process, document,
  alert: m => { throw new Error('意外弹出 alert: ' + m); },
  confirm: () => true,
  setTimeout: f => f(),
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
    removeItem: k => { delete store[k]; }
  }
};
ctx.window = ctx;
ctx.window.addEventListener = (name, fn) => { handlers[name] = fn; };
ctx.handlers = handlers;
vm.createContext(ctx);

const src = ['js/data.js', 'js/engine.js', 'js/ui.js']
  .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');

const DRIVE = `
handlers['DOMContentLoaded']();
setupRandom();
startGame();

let turns = 0, modals = 0, tasks = 0, decisions = 0, promotions = 0, events = 0, routes = 0, chained = 0;
const gradeCount = {};

while (!S.ended && turns < 80) {
  onAutoArrange();                 // 自动安排行动点
  openSkills(); modals++;
  SKILL_BRANCHES.forEach(b => b.skills.forEach(sk => upSkill(sk.key)));
  closeModal();
  openHistory(); closeModal(); modals++;
  openRanking(); closeModal(); modals++;
  openNetwork(); closeModal(); modals++;

  // 直接驱动引擎，避免 processQueue 先消费掉队列首项造成统计失真
  const res = finishTurn(S);
  QUEUE = res.queue || [];
  if (res.finished) { showEnding(); break; }

  let g = 0;
  while (!S.ended && QUEUE.length > 0 && g++ < 40) {
    const it = QUEUE.shift();
    modals++;
    if (it.type === 'event') {
      events++;
      if (it.data.chained) chained++;
      showEvent(it.data); onEventOption(0); closeModal();
    } else if (it.type === 'task') {
      tasks++;
      showTask(it.data);                       // 第一步：战前部署
      taskAuto();                              // 自动部署
      taskGoDecide();                          // 进入第二步
      let d = 0;
      while (TASK_RUN.decisionIndex < (TASK_RUN.task.decisions || []).length && d++ < 10) {
        taskChoose(0); decisions++;            // 第二步：临机决断
      }
      closeModal();                            // 第三步：结算已渲染
    } else if (it.type === 'promotion') {
      promotions++;
      showPromotion(it.data); closeModal();
    } else if (it.type === 'route') {
      routes++;
      showRouteChoice();
      onChooseRoute(['command','political','staff'][turns % 3]);
      closeModal();
    } else if (it.type === 'stage') {
      showStage(it.data); closeModal();
    } else if (it.type === 'echo') {
      showEcho(it.data); closeModal();
    } else if (it.type === 'review') {
      showReview(it.data); closeModal();
    }
  }
  if (!S.ended) { beginTurn(S); renderAll(); }
  turns++;
}

showEnding();
console.log('界面冒烟测试通过');
console.log('  回合数: ' + turns + '   弹窗渲染: ' + modals);
console.log('  事件: ' + events + '   任务推演: ' + tasks + '   临机决断: ' + decisions + '   晋升: ' + promotions + '   路线抉择: ' + routes);
console.log('  姓名: ' + S.name + '   最终军衔: ' + RANKS[S.rankIdx].name + '   在役: ' + S.serviceYear + ' 年');
console.log('  路线: ' + (S.route ? ROUTES[S.route].name : '未定'));
console.log('  功勋: ' + Math.round(S.merit) + '   同期位次: ' + myRank(S).pos + '/' + myRank(S).total);
console.log('  结局: ' + (S.ending ? S.ending.name : '无') + '   履历: ' + S.history.length + ' 条');
console.log('  事件链触发: ' + chained + ' 次   本次解锁成就: ' + ((S.newAchievements||[]).length) + ' / ' + ACHIEVEMENTS.length);
console.log('  成就累计: ' + loadAchv().unlocked.length + ' / ' + ACHIEVEMENTS.length + '   周目数: ' + loadAchv().runs);
const lg = legacySummary();
if (lg) console.log('  传承记录: ' + lg.last.name + ' · ' + lg.last.rankName + ' · ' + lg.last.ending + '　可用家训 ' + availableMottos().length + ' 条');

// 二周目验证：继承上一世家训，并强制测试专属事件
const mottos = availableMottos();
const m = mottos.find(x => x.id !== 'm_none') || mottos[0];
const alloc2={}; ATTRS.forEach(a=>alloc2[a.key]=5);
const s2 = newGame('测试员二代', alloc2, ['duty','steady','humble'], {
  enlist:'college', motto:m?m.id:null, legacy:true, prename:S.name
});
console.log('  二周目创建: '+s2.name+' · '+ENLIST_TYPES[s2.enlist].name+' · 家训 '+(m?m.name:'无'));
const lev=LEGACY_EVENTS[0];
const txt=fillNames(s2,lev.text);
if(!txt.includes(S.name)) throw new Error('二周目事件未替换父辈姓名');
console.log('  二周目专属事件验证: '+lev.title+' → '+txt);

`;

try {
  vm.runInContext(src + '\n' + DRIVE, ctx, { filename: 'smoke.js' });
} catch (e) {
  console.error('冒烟测试失败：');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
}
