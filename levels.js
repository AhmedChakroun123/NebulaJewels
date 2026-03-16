/* ═══════════════════════════════════════════════════════════
   NEBULA JEWELS  ·  levels.js
   300 procedurally seeded levels across 15 chapters
═══════════════════════════════════════════════════════════ */
'use strict';

const CHAPTERS = [
  { id:0,  name:'SECTOR ALPHA',    color:'#00e5ff', levels:[1,20]   },
  { id:1,  name:'NOVA BELT',       color:'#c400ff', levels:[21,40]  },
  { id:2,  name:'PULSAR RIDGE',    color:'#ff0070', levels:[41,60]  },
  { id:3,  name:'SOLAR WINDS',     color:'#ffc800', levels:[61,80]  },
  { id:4,  name:'VOID CLUSTER',    color:'#2aff6e', levels:[81,100] },
  { id:5,  name:'INFERNO CORE',    color:'#ff6200', levels:[101,120]},
  { id:6,  name:'CRYO EXPANSE',    color:'#88ccff', levels:[121,140]},
  { id:7,  name:'PLASMA CASCADE',  color:'#ff44dd', levels:[141,160]},
  { id:8,  name:'DARK MATTER',     color:'#9900ff', levels:[161,180]},
  { id:9,  name:'QUASAR GATE',     color:'#ffaa00', levels:[181,200]},
  { id:10, name:'SINGULARITY',     color:'#ff2266', levels:[201,220]},
  { id:11, name:'NEBULA HEART',    color:'#00ffaa', levels:[221,240]},
  { id:12, name:'EVENT HORIZON',   color:'#ff6699', levels:[241,260]},
  { id:13, name:'COSMIC FORGE',    color:'#aaffee', levels:[261,280]},
  { id:14, name:'APEX INFINITY',   color:'#ffffff', levels:[281,300]},
];

// Seeded RNG for deterministic level generation
function seededRng(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function generateLevel(id) {
  const rng = seededRng(id * 7919 + 31337);
  const tier = Math.min(Math.floor((id - 1) / 20), 14);
  const inChapter = ((id - 1) % 20);

  const cols = tier < 3 ? 7 : tier < 7 ? 8 : 9;
  const rows = tier < 3 ? 7 : tier < 7 ? 8 : 9;

  // الحد الأدنى للألوان هو 5 لتجنب الحلول التلقائية
  const numColors = Math.min(5 + Math.floor(tier / 4), 7);

  // 1. كسر الخطية: تحديد نوع المستوى (تصميم التوتر والراحة)
  const isBossLevel = (id % 20 === 0); // نهاية كل شابتر (مستوى 20، 40، 60...)
  const isHardLevel = (id % 5 === 0 && !isBossLevel); // كل 5 مستويات (تحدي مفاجئ)

  // 2. توزيع الحركات بناءً على نوع المستوى وليس فقط التقدم
  // المستويات العادية تعطي حركات مريحة، المستويات الصعبة تخنق اللاعب قليلاً
  let baseMoves = 24 - Math.floor(tier * 0.4);
  if (isHardLevel) baseMoves -= 4; // تقليص الحركات في المستويات الصعبة
  if (isBossLevel) baseMoves -= 6; // خنق حقيقي في مستويات الزعماء

  // المستوى الذي يلي المستوى الصعب يكون سهلاً (مكافأة نفسية)
  if ((id - 1) % 5 === 0 && id !== 1) baseMoves += 3;

  const moves = Math.max(12, Math.round(baseMoves + (rng() - 0.5) * 3));

  // 3. تعديل الأهداف: المستويات الصعبة تطلب نقاطاً أكثر بكثير
  let goalMultiplier = 1.0;
  if (isHardLevel) goalMultiplier = 1.35;
  if (isBossLevel) goalMultiplier = 1.60;

  const baseGoal = (1200 + id * 300 + tier * 500) * goalMultiplier;
  const goal = Math.round(baseGoal * (0.9 + rng() * 0.2));

  // 4. توزيع العوائق (Blockers) بطريقة غير خطية
  let obstacleCount = 0;
  if (tier >= 1) { // نبدأ بإدخال العوائق مبكراً لكن بشكل مدروس
    if (isBossLevel) obstacleCount = Math.floor(4 + rng() * 5); // 4 إلى 8 عوائق
    else if (isHardLevel) obstacleCount = Math.floor(2 + rng() * 4); // 2 إلى 5 عوائق
    else if (rng() > 0.6) obstacleCount = Math.floor(1 + rng() * 2); // عوائق عشوائية خفيفة
  }

  const blockers = [];
  if (obstacleCount > 0) {
    const placed = new Set();
    for (let i = 0; i < obstacleCount; i++) {
      let attempt = 0;
      while (attempt++ < 20) {
        const r = Math.floor(rng() * rows);
        const c = Math.floor(rng() * cols);
        const key = `${r},${c}`;
        if (!placed.has(key)) { placed.add(key); blockers.push({r, c}); break; }
      }
    }
  }

  // التنويع في نوع المهمة لإبعاد الملل
  const objCycle = inChapter % 4;
  let objective;
  if      (id <= 5)    objective = { type:'score', goal };
  else if (objCycle === 0) objective = { type:'score', goal };
  else if (objCycle === 1) objective = { type:'score', goal, bonusMoves: moves + 5 };
  else if (objCycle === 2) objective = { type:'combo', goal, comboTarget: 2 + Math.floor(tier / 4) };
  else                     objective = { type:'score', goal };

  return {
    id, cols, rows, moves, numColors, goal,
    star2: Math.round(goal * 1.5),
    star3: Math.round(goal * 2.2),
    blockers, objective,
    chapterId: Math.min(Math.floor((id - 1) / 20), 14),
  };
}

// Pre-build all 300 levels
const LEVELS = [];
for (let i = 1; i <= 300; i++) {
  LEVELS.push(generateLevel(i));
}

function getLevel(id) {
  return LEVELS[id - 1] || LEVELS[LEVELS.length - 1];
}

function getChapterForLevel(id) {
  return CHAPTERS.find(ch => id >= ch.levels[0] && id <= ch.levels[1]) || CHAPTERS[0];
}
