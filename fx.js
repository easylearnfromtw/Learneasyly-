/* Learn Angle 鼓勵特效
   彩帶 紅筆打勾 數字跳動 滑鼠聚光 觸覺回饋 */
(function () {
  "use strict";
  const FX = { enabled: true, haptics: true };
  const reduce = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const on = () => FX.enabled && !reduce.matches;
  FX.on = on;

  /* 彩帶粒子 */
  let canvas, ctx, dpr = 1, parts = [], running = false, last = 0;
  const PALETTE = ["#2f5f8f", "#8fbbe3", "#d2412e", "#f5d562", "#cfe2f5", "#ffffff", "#f3a65a", "#fbeec0"];
  const GOLD = ["#f6df55", "#f3c84b", "#e2a92c", "#fff4c2", "#ffffff", "#f3a65a"];
  function ensure() {
    if (canvas) return true;
    canvas = document.getElementById("fxCanvas");
    if (!canvas || !canvas.getContext) return false;
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize, { passive: true });
    return true;
  }
  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function particle(x, y, vx, vy, colors) {
    const kind = Math.random();
    return {
      x, y, vx, vy,
      w: rand(6, 11), h: rand(9, 16),
      rot: rand(0, Math.PI * 2), vr: rand(-0.25, 0.25),
      flip: rand(0, Math.PI * 2), vf: rand(0.08, 0.22),
      sway: rand(0, Math.PI * 2),
      shape: kind < 0.55 ? 0 : kind < 0.82 ? 1 : 2,
      color: colors[(Math.random() * colors.length) | 0],
      life: 1, decay: rand(0.0035, 0.007), drag: rand(0.965, 0.985), g: rand(0.16, 0.26)
    };
  }
  function star(c, r) {
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.38 : r;
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath(); c.fill();
  }
  function tick(now) {
    const dt = Math.min(2.2, (now - last) / 16.67 || 1); last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.vx *= Math.pow(p.drag, dt); p.vy = p.vy * Math.pow(p.drag, dt) + p.g * dt;
      p.sway += 0.05 * dt;
      p.x += (p.vx + Math.sin(p.sway) * 0.6) * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt; p.flip += p.vf * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0 || p.y > innerHeight + 40) { parts.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life * 2.2);
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      const s = Math.cos(p.flip);
      ctx.scale(1, s);
      ctx.fillStyle = p.color;
      if (p.shape === 0) ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      else if (p.shape === 1) { ctx.beginPath(); ctx.ellipse(0, 0, p.w * 0.45, p.w * 0.45, 0, 0, Math.PI * 2); ctx.fill(); }
      else star(ctx, p.w * 0.85);
      ctx.restore();
    }
    if (parts.length) requestAnimationFrame(tick);
    else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }
  function start() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); } }

  FX.burst = function (x, y, opt) {
    if (!on() || !ensure()) return;
    opt = opt || {};
    const n = Math.round((opt.count || 46) * (FX.lite ? 0.45 : 1)), power = opt.power || 10, colors = opt.gold ? GOLD : (opt.colors || PALETTE);
    const angle = opt.angle == null ? -Math.PI / 2 : opt.angle, spread = opt.spread == null ? Math.PI * 1.1 : opt.spread;
    for (let i = 0; i < n; i++) {
      const a = angle + rand(-spread / 2, spread / 2), v = rand(power * 0.45, power);
      parts.push(particle(x, y, Math.cos(a) * v, Math.sin(a) * v, colors));
    }
    if (parts.length > 420) parts.splice(0, parts.length - 420);
    start();
  };
  FX.fromEl = function (el, opt) {
    if (!el || !el.getBoundingClientRect) return;
    const r = el.getBoundingClientRect();
    FX.burst(r.left + r.width / 2, r.top + r.height / 2, opt);
  };
  FX.rain = function (opt) {
    if (!on() || !ensure()) return;
    opt = opt || {};
    const n = Math.round((opt.count || 150) * (FX.lite ? 0.4 : 1)), colors = opt.gold ? GOLD : PALETTE;
    for (let i = 0; i < n; i++) {
      const p = particle(rand(0, innerWidth), rand(-innerHeight * 0.5, -10), rand(-1.5, 1.5), rand(1, 4), colors);
      p.decay = rand(0.0025, 0.0045); p.g = rand(0.06, 0.12); p.drag = 0.99;
      parts.push(p);
    }
    FX.burst(innerWidth * 0.18, innerHeight * 0.9, { count: 50, angle: -Math.PI * 0.38, spread: 0.7, power: 19, gold: opt.gold });
    FX.burst(innerWidth * 0.82, innerHeight * 0.9, { count: 50, angle: -Math.PI * 0.62, spread: 0.7, power: 19, gold: opt.gold });
  };

  /* 紅筆打勾 */
  FX.check = function (host) {
    if (!host || !on()) return;
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 150 120");
    svg.setAttribute("class", "redcheck");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", "M16 64c9 6 19 16 30 33 2 3 5 3 7 0 19-35 47-62 82-84");
    svg.appendChild(path);
    host.appendChild(svg);
    try { path.style.setProperty("--len", String(Math.ceil(path.getTotalLength()) + 2)); } catch (e) { path.style.setProperty("--len", "240"); }
    setTimeout(() => {
      if (svg.animate) svg.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(-6px)" }], { duration: 420, easing: "ease-out", fill: "forwards" });
      setTimeout(() => svg.remove(), 450);
    }, 1100);
  };

  /* 數字跳動 */
  const fmt = (n) => Math.round(n).toLocaleString("en-US").replace(/,/g, " ");
  FX.count = function (el, value, unit) {
    if (!el) return;
    if (value == null || Number.isNaN(value)) { el.innerHTML = '<span class="na">尚無</span>'; el.dataset.count = ""; return; }
    const from = Number(el.dataset.count || 0), to = Number(value);
    el.dataset.count = String(to);
    const u = unit ? '<span class="unit">' + unit + "</span>" : "";
    if (!on() || from === to || document.hidden) { el.innerHTML = fmt(to) + u; return; }
    const t0 = performance.now(), dur = Math.min(1100, 500 + Math.abs(to - from) * 18);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el.innerHTML = fmt(from + (to - from) * e) + u;
      if (k < 1 && el.dataset.count === String(to)) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /* 觸覺 */
  FX.haptic = function (pattern) {
    if (!FX.haptics || !navigator.vibrate) return;
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try { navigator.vibrate(pattern || 12); } catch (e) {}
  };

  /* 滑鼠聚光 */
  if (window.matchMedia && matchMedia("(hover: hover)").matches) {
    let raf = 0, ev = null;
    document.addEventListener("pointermove", (e) => {
      ev = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = ev.target && ev.target.closest ? ev.target.closest(".spot") : null;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", (ev.clientX - r.left) + "px");
        el.style.setProperty("--my", (ev.clientY - r.top) + "px");
      });
    }, { passive: true });
  }

  window.FX = FX;
})();
