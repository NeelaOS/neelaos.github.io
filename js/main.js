/* NeelaOS website: one small script, every module optional.
   Each init only runs when its markup exists on the page. */
(() => {
  "use strict";

  const doc = document.documentElement;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- Taskbar: solid on scroll, start menu, tray clock ---------- */
  function initTaskbar() {
    const bar = $(".taskbar");
    if (!bar) return;

    let solid = null;
    const onScroll = () => {
      const next = scrollY > 40;
      if (next !== solid) { solid = next; bar.classList.toggle("is-solid", next); }
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const btn = $(".menu-btn");
    const menu = $("#startmenu");
    if (btn && menu) {
      const set = (open) => {
        menu.classList.toggle("is-open", open);
        btn.setAttribute("aria-expanded", String(open));
      };
      btn.addEventListener("click", () => set(btn.getAttribute("aria-expanded") !== "true"));
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
      menu.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
      document.addEventListener("click", (e) => {
        if (!menu.contains(e.target) && !btn.contains(e.target)) set(false);
      });
    }

    const clock = $(".clock");
    if (clock) {
      const time = $("span", clock), date = $("small", clock);
      const tick = () => {
        const d = new Date();
        time.textContent = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        date.textContent = d.toLocaleDateString([], { month: "numeric", day: "numeric", year: "2-digit" });
      };
      tick();
      setInterval(tick, 15000);
    }
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
    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    targets.forEach((el) => io.observe(el));

    const loops = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle("is-off", !e.isIntersecting);
    });
    $$("[data-loop]").forEach((el) => loops.observe(el));
  }

  /* ---------- Custom cursor: gold spark + teal ring ---------- */
  function initCursor() {
    if (!finePointer) return;

    const dot = document.createElement("div");
    const ring = document.createElement("div");
    dot.className = "cur cur-dot";
    ring.className = "cur cur-ring";
    dot.innerHTML = "<i></i>";
    ring.innerHTML = "<i></i><b></b>";
    dot.setAttribute("aria-hidden", "true");
    ring.setAttribute("aria-hidden", "true");
    document.body.append(dot, ring);
    const label = $("b", ring);

    const ease = reduceMotion ? 1 : 0.2;
    let mx = 0, my = 0, rx = 0, ry = 0, raf = 0, shown = false;

    const loop = () => {
      rx += (mx - rx) * ease;
      ry += (my - ry) * ease;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = Math.abs(mx - rx) + Math.abs(my - ry) > 0.2 ? requestAnimationFrame(loop) : 0;
    };

    addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      mx = e.clientX; my = e.clientY;
      if (!shown) {
        shown = true; rx = mx; ry = my;
        doc.classList.add("has-cursor");
        dot.classList.add("is-on"); ring.classList.add("is-on");
      }
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });

    document.addEventListener("mouseout", (e) => {
      if (!e.relatedTarget) { dot.classList.remove("is-on"); ring.classList.remove("is-on"); shown = false; }
    });
    addEventListener("pointerdown", () => doc.classList.add("cur-down"));
    addEventListener("pointerup", () => doc.classList.remove("cur-down"));

    // One delegated listener decides the cursor state.
    document.addEventListener("pointerover", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      let state = "";
      const explicit = t.closest("[data-cursor]");
      if (explicit) {
        state = explicit.dataset.cursor;
        label.textContent = explicit.dataset.cursorLabel || "View";
      } else if (t.closest(".btn--primary")) state = "cta";
      else if (t.closest("a, button, summary, label, input, [role='button']")) state = "link";
      else if (t.closest(".term, pre, kbd")) state = "code";
      else if (t.closest("p, h1, h2, h3, li, dd, dt, blockquote")) state = "text";
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
      el.addEventListener("pointerleave", () => {
        el.style.setProperty("--mx", "0px");
        el.style.setProperty("--my", "0px");
      });
    });
  }

  /* ---------- Hero: gold sparks drifting on the wind ---------- */
  function initSparks() {
    const canvas = $(".hero__sparks");
    if (!canvas || reduceMotion || innerWidth < 600) return;
    const ctx = canvas.getContext("2d");

    // Pre-render one glowing spark; drawing a bitmap is far cheaper than gradients per frame.
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

    let w = 0, h = 0, parts = [], raf = 0, visible = true;
    const mouse = { x: -1e4, y: -1e4 };

    const make = (anywhere) => ({
      x: anywhere ? Math.random() * w : -12,
      y: Math.random() * h,
      s: Math.random() * 7 + 3,
      vx: Math.random() * 0.35 + 0.1,
      vy: (Math.random() - 0.5) * 0.1,
      a: Math.random() * 0.55 + 0.3,
      t: Math.random() * 6.28,
      ox: 0, oy: 0,
    });

    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(70, Math.round((w * h) / 20000));
      parts = Array.from({ length: n }, () => make(true));
    };

    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.t += 0.018;
        p.x += p.vx;
        p.y += p.vy + Math.sin(p.t) * 0.12;
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 16900) {
          const d = Math.sqrt(d2) || 1, f = (130 - d) / 130;
          p.ox += (dx / d) * f * 1.4;
          p.oy += (dy / d) * f * 1.4;
        }
        p.ox *= 0.93; p.oy *= 0.93;
        if (p.x > w + 12) Object.assign(p, make(false));
        ctx.globalAlpha = p.a * (0.65 + 0.35 * Math.sin(p.t * 1.7));
        ctx.drawImage(sprite, p.x + p.ox - p.s / 2, p.y + p.oy - p.s / 2, p.s, p.s);
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    size();
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(canvas);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    let rt;
    addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(size, 160); });
    addEventListener("pointermove", (e) => {
      if (!raf) return;
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    }, { passive: true });
    start();
  }

  /* ---------- Live keycaps: press real shortcuts ---------- */
  function initKeys() {
    const box = $("[data-keys]");
    if (!box) return;
    const caps = $$(".cap", box);
    const rows = $$(".combo", box);
    const hint = $(".keys-hint", box.parentElement);
    const held = new Set();
    let clearT;

    const norm = (k) => ({ Meta: "win", OS: "win", Control: "ctrl", Shift: "shift", Escape: "esc" }[k] || (k.length === 1 ? k.toLowerCase() : ""));

    const paint = (keys) => {
      caps.forEach((c) => c.classList.toggle("is-down", keys.has(c.dataset.k)));
      rows.forEach((row) => {
        const combo = row.dataset.combo.split("+");
        const match = combo.length === keys.size && combo.every((k) => keys.has(k));
        row.classList.toggle("is-match", match);
        if (match && hint) hint.innerHTML = `<b>${row.lastElementChild.textContent}</b>, exactly where you expect it.`;
      });
    };

    document.addEventListener("keydown", (e) => {
      const k = norm(e.key);
      if (!k) return;
      held.add(k);
      paint(held);
      clearTimeout(clearT);
      clearT = setTimeout(() => { held.clear(); paint(held); }, 2000);
    });
    document.addEventListener("keyup", (e) => { held.delete(norm(e.key)); paint(held); });
    addEventListener("blur", () => { held.clear(); paint(held); });

    rows.forEach((row) => row.addEventListener("click", () => {
      const keys = new Set(row.dataset.combo.split("+"));
      paint(keys);
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
            for (const ch of l.text) {
              if (id !== run) return;
              txt.data += ch;
              await wait(26 + Math.random() * 40);
            }
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

      new IntersectionObserver(([e], obs) => {
        if (e.isIntersecting) { obs.disconnect(); play(); }
      }, { threshold: 0.5 }).observe(term);
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
      void bar.offsetWidth; // restart the fill
      bar.classList.add("is-run");
      status.textContent = `Installing ${picked.length} pack${picked.length > 1 ? "s" : ""}…`;
      setTimeout(() => {
        status.textContent = `✓ Ready: ${picked.join(", ")}`;
        btn.disabled = false;
      }, reduceMotion ? 0 : 1850);
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

  /* ---------- Copy buttons ---------- */
  function initCopy() {
    $$("[data-copy]").forEach((btn) => btn.addEventListener("click", async () => {
      const label = $("span", btn);
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.classList.add("is-done");
        label.textContent = "Copied";
      } catch {
        label.textContent = "Press Ctrl+C";
      }
      setTimeout(() => { btn.classList.remove("is-done"); label.textContent = "Copy"; }, 1800);
    }));
  }

  /* ---------- Scroll-spy: highlight the taskbar entry for the section in view ---------- */
  function initScrollspy() {
    const links = $$('.tasks a[href^="#"], .startmenu__grid a[href^="#"]');
    if (!links.length) return;
    const ids = [...new Set(links.map((a) => a.hash.slice(1)))];
    const setActive = (id) => links.forEach((a) => {
      const on = a.hash === `#${id}`;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
    }, { rootMargin: "-45% 0px -50% 0px" });
    ids.forEach((id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  initTaskbar();
  initObservers();
  initCursor();
  initMagnetic();
  initSparks();
  initKeys();
  initTerminals();
  initPacks();
  initRestore();
  initCopy();
  initScrollspy();
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
})();
