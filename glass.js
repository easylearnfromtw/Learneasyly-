/* Learn Angle 液態玻璃控制層
   彈簧驅動的共用膠囊 分頁列放大鏡膠囊 分段控制 圖片放大鏡 */
(function () {
  "use strict";
  const reduce = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  /* 彈簧與共用動畫迴圈 */
  const active = new Set();
  let looping = false, lastT = 0;
  function loop(now) {
    const dt = Math.min(0.034, (now - lastT) / 1000 || 0.016); lastT = now;
    active.forEach((s) => { if (s.step(dt)) active.delete(s); });
    if (active.size) requestAnimationFrame(loop); else looping = false;
  }
  function kick(s) { active.add(s); if (!looping) { looping = true; lastT = performance.now(); requestAnimationFrame(loop); } }
  function Spring(value, onUpdate, k, c) {
    this.x = value; this.v = 0; this.t = value; this.k = k || 420; this.c = c || 26; this.onUpdate = onUpdate;
  }
  Spring.prototype.to = function (t, instant) {
    this.t = t;
    if (instant || reduce.matches) { this.x = t; this.v = 0; this.onUpdate(this.x); active.delete(this); return; }
    kick(this);
  };
  Spring.prototype.set = function (x) { this.x = x; this.t = x; this.v = 0; this.onUpdate(x); active.delete(this); };
  Spring.prototype.step = function (dt) {
    const n = 2, h = dt / n;
    for (let i = 0; i < n; i++) { const f = -this.k * (this.x - this.t) - this.c * this.v; this.v += f * h; this.x += this.v * h; }
    const done = Math.abs(this.x - this.t) < 0.05 && Math.abs(this.v) < 0.05;
    if (done) { this.x = this.t; this.v = 0; }
    this.onUpdate(this.x);
    return done;
  };

  /* 共用膠囊群組
     axis x 為水平 y 為垂直
     可拖曳時 按住放大 放開後吸附到最近的選項 */
  function capsuleGroup(root, opt) {
    const capsule = root.querySelector(opt.capsule);
    const lens = opt.lens ? root.querySelector(opt.lens) : null;
    const axis = opt.axis || "x";
    const items = () => Array.from(root.querySelectorAll(opt.item));
    let idx = -1, start = null, dragging = false, suppress = false, inited = false;
    const pos = new Spring(0, (v) => { capsule.style.setProperty(axis === "x" ? "--x" : "--y", v + "px"); if (lens) lens.style.setProperty("--x", v + "px"); if (opt.onMove) opt.onMove(v, size.x); });
    const size = new Spring(0, (v) => { if (opt.sized) capsule.style.setProperty("--w", v + "px"); });
    const scale = new Spring(1, (v) => capsule.style.setProperty("--s", v.toFixed(4)), 520, 22);
    function geo(el) { return axis === "x" ? { a: el.offsetLeft, l: el.offsetWidth } : { a: el.offsetTop, l: el.offsetHeight }; }
    function moveTo(i, instant) {
      const list = items(); const el = list[i]; if (!el) return;
      idx = i;
      const g = geo(el);
      if (!el.offsetParent && !el.offsetWidth) return;
      const first = !inited; inited = true;
      pos.to(g.a, instant || first);
      size.to(g.l, instant || first);
    }
    function sync(instant) {
      const list = items();
      const i = opt.getActive ? opt.getActive(list) : list.findIndex((el) => el.classList.contains("active"));
      if (i >= 0) moveTo(i, instant);
    }
    function nearest(center) {
      const list = items(); let best = 0, bd = Infinity;
      list.forEach((el, i) => { const g = geo(el), d = Math.abs(g.a + g.l / 2 - center); if (d < bd) { bd = d; best = i; } });
      return best;
    }
    if (opt.draggable !== false) {
      root.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        start = { x: e.clientX, y: e.clientY, id: e.pointerId, base: pos.x };
        dragging = false;
        scale.to(opt.pressScale || 1.08);
        root.classList.add("pressed");
      });
      root.addEventListener("pointermove", (e) => {
        if (!start || e.pointerId !== start.id) return;
        const d = axis === "x" ? e.clientX - start.x : e.clientY - start.y;
        const o = axis === "x" ? e.clientY - start.y : e.clientX - start.x;
        if (!dragging && Math.abs(d) > 7 && Math.abs(d) > Math.abs(o)) {
          dragging = true;
          try { root.setPointerCapture(e.pointerId); } catch (err) {}
          root.classList.add("dragging");
        }
        if (dragging) {
          const r = root.getBoundingClientRect();
          const list = items(); const firstG = geo(list[0]), lastG = geo(list[list.length - 1]);
          const pointer = (axis === "x" ? e.clientX - r.left : e.clientY - r.top) - size.x / 2;
          const min = firstG.a - 6, max = lastG.a + lastG.l - size.x + 6;
          let x = pointer;
          if (x < min) x = min - Math.sqrt(min - x) * 2;
          if (x > max) x = max + Math.sqrt(x - max) * 2;
          pos.set(x);
          const ni = nearest(x + size.x / 2);
          if (opt.sized) { const g = geo(list[ni]); size.to(g.l); }
          if (opt.onHover) opt.onHover(ni);
        }
      });
      const end = (e) => {
        if (!start) return;
        scale.to(1);
        root.classList.remove("pressed");
        if (dragging) {
          const ni = nearest(pos.x + size.x / 2);
          suppress = true; setTimeout(() => { suppress = false; }, 80);
          moveTo(ni);
          if (opt.onPick) opt.onPick(ni, items()[ni], e);
        }
        dragging = false; start = null;
        root.classList.remove("dragging");
      };
      root.addEventListener("pointerup", end);
      root.addEventListener("pointercancel", end);
      root.addEventListener("lostpointercapture", end);
      root.addEventListener("click", (e) => { if (suppress) { e.preventDefault(); e.stopPropagation(); } }, true);
    }
    window.addEventListener("resize", () => sync(true), { passive: true });
    return { sync, moveTo, get index() { return idx; }, pos, size };
  }

  /* 底部分頁列 鏡片膠囊 */
  function tabbar(nav, onPick) {
    const track = nav.querySelector(".tab-track");
    const lens = nav.querySelector(".tab-lens");
    const tabs = Array.from(track.querySelectorAll(":scope > .tab"));
    tabs.forEach((t) => {
      const c = t.cloneNode(true);
      c.removeAttribute("data-go"); c.removeAttribute("id"); c.setAttribute("tabindex", "-1"); c.setAttribute("aria-hidden", "true");
      c.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
      lens.appendChild(c);
    });
    const capW = () => (tabs[0] ? tabs[0].offsetWidth : 64);
    function hideUnder(x) {
      const w = capW();
      tabs.forEach((t) => {
        const a = t.offsetLeft, b = a + t.offsetWidth;
        const ov = Math.max(0, Math.min(b, x + w) - Math.max(a, x)) / t.offsetWidth;
        t.style.opacity = (1 - Math.min(1, ov * 1.15)).toFixed(3);
      });
    }
    const group = capsuleGroup(track, {
      capsule: ".tab-capsule", lens: ".tab-lens", item: ":scope > .tab", pressScale: 1.14,
      getActive: (list) => list.findIndex((el) => el.classList.contains("active")),
      onMove: (x) => hideUnder(x),
      onPick: (i, el) => { if (el && onPick) onPick(el.dataset.go); }
    });
    /* 往下捲動時縮小 往上恢復 */
    let lastY = window.scrollY, ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const y = window.scrollY, dy = y - lastY;
        if (Math.abs(dy) > 6) { nav.classList.toggle("compact", dy > 0 && y > 90); lastY = y; }
      });
    }, { passive: true });
    return group;
  }

  /* 側欄垂直膠囊 */
  function sidebar(nav) {
    return capsuleGroup(nav, { capsule: ".side-capsule", item: ".side-item", axis: "y", draggable: false });
  }

  /* 分段控制 */
  function segmented(root, onPick) {
    const g = capsuleGroup(root, {
      capsule: ".seg-capsule", item: ".seg-item", sized: true, pressScale: 1.05,
      getActive: (list) => list.findIndex((el) => el.classList.contains("active") || !!el.querySelector("input:checked")),
      onPick: (i, el) => onPick && onPick(i, el)
    });
    return g;
  }

  /* 圖片放大鏡 邊緣折射 */
  let mapReady = null;
  function lensMap(w, h) {
    if (mapReady && mapReady.w === w && mapReady.h === h) return mapReady.url;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"), img = g.createImageData(w, h), d = img.data;
    const r = Math.min(w, h) / 2, band = 24;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = x + 0.5 - w / 2, py = y + 0.5 - h / 2;
      const qx = Math.abs(px) - (w / 2 - r), qy = Math.abs(py) - (h / 2 - r);
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
      const sd = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
      let nx = 0, ny = 0;
      if (qx > 0 || qy > 0) { const L = Math.hypot(ox, oy) || 1; nx = (ox / L) * Math.sign(px); ny = (oy / L) * Math.sign(py); }
      else if (qx > qy) nx = Math.sign(px); else ny = Math.sign(py);
      let k = 0;
      if (sd < 0 && sd > -band) { const t = 1 + sd / band; k = t * t; }
      const i = (y * w + x) * 4;
      d[i] = 128 - nx * k * 127; d[i + 1] = 128 - ny * k * 127; d[i + 2] = 128; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    mapReady = { w, h, url: c.toDataURL() };
    return mapReady.url;
  }
  function magnifier(stage, img, lensEl, view, zoom) {
    zoom = zoom || 2.4;
    let on = false, W = 0, H = 0, tx = 0, ty = 0, touchOffset = 0;
    const px = new Spring(0, apply, 300, 26), py = new Spring(0, apply, 300, 26);
    function setup() {
      W = lensEl.offsetWidth || 210; H = lensEl.offsetHeight || 136;
      const fe = document.getElementById("lensMap");
      if (fe) {
        const url = lensMap(W, H);
        fe.setAttribute("href", url); fe.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", url);
        fe.setAttribute("width", W); fe.setAttribute("height", H); fe.setAttribute("x", 0); fe.setAttribute("y", 0);
      }
      view.style.backgroundImage = 'url("' + img.src + '")';
    }
    function apply() {
      const iw = img.clientWidth, ih = img.clientHeight;
      const cx = Math.max(0, Math.min(iw, px.x)), cy = Math.max(0, Math.min(ih, py.x));
      lensEl.style.setProperty("--lx", (px.x - W / 2) + "px");
      lensEl.style.setProperty("--ly", (py.x - H / 2 - touchOffset) + "px");
      view.style.backgroundSize = (iw * zoom) + "px " + (ih * zoom) + "px";
      view.style.backgroundPosition = (-(cx * zoom - W / 2)) + "px " + (-(cy * zoom - H / 2)) + "px";
    }
    function point(e, instant) {
      const r = img.getBoundingClientRect();
      tx = e.clientX - r.left; ty = e.clientY - r.top;
      touchOffset = e.pointerType === "touch" ? 92 : 0;
      if (instant) { px.set(tx); py.set(ty); } else { px.to(tx); py.to(ty); }
    }
    stage.addEventListener("pointerdown", (e) => { if (!on) return; e.preventDefault(); lensEl.classList.add("pressed"); point(e); try { stage.setPointerCapture(e.pointerId); } catch (err) {} });
    stage.addEventListener("pointermove", (e) => { if (!on) return; if (e.pointerType === "mouse" || e.buttons) point(e); });
    stage.addEventListener("pointerup", () => lensEl.classList.remove("pressed"));
    return {
      enable(v) {
        on = v; lensEl.hidden = !v;
        if (v) { setup(); px.set(img.clientWidth / 2); py.set(img.clientHeight / 2); }
      },
      get on() { return on; },
      refresh() { if (on) setup(); }
    };
  }

  window.Glass = { Spring, capsuleGroup, tabbar, sidebar, segmented, magnifier };
})();
