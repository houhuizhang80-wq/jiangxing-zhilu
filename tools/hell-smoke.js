/* 淬火难度风险冒烟 */
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
vm.runInContext(src, ctx);
vm.runInContext(`
let grades = {S:0,A:0,B:0,C:0,D:0};
let dead = 0, inj = 0, n = 0;
for (let i = 0; i < 400; i++) {
  const alloc = {}; ATTRS.forEach(a => alloc[a.key] = 5);
  const s = newGame('淬火'+i, alloc, ['impulsive','brave','competitive'], { difficulty:'hell' });
  beginTurn(s);
  let g = 0;
  while (!s.ended && g++ < 80) {
    autoSpendAP(s);
    const res = finishTurn(s);
    if (res.finished) break;
    for (const item of res.queue) {
      if (item.type === 'route') chooseRoute(s, 'command');
      else if (item.type === 'event') applyOption(s, item.data, item.data.options[0]);
      else if (item.type === 'task') {
        const tr = resolveTask(s, item.data);
        grades[tr.grade] = (grades[tr.grade]||0)+1;
        if (tr.injury) inj++;
        if (tr.dead) dead++;
        if (s.ended) break;
      } else if (item.type === 'promotion' && !item.data.blocked) applyPromotion(s, item.data);
    }
    if (s.ended) break;
  }
  n++;
}
console.log('淬火局数', n);
console.log('评价', JSON.stringify(grades));
console.log('负伤次数', inj, '牺牲局', dead);
const dRate = (grades.D||0) / Math.max(1, grades.S+grades.A+grades.B+grades.C+grades.D);
console.log('D评占比', (dRate*100).toFixed(1)+'%');
if ((grades.D||0) < 5) console.log('提示：D评仍偏少');
else console.log('淬火风险冒烟通过');
`, ctx);
