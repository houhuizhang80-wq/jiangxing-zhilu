/* 导出导入与难度冒烟 */
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
els.inName.value = '导出测试';
const handlers = {};
const store = {};
const ctx = {
  console, Math, JSON, Date, process, document,
  TextEncoder, TextDecoder, btoa, atob,
  alert: m => { throw new Error(m); },
  confirm: () => true,
  setTimeout: f => f(),
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
SETUP = { alloc:{}, traits:['duty','steady','humble'], name:'导出测试', enlist:'conscript', motto:null, difficulty:'hard' };
ATTRS.forEach(a => SETUP.alloc[a.key] = 5);
startGame();
if (S.difficulty !== 'hard') throw new Error('难度未写入');
if (!S.unit || !S.unit.name) throw new Error('部队未初始化');
for (let i = 0; i < 8; i++) { onAutoArrange(); const r = finishTurn(S); QUEUE = r.queue || [];
  while (QUEUE.length) { const it = QUEUE.shift();
    if (it.type === 'event') { showEvent(it.data); onEventOption(0); closeModal(); }
    else if (it.type === 'review' || it.type === 'era' || it.type === 'stage' || it.type === 'echo') closeModal();
  }
  beginTurn(S); renderAll();
}
saveGame(S);
const pack = exportSavePack();
if (!pack || pack.indexOf('JXZSAVE1:') !== 0) throw new Error('导出格式错误');
if (pack.indexOf('导出测试') >= 0) throw new Error('导出串未混淆明文姓名');
// 清空后导入
localStorage.removeItem('jiangxing_zhilu_save_v2');
const r = importSavePack(pack);
if (!r.ok) throw new Error('导入失败: ' + r.reason);
const back = loadGame();
if (!back || back.name !== '导出测试') throw new Error('导入后姓名不对');
if (back.difficulty !== 'hard') throw new Error('导入后难度丢失');
if (!back.unit || !back.careerTrack || back.careerTrack.length < 3) throw new Error('导入后轨迹/部队丢失');
openProfile();
if (els.modalRoot.innerHTML.indexOf('生涯档案') < 0) throw new Error('档案页未打开');
openSaveIO();
console.log('导出串长度', pack.length);
console.log('难度', back.difficulty, '部队', back.unit.name, back.unit.tier, '轨迹点', back.careerTrack.length);
console.log('导出导入/难度/档案冒烟通过');
`, ctx);
