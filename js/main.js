/* NeelaOS website: one small script, every module optional.
   Each init only runs when its markup exists on the page. */
(() => {
  "use strict";

  const doc = document.documentElement;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const mobileNav = matchMedia("(max-width: 999px)");
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  /* ---------- Top bar: glass when scrolled, auto-hide on mobile, progress fallback ---------- */
  function initTopbar() {
    const bar = $("[data-topbar]");
    if (!bar) return;
    const progress = $(".topbar__progress", bar);
    const needsProgressJs = progress && !CSS.supports("animation-timeline: scroll()");
    let lastY = scrollY, ticking = false;

    const update = () => {
      ticking = false;
      const y = scrollY;
      bar.classList.toggle("is-solid", y > 24);
      const dy = y - lastY;
      if (mobileNav.matches && y > 140 && dy > 6) bar.classList.add("is-hidden");
      else if (dy < -6 || y < 140) bar.classList.remove("is-hidden");
      lastY = y;
      if (needsProgressJs) {
        const max = doc.scrollHeight - innerHeight;
        progress.style.setProperty("--progress", max > 0 ? (y / max).toFixed(4) : 0);
      }
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    bar.addEventListener("focusin", () => bar.classList.remove("is-hidden"));
    update();
  }

  /* ---------- Desktop links: sliding pill that follows hover and the active section ---------- */
  let movePillTo = () => {};
  function initPill() {
    const links = $("[data-links]");
    if (!links) return;
    const pill = $(".links__pill", links);
    let active = null, hovering = false;
    const place = (a) => {
      if (!a) { links.classList.remove("has-pill"); return; }
      pill.style.setProperty("--px", `${a.offsetLeft}px`);
      pill.style.setProperty("--pw", `${a.offsetWidth}px`);
      links.classList.add("has-pill");
    };
    links.addEventListener("pointerover", (e) => { const a = e.target.closest("a"); if (a) { hovering = true; place(a); } });
    links.addEventListener("pointerleave", () => { hovering = false; place(active); });
    movePillTo = (a) => { active = a; if (!hovering) place(a); };
    document.fonts?.ready.then(() => place(active));
    addEventListener("resize", () => place(active), { passive: true });
  }

  /* ---------- Scroll-spy: one observer drives the top links, dock and Start menu ---------- */
  function initScrollspy() {
    // Sections without their own nav entry light up the closest related one.
    const GROUP = { top: "top", why: "top", features: "features", wallpapers: "wallpapers", specs: "features", who: "features", install: "install", updates: "install", about: "about", faq: "faq" };
    const DOCK_FALLBACK = { wallpapers: "features" };
    const topLinks = $$("[data-links] a");
    const dockLinks = $$(".dock__item");
    const menuLinks = $$(".startmenu__grid a");

    const mark = (list, hash) => list.forEach((a) => {
      const on = a.hash === hash;
      a.classList.toggle("is-active", on);
      on ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current");
    });

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const id = e.target.id;
        const group = GROUP[id] || id;
        mark(topLinks, `#${group}`);
        mark(dockLinks, `#${DOCK_FALLBACK[group] || group}`);
        mark(menuLinks, `#${id}`);
        movePillTo(topLinks.find((a) => a.hash === `#${group}`) || null);
      }
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(GROUP).forEach((id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ---------- Start menu (bottom sheet dialog) ---------- */
  function initStartMenu() {
    const dlg = $("#startmenu");
    const btn = $("[data-start]");
    if (!dlg || !btn || typeof dlg.showModal !== "function") return;

    const close = () => { if (dlg.open) dlg.close(); };
    btn.addEventListener("click", () => {
      if (dlg.open) return close();
      dlg.style.removeProperty("--drag");
      dlg.showModal();
      btn.setAttribute("aria-expanded", "true");
    });
    dlg.addEventListener("close", () => {
      btn.setAttribute("aria-expanded", "false");
      setTimeout(() => dlg.style.removeProperty("--drag"), 400);
    });
    $("[data-close]", dlg)?.addEventListener("click", close);

    dlg.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (a && a.hash) {
        e.preventDefault();
        close();
        const target = document.getElementById(a.hash.slice(1));
        requestAnimationFrame(() => {
          target?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
          history.replaceState(null, "", a.hash);
        });
        return;
      }
      if (a) return close();
      // A click on the ::backdrop lands on the dialog element itself, outside its box.
      if (e.target === dlg) {
        const r = dlg.getBoundingClientRect();
        if (e.clientY < r.top || e.clientX < r.left || e.clientX > r.right) close();
      }
    });

    // Swipe the sheet down to dismiss it.
    let startY = null, dy = 0;
    const onDown = (e) => {
      if (e.target.closest("button, a")) return;
      startY = e.clientY; dy = 0;
      dlg.classList.add("is-dragging");
      e.currentTarget.setPointerCapture(e.pointerId);
    };
    const onMove = (e) => {
      if (startY == null) return;
      dy = Math.max(0, e.clientY - startY);
      dlg.style.setProperty("--drag", `${dy}px`);
    };
    const onUp = () => {
      if (startY == null) return;
      startY = null;
      dlg.classList.remove("is-dragging");
      if (dy > 90) close(); else dlg.style.setProperty("--drag", "0px");
    };
    $$("[data-grab], .startmenu__head", dlg).forEach((h) => {
      h.addEventListener("pointerdown", onDown);
      h.addEventListener("pointermove", onMove);
      h.addEventListener("pointerup", onUp);
      h.addEventListener("pointercancel", onUp);
    });
    mobileNav.addEventListener("change", (e) => { if (!e.matches) close(); });
  }

  /* ---------- Reveal on scroll + pause loops off-screen ---------- */
  function initObservers() {
    $$("[data-stagger]").forEach((parent) => {
      [...parent.children].forEach((child, i) => {
        if (!child.hasAttribute("data-reveal")) child.setAttribute("data-reveal", "");
        child.style.setProperty("--d", i);
      });
    });

    const targets = $$("[data-reveal], [data-io], .shot");
    if (!("IntersectionObserver" in window)) { targets.forEach((el) => el.classList.add("is-in")); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    targets.forEach((el) => io.observe(el));

    const loops = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle("is-off", !e.isIntersecting);
    });
    $$("[data-loop]").forEach((el) => loops.observe(el));
  }

  /* ---------- Custom cursor: spark, stretchy ring, ember trail, facet burst ---------- */
  function initCursor() {
    if (!finePointer) return;
    const make = (cls, html = "") => {
      const el = document.createElement("div");
      el.className = `cur ${cls}`;
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = html;
      document.body.append(el);
      return el;
    };
    const trail = Array.from({ length: reduceMotion ? 0 : 7 }, (_, i) => {
      const el = make("cur-trail");
      return { el, x: -100, y: -100, scale: 1 - i * 0.11, alpha: 0.6 - i * 0.075 };
    });
    const ring = make("cur-ring", '<div class="cur-ring__body"><i></i></div><b></b>');
    const body = ring.firstElementChild;
    const label = $("b", ring);
    const dot = make("cur-dot", "<i></i>");
    const all = [dot, ring, ...trail.map((t) => t.el)];

    const ease = reduceMotion ? 1 : 0.18;
    let mx = -100, my = -100, rx = -100, ry = -100, stretch = 0, raf = 0, shown = false, state = "";
    const noStretch = new Set(["media", "drag", "text", "code"]);

    const frame = () => {
      rx += (mx - rx) * ease;
      ry += (my - ry) * ease;
      const dx = mx - rx, dy = my - ry;
      const speed = Math.hypot(dx, dy);
      const target = noStretch.has(state) || reduceMotion ? 0 : Math.min(speed / 90, 0.38);
      stretch += (target - stretch) * 0.25;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      body.style.transform = stretch > 0.01 ? `rotate(${Math.atan2(dy, dx)}rad) scale(${1 + stretch}, ${1 - stretch * 0.55})` : "none";

      let px = mx, py = my, tail = 0;
      for (const t of trail) {
        t.x += (px - t.x) * 0.38;
        t.y += (py - t.y) * 0.38;
        t.el.style.transform = `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.scale})`;
        px = t.x; py = t.y;
      }
      if (trail.length) tail = Math.hypot(mx - px, my - py);
      raf = speed > 0.15 || tail > 0.3 || stretch > 0.01 ? requestAnimationFrame(frame) : 0;
    };

    const show = (on) => {
      shown = on;
      all.forEach((el) => el.classList.toggle("is-on", on));
      trail.forEach((t) => { t.el.style.opacity = on ? t.alpha : 0; });
    };

    addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      mx = e.clientX; my = e.clientY;
      if (!shown) {
        if (rx < 0) { rx = mx; ry = my; trail.forEach((t) => { t.x = mx; t.y = my; }); }
        doc.classList.add("has-cursor");
        show(true);
      }
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      if (!raf) raf = requestAnimationFrame(frame);
    }, { passive: true });

    document.addEventListener("mouseout", (e) => { if (!e.relatedTarget) show(false); });

    addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse") return;
      doc.classList.add("cur-down");
      if (reduceMotion) return;
      const burst = document.createElement("div");
      burst.className = "cur-burst";
      burst.setAttribute("aria-hidden", "true");
      burst.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      const colors = ["#5FD3D1", "#F2D678", "#DCEFF5", "#46C1CF", "#D69510"];
      const n = 8;
      burst.innerHTML = Array.from({ length: n }, (_, i) =>
        `<i style="--a:${Math.round(i * (360 / n) + Math.random() * 20)}deg;--dist:${Math.round(26 + Math.random() * 18)}px;--c:${colors[i % colors.length]}"></i>`).join("");
      document.body.append(burst);
      setTimeout(() => burst.remove(), 700);
    });
    addEventListener("pointerup", () => doc.classList.remove("cur-down"));

    document.addEventListener("pointerover", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      let next = "";
      const explicit = t.closest("[data-cursor]");
      if (explicit) {
        next = explicit.dataset.cursor;
        label.textContent = explicit.dataset.cursorLabel || (next === "drag" ? "Drag" : "View");
      } else if (t.closest(".btn--primary")) next = "cta";
      else if (t.closest("a, button, summary, label, input, select, [role='button']")) next = "link";
      else if (t.closest(".term, pre, kbd, .codebox")) next = "code";
      else if (t.closest("p, h1, h2, h3, li, dd, dt, blockquote")) next = "text";
      if (next === state) return;
      state = next;
      if (state) doc.dataset.cur = state; else delete doc.dataset.cur;
    });
  }

  /* ---------- Magnetic primary buttons ---------- */
  function initMagnetic() {
    if (!finePointer || reduceMotion) return;
    $$(".btn--primary").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        el.style.setProperty("--mx", `${(dx * 6).toFixed(2)}px`);
        el.style.setProperty("--my", `${(dy * 5).toFixed(2)}px`);
      });
      el.addEventListener("pointerleave", () => { el.style.setProperty("--mx", "0px"); el.style.setProperty("--my", "0px"); });
    });
  }

  /* ---------- Hero: gold sparks drifting on the wind ---------- */
  function initSparks() {
    const canvas = $(".hero__sparks");
    if (!canvas || reduceMotion || innerWidth < 600) return;
    const ctx = canvas.getContext("2d");
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 32;
    const sctx = sprite.getContext("2d");
    const g = sctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, "rgba(255,240,190,1)");
    g.addColorStop(0.25, "rgba(242,214,120,.9)");
    g.addColorStop(0.6, "rgba(214,149,16,.25)");
    g.addColorStop(1, "rgba(214,149,16,0)");
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, 32, 32);

    let w = 0, h = 0, top = 0, parts = [], raf = 0, visible = true, scrolling = false, scrollT;
    const mouse = { x: -1e4, y: -1e4 };
    const make = (anywhere) => ({ x: anywhere ? Math.random() * w : -12, y: Math.random() * h, s: Math.random() * 7 + 3, vx: Math.random() * 0.35 + 0.1, vy: (Math.random() - 0.5) * 0.1, a: Math.random() * 0.55 + 0.3, t: Math.random() * 6.28, ox: 0, oy: 0 });
    // Soft glows don't need retina resolution: 1x keeps every frame cheap.
    const size = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height; top = r.top + scrollY;
      canvas.width = Math.round(w);
      canvas.height = Math.round(h);
      parts = Array.from({ length: Math.min(50, Math.round((w * h) / 26000)) }, () => make(true));
    };
    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.t += 0.018; p.x += p.vx; p.y += p.vy + Math.sin(p.t) * 0.12;
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 16900) { const d = Math.sqrt(d2) || 1, f = (130 - d) / 130; p.ox += (dx / d) * f * 1.4; p.oy += (dy / d) * f * 1.4; }
        p.ox *= 0.93; p.oy *= 0.93;
        if (p.x > w + 12) Object.assign(p, make(false));
        ctx.globalAlpha = p.a * (0.65 + 0.35 * Math.sin(p.t * 1.7));
        ctx.drawImage(sprite, p.x + p.ox - p.s / 2, p.y + p.oy - p.s / 2, p.s, p.s);
      }
      raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!raf && visible && !scrolling && !document.hidden) raf = requestAnimationFrame(frame); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    size();
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(canvas);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    let rt;
    addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(size, 160); });
    // Freeze the sparks while the page scrolls so every frame goes to scrolling.
    addEventListener("scroll", () => {
      scrolling = true; stop();
      clearTimeout(scrollT);
      scrollT = setTimeout(() => { scrolling = false; start(); }, 160);
    }, { passive: true });
    addEventListener("pointermove", (e) => {
      if (!raf) return;
      mouse.x = e.clientX; mouse.y = e.clientY + scrollY - top;
    }, { passive: true });
    start();
  }

  /* ---------- Live keycaps ---------- */
  function initKeys() {
    const box = $("[data-keys]");
    if (!box) return;
    const caps = $$(".cap", box);
    const rows = $$(".combo", box);
    const hint = $(".keys-hint", box.parentElement);
    const held = new Set();
    let clearT;
    const norm = (k) => (k === "Meta" || k === "OS" ? "win" : k === "Control" ? "ctrl" : k === " " ? "" : k.toLowerCase());
    const combosOf = (row) => row.dataset.combo.split("|").map((c) => c.split("+"));

    const paint = (keys) => {
      caps.forEach((c) => c.classList.toggle("is-down", keys.has(c.dataset.k)));
      rows.forEach((row) => {
        const match = combosOf(row).some((combo) => combo.length === keys.size && combo.every((k) => keys.has(k)));
        row.classList.toggle("is-match", match);
        if (match && hint) hint.innerHTML = `<b>${row.querySelector(".combo__label").textContent}</b>, exactly where you expect it.`;
      });
    };

    document.addEventListener("keydown", (e) => {
      const k = norm(e.key);
      if (!k || e.target.closest?.("input, textarea")) return;
      held.add(k);
      paint(held);
      clearTimeout(clearT);
      clearT = setTimeout(() => { held.clear(); paint(held); }, 2000);
    });
    document.addEventListener("keyup", (e) => { held.delete(norm(e.key)); paint(held); });
    addEventListener("blur", () => { held.clear(); paint(held); });

    rows.forEach((row) => row.addEventListener("click", () => {
      paint(new Set(combosOf(row)[0]));
      row.querySelectorAll(".cap").forEach((c) => c.classList.add("is-down"));
      row.setAttribute("aria-pressed", "true");
      setTimeout(() => { paint(held); row.setAttribute("aria-pressed", "false"); }, 900);
    }));
  }

  /* ---------- Terminal typing demos ---------- */
  function initTerminals() {
    const terms = $$("[data-term]");
    if (!terms.length || reduceMotion) return;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    terms.forEach((term) => {
      const body = $(".term__body", term);
      const lines = [...body.children].map((p) => ({ cls: p.className, prompt: p.dataset.prompt, html: p.innerHTML, text: p.textContent }));
      const lastPrompt = [...lines].reverse().find((l) => l.prompt)?.prompt;
      let run = 0;
      const play = async () => {
        const id = ++run;
        body.style.minHeight = `${body.offsetHeight}px`;
        body.innerHTML = "";
        for (const l of lines) {
          const p = document.createElement("p");
          p.className = l.cls;
          if (l.prompt) {
            p.dataset.prompt = l.prompt;
            const caret = document.createElement("span");
            caret.className = "caret";
            const txt = document.createTextNode("");
            p.append(txt, caret);
            body.append(p);
            await wait(380);
            for (const ch of l.text) { if (id !== run) return; txt.data += ch; await wait(26 + Math.random() * 40); }
            await wait(260);
            caret.remove();
          } else {
            await wait(240);
            if (id !== run) return;
            p.innerHTML = l.html;
            body.append(p);
          }
        }
        if (lastPrompt && id === run) {
          const p = document.createElement("p");
          p.className = "t-cmd";
          p.dataset.prompt = lastPrompt;
          p.innerHTML = '<span class="caret"></span>';
          body.append(p);
        }
      };
      const replay = document.createElement("button");
      replay.type = "button";
      replay.className = "term__replay";
      replay.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>Replay';
      replay.addEventListener("click", play);
      term.after(replay);
      new IntersectionObserver(([e], obs) => { if (e.isIntersecting) { obs.disconnect(); play(); } }, { threshold: 0.5 }).observe(term);
    });
  }

  /* ---------- Dev pack picker ---------- */
  function initPacks() {
    const form = $("[data-packs]");
    if (!form) return;
    const bar = $(".progress", form);
    const btn = $("button", form);
    const status = $(".packs-status", form);
    form.addEventListener("change", () => { bar.classList.remove("is-run"); status.textContent = ""; });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const picked = $$("input:checked", form).map((i) => i.value);
      if (!picked.length) { status.textContent = "Tick at least one pack first."; return; }
      btn.disabled = true;
      bar.classList.remove("is-run");
      void bar.offsetWidth;
      bar.classList.add("is-run");
      status.textContent = `Installing ${picked.length} pack${picked.length > 1 ? "s" : ""}…`;
      setTimeout(() => { status.textContent = `✓ Ready: ${picked.join(", ")}`; btn.disabled = false; }, reduceMotion ? 0 : 1850);
    });
  }

  /* ---------- Restore points scrubber ---------- */
  function initRestore() {
    const box = $("[data-restore]");
    if (!box) return;
    const range = $("input", box);
    const state = $(".state", box);
    const points = JSON.parse(box.dataset.restore);
    const update = () => {
      const p = points[Number(range.value)];
      range.setAttribute("aria-valuetext", p.label);
      state.classList.toggle("is-ok", p.ok);
      state.textContent = p.text;
    };
    range.addEventListener("input", update);
    update();
  }

  /* ---------- Wallpaper picker: changes the preview and this page's backdrop ---------- */
  function initWallpapers() {
    const radios = $$('input[name="wallpaper"]');
    const bg = $(".desktop-bg");
    if (!radios.length || !bg) return;
    const preview = $("[data-wp-preview]");
    const screen = preview?.closest(".screen");
    const nameEl = $("[data-wp-name]");
    const DEFAULT_BG = "marble";
    const set = (id, ext, widths) => widths.map((w) => `img/wp-${id}-${w}.${ext} ${w}w`).join(", ");

    const setBackdrop = (id) => {
      const current = $(".desktop-bg__pic.is-on", bg);
      if (current?.dataset.wp === id) return;
      const pic = document.createElement("picture");
      pic.className = "desktop-bg__pic";
      pic.dataset.wp = id;
      pic.innerHTML = `<source type="image/avif" srcset="${set(id, "avif", [768, 1280, 1920])}" sizes="100vw"><img src="img/wp-${id}-1280.webp" srcset="${set(id, "webp", [768, 1280, 1920])}" sizes="100vw" alt="" decoding="async">`;
      bg.append(pic);
      const img = $("img", pic);
      const reveal = () => requestAnimationFrame(() => {
        pic.classList.add("is-on");
        $$(".desktop-bg__pic", bg).forEach((p) => { if (p !== pic) { p.classList.remove("is-on"); setTimeout(() => p.remove(), 1000); } });
      });
      img.complete ? reveal() : (img.addEventListener("load", reveal, { once: true }), img.addEventListener("error", reveal, { once: true }));
    };

    const setPreview = (id, name) => {
      if (!preview) return;
      const source = $("source", preview), img = $("img", preview);
      screen?.classList.add("is-swapping");
      const next = new Image();
      next.onload = next.onerror = () => {
        source.srcset = set(id, "avif", [768, 1280]);
        img.src = `img/wp-${id}-768.webp`;
        img.alt = `Neela ${name} wallpaper on a NeelaOS desktop`;
        screen?.classList.remove("is-swapping");
      };
      next.src = `img/wp-${id}-768.webp`;
      if (nameEl) nameEl.textContent = name;
    };

    const choose = (radio, save = true) => {
      radio.checked = true;
      const name = radio.closest(".wp").querySelector("span").firstChild.textContent.replace("Neela ", "").trim();
      setPreview(radio.value, name);
      setBackdrop(radio.value);
      if (save) store.set("neela-wallpaper", radio.value);
    };
    radios.forEach((r) => r.addEventListener("change", () => choose(r)));
    $("[data-wp-reset]")?.addEventListener("click", () => {
      radios.forEach((r) => { r.checked = false; });
      store.set("neela-wallpaper", null);
      setBackdrop(DEFAULT_BG);
      setPreview("crystal", "Crystal");
    });

    const saved = store.get("neela-wallpaper");
    const savedRadio = radios.find((r) => r.value === saved);
    if (savedRadio) choose(savedRadio, false);
  }

  /* ---------- Copy buttons ---------- */
  function initCopy() {
    $$("[data-copy]").forEach((btn) => btn.addEventListener("click", async () => {
      const label = $("span", btn);
      try { await navigator.clipboard.writeText(btn.dataset.copy); btn.classList.add("is-done"); label.textContent = "Copied"; }
      catch { label.textContent = "Press Ctrl+C"; }
      setTimeout(() => { btn.classList.remove("is-done"); label.textContent = "Copy"; }, 1800);
    }));
  }

  initTopbar();
  initPill();
  initScrollspy();
  initStartMenu();
  initObservers();
  initCursor();
  initMagnetic();
  initSparks();
  initKeys();
  initTerminals();
  initPacks();
  initRestore();
  initWallpapers();
  initCopy();
})();
