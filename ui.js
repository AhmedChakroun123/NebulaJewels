/* ═══════════════════════════════════════════════════════════
   NEBULA JEWELS  ·  ui.js
   Screen management, star map, overlays, settings
═══════════════════════════════════════════════════════════ */
'use strict';

// ── STARFIELD ─────────────────────────────────────────────────
(function buildStarfield() {
  const canvas = document.getElementById('starfield-canvas');
  const ctx    = canvas.getContext('2d');
  let stars    = [];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    buildStars();
  }

  function buildStars() {
    stars = [];
    const n = Math.min(200, Math.floor(window.innerWidth * window.innerHeight / 5000));
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() < 0.7 ? 0.6 : Math.random() < 0.7 ? 1.1 : 1.8,
        op: 0.2 + Math.random() * 0.7,
        speed: 0.008 + Math.random() * 0.015,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  let t = 0;
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    t += 0.012;
    for (const s of stars) {
      const alpha = s.op * (0.55 + 0.45 * Math.sin(t * s.speed * 60 + s.phase));
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = 'white';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize);
  resize();
  tick();
})();

// ── LOGO GEMS ─────────────────────────────────────────────────
(function buildLogoGems() {
  const container = document.getElementById('logo-gems');
  const types = [0, 1, 2, 3, 4];
  const shapes = ['hexagon', 'diamond', 'circle', 'square', 'star5'];

  types.forEach((t, i) => {
    const c  = document.createElement('canvas');
    c.width  = 40; c.height = 40;
    c.className = 'logo-gem-canvas';
    c.style.setProperty('--d',     `${2.5 + i * 0.4}s`);
    c.style.setProperty('--delay', `${i * 0.22}s`);

    const cx = c.getContext('2d');
    const gt = GEM_TYPES[t];
    cx.save(); cx.translate(20, 20);
    const grd = cx.createRadialGradient(-5,-6,1, 5,5,16);
    grd.addColorStop(0, lighten(gt.color, 0.5));
    grd.addColorStop(0.5, gt.color);
    grd.addColorStop(1, darken(gt.color, 0.45));

    const fn = SHAPE_FNS[shapes[i]] || SHAPE_FNS.circle;
    fn(cx, 14);
    cx.fillStyle   = grd;
    cx.shadowColor = gt.color;
    cx.shadowBlur  = 10;
    cx.fill();

    const gloss = cx.createLinearGradient(-5,-9, 4,4);
    gloss.addColorStop(0,'rgba(255,255,255,0.5)');
    gloss.addColorStop(1,'rgba(255,255,255,0)');
    fn(cx, 9);
    cx.fillStyle = gloss; cx.shadowBlur=0; cx.fill();
    cx.restore();

    container.appendChild(c);
  });
})();

// ── SCREEN TRANSITIONS ────────────────────────────────────────
let currentScreen = 'screen-menu';

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });
  const target = document.getElementById(id);
  if (target) {
    requestAnimationFrame(() => {
      target.classList.add('active');
      currentScreen = id;
    });
  }
}

function hideAllOverlays() {
  document.querySelectorAll('.overlay').forEach(o => o.classList.remove('show'));
}

// ── STAR MAP ──────────────────────────────────────────────────
let activeChapter = 0;

function buildChapterStrip() {
  const strip = document.getElementById('chapter-strip');
  strip.innerHTML = '';
  CHAPTERS.forEach((ch, i) => {
    const tab = document.createElement('button');
    tab.className  = 'chapter-tab' + (i === activeChapter ? ' active' : '');
    tab.textContent = `${i+1}. ${ch.name}`;
    tab.style.borderColor = i === activeChapter ? ch.color + '99' : '';
    tab.style.color = i === activeChapter ? ch.color : '';
    tab.addEventListener('click', () => { activeChapter = i; buildChapterStrip(); buildStarMap(); });
    strip.appendChild(tab);
  });
  // scroll active into view
  const active = strip.querySelector('.active');
  if (active) active.scrollIntoView({inline:'center', behavior:'smooth'});
}

function buildStarMap() {
  const sd   = Game.getSave();
  const ch   = CHAPTERS[activeChapter];
  const grid = document.getElementById('starmap-grid');
  grid.innerHTML = '';

  document.getElementById('chapter-label').textContent = ch.name;

  const [start, end] = ch.levels;
  for (let id = start; id <= end; id++) {
    const data     = sd.levels[id];
    const prevData = id === 1 ? {stars:1} : sd.levels[id-1];
    const unlocked = id === 1 || (prevData && (prevData.stars > 0 || data));
    const completed = data && data.stars > 0;
    const isCurrent = id === (sd.lastLevel || 1);

    const node = document.createElement('div');
    node.className = 'lvl-node ' + (completed ? 'completed' : unlocked ? 'unlocked' : 'locked');
    if (isCurrent && unlocked) node.classList.add('current');

    if (!unlocked) {
      node.innerHTML = `<span class="lvl-lock">🔒</span><span class="lvl-num" style="font-size:0.65rem;opacity:0.5">${id}</span>`;
    } else {
      const starsHtml = completed
        ? `<span class="lvl-stars-row">${'⭐'.repeat(data.stars)}${'·'.repeat(3-data.stars)}</span>`
        : `<span class="lvl-stars-row" style="color:rgba(255,255,255,0.2)">···</span>`;
      node.innerHTML = `<span class="lvl-num">${id}</span>${starsHtml}`;
      node.addEventListener('click', () => {
        Audio.playSelect();
        startGame(id);
      });
    }
    grid.appendChild(node);
  }
}

// ── WIN SCREEN ────────────────────────────────────────────────
const UI = {
  showWin(stars) {
    const G = Game.getState();
    Audio.playWin();

    // save progress
    Game.saveLevelResult(G.levelId, stars, G.score);

    // stars row
    const starsRow = document.getElementById('win-stars-row');
    starsRow.innerHTML = '';
    for (let i = 1; i <= 3; i++) {
      const c  = document.createElement('canvas');
      c.className = 'star-gem';
      c.width = 44; c.height = 44;
      const cx2 = c.getContext('2d');
      cx2.save(); cx2.translate(22,22);
      const col = i <= stars ? '#ffc800' : '#334';
      const grd = cx2.createRadialGradient(-4,-5,1,4,4,16);
      grd.addColorStop(0, i<=stars ? '#fff8cc' : '#445');
      grd.addColorStop(1, col);
      SHAPE_FNS.star5(cx2, 16);
      cx2.fillStyle   = grd;
      cx2.shadowColor = col;
      cx2.shadowBlur  = i<=stars ? 14 : 0;
      cx2.fill(); cx2.restore();
      starsRow.appendChild(c);

      if (i <= stars) {
        setTimeout(() => c.classList.add('earned'), i * 220);
      }
    }

    // stats
    const elapsed = Math.round((Date.now() - G.startTime) / 1000);
    document.getElementById('win-stats').innerHTML = `
      <div class="stat-box"><span class="stat-val">${G.score.toLocaleString()}</span><span class="stat-lbl">SCORE</span></div>
      <div class="stat-box"><span class="stat-val">${G.maxCombo}×</span><span class="stat-lbl">MAX COMBO</span></div>
      <div class="stat-box"><span class="stat-val">${G.totalMatches}</span><span class="stat-lbl">MATCHES</span></div>
      <div class="stat-box"><span class="stat-val">${elapsed}s</span><span class="stat-lbl">TIME</span></div>
    `;

    // fireworks
    const colors = GEM_TYPES.map(g => g.color);
    Particles.winFireworks(window.innerWidth, window.innerHeight, colors);

    document.getElementById('overlay-win').classList.add('show');
  },

  showLose() {
    const G = Game.getState();
    Audio.playLose();
    document.getElementById('lose-score').textContent = G.score.toLocaleString();
    const gap = G.lvl.goal - G.score;
    document.getElementById('lose-hint').textContent =
      gap > 0 ? `${gap.toLocaleString()} points short of the goal` : '';
    document.getElementById('overlay-lose').classList.add('show');
  },
};

// ── START GAME ────────────────────────────────────────────────
function startGame(levelId) {
  hideAllOverlays();
  showScreen('screen-game');
  setTimeout(() => Game.start(levelId), 50);
}

function goToMap() {
  Game.stop();
  hideAllOverlays();
  buildChapterStrip();
  buildStarMap();
  showScreen('screen-starmap');
}

function goToMenu() {
  Game.stop();
  hideAllOverlays();
  updateMenuFooter();
  showScreen('screen-menu');
}

function updateMenuFooter() {
  const sd    = Game.getSave();
  let total   = 0;
  let cleared = 0;
  Object.values(sd.levels || {}).forEach(l => {
    if (l.stars) { total += l.stars; cleared++; }
  });
  const el = document.getElementById('total-stars-display');
  if (cleared > 0) {
    el.textContent = `⭐ ${total} stars  ·  ${cleared} levels cleared`;
  } else {
    el.textContent = '';
  }
  const btnCont = document.getElementById('btn-continue');
  if (sd.lastLevel && cleared > 0) {
    btnCont.style.display = '';
    btnCont.querySelector('span:last-child').textContent = `CONTINUE · LVL ${sd.lastLevel}`;
  }
}

// ── BUTTON BINDINGS ───────────────────────────────────────────
// Menu
document.getElementById('btn-play').addEventListener('click', () => {
  goToMap();
  activeChapter = 0;
  buildChapterStrip();
  buildStarMap();
});
document.getElementById('btn-continue').addEventListener('click', () => {
  const sd = Game.getSave();
  startGame(sd.lastLevel || 1);
});
document.getElementById('btn-howto').addEventListener('click', () => {
  document.getElementById('overlay-howto').classList.add('show');
});
document.getElementById('btn-settings').addEventListener('click', () => {
  loadSettingsUI();
  document.getElementById('overlay-settings').classList.add('show');
});

// Star map
document.getElementById('btn-map-back').addEventListener('click', goToMenu);
document.getElementById('btn-chapter-prev').addEventListener('click', () => {
  activeChapter = Math.max(0, activeChapter - 1);
  buildChapterStrip(); buildStarMap();
});
document.getElementById('btn-chapter-next').addEventListener('click', () => {
  activeChapter = Math.min(CHAPTERS.length-1, activeChapter+1);
  buildChapterStrip(); buildStarMap();
});

// Game header
document.getElementById('btn-pause').addEventListener('click', () => {
  const G = Game.getState();
  if (!G || G.over) return;
  Game.pause();
  document.getElementById('overlay-pause').classList.add('show');
});

// Win overlay
document.getElementById('btn-next-level').addEventListener('click', () => {
  const G = Game.getState();
  const next = Math.min((G?.levelId || 1) + 1, 300);
  hideAllOverlays();
  startGame(next);
});
document.getElementById('btn-replay-win').addEventListener('click', () => {
  const G = Game.getState();
  const id = G?.levelId || 1;
  hideAllOverlays();
  startGame(id);
});
document.getElementById('btn-map-from-win').addEventListener('click', goToMap);

// Lose overlay
document.getElementById('btn-replay-lose').addEventListener('click', () => {
  const G = Game.getState();
  const id = G?.levelId || 1;
  hideAllOverlays();
  startGame(id);
});
document.getElementById('btn-map-from-lose').addEventListener('click', goToMap);

// Pause overlay
document.getElementById('btn-resume').addEventListener('click', () => {
  Game.resume();
  hideAllOverlays();
});
document.getElementById('btn-restart').addEventListener('click', () => {
  const G = Game.getState();
  const id = G?.levelId || 1;
  hideAllOverlays();
  startGame(id);
});
document.getElementById('btn-pause-map').addEventListener('click', goToMap);

// How to play
document.getElementById('btn-howto-close').addEventListener('click', () => {
  document.getElementById('overlay-howto').classList.remove('show');
});

// Settings
document.getElementById('btn-settings-close').addEventListener('click', () => {
  saveSettingsUI();
  document.getElementById('overlay-settings').classList.remove('show');
});
document.getElementById('btn-reset-save').addEventListener('click', () => {
  if (confirm('Reset ALL progress? This cannot be undone.')) {
    Game.resetSave();
    updateMenuFooter();
    document.getElementById('overlay-settings').classList.remove('show');
    document.getElementById('btn-continue').style.display = 'none';
  }
});

function loadSettingsUI() {
  const sd = Game.getSave();
  const s  = sd.settings || {};
  document.getElementById('snd-toggle').checked  = s.sound    !== false;
  document.getElementById('hap-toggle').checked  = s.haptics  !== false;
  document.getElementById('part-toggle').checked = s.particles !== false;
  document.getElementById('hint-toggle').checked = s.hints    !== false;
}

function saveSettingsUI() {
  const sd = Game.getSave();
  sd.settings = {
    sound:     document.getElementById('snd-toggle').checked,
    haptics:   document.getElementById('hap-toggle').checked,
    particles: document.getElementById('part-toggle').checked,
    hints:     document.getElementById('hint-toggle').checked,
  };
  const { Save } = (() => {
    // re-reference save write
    return { Save: { write: (d) => localStorage.setItem('nebula_jewels_v3', JSON.stringify(d)) } };
  })();
  Save.write(sd);
  Game.applySettings(sd.settings);
}

// ── HAPTIC FEEDBACK ON ALL BUTTONS ───────────────────────────
document.querySelectorAll('.btn, .icon-btn, .lvl-node, .powerup-btn').forEach(btn => {
  btn.addEventListener('pointerdown', e => {
    const rect = btn.getBoundingClientRect();
    btn.style.setProperty('--rx', ((e.clientX - rect.left) / rect.width * 100) + '%');
    btn.style.setProperty('--ry', ((e.clientY - rect.top) / rect.height * 100) + '%');
  });
});

// ── INIT ──────────────────────────────────────────────────────
(function init() {
  // Ensure level 1 is always unlocked
  const sd = Game.getSave();
  if (!sd.levels[1]) {
    sd.levels[1] = {stars:0, score:0};
    localStorage.setItem('nebula_jewels_v3', JSON.stringify(sd));
  }
  updateMenuFooter();
  loadSettingsUI();
  Game.applySettings(sd.settings || {});
  showScreen('screen-menu');
})();
