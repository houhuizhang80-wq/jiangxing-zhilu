/* 职务任命冒烟 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');
function makeEl(id) {
  return { id, innerHTML: '', textContent: '', value: '', style: {}, onclick: null,
    addEventListener() {}, appendChild() {}, classList: { add() {}, remove() {} } };
}
const els = {};
const document = {
  getElementById(id) { return (els[id] = els[id] || makeEl(id)); },
  addEventListener() {}, createElement: makeEl
};
els.inName = makeEl('inName');
els.inName.value = '职务测试';
const handlers = {};
const store = {};
const ctx = {
  console, Math, JSON, Date, process, document,
  TextEncoder, TextDecoder, btoa, atob,
  alert: m => { throw new Error(m); },
  confirm: () => true, setTimeout: f => f(),
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  }
};
ctx.window = ctx;
ctx.window.addEventListener = (n, f) => { handlers[n] = f; };
ctx.handlers = handlers;
ctx.els = els;
vm.createContext(ctx);
const src = ['js/data.js', 'js/engine.js', 'js/ui.js']
  .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
vm.runInContext(src, ctx);
vm.runInContext(`
handlers['DOMContentLoaded']();
SETUP = { alloc:{}, traits:['duty','steady','humble'], name:'职务测试', enlist:'conscript', motto:null, difficulty:'normal' };
ATTRS.forEach(a => SETUP.alloc[a.key] = 5);
startGame();
const trail = [];
trail.push('开局:' + getPosition(S).name);
let n = 0;
while (!S.ended && n++ < 60) {
  onAutoArrange();
  const r = finishTurn(S);
  QUEUE = r.queue || [];
  if (r.finished) { showEnding(); break; }
  while (QUEUE.length) {
    const it = QUEUE.shift();
    if (it.type === 'event') { showEvent(it.data); onEventOption(0); closeModal(); }
    else if (it.type === 'route') { showRouteChoice(); onChooseRoute('staff'); closeModal(); }
    else if (it.type === 'task') {
      showTask(it.data); taskAuto(); taskGoDecide();
      let d = 0;
      while (TASK_RUN && TASK_RUN.decisionIndex < (TASK_RUN.task.decisions || []).length && d++ < 8) taskChoose(0);
      closeModal();
    }
    else if (it.type === 'promotion') { showPromotion(it.data); closeModal(); }
    else if (it.type === 'review' || it.type === 'era' || it.type === 'stage' || it.type === 'echo') closeModal();
  }
  beginTurn(S); renderAll();
  if (n % 10 === 0) trail.push('Y' + S.year + ':' + getPosition(S).name + '/' + RANKS[S.rankIdx].name);
}
showEnding();
trail.push('终局:' + getPosition(S).name + '/' + RANKS[S.rankIdx].name);
console.log(trail.join(' → '));
const appoinments = S.history.filter(h => h.title.indexOf('任') === 0 || h.title.indexOf('职务') >= 0).length;
console.log('职务相关履历条数:', appoinments);
if (!getPosition(S) || getPosition(S).id === undefined) throw new Error('职务丢失');
if (getPosition(S).id === 'p_soldier' && S.rankIdx > 5) throw new Error('高军衔仍是战士，任命失败');
console.log('职务系统冒烟通过');
`, ctx);
