/* ═══════════════════════════════════════════════════════════
   NEBULA JEWELS  ·  game.js
   Core engine: board, physics, matching, rendering
═══════════════════════════════════════════════════════════ */
'use strict';

// ── GEM DEFINITIONS ───────────────────────────────────────────
const GEM_TYPES = [
  { id:0, color:'#00e5ff', glow:'rgba(0,229,255,0.9)',  name:'Aqua'    },
  { id:1, color:'#c400ff', glow:'rgba(196,0,255,0.9)',  name:'Void'    },
  { id:2, color:'#ff0070', glow:'rgba(255,0,112,0.9)',  name:'Nova'    },
  { id:3, color:'#ffc800', glow:'rgba(255,200,0,0.9)',  name:'Solar'   },
  { id:4, color:'#2aff6e', glow:'rgba(42,255,110,0.9)', name:'Plasma'  },
  { id:5, color:'#ff6200', glow:'rgba(255,98,0,0.9)',   name:'Inferno' },
  { id:6, color:'#ff44dd', glow:'rgba(255,68,221,0.9)', name:'Pulsar'  },
];

const SHAPES  = ['hexagon','diamond','circle','square','star5','triangle','shield'];
const SPECIAL = { NONE:0, BOMB:1, LINE_H:2, LINE_V:3, RAINBOW:4 };

// ── SAVE SYSTEM ───────────────────────────────────────────────
const Save = (() => {
  const KEY = 'nebula_jewels_v3';
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { levels:{}, settings:{}, lastLevel:1 }; }
    catch { return { levels:{}, settings:{}, lastLevel:1 }; }
  }
  function write(data) { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} }
  function reset() { try { localStorage.removeItem(KEY); } catch {} }
  return { load, write, reset };
})();

let saveData = Save.load();

// ── CANVAS ────────────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');
let CELL = 48;
let boardLeft = 0, boardTop = 0;

function resizeCanvas(G) {
  if (!G) return;
  const outer = document.getElementById('board-outer');
  const ow = outer.clientWidth  - 12;
  const oh = outer.clientHeight - 12;
  CELL = Math.max(34, Math.floor(Math.min(ow / G.cols, oh / G.rows)));
  canvas.width  = CELL * G.cols;
  canvas.height = CELL * G.rows;
  const rect = canvas.getBoundingClientRect();
  boardLeft = rect.left;
  boardTop  = rect.top;
}

// ── GAME STATE ────────────────────────────────────────────────
let G = null;  // active game state

function newState(levelId) {
  const lvl = getLevel(levelId);
  const grid = Array.from({length: lvl.rows}, () => new Array(lvl.cols));

  for (let r = 0; r < lvl.rows; r++) {
    for (let c = 0; c < lvl.cols; c++) {
      let safeTypes = [];
      // نبحث عن الألوان التي لا تسبب تطابقاً مبكراً
      for (let t = 0; t < lvl.numColors; t++) {
        if (r >= 2 && grid[r-1][c].type === t && grid[r-2][c].type === t) continue;
        if (c >= 2 && grid[r][c-1].type === t && grid[r][c-2].type === t) continue;
        safeTypes.push(t);
      }

      // نختار لوناً آمناً بشكل عشوائي
      const type = safeTypes.length > 0
        ? safeTypes[Math.floor(Math.random() * safeTypes.length)]
        : Math.floor(Math.random() * lvl.numColors); // حالة الطوارئ (نادرة جداً)

      grid[r][c] = makeFreshGem(type);
    }
  }

  // وضع العوائق (Blockers)
  lvl.blockers.forEach(b => {
    if (grid[b.r] && grid[b.r][b.c]) grid[b.r][b.c].blocker = true;
  });

  return {
    levelId, lvl,
    rows: lvl.rows, cols: lvl.cols,
    grid,
    score: 0, movesLeft: lvl.moves, combo: 0, maxCombo: 0,
    selected: null, busy: false, over: false, paused: false,
    powerups: { hammer:3, shuffle:2, lightning:1 },
    activePowerup: null, hintTimer: null, hintCell: null,
    startTime: Date.now(), totalMatches: 0,
  };
}

// نقوم بتمرير اللون المختار بدلاً من عدد الألوان
function makeFreshGem(type) {
  return {
    type: type,
    special: SPECIAL.NONE,
    blocker: false,
    y_off: 0, vy: 0,
    x_off: 0, vx: 0,
    scale: 1, alpha: 1, pop: 0, shake: 0,
  };
}

// ── PHYSICS CONSTANTS ─────────────────────────────────────────
const GRAVITY  = 0.95;
const BOUNCE   = 0.55;
const FRICTION = 0.82;

function tickPhysics() {
  if (!G) return false;
  let moving = false;
  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < G.cols; c++) {
      const g = G.grid[r][c];
      if (!g) continue;

      // pop spring
      if (g.pop > 0.004) { g.pop *= 0.80; moving = true; }
      else g.pop = 0;

      // scale spring
      if (Math.abs(g.scale - 1) > 0.003) {
        g.scale += (1 - g.scale) * 0.18;
        moving = true;
      } else g.scale = 1;

      // y physics
      if (Math.abs(g.y_off) > 0.15 || Math.abs(g.vy) > 0.1) {
        g.vy += GRAVITY;
        g.y_off += g.vy;
        if (g.y_off >= 0) {
          g.y_off = 0;
          g.vy = -g.vy * BOUNCE;
          if (Math.abs(g.vy) < 1.2) { g.vy = 0; g.y_off = 0; }
          else Audio.playSwap && void 0; // land sound removed for perf
        }
        moving = true;
      } else { g.y_off = 0; g.vy = 0; }

      // x physics
      if (Math.abs(g.x_off) > 0.1 || Math.abs(g.vx) > 0.08) {
        g.vx *= FRICTION;
        g.x_off += g.vx;
        if (Math.abs(g.vx) < 0.5) { g.vx = 0; g.x_off = 0; }
        moving = true;
      } else { g.x_off = 0; g.vx = 0; }
    }
  }
  return moving;
}

// ── DRAW HELPERS ──────────────────────────────────────────────
function hexPath(ctx, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 - Math.PI / 6;
    i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
  }
  ctx.closePath();
}
function diamondPath(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(0,-r*1.18); ctx.lineTo(r*0.88,0); ctx.lineTo(0,r*1.18); ctx.lineTo(-r*0.88,0);
  ctx.closePath();
}
function squarePath(ctx, r) {
  ctx.beginPath();
  ctx.roundRect(-r*0.84,-r*0.84,r*1.68,r*1.68, r*0.22);
}
function star5Path(ctx, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.44;
    i === 0 ? ctx.moveTo(Math.cos(a)*rr, Math.sin(a)*rr) : ctx.lineTo(Math.cos(a)*rr, Math.sin(a)*rr);
  }
  ctx.closePath();
}
function trianglePath(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(0,-r*1.12); ctx.lineTo(r*0.97,r*0.72); ctx.lineTo(-r*0.97,r*0.72);
  ctx.closePath();
}
function shieldPath(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(0,-r); ctx.lineTo(r*0.88,-r*0.38);
  ctx.lineTo(r*0.88,r*0.28); ctx.lineTo(0,r*1.08);
  ctx.lineTo(-r*0.88,r*0.28); ctx.lineTo(-r*0.88,-r*0.38);
  ctx.closePath();
}

const SHAPE_FNS = {
  hexagon:  hexPath,
  diamond:  diamondPath,
  circle:   (ctx,r) => { ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); },
  square:   squarePath,
  star5:    star5Path,
  triangle: trianglePath,
  shield:   shieldPath,
};

function drawGemAt(gem, cx, cy, selected, hint) {
  const gt    = GEM_TYPES[gem.type];
  const shape = SHAPES[gem.type];
  const fn    = SHAPE_FNS[shape] || SHAPE_FNS.circle;
  const r     = CELL * 0.39;

  ctx.save();
  ctx.translate(cx + gem.x_off, cy + gem.y_off);
  const sc = gem.scale * (1 + gem.pop * 0.35);
  ctx.scale(sc, sc);
  ctx.globalAlpha = gem.alpha;

  // glow halo
  const haloR = r * 1.5;
  const halo  = ctx.createRadialGradient(0,0,r*0.2,0,0,haloR);
  halo.addColorStop(0, gt.glow.replace('0.9','0.22'));
  halo.addColorStop(1, 'transparent');
  ctx.beginPath(); ctx.arc(0,0,haloR,0,Math.PI*2);
  ctx.fillStyle = halo; ctx.fill();

  // drop shadow
  ctx.shadowColor = gt.color;
  ctx.shadowBlur  = selected ? 26 : (hint ? 20 : 10);

  // body gradient
  const body = ctx.createRadialGradient(-r*0.22,-r*0.32,r*0.04, r*0.18,r*0.22,r*1.05);
  body.addColorStop(0, lighten(gt.color, 0.48));
  body.addColorStop(0.45, gt.color);
  body.addColorStop(1,   darken(gt.color, 0.45));
  fn(ctx, r);
  ctx.fillStyle = body;
  ctx.fill();

  // glass gloss
  ctx.shadowBlur = 0;
  const gloss = ctx.createLinearGradient(-r*0.28,-r*0.62, r*0.14, r*0.18);
  gloss.addColorStop(0, 'rgba(255,255,255,0.48)');
  gloss.addColorStop(1, 'rgba(255,255,255,0.0)');
  fn(ctx, r * 0.65);
  ctx.fillStyle = gloss;
  ctx.fill();

  // selection ring
  if (selected) {
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth   = 2.8;
    ctx.shadowColor = 'white'; ctx.shadowBlur = 16;
    fn(ctx, r);
    ctx.stroke();
  }

  // hint ring
  if (hint && !selected) {
    ctx.strokeStyle = 'rgba(255,255,100,0.7)';
    ctx.lineWidth   = 2;
    ctx.shadowColor = 'yellow'; ctx.shadowBlur = 12;
    fn(ctx, r);
    ctx.stroke();
  }

  // special badge
  if (gem.special !== SPECIAL.NONE) {
    ctx.shadowBlur = 0;
    ctx.font  = `bold ${r * 0.6}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const icons = { [SPECIAL.BOMB]:'💣', [SPECIAL.LINE_H]:'—', [SPECIAL.LINE_V]:'|', [SPECIAL.RAINBOW]:'★' };
    if (gem.special === SPECIAL.LINE_H || gem.special === SPECIAL.LINE_V) {
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2.5;
      ctx.shadowColor = 'white'; ctx.shadowBlur = 10;
      if (gem.special === SPECIAL.LINE_H) {
        ctx.beginPath(); ctx.moveTo(-r*0.52,0); ctx.lineTo(r*0.52,0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r*0.52,-r*0.12); ctx.lineTo(r*0.52,-r*0.12); ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=1; ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(0,-r*0.52); ctx.lineTo(0,r*0.52); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r*0.12,-r*0.52); ctx.lineTo(-r*0.12,r*0.52); ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=1; ctx.stroke();
      }
    } else {
      ctx.fillStyle = 'white';
      ctx.shadowColor = 'white'; ctx.shadowBlur = gem.special === SPECIAL.RAINBOW ? 20 : 8;
      ctx.fillText(icons[gem.special], 0, 0);
    }
  }

  ctx.restore();
}

function drawBlocker(cx, cy) {
  const r = CELL * 0.38;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = 'rgba(100,100,120,0.4)'; ctx.shadowBlur = 8;
  const g = ctx.createRadialGradient(0,0,r*0.1, 0,0,r);
  g.addColorStop(0,'rgba(80,80,100,0.9)');
  g.addColorStop(1,'rgba(30,30,50,0.95)');
  ctx.beginPath(); squarePath(ctx, r);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(120,120,160,0.4)'; ctx.lineWidth = 1.5;
  ctx.stroke();
  // crack lines
  ctx.strokeStyle = 'rgba(150,150,170,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-r*0.3,-r*0.4); ctx.lineTo(r*0.1,r*0.3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r*0.2,-r*0.2); ctx.lineTo(-r*0.1,r*0.4); ctx.stroke();
  ctx.restore();
}

function render() {
  if (!G) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // board bg
  const bgGrad = ctx.createLinearGradient(0,0,0,canvas.height);
  bgGrad.addColorStop(0,'rgba(2,10,30,0.7)');
  bgGrad.addColorStop(1,'rgba(4,4,20,0.8)');
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0,0,canvas.width,canvas.height,14);
  else ctx.rect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = bgGrad; ctx.fill();

  // grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth   = 1;
  for (let r = 0; r <= G.rows; r++) {
    ctx.beginPath(); ctx.moveTo(0,r*CELL); ctx.lineTo(canvas.width,r*CELL); ctx.stroke();
  }
  for (let c = 0; c <= G.cols; c++) {
    ctx.beginPath(); ctx.moveTo(c*CELL,0); ctx.lineTo(c*CELL,canvas.height); ctx.stroke();
  }

  const sel  = G.selected;
  const hint = G.hintCell;

  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < G.cols; c++) {
      const gem = G.grid[r][c];
      const cx  = c * CELL + CELL * 0.5;
      const cy  = r * CELL + CELL * 0.5;
      if (!gem) continue;
      if (gem.blocker) { drawBlocker(cx, cy); continue; }
      const isSel  = sel  && sel.r  === r && sel.c  === c;
      const isHint = hint && hint.r === r && hint.c === c;
      drawGemAt(gem, cx, cy, isSel, isHint);
    }
  }
}

// ── COLOR HELPERS ─────────────────────────────────────────────
function lighten(hex, amt) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.min(255,Math.round(r+amt*210))},${Math.min(255,Math.round(g+amt*210))},${Math.min(255,Math.round(b+amt*210))})`;
}
function darken(hex, amt) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.max(0,Math.round(r-amt*210))},${Math.max(0,Math.round(g-amt*210))},${Math.max(0,Math.round(b-amt*210))})`;
}

// ── MATCH LOGIC ───────────────────────────────────────────────
function findMatches() {
  const M  = G.rows;
  const N  = G.cols;
  const matched = Array.from({length:M}, () => new Uint8Array(N));

  // horizontal
  for (let r = 0; r < M; r++) {
    for (let c = 0; c < N - 2; ) {
      const gem = G.grid[r][c];
      if (!gem || gem.blocker) { c++; continue; }
      const t = gem.type;
      let len = 1;
      while (c+len < N) {
        const g2 = G.grid[r][c+len];
        if (!g2 || g2.blocker || g2.type !== t) break;
        len++;
      }
      if (len >= 3) { for (let i=0;i<len;i++) matched[r][c+i] = 1; }
      c += len;
    }
  }
  // vertical
  for (let c = 0; c < N; c++) {
    for (let r = 0; r < M - 2; ) {
      const gem = G.grid[r][c];
      if (!gem || gem.blocker) { r++; continue; }
      const t = gem.type;
      let len = 1;
      while (r+len < M) {
        const g2 = G.grid[r+len][c];
        if (!g2 || g2.blocker || g2.type !== t) break;
        len++;
      }
      if (len >= 3) { for (let i=0;i<len;i++) matched[r+i][c] = 1; }
      r += len;
    }
  }

  return matched;
}

function createSpecials(matched) {
  // check for L/T shapes (bomb), 4-in-a-row (line), 5+ (rainbow)
  const M = G.rows, N = G.cols;

  for (let r = 0; r < M; r++) {
    // H-runs
    for (let c = 0; c < N - 2; ) {
      if (!matched[r][c]) { c++; continue; }
      let len = 0;
      while (c+len < N && matched[r][c+len]) len++;
      if (len >= 5) {
        const mid = c + Math.floor(len/2);
        const gem = G.grid[r][mid];
        if (gem && !gem.blocker) gem.pendingSpecial = SPECIAL.RAINBOW;
      } else if (len === 4) {
        const mid = c + 1;
        const gem = G.grid[r][mid];
        if (gem && !gem.blocker) gem.pendingSpecial = SPECIAL.LINE_H;
      }
      c += len;
    }
  }
  for (let c = 0; c < N; c++) {
    for (let r = 0; r < M - 2; ) {
      if (!matched[r][c]) { r++; continue; }
      let len = 0;
      while (r+len < M && matched[r+len][c]) len++;
      if (len >= 5) {
        const mid = r + Math.floor(len/2);
        const gem = G.grid[mid][c];
        if (gem && !gem.blocker) gem.pendingSpecial = SPECIAL.RAINBOW;
      } else if (len === 4) {
        const mid = r + 1;
        const gem = G.grid[mid][c];
        if (gem && !gem.blocker) gem.pendingSpecial = SPECIAL.LINE_V;
      }
      r += len;
    }
  }

  // L/T → bomb: find cells matched both H and V
  for (let r = 0; r < M; r++) {
    for (let c = 0; c < N; c++) {
      if (!matched[r][c]) continue;
      const gem = G.grid[r][c];
      if (!gem || gem.blocker || gem.pendingSpecial) continue;
      // check if this cell is matched both horizontally and vertically
      const hMatch = (c>0 && matched[r][c-1]) || (c<N-1 && matched[r][c+1]);
      const vMatch = (r>0 && matched[r-1][c]) || (r<M-1 && matched[r+1][c]);
      if (hMatch && vMatch) gem.pendingSpecial = SPECIAL.BOMB;
    }
  }
}

function expandSpecials(matched) {
  const M = G.rows, N = G.cols;
  let changed = false;
  for (let r = 0; r < M; r++) {
    for (let c = 0; c < N; c++) {
      if (!matched[r][c]) continue;
      const gem = G.grid[r][c];
      if (!gem || !gem.special) continue;

      if (gem.special === SPECIAL.BOMB) {
        for (let dr=-2;dr<=2;dr++) for (let dc=-2;dc<=2;dc++) {
          const nr=r+dr, nc=c+dc;
          if (nr>=0&&nr<M&&nc>=0&&nc<N&&!matched[nr][nc]) { matched[nr][nc]=1; changed=true; }
        }
      } else if (gem.special === SPECIAL.LINE_H) {
        for (let cc=0;cc<N;cc++) if (!matched[r][cc]) { matched[r][cc]=1; changed=true; }
      } else if (gem.special === SPECIAL.LINE_V) {
        for (let rr=0;rr<M;rr++) if (!matched[rr][c]) { matched[rr][c]=1; changed=true; }
      } else if (gem.special === SPECIAL.RAINBOW) {
        const t = gem.type;
        for (let rr=0;rr<M;rr++) for (let cc=0;cc<N;cc++) {
          const g2 = G.grid[rr][cc];
          if (g2 && !g2.blocker && g2.type===t && !matched[rr][cc]) { matched[rr][cc]=1; changed=true; }
        }
      }
    }
  }
  return changed;
}

function countMatched(matched) {
  let n = 0;
  for (let r=0;r<G.rows;r++) for(let c=0;c<G.cols;c++) if(matched[r][c]) n++;
  return n;
}

function calcScore(n, combo) {
  // 1. تقليل النقاط الأساسية من 55 إلى 25 لكل جوهرة
  const basePoints = n * 25;

  // 2. ترويض المضاعف (Combo): بدلاً من الضرب المباشر x2, x3, x4
  // سنجعله يزيد بنسبة 40% فقط لكل متتالية، لكي لا تخرج الأرقام عن السيطرة
  const comboMultiplier = 1 + (combo * 0.4);

  // 3. علاوة طول التطابق (4 أو 5 جواهر) أصبحت واقعية أكثر
  const lengthBonus = 1 + (Math.log2(Math.max(1, n - 2)) * 0.15);

  return Math.round(basePoints * comboMultiplier * lengthBonus);
}

// ── SLEEP ─────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── PROCESS CASCADE ───────────────────────────────────────────
async function processCascade(isPlayerMove = true) {
  G.busy = true;
  let cascadeCount = 0;

  while (true) {
    const matched = findMatches();
    if (countMatched(matched) === 0) break;

    cascadeCount++;
    if (isPlayerMove || cascadeCount > 1) G.combo++;
    G.maxCombo = Math.max(G.maxCombo, G.combo);

    // create specials before expanding
    createSpecials(matched);

    // expand specials iteratively
    let ex = true;
    while (ex) ex = expandSpecials(matched);

const n = countMatched(matched);
    let pts = 0;
    if (isPlayerMove) {
      pts = calcScore(n, G.combo);
      G.score += pts;
      G.totalMatches += n;
    }

    // collect positions + fire particles + sounds
    const positions = [];
    for (let r=0;r<G.rows;r++) {
      for (let c=0;c<G.cols;c++) {
        if (!matched[r][c]) continue;
        const gem = G.grid[r][c];
        if (!gem || gem.blocker) continue;
        positions.push({r, c, type: gem.type});
      }
    }

    Audio.playMatch(n, G.combo);
    if (G.combo >= 2) {
      Audio.playCombo(G.combo);
      showComboPopup(G.combo);
    }

    // apply pending specials and zero out
    for (const pos of positions) {
      const gem = G.grid[pos.r][pos.c];
      if (gem && gem.pendingSpecial) {
        gem.special = gem.pendingSpecial;
        delete gem.pendingSpecial;
      }
    }

    // emit particles for matched gems
    for (const pos of positions) {
      const cx = pos.c * CELL + CELL*0.5 + boardLeft;
      const cy = pos.r * CELL + CELL*0.5 + boardTop;
      const col = GEM_TYPES[pos.type].color;
      const gem = G.grid[pos.r][pos.c];
      Particles.burst(cx, cy, col, 10 + Math.min(G.combo*2, 10));
      Particles.ripple(cx, cy, col);
      if (gem && (gem.special === SPECIAL.LINE_H || gem.special === SPECIAL.LINE_V)) {
        Audio.playSpecial();
        Particles.lineBlast(cx, cy, col, gem.special === SPECIAL.LINE_H);
      }
    }

    // floating score
    if (positions.length > 0) {
      const mid = positions[Math.floor(positions.length/2)];
      spawnFloatScore(pts, mid.c * CELL + CELL*0.5 + boardLeft, mid.r * CELL + boardTop);
    }

    updateHUD();

    // scale-out matched gems
    for (const pos of positions) {
      const gem = G.grid[pos.r][pos.c];
      if (gem && !gem.blocker) gem.scale = 0.01;
    }
    await sleep(140);

    // preserve surviving specials, clear matched
    const survivingSpecials = new Map();
    for (const pos of positions) {
      const gem = G.grid[pos.r][pos.c];
      if (gem && gem.special !== SPECIAL.NONE && gem.pendingSpecial) {
        survivingSpecials.set(`${pos.r},${pos.c}`, gem.special);
      }
    }
    for (const pos of positions) { G.grid[pos.r][pos.c] = null; }

    // gravity
    await dropGems();
    await sleep(220);
    refill();
    await sleep(100);
  }

  if (isPlayerMove && cascadeCount === 0) {
    G.combo = 0;
  }

  G.busy = false;
  if (!G.over) checkEndConditions();
}

async function dropGems() {
  for (let c = 0; c < G.cols; c++) {
    let empties = 0;
    for (let r = G.rows-1; r >= 0; r--) {
      if (!G.grid[r][c]) {
        empties++;
      } else if (empties > 0 && !G.grid[r][c].blocker) {
        G.grid[r + empties][c] = G.grid[r][c];
        G.grid[r][c] = null;
        const gem = G.grid[r+empties][c];
        gem.y_off = -(CELL * empties * 1.15);
        gem.vy    = 0;
      }
    }
  }
}

function refill() {
  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < G.cols; c++) {
      if (!G.grid[r][c]) {
        const type = Math.floor(Math.random() * G.lvl.numColors);
        const gem = makeFreshGem(type);
        gem.y_off = -(CELL * (r + 2) * 1.2);
        gem.vy    = 0;
        gem.pop   = 0.6;
        G.grid[r][c] = gem;
      }
    }
  }
}

// ── SWAP ──────────────────────────────────────────────────────
async function doSwap(r1, c1, r2, c2) {
  if (G.busy || G.paused || G.over) return;

  const gem1 = G.grid[r1][c1];
  const gem2 = G.grid[r2][c2];
  if (!gem1 || !gem2 || gem1.blocker || gem2.blocker) return;

  Audio.playSwap();
  G.busy = true;

  // visual swap hint
  const dx = (c2-c1)*CELL*0.55, dy = (r2-r1)*CELL*0.55;
  gem1.x_off = dx; gem1.y_off = dy;
  gem2.x_off = -dx; gem2.y_off = -dy;

  // swap in grid
  G.grid[r1][c1] = gem2;
  G.grid[r2][c2] = gem1;
  gem1.x_off = dx; gem1.y_off = dy;
  gem2.x_off = -dx; gem2.y_off = -dy;

  await sleep(90);

  // test for match
  const m = findMatches();
  if (countMatched(m) === 0) {
    // invalid → swap back with shake
    G.grid[r1][c1] = gem1;
    G.grid[r2][c2] = gem2;
    gem1.x_off = -dx*0.4; gem1.y_off = -dy*0.4;
    gem2.x_off =  dx*0.4; gem2.y_off =  dy*0.4;
    Audio.playInvalid();
    await sleep(180);
    gem1.x_off = 0; gem1.y_off = 0;
    gem2.x_off = 0; gem2.y_off = 0;
    G.busy = false;
    return;
  }

  // Valid swap
  gem1.x_off = 0; gem1.y_off = 0;
  gem2.x_off = 0; gem2.y_off = 0;
  G.movesLeft--;
  G.selected = null;
  clearHint();
  updateHUD();

  await processCascade(true);
}

// ── HUD ───────────────────────────────────────────────────────
function updateHUD() {
  if (!G) return;
  const scoreEl = document.getElementById('hud-score');
  scoreEl.textContent = G.score.toLocaleString();
  scoreEl.classList.remove('pop');
  void scoreEl.offsetWidth;
  scoreEl.classList.add('pop');

  const movesEl = document.getElementById('hud-moves');
  movesEl.textContent = G.movesLeft;
  movesEl.classList.toggle('low', G.movesLeft <= 5);

  const pct = Math.min(G.score / G.lvl.goal * 100, 100);
  document.getElementById('hud-goal-fill').style.width = pct + '%';
  document.getElementById('hud-goal-txt').textContent =
    `${Math.min(G.score,G.lvl.goal).toLocaleString()} / ${G.lvl.goal.toLocaleString()}`;

  // combo fill bar
  const comboFill = document.getElementById('combo-fill');
  const comboPct  = Math.min(G.combo / 6 * 100, 100);
  comboFill.style.width   = comboPct + '%';
  comboFill.style.opacity = G.combo > 0 ? '1' : '0';
}

// ── COMBO POPUP ───────────────────────────────────────────────
let comboPopTimer = null;
function showComboPopup(n) {
  const el = document.getElementById('combo-popup');
  const labels = ['','','DOUBLE!','TRIPLE!','QUAD!','ULTRA!','INSANE!','COSMIC!'];
  const colors = ['','','#ffc800','#ff6200','#ff0070','#c400ff','#00e5ff','#ffffff'];
  const lbl = n < labels.length ? labels[n] : `×${n} COMBO!`;
  const col = n < colors.length ? colors[n] : '#fff';
  el.textContent = lbl;
  el.style.color  = col;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(comboPopTimer);
  comboPopTimer = setTimeout(() => el.classList.remove('show'), 950);
}

// ── FLOATING SCORE ────────────────────────────────────────────
function spawnFloatScore(pts, x, y) {
  const el = document.createElement('div');
  el.className = 'float-score';
  el.textContent = '+' + pts.toLocaleString();
  el.style.left  = x + 'px';
  el.style.top   = y + 'px';
  el.style.color = GEM_TYPES[G?.grid[0]?.[0]?.type ?? 0]?.color ?? '#fff';
  el.style.fontSize = Math.min(0.85 + pts/800, 2.2) + 'rem';
  el.style.fontFamily = "'Orbitron', monospace";
  el.style.fontWeight = '700';
  el.style.textShadow = `0 0 12px currentColor`;
  el.style.pointerEvents = 'none';
  el.style.zIndex = '100';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ── HINT SYSTEM ───────────────────────────────────────────────
function findHint() {
  // find first valid swap
  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < G.cols; c++) {
      const gem = G.grid[r][c];
      if (!gem || gem.blocker) continue;
      const dirs = [{r:r,c:c+1},{r:r+1,c:c}];
      for (const d of dirs) {
        if (d.r >= G.rows || d.c >= G.cols) continue;
        const gem2 = G.grid[d.r][d.c];
        if (!gem2 || gem2.blocker) continue;
        // test swap
        G.grid[r][c]   = gem2;
        G.grid[d.r][d.c] = gem;
        const m = findMatches();
        G.grid[r][c]   = gem;
        G.grid[d.r][d.c] = gem2;
        if (countMatched(m) > 0) return {r, c};
      }
    }
  }
  return null;
}

let hintTimeout = null;
function scheduleHint() {
  clearHint();
  if (!saveData.settings?.hints) return;
  hintTimeout = setTimeout(() => {
    if (!G || G.busy) return;
    G.hintCell = findHint();
    if (!G.hintCell) return;
    document.getElementById('tutorial-hint').textContent = 'Tap highlighted gem!';
    document.getElementById('tutorial-hint').classList.add('show');
  }, 5000);
}
function clearHint() {
  clearTimeout(hintTimeout);
  if (G) G.hintCell = null;
  document.getElementById('tutorial-hint').classList.remove('show');
}

// ── END CONDITIONS ────────────────────────────────────────────
function checkEndConditions() {
  if (G.over) return;

  // 1. الفوز المطلق: إذا حقق اللاعب 3 نجمات، ننهي المستوى فوراً لأنه حقق العلامة الكاملة
  if (G.score >= G.lvl.star3) {
    G.over = true;

    // مكافأة الاحتراف: تحويل الحركات المتبقية إلى نقاط تضاف للسكور النهائي
    if (G.movesLeft > 0) {
      const bonus = G.movesLeft * 100; // 250 نقطة لكل حركة لم يستهلكها
      G.score += bonus;
      updateHUD(); // تحديث الشاشة لتظهر النقاط المضافة
    }

    // إظهار شاشة الفوز بـ 3 نجمات
    setTimeout(() => UI.showWin(3), 600);
    return;
  }

  // 2. انتهاء الحركات: هنا نحدد مصير اللاعب الحقيقي
  if (G.movesLeft <= 0) {
    G.over = true;

    // هل جمع نقاطاً تكفي لنجمة واحدة على الأقل؟
    if (G.score >= G.lvl.goal) {
      const stars = G.score >= G.lvl.star3 ? 3 : G.score >= G.lvl.star2 ? 2 : 1;
      setTimeout(() => UI.showWin(stars), 500);
    } else {
      // إذا نفذت حركاته ولم يصل للهدف الأساسي
      setTimeout(() => UI.showLose(), 400);
    }
  }
}

// ── INPUT HANDLING ────────────────────────────────────────────
let touchOrigin = null;
let isDragging  = false;

function getCellAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const c = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  if (r < 0 || r >= G.rows || c < 0 || c >= G.cols) return null;
  return {r, c};
}

function handlePointerDown(x, y) {
  if (!G || G.busy || G.paused || G.over) return;
  const cell = getCellAt(x, y);
  if (!cell) return;
  const gem = G.grid[cell.r][cell.c];
  if (!gem || gem.blocker) return;

  // powerup mode
  if (G.activePowerup) {
    applyPowerup(G.activePowerup, cell.r, cell.c);
    return;
  }

  touchOrigin = cell;
  isDragging  = false;

  if (G.selected) {
    const sel = G.selected;
    if (sel.r === cell.r && sel.c === cell.c) {
      G.selected = null;
    } else {
      const dr = Math.abs(cell.r - sel.r), dc = Math.abs(cell.c - sel.c);
      if (dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0)) {
        G.selected = null;
        doSwap(sel.r, sel.c, cell.r, cell.c);
      } else {
        G.selected = cell;
        Audio.playSelect();
      }
    }
  } else {
    G.selected = cell;
    Audio.playSelect();
    if (navigator.vibrate && saveData.settings?.haptics !== false) navigator.vibrate(8);
  }
  clearHint();
}

function handlePointerMove(x, y) {
  if (!touchOrigin || !G || G.busy) return;
  const cell = getCellAt(x, y);
  if (!cell) return;
  const dr = Math.abs(cell.r - touchOrigin.r);
  const dc = Math.abs(cell.c - touchOrigin.c);
  if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
    isDragging = true;
    const orig = touchOrigin;
    touchOrigin = null;
    G.selected = null;
    doSwap(orig.r, orig.c, cell.r, cell.c);
  }
}

// Touch
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.touches[0];
  handlePointerDown(t.clientX, t.clientY);
}, {passive: false});

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const t = e.touches[0];
  handlePointerMove(t.clientX, t.clientY);
}, {passive: false});

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  touchOrigin = null; isDragging = false;
}, {passive: false});

// Mouse
canvas.addEventListener('mousedown', e => handlePointerDown(e.clientX, e.clientY));
canvas.addEventListener('mousemove', e => { if (e.buttons) handlePointerMove(e.clientX, e.clientY); });
canvas.addEventListener('mouseup', () => { touchOrigin = null; isDragging = false; });

// ── POWERUPS ──────────────────────────────────────────────────
function applyPowerup(type, r, c) {
  const gem = G.grid[r][c];
  if (!gem || gem.blocker) return;

  G.activePowerup = null;
  document.querySelectorAll('.powerup-btn').forEach(b => b.classList.remove('active-pu'));

  if (type === 'hammer') {
    G.powerups.hammer--;
    G.grid[r][c] = null;
    const col = GEM_TYPES[gem.type].color;
    const cx = c*CELL+CELL*0.5+boardLeft;
    const cy = r*CELL+CELL*0.5+boardTop;
    Particles.burst(cx, cy, col, 20);
    Audio.playPowerup();
    G.movesLeft--;
    updateHUD();
    dropGems().then(() => { refill(); processCascade(false); });
  } else if (type === 'lightning') {
    G.powerups.lightning--;
    const m = Array.from({length:G.rows}, () => new Uint8Array(G.cols));
    for (let cc=0;cc<G.cols;cc++) m[r][cc]=1;
    Audio.playSpecial();
    G.movesLeft--;
    for (let cc=0;cc<G.cols;cc++) {
      const g2=G.grid[r][cc];
      if (g2&&!g2.blocker) {
        const col=GEM_TYPES[g2.type].color;
        Particles.lineBlast(cc*CELL+CELL*0.5+boardLeft, r*CELL+CELL*0.5+boardTop, col, true);
        g2.scale=0.01;
      }
    }
    setTimeout(async () => {
      for (let cc=0;cc<G.cols;cc++) if (G.grid[r][cc]&&!G.grid[r][cc].blocker) G.grid[r][cc]=null;
      await dropGems(); refill();
      updateHUD();
      await processCascade(false);
    }, 150);
  } else if (type === 'shuffle') {
    G.powerups.shuffle--;
    shuffleBoard();
    Audio.playPowerup();
  }

  updatePowerupBar();
}

function shuffleBoard() {
  const gems = [];
  for (let r=0;r<G.rows;r++) for(let c=0;c<G.cols;c++) if(G.grid[r][c]&&!G.grid[r][c].blocker) gems.push(G.grid[r][c]);
  for (let i=gems.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [gems[i],gems[j]]=[gems[j],gems[i]]; }
  let k=0;
  for (let r=0;r<G.rows;r++) for(let c=0;c<G.cols;c++) if(G.grid[r][c]&&!G.grid[r][c].blocker) { G.grid[r][c]=gems[k++]; gems[k-1].pop=0.8; }
}

function updatePowerupBar() {
  if (!G) return;
  document.querySelectorAll('.powerup-btn').forEach(btn => {
    const pu = btn.dataset.pu;
    const cnt = G.powerups[pu] ?? 0;
    btn.querySelector('span').textContent = cnt;
    btn.disabled = cnt <= 0;
    btn.style.opacity = cnt > 0 ? '1' : '0.35';
  });
}

document.querySelectorAll('.powerup-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!G || G.busy) return;
    const pu = btn.dataset.pu;
    if ((G.powerups[pu] ?? 0) <= 0) return;
    if (G.activePowerup === pu) {
      G.activePowerup = null;
      btn.classList.remove('active-pu');
    } else {
      G.activePowerup = pu;
      document.querySelectorAll('.powerup-btn').forEach(b => b.classList.remove('active-pu'));
      btn.classList.add('active-pu');
    }
  });
});

// ── GAME LOOP ─────────────────────────────────────────────────
let rafId = null;
let lastTs = 0;
const TARGET_FPS = 60;
const FRAME_MS   = 1000 / TARGET_FPS;

function gameLoop(ts) {
  rafId = requestAnimationFrame(gameLoop);
  const dt = ts - lastTs;
  if (dt < FRAME_MS - 1) return;
  lastTs = ts;
  tickPhysics();
  render();
  Particles.tick();
}

// ── PUBLIC API ────────────────────────────────────────────────
const Game = {
  start(levelId) {
    if (rafId) cancelAnimationFrame(rafId);
    Particles.clear();
    G = newState(levelId);

    document.getElementById('hud-level').textContent = `LEVEL ${levelId}`;

    setTimeout(() => {
      resizeCanvas(G);
      boardLeft = canvas.getBoundingClientRect().left;
      boardTop  = canvas.getBoundingClientRect().top;
      updateHUD();
      updatePowerupBar();
      Audio.playLevelStart();

      // clear initial matches
      processCascade(false).then(() => {
        G.busy = false;
        scheduleHint();
        rafId = requestAnimationFrame(gameLoop);
      });
    }, 60);
  },

  pause()  { if (G) G.paused = true; },
  resume() { if (G) G.paused = false; },
  stop()   { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } G = null; Particles.clear(); },

  getState() { return G; },

  applySettings(s) {
    Audio.setEnabled(s.sound !== false);
    Particles.setEnabled(s.particles !== false);
  },

  onResize() {
    if (!G) return;
    resizeCanvas(G);
    boardLeft = canvas.getBoundingClientRect().left;
    boardTop  = canvas.getBoundingClientRect().top;
  },

  getSaveData() { return saveData; },
  saveLevelResult(levelId, stars, score) {
    saveData = Save.load();
    const prev = saveData.levels[levelId] || {stars:0, score:0};
    saveData.levels[levelId] = {
      stars: Math.max(prev.stars, stars),
      score: Math.max(prev.score, score),
    };
    if (levelId < 300) {
      if (!saveData.levels[levelId+1]) saveData.levels[levelId+1] = {stars:0, score:0};
    }
    saveData.lastLevel = levelId;
    Save.write(saveData);
  },
  resetSave() { Save.reset(); saveData = Save.load(); },
  getSave()   { return (saveData = Save.load()); },
};

// ── WINDOW RESIZE ─────────────────────────────────────────────
window.addEventListener('resize', () => {
  Game.onResize();
  Particles.resize();
});

// ── PREVENT SCROLL ────────────────────────────────────────────
document.addEventListener('touchmove', e => e.preventDefault(), {passive: false});
