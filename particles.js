/* ═══════════════════════════════════════════════════════════
   NEBULA JEWELS  ·  particles.js
   High-performance canvas particle system
═══════════════════════════════════════════════════════════ */
'use strict';

const Particles = (() => {
  const canvas = document.getElementById('particle-canvas');
  const ctx = canvas.getContext('2d');
  let enabled = true;
  let pool = [];         // reusable particle pool
  let active = [];

  const MAX_PARTICLES = 400;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function getParticle() {
    return pool.length > 0 ? pool.pop() : {};
  }
  function recycleParticle(p) {
    if (pool.length < MAX_PARTICLES) pool.push(p);
  }

  function setEnabled(v) { enabled = v; }

  // ── EMITTERS ─────────────────────────────────────────────

  function burst(x, y, color, count = 14, speed = 1) {
    if (!enabled) return;
    count = Math.min(count, 30);
    for (let i = 0; i < count; i++) {
      const p = getParticle();
      const angle = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.8;
      const spd   = (2.5 + Math.random() * 5) * speed;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd - 1.5;
      p.color  = color;
      p.size   = 2.2 + Math.random() * 3.5;
      p.life   = 1;
      p.decay  = 0.022 + Math.random() * 0.022;
      p.gravity= 0.16;
      p.type   = 'circle';
      p.trail  = [];
      active.push(p);
    }
  }

  function sparkle(x, y, color, count = 8) {
    if (!enabled) return;
    for (let i = 0; i < count; i++) {
      const p = getParticle();
      const angle = Math.random() * Math.PI * 2;
      const spd   = 1 + Math.random() * 3;
      p.x = x + (Math.random() - 0.5) * 20;
      p.y = y + (Math.random() - 0.5) * 20;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd - 2;
      p.color  = color;
      p.size   = 1 + Math.random() * 2;
      p.life   = 1;
      p.decay  = 0.03 + Math.random() * 0.03;
      p.gravity= 0.08;
      p.type   = 'star';
      p.trail  = [];
      active.push(p);
    }
  }

  function lineBlast(x, y, color, horizontal = true) {
    if (!enabled) return;
    const count = 22;
    for (let i = 0; i < count; i++) {
      const p = getParticle();
      const dir = horizontal ? 0 : Math.PI / 2;
      const spread = (Math.random() - 0.5) * 0.8;
      const angle  = dir + spread + (Math.random() > 0.5 ? Math.PI : 0);
      const spd    = 3 + Math.random() * 7;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.color  = color;
      p.size   = 2 + Math.random() * 3;
      p.life   = 1;
      p.decay  = 0.018 + Math.random() * 0.018;
      p.gravity= 0.1;
      p.type   = 'circle';
      p.trail  = [];
      active.push(p);
    }
  }

  function explosion(x, y, colors, count = 50) {
    if (!enabled) return;
    for (let i = 0; i < count; i++) {
      const p = getParticle();
      const angle = Math.random() * Math.PI * 2;
      const spd   = 3 + Math.random() * 12;
      const color = colors[Math.floor(Math.random() * colors.length)];
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd - 4;
      p.color  = color;
      p.size   = 2 + Math.random() * 5;
      p.life   = 1;
      p.decay  = 0.01 + Math.random() * 0.012;
      p.gravity= 0.15;
      p.type   = Math.random() > 0.5 ? 'circle' : 'star';
      p.trail  = [];
      active.push(p);
    }
  }

  function ripple(x, y, color) {
    if (!enabled) return;
    const p = getParticle();
    p.x = x; p.y = y;
    p.vx = 0; p.vy = 0;
    p.color = color;
    p.radius = 5;
    p.maxRadius = 45;
    p.life = 1;
    p.decay = 0.045;
    p.gravity = 0;
    p.type = 'ripple';
    p.trail = [];
    active.push(p);
  }

  function winFireworks(w, h, colors) {
    if (!enabled) return;
    const spots = [
      [w*0.25, h*0.3], [w*0.75, h*0.3],
      [w*0.5,  h*0.4], [w*0.2,  h*0.5],
      [w*0.8,  h*0.5],
    ];
    spots.forEach(([x, y], i) => {
      setTimeout(() => explosion(x, y, colors, 40), i * 120);
    });
  }

  // ── UPDATE / RENDER ──────────────────────────────────────

  function update() {
    const dead = [];
    for (let i = active.length - 1; i >= 0; i--) {
      const p = active[i];
      if (p.type === 'ripple') {
        p.radius += (p.maxRadius - p.radius) * 0.12;
        p.life -= p.decay;
      } else {
        if (p.trail !== undefined && p.trail.length < 4) p.trail.push({x: p.x, y: p.y});
        if (p.trail.length > 4) p.trail.shift();
        p.vy += p.gravity;
        p.vx *= 0.97;
        p.x += p.vx;
        p.y += p.vy;
        p.size *= 0.97;
        p.life -= p.decay;
      }
      if (p.life <= 0) {
        dead.push(i);
        recycleParticle(p);
      }
    }
    for (const i of dead) active.splice(i, 1);
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of active) {
      ctx.globalAlpha = Math.max(0, p.life);

      if (p.type === 'ripple') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth   = 2;
        ctx.shadowColor = p.color;
        ctx.shadowBlur  = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }

      // trail
      if (p.trail.length > 1) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth   = p.size * 0.5;
        ctx.lineCap     = 'round';
        ctx.shadowColor = p.color;
        ctx.shadowBlur  = 4;
        ctx.beginPath();
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (let t = 1; t < p.trail.length; t++) ctx.lineTo(p.trail[t].x, p.trail[t].y);
        ctx.stroke();
      }

      ctx.shadowColor = p.color;
      ctx.shadowBlur  = p.size * 2;
      ctx.fillStyle   = p.color;

      if (p.type === 'star') {
        // 4-pointed star
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * 3);
        ctx.beginPath();
        const r1 = p.size, r2 = p.size * 0.4;
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI / 4);
          const r = i % 2 === 0 ? r1 : r2;
          i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, p.size), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  }

  function tick() { update(); render(); }
  function clear() { active.length = 0; }

  return { burst, sparkle, lineBlast, explosion, ripple, winFireworks, tick, clear, setEnabled, resize };
})();
