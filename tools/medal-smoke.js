/* 勋章墙冒烟：跑一局并检查勋章授予与墙面渲染 */
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
els.inName.value = '勋章测试';
const handlers = {};
const store = {};
const ctx = {
  console, Math, JSON, Date, process, document,
  alert: m => { throw new Error(m); },
  confirm: () => true,
  setTimeout: f => f(),
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
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
setupRandom();
startGame();
let n = 0;
while (!S.ended && n++ < 60) {
  onAutoArrange();
  const r = finishTurn(S);
  QUEUE = r.queue || [];
  if (r.finished) { showEnding(); break; }
  while (QUEUE.length) {
    const it = QUEUE.shift();
    if (it.type === 'event') { showEvent(it.data); onEventOption(0); closeModal(); }
    else if (it.type === 'task') {
      showTask(it.data); taskAuto(); taskGoDecide();
      let d = 0;
      while (TASK_RUN && TASK_RUN.decisionIndex < (TASK_RUN.task.decisions || []).length && d++ < 8) taskChoose(0);
      closeModal();
    }
    else if (it.type === 'promotion') { showPromotion(it.data); closeModal(); }
    else if (it.type === 'route') { showRouteChoice(); onChooseRoute('staff'); closeModal(); }
    else if (it.type === 'review') { showReview(it.data); closeModal(); }
    else if (it.type === 'stage' || it.type === 'echo') { closeModal(); }
  }
  beginTurn(S); renderAll();
}
showEnding();
const ms = loadMedals();
console.log('勋章解锁:', ms.unlocked.length, '/', MEDALS.length);
console.log('名单:', ms.unlocked.map(id => (MEDALS.find(m => m.id === id) || {}).name).filter(Boolean).join('、'));
openMedals();
const html = els.modalRoot.innerHTML;
console.log('勋章墙可打开:', html.indexOf('medal-wall') >= 0, 'HTML', html.length, '字符');
if (ms.unlocked.length < 3) { console.error('勋章过少'); process.exit(1); }
if (html.indexOf('一等战功章') < 0 && html.indexOf('首战纪念章') < 0) {
  console.error('墙面未渲染勋章名'); process.exit(1);
}
console.log('勋章墙冒烟通过');
`, ctx);
