/* ============================================================
   《将星之路》游戏数据层
   军衔 / 阶段 / 属性 / 行动 / 技能 / 特质 / 事件 / 任务 / 结局
   ============================================================ */

/* ---------- 六维基础属性 ---------- */
const ATTRS = [
  { key: 'tibo',     name: '体魄', desc: '体能上限、伤病恢复、长期服役' },
  { key: 'zhimou',   name: '智谋', desc: '学习效率、参谋业务、复杂任务判定' },
  { key: 'tongshuai',name: '统率', desc: '部队士气加成、指挥规模上限' },
  { key: 'meili',    name: '魅力', desc: '团结官兵、思想工作、拥军爱民' },
  { key: 'xinnian',  name: '信念', desc: '忠诚与荣誉感，抗诱惑、抗动摇' },
  { key: 'yizhi',    name: '意志', desc: '抗压、吃苦耐劳、危机任务判定' }
];

const ATTR_BASE = 30;          // 每维初始值
const ATTR_ALLOC = 30;         // 可自由分配点数
const ATTR_ALLOC_MAX = 10;     // 单项最多可加
const ATTR_CAP = 110;          // 硬上限
const ATTR_SOFT_CAP = 100;     // 常规上限

/* ---------- 派生指标 ---------- */
const DERIVED = [
  { key: 'military',    name: '军事素养', desc: '战术理解、演训成绩加成' },
  { key: 'political',   name: '政治素养', desc: '政治教育、谈心谈话成效' },
  { key: 'professional',name: '专业能力', desc: '装备、通信、后勤等岗位技能' }
];

/* ---------- 动态状态 ---------- */
const STATES = [
  { key: 'morale',   name: '士气',   desc: '随任务成败与带兵成效波动', max: 100, init: 70 },
  { key: 'health',   name: '健康',   desc: '随年龄与伤病下降，影响行动力', max: 100, init: 90 },
  { key: 'prestige', name: '威望',   desc: '部属与同僚对你的评价', max: 100, init: 10 },
  { key: 'trust',    name: '首长信任', desc: '影响任务分配与推荐力度', max: 100, init: 20 },
  { key: 'bond',     name: '搭档默契', desc: '军政双主官的协同程度', max: 100, init: 20 },
  { key: 'family',   name: '家庭',   desc: '长期后盾，影响抗压与士气', max: 100, init: 40 }
];

/* ---------- 军衔阶梯（功勋门槛呈加速曲线） ---------- */
const RANKS = [
  { name: '列兵',       need: 0,     stage: 'recruit' },
  { name: '上等兵',     need: 150,   stage: 'recruit' },
  { name: '下士',       need: 300,   stage: 'nco' },
  { name: '中士',       need: 550,   stage: 'nco' },
  { name: '上士',       need: 850,   stage: 'nco' },
  { name: '四级军士长', need: 1200,  stage: 'nco' },
  { name: '三级军士长', need: 1600,  stage: 'nco' },
  { name: '二级军士长', need: 2100,  stage: 'nco' },
  { name: '一级军士长', need: 2700,  stage: 'nco' },
  { name: '少尉',       need: 3400,  stage: 'officer' },
  { name: '中尉',       need: 4600,  stage: 'officer' },
  { name: '上尉',       need: 6200,  stage: 'officer' },
  { name: '少校',       need: 8200,  stage: 'field' },
  { name: '中校',       need: 11000, stage: 'field' },
  { name: '上校',       need: 14500, stage: 'field' },
  { name: '大校',       need: 19000, stage: 'field' },
  { name: '少将',       need: 25000, stage: 'general' },
  { name: '中将',       need: 38000, stage: 'general' },
  { name: '上将',       need: 130000, stage: 'marshal' },
  { name: '大元帅',     need: 165000, stage: 'marshal' }
];

/* 高阶军衔的复合条件：功勋之外，还须威望、纪律与传承同时达标
   （对应"越级晋升须重大立功"，让最高军衔成为真正的成就而非数值累加） */
const RANK_GATES = {
  16: { prestige: 48, disc: 62 },                       // 少将
  17: { prestige: 62, disc: 70 },                       // 中将
  18: { prestige: 66, disc: 76, heir: 2 },              // 上将
  19: { prestige: 62, disc: 85, heir: 3, deeds: 2 }     // 大元帅
};

/* ---------- 三条成长路线 ----------
   第 11 年（进入尉官期）必须做出抉择，此后主干锁定。
   每条路线有自己的专属行动、技能折扣、任务加成与晋升指标要求。 */
const ROUTE_STAGE = 'officer';      // 在此阶段开始选择路线
const ROUTE_SWITCH_COST = { merit: 3000, prestige: 12 };

const ROUTES = {
  command: {
    key:'command', name:'军事指挥线', short:'指挥',
    desc:'带兵打仗、演训组织、战役指挥',
    motto:'枪杆子握在手里，就得能打仗、打胜仗。',
    branch:'command',
    stat:'military', statName:'军事素养',
    extraKey:'tongshuai', extraName:'统率',
    gateNeeds:[72, 86, 96], extraNeeds:[68, 80, 90],
    color:'#8a4a2a'
  },
  political: {
    key:'political', name:'政治工作线', short:'政工',
    desc:'思想教育、谈心谈话、双主官协作',
    motto:'把人的工作做通了，部队才有魂。',
    branch:'political',
    stat:'political', statName:'政治素养',
    extraKey:'meili', extraName:'魅力',
    gateNeeds:[72, 86, 96], extraNeeds:[68, 80, 90],
    color:'#8a2a4a'
  },
  staff: {
    key:'staff', name:'参谋后装线', short:'参谋',
    desc:'战局推演、保障规划、装备建设',
    motto:'算得清、保得上，仗才打得久。',
    branch:'support',
    stat:'professional', statName:'专业能力',
    extraKey:'discipline', extraName:'作风纪律',
    gateNeeds:[78, 90, 100], extraNeeds:[64, 72, 76],
    color:'#2a4a8a'
  }
};

/* 路线专属行动：本路线的强化版行动，只有选定该路线后才能使用。
   三条线的功勋收益刻意拉平（差别体现在属性方向与附带效果上），
   否则会出现"某条路线天然更强"的失衡。 */
const ROUTE_ACTIONS = [
  /* 军事指挥线 —— 军事素养与统率 */
  { id:'r_cmd_train',  name:'实战化训练', ap:2, min:2, cat:'军事', route:'command',
    desc:'军事素养 +4 · 统率 +2 · 功勋 +260', fx:{ dv:{ military:4 }, attr:{ tongshuai:2 }, merit:260 } },
  { id:'r_cmd_command',name:'战役指挥研练', ap:3, min:3, cat:'军事', route:'command',
    desc:'军事素养 +6 · 统率 +3 · 功勋 +480', fx:{ dv:{ military:6 }, attr:{ tongshuai:3 }, merit:480 } },
  { id:'r_cmd_post',   name:'主官岗位历练', ap:3, min:4, cat:'管理', route:'command',
    desc:'统率 +4 · 威望 +5 · 功勋 +600', fx:{ attr:{ tongshuai:4 }, st:{ prestige:5 }, merit:600 } },
  { id:'r_cmd_war',    name:'联合作战筹划', ap:4, min:5, cat:'军事', route:'command',
    desc:'军事素养 +7 · 统率 +4 · 功勋 +1200', fx:{ dv:{ military:7 }, attr:{ tongshuai:4 }, merit:1200 } },

  /* 政治工作线 —— 政治素养与魅力 */
  { id:'r_pol_class',  name:'思想教育课', ap:2, min:2, cat:'政治', route:'political',
    desc:'政治素养 +4 · 魅力 +2 · 士气 +3 · 功勋 +260', fx:{ dv:{ political:4 }, attr:{ meili:2 }, st:{ morale:3 }, merit:260 } },
  { id:'r_pol_talk',   name:'谈心谈话室', ap:3, min:3, cat:'政治', route:'political',
    desc:'政治素养 +6 · 魅力 +3 · 搭档默契 +4 · 功勋 +480', fx:{ dv:{ political:6 }, attr:{ meili:3 }, st:{ bond:4 }, merit:480 } },
  { id:'r_pol_build',  name:'双主官共建', ap:3, min:4, cat:'管理', route:'political',
    desc:'政治素养 +5 · 魅力 +4 · 威望 +5 · 功勋 +600', fx:{ dv:{ political:5 }, attr:{ meili:4 }, st:{ prestige:5 }, merit:600 } },
  { id:'r_pol_mob',    name:'政治动员', ap:4, min:5, cat:'政治', route:'political',
    desc:'政治素养 +7 · 魅力 +4 · 士气 +4 · 功勋 +1200', fx:{ dv:{ political:7 }, attr:{ meili:4 }, st:{ morale:4 }, merit:1200 } },

  /* 参谋后装线 —— 专业能力与智谋（附带纪律，是三条线里最"稳"的）
     注意：三条线的功勋收益必须严格拉平，且不能附带技能点——
     技能点会转化为任务战力、进而抬高功勋收入，造成"某条线天然更强"。 */
  { id:'r_stf_wargame',name:'战局推演', ap:2, min:2, cat:'军事', route:'staff',
    desc:'专业能力 +4 · 智谋 +2 · 功勋 +260', fx:{ dv:{ professional:4 }, attr:{ zhimou:2 }, merit:260 } },
  { id:'r_stf_support',name:'保障规划', ap:3, min:3, cat:'管理', route:'staff',
    desc:'专业能力 +6 · 智谋 +3 · 纪律 +2 · 功勋 +480', fx:{ dv:{ professional:6, discipline:2 }, attr:{ zhimou:3 }, merit:480 } },
  { id:'r_stf_equip',  name:'装备建设论证', ap:3, min:4, cat:'管理', route:'staff',
    desc:'专业能力 +5 · 智谋 +4 · 威望 +4 · 功勋 +600', fx:{ dv:{ professional:5 }, attr:{ zhimou:4 }, st:{ prestige:4 }, merit:600 } },
  { id:'r_stf_strategy',name:'战略规划', ap:4, min:5, cat:'管理', route:'staff',
    desc:'专业能力 +7 · 智谋 +4 · 纪律 +3 · 功勋 +1200', fx:{ dv:{ professional:7, discipline:3 }, attr:{ zhimou:4 }, merit:1200 } }
];

/* ---------- 生涯阶段 ----------
   turns = 该阶段总回合数（已压缩节奏：全生涯 52 回合，单回合决策密度更高） */
const STAGE_ORDER = ['recruit', 'nco', 'officer', 'field', 'general', 'marshal', 'legacy'];

const STAGES = {
  recruit: { key:'recruit', name:'新兵期', from:1,  to:2,  turns:4,  ap:5,  turnLabel:'半年',
             desc:'入伍教育、队列条令、政治教育、基础体能', maxRank:1 },
  nco:     { key:'nco',     name:'军士期', from:3,  to:10, turns:8,  ap:6,  turnLabel:'一年',
             desc:'班排骨干、技能专精、带兵管理、士官学校进修', maxRank:8 },
  officer: { key:'officer', name:'尉官期', from:11, to:18, turns:8,  ap:6,  turnLabel:'一年',
             desc:'排连组织指挥、双主官协作、首次大项任务', maxRank:11 },
  field:   { key:'field',   name:'校官期', from:19, to:30, turns:12, ap:6, turnLabel:'一年',
             desc:'营团级组织指挥、参谋机关历练、院校深造', maxRank:15 },
  general: { key:'general', name:'将官期', from:31, to:38, turns:8,  ap:7, turnLabel:'一年',
             desc:'军级以上指挥、联合演训、战备建设', maxRank:17 },
  marshal: { key:'marshal', name:'上将期', from:39, to:45, turns:7,  ap:7, turnLabel:'一年',
             desc:'全局战略、强军改革、人才培养', maxRank:19 },
  legacy:  { key:'legacy',  name:'传承与终局', from:46, to:50, turns:5, ap:5, turnLabel:'一年',
             desc:'荣誉退休、功勋传承、子女接棒', maxRank:19 }
};

function stageForYear(y) {
  if (y <= 2)  return 'recruit';
  if (y <= 10) return 'nco';
  if (y <= 18) return 'officer';
  if (y <= 30) return 'field';
  if (y <= 38) return 'general';
  if (y <= 45) return 'marshal';
  return 'legacy';
}

function stageIndex(key) { return STAGE_ORDER.indexOf(key); }

/* ---------- 技能体系：4 分支 × 5 技能，等级 E→S ---------- */
const SKILL_LEVELS = ['—', 'E', 'D', 'C', 'B', 'A', 'S'];
const SKILL_COST   = [0, 1, 2, 3, 4, 6, 8];   // 升到该级所需技能点（累计 24 点满级）

const SKILL_BRANCHES = [
  { key:'combat', name:'作战专业技能', desc:'单兵层任务与比武', skills:[
    { key:'sheji',    name:'射击' },
    { key:'qixie',    name:'器械' },
    { key:'tongxin',  name:'通信' },
    { key:'jiashi',   name:'驾驶' },
    { key:'zhencha',  name:'侦察' }
  ]},
  { key:'command', name:'军事指挥技能', desc:'分队层与战役层', skills:[
    { key:'zhanshu',  name:'战术部署' },
    { key:'zuzhi',    name:'组织指挥' },
    { key:'canmou',   name:'参谋业务' },
    { key:'lianhe',   name:'联合协同' },
    { key:'daibing',  name:'带兵管理' }
  ]},
  { key:'political', name:'政治工作技能', desc:'政工岗位、双主官协作', skills:[
    { key:'sixiang',  name:'思想教育' },
    { key:'tanxin',   name:'谈心谈话' },
    { key:'xuanchuan',name:'宣传鼓动' },
    { key:'xinli',    name:'心理疏导' },
    { key:'zuzhijianshe', name:'组织建设' }
  ]},
  { key:'support', name:'管理与保障技能', desc:'机关与主官后的治理', skills:[
    { key:'houqin',   name:'后勤保障' },
    { key:'zhuangbei',name:'装备管理' },
    { key:'jundi',    name:'军地协调' },
    { key:'tiaoling', name:'条令法规' },
    { key:'dongyuan', name:'动员组织' }
  ]}
];

const ALL_SKILLS = {};
SKILL_BRANCHES.forEach(b => b.skills.forEach(s => { ALL_SKILLS[s.key] = s.name; }));

/* ---------- 性格特质 ---------- */
const TRAITS = [
  { key:'brave',      name:'勇敢', desc:'一线任务判定 +8，但负伤概率 +3%',
    fx:{ taskBonus:8, riskAdd:0.03 } },
  { key:'duty',       name:'担当', desc:'任务功勋 +15%',
    fx:{ meritMul:0.15 } },
  { key:'blood',      name:'血性', desc:'作战类任务 +10，但纪律增长 −20%',
    fx:{ combatBonus:10, discMul:-0.2 } },
  { key:'steady',     name:'坚毅', desc:'士气下限 +10，抗压能力强',
    fx:{ moraleFloor:10 } },
  { key:'humble',     name:'谦逊', desc:'首长信任增长 +30%，威望增长 −15%',
    fx:{ trustMul:0.3, prestigeMul:-0.15 } },
  { key:'bold',       name:'豪爽', desc:'搭档默契与士气增长 +25%',
    fx:{ bondMul:0.25 } },
  { key:'impulsive',  name:'冲动', desc:'高风险选项收益 +20%，违纪概率上升',
    fx:{ riskyGain:0.2, riskAdd:0.02 } },
  { key:'stubborn',   name:'固执', desc:'初始信念 +5，但政治工作效果 −30%',
    fx:{ politicalMul:-0.3 } },
  { key:'competitive',name:'好胜', desc:'比武竞赛类任务 +12',
    fx:{ contestBonus:12 } }
];
const TRAIT_MAP = {};
TRAITS.forEach(t => { TRAIT_MAP[t.key] = t; });

/* ---------- 行动项（min = 最低阶段序号） ---------- */
const ACTIONS = [
  /* 通用 */
  { id:'fitness',  name:'体能训练', ap:1, min:0, cat:'训练', desc:'体魄 +2 · 健康 −1',
    fx:{ attr:{tibo:2}, st:{health:-1} } },
  { id:'study',    name:'理论学习', ap:1, min:0, cat:'训练', desc:'智谋 +2',
    fx:{ attr:{zhimou:2} } },
  { id:'poledu',   name:'政治教育', ap:1, min:0, cat:'政治', desc:'信念 +2 · 政治素养 +2 · 纪律 +1',
    fx:{ attr:{xinnian:2}, dv:{political:2, discipline:1} } },
  { id:'drill',    name:'条令与队列', ap:1, min:0, cat:'训练', desc:'意志 +1 · 纪律 +2',
    fx:{ attr:{yizhi:1}, dv:{discipline:2} } },
  { id:'rest',     name:'休息疗养', ap:1, min:0, cat:'生活', desc:'健康 +6 · 士气 +2',
    fx:{ st:{health:6, morale:2} } },
  { id:'family',   name:'陪伴家人', ap:1, min:0, cat:'生活', desc:'家庭 +3 · 士气 +2',
    fx:{ st:{family:3, morale:2} } },
  { id:'network',  name:'联络首长', ap:1, min:0, cat:'社交', desc:'首长信任 +2 · 威望 +1',
    fx:{ st:{trust:2, prestige:1} } },
  { id:'peer',     name:'同侪交流', ap:1, min:0, cat:'社交', desc:'士气 +1 · 专业能力 +1 · 搭档默契 +1',
    fx:{ st:{morale:1, bond:1}, dv:{professional:1} } },

  /* 新兵期 */
  { id:'shoot',    name:'实弹射击', ap:2, min:0, cat:'军事', desc:'军事素养 +3 · 技能点 +1',
    fx:{ dv:{military:3}, sp:1 } },
  { id:'apparatus',name:'器械训练', ap:1, min:0, cat:'军事', desc:'体魄 +1 · 技能点 +1',
    fx:{ attr:{tibo:1}, sp:1 } },

  /* 军士期 */
  { id:'lead',     name:'带兵管理', ap:2, min:1, cat:'管理', desc:'统率 +2 · 功勋 +60',
    fx:{ attr:{tongshuai:2}, merit:60, dv:{military:1} } },
  { id:'specialize',name:'技能专精', ap:2, min:1, cat:'训练', desc:'技能点 +4 · 专业能力 +2',
    fx:{ sp:4, dv:{professional:2} } },
  { id:'ncoSchool',name:'士官学校进修', ap:3, min:1, cat:'院校', desc:'技能点 +6 · 智谋 +3 · 功勋 +120',
    fx:{ sp:6, attr:{zhimou:3}, merit:120 } },

  /* 尉官期 */
  { id:'command',  name:'组织指挥', ap:2, min:2, cat:'军事', desc:'统率 +2 · 军事素养 +3 · 技能点 +1',
    fx:{ attr:{tongshuai:2}, dv:{military:3}, sp:1 } },
  { id:'talk',     name:'谈心谈话', ap:1, min:2, cat:'政治', desc:'魅力 +2 · 政治素养 +2 · 士气 +2',
    fx:{ attr:{meili:2}, dv:{political:2}, st:{morale:2} } },
  { id:'partner',  name:'双主官协作', ap:1, min:2, cat:'管理', desc:'搭档默契 +3 · 威望 +1',
    fx:{ st:{bond:3, prestige:1} } },
  { id:'build',    name:'排连建设', ap:2, min:2, cat:'管理', desc:'威望 +2 · 统率 +1 · 功勋 +120',
    fx:{ st:{prestige:2}, attr:{tongshuai:1}, merit:120 } },

  /* 校官期 */
  { id:'staff',    name:'参谋业务', ap:2, min:3, cat:'军事', desc:'智谋 +2 · 专业能力 +3 · 技能点 +1',
    fx:{ attr:{zhimou:2}, dv:{professional:3}, sp:1 } },
  { id:'unitBuild',name:'部队建设', ap:2, min:3, cat:'管理', desc:'威望 +3 · 功勋 +250 · 纪律 +1',
    fx:{ st:{prestige:3}, merit:250, dv:{discipline:1} } },
  { id:'academy',  name:'院校深造', ap:3, min:3, cat:'院校', desc:'技能点 +6 · 智谋 +4 · 功勋 +200 · 健康 −2',
    fx:{ sp:6, attr:{zhimou:4}, merit:200, st:{health:-2} } },

  /* 将官期 */
  { id:'campaign', name:'战役筹划', ap:3, min:4, cat:'军事', desc:'军事素养 +5 · 统率 +2 · 功勋 +400',
    fx:{ dv:{military:5}, attr:{tongshuai:2}, merit:400 } },
  { id:'joint',    name:'联合演训', ap:3, min:4, cat:'军事', desc:'军事素养 +4 · 专业能力 +3 · 功勋 +450',
    fx:{ dv:{military:4, professional:3}, merit:450 } },
  { id:'readiness',name:'战备建设', ap:2, min:4, cat:'管理', desc:'威望 +3 · 纪律 +2 · 功勋 +300',
    fx:{ st:{prestige:3}, dv:{discipline:2}, merit:300 } },

  /* 上将期 */
  { id:'serviceBuild', name:'军种建设', ap:3, min:5, cat:'管理', desc:'威望 +4 · 功勋 +700 · 专业能力 +4',
    fx:{ st:{prestige:4}, merit:700, dv:{professional:4} } },
  { id:'mentor',   name:'人才培养', ap:2, min:5, cat:'管理', desc:'培养接班人 +1 · 威望 +2 · 政治素养 +3',
    fx:{ heir:1, st:{prestige:2}, dv:{political:3} } },
  { id:'reform',   name:'推动改革', ap:3, min:5, cat:'管理', desc:'功勋 +800 · 威望 +3 · 可能引发争议',
    fx:{ merit:800, st:{prestige:3}, flag:'reform' } },
  { id:'grandBid', name:'问鼎元帅', ap:4, min:5, reqRank:18, cat:'管理',
    desc:'向最高荣誉发起冲击 · 消耗极大，且会被议论',
    fx:{ merit:4500, st:{ prestige:6, health:-3, morale:-2 } } },
  { id:'qjBlueprint', name:'筹划强军方略', ap:3, min:5, reqRank:18, cat:'管理',
    desc:'牵头拟制长远建设规划 · 功勋 +2200 · 专业能力 +4 · 可能触动格局',
    fx:{ merit:2200, dv:{ professional:4 }, st:{ prestige:4 }, flag:'reform' } },

  /* ---------- 内容扩展：补齐中后期日常与专业线 ---------- */
  { id:'nightTrain', name:'夜间训练', ap:2, min:0, cat:'训练',
    desc:'军事素养 +3 · 意志 +2 · 健康 −2',
    fx:{ dv:{military:3}, attr:{yizhi:2}, st:{health:-2} } },
  { id:'partyAct', name:'党团活动', ap:1, min:0, cat:'政治',
    desc:'政治素养 +2 · 信念 +2',
    fx:{ dv:{political:2}, attr:{xinnian:2} } },
  { id:'writeHome', name:'写家书', ap:1, min:0, cat:'生活',
    desc:'家庭 +4 · 信念 +1',
    fx:{ st:{family:4}, attr:{xinnian:1} } },
  { id:'rehab', name:'体能康复', ap:1, min:1, cat:'生活',
    desc:'健康 +5 · 体魄 +1 · 士气 +1',
    fx:{ st:{health:5, morale:1}, attr:{tibo:1} } },
  { id:'teachClass', name:'带新兵教学', ap:2, min:2, cat:'管理',
    desc:'统率 +2 · 政治素养 +2 · 威望 +2 · 功勋 +100',
    fx:{ attr:{tongshuai:2}, dv:{political:2}, st:{prestige:2}, merit:100 } },
  { id:'equipCheck', name:'装备普查', ap:2, min:2, cat:'管理',
    desc:'专业能力 +4 · 纪律 +2 · 功勋 +150',
    fx:{ dv:{professional:4, discipline:2}, merit:150 } },
  { id:'civilCoord', name:'军地协调', ap:2, min:3, cat:'社交',
    desc:'魅力 +3 · 威望 +3 · 军地关系融洽',
    fx:{ attr:{meili:3}, st:{prestige:3}, dv:{professional:2} } },
  { id:'infoDrill', name:'信息化演练', ap:2, min:3, cat:'军事',
    desc:'智谋 +3 · 专业能力 +3 · 技能点 +1',
    fx:{ attr:{zhimou:3}, dv:{professional:3}, sp:1 } },
  { id:'thinkTank', name:'智囊咨询', ap:3, min:4, cat:'军事',
    desc:'智谋 +4 · 专业能力 +3 · 功勋 +550 · 首长信任 +3',
    fx:{ attr:{zhimou:4}, dv:{professional:3}, merit:550, st:{trust:3} } },
  { id:'milCivil', name:'军民融合项目', ap:3, min:4, cat:'管理',
    desc:'威望 +4 · 魅力 +3 · 功勋 +650',
    fx:{ st:{prestige:4}, attr:{meili:3}, merit:650 } },
  { id:'writeDoctrine', name:'条令编修', ap:3, min:5, cat:'院校',
    desc:'专业能力 +5 · 威望 +5 · 功勋 +900 · 可能引发讨论',
    fx:{ dv:{professional:5}, st:{prestige:5}, merit:900, flag:'reform' } },
  { id:'majorScene', name:'重大任务值守', ap:3, min:4, cat:'军事',
    desc:'威望 +5 · 纪律 +3 · 功勋 +1000 · 健康 −3',
    fx:{ st:{prestige:5, health:-3}, dv:{discipline:3}, merit:1000 } },
  { id:'writeMemoir', name:'整理回忆录', ap:2, min:5, cat:'生活',
    desc:'信念 +4 · 威望 +3 · 家庭 +2',
    fx:{ attr:{xinnian:4}, st:{prestige:3, family:2} } },
  { id:'honorDetail', name:'荣誉仪式任务', ap:2, min:4, cat:'政治',
    desc:'信念 +5 · 威望 +4 · 政治素养 +3',
    fx:{ attr:{xinnian:5}, st:{prestige:4}, dv:{political:3} } }
];

/* 重大功勋：大元帅的必要条件之一 */
const GREAT_DEED_FLAGS = ['reform', 'peace', 'rescue', 'saved_village', 'tough_area'];

/* ---------- 任务模板 ----------
   每个任务是一场可操作的小型推演，分三步：
   ① 战前部署：把有限的「部署点」分配到三条战线。三者作用不同——
      主攻决定评价高低 / 保障降低伤亡风险 / 预备队解锁突发情况的选项。
      部署点总数小于三条战线的需求总和，因此必须有所取舍。
   ② 临机决断：任务途中的突发情况，选项各有收益与风险，部分需要预备队支撑。
   ③ 结算：根据战线完成度、战力、决断修正共同判定评价。 */
const TASKS = [
  {
    id:'tk_shoot', name:'实弹射击考核', layer:'单兵层', min:0, max:1, weight:13,
    merit:260, risk:0.05, attrs:['tibo','zhimou'], skill:'sheji', kind:'combat',
    text:'靶场上风很大，弹药有限，成绩会直接写进你的档案。',
    brief:'新兵连第一次实弹考核。每人十发子弹，分三组射击，成绩当场公布。',
    deploy:3,
    fronts:[
      { key:'main',    name:'据枪与击发', demand:2, kind:'score',  hint:'投入越多，成绩越好' },
      { key:'support', name:'呼吸与节奏', demand:1, kind:'risk',   hint:'投入越多，脱靶与失误越少' },
      { key:'reserve', name:'备用弹药与心态', demand:1, kind:'option', hint:'投入越多，突发情况时可选方案越多' }
    ],
    decisions:[
      { text:'第三组射击时，风向突然转为横风，弹着点明显偏移。',
        options:[
          { label:'立即修正风偏，重新找瞄点', hint:'评价 +10%', score:0.10 },
          { label:'保持原瞄准点，相信手感',   hint:'评价 +3%，风险 +6%', score:0.03, risk:0.06 },
          { label:'申请暂停，重新校枪',       hint:'需要 1 点预备队 · 评价 +6%，无风险', need:1, score:0.06 },
          { label:'举手请示裁判',             hint:'评价 −10%，作风纪律 +3', score:-0.10, disc:3 }
        ] }
    ]
  },
  {
    id:'tk_physical', name:'体能比武', layer:'单兵层', min:0, max:2, weight:11,
    merit:300, risk:0.06, attrs:['tibo','yizhi'], skill:'qixie', kind:'contest',
    text:'五公里武装越野，全连的目光都在你身上。',
    brief:'全连武装越野比武，取前三名记入季度考核。你今天状态一般。',
    deploy:3,
    fronts:[
      { key:'main',    name:'前程配速', demand:2, kind:'score',  hint:'投入越多，总成绩越好' },
      { key:'support', name:'补给与节奏', demand:1, kind:'risk', hint:'投入越多，抽筋与掉速越少' },
      { key:'reserve', name:'最后冲刺', demand:1, kind:'option', hint:'投入越多，关键时刻越有底' }
    ],
    decisions:[
      { text:'跑到第八公里，你的小腿开始抽筋。',
        options:[
          { label:'咬牙坚持，不减速',       hint:'评价 +12%，风险 +12%', score:0.12, risk:0.12 },
          { label:'放慢节奏调整呼吸',       hint:'评价 −4%，安全', score:-0.04 },
          { label:'用备用补给处理一下',     hint:'需要 1 点预备队 · 评价 +6%', need:1, score:0.06 }
        ] }
    ]
  },
  {
    id:'tk_contest', name:'军事大比武', layer:'单兵层', min:1, max:3, weight:11,
    merit:760, risk:0.07, attrs:['tibo','zhimou','yizhi'], skill:'sheji', kind:'contest',
    text:'全师尖子同场竞技，名次就是资历。',
    brief:'师里组织军事大比武，你报了主项和副项，赛程排得很紧。',
    deploy:3,
    fronts:[
      { key:'main',    name:'主项冲刺', demand:2, kind:'score',  hint:'投入越多，主项名次越好' },
      { key:'support', name:'体能分配', demand:1, kind:'risk',   hint:'投入越多，后程崩盘越少' },
      { key:'reserve', name:'临场应变', demand:1, kind:'option', hint:'投入越多，遇到意外越从容' }
    ],
    decisions:[
      { text:'主项和副项的检录时间撞了，你只能全力准备一个。',
        options:[
          { label:'全力拼主项',           hint:'评价 +14%，风险 +5%', score:0.14, risk:0.05 },
          { label:'保副项争名次',         hint:'评价 +5%，威望 +2', score:0.05, fx:{ st:{prestige:2} } },
          { label:'找裁判协调调序',       hint:'需要 1 点预备队 · 评价 +8%', need:1, score:0.08 }
        ] }
    ]
  },
  {
    id:'tk_drill', name:'连排战术演练', layer:'分队层', min:2, max:4, weight:13,
    merit:900, risk:0.08, attrs:['tongshuai','zhimou'], skill:'zhanshu', kind:'normal',
    text:'上级临机导调，你需要在十分钟内完成兵力调整。',
    brief:'合成营战术演练，你带一个连担任主攻，导调组会随机出情况。',
    deploy:4,
    fronts:[
      { key:'main',    name:'主攻方向', demand:3, kind:'score',  hint:'投入越多，战果越大' },
      { key:'support', name:'火力与通信', demand:1, kind:'risk', hint:'投入越多，协同失误越少' },
      { key:'reserve', name:'预备队',   demand:1, kind:'option', hint:'投入越多，突发情况应对越从容' }
    ],
    decisions:[
      { text:'推进到一半，导调组通报：你部左翼出现敌军装甲分队。',
        options:[
          { label:'抽调主攻兵力回防',   hint:'评价 −6%，风险 −5%', score:-0.06, risk:-0.05 },
          { label:'不管它，继续推进',   hint:'评价 +12%，风险 +10%', score:0.12, risk:0.10 },
          { label:'派预备队拦截',       hint:'需要 1 点预备队 · 评价 +5%，无风险', need:1, score:0.05 }
        ] }
    ]
  },
  {
    id:'tk_border', name:'边境执勤', layer:'分队层', min:1, max:4, weight:9,
    merit:600, risk:0.10, attrs:['yizhi','tibo'], skill:'zhencha', kind:'normal',
    text:'零下二十度的哨位上，风雪没过了膝盖。',
    brief:'你带队执行边境巡逻任务，负责一段十余公里的边防线。',
    deploy:3,
    fronts:[
      { key:'main',    name:'重点哨位', demand:2, kind:'score',  hint:'投入越多，管控越严密' },
      { key:'support', name:'巡逻路线', demand:1, kind:'risk',   hint:'投入越多，遭遇意外越少' },
      { key:'reserve', name:'应急组',   demand:1, kind:'option', hint:'投入越多，处置突发越有力' }
    ],
    decisions:[
      { text:'凌晨两点，观察哨报告：有可疑人员越线，正朝我方一侧移动。',
        options:[
          { label:'立即前出拦截',       hint:'评价 +12%，风险 +12%', score:0.12, risk:0.12 },
          { label:'上报并持续监视',     hint:'评价 +4%，作风纪律 +3', score:0.04, disc:3 },
          { label:'派应急组处置',       hint:'需要 1 点预备队 · 评价 +8%', need:1, score:0.08 }
        ] }
    ]
  },
  {
    id:'tk_flood', name:'抗洪抢险', layer:'分队层', min:1, max:5, weight:8,
    merit:1000, risk:0.14, attrs:['tibo','yizhi','tongshuai'], skill:'zuzhi', kind:'rescue', flag:'rescue',
    text:'洪水漫过堤坝，堤后是三万群众。',
    brief:'连续暴雨，水位超警戒线两米多。你部奉命连夜驰援，负责最险的一段。',
    deploy:4,
    fronts:[
      { key:'main',    name:'封堵主堤', demand:3, kind:'score',  hint:'投入越多，堤坝越稳' },
      { key:'support', name:'物资与后送', demand:1, kind:'risk', hint:'投入越多，伤亡越少' },
      { key:'reserve', name:'预备队',   demand:1, kind:'option', hint:'投入越多，险情处置越快' }
    ],
    decisions:[
      { text:'凌晨三点，巡堤员报告：K7 段出现管涌，涌出的水浑浊发黑。',
        options:[
          { label:'调集主力立即封堵',   hint:'评价 +12%，风险 +6%', score:0.12, risk:0.06 },
          { label:'派预备队处置',       hint:'需要 1 点预备队 · 评价 +6%', need:1, score:0.06 },
          { label:'先观察，继续推进',   hint:'评价 +5%，风险 +12%', score:0.05, risk:0.12 },
          { label:'上报指挥部等指示',   hint:'评价 −8%，作风纪律 +4', score:-0.08, disc:4 }
        ] }
    ]
  },
  {
    id:'tk_anti', name:'反恐维稳', layer:'分队层', min:2, max:5, weight:8,
    merit:1150, risk:0.15, attrs:['yizhi','tongshuai'], skill:'zhencha', kind:'combat',
    text:'情报有限，窗口期只有几分钟。',
    brief:'接到通报，某处发生劫持事件。你带队先期处置，等特战力量到位。',
    deploy:4,
    fronts:[
      { key:'main',    name:'突击组', demand:3, kind:'score',  hint:'投入越多，处置越果断' },
      { key:'support', name:'封控与疏散', demand:1, kind:'risk', hint:'投入越多，伤及无辜越少' },
      { key:'reserve', name:'谈判与预备', demand:1, kind:'option', hint:'投入越多，可选方案越多' }
    ],
    decisions:[
      { text:'建筑内传出人质喊声，现场指挥判断窗口期只有几分钟。',
        options:[
          { label:'强行突入',           hint:'评价 +15%，风险 +18%', score:0.15, risk:0.18 },
          { label:'继续谈判，等特战',   hint:'评价 −5%，安全', score:-0.05 },
          { label:'派预备队从后门突入', hint:'需要 1 点预备队 · 评价 +10%', need:1, score:0.10 }
        ] }
    ]
  },
  {
    id:'tk_peace', name:'国际维和', layer:'分队层', min:3, max:6, weight:7,
    merit:1600, risk:0.13, attrs:['yizhi','meili','zhimou'], skill:'jundi', kind:'peace', flag:'peace',
    text:'蓝盔之下，你代表的是国家形象。',
    brief:'你率维和分队进驻任务区，负责一段难民营周边的安全警戒。',
    deploy:4,
    fronts:[
      { key:'main',    name:'武装巡逻', demand:3, kind:'score',  hint:'投入越多，震慑效果越好' },
      { key:'support', name:'群众工作', demand:1, kind:'risk',   hint:'投入越多，冲突与误解越少' },
      { key:'reserve', name:'快速反应', demand:1, kind:'option', hint:'投入越多，突发处置越有力' }
    ],
    decisions:[
      { text:'当地武装人员在检查站拦住了你的车队，要求开箱检查。',
        options:[
          { label:'强硬交涉，拒绝检查',   hint:'评价 +8%，风险 +14%', score:0.08, risk:0.14 },
          { label:'耐心沟通，等待放行',   hint:'评价 +2%，耗时长', score:0.02 },
          { label:'绕道而行',             hint:'需要 1 点预备队 · 评价 +5%', need:1, score:0.05 }
        ] }
    ]
  },
  {
    id:'tk_exercise', name:'联合演习', layer:'战役层', min:3, max:6, weight:13,
    merit:2400, risk:0.10, attrs:['tongshuai','zhimou'], skill:'lianhe', kind:'normal',
    text:'跨军种协同，保障线一旦被切断，全线都会出问题。',
    brief:'多军种联合演习，你负责一个方向的合成作战指挥。',
    deploy:4,
    fronts:[
      { key:'main',    name:'主攻方向', demand:3, kind:'score',  hint:'投入越多，战果越大' },
      { key:'support', name:'保障线',   demand:1, kind:'risk',   hint:'投入越多，断供风险越低' },
      { key:'reserve', name:'预备队',   demand:1, kind:'option', hint:'投入越多，应变越从容' }
    ],
    decisions:[
      { text:'导调组通报：你的保障线被蓝军切断，弹药油料只能支撑六小时。',
        options:[
          { label:'抽调主攻兵力护线',     hint:'评价 −10%，风险 −8%', score:-0.10, risk:-0.08 },
          { label:'启用备用保障方案',     hint:'需要 1 点预备队 · 评价 +6%', need:1, score:0.06 },
          { label:'硬撑，继续进攻',       hint:'评价 +14%，风险 +15%', score:0.14, risk:0.15 }
        ] }
    ]
  },
  {
    id:'tk_wargame', name:'战役兵棋推演', layer:'战役层', min:3, max:6, weight:12,
    merit:2200, risk:0.05, attrs:['zhimou','tongshuai'], skill:'canmou', kind:'normal',
    text:'沙盘之上，你只有一次出手机会。',
    brief:'战区组织战役兵棋推演，你担任红方指挥员，对手是公认的推演高手。',
    deploy:4,
    fronts:[
      { key:'main',    name:'情报判读', demand:3, kind:'score',  hint:'投入越多，判断越准' },
      { key:'support', name:'兵力部署', demand:1, kind:'risk',   hint:'投入越多，漏洞越少' },
      { key:'reserve', name:'后勤与预案', demand:1, kind:'option', hint:'投入越多，预案越充分' }
    ],
    decisions:[
      { text:'推演到第三阶段，对手突然放弃正面，主力向你纵深穿插。',
        options:[
          { label:'回师防守，稳住阵脚',   hint:'评价 +4%，安全', score:0.04 },
          { label:'将计就计，直取指挥部', hint:'评价 +16%，风险 +10%', score:0.16, risk:0.10 },
          { label:'启用预案',             hint:'需要 1 点预备队 · 评价 +9%', need:1, score:0.09 }
        ] }
    ]
  },
  {
    id:'tk_service', name:'军种建设调研', layer:'战略层', min:4, max:6, weight:13,
    merit:3900, risk:0.04, attrs:['zhimou','meili'], skill:'dongyuan', kind:'normal',
    text:'装备、训练、人才三条线，预算只够两条。',
    brief:'你牵头一项军种建设专项调研，要向军委汇报未来五年的投入方向。',
    deploy:4,
    fronts:[
      { key:'main',    name:'装备建设', demand:3, kind:'score',  hint:'投入越多，方案越有说服力' },
      { key:'support', name:'训练体系', demand:1, kind:'risk',   hint:'投入越多，方案越扎实' },
      { key:'reserve', name:'人才梯队', demand:1, kind:'option', hint:'投入越多，长远布局越完整' }
    ],
    decisions:[
      { text:'汇报前一天，上级明确表示预算只够两条线。',
        options:[
          { label:'装备优先，快速形成战力', hint:'评价 +6%，专业能力 +4', score:0.06, fx:{ dv:{professional:4} } },
          { label:'人才优先，着眼长远',     hint:'评价 +6%，培养接班人机会', score:0.06, fx:{ heir:1 } },
          { label:'训练优先，夯实基础',     hint:'评价 +6%，威望 +4', score:0.06, fx:{ st:{prestige:4} } }
        ] }
    ]
  },
  {
    id:'tk_reformtask', name:'训练改革试点', layer:'战略层', min:4, max:6, weight:12,
    merit:4300, risk:0.08, attrs:['zhimou','tongshuai','yizhi'], skill:'tiaoling', kind:'normal',
    flag:'reform',
    text:'改革必然触动既有的训练秩序。',
    brief:'你负责一项训练改革试点，方案已经报批，但阻力不小。',
    deploy:4,
    fronts:[
      { key:'main',    name:'试点范围', demand:3, kind:'score',  hint:'投入越多，成果越突出' },
      { key:'support', name:'配套保障', demand:1, kind:'risk',   hint:'投入越多，出问题的概率越低' },
      { key:'reserve', name:'思想工作', demand:1, kind:'option', hint:'投入越多，越能化解阻力' }
    ],
    decisions:[
      { text:'几位老同志联名反对方案，认为这是丢了传统。',
        options:[
          { label:'坚持推进，用结果说话', hint:'评价 +12%，风险 +10%', score:0.12, risk:0.10 },
          { label:'缩小试点范围',         hint:'评价 +4%，安全', score:0.04 },
          { label:'先做通思想工作',       hint:'需要 1 点预备队 · 评价 +8%，政治素养 +4', need:1, score:0.08, fx:{ dv:{political:4} } }
        ] }
    ]
  },
  /* ---------- 补充任务：补齐政治工作线与后期任务池 ----------
     此前所有任务的关键技能都落在作战/指挥/保障三个分支上，
     政治工作线拿不到任何任务加成；且第 5、6 阶段只剩保障分支的任务。
     以下 4 个任务用于补齐路线覆盖与阶段覆盖。 */
  {
    id:'tk_units', name:'部队全面建设考核', layer:'战役层', min:3, max:6, weight:10,
    merit:2900, risk:0.06, attrs:['tongshuai','meili'], skill:'daibing', kind:'normal',
    text:'上级要对你的部队做全面建设考核，从训练到作风，一样不落。',
    brief:'考核组进驻一周，涵盖训练、管理、作风、保障四个方面，全程不打招呼。',
    deploy:4,
    fronts:[
      { key:'main',    name:'训练成绩', demand:3, kind:'score',  hint:'投入越多，总体评价越高' },
      { key:'support', name:'作风纪律', demand:1, kind:'risk',   hint:'投入越多，出纰漏越少' },
      { key:'reserve', name:'官兵面貌', demand:1, kind:'option', hint:'投入越多，临场应对越从容' }
    ],
    decisions:[
      { text:'考核中，一名连长在战术课目上临场发挥失常。',
        options:[
          { label:'当场换人，保证成绩',   hint:'评价 +4%，士气 −', score:0.04, fx:{ st:{ morale:-4 } } },
          { label:'让他继续，相信他',     hint:'评价 +10%，风险 +12%', score:0.10, risk:0.12 },
          { label:'亲自下场带一遍',       hint:'需要 1 点预备队 · 评价 +8%', need:1, score:0.08 },
          { label:'如实向考核组说明',     hint:'评价 −5%，作风纪律 +5', score:-0.05, disc:5 }
        ] }
    ]
  },
  {
    id:'tk_masswork', name:'军民共建', layer:'分队层', min:2, max:5, weight:9,
    merit:2400, risk:0.06, attrs:['meili','yizhi'], skill:'xuanchuan', kind:'normal',
    text:'驻地村庄要修一条路，村里希望部队能搭把手。',
    brief:'上级要求开展军民共建，你负责协调一次为期两周的援建任务。',
    deploy:3,
    fronts:[
      { key:'main',    name:'援建力量', demand:2, kind:'score',  hint:'投入越多，工程推进越快' },
      { key:'support', name:'群众沟通', demand:1, kind:'risk',   hint:'投入越多，摩擦与误解越少' },
      { key:'reserve', name:'应急协调', demand:1, kind:'option', hint:'投入越多，遇到变故越有办法' }
    ],
    decisions:[
      { text:'施工中发现一段路基需要专业设备，地方一时调不来。',
        options:[
          { label:'协调地方紧急调配',     hint:'评价 +8%', score:0.08 },
          { label:'用部队装备顶上',       hint:'评价 +12%，风险 +8%', score:0.12, risk:0.08 },
          { label:'调整方案绕开',         hint:'评价 +2%', score:0.02 },
          { label:'向上级申请支援',       hint:'评价 +5%，作风纪律 +3', score:0.05, disc:3 }
        ] }
    ]
  },
  {
    id:'tk_psywar', name:'战前动员', layer:'分队层', min:2, max:5, weight:10,
    merit:2800, risk:0.05, attrs:['meili','zhimou'], skill:'xinli', kind:'normal',
    text:'任务前夜，几名战士情绪不稳。',
    brief:'明天就是实兵演习，你需要在出发前把队伍的状态调整到最好。',
    deploy:3,
    fronts:[
      { key:'main',    name:'动员鼓动', demand:2, kind:'score',  hint:'投入越多，整体状态越好' },
      { key:'support', name:'个别疏导', demand:1, kind:'risk',   hint:'投入越多，临阵出问题越少' },
      { key:'reserve', name:'骨干发动', demand:1, kind:'option', hint:'投入越多，可用的办法越多' }
    ],
    decisions:[
      { text:'一名老兵私下说，他觉得这次任务准备不足。',
        options:[
          { label:'公开回应他的疑虑',       hint:'评价 +10%，风险 +5%', score:0.10, risk:0.05 },
          { label:'单独谈心，让他打头阵',   hint:'评价 +8%', score:0.08 },
          { label:'让骨干去做工作',         hint:'需要 1 点预备队 · 评价 +6%', need:1, score:0.06 },
          { label:'向上级反映，申请调整',   hint:'评价 −4%，作风纪律 +4', score:-0.04, disc:4 }
        ] }
    ]
  },
  {
    id:'tk_polcheck', name:'基层政治工作检查', layer:'战役层', min:3, max:6, weight:9,
    merit:3600, risk:0.05, attrs:['meili','zhimou'], skill:'zuzhijianshe', kind:'normal',
    text:'上级要来检查基层政治工作，你负责的单位是重点。',
    brief:'检查组三天后到，材料、台账、阵地建设都要过一遍。',
    deploy:4,
    fronts:[
      { key:'main',    name:'台账与材料', demand:3, kind:'score',  hint:'投入越多，检查结果越好' },
      { key:'support', name:'阵地建设', demand:1, kind:'risk',   hint:'投入越多，被挑毛病越少' },
      { key:'reserve', name:'官兵访谈', demand:1, kind:'option', hint:'投入越多，应对问询越从容' }
    ],
    decisions:[
      { text:'检查中发现一个连队的教育记录有缺失。',
        options:[
          { label:'如实上报，承认问题',     hint:'评价 −5%，作风纪律 +5', score:-0.05, disc:5 },
          { label:'连夜补齐材料',           hint:'评价 +6%，风险 +10%', score:0.06, risk:0.10 },
          { label:'用实际成效说话',         hint:'需要 1 点预备队 · 评价 +10%', need:1, score:0.10 },
          { label:'先内部整改再上报',       hint:'评价 +3%，风险 +4%', score:0.03, risk:0.04 }
        ] }
    ]
  },

  /* ---------- 内容扩展任务 ---------- */
  {
    id:'tk_night', name:'夜间渗透演练', layer:'分队层', min:1, max:4, weight:10,
    merit:850, risk:0.12, attrs:['yizhi','tibo','zhimou'], skill:'zhencha', kind:'combat',
    text:'没有月光，电台保持静默，你只有一次接近目标的机会。',
    brief:'合成营夜间课目考核，你率分队执行纵深渗透，限时两小时。',
    deploy:3,
    fronts:[
      { key:'main',    name:'渗透路线', demand:2, kind:'score',  hint:'投入越多，越接近目标' },
      { key:'support', name:'通信与识别', demand:1, kind:'risk', hint:'投入越多，误伤与暴露越少' },
      { key:'reserve', name:'应急脱身', demand:1, kind:'option', hint:'投入越多，遇险时选择越多' }
    ],
    decisions:[
      { text:'接近目标区时，前方突然出现不明灯光，疑似蓝军潜伏哨。',
        options:[
          { label:'绕道隐蔽前进',           hint:'评价 +6%，耗时增加', score:0.06 },
          { label:'果断处置，继续任务',     hint:'评价 +14%，风险 +12%', score:0.14, risk:0.12 },
          { label:'使用预备组佯动',         hint:'需要 1 点预备队 · 评价 +9%', need:1, score:0.09 },
          { label:'上报并中止渗透',         hint:'评价 −8%，作风纪律 +4', score:-0.08, disc:4 }
        ] }
    ]
  },
  {
    id:'tk_quake', name:'抗震救灾', layer:'分队层', min:2, max:5, weight:8,
    merit:1400, risk:0.16, attrs:['tibo','yizhi','tongshuai'], skill:'zuzhi', kind:'rescue', flag:'rescue',
    text:'废墟下还有生命迹象，黄金七十二小时正在流逝。',
    brief:'驻地附近发生强震，你部奉命连夜开进，负责最危险的搜救片区。',
    deploy:4,
    fronts:[
      { key:'main',    name:'重点搜救', demand:3, kind:'score',  hint:'投入越多，救出的人越多' },
      { key:'support', name:'医疗后送', demand:1, kind:'risk',   hint:'投入越多，二次伤亡越少' },
      { key:'reserve', name:'重型机械', demand:1, kind:'option', hint:'投入越多，破拆手段越多' }
    ],
    decisions:[
      { text:'余震导致一栋危楼二次坍塌，有战士被埋，附近还有群众呼救。',
        options:[
          { label:'先救战士',               hint:'士气 +6，评价 +5%', score:0.05, fx:{ st:{ morale:6 } } },
          { label:'先救群众',               hint:'信念 +5，评价 +10%', score:0.10, fx:{ attr:{ xinnian:5 } }, flag:'saved_village' },
          { label:'分组同时搜救',           hint:'需要 1 点预备队 · 评价 +12%', need:1, score:0.12 },
          { label:'等专业力量到位',         hint:'评价 −6%，风险 −5%', score:-0.06, risk:-0.05 }
        ] }
    ]
  },
  {
    id:'tk_cyber', name:'网络攻防演练', layer:'战役层', min:3, max:6, weight:9,
    merit:2600, risk:0.08, attrs:['zhimou','yizhi'], skill:'canmou', kind:'normal', flag:'cyber',
    text:'屏幕上的每一次跳动，都可能改写战场态势。',
    brief:'战区组织网络空间防卫演练，你负责指挥所信息系统的攻防对抗。',
    deploy:4,
    fronts:[
      { key:'main',    name:'态势感知', demand:3, kind:'score',  hint:'投入越多，判断越准' },
      { key:'support', name:'系统加固', demand:1, kind:'risk',   hint:'投入越多，被瘫痪概率越低' },
      { key:'reserve', name:'应急切换', demand:1, kind:'option', hint:'投入越多，备用手段越多' }
    ],
    decisions:[
      { text:'蓝军对指挥网发起高强度干扰，主用链路出现丢包。',
        options:[
          { label:'切换备用链路继续',       hint:'评价 +8%', score:0.08 },
          { label:'反向追踪，实施反击',     hint:'评价 +16%，风险 +10%', score:0.16, risk:0.10 },
          { label:'启用预置应急预案',       hint:'需要 1 点预备队 · 评价 +10%', need:1, score:0.10 },
          { label:'上报并请求支援',         hint:'评价 −4%，作风纪律 +3', score:-0.04, disc:3 }
        ] }
    ]
  },
  {
    id:'tk_medical', name:'卫勤保障演习', layer:'分队层', min:2, max:5, weight:8,
    merit:1500, risk:0.09, attrs:['zhimou','meili'], skill:'houqin', kind:'normal',
    text:'伤员通道一旦堵住，前面打得再好也白搭。',
    brief:'实兵演习中你负责卫勤保障，要在复杂地形上建立伤员后送线。',
    deploy:4,
    fronts:[
      { key:'main',    name:'救护所开设', demand:3, kind:'score', hint:'投入越多，救治效率越高' },
      { key:'support', name:'后送通道', demand:1, kind:'risk',  hint:'投入越多，后送越顺畅' },
      { key:'reserve', name:'血浆与器材', demand:1, kind:'option', hint:'投入越多，抢救手段越足' }
    ],
    decisions:[
      { text:'同时送来三名重伤员，血浆只够抢救两人。',
        options:[
          { label:'按伤情轻重排序抢救',     hint:'评价 +10%', score:0.10 },
          { label:'全力抢救最危重的',       hint:'评价 +6%，风险 +6%', score:0.06, risk:0.06 },
          { label:'紧急调用预备血浆',       hint:'需要 1 点预备队 · 评价 +12%', need:1, score:0.12 },
          { label:'请上级协调地方血站',     hint:'评价 +5%', score:0.05 }
        ] }
    ]
  },
  {
    id:'tk_school', name:'院校教学比武', layer:'战役层', min:3, max:5, weight:8,
    merit:2800, risk:0.05, attrs:['zhimou','meili'], skill:'daibing', kind:'contest',
    text:'讲台也是战场，讲不好，学员就会在战场上吃亏。',
    brief:'你代表部队参加院校教学比武，课题是联合作战基础。',
    deploy:4,
    fronts:[
      { key:'main',    name:'课程设计', demand:3, kind:'score',  hint:'投入越多，课越扎实' },
      { key:'support', name:'案例与想定', demand:1, kind:'risk', hint:'投入越多，临场越稳' },
      { key:'reserve', name:'学员互动', demand:1, kind:'option', hint:'投入越多，应变越从容' }
    ],
    decisions:[
      { text:'有专家当场质疑你的战例引用是否准确。',
        options:[
          { label:'承认表述不严谨并修正',   hint:'作风纪律 +5，评价 +3%', score:0.03, disc:5 },
          { label:'用原始史料现场回应',     hint:'评价 +12%', score:0.12 },
          { label:'请助教调取资料',         hint:'需要 1 点预备队 · 评价 +8%', need:1, score:0.08 },
          { label:'坚持原观点',             hint:'评价 +6%，风险 +8%', score:0.06, risk:0.08 }
        ] }
    ]
  },
  {
    id:'tk_major', name:'重大活动安保', layer:'战役层', min:3, max:6, weight:9,
    merit:3200, risk:0.10, attrs:['tongshuai','yizhi'], skill:'zuzhi', kind:'normal',
    text:'容不得半点闪失，出了问题就是政治问题。',
    brief:'你负责一项重大活动的安全警戒与应急处置，全程不打招呼检查。',
    deploy:4,
    fronts:[
      { key:'main',    name:'核心区域', demand:3, kind:'score',  hint:'投入越多，核心越稳' },
      { key:'support', name:'外围封控', demand:1, kind:'risk',   hint:'投入越多，漏洞越少' },
      { key:'reserve', name:'应急分队', demand:1, kind:'option', hint:'投入越多，处置越快' }
    ],
    decisions:[
      { text:'开幕前一小时，外围发现可疑无人飞行器。',
        options:[
          { label:'立即干扰迫降',           hint:'评价 +10%', score:0.10 },
          { label:'跟踪观察，暂不处置',     hint:'评价 +4%，风险 +10%', score:0.04, risk:0.10 },
          { label:'派应急分队处置',         hint:'需要 1 点预备队 · 评价 +12%', need:1, score:0.12 },
          { label:'上报并启动预案降级',     hint:'评价 −3%，作风纪律 +5', score:-0.03, disc:5 }
        ] }
    ]
  },
  {
    id:'tk_recruit_train', name:'新兵入伍训练组织', layer:'分队层', min:1, max:3, weight:9,
    merit:700, risk:0.06, attrs:['tongshuai','meili'], skill:'daibing', kind:'normal',
    text:'一茬新兵刚下连，底子参差不齐，两个月后要接受考核。',
    brief:'你负责组织入伍训练，要让全连新兵尽快形成战斗力。',
    deploy:3,
    fronts:[
      { key:'main',    name:'课目落实', demand:2, kind:'score',  hint:'投入越多，考核成绩越好' },
      { key:'support', name:'思想稳定', demand:1, kind:'risk',   hint:'投入越多，逃兵与伤病越少' },
      { key:'reserve', name:'骨干帮带', demand:1, kind:'option', hint:'投入越多，后进转化越快' }
    ],
    decisions:[
      { text:'几名新兵想家情绪严重，夜里偷偷抹眼泪。',
        options:[
          { label:'组织谈心，骨干结对',     hint:'评价 +10%', score:0.10 },
          { label:'加大训练强度压过去',     hint:'评价 +8%，风险 +10%', score:0.08, risk:0.10 },
          { label:'请家属来队做工作',       hint:'需要 1 点预备队 · 评价 +12%', need:1, score:0.12 },
          { label:'如实上报，申请缓训',     hint:'评价 −5%', score:-0.05 }
        ] }
    ]
  },
  {
    id:'tk_equip_field', name:'装备野外抢修', layer:'分队层', min:2, max:5, weight:8,
    merit:1300, risk:0.09, attrs:['zhimou','tibo'], skill:'zhuangbei', kind:'normal',
    text:'演习途中多台装备趴窝，天黑前修不好，整个梯队都会堵在路上。',
    brief:'你带抢修分队跟进保障，要在时限内恢复装备完好率。',
    deploy:4,
    fronts:[
      { key:'main',    name:'主战装备', demand:3, kind:'score',  hint:'投入越多，主战装备恢复越快' },
      { key:'support', name:'器材与油料', demand:1, kind:'risk', hint:'投入越多，误判与返工越少' },
      { key:'reserve', name:'厂家技术支援', demand:1, kind:'option', hint:'投入越多，疑难故障越有办法' }
    ],
    decisions:[
      { text:'关键备件缺货，厂家说最快也要半夜才能送到。',
        options:[
          { label:'拆东墙补西墙，先保主攻', hint:'评价 +10%', score:0.10 },
          { label:'连夜自制替代件',         hint:'评价 +14%，风险 +8%', score:0.14, risk:0.08 },
          { label:'启用厂家远程支援',       hint:'需要 1 点预备队 · 评价 +9%', need:1, score:0.09 },
          { label:'上报并申请推迟开进',     hint:'评价 −6%', score:-0.06 }
        ] }
    ]
  }
];


/* ---------- 抉择事件 ---------- */
const EVENTS = [
  {
    id:'ev_emergency', title:'紧急集合', min:0, max:1, weight:14, once:true,
    text:'凌晨两点，哨声骤响。楼道里一片混乱，有人摸黑打背包，有人还在找鞋。',
    options:[
      { label:'第一个冲出宿舍', hint:'意志 +2 · 首长信任 +3 · 健康 −2',
        fx:{ attr:{yizhi:2}, st:{trust:3, health:-2} } },
      { label:'先叫醒身边两个新兵', hint:'士气 +3 · 搭档默契 +2',
        fx:{ st:{morale:3, bond:2}, attr:{meili:1} },
        hidden:{ chance:0.35, st:{trust:-2}, note:'你最后一个到，被点名批评' } },
      { label:'整理好装具再出发', hint:'纪律 +3 · 首长信任 −1',
        fx:{ dv:{discipline:3}, st:{trust:-1} } }
    ]
  },
  {
    id:'ev_comrade', title:'战友家里出事', min:0, max:3, weight:12, once:true,
    text:'同班战友收到家里电报，父亲重病住院。他一个人蹲在营房后墙根抽烟，谁劝都不说话。',
    options:[
      { label:'把自己攒的津贴借给他', hint:'士气 +4 · 搭档默契 +4 · 家庭 −1',
        fx:{ st:{morale:4, bond:4, family:-1} },
        flag:'helped_comrade' },
      { label:'报告指导员，走组织渠道', hint:'政治素养 +3 · 首长信任 +2',
        fx:{ dv:{political:3}, st:{trust:2} } },
      { label:'装作没看见', hint:'无变化，但有些东西会记下来',
        fx:{}, hidden:{ chance:1, st:{morale:-3}, note:'此后班里再没人跟你说心里话' } }
    ]
  },
  {
    id:'ev_shoot_nervous', title:'考核前夜', min:0, max:1, weight:11, once:true,
    text:'明天就是实弹考核。你在床上翻来覆去，手心全是汗。',
    options:[
      { label:'爬起来加练据枪', hint:'体魄 +2 · 军事素养 +3 · 健康 −2',
        fx:{ attr:{tibo:2}, dv:{military:3}, st:{health:-2} } },
      { label:'找班长聊了很久', hint:'士气 +3 · 首长信任 +2',
        fx:{ st:{morale:3, trust:2} } },
      { label:'强迫自己早睡', hint:'健康 +3 · 意志 +1',
        fx:{ st:{health:3}, attr:{yizhi:1} } }
    ]
  },
  {
    id:'ev_promote_chance', title:'比武名额', min:1, max:2, weight:12, once:true,
    text:'连里只有一个大比武名额，你和同年兵老周都够格。他家里负担重，很需要这次机会。',
    options:[
      { label:'凭实力争取，各凭本事', hint:'功勋 +250 · 同侪关系 −',
        fx:{ merit:250, st:{morale:1} }, flag:'beat_peer' },
      { label:'让给他，明年再来', hint:'搭档默契 +5 · 士气 +4 · 功勋 −80',
        fx:{ merit:-80, st:{bond:5, morale:4} }, flag:'gave_up' },
      { label:'提议加赛一场，输的人服气', hint:'军事素养 +4 · 威望 +3 · 功勋 +120',
        fx:{ dv:{military:4}, st:{prestige:3}, merit:120 } }
    ]
  },
  {
    id:'ev_tough_area', title:'艰苦地区申请', min:2, max:4, weight:11, once:true,
    text:'上级要抽调干部去高原边防代职两年。条件艰苦，但那里最缺人。',
    options:[
      { label:'主动报名', hint:'信念 +4 · 功勋 +600 · 健康 −8 · 家庭 −6',
        fx:{ attr:{xinnian:4}, merit:600, st:{health:-8, family:-6} }, flag:'tough_area' },
      { label:'服从组织安排', hint:'纪律 +3 · 首长信任 +3',
        fx:{ dv:{discipline:3}, st:{trust:3} } },
      { label:'以家庭困难为由申请留任', hint:'家庭 +4 · 首长信任 −4',
        fx:{ st:{family:4, trust:-4} } }
    ]
  },
  {
    id:'ev_secondment', title:'机关借调', min:2, max:3, weight:11, once:true,
    text:'军区机关想借调你去帮忙半年。去了能见世面，但连里的工作要交出去。',
    options:[
      { label:'去，机会难得', hint:'智谋 +4 · 专业能力 +5 · 威望 −2',
        fx:{ attr:{zhimou:4}, dv:{professional:5}, st:{prestige:-2} }, flag:'staff_exp' },
      { label:'留在一线，部队更需要我', hint:'统率 +3 · 威望 +3 · 功勋 +180',
        fx:{ attr:{tongshuai:3}, st:{prestige:3}, merit:180 } }
    ]
  },
  {
    id:'ev_study_slot', title:'进修名额之争', min:3, max:4, weight:12, once:true,
    text:'指挥院校的进修名额只有一个。你的同期老李各方面都不比你差，而且他明年就到龄了。',
    options:[
      { label:'争取，履历不能断', hint:'智谋 +5 · 技能点 +8 · 同侪关系 −',
        fx:{ attr:{zhimou:5}, sp:8 }, flag:'took_slot' },
      { label:'让给老李', hint:'搭档默契 +6 · 威望 +4 · 失去进修履历',
        fx:{ st:{bond:6, prestige:4} }, flag:'gave_slot' },
      { label:'向上级建议扩大名额', hint:'政治素养 +5 · 首长信任 +4',
        fx:{ dv:{political:5}, st:{trust:4} }, hidden:{ chance:0.5, note:'建议未被采纳，两人都没去成', st:{trust:-3} } }
    ]
  },
  {
    id:'ev_partner_clash', title:'搭档分歧', min:2, max:4, weight:12, once:true,
    text:'军事训练和政治教育的时间撞了。搭档坚持先上政治课，你认为训练不能停。',
    options:[
      { label:'坚持己见，训练优先', hint:'军事素养 +4 · 搭档默契 −5',
        fx:{ dv:{military:4}, st:{bond:-5} } },
      { label:'各退一步，调整计划', hint:'搭档默契 +5 · 政治素养 +3',
        fx:{ st:{bond:5}, dv:{political:3} } },
      { label:'请示上级裁定', hint:'纪律 +3 · 首长信任 +2 · 搭档默契 −2',
        fx:{ dv:{discipline:3}, st:{trust:2, bond:-2} } }
    ]
  },
  {
    id:'ev_subordinate', title:'部属犯错', min:2, max:4, weight:12, once:true,
    text:'你手下的排长在演习中擅自改变部署，结果打赢了，但违反了命令。上级要追责。',
    options:[
      { label:'替他承担责任', hint:'威望 +6 · 士气 +5 · 首长信任 −5',
        fx:{ st:{prestige:6, morale:5, trust:-5} }, flag:'took_blame' },
      { label:'如实上报，功过分明', hint:'纪律 +5 · 首长信任 +4 · 士气 −4',
        fx:{ dv:{discipline:5}, st:{trust:4, morale:-4} } },
      { label:'先内部批评，再为他请功', hint:'威望 +4 · 搭档默契 +3',
        fx:{ st:{prestige:4, bond:3}, dv:{political:2} } }
    ]
  },
  {
    id:'ev_flood_order', title:'堤坝上的命令', min:2, max:5, weight:10, once:true,
    text:'洪水还在涨。上级命令你部立即撤离，但堤后还有一个村子没转移完。',
    options:[
      { label:'服从命令，立即撤离', hint:'纪律 +6 · 首长信任 +5 · 信念 −4',
        fx:{ dv:{discipline:6}, st:{trust:5}, attr:{xinnian:-4} }, flag:'obeyed_retreat' },
      { label:'先救人，责任我来担', hint:'信念 +6 · 威望 +8 · 纪律 −5 · 负伤风险',
        fx:{ attr:{xinnian:6}, st:{prestige:8}, dv:{discipline:-5} }, flag:'saved_village', risky:true },
      { label:'分兵两路，主力撤离', hint:'统率 +4 · 军事素养 +4 · 部分损失',
        fx:{ attr:{tongshuai:4}, dv:{military:4}, st:{morale:-2} } }
    ]
  },
  {
    id:'ev_family_conflict', title:'两地分居', min:2, max:5, weight:11, once:true,
    text:'爱人带着孩子来看你，只待了三天就要走。孩子已经不太认识你了。',
    options:[
      { label:'申请家属随军', hint:'家庭 +8 · 首长信任 −3 · 威望 −2',
        fx:{ st:{family:8, trust:-3, prestige:-2} }, flag:'family_joined' },
      { label:'把精力全放在部队上', hint:'统率 +3 · 功勋 +200 · 家庭 −8',
        fx:{ attr:{tongshuai:3}, merit:200, st:{family:-8} } },
      { label:'调整节奏，每月固定回家', hint:'家庭 +5 · 士气 +3 · 功勋 −80',
        fx:{ st:{family:5, morale:3}, merit:-80 } }
    ]
  },
  {
    id:'ev_equipment', title:'装备故障', min:3, max:5, weight:11, once:true,
    text:'演习前夜，主战装备出现故障。上报就意味着退出演习，自己修则有风险。',
    options:[
      { label:'如实上报，申请退出', hint:'纪律 +5 · 首长信任 +3 · 功勋 −300',
        fx:{ dv:{discipline:5}, st:{trust:3}, merit:-300 } },
      { label:'连夜抢修，赌一把', hint:'专业能力 +6 · 功勋 +400 · 有失败风险',
        fx:{ dv:{professional:6}, merit:400 },
        hidden:{ chance:0.3, note:'抢修失败，演习中装备再次趴窝', merit:-500, st:{trust:-6} } },
      { label:'启用备份方案', hint:'智谋 +4 · 参谋业务经验 · 功勋 +150',
        fx:{ attr:{zhimou:4}, merit:150 } }
    ]
  },
  {
    id:'ev_merit_dispute', title:'立功名额', min:3, max:5, weight:11, once:true,
    text:'这次任务立了集体功，但个人记功名额只有一个。你的副手做了最多的工作。',
    options:[
      { label:'把名额让给副手', hint:'威望 +8 · 士气 +6 · 功勋 −400',
        fx:{ st:{prestige:8, morale:6}, merit:-400 }, flag:'gave_merit' },
      { label:'按实绩上报自己', hint:'功勋 +900 · 士气 −3',
        fx:{ merit:900, st:{morale:-3} } },
      { label:'向上级争取两个名额', hint:'政治素养 +5 · 首长信任 +3',
        fx:{ dv:{political:5}, st:{trust:3} },
        hidden:{ chance:0.45, note:'上级驳回了你的请求', st:{trust:-2} } }
    ]
  },
  {
    id:'ev_reform_clash', title:'改革的分歧', min:4, max:6, weight:12, once:true,
    text:'你主推的训练改革方案，遭到几位老同志的强烈反对。他们认为这是丢了传统。',
    options:[
      { label:'坚持推进，用结果说话', hint:'功勋 +800 · 威望 −4 · 专业能力 +6',
        fx:{ merit:800, st:{prestige:-4}, dv:{professional:6} }, flag:'reform' },
      { label:'小范围试点，逐步推开', hint:'专业能力 +4 · 首长信任 +4 · 功勋 +400',
        fx:{ dv:{professional:4}, st:{trust:4}, merit:400 } },
      { label:'暂时搁置，维持现状', hint:'纪律 +3 · 士气 +2 · 功勋 −200',
        fx:{ dv:{discipline:3}, st:{morale:2}, merit:-200 } }
    ]
  },
  {
    id:'ev_old_chief', title:'老首长退休', min:3, max:5, weight:10, once:true,
    text:'一手把你带起来的老首长要退休了。临走前他问你，以后打算怎么走。',
    options:[
      { label:'请他指点未来的路', hint:'智谋 +4 · 首长信任 +6',
        fx:{ attr:{zhimou:4}, st:{trust:6} } },
      { label:'请他为你的下一步说话', hint:'首长信任 +8 · 威望 −3',
        fx:{ st:{trust:8, prestige:-3} }, flag:'asked_favor' },
      { label:'只谈感情，不提要求', hint:'信念 +4 · 威望 +4',
        fx:{ attr:{xinnian:4}, st:{prestige:4} } }
    ]
  },
  {
    id:'ev_heir', title:'子女的选择', min:5, max:6, weight:14, once:true,
    text:'孩子高考填志愿，报了军校。你盯着那张志愿表看了很久。',
    options:[
      { label:'支持他，把路指给他', hint:'传承标记 +1 · 家庭 +6 · 信念 +3',
        fx:{ st:{family:6}, attr:{xinnian:3} }, flag:'heir' },
      { label:'劝他选一条更轻松的路', hint:'家庭 +3 · 信念 −3',
        fx:{ st:{family:3}, attr:{xinnian:-3} } },
      { label:'让他自己决定', hint:'家庭 +4 · 威望 +2',
        fx:{ st:{family:4, prestige:2} } }
    ]
  },
  {
    id:'ev_retire_offer', title:'最后的选择', min:5, max:6, weight:12, once:true,
    text:'上级征求你的意见：是继续留任，还是提前退下来，把位置让给年轻人。',
    options:[
      { label:'继续留任，再干几年', hint:'功勋 +600 · 健康 −5',
        fx:{ merit:600, st:{health:-5} } },
      { label:'退下来，专心培养接班人', hint:'威望 +5 · 传承标记 +1',
        fx:{ st:{prestige:5}, heir:1 } },
      { label:'退下来，回归家庭', hint:'家庭 +10 · 士气 +5 · 功勋 −200',
        fx:{ st:{family:10, morale:5}, merit:-200 } }
    ]
  },
  {
    id:'ev_veteran_care', title:'老兵的心事', min:1, max:4, weight:11, once:true,
    text:'班里有个老兵，服役十几年了，最近总是心不在焉。听说他家里孩子上学遇到了难处。',
    options:[
      { label:'帮他跑一趟地方部门', hint:'军地协调经验 · 士气 +5 · 威望 +3',
        fx:{ dv:{professional:3}, st:{morale:5, prestige:3} } },
      { label:'找组织反映，走正规渠道', hint:'政治素养 +4 · 纪律 +2',
        fx:{ dv:{political:4, discipline:2} } },
      { label:'先谈一次心，了解实情', hint:'魅力 +3 · 搭档默契 +3',
        fx:{ attr:{meili:3}, st:{bond:3} } }
    ]
  },
  {
    id:'ev_integrity', title:'一份礼物', min:2, max:5, weight:10, once:true,
    text:'一位受过你帮助的地方企业家送来一份厚礼，说是"一点心意"。',
    options:[
      { label:'当场退回，并说明纪律', hint:'纪律 +8 · 威望 +4 · 首长信任 +3',
        fx:{ dv:{discipline:8}, st:{prestige:4, trust:3} }, flag:'clean' },
      { label:'上交组织处理', hint:'纪律 +5 · 政治素养 +4',
        fx:{ dv:{discipline:5, political:4} } },
      { label:'收下，人情往来而已', hint:'（高风险）纪律 −15',
        fx:{ dv:{discipline:-15} }, flag:'gift', risky:true }
    ]
  }
];

/* ---------- 补充抉择事件（提高中后期的事件密度） ---------- */
[
  { id:'ev_inspect_war', title:'战备突击检查', min:4, max:6, weight:13, once:true,
    text:'上级不打招呼，直接拉响了战备等级转换的警报。',
    options:[
      { label:'按预案全速展开，先到位再说', hint:'功勋 +800 · 纪律 +3',
        fx:{ merit:800, dv:{ discipline:3 } } },
      { label:'先核对清单，确保不出错',     hint:'纪律 +5 · 功勋 +300',
        fx:{ dv:{ discipline:5 }, merit:300 } },
      { label:'亲自到一线盯着',             hint:'威望 +4 · 健康 −3 · 功勋 +500',
        fx:{ st:{ prestige:4, health:-3 }, merit:500 } }
    ] },
  { id:'ev_new_equipment', title:'新装备列装', min:3, max:5, weight:12, once:true,
    text:'新装备列装到位，但一批老骨干对着一堆屏幕手足无措。',
    options:[
      { label:'强推新装备，旧装备封存',     hint:'专业能力 +6 · 士气 −5',
        fx:{ dv:{ professional:6 }, st:{ morale:-5 } } },
      { label:'新旧并行，逐步过渡',         hint:'专业能力 +3 · 士气 +3',
        fx:{ dv:{ professional:3 }, st:{ morale:3 } } },
      { label:'让年轻骨干带教老同志',       hint:'威望 +4 · 士气 +4 · 政治素养 +3',
        fx:{ st:{ prestige:4, morale:4 }, dv:{ political:3 } } }
    ] },
  { id:'ev_subordinate_leave', title:'部属想调走', min:3, max:5, weight:11, once:true,
    text:'你一手带出来的参谋提出，想调到别的单位去。',
    options:[
      { label:'放人，好聚好散',             hint:'威望 +4 · 政治素养 +3',
        fx:{ st:{ prestige:4 }, dv:{ political:3 } } },
      { label:'挽留，给他更合适的岗位',     hint:'威望 +2 · 搭档默契 +4',
        fx:{ st:{ prestige:2, bond:4 } } },
      { label:'不放，压他一年',             hint:'威望 −3 · 士气 −4',
        fx:{ st:{ prestige:-3, morale:-4 } } }
    ] },
  { id:'ev_media_doubt', title:'舆论的质疑', min:4, max:6, weight:12, once:true,
    text:'你推的那套做法，被一家媒体写成了"标新立异、不守规矩"。',
    options:[
      { label:'公开回应，用数据说话',       hint:'威望 +5 · 专业能力 +3 · 有风险',
        fx:{ st:{ prestige:5 }, dv:{ professional:3 } },
        hidden:{ chance:0.3, note:'回应被断章取义，争议更大了', st:{ trust:-5 } } },
      { label:'不回应，埋头做事',           hint:'威望 +1 · 纪律 +3',
        fx:{ st:{ prestige:1 }, dv:{ discipline:3 } } },
      { label:'向上级说明情况',             hint:'首长信任 +5',
        fx:{ st:{ trust:5 } } }
    ] },
  { id:'ev_old_comrade', title:'老战友的请托', min:2, max:5, weight:11, once:true,
    text:'转业多年的老战友找上门，想让你帮个"小忙"。',
    options:[
      { label:'在规矩内尽力帮',             hint:'士气 +3 · 纪律 +2',
        fx:{ st:{ morale:3 }, dv:{ discipline:2 } } },
      { label:'明确拒绝，把话说清楚',       hint:'纪律 +5 · 士气 −2',
        fx:{ dv:{ discipline:5 }, st:{ morale:-2 } } },
      { label:'破例通融一次',               hint:'（高风险）纪律 −8 · 士气 +2',
        fx:{ dv:{ discipline:-8 }, st:{ morale:2 } }, risky:true }
    ] },
  { id:'ev_health_check', title:'体检报告', min:3, max:6, weight:12, once:true,
    text:'体检报告出来了，医生建议你减少高强度工作。',
    options:[
      { label:'听医生的，调整节奏',         hint:'健康 +10 · 功勋 −200',
        fx:{ st:{ health:10 }, merit:-200 } },
      { label:'该干嘛干嘛',                 hint:'健康 −6 · 功勋 +400',
        fx:{ st:{ health:-6 }, merit:400 } },
      { label:'加强锻炼，自己调理',         hint:'体魄 +3 · 健康 +4',
        fx:{ attr:{ tibo:3 }, st:{ health:4 } } }
    ] },
  { id:'ev_quota', title:'名额之争', min:3, max:5, weight:12, once:true,
    text:'这一批晋升名额比往年少了一个，你和老搭档只能上一个。',
    options:[
      { label:'让给搭档',                   hint:'搭档默契 +8 · 威望 +4',
        fx:{ st:{ bond:8, prestige:4 } } },
      { label:'据理力争',                   hint:'首长信任 +4 · 搭档默契 −5',
        fx:{ st:{ trust:4, bond:-5 } } },
      { label:'联名向上级反映',             hint:'政治素养 +4 · 有风险',
        fx:{ dv:{ political:4 } },
        hidden:{ chance:0.35, note:'上级认为你们在争名夺利', st:{ trust:-5 } } }
    ] },
  { id:'ev_child_school', title:'孩子上学', min:2, max:4, weight:11, once:true,
    text:'孩子到了上学的年纪，爱人一个人实在忙不过来。',
    options:[
      { label:'把老人接来帮忙',             hint:'家庭 +6 · 士气 +3',
        fx:{ st:{ family:6, morale:3 } } },
      { label:'申请调到离家近的单位',       hint:'家庭 +8 · 首长信任 −4',
        fx:{ st:{ family:8, trust:-4 } } },
      { label:'让爱人再辛苦几年',           hint:'家庭 −6 · 功勋 +250',
        fx:{ st:{ family:-6 }, merit:250 } }
    ] },
  { id:'ev_joint_foreign', title:'联演场上的质疑', min:4, max:5, weight:11, once:true,
    text:'联合演练中，外军指挥员对你的方案提出了公开质疑。',
    options:[
      { label:'当场用推演结果回应',         hint:'威望 +6 · 专业能力 +4',
        fx:{ st:{ prestige:6 }, dv:{ professional:4 } } },
      { label:'会后私下沟通',               hint:'首长信任 +4 · 专业能力 +3',
        fx:{ st:{ trust:4 }, dv:{ professional:3 } } },
      { label:'接受建议，调整方案',         hint:'军事素养 +5 · 威望 −2',
        fx:{ dv:{ military:5 }, st:{ prestige:-2 } } }
    ] },
  { id:'ev_mentor_issue', title:'培养对象出问题', min:4, max:6, weight:11, once:true,
    text:'你重点培养的那名年轻干部，被人举报了。',
    options:[
      { label:'先查清楚再表态',             hint:'政治素养 +5 · 纪律 +3',
        fx:{ dv:{ political:5, discipline:3 } } },
      { label:'相信他，公开支持',           hint:'威望 +4 · 有风险',
        fx:{ st:{ prestige:4 } },
        hidden:{ chance:0.4, note:'事情被查实，你也受了牵连', st:{ trust:-6 }, dv:{ discipline:-4 } } },
      { label:'划清界限，交给组织处理',     hint:'纪律 +5 · 威望 −3',
        fx:{ dv:{ discipline:5 }, st:{ prestige:-3 } } }
    ] },
  { id:'ev_typical', title:'被树为典型', min:2, max:5, weight:10, once:true,
    text:'上级要把你树为先进典型，安排你到处作报告。',
    options:[
      { label:'接受，认真准备',             hint:'威望 +5 · 健康 −3',
        fx:{ st:{ prestige:5, health:-3 } } },
      { label:'推辞，把机会让给一线官兵',   hint:'士气 +5 · 威望 +3',
        fx:{ st:{ morale:5, prestige:3 } } },
      { label:'接受，但坚持不讲空话',       hint:'政治素养 +4 · 威望 +4',
        fx:{ dv:{ political:4 }, st:{ prestige:4 } } }
    ] },
  { id:'ev_back_unit', title:'回老连队', min:6, max:6, weight:14, once:true,
    text:'退役前，你回了一趟当年当兵的老连队。营房翻新了，但门口那棵树还在。',
    options:[
      { label:'给新兵讲一堂课',             hint:'士气 +6 · 信念 +3',
        fx:{ st:{ morale:6 }, attr:{ xinnian:3 } } },
      { label:'默默看一圈就走',             hint:'信念 +5 · 家庭 +3',
        fx:{ attr:{ xinnian:5 }, st:{ family:3 } } },
      { label:'给连队留点东西',             hint:'威望 +4 · 家庭 +2',
        fx:{ st:{ prestige:4, family:2 } } }
    ] },
  { id:'ev_retire_plan', title:'退役安置', min:6, max:6, weight:14, once:true,
    text:'组织征求你对退役安置的意见。',
    options:[
      { label:'服从组织安排',               hint:'纪律 +5 · 威望 +3',
        fx:{ dv:{ discipline:5 }, st:{ prestige:3 } } },
      { label:'申请到院校任教',             hint:'专业能力 +4 · 政治素养 +3',
        fx:{ dv:{ professional:4, political:3 } } },
      { label:'回地方工作',                 hint:'家庭 +6 · 士气 +2',
        fx:{ st:{ family:6, morale:2 } } }
    ] }
].forEach(e => EVENTS.push(e));

/* ---------- 内容扩展事件 ---------- */
[
  {
    id:'ev_gift', title:'一份厚礼', min:2, max:5, weight:11, once:true,
    text:'驻地一家企业的负责人托人送来礼品，说是感谢部队支持，希望“多关照”。',
    options:[
      { label:'坚决退回，并如实报告',     hint:'纪律 +6 · 首长信任 +4',
        fx:{ dv:{discipline:6}, st:{trust:4} }, flag:'clean' },
      { label:'收下但登记上交',           hint:'纪律 +4 · 政治素养 +3',
        fx:{ dv:{discipline:4, political:3} } },
      { label:'不好驳面子，先收着',       hint:'无即时损失，但埋下隐患',
        fx:{ st:{prestige:1} },
        hidden:{ chance:0.55, note:'此事后来被人提起', dv:{discipline:-8}, st:{trust:-6} },
        flag:'gift' }
    ]
  },
  {
    id:'ev_soldier_crisis', title:'深夜来电', min:2, max:4, weight:12, once:true,
    text:'凌晨，指导员打来电话：一名战士情绪崩溃，正坐在天台边。',
    options:[
      { label:'亲自去谈，把人劝下来',     hint:'魅力 +4 · 威望 +5 · 健康 −2',
        fx:{ attr:{meili:4}, st:{prestige:5, health:-2} }, flag:'saved_soldier' },
      { label:'稳住现场，等心理骨干到位', hint:'政治素养 +4 · 纪律 +3',
        fx:{ dv:{political:4, discipline:3} } },
      { label:'按预案处置并上报',         hint:'纪律 +5 · 首长信任 +3 · 士气 −2',
        fx:{ dv:{discipline:5}, st:{trust:3, morale:-2} } }
    ]
  },
  {
    id:'ev_injury', title:'旧伤复发', min:3, max:5, weight:11, once:true,
    text:'高强度连续作业后，年轻时落下的腰伤又犯了，医生建议静养。',
    options:[
      { label:'边治疗边坚持工作',         hint:'意志 +3 · 健康 −5 · 首长信任 +2',
        fx:{ attr:{yizhi:3}, st:{health:-5, trust:2} } },
      { label:'听医嘱休整一段时间',       hint:'健康 +6 · 家庭 +3 · 威望 −2',
        fx:{ st:{health:6, family:3, prestige:-2} } },
      { label:'申请调离高强度岗位',       hint:'健康 +4 · 首长信任 −4',
        fx:{ st:{health:4, trust:-4} } }
    ]
  },
  {
    id:'ev_child_path', title:'孩子的选择', min:3, max:5, weight:10, once:true,
    text:'孩子高考完，说也想考军校。爱人希望他走另一条路。',
    options:[
      { label:'支持他考军校',             hint:'家庭 +3 · 信念 +3 · 士气 +3',
        fx:{ st:{family:3, morale:3}, attr:{xinnian:3} }, flag:'child_military' },
      { label:'尊重他自己的选择',         hint:'家庭 +5 · 魅力 +2',
        fx:{ st:{family:5}, attr:{meili:2} } },
      { label:'劝他先读地方大学',         hint:'智谋 +2 · 家庭 −2 · 首长信任 +1',
        fx:{ attr:{zhimou:2}, st:{family:-2, trust:1} } }
    ]
  },
  {
    id:'ev_media_storm', title:'舆论风波', min:3, max:5, weight:10, once:true,
    text:'一段演习画面被断章取义发到网上，你的单位成了话题中心。',
    options:[
      { label:'公开说明事实经过',         hint:'威望 +4 · 风险',
        fx:{ st:{prestige:4} },
        hidden:{ chance:0.35, note:'说明未完全平息议论', st:{trust:-3} } },
      { label:'请宣传部门统一回应',       hint:'纪律 +3 · 首长信任 +3',
        fx:{ dv:{discipline:3}, st:{trust:3} } },
      { label:'不回应，用后续成绩说话',   hint:'威望 +2 · 专业能力 +3',
        fx:{ st:{prestige:2}, dv:{professional:3} } }
    ]
  },
  {
    id:'ev_rival_ops', title:'同期的小动作', min:3, max:5, weight:11, once:true,
    text:'你发现，同期的老对手在汇报材料里有意无意地抬高自己、贬低你的成绩。',
    options:[
      { label:'当面把话说开',             hint:'威望 +3 · 搭档默契 −2',
        fx:{ st:{prestige:3, bond:-2} } },
      { label:'用完整台账澄清',           hint:'专业能力 +4 · 首长信任 +4',
        fx:{ dv:{professional:4}, st:{trust:4} } },
      { label:'不计较，继续做好自己的事', hint:'信念 +4 · 威望 +2',
        fx:{ attr:{xinnian:4}, st:{prestige:2} } }
    ]
  },
  {
    id:'ev_early_retire', title:'提前退役邀请', min:4, max:5, weight:9, once:true,
    text:'地方一家单位开出不错的条件，希望你提前转身。组织也征求你的意见。',
    options:[
      { label:'留下，部队更需要我',       hint:'信念 +5 · 首长信任 +5 · 功勋 +400',
        fx:{ attr:{xinnian:5}, st:{trust:5}, merit:400 } },
      { label:'认真考虑，但暂不决定',     hint:'智谋 +2 · 家庭 +3',
        fx:{ attr:{zhimou:2}, st:{family:3} } },
      { label:'申请转业',                 hint:'家庭 +8 · 士气 −6 · 可能提前结束生涯',
        fx:{ st:{family:8, morale:-6} }, flag:'wanted_retire' }
    ]
  },
  {
    id:'ev_honor_title', title:'荣誉称号', min:4, max:6, weight:10, once:true,
    text:'上级准备授予你一项荣誉称号，需要到处作报告、接受采访。',
    options:[
      { label:'接受，并讲真话、不注水',   hint:'威望 +7 · 政治素养 +4 · 健康 −2',
        fx:{ st:{prestige:7, health:-2}, dv:{political:4} }, flag:'honor_title' },
      { label:'推给更基层的同志',         hint:'士气 +5 · 威望 +4 · 政治素养 +3',
        fx:{ st:{morale:5, prestige:4}, dv:{political:3} } },
      { label:'婉拒，怕耽误战备',         hint:'纪律 +4 · 军事素养 +3 · 首长信任 −2',
        fx:{ dv:{discipline:4, military:3}, st:{trust:-2} } }
    ]
  },
  {
    id:'ev_spouse_job', title:'爱人调动', min:3, max:5, weight:10, once:true,
    text:'爱人工作调动到外地，孩子上学、老人照顾都成了问题。',
    options:[
      { label:'支持爱人去，家里我来扛',   hint:'家庭 +4 · 健康 −3 · 士气 −2',
        fx:{ st:{family:4, health:-3, morale:-2} } },
      { label:'申请调整驻地或岗位',       hint:'首长信任 −3 · 家庭 +6',
        fx:{ st:{trust:-3, family:6} } },
      { label:'请老人暂时过来帮忙',       hint:'家庭 +3 · 士气 +2',
        fx:{ st:{family:3, morale:2} } }
    ]
  },
  {
    id:'ev_inspect_talk', title:'谈话函询', min:3, max:6, weight:9, once:true,
    text:'纪检部门找你谈话，核实一件与你有关的举报线索。',
    options:[
      { label:'如实说明全部情况',         hint:'纪律 +6 · 首长信任 +3',
        fx:{ dv:{discipline:6}, st:{trust:3} } },
      { label:'请组织全面核查',           hint:'纪律 +4 · 威望 +2',
        fx:{ dv:{discipline:4}, st:{prestige:2} } },
      { label:'强调自己不知情',           hint:'无即时收益，有风险',
        fx:{},
        hidden:{ chance:0.45, note:'核查发现你知情不报', dv:{discipline:-10}, st:{trust:-8} } }
    ]
  }
].forEach(e => EVENTS.push(e));

/* ---------- 子女成才 / 退役第二人生 ---------- */
[
  {
    id:'ev_kid_choice', title:'孩子的志愿', min:4, max:6, weight:12, once:true,
    text:'孩子长大了，站在人生的岔路口。他问你：爸，我该怎么走？',
    options:[
      { label:'支持他报军校', hint:'家庭 +4 · 信念 +3 · 可能成为接班人',
        fx:{ st:{ family:4 }, attr:{ xinnian:3 }, heir:1 }, flag:'child_military' },
      { label:'让他自己闯',   hint:'家庭 +5 · 智谋 +2',
        fx:{ st:{ family:5 }, attr:{ zhimou:2 } } },
      { label:'劝他走稳妥的路', hint:'家庭 +3 · 威望 +1',
        fx:{ st:{ family:3, prestige:1 } } }
    ]
  },
  {
    id:'ev_kid_grad', title:'孩子毕业典礼', min:5, max:6, weight:10, once:true,
    text:'你请了半天假，坐在礼堂最后一排。孩子在台上敬礼时，你突然觉得自己老了。',
    options:[
      { label:'上台和他合个影', hint:'家庭 +8 · 士气 +4',
        fx:{ st:{ family:8, morale:4 } } },
      { label:'默默看完就走',   hint:'信念 +3 · 家庭 +4',
        fx:{ attr:{ xinnian:3 }, st:{ family:4 } } },
      { label:'因任务缺席',     hint:'功勋 +300 · 家庭 −6',
        fx:{ merit:300, st:{ family:-6 } } }
    ]
  },
  {
    id:'ev_retire_offer', title:'退役前的邀请', min:6, max:6, weight:12, once:true,
    text:'还没到龄，地方高校和企业都递来了橄榄枝。组织也问你有什么打算。',
    options:[
      { label:'服从安排，站好最后一班岗', hint:'纪律 +5 · 威望 +4',
        fx:{ dv:{ discipline:5 }, st:{ prestige:4 } } },
      { label:'准备退役后的讲台', hint:'专业能力 +4 · 家庭 +3',
        fx:{ dv:{ professional:4 }, st:{ family:3 } }, flag:'retire_teach' },
      { label:'多陪陪家里', hint:'家庭 +8 · 士气 +3',
        fx:{ st:{ family:8, morale:3 } }, flag:'retire_family' }
    ]
  },
  {
    id:'ev_second_life', title:'第二人生的预演', min:6, max:6, weight:10, once:true,
    text:'你去驻地中学讲了一堂国防课。孩子们的眼睛很亮，你讲着讲着，忽然不知道自己更属于哪里。',
    options:[
      { label:'把这堂课讲成一堂人生课', hint:'政治素养 +4 · 威望 +3 · 信念 +2',
        fx:{ dv:{ political:4 }, st:{ prestige:3 }, attr:{ xinnian:2 } } },
      { label:'只讲装备和战术', hint:'军事素养 +3 · 专业能力 +3',
        fx:{ dv:{ military:3, professional:3 } } },
      { label:'讲完就走，不回头', hint:'意志 +3 · 家庭 +2',
        fx:{ attr:{ yizhi:3 }, st:{ family:2 } } }
    ]
  }
].forEach(e => EVENTS.push(e));

/* ---------- 结局 ----------
   判定顺序即优先级：先命中先结算，因此越特殊、越稀有的结局排在越前面。 */
const ENDINGS = [
  { id:'e_qjts', tier:'legend', name:'强军统帅',
    cond: s => s.rankIdx >= 19 && (s.heir || 0) >= 3 && s.st.prestige >= 75
      && s.dv.discipline >= 82 && !!s.route && (getPosition(s).level || 0) >= 14,
    text:'（完全虚构）你站到了这部模拟所能书写的最高处。肩章、岗位、制度与人，在你这里叠成了同一件事。授衔那天没有欢呼，只有很长的沉默——你知道，这不是终点，是把担子交出去的开始。' },
  { id:'e_grand', tier:'legend', name:'大元帅',
    cond: s => s.rankIdx >= 19,
    text:'这个军衔，人民军队的历史上设而未授。它不属于任何一场胜仗，而是属于一整套东西——你带出来的部队、你推行的制度、你培养的人。授衔那天没有人欢呼，只有很长的沉默。' },
  { id:'e_marshal_top', tier:'legend', name:'将星璀璨',
    cond: s => s.rankIdx >= 18 && s.dv.discipline >= 88 && s.st.prestige >= 80,
    text:'你从列兵一路走到上将。阅兵式上，你站在观礼台最前排，肩上的三颗星在阳光下泛着光。没有人记得你当年在新兵连打背包慢了半拍，但你自己记得。' },
  { id:'e_cmd_marshal', tier:'legend', name:'铁血战将',
    cond: s => s.rankIdx >= 18 && s.route === 'command',
    text:'你这一辈子，最踏实的时刻是在指挥所里。地图摊开，红蓝铅笔一划，几万人就动起来了。有人说你只懂打仗，你笑笑：能把仗打好，已经不容易了。' },
  { id:'e_pol_marshal', tier:'legend', name:'铸魂育人',
    cond: s => s.rankIdx >= 18 && s.route === 'political',
    text:'你没带过多少兵，但很多带兵的人是你带出来的。你常说，枪可以换，人不能散。几十年过去，那些被你谈过话的年轻人，如今都站在了重要的位置上。' },
  { id:'e_stf_marshal', tier:'legend', name:'谋定全局',
    cond: s => s.rankIdx >= 18 && s.route === 'staff',
    text:'别人看到的是战场上的胜负，你看到的是后面的油料、弹药、维修和运力。你一辈子都在算这些没人看得见的东西，而正是它们，让前面的人敢打。' },
  { id:'e_legacy', tier:'legend', name:'薪火相传',
    cond: s => s.rankIdx >= 18 && (s.heir || 0) >= 3 && s.st.prestige >= 78,
    text:'你把最好的年华留在了部队，又把一批又一批年轻人送上了带兵的位置。军装换了一代又一代，有些东西没变。' },
  { id:'e_reform', tier:'legend', name:'强军先锋',
    cond: s => s.rankIdx >= 18 && s.flags.reform && s.dv.professional >= 93,
    text:'你推的那套训练路子，起初挨了不少骂。多年以后，它成了新的条令。' },
  { id:'e_marshal', tier:'legend', name:'执掌一方',
    cond: s => s.rankIdx >= 18,
    text:'你走到了军旅生涯的顶点。回望五十年，你亲手带出来的部队，如今已经换了三茬人。' },
  { id:'e_general', tier:'gold', name:'肩扛金星',
    cond: s => s.rankIdx >= 16,
    text:'将星加身的那天，你在镜子前站了很久。这一路没有侥幸，每一步都是自己走出来的。' },
  { id:'e_peace', tier:'gold', name:'蓝盔荣光',
    cond: s => s.flags.peace && s.rankIdx >= 11,
    text:'那片遥远的土地上，你戴过蓝盔。多年以后还有人记得，有一支中国军人在那里守过和平。' },
  { id:'e_rescue', tier:'gold', name:'人民至上',
    cond: s => s.flags.rescue || s.flags.saved_village,
    text:'堤坝上、废墟里、风雪中，你都去过。你说不出什么大道理，但你站在了该站的地方。' },
  { id:'e_discipline', tier:'warn', name:'失守的防线',
    cond: s => s.dv.discipline < 62 || s.flags.gift,
    text:'你走过很长的路，却在最后丢掉了最重要的东西。军装还在，但有些分量已经轻了。' },
  { id:'e_tough', tier:'plain', name:'边关冷月',
    cond: s => s.flags.tough_area,
    text:'你把最好的那些年留在了高原。那里风大、氧气少，但星空比哪里都亮。' },
  { id:'e_mentor', tier:'gold', name:'金牌教头',
    cond: s => s.rankIdx >= 15 && (s.heir || 0) >= 2 && s.st.prestige >= 68,
    text:'你带出来的干部，一个接一个走上了主官岗位。有人说，部队里最值钱的不是装备，是人——而你一辈子都在做这件事。' },
  { id:'e_balanced', tier:'gold', name:'铁骨柔情',
    cond: s => s.rankIdx >= 13 && s.st.family >= 72 && s.st.morale >= 62,
    text:'军装穿了半辈子，家也没散。这在这个行当里，比肩章更难。' },
  { id:'e_info', tier:'gold', name:'无形战线',
    cond: s => s.flags.cyber && s.rankIdx >= 13 && s.dv.professional >= 80,
    text:'很多人不知道你这些年在忙什么。屏幕前的彻夜、演训场上的静默，都是为了打赢那天不必说出口的仗。' },
  { id:'e_silent', tier:'plain', name:'默默奉献',
    cond: s => s.rankIdx <= 15 && s.st.prestige >= 55,
    text:'你没有走到很高的位置，但你带过的兵都记得你。有些功劳不写在档案里。' },
  { id:'e_plain', tier:'plain', name:'光荣退役',
    cond: () => true,
    text:'军装叠好，放进箱底。五十年，从新兵连到最后一班岗，你把该做的都做了。' }
];

/* ---------- 机会卡池 ----------
   每回合随机抽 3 张作为额外可选行动，各有独特收益与代价，
   让每一回合的选项都不一样。 */
const OPPORTUNITIES = [
  { id:'op_mentor',    name:'首长点将',     ap:1, min:0, cat:'机会', merit:200,
    desc:'首长点名让你随队执行一次重要任务 · 功勋 +200 · 首长信任 +4',
    fx:{ merit:200, st:{ trust:4 } } },
  { id:'op_help',      name:'替战友顶班',   ap:1, min:0, cat:'机会',
    desc:'替生病的战友值了一周班 · 士气 +5 · 搭档默契 +4',
    fx:{ st:{ morale:5, bond:4 } } },
  { id:'op_letter',    name:'一封家书',     ap:1, min:0, cat:'机会',
    desc:'收到家里的信，说一切都好 · 家庭 +5 · 信念 +2',
    fx:{ st:{ family:5 }, attr:{ xinnian:2 } } },
  { id:'op_bulletin',  name:'连队板报',     ap:1, min:0, cat:'机会',
    desc:'你办的板报被旅里评为优秀 · 威望 +2 · 政治素养 +3',
    fx:{ st:{ prestige:2 }, dv:{ political:3 } } },
  { id:'op_sports',    name:'军体运动会',   ap:2, min:0, cat:'机会',
    desc:'代表单位参加军体运动会 · 体魄 +3 · 威望 +3 · 功勋 +150',
    fx:{ attr:{ tibo:3 }, st:{ prestige:3 }, merit:150 } },
  { id:'op_draft',     name:'代写材料',     ap:1, min:1, cat:'机会',
    desc:'帮机关连夜赶材料 · 专业能力 +3 · 首长信任 +3 · 健康 −2',
    fx:{ dv:{ professional:3 }, st:{ trust:3, health:-2 } } },
  { id:'op_overtime',  name:'通宵加班',     ap:2, min:1, cat:'机会',
    desc:'连续一周加班整理台账 · 首长信任 +6 · 健康 −5',
    fx:{ st:{ trust:6, health:-5 } } },
  { id:'op_visit',     name:'慰问演出',     ap:1, min:1, cat:'机会',
    desc:'组织官兵观看慰问演出 · 士气 +7 · 魅力 +2',
    fx:{ st:{ morale:7 }, attr:{ meili:2 } } },
  { id:'op_training',  name:'参加集训班',   ap:2, min:1, cat:'机会',
    desc:'为期一月的骨干集训 · 技能点 +3 · 智谋 +2 · 健康 −2',
    fx:{ sp:3, attr:{ zhimou:2 }, st:{ health:-2 } } },
  { id:'op_recon',     name:'侦察骨干集训', ap:2, min:2, cat:'机会',
    desc:'参加侦察骨干集训 · 军事素养 +4 · 技能点 +2 · 健康 −3',
    fx:{ dv:{ military:4 }, sp:2, st:{ health:-3 } } },
  { id:'op_lecture',   name:'讲一堂战例课', ap:1, min:2, cat:'机会',
    desc:'给全营讲一堂战例课 · 智谋 +2 · 威望 +4',
    fx:{ attr:{ zhimou:2 }, st:{ prestige:4 } } },
  { id:'op_inspect',   name:'迎接上级检查', ap:2, min:2, cat:'机会',
    desc:'你负责汇报，检查结果优秀 · 纪律 +3 · 首长信任 +5',
    fx:{ dv:{ discipline:3 }, st:{ trust:5 } } },
  { id:'op_paper',     name:'撰写军事论文', ap:2, min:3, cat:'机会', merit:350,
    desc:'在军事刊物发表文章 · 智谋 +3 · 威望 +4 · 功勋 +350',
    fx:{ attr:{ zhimou:3 }, st:{ prestige:4 }, merit:350 } },
  { id:'op_joint',     name:'跨单位交流',   ap:2, min:3, cat:'机会',
    desc:'与兄弟单位交流经验 · 专业能力 +4 · 搭档默契 +3',
    fx:{ dv:{ professional:4 }, st:{ bond:3 } } },
  { id:'op_press',     name:'接受采访',     ap:1, min:3, cat:'机会',
    desc:'军报来队采访，你上了头版 · 威望 +6，但可能招来议论',
    fx:{ st:{ prestige:6 } }, hidden:{ chance:0.3, note:'报道引来了一些非议', st:{ trust:-5 } } },
  { id:'op_foreign',   name:'外军交流',     ap:3, min:4, cat:'机会', merit:700,
    desc:'与外军代表团交流 · 专业能力 +5 · 军事素养 +3 · 功勋 +700',
    fx:{ dv:{ professional:5, military:3 }, merit:700 } },
  { id:'op_pilot',     name:'承担试点任务', ap:3, min:4, cat:'机会', merit:1000,
    desc:'主动承担一项训练改革试点 · 功勋 +1000 · 专业能力 +4',
    fx:{ merit:1000, dv:{ professional:4 } }, flag:'reform' },
  { id:'op_talent',    name:'发现好苗子',   ap:2, min:4, cat:'机会',
    desc:'看中一名年轻干部，重点培养 · 威望 +3 · 政治素养 +3',
    fx:{ st:{ prestige:3 }, dv:{ political:3 }, heir:1 } },
  { id:'op_strategy',  name:'战略研讨班',   ap:3, min:5, cat:'机会', merit:900,
    desc:'参加高级战略研讨 · 智谋 +4 · 专业能力 +4 · 功勋 +900',
    fx:{ attr:{ zhimou:4 }, dv:{ professional:4 }, merit:900 } },
  { id:'op_oldunit',   name:'回老部队看看', ap:2, min:5, cat:'机会',
    desc:'回当年带过的连队走了走 · 士气 +8 · 信念 +3 · 家庭 +2',
    fx:{ st:{ morale:8, family:2 }, attr:{ xinnian:3 } } },
  { id:'op_night_ops', name:'夜间突击拉动', ap:2, min:1, cat:'机会',
    desc:'参加夜间紧急拉动 · 军事素养 +3 · 意志 +2 · 健康 −2',
    fx:{ dv:{ military:3 }, attr:{ yizhi:2 }, st:{ health:-2 } } },
  { id:'op_home_visit', name:'家属来队',   ap:1, min:1, cat:'机会',
    desc:'爱人带孩子来队探亲 · 家庭 +8 · 士气 +4',
    fx:{ st:{ family:8, morale:4 } } },
  { id:'op_info_class', name:'信息化集训', ap:2, min:3, cat:'机会',
    desc:'参加信息系统业务集训 · 专业能力 +4 · 技能点 +3 · 健康 −2',
    fx:{ dv:{ professional:4 }, sp:3, st:{ health:-2 } }, flag:'cyber' },
  { id:'op_rescue_call', name:'应急出动',  ap:3, min:2, cat:'机会', merit:900,
    desc:'驻地突发险情，你带队连夜出动 · 功勋 +900 · 威望 +5 · 健康 −4',
    fx:{ merit:900, st:{ prestige:5, health:-4 } }, flag:'rescue' },
  { id:'op_write_book', name:'著书立说',   ap:3, min:4, cat:'机会', merit:1200,
    desc:'整理带兵心得并出版 · 威望 +6 · 专业能力 +4 · 功勋 +1200',
    fx:{ st:{ prestige:6 }, dv:{ professional:4 }, merit:1200 } },
  { id:'op_youth_camp', name:'少年军校辅导', ap:2, min:3, cat:'机会',
    desc:'给少年军校讲战术启蒙 · 政治素养 +3 · 魅力 +3 · 威望 +2',
    fx:{ dv:{ political:3 }, attr:{ meili:3 }, st:{ prestige:2 } } },
  { id:'op_joint_duty', name:'联指值班',   ap:2, min:4, cat:'机会', merit:800,
    desc:'参加联合指挥所值班 · 军事素养 +4 · 专业能力 +3 · 功勋 +800',
    fx:{ dv:{ military:4, professional:3 }, merit:800 } },
  { id:'op_legacy_speech', name:'给新兵团讲课', ap:1, min:5, cat:'机会',
    desc:'给新兵团讲第一课 · 信念 +4 · 威望 +4 · 士气 +3',
    fx:{ attr:{ xinnian:4 }, st:{ prestige:4, morale:3 } } },
  { id:'op_date_night', name:'难得的周末', ap:1, min:1, cat:'机会',
    desc:'爱人从驻地赶来，你们吃了顿安稳饭 · 家庭 +7 · 士气 +3',
    fx:{ st:{ family:7, morale:3 } } },
  { id:'op_kid_school', name:'孩子家长会', ap:1, min:2, cat:'机会',
    desc:'挤出时间去开了次家长会 · 家庭 +5 · 魅力 +2',
    fx:{ st:{ family:5 }, attr:{ meili:2 } } },
  { id:'op_ally_cover', name:'同盟顶班', ap:1, min:2, cat:'机会',
    desc:'同期战友替你顶了一周班 · 搭档默契 +6 · 士气 +3',
    fx:{ st:{ bond:6, morale:3 } } },
  { id:'op_nemesis_watch', name:'被人盯着', ap:2, min:2, cat:'机会',
    desc:'对手处处与你较劲 · 功勋 +200 · 士气 −3 · 威望 +2',
    fx:{ merit:200, st:{ morale:-3, prestige:2 } } },
  { id:'op_unit_honor', name:'单位荣立集体功', ap:2, min:3, cat:'机会', merit:600,
    desc:'你带的单位荣立集体功 · 功勋 +600 · 威望 +5 · 凝聚力上升',
    fx:{ merit:600, st:{ prestige:5 } }, flag:'unit_honor' },
  { id:'op_equipment_new', name:'新装备列装', ap:2, min:3, cat:'机会',
    desc:'带头完成新装备接装训练 · 专业能力 +5 · 技能点 +2',
    fx:{ dv:{ professional:5 }, sp:2 } },
  { id:'op_joint_host', name:'承办联合演练', ap:3, min:4, cat:'机会', merit:1100,
    desc:'牵头承办跨军种演练 · 功勋 +1100 · 专业能力 +4 · 健康 −3',
    fx:{ merit:1100, dv:{ professional:4 }, st:{ health:-3 } } }
];

/* ---------- 同期军官 ---------- */
const RIVAL_NAMES = [
  '周建国','李卫东','孙志强','陈立新','王振华','刘铁军','赵明远','杨海涛',
  '黄志刚','吴晓峰','徐国栋','郑云飞','马长胜','林向阳','高建军','谢文斌',
  '何守成','罗大鹏','秦立国','曹永强'
];
const RIVAL_TAGS = ['稳健','拼劲足','实干','善交际','老成','肯钻研','敢闯','细致'];

/* 对手 AI 性格：决定增长节奏、波动幅度与晋升倾向 */
const RIVAL_STYLES = {
  aggressive: { key:'aggressive', name:'拼抢型', meritMul:1.18, variance:0.28, promoBoost:0.12, setback:0.08,
    blurb:'敢冲敢抢，起伏大，容易超车也容易翻车' },
  balanced:   { key:'balanced',   name:'稳健型', meritMul:1.02, variance:0.12, promoBoost:0.02, setback:0.04,
    blurb:'按部就班，很少大起大落' },
  political:  { key:'political',  name:'人脉型', meritMul:0.96, variance:0.14, promoBoost:0.10, setback:0.05,
    blurb:'善于经营关系，晋升有时快于实绩' },
  technical:  { key:'technical',  name:'钻研型', meritMul:1.08, variance:0.10, promoBoost:0.04, setback:0.03,
    blurb:'专业过硬，任务评价稳定偏高' },
  social:     { key:'social',     name:'交际型', meritMul:1.00, variance:0.18, promoBoost:0.06, setback:0.07,
    blurb:'机会多，但有时会因风头太劲被议论' }
};

/* 同期军官每回合的基准功勋收益（按阶段递增） */
const RIVAL_GAIN = {
  recruit: 90, nco: 350, officer: 950, field: 1900,
  general: 2800, marshal: 2250, legacy: 750
};

/* 对手高光 / 翻车事件文案池 */
const RIVAL_EVENT_POOL = {
  boost: [
    '在上级比武中拿了名次，一时风头很劲',
    '牵头完成一项重点任务，评价很高',
    '被选送到院校深造，履历又厚了一层',
    '所在单位被树为典型，本人也被点名表扬'
  ],
  setback: [
    '因工作疏漏被通报批评，晋升节奏被打乱',
    '家里出了变故，状态明显下滑',
    '一次任务评价不佳，威望受损',
    '体检亮红灯，暂时离开高强度岗位'
  ],
  vsPlayer: [
    '在同期讲评中被拿来和你比较',
    '和你竞争同一个进修名额',
    '在联合任务中被安排与你搭档',
    '有人拿你们俩的履历做对照'
  ]
};

/* ---------- 军衔肩章（用星数与样式表示） ---------- */
const RANK_INSIGNIA = [
  { stars:0, style:'chevr' },  // 列兵
  { stars:1, style:'chevr' },  // 上等兵
  { stars:1, style:'bar' },    // 下士
  { stars:2, style:'bar' },    // 中士
  { stars:3, style:'bar' },    // 上士
  { stars:1, style:'bar4' },   // 四级军士长
  { stars:2, style:'bar4' },   // 三级军士长
  { stars:3, style:'bar4' },   // 二级军士长
  { stars:4, style:'bar4' },   // 一级军士长
  { stars:1, style:'star' },   // 少尉
  { stars:2, style:'star' },   // 中尉
  { stars:3, style:'star' },   // 上尉
  { stars:1, style:'star2' },  // 少校
  { stars:2, style:'star2' },  // 中校
  { stars:3, style:'star2' },  // 上校
  { stars:4, style:'star2' },  // 大校
  { stars:1, style:'gold' },   // 少将
  { stars:2, style:'gold' },   // 中将
  { stars:3, style:'gold' },   // 上将
  { stars:1, style:'grand' }   // 大元帅
];

/* ============================================================
   以下为扩展系统：入伍方式 / 技能 S 级指令 / 成就 / 家训 / 二周目事件
   ============================================================ */

/* ---------- 入伍方式 ----------
   不同的入伍路径带来不同的起点与先天条件，是重玩价值的第一层。 */
const ENLIST_TYPES = {
  conscript: {
    key:'conscript', name:'义务兵', short:'义务兵',
    desc:'最常规的入伍方式。属性分配均衡，没有短板也没有特长。',
    alloc: 30, sp: 0, startRank: 0, mods:{}
  },
  nco: {
    key:'nco', name:'直招军士', short:'直招军士',
    desc:'凭专业技能直接入伍。起点是下士，可分配点数少 4 点。',
    alloc: 26, sp: 18, startRank: 2, mods:{ zhimou:4 }
  },
  college: {
    key:'college', name:'大学生士兵', short:'大学生',
    desc:'文化底子好，体能偏弱。智谋 +8、信念 +4，但体魄 −6。',
    alloc: 30, sp: 10, startRank: 0, mods:{ zhimou:8, xinnian:4, tibo:-6 }
  },
  officer: {
    key:'officer', name:'生长军官', short:'生长军官',
    desc:'军校毕业，可分配点数最多，但欠基层经历——尉官期晋升门槛高 20%。',
    alloc: 34, sp: 0, startRank: 0,
    mods:{ military:-12 }, flags:{ no_grassroots:true }, needMul:1.2
  }
};

/* ---------- 技能 S 级解锁的高级指令 ----------
   技能不再只是数值加成，练到 S 级会解锁改变玩法的高级指令。 */
const SKILL_SKILLS = {
  sheji:    { name:'精准射击',     desc:'单兵层任务评价 +12%' },
  zhencha:  { name:'情报判读',     desc:'任务评价 +10%，但风险 +3%' },
  zuzhi:    { name:'组织指挥',     desc:'全部任务风险 −6%' },
  lianhe:   { name:'联合作战指挥', desc:'战役层任务部署点 +1' },
  canmou:   { name:'战役推演',     desc:'任务评价结算 +8%' },
  houqin:   { name:'战时保障',     desc:'战略层任务部署点 +1' },
  tiaoling: { name:'条令权威',     desc:'作风纪律的自然衰减减半' },
  sixiang:  { name:'政治动员',     desc:'任务失利时的士气损失减半' },
  dongyuan: { name:'全面动员',     desc:'战略层任务评价 +10%' },
  daibing:  { name:'带兵育人',     desc:'任务评价 +6%，部属成长更快' }
};
function hasS(s, key) { return !!(s && s.skills && (s.skills[key] || 0) >= 6); }

/* ---------- 成就（跨周目累积） ---------- */
const ACHIEVEMENTS = [
  /* 军衔 */
  { id:'rank_general', name:'肩扛金星',   desc:'晋升至少将',              cond:s => s.rankIdx >= 16 },
  { id:'rank_marshal', name:'执掌一方',   desc:'晋升至上将',              cond:s => s.rankIdx >= 18 },
  { id:'rank_grand',   name:'设而未授',   desc:'晋升至大元帅',            cond:s => s.rankIdx >= 19 },
  { id:'ach_review_best', name:'考评优秀', desc:'任期考评获得“优秀”3 次', cond:s => (s.flags.achReviewBest || 0) >= 3 },
  { id:'ach_cyber',   name:'无形尖兵',   desc:'完成网络攻防演练',        cond:s => !!s.flags.cyber },
  { id:'ach_quake',   name:'地动山摇',   desc:'完成抗震救灾任务',        cond:s => !!s.flags.rescue && !!s.flags.saved_village },
  { id:'ach_honor',   name:'荣誉等身',   desc:'获得荣誉称号',            cond:s => !!s.flags.honor_title },
  { id:'ach_saved_soldier', name:'拉住那只手', desc:'成功挽救一名战士',   cond:s => !!s.flags.saved_soldier },
  { id:'rank_nco',     name:'老兵',       desc:'以军士身份走完全程',      cond:s => s.rankIdx <= 8 && s.serviceYear >= 30 },
  { id:'rank_low',     name:'原地踏步',   desc:'服役满 20 年仍是列兵',    cond:s => s.rankIdx === 0 && s.serviceYear >= 20 },
  /* 路线 */
  { id:'route_cmd',    name:'铁血战将',   desc:'走完军事指挥线',          cond:s => s.route === 'command' },
  { id:'route_pol',    name:'铸魂育人',   desc:'走完政治工作线',          cond:s => s.route === 'political' },
  { id:'route_stf',    name:'谋定全局',   desc:'走完参谋后装线',          cond:s => s.route === 'staff' },
  { id:'route_switch', name:'半路改行',   desc:'中途转线一次',            cond:s => s.routeSwitched },
  /* 任务 */
  { id:'task_s',       name:'名将之风',   desc:'在任务中取得 S 级评价',   cond:s => (s.flags.achS || 0) >= 1 },
  { id:'task_s10',     name:'常胜',       desc:'累计取得 10 次 S 级评价', cond:s => (s.flags.achS || 0) >= 10 },
  { id:'task_d',       name:'败仗',       desc:'在任务中取得 D 级评价',   cond:s => (s.flags.achD || 0) >= 1 },
  /* 重大功勋与抉择 */
  { id:'deed_all',     name:'功勋等身',   desc:'集齐五种重大功勋',        cond:s => greatDeeds(s) >= 5 },
  { id:'peace',        name:'蓝盔',       desc:'参加国际维和',            cond:s => s.flags.peace },
  { id:'rescue',       name:'人民至上',   desc:'参加抗洪抢险',            cond:s => s.flags.rescue },
  { id:'tough',        name:'边关冷月',   desc:'主动申请艰苦地区',        cond:s => s.flags.tough_area },
  { id:'clean',        name:'两袖清风',   desc:'当面退回不该收的东西',    cond:s => s.flags.clean },
  { id:'gift',         name:'一念之差',   desc:'收下不该收的东西',        cond:s => s.flags.gift },
  { id:'blame',        name:'替人担责',   desc:'替部属承担责任',          cond:s => s.flags.took_blame },
  { id:'village',      name:'堤坝上的命令', desc:'违令先救群众',          cond:s => s.flags.saved_village },
  { id:'gave_merit',   name:'让功',       desc:'把立功名额让给副手',      cond:s => s.flags.gave_merit },
  /* 状态 */
  { id:'disc_top',     name:'铁纪',       desc:'退役时作风纪律达到优秀',  cond:s => s.dv.discipline >= 88 },
  { id:'disc_bad',     name:'失守',       desc:'退役时作风纪律不合格',    cond:s => s.dv.discipline < 62 },
  { id:'attr_max',     name:'登峰造极',   desc:'任意一项属性达到上限',    cond:s => ATTRS.some(a => s.attr[a.key] >= 110) },
  { id:'health_low',   name:'透支',       desc:'退役时健康低于 30',       cond:s => s.st.health < 30 },
  { id:'heir3',        name:'桃李满园',   desc:'培养出 3 名接班人',       cond:s => (s.heir || 0) >= 3 },
  { id:'injury5',      name:'九死一生',   desc:'累计负伤 5 次',           cond:s => s.injuryCount >= 5 },
  { id:'iron_body',    name:'铁打的',     desc:'服役满 30 年从未负伤',    cond:s => s.injuryCount === 0 && s.serviceYear >= 30 },
  { id:'martyr',       name:'碧血丹心',   desc:'在执行任务中牺牲',        cond:s => s.flags.martyr },
  { id:'skill_s',      name:'技近乎道',   desc:'把一项技能练到 S 级',     cond:s => Object.keys(s.skills).some(k => s.skills[k] >= 6) },
  /* 同期竞争 */
  { id:'rank1',        name:'独占鳌头',   desc:'终局时同期排名第一',      cond:s => myRank(s).pos === 1 },
  { id:'rank_last',    name:'殿后',       desc:'终局时同期排名垫底',      cond:s => myRank(s).pos === myRank(s).total },
  /* 生涯 */
  { id:'full50',       name:'五十年',     desc:'服役满 50 年',            cond:s => s.serviceYear >= 50 },
  { id:'merit100k',    name:'功勋十万',   desc:'累计功勋超过 100000',     cond:s => s.merit >= 100000 },
  { id:'merit150k',    name:'功勋十五万', desc:'累计功勋超过 150000',     cond:s => s.merit >= 150000 },
  { id:'grand_bid',    name:'问鼎',       desc:'向上将之上的荣誉发起过冲击', cond:s => s.flags.achGrandBid },
  { id:'all_deeds',    name:'走遍山河',   desc:'维和、抢险、边防都去过',  cond:s => s.flags.peace && s.flags.rescue && s.flags.tough_area },
  { id:'qjts',        name:'强军统帅',   desc:'达成最高虚构结局',        cond:s => !!(s.ending && s.ending.id === 'e_qjts') },
  { id:'top_post',    name:'机关之巅',   desc:'担任路线最高机关主要领导', cond:s => (POSITION_MAP[s.positionId] || {}).level >= 14 }
];

/* ============================================================
   勋章墙
   比成就更偏「表彰仪式感」：按战功 / 品格 / 成长 / 传承四类，
   分金质、银质、铜质三档，跨周目永久收藏。
   ============================================================ */
const MEDAL_CATS = ['战功', '品格', '成长', '传承'];

const MEDAL_TIERS = {
  gold:   { key:'gold',   name:'金质', color:'#c9a227', ring:'#8a6a12' },
  silver: { key:'silver', name:'银质', color:'#9aa3ad', ring:'#6b737c' },
  bronze: { key:'bronze', name:'铜质', color:'#b07a4a', ring:'#7a5230' }
};

const MEDALS = [
  /* ---- 战功 ---- */
  { id:'md_star_s', name:'一等战功章', cat:'战功', tier:'gold',
    desc:'累计取得 5 次 S 级任务评价', cond:s => (s.flags.achS || 0) >= 5 },
  { id:'md_star_a', name:'二等战功章', cat:'战功', tier:'silver',
    desc:'累计取得 5 次 A 级及以上评价', cond:s => (s.flags.achS || 0) + (s.flags.achA || 0) >= 5 },
  { id:'md_star_first', name:'首战纪念章', cat:'战功', tier:'bronze',
    desc:'首次完成任务推演', cond:s => (s.flags.taskCount || 0) >= 1 },
  { id:'md_rescue', name:'抢险纪念章', cat:'战功', tier:'gold',
    desc:'参加抗洪抢险或抗震救灾', cond:s => !!s.flags.rescue },
  { id:'md_peace', name:'蓝盔纪念章', cat:'战功', tier:'gold',
    desc:'参加国际维和行动', cond:s => !!s.flags.peace },
  { id:'md_border', name:'戍边纪念章', cat:'战功', tier:'silver',
    desc:'主动申请艰苦地区代职', cond:s => !!s.flags.tough_area },
  { id:'md_cyber', name:'无形战线纪念章', cat:'战功', tier:'silver',
    desc:'完成网络攻防演练', cond:s => !!s.flags.cyber },
  { id:'md_grand_deed', name:'重大功勋章', cat:'战功', tier:'gold',
    desc:'集齐五种重大功勋', cond:s => greatDeeds(s) >= 5 },
  { id:'md_soldier_save', name:'生命线纪念章', cat:'战功', tier:'silver',
    desc:'成功挽救一名战士', cond:s => !!s.flags.saved_soldier },
  { id:'md_village', name:'堤坝上的命令章', cat:'战功', tier:'bronze',
    desc:'危急关头选择先救群众', cond:s => !!s.flags.saved_village },

  /* ---- 品格 ---- */
  { id:'md_clean', name:'清风章', cat:'品格', tier:'gold',
    desc:'当面退回不该收的东西', cond:s => !!s.flags.clean },
  { id:'md_iron_disc', name:'铁纪章', cat:'品格', tier:'gold',
    desc:'退役时作风纪律达到优秀', cond:s => s.dv.discipline >= 88 },
  { id:'md_blame', name:'担当章', cat:'品格', tier:'silver',
    desc:'替部属承担责任', cond:s => !!s.flags.took_blame },
  { id:'md_gave', name:'让功章', cat:'品格', tier:'silver',
    desc:'把立功名额让给同志', cond:s => !!s.flags.gave_merit || !!s.flags.gave_up || !!s.flags.gave_slot },
  { id:'md_review', name:'考评优秀章', cat:'品格', tier:'silver',
    desc:'任期考评获得「优秀」3 次', cond:s => (s.flags.achReviewBest || 0) >= 3 },
  { id:'md_family', name:'家风章', cat:'品格', tier:'bronze',
    desc:'退役时家庭关系和睦', cond:s => s.st.family >= 70 },

  /* ---- 成长 ---- */
  { id:'md_general', name:'将星章', cat:'成长', tier:'gold',
    desc:'晋升至少将', cond:s => s.rankIdx >= 16 },
  { id:'md_cmd_post', name:'主官章', cat:'成长', tier:'gold',
    desc:'担任团长及以上军事主官', cond:s => {
      const p = POSITION_MAP[s.positionId] || {};
      return p.type === 'line' && p.level >= 9;
    } },
  { id:'md_pol_post', name:'铸魂岗位章', cat:'成长', tier:'silver',
    desc:'担任营教导员及以上政工主官', cond:s => {
      const p = POSITION_MAP[s.positionId] || {};
      return p.type === 'pol' && p.level >= 7;
    } },
  { id:'md_stf_post', name:'机关柱石章', cat:'成长', tier:'silver',
    desc:'担任处长及以上参谋机关职务', cond:s => {
      const p = POSITION_MAP[s.positionId] || {};
      return p.type === 'stf' && p.level >= 8;
    } },
  { id:'md_top_post', name:'统帅机关章', cat:'成长', tier:'gold',
    desc:'担任路线最高机关主要领导（虚构岗位）', cond:s => {
      const p = POSITION_MAP[s.positionId] || {};
      return (p.level || 0) >= 14;
    } },
  { id:'md_qjts', name:'强军统帅章', cat:'传承', tier:'gold',
    desc:'达成最高虚构结局「强军统帅」', cond:s => !!(s.ending && s.ending.id === 'e_qjts') },
  { id:'md_marshal', name:'上将章', cat:'成长', tier:'gold',
    desc:'晋升至上将', cond:s => s.rankIdx >= 18 },
  { id:'md_field', name:'校官章', cat:'成长', tier:'silver',
    desc:'晋升至少校', cond:s => s.rankIdx >= 12 },
  { id:'md_officer', name:'尉官章', cat:'成长', tier:'bronze',
    desc:'晋升至少尉', cond:s => s.rankIdx >= 9 },
  { id:'md_skill_s', name:'精武章', cat:'成长', tier:'gold',
    desc:'两项以上技能练到 S 级', cond:s => Object.keys(s.skills || {}).filter(k => s.skills[k] >= 6).length >= 2 },
  { id:'md_attr_max', name:'登峰章', cat:'成长', tier:'gold',
    desc:'任意一项属性达到上限', cond:s => ATTRS.some(a => s.attr[a.key] >= 110) },
  { id:'md_rank1', name:'尖兵章', cat:'成长', tier:'silver',
    desc:'生涯某阶段同期排名第一', cond:s => !!s.flags.everRank1 },
  { id:'md_full', name:'服役纪念章', cat:'成长', tier:'bronze',
    desc:'服役满 50 年', cond:s => s.serviceYear >= 50 },
  { id:'md_honor', name:'荣誉称号章', cat:'成长', tier:'gold',
    desc:'获得荣誉称号', cond:s => !!s.flags.honor_title },
  { id:'md_reform', name:'改革先锋章', cat:'成长', tier:'silver',
    desc:'推动训练改革并落地', cond:s => !!s.flags.reform },

  /* ---- 传承 ---- */
  { id:'md_heir3', name:'桃李章', cat:'传承', tier:'gold',
    desc:'培养出 3 名接班人', cond:s => (s.heir || 0) >= 3 },
  { id:'md_heir1', name:'带兵章', cat:'传承', tier:'bronze',
    desc:'至少培养 1 名接班人', cond:s => (s.heir || 0) >= 1 },
  { id:'md_legacy', name:'传承章', cat:'传承', tier:'silver',
    desc:'以二周目身份开始新的生涯', cond:s => !!s.legacy },
  { id:'md_child', name:'家国章', cat:'传承', tier:'bronze',
    desc:'支持子女投身军旅', cond:s => !!s.flags.child_military },
  { id:'md_married', name:'成家章', cat:'传承', tier:'bronze',
    desc:'在军旅中组建家庭', cond:s => !!(s.familyInfo && s.familyInfo.married) },
  { id:'md_ally', name:'袍泽章', cat:'品格', tier:'silver',
    desc:'与同期军官结成同盟', cond:s => !!s.allyId },
  { id:'md_unit_honor', name:'集体功章', cat:'战功', tier:'silver',
    desc:'所带单位荣立集体功', cond:s => !!s.flags.unit_honor },
  { id:'md_route_cmd', name:'指挥传承章', cat:'传承', tier:'silver',
    desc:'走完军事指挥线', cond:s => s.route === 'command' },
  { id:'md_route_pol', name:'政工传承章', cat:'传承', tier:'silver',
    desc:'走完政治工作线', cond:s => s.route === 'political' },
  { id:'md_route_stf', name:'参谋传承章', cat:'传承', tier:'silver',
    desc:'走完参谋后装线', cond:s => s.route === 'staff' }
];

/* ---------- 难度 ---------- */
const DIFFICULTIES = {
  normal: {
    key:'normal', name:'标准',
    desc:'正常节奏，适合第一次完整体验。',
    rivalMul:1, needMul:1, riskAdd:0, healthDecay:1, discDecay:1, taskMerit:1
  },
  hard: {
    key:'hard', name:'艰难',
    desc:'同期更卷、门槛更高、任务更险，负伤与失分更常见。',
    rivalMul:1.22, needMul:1.12, riskAdd:0.04, healthDecay:1.35, discDecay:1.25, taskMerit:0.92
  },
  hell: {
    key:'hell', name:'淬火',
    desc:'近乎苛刻的环境：晋升极难，任务风险陡增，连败会招致更大危机。',
    rivalMul:1.42, needMul:1.28, riskAdd:0.07, healthDecay:1.7, discDecay:1.5, taskMerit:0.85,
    failStreakRisk: true, autoBlunder: 0.10
  }
};

/* ---------- 时代（按服役年份） ---------- */
const ERAS = [
  { id:'era80', from:1,  to:12, name:'八十年代',
    desc:'编制调整、正规化起步，比武竞赛和条令学习是主旋律。',
    tag:'正规化' },
  { id:'era90', from:13, to:24, name:'九十年代',
    desc:'科技大练兵，机械化与信息化开始进入视野。',
    tag:'科技练兵' },
  { id:'era00', from:25, to:36, name:'新世纪初',
    desc:'联合演训与非战争军事行动增多，军地协同要求更高。',
    tag:'联合转型' },
  { id:'era10', from:37, to:45, name:'深化改革期',
    desc:'编制重塑、实战化训练，改革与转型成为关键词。',
    tag:'实战化' },
  { id:'era20', from:46, to:52, name:'强军新时代',
    desc:'体系作战、人才培养与传承并重，将星之路进入收官。',
    tag:'强军' }
];

function eraForYear(y) {
  for (let i = 0; i < ERAS.length; i++) {
    if (y >= ERAS[i].from && y <= ERAS[i].to) return ERAS[i];
  }
  return ERAS[ERAS.length - 1];
}

/* ---------- 部队编制（随阶段扩编） ---------- */
const UNIT_TIERS = [
  { stage:'recruit', name:'新兵连',   size:1 },
  { stage:'nco',     name:'步兵班',   size:2 },
  { stage:'officer', name:'步兵排',   size:3 },
  { stage:'field',   name:'合成连',   size:4 },
  { stage:'general', name:'合成营',   size:5 },
  { stage:'marshal', name:'合成旅',   size:6 },
  { stage:'legacy',  name:'荣誉单位', size:7 }
];

/* ---------- 军队职务（与军衔并行） ----------
   军衔是等级，职务是岗位。同级军衔可任不同职务；
   职务随阶段、路线与实绩任命，影响功勋系数、单位规模与可用行动。 */
const POSITION_TYPES = {
  line: { key:'line', name:'军事指挥', color:'#8a4a2a' },
  pol:  { key:'pol',  name:'政治工作', color:'#8a2a4a' },
  stf:  { key:'stf',  name:'参谋机关', color:'#2a4a8a' },
  nco:  { key:'nco',  name:'军士骨干', color:'#3A5636' }
};

const POSITIONS = [
  /* 军士 / 士兵 */
  { id:'p_soldier', name:'战士',     type:'nco', level:0,  minRank:0, maxRank:1,  minStage:0, meritMul:1.00, unitSize:1 },
  { id:'p_bonban',  name:'副班长',   type:'nco', level:1,  minRank:0, maxRank:3,  minStage:0, meritMul:1.04, unitSize:1 },
  { id:'p_banzhang',name:'班长',     type:'nco', level:2,  minRank:1, maxRank:5,  minStage:1, meritMul:1.08, unitSize:2 },
  { id:'p_paiZhang',name:'排长',     type:'nco', level:3,  minRank:3, maxRank:8,  minStage:1, meritMul:1.12, unitSize:3 },

  /* 军事指挥线 */
  { id:'p_fuLian',  name:'副连长',   type:'line', level:4, minRank:9,  maxRank:11, minStage:2, meritMul:1.14, unitSize:3, route:'command' },
  { id:'p_lianZhang',name:'连长',    type:'line', level:5, minRank:10, maxRank:13, minStage:2, meritMul:1.18, unitSize:4, route:'command' },
  { id:'p_fuYing',  name:'副营长',   type:'line', level:6, minRank:12, maxRank:14, minStage:3, meritMul:1.20, unitSize:4, route:'command' },
  { id:'p_yingZhang',name:'营长',    type:'line', level:7, minRank:13, maxRank:15, minStage:3, meritMul:1.24, unitSize:5, route:'command' },
  { id:'p_fuTuan',  name:'副团长',   type:'line', level:8, minRank:14, maxRank:16, minStage:3, meritMul:1.26, unitSize:5, route:'command' },
  { id:'p_tuanZhang',name:'团长',    type:'line', level:9, minRank:15, maxRank:17, minStage:4, meritMul:1.30, unitSize:6, route:'command' },
  { id:'p_lvZhang', name:'旅长',     type:'line', level:10,minRank:16, maxRank:18, minStage:4, meritMul:1.34, unitSize:6, route:'command' },
  { id:'p_shiZhang',name:'师长',     type:'line', level:11,minRank:16, maxRank:18, minStage:4, meritMul:1.36, unitSize:7, route:'command' },
  { id:'p_junZhang',name:'军长',     type:'line', level:12,minRank:17, maxRank:19, minStage:5, meritMul:1.40, unitSize:7, route:'command' },
  { id:'p_zhanqu',  name:'战区副职', type:'line', level:13,minRank:18, maxRank:19, minStage:5, meritMul:1.36, unitSize:7, route:'command' },
  { id:'p_zhihuiTop',name:'联合指挥机构主要领导', type:'line', level:14, minRank:19, maxRank:19, minStage:5, meritMul:1.40, unitSize:7, route:'command' },

  /* 政治工作线 */
  { id:'p_fuBanZhi',name:'副班长（政工）', type:'pol', level:2, minRank:1, maxRank:4,  minStage:0, meritMul:1.05, unitSize:1 },
  { id:'p_zhiDaoYuan',name:'连指导员', type:'pol', level:5, minRank:9,  maxRank:12, minStage:2, meritMul:1.16, unitSize:3, route:'political' },
  { id:'p_jiaoDaoYuan',name:'营教导员', type:'pol', level:7, minRank:12, maxRank:15, minStage:3, meritMul:1.22, unitSize:4, route:'political' },
  { id:'p_tuanZhengWei',name:'团政委', type:'pol', level:9, minRank:14, maxRank:17, minStage:3, meritMul:1.28, unitSize:5, route:'political' },
  { id:'p_lvZhengWei',name:'旅政委',  type:'pol', level:10,minRank:16, maxRank:18, minStage:4, meritMul:1.32, unitSize:6, route:'political' },
  { id:'p_shiZhengWei',name:'师政委', type:'pol', level:11,minRank:16, maxRank:18, minStage:4, meritMul:1.35, unitSize:6, route:'political' },
  { id:'p_junZhengWei',name:'军政委', type:'pol', level:12,minRank:17, maxRank:19, minStage:5, meritMul:1.40, unitSize:7, route:'political' },
  { id:'p_zhengzhiBu',name:'政治工作部领导', type:'pol', level:13, minRank:18, maxRank:19, minStage:5, meritMul:1.36, unitSize:7, route:'political' },
  { id:'p_zhengTop',name:'政治工作最高机关领导', type:'pol', level:14, minRank:19, maxRank:19, minStage:5, meritMul:1.40, unitSize:7, route:'political' },

  /* 参谋机关线 */
  { id:'p_canmou',  name:'参谋',     type:'stf', level:4, minRank:9,  maxRank:12, minStage:2, meritMul:1.14, unitSize:2, route:'staff' },
  { id:'p_fuKeZhang',name:'副科长',  type:'stf', level:5, minRank:10, maxRank:13, minStage:2, meritMul:1.18, unitSize:2, route:'staff' },
  { id:'p_keZhang', name:'科长',     type:'stf', level:6, minRank:12, maxRank:14, minStage:3, meritMul:1.22, unitSize:3, route:'staff' },
  { id:'p_fuChuZhang',name:'副处长', type:'stf', level:7, minRank:13, maxRank:15, minStage:3, meritMul:1.25, unitSize:3, route:'staff' },
  { id:'p_chuZhang',name:'处长',     type:'stf', level:8, minRank:14, maxRank:16, minStage:3, meritMul:1.28, unitSize:4, route:'staff' },
  { id:'p_fuBuZhang',name:'副部长',  type:'stf', level:9, minRank:15, maxRank:17, minStage:4, meritMul:1.32, unitSize:4, route:'staff' },
  { id:'p_buZhang', name:'部长',     type:'stf', level:10,minRank:16, maxRank:18, minStage:4, meritMul:1.36, unitSize:5, route:'staff' },
  { id:'p_canZhang',name:'参谋部领导', type:'stf', level:12, minRank:17, maxRank:19, minStage:5, meritMul:1.36, unitSize:6, route:'staff' },
  { id:'p_zhanlueTop',name:'战略筹划机关主要领导', type:'stf', level:14, minRank:19, maxRank:19, minStage:5, meritMul:1.40, unitSize:7, route:'staff' }
];

const POSITION_MAP = {};
POSITIONS.forEach(p => { POSITION_MAP[p.id] = p; });

const UNIT_NAME_POOL = [
  '大功三连','硬骨头六连','钢铁四连','猛虎连','尖刀连','红一连',
  '老虎团','铁军营','先锋营','英雄营','老虎连','模范连'
];

/* ---------- 家训（二周目继承，从父辈生涯中提炼） ---------- */
const MOTTOS = [
  { id:'m_martyr',   name:'满门忠烈', desc:'家族有人为国捐躯 · 全体属性 +3',
    cond: p => p.flags && p.flags.martyr, mods:{ all:3 } },
  { id:'m_general',  name:'将门虎子', desc:'父辈官至将官 · 初始功勋 +800、威望 +8',
    cond: p => p.rankIdx >= 16, merit:800, st:{ prestige:8 } },
  { id:'m_cmd',      name:'铁血家风', desc:'父辈走军事指挥线 · 体魄 +5、统率 +5',
    cond: p => p.route === 'command', mods:{ tibo:5, tongshuai:5 } },
  { id:'m_pol',      name:'铸魂家风', desc:'父辈走政治工作线 · 信念 +5、魅力 +5',
    cond: p => p.route === 'political', mods:{ xinnian:5, meili:5 } },
  { id:'m_stf',      name:'谋略家风', desc:'父辈走参谋后装线 · 智谋 +5、意志 +5',
    cond: p => p.route === 'staff', mods:{ zhimou:5, yizhi:5 } },
  { id:'m_border',   name:'戍边家风', desc:'父辈守过边关 · 意志 +6、健康 +8',
    cond: p => p.flags && p.flags.tough_area, mods:{ yizhi:6 }, st:{ health:8 } },
  { id:'m_clean',    name:'清廉家风', desc:'父辈作风纪律优秀 · 初始纪律 +12',
    cond: p => p.disc >= 88, disc:12 },
  { id:'m_heir',     name:'桃李家风', desc:'父辈桃李满园 · 培养接班人成功率大幅提升',
    cond: p => (p.heir || 0) >= 3, heirBonus:true },
  { id:'m_none',     name:'白手起家', desc:'不继承任何东西 · 可自由分配点数 +6',
    cond: () => true, alloc:6 }
];

/* ---------- 二周目专属事件 ---------- */
const LEGACY_EVENTS = [
  { id:'ev_legacy_old', title:'父亲的旧部', min:0, max:6, weight:16, once:true, legacyOnly:true,
    text:'一位头发花白的老军官在营门口等你。他说，他当年是{prename}手下的兵。',
    options:[
      { label:'请他进来，好好听他说说',   hint:'信念 +5 · 威望 +4 · 士气 +5',
        fx:{ attr:{ xinnian:5 }, st:{ prestige:4, morale:5 } } },
      { label:'只寒暄几句，不深谈',       hint:'威望 +2 · 纪律 +3',
        fx:{ st:{ prestige:2 }, dv:{ discipline:3 } } },
      { label:'请他给年轻干部讲一堂课',   hint:'政治素养 +5 · 士气 +6',
        fx:{ dv:{ political:5 }, st:{ morale:6 } } }
    ] },
  { id:'ev_legacy_shadow', title:'父辈的影子', min:2, max:6, weight:14, once:true, legacyOnly:true,
    text:'有人在背后议论：他能走到今天，靠的是{prename}的名声。',
    options:[
      { label:'不辩解，用实绩说话',       hint:'信念 +4 · 功勋 +400',
        fx:{ attr:{ xinnian:4 }, merit:400 } },
      { label:'当面把话说清楚',           hint:'威望 +5 · 首长信任 −3',
        fx:{ st:{ prestige:5, trust:-3 } } },
      { label:'主动申请去最苦的地方',     hint:'意志 +5 · 功勋 +600 · 健康 −5',
        fx:{ attr:{ yizhi:5 }, merit:600, st:{ health:-5 } }, flag:'tough_area' }
    ] },
  { id:'ev_legacy_visit', title:'父辈老部下来访', min:3, max:6, weight:10, once:true, legacyOnly:true,
    text:'{prename}当年带过的几个兵，如今也都是主官了。他们约你吃饭，席间说起很多旧事。',
    options:[
      { label:'认真听，记下带兵心得',     hint:'统率 +4 · 政治素养 +3',
        fx:{ attr:{ tongshuai:4 }, dv:{ political:3 } } },
      { label:'请他们帮你带一带新干部',   hint:'培养接班人机会 · 威望 +3',
        fx:{ heir:1, st:{ prestige:3 } } },
      { label:'只叙旧，不谈工作',         hint:'家庭 +3 · 士气 +4',
        fx:{ st:{ family:3, morale:4 } } }
    ] }
];

/* ============================================================
   事件链：把独立事件串成多步剧情线
   选项里的 chain:{ id, delay } 会在 delay 个回合后触发后续事件，
   每一步的选择决定下一步的走向。
   ============================================================ */
const CHAIN_EVENTS = [
  /* ---------- 链一：改革风波（提出 → 受挫 → 结果） ---------- */
  { id:'ev_ch_reform1', title:'一个想法', min:3, max:5, weight:12, once:true,
    text:'这几年训练里的问题，你心里一直有本账。最近，你萌生了一个改法的念头。',
    options:[
      { label:'写成方案，正式上报',   hint:'功勋 +300 · 后续取决于方案能否通过',
        fx:{ merit:300 }, chain:{ id:'ev_ch_reform2', delay:2 } },
      { label:'先在自己单位悄悄试',   hint:'专业能力 +4 · 稳妥但成果有限',
        fx:{ dv:{ professional:4 } }, chain:{ id:'ev_ch_reform2', delay:3 } },
      { label:'想法不错，但现在不是时候', hint:'纪律 +3 · 放弃这次机会',
        fx:{ dv:{ discipline:3 } } }
    ] },
  { id:'ev_ch_reform2', title:'方案受挫', min:3, max:6, weight:0, once:true, chained:true,
    text:'方案摆到了会上。几位老同志当场提出质疑，认为这是标新立异、丢了传统。',
    options:[
      { label:'坚持推进，用数据说话',   hint:'功勋 +400 · 风险不小',
        fx:{ merit:400 }, chain:{ id:'ev_ch_reform3', delay:2 } },
      { label:'修改方案，先争取多数',   hint:'政治素养 +5 · 更稳',
        fx:{ dv:{ political:5 } }, chain:{ id:'ev_ch_reform3b', delay:2 } },
      { label:'撤回方案',               hint:'纪律 +4 · 威望 −3 · 事情到此为止',
        fx:{ dv:{ discipline:4 }, st:{ prestige:-3 } } }
    ] },
  { id:'ev_ch_reform3', title:'试点结果', min:3, max:6, weight:0, once:true, chained:true,
    text:'一年后，试点单位的数据出来了：训练成绩提升近两成，伤病率反而下降。',
    options:[
      { label:'上报推广，全面铺开',     hint:'功勋 +1500 · 威望 +6',
        fx:{ merit:1500, st:{ prestige:6 } }, flag:'reform' },
      { label:'先总结成经验材料',       hint:'专业能力 +6 · 功勋 +800',
        fx:{ dv:{ professional:6 }, merit:800 }, flag:'reform' }
    ] },
  { id:'ev_ch_reform3b', title:'折中的结果', min:3, max:6, weight:0, once:true, chained:true,
    text:'修改后的方案通过了，但只保留了原方案的一部分。有人说你太软，也有人说你懂得分寸。',
    options:[
      { label:'先做起来，以后再完善',   hint:'功勋 +700 · 专业能力 +4',
        fx:{ merit:700, dv:{ professional:4 } } },
      { label:'不甘心，继续争取',       hint:'功勋 +500 · 威望 −2',
        fx:{ merit:500, st:{ prestige:-2 } } }
    ] },

  /* ---------- 链二：高原两年（申请 → 艰苦 → 归来） ---------- */
  { id:'ev_ch_plateau1', title:'高原的召唤', min:2, max:3, weight:12, once:true,
    text:'上级要抽调干部去高原边防代职两年。条件艰苦，但那里最缺人。',
    options:[
      { label:'主动报名',               hint:'信念 +4 · 履历上会多一笔硬的',
        fx:{ attr:{ xinnian:4 } }, flag:'tough_area', chain:{ id:'ev_ch_plateau2', delay:2 } },
      { label:'服从组织安排',           hint:'纪律 +3',
        fx:{ dv:{ discipline:3 } }, chain:{ id:'ev_ch_plateau2', delay:3 } },
      { label:'以家庭困难为由申请留任', hint:'家庭 +4 · 首长信任 −4',
        fx:{ st:{ family:4, trust:-4 } } }
    ] },
  { id:'ev_ch_plateau2', title:'高原之上', min:2, max:6, weight:0, once:true, chained:true,
    text:'海拔四千七百米。夜里睡不着，白天走几步就喘。妻子在电话里哭了两次。',
    options:[
      { label:'咬牙撑住',               hint:'意志 +6 · 健康 −8',
        fx:{ attr:{ yizhi:6 }, st:{ health:-8 } }, chain:{ id:'ev_ch_plateau3', delay:2 } },
      { label:'把家人接上来住一段',     hint:'家庭 +6 · 健康 −4',
        fx:{ st:{ family:6, health:-4 } }, chain:{ id:'ev_ch_plateau3', delay:2 } },
      { label:'申请提前调回',           hint:'家庭 +5 · 首长信任 −3',
        fx:{ st:{ family:5, trust:-3 } }, chain:{ id:'ev_ch_plateau3b', delay:2 } }
    ] },
  { id:'ev_ch_plateau3', title:'归来', min:2, max:6, weight:0, once:true, chained:true,
    text:'两年期满，你回到原来的单位。履历上多了一行，身体上少了一些东西。',
    options:[
      { label:'把高原的经验带回来',     hint:'军事素养 +6 · 功勋 +800',
        fx:{ dv:{ military:6 }, merit:800 } },
      { label:'低调归队，从头做起',     hint:'威望 +4 · 纪律 +4 · 功勋 +400',
        fx:{ st:{ prestige:4 }, dv:{ discipline:4 }, merit:400 } }
    ] },
  { id:'ev_ch_plateau3b', title:'提前归来', min:2, max:6, weight:0, once:true, chained:true,
    text:'你提前回到了平原。有人在背后说，你吃不了那个苦。',
    options:[
      { label:'不解释，随他们说',       hint:'信念 −3 · 意志 +3',
        fx:{ attr:{ xinnian:-3, yizhi:3 } } },
      { label:'主动申请更重的任务',     hint:'功勋 +600 · 健康 −5',
        fx:{ merit:600, st:{ health:-5 } } }
    ] },

  /* ---------- 链三：部属成长（发现 → 他长大了） ---------- */
  { id:'ev_ch_sub1', title:'一个好苗子', min:1, max:4, weight:13, once:true,
    text:'你注意到一个年轻排长。他话不多，但每次任务都想得比别人深一层。',
    options:[
      { label:'重点培养，压担子',       hint:'他会记住这份知遇',
        fx:{}, chain:{ id:'ev_ch_sub2', delay:3 } },
      { label:'先观察一段时间再说',     hint:'稳妥',
        fx:{}, chain:{ id:'ev_ch_sub2', delay:4 } },
      { label:'顺其自然，看他自己的造化', hint:'不投入，也不期待',
        fx:{}, chain:{ id:'ev_ch_sub2b', delay:3 } }
    ] },
  { id:'ev_ch_sub2', title:'他长大了', min:1, max:6, weight:0, once:true, chained:true,
    text:'那位年轻排长在全师比武中拿了第一。表彰大会上，他第一个感谢的是你。',
    options:[
      { label:'把功劳全推给他',         hint:'威望 +6 · 士气 +5',
        fx:{ st:{ prestige:6, morale:5 } }, heir:1 },
      { label:'借机为他要一个更好的岗位', hint:'首长信任 +4',
        fx:{ st:{ trust:4 } }, heir:1 },
      { label:'私下提醒他不要飘',       hint:'政治素养 +5 · 士气 +3',
        fx:{ dv:{ political:5 }, st:{ morale:3 } }, heir:1 }
    ] },
  { id:'ev_ch_sub2b', title:'各自的路', min:1, max:6, weight:0, once:true, chained:true,
    text:'那个年轻排长后来调走了，去了别的单位。听说干得不错。',
    options:[
      { label:'托人带句话，祝他顺利',   hint:'士气 +3 · 信念 +2',
        fx:{ st:{ morale:3 }, attr:{ xinnian:2 } } },
      { label:'心里有点遗憾',           hint:'信念 +2',
        fx:{ attr:{ xinnian:2 } } }
    ] },

  /* ---------- 链四：家庭（孩子的来信 → 多年以后） ---------- */
  { id:'ev_ch_family1', title:'孩子的来信', min:2, max:4, weight:12, once:true,
    text:'孩子给你写了一封信。信上说，同学问他爸爸是干什么的，他不知道该怎么回答。',
    options:[
      { label:'请一次假，回家好好陪他', hint:'家庭 +8 · 功勋 −300',
        fx:{ st:{ family:8 }, merit:-300 } },
      { label:'写信回去，认真跟他讲',   hint:'家庭 +5 · 信念 +3',
        fx:{ st:{ family:5 }, attr:{ xinnian:3 } }, chain:{ id:'ev_ch_family2', delay:3 } },
      { label:'把信收进抽屉，继续忙',   hint:'家庭 −5 · 功勋 +200',
        fx:{ st:{ family:-5 }, merit:200 } }
    ] },
  { id:'ev_ch_family2', title:'多年以后', min:2, max:6, weight:0, once:true, chained:true,
    text:'孩子高考填志愿那天给你打了个电话。他说，他想报军校。',
    options:[
      { label:'支持他，把路指给他',     hint:'家庭 +6 · 信念 +4',
        fx:{ st:{ family:6 }, attr:{ xinnian:4 } }, heir:1 },
      { label:'让他自己想清楚',         hint:'家庭 +4 · 威望 +2',
        fx:{ st:{ family:4, prestige:2 } } },
      { label:'劝他别走这条路',         hint:'家庭 +2 · 信念 −4',
        fx:{ st:{ family:2 }, attr:{ xinnian:-4 } } }
    ] },

  /* ---------- 链：审查风波 ---------- */
  { id:'ev_ch_audit1', title:'谈话函询', min:3, max:5, weight:13, once:true,
    text:'纪检部门约你谈话，核实一封匿名信里的几条线索。事情不大，但很敏感。',
    options:[
      { label:'如实说明全部情况',           hint:'纪律 +5 · 首长信任 +3',
        fx:{ dv:{ discipline:5 }, st:{ trust:3 } }, chain:{ id:'ev_ch_audit2', delay:2 } },
      { label:'只说自己清楚的部分',         hint:'纪律 +2 · 有隐患',
        fx:{ dv:{ discipline:2 } },
        hidden:{ chance:0.4, note:'后续核查发现表述不完整', st:{ trust:-4 } },
        chain:{ id:'ev_ch_audit2b', delay:3 } },
      { label:'请组织全面核查',             hint:'纪律 +4 · 威望 +2',
        fx:{ dv:{ discipline:4 }, st:{ prestige:2 } }, chain:{ id:'ev_ch_audit2', delay:2 } }
    ] },
  { id:'ev_ch_audit2', title:'查清了', min:3, max:6, weight:0, once:true, chained:true,
    text:'核查结论出来了：举报不实。组织在一定范围内做了澄清。',
    options:[
      { label:'请求不扩大影响',             hint:'威望 +3 · 信念 +3',
        fx:{ st:{ prestige:3 }, attr:{ xinnian:3 } } },
      { label:'建议完善相关制度',           hint:'专业能力 +4 · 纪律 +3',
        fx:{ dv:{ professional:4, discipline:3 } }, flag:'reform' }
    ] },
  { id:'ev_ch_audit2b', title:'越描越黑', min:3, max:6, weight:0, once:true, chained:true,
    text:'事情拖了一段时间。虽然没有定性，但议论还在。首长找你又谈了一次。',
    options:[
      { label:'深刻检查，主动整改',         hint:'纪律 +6 · 首长信任 +2 · 威望 −3',
        fx:{ dv:{ discipline:6 }, st:{ trust:2, prestige:-3 } } },
      { label:'申请调离当前岗位避嫌',       hint:'家庭 +3 · 首长信任 −5 · 功勋 −200',
        fx:{ st:{ family:3, trust:-5 }, merit:-200 } }
    ] },

  /* ---------- 链：同盟或宿敌 ---------- */
  { id:'ev_ch_ally1', title:'一次并肩', min:2, max:4, weight:11, once:true,
    text:'联合任务里，你和同期的老对手被编在同一组。配合意外地顺。',
    options:[
      { label:'任务后公开肯定他',           hint:'搭档默契 +5 · 威望 +3 · 可能化敌为友',
        fx:{ st:{ bond:5, prestige:3 } }, flag:'seek_ally' },
      { label:'只谈工作，不谈交情',         hint:'纪律 +2 · 专业能力 +3',
        fx:{ dv:{ discipline:2, professional:3 } } },
      { label:'借机压他一头',               hint:'功勋 +250 · 宿敌值上升',
        fx:{ merit:250 }, flag:'seek_nemesis' }
    ] }
];

/* ============================================================
   具名 NPC 关系网
   把"首长信任""搭档默契"这些抽象数字变成有名字、有性格、有独立履历的人。
   ============================================================ */

const NPC_SURNAMES = ['周','李','孙','陈','王','刘','赵','杨','黄','吴','徐','郑','马','林','高','谢','何','罗','秦','曹'];
const NPC_GIVEN = ['建国','卫东','志强','立新','振华','铁军','明远','海涛','志刚','晓峰','国栋','云飞','长胜','向阳','建军','文斌','守成','大鹏','立国','永强'];

/* ---------- 家庭线 ---------- */
const SPOUSE_SURNAMES = ['林','沈','苏','顾','叶','程','宋','许','韩','唐','方','夏'];
const SPOUSE_GIVEN = ['晓雯','静怡','慧敏','雨桐','雅琴','梦瑶','佳宁','若曦','诗涵','安然','清越','书兰'];
const KID_GIVEN_BOY = ['子轩','浩然','俊哲','宇航','子墨','一鸣','博文','承宇'];
const KID_GIVEN_GIRL = ['诗琪','欣怡','语桐','若彤','嘉怡','清菡','雨萱','念安'];

/* ---------- 审查风波 / 家庭 / 同盟宿敌 等链事件已并入 CHAIN_EVENTS ---------- */
const NPC_TAGS = ['沉稳','火爆','细致','圆滑','实干','耿直','机灵','木讷','要强','随和','寡言','爽快'];

const NPC_ROLES = {
  chief:       { name:'首长',  desc:'你的直接上级' },
  partner:     { name:'搭档',  desc:'军政双主官的另一半' },
  comrade:     { name:'战友',  desc:'同单位的同袍' },
  subordinate: { name:'部属',  desc:'你一手带出来的兵' }
};

/* 行动对 NPC 好感度的影响 */
const ACTION_NPC_AFFINITY = {
  network:     { role:'chief',       v: 5 },
  peer:        { role:'comrade',     v: 6 },
  talk:        { role:'subordinate', v: 5 },
  partner:     { role:'partner',     v: 6 },
  lead:        { role:'subordinate', v: 3 },
  build:       { role:'subordinate', v: 2 },
  mentor:      { role:'subordinate', v: 4 },
  unitBuild:   { role:'subordinate', v: 2 },
  r_pol_talk:  { role:'subordinate', v: 6 },
  r_pol_build: { role:'partner',     v: 5 },
  r_cmd_post:  { role:'subordinate', v: 4 },
  r_stf_equip: { role:'chief',       v: 3 }
};

/* NPC 事件模板。cond(s, npc) 决定是否可用；选项可用 npcFx 改变该 NPC 的状态。 */
const NPC_EVENTS = [
  {
    id:'npc_sub_promote', role:'subordinate', weight:12, min:1,
    cond:(s, n) => n.growth >= 78 && !n.graduated,
    title:'{name}提干了',
    text:'你一手带出来的{name}通过了提干考核。他要离开你的班排，去别的连队当排长了。',
    options:[
      { label:'为他高兴，亲自送他一程', hint:'威望 +5 · 士气 +5 · 功勋 +300',
        fx:{ st:{ prestige:5, morale:5 }, merit:300 }, npcFx:{ affinity:10 } },
      { label:'提醒他别忘了本',         hint:'政治素养 +4 · 士气 +3',
        fx:{ dv:{ political:4 }, st:{ morale:3 } }, npcFx:{ affinity:5 } },
      { label:'有点舍不得，但什么也没说', hint:'士气 +2 · 搭档默契 +2',
        fx:{ st:{ morale:2, bond:2 } }, npcFx:{ affinity:3 } }
    ]
  },
  {
    id:'npc_sub_trouble', role:'subordinate', weight:11, min:1,
    cond:(s, n) => n.growth >= 40,
    title:'{name}出了岔子',
    text:'{name}在一次任务中擅自改变部署，结果打赢了，但违反了命令。上级要追责。',
    options:[
      { label:'替他承担责任',       hint:'威望 +6 · 士气 +5 · 首长信任 −5',
        fx:{ st:{ prestige:6, morale:5, trust:-5 } }, flag:'took_blame', npcFx:{ affinity:15 } },
      { label:'如实上报，功过分明', hint:'纪律 +5 · 首长信任 +4 · 士气 −4',
        fx:{ dv:{ discipline:5 }, st:{ trust:4, morale:-4 } }, npcFx:{ affinity:-8 } },
      { label:'先内部批评，再为他请功', hint:'威望 +4 · 搭档默契 +3',
        fx:{ st:{ prestige:4, bond:3 }, dv:{ political:2 } }, npcFx:{ affinity:8 } }
    ]
  },
  {
    id:'npc_comrade_leave', role:'comrade', weight:11, min:2,
    cond:(s, n) => s.year >= 8,
    title:'{name}要转业了',
    text:'一起摸爬滚打多年的{name}递交了转业申请。他家里的情况你也知道，实在撑不下去了。',
    options:[
      { label:'想办法帮他解决困难',   hint:'士气 +5 · 威望 +3 · 功勋 −200',
        fx:{ st:{ morale:5, prestige:3 }, merit:-200 }, npcFx:{ affinity:15 } },
      { label:'尊重他的选择，好聚好散', hint:'士气 +3 · 政治素养 +3',
        fx:{ st:{ morale:3 }, dv:{ political:3 } }, npcFx:{ affinity:8 } },
      { label:'劝他再坚持几年',       hint:'士气 +1 · 搭档默契 +3',
        fx:{ st:{ morale:1, bond:3 } }, npcFx:{ affinity:-5 } }
    ]
  },
  {
    id:'npc_comrade_merit', role:'comrade', weight:10, min:1,
    cond:(s, n) => n.affinity >= 55,
    title:'{name}立功了',
    text:'{name}在这次任务中立了二等功。表彰大会上，他说这个功有一半是你的。',
    options:[
      { label:'把功劳全推给他',     hint:'威望 +5 · 士气 +5',
        fx:{ st:{ prestige:5, morale:5 } }, npcFx:{ affinity:12 } },
      { label:'如实说明是共同完成的', hint:'功勋 +400 · 搭档默契 +3',
        fx:{ merit:400, st:{ bond:3 } }, npcFx:{ affinity:5 } }
    ]
  },
  {
    id:'npc_partner_clash', role:'partner', weight:11, min:2,
    cond:() => true,
    title:'和{name}的分歧',
    text:'军事训练和政治教育的时间撞了。{name}坚持先上政治课，你认为训练一天都不能停。',
    options:[
      { label:'坚持己见，训练优先',   hint:'军事素养 +4 · 搭档默契 −5',
        fx:{ dv:{ military:4 } }, npcFx:{ affinity:-10 } },
      { label:'各退一步，调整计划',   hint:'搭档默契 +5 · 政治素养 +3',
        fx:{ dv:{ political:3 }, st:{ bond:5 } }, npcFx:{ affinity:12 } },
      { label:'请示上级裁定',         hint:'纪律 +3 · 首长信任 +2 · 搭档默契 −2',
        fx:{ dv:{ discipline:3 }, st:{ trust:2, bond:-2 } }, npcFx:{ affinity:-4 } }
    ]
  },
  {
    id:'npc_partner_rise', role:'partner', weight:10, min:4,
    cond:(s, n) => n.affinity >= 60,
    title:'{name}要高升了',
    text:'{name}要被调去上级机关任职。临走前他问你，愿不愿意一起走。',
    options:[
      { label:'留在基层，各走各路',   hint:'军事素养 +5 · 威望 +4',
        fx:{ dv:{ military:5 }, st:{ prestige:4 } }, npcFx:{ affinity:6 } },
      { label:'跟他一起去机关',       hint:'专业能力 +5 · 首长信任 +4 · 威望 −2',
        fx:{ dv:{ professional:5 }, st:{ trust:4, prestige:-2 } }, flag:'staff_exp', npcFx:{ affinity:14 } },
      { label:'请他帮忙在上级说话',   hint:'首长信任 +6 · 威望 −3',
        fx:{ st:{ trust:6, prestige:-3 } }, npcFx:{ affinity:-6 } }
    ]
  },
  {
    id:'npc_chief_transfer', role:'chief', weight:11, min:3,
    cond:(s, n) => s.year >= 15,
    title:'{name}要调走了',
    text:'一手把你带起来的{name}要调去别的单位了。临走前，他把你叫到办公室谈了很久。',
    options:[
      { label:'请他指点未来的路',     hint:'智谋 +4 · 首长信任 +6',
        fx:{ attr:{ zhimou:4 }, st:{ trust:6 } }, npcFx:{ affinity:12 } },
      { label:'请他为你的下一步说话', hint:'首长信任 +8 · 威望 −3',
        fx:{ st:{ trust:8, prestige:-3 } }, flag:'asked_favor', npcFx:{ affinity:4 } },
      { label:'只谈感情，不提要求',   hint:'信念 +4 · 威望 +4',
        fx:{ attr:{ xinnian:4 }, st:{ prestige:4 } }, npcFx:{ affinity:16 } }
    ]
  },
  {
    id:'npc_chief_call', role:'chief', weight:10, min:2,
    cond:(s, n) => n.affinity >= 65,
    title:'{name}点将',
    text:'{name}把你叫去，说有一项重要任务，想让你来挑头。',
    options:[
      { label:'接下任务，全力以赴',   hint:'功勋 +900 · 首长信任 +5 · 健康 −4',
        fx:{ merit:900, st:{ trust:5, health:-4 } }, npcFx:{ affinity:8 } },
      { label:'先问清楚风险和保障',   hint:'专业能力 +4 · 首长信任 +3',
        fx:{ dv:{ professional:4 }, st:{ trust:3 } }, npcFx:{ affinity:4 } },
      { label:'推荐别人去',           hint:'威望 +3 · 士气 +4 · 首长信任 −3',
        fx:{ st:{ prestige:3, morale:4, trust:-3 } }, npcFx:{ affinity:-6 } }
    ]
  }
];
