/* 6 槽存档冒烟 */
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
els.inName.value = '槽位测试';
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
if (SAVE_SLOT_COUNT !== 6) throw new Error('槽数应为 6');

// 模拟旧单档迁移
localStorage.setItem('jiangxing_zhilu_save_v2', JSON.stringify({ name:'旧档', rankIdx:3, year:5, serviceYear:5, merit:900, stage:'nco', difficulty:'normal', attr:{}, dv:{discipline:66}, st:{}, skills:{}, traits:[], flags:{}, log:[], history:[], rivals:[], unit:null }));
migrateLegacySave();
if (localStorage.getItem('jiangxing_zhilu_save_v2')) throw new Error('旧档未迁移清理');
const slot1 = readSlotRaw(1);
if (!slot1 || slot1.name !== '旧档') throw new Error('旧档未进槽1');

// 写满 6 槽
for (let i = 1; i <= 6; i++) {
  setActiveSlot(i);
  const s = newGame('兵'+i, {tibo:5,zhimou:5,tongshuai:5,meili:5,xinnian:5,yizhi:5}, ['duty','steady','humble'], { difficulty:'hard', slot:i });
  s.serviceYear = i * 3;
  s.year = i * 3;
  saveGame(s);
}
const slots = listSlots();
if (slots.length !== 6) throw new Error('listSlots 数量错误');
if (slots.some(x => x.empty)) throw new Error('应写满');
if (!slots[0].active && getActiveSlot() !== 6) { /* active is 6 */ }
if (getActiveSlot() !== 6) throw new Error('活动槽应为 6');

// 导出槽 2 → 导入槽 4 覆盖
const pack = exportSavePack(2);
if (pack.indexOf('JXZSAVE1:') !== 0) throw new Error('导出格式');
deleteSlot(4);
const r = importSavePack(pack, 4);
if (!r.ok) throw new Error('导入失败');
const g4 = readSlotRaw(4);
if (!g4 || g4.name !== '兵2') throw new Error('槽4内容应为兵2');
if (g4.slot !== 4) throw new Error('导入后槽号应为4');

// 删除当前槽不影响其他
setActiveSlot(1);
clearSave();
if (readSlotRaw(1)) throw new Error('槽1应已清空');
if (!readSlotRaw(2) || !readSlotRaw(3)) throw new Error('其他槽应保留');

openSaveIO();
const html = els.modalRoot.innerHTML;
if (html.indexOf('槽 6') < 0 && html.indexOf('槽 1') < 0) throw new Error('槽管理界面未渲染');
if (html.indexOf('生涯存档') < 0) throw new Error('标题缺失');

console.log('槽位:', slots.map(s => s.id + (s.empty?'空':'有')).join(','));
console.log('导出导入/迁移/删除 隔离正常');
console.log('6 槽存档冒烟通过');
`, ctx);
