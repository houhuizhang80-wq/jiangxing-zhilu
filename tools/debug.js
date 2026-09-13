const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const store = {};
const ctx = { console, Math, JSON, Date, process, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } } };
ctx.window = ctx; vm.createContext(ctx);
const src = [fs.readFileSync(ROOT + '/js/data.js', 'utf8'), fs.readFileSync(ROOT + '/js/engine.js', 'utf8')].join('\n');

const SIM = `
function spendSP(s){let g=0;const all=[];SKILL_BRANCHES.forEach(b=>b.skills.forEach(k=>all.push(k.key)));
  while(s.sp>0&&g++<300){let did=false;for(const k of all){const lv=s.skills[k]||0;if(lv>=6)continue;const c=SKILL_COST[lv+1];if(s.sp>=c){s.sp-=c;s.skills[k]=lv+1;did=true;break;}}if(!did)break;}}

function runOne(trace){
  const alloc={};ATTRS.forEach(a=>alloc[a.key]=5);
  const s=newGame('X',alloc,['duty','steady','humble']);
  beginTurn(s);
  let g=0; const tl=[];
  while(!s.ended&&g++<400){
    autoSpendAP(s); spendSP(s);
    const res=finishTurn(s);
    if(res.finished)break;
    for(const it of res.queue){
      if(it.type==='event')applyOption(s,it.data,it.data.options[0]);
      else if(it.type==='task'){resolveTask(s,it.data);if(s.ended)break;}
      else if(it.type==='promotion'){if(!it.data.blocked)applyPromotion(s,it.data);}
    }
    if(s.ended)break;
    beginTurn(s);
    if(trace) tl.push({turn:g,age:s.age,hp:Math.round(s.st.health),stage:s.stage,merit:Math.round(s.merit),inj:s.injuryCount,rest:s.usedActions.rest||0});
  }
  if(!s.ended)finishCareer(s,'服役期满');
  s.__tl=tl; return s;
}

// 1. 追踪一局的健康曲线
const t=runOne(true);
console.log('--- 单局健康轨迹（每 5 回合采样）---');
console.log('结束原因:', t.endReason, ' 在役年数:', t.serviceYear);
t.__tl.filter((_,i)=>i%5===0).forEach(r=>console.log('  回合'+r.turn+' 年龄'+r.age+' 健康'+r.hp+' 阶段'+r.stage+' 功勋'+r.merit+' 负伤'+r.inj+' 本回合休息'+r.rest));

// 2. 结束原因分布
const reasons={}, hpAtEnd=[];
let sumYear=0;
for(let i=0;i<600;i++){
  const s=runOne(false);
  reasons[s.endReason]=(reasons[s.endReason]||0)+1;
  hpAtEnd.push(s.st.health); sumYear+=s.serviceYear;
}
console.log('\\n--- 结束原因分布（600 局）---');
Object.keys(reasons).sort((a,b)=>reasons[b]-reasons[a]).forEach(k=>console.log('  '+k+': '+(reasons[k]/600*100).toFixed(1)+'%'));
console.log('平均在役年数:', (sumYear/600).toFixed(1));
console.log('结束健康 中位数:', hpAtEnd.sort((a,b)=>a-b)[300].toFixed(1));

// 3. 单回合行动消耗检查
const s2=newGame('Y',{tibo:5,zhimou:5,tongshuai:5,meili:5,xinnian:5,yizhi:5},['duty','steady','humble']);
beginTurn(s2);
console.log('\\n--- 首回合（新兵期，AP='+s2.ap+'）自动安排后的行动 ---');
autoSpendAP(s2);
console.log('  已用行动:', JSON.stringify(s2.usedActions), ' 剩余AP:', s2.ap, ' 健康:', s2.st.health.toFixed(1));

const s3=newGame('Z',{tibo:5,zhimou:5,tongshuai:5,meili:5,xinnian:5,yizhi:5},['duty','steady','humble']);
s3.turnIndex=40; s3.stage='general'; s3.year=33; s3.age=50;
beginTurn(s3);
autoSpendAP(s3);
console.log('--- 将官期（AP='+s3.apMax+'）自动安排后的行动 ---');
console.log('  已用行动:', JSON.stringify(s3.usedActions), ' 剩余AP:', s3.ap);
`;
vm.runInContext(src + '\n' + SIM, ctx, { filename: 'dbg.js' });
