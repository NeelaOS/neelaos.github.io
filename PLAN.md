# NeelaOS Website: Design & Build Plan

Status: **built** as a single static page (`index.html` + `404.html`, plain HTML/CSS/JS). Changes from this plan:
single page instead of 5 pages (nav links are in-page anchors with scroll-spy); no framework; theme mirrors the
OS desktop (marble wallpaper, OS-style windows, taskbar nav) with teal primary buttons; creator/ownership section added.

---

## 0. What the resources tell us

| Source | What it gives us |
|---|---|
| `NeelaOS-website-content.md` | All copy, already split into page blocks (hero, motive, 9 features, audience, install, FAQ, CTA, footer). Sections 4 and 5 are missing from the numbering. |
| `logo/*.svg` | The **N mark is 9 flat polygons** in one shared coordinate space. It comes in two versions: *color* (teal, sea, navy facets) and *white* (ice-blue facets). We can animate each facet on its own, and that becomes the signature motion. |
| `logo/wordmark-*.svg`, FB cover | Wordmark: **"Neela" in white, "OS" in gold**. Tagline set in gold italic. |
| `assets/bg-marble.png` | Liquid teal/navy marble with **gold sparks**. This is the hero texture (the FB cover and the desktop wallpaper both use it). |
| `assets/bg-crystal.png` | Low-poly triangles, navy to teal. Same geometric language as the logo facets. |
| `assets/bg-aurora.png` | Night sky with stars and an aurora band over dark hills. Calm mood, good for the closing CTA. |
| `assets/desktop.png` | Real screenshot (Welcome app, taskbar). This is the product shot. |
| `../NeelaOS/branding/fonts` | **Space Grotesk** (variable, OFL), the brand typeface. |
| `../NeelaOS/branding/icons`, `wallpapers/` | Terminal icon (navy tile, teal/gold traffic lights, gold caret) and 6 wallpaper SVGs we can reuse. |
| Content §6, "Beautiful by default" | The brand describes itself as a **navy, teal and gold design system**. |

**The pattern:** deep navy as the base, blue to teal for depth and motion, **gold as the rare spark**
(the "OS", the tagline, the sparks in the marble). The geometry is faceted and crystalline (logo,
crystal wallpaper), and the textures are fluid (marble, aurora, "for the love of *wind*").
The whole site follows that idea: **crystal structure, fluid motion, gold sparks.**

---

## 1. Design tokens

### 1.1 Color: raw palette (taken from the brand SVGs)

| Token | Hex | Where it comes from |
|---|---|---|
| `--navy-950` | `#0D1230` | FB cover veil, terminal window (deepest background) |
| `--navy-900` | `#1B2247` | Terminal title bar, Welcome app sidebar |
| `--navy-800` | `#222B56` | Logo facet, icon tile start |
| `--blue-700` | `#0B4683` | Logo facet, icon tile middle |
| `--blue-600` | `#155E9E` | Logo facet |
| `--sea-500` | `#2A9FD0` | Logo facet |
| `--teal-600` | `#1A9695` | Logo facet, icon tile end, Welcome app buttons |
| `--teal-400` | `#46C1CF` | Logo facet |
| `--teal-300` | `#5FD3D1` | Logo facet (brightest) |
| `--gold-300` | `#F2D678` | "OS", tagline, sparks |
| `--gold-600` | `#D69510` | Spark core, gradient end |
| `--ice-50 … --ice-400` | `#F2F9FC #EAF6FA #DCEFF5 #C7E2EC #9FC3D6` | White-mark facets (text tints on dark) |

### 1.2 Color: semantic roles (components use only these)

| Role | Value | Notes |
|---|---|---|
| `--bg` | navy-950 | Page background |
| `--surface` | navy-900 | Cards, terminal, nav when scrolled |
| `--surface-raised` | navy-800 | Hovered cards, keycaps |
| `--border` | ice-400 at 12% | Hairlines |
| `--text` | ice-50 | Body text, about 17:1 on bg |
| `--text-muted` | ice-400 | Secondary text, about 9:1 |
| `--link` / `--focus-ring` | teal-300 / gold-300 | |
| `--accent` | gold-300 | Used sparingly: the "OS", tagline, primary CTA, cursor dot, highlights |
| `--primary` | teal-600 | Icons, chips, active states |
| `--grad-brand` | navy-800 → blue-700 → teal-600 (135°) | Same as the app-icon tile |
| `--grad-gold` | gold-300 → gold-600 (radial) | Sparks, CTA glow |

**Contrast decision:** white on `#1A9695` is only about 3.4:1, which fails WCAG AA for button text.
So:
- **Primary CTA ("Download NeelaOS") = gold background + navy-950 text** (about 12:1). It is also the most eye-catching element on a navy page.
- **Secondary CTA = ghost button**: teal-300 border and text, filled with teal at 12% on hover.
- Any teal fill that carries text uses **navy-950 text**, never white.

**Gold rule:** at most about 5% of any viewport. If gold appears everywhere, it stops reading as special.

**Theme:** dark only for v1. All colors live in semantic tokens, so a "Neela Light" theme later is one extra token block (the OS ships both themes).

### 1.3 Typography

- **Display and body: Space Grotesk** (the brand font, self-hosted variable woff2, subset to Latin, `font-display: swap`, preloaded).
- **Mono: JetBrains Mono** (only for the terminal, keycaps and code). Subset to the characters we use.
- Fluid scale with `clamp()`: Display 56→96px · H1 40→64 · H2 30→44 · H3 20→24 · Body 17→18 · Small 14.
- Display text uses tight tracking (-0.03em). The tagline is set in gold italic, matching the FB cover.

### 1.4 Spacing, shape, depth

- 4px base spacing scale: 4 8 12 16 24 32 48 64 96 128.
- Radii: 8 (chips), 14 (buttons, keycaps), 22 (cards), 28 (screenshot frame). The icon tile's rx 112/512 gives a 22% squircle feel, which we echo.
- Elevation comes from glow, not grey shadow: `0 20px 60px -20px rgb(13 18 48 / .8)` plus a faint teal inner border at the top edge.
- Container 1200px max, 16px gutter on mobile, 32px on desktop. Breakpoints 640 / 960 / 1280.

### 1.5 Motion tokens

- Easing: `--ease-out: cubic-bezier(.16,1,.3,1)` (expo-out, used for almost everything) and `--ease-in-out: cubic-bezier(.65,0,.35,1)`.
- Durations: 150 (hover), 300 (UI), 600 (reveals), 1200 (hero intro).
- Stagger: 60ms between siblings.

---

## 2. Signature elements

1. **Facet logo assembly** (hero intro). The 9 polygons of the N fly in from scattered positions and rotations, settle into the mark (1.2s, staggered), then cross-fade from the white facets to the color facets. Pure SVG transforms, played once.
2. **Gold sparks on wind.** A lightweight canvas layer over the hero marble: about 40–60 gold particles drifting slowly to the right (the "wind"). Particles near the cursor get gently pushed away. It pauses when the hero is off screen or the tab is hidden.
3. **Crystal section dividers.** Thin low-poly triangle edges, taken from the crystal wallpaper, separate the major sections instead of straight lines.
4. **Custom cursor.** See §3.

---

## 3. Custom cursor

**Idea:** a gold **spark** (a dot) with a trailing teal **facet ring**. It is the marble's gold spark, steered by the user.

| State | Dot (gold-300, 6px) | Ring (teal-300, 34px, 1.5px stroke) |
|---|---|---|
| Default | Follows the pointer exactly | Follows with lerp (0.18), so it lags slightly like it's carried by wind |
| Links / nav | Shrinks to 4px | Grows to 56px with a teal fill at 10% |
| Primary (gold) button | Hidden | Becomes a gold ring and is lightly *magnetized* toward the button center (button shifts up to 6px) |
| Text paragraphs | Turns into a 2×22px I-beam bar | Fades out |
| Terminal / code | Turns into a gold **block caret** (matches the terminal icon) | Fades out |
| Screenshot / media | Hidden | Ring shows a "View" label |
| Mouse down | Scales to 0.7 | Pulses outward once |

**Engineering rules**
- Two fixed `div`s moved only with `transform: translate3d()` in a single `requestAnimationFrame` loop. The loop goes idle when the pointer stops and the lerp has settled. No layout reads inside the loop.
- State is driven by event delegation on `[data-cursor="link|cta|text|code|media"]`. No per-element listeners.
- `mix-blend-mode` is not used (it makes every frame expensive to composite).
- **Enabled only on `(hover: hover) and (pointer: fine)`.** Touch devices keep native behavior.
- The native cursor is hidden only after the custom one has initialized, so there is never a moment with no cursor. Inputs and textareas keep the native cursor.
- `prefers-reduced-motion`: the lerp trail and magnetism are off. The dot follows exactly and state changes still apply.
- The cursor never replaces focus styles. Keyboard focus gets a gold 2px `:focus-visible` ring.

---

## 4. Site map and page designs

```
/            Home
/features    All 9 features in depth
/download    Install page (3 steps, requirements, checksum, VirtualBox tip)
/faq         Full FAQ
/404         "Lost in the wind" page with the facets scattered
```

Shared on every page: **Nav**, **Closing CTA (§10 of the content)**, **Footer (§11)**.

### 4.1 Nav
Wordmark (white "Neela", gold "OS") · Features · Install · FAQ · **[Download]** (small gold button).
It is transparent over the hero and switches to solid `navy-900/90%` with a hairline after 40px of scroll.
`backdrop-filter` is used only on desktop. Mobile uses a full-screen sheet menu with facets in the background.

### 4.2 Home, section by section

1. **Hero** (100svh, min 640px)
   - Layers: bg-marble (AVIF) → navy veil gradient (the FB cover's `veil`) → teal radial glow → spark canvas.
   - Content: facet logo → headline **"Feels like Windows. Runs like Linux."** (the words reveal with a clip-path mask, staggered) → subheadline → [Download NeelaOS] [See what's inside →] → small print.
   - Below the fold edge: **desktop.png in a 3D-tilted frame** (rotateX 18°) that flattens to 0° as you scroll into it (scroll-driven via `animation-timeline: view()`, with an IntersectionObserver fallback).
2. **Trust strip.** Built on Fedora · KDE Plasma · Free & open source · Secure Boot. Plain text in ice-400 with no fake logos.
3. **The wall** (content §3). Split comparison:
   - Left, "Your first week on Windows": PATH, MinGW, WSL, broken gcc… each item gets **struck through** as it scrolls into view.
   - Right, "Your first day on NeelaOS": the same tasks with teal ✓ marks.
   - It ends on a gold pull quote: *"Install NeelaOS and start learning to code the same day."*
4. **Feature bento** (all 9 features as a teaser grid, each with one micro-interaction):
   | Card | Interaction |
   |---|---|
   | Familiar from the first click (large) | **Live keycaps**: press Win/Ctrl/Shift/E/L/V/S on your real keyboard and the matching caps light up gold. Clicking them does the same. |
   | Ready to code | Language chips (C, C++, Python, Java, Node, SQLite, Podman) in a slow marquee that pauses on hover |
   | Dev packs | Checklist of the 11 packs. Tick a few and click "Install" for a fake progress fill |
   | Speaks Ubuntu (wide) | **Terminal typing demo**: `sudo apt install gcc` → `→ dnf install gcc` → done |
   | Git without the headache | Terminal demo: `rgit push "first lab"` → ✓ saved & uploaded |
   | Undo anything | **Restore-point timeline**: drag a scrubber back to "Yesterday 9:00", and a broken state turns into a fixed one |
   | Your everyday PC | App icon grid (Brave, Thunderbird, LibreOffice…) with a gentle hover lift |
   | Beautiful by default | Wallpaper cross-fade (marble → crystal → aurora) inside a mini monitor |
   | Safe, stable, up to date | Shield made of logo facets with a Fedora / Secure Boot / NVIDIA checklist |
   Each card has a "Learn more →" link to its anchor on `/features`.
5. **Who it's for** (content §7). Four cards, each with a facet-style icon, revealed with a stagger.
6. **Ready in 3 steps** (teaser of content §8). Three numbered steps joined by a line that **draws itself** (stroke-dashoffset) on scroll, ending in a [Download] button and a "View install guide" link.
7. **FAQ preview.** The top 4 questions as an accordion, plus "All questions →".
8. **Closing CTA.** bg-aurora with twinkling stars (CSS only, opacity keyframes on a few pseudo-elements). **"Stop fighting your computer. Start building."** with a large gold button.
9. **Footer.** Small wordmark, gold tagline, nav links, then the credits and legal text from §11 verbatim.

### 4.3 /features
A sticky left rail on desktop lists the 9 features and highlights the current one (scroll-spy). Each feature
is a full row alternating media and text, reusing the interactive widgets from the bento at a larger size.
Shortcut lists render as real `<kbd>` keycaps. Dev packs render as a full card grid.

### 4.4 /download
Headline **"Your new PC, ready in 3 steps."** → large step cards (Download · Write to USB · Boot & install) →
**requirements panel** (64-bit, 4/8 GB RAM, 40 GB, USB 8 GB+) → **checksum box** with copy buttons for the
PowerShell and Linux commands (from the README) → collapsible "Try it in VirtualBox first" tip → "After first login" note.
The primary button links to the ISO (URL still needed, see open decisions).

### 4.5 /faq
All 9 Q&As. Built on native `<details>/<summary>`, so it works without JS. The height animation is a
progressive enhancement (`interpolate-size` / grid-rows trick). Includes FAQPage JSON-LD for SEO.

---

## 5. Animation system and performance budget

**Principles**
- Only `transform` and `opacity` are animated (plus `clip-path` and `stroke-dashoffset` for one-off reveals). Nothing that triggers layout.
- One shared **IntersectionObserver** adds `.is-in` to `[data-reveal]` elements, once each. The CSS does the actual animation. Reveal variants: `fade-up`, `mask`, `scale`, and `stagger` (children).
- `will-change` is added only while an animation runs and removed on `animationend`.
- Every continuous animation (sparks, marquee, stars, terminal loops) **pauses when off screen** and when `document.hidden`.
- Canvas DPR is capped at 2, particle count scales with viewport area, and there are no particles on small screens.
- **`prefers-reduced-motion: reduce`**: no particles, no parallax or tilt, no magnetism, and reveals become simple 200ms fades. The logo appears assembled. Terminals show their final state.
- The page is fully readable with JS off. Interactions are progressive enhancement.

**Budgets**
| Metric | Target |
|---|---|
| LCP | < 2.0s on 4G (the hero bg is preloaded AVIF at about 150 KB) |
| CLS | < 0.05 (all media has fixed aspect ratios, fonts use size-adjusted fallbacks) |
| INP | < 100ms |
| JS (gzip) | < 25 KB in total, with no animation library |
| CSS (gzip) | < 20 KB |
| Images | The current PNGs total about 3.6 MB → converted to AVIF + WebP at 768/1280/1920w, about 500 KB in total |

---

## 6. Tech stack (recommended)

**Astro (static output) + vanilla TypeScript + plain CSS with custom properties.**
- Multi-page with shared layout and components, and **zero JS by default**. Only the islands we write get shipped.
- Built-in image pipeline (`astro:assets`) produces AVIF/WebP and responsive `srcset` automatically.
- It outputs plain static files, so it deploys anywhere (GitHub Pages, Netlify, Render static site).
- No GSAP or Framer: the motion needs here are covered by CSS, IntersectionObserver, scroll-driven animations and one small rAF loop.

Alternative if you want no build step at all: hand-written HTML/CSS/JS. That works, but the header and footer get duplicated across 5 pages and images have to be optimized by hand.

### Proposed structure
```
src/
  styles/      tokens.css · base.css · utilities.css · motion.css
  layouts/     Base.astro              (head, fonts, nav, CTA, footer, cursor)
  components/  Nav · Footer · ClosingCTA · Button · LogoMark (9-facet SVG)
               Hero · SparkCanvas · ScreenshotFrame · Bento + 9 feature widgets
               Keycaps · Terminal · PackPicker · RestoreTimeline · WallpaperCycler
               StepList · FaqItem · CrystalDivider · Cursor
  scripts/     cursor.ts · reveal.ts · sparks.ts · terminal.ts · keys.ts · scrollspy.ts
  pages/       index · features · download · faq · 404
  assets/      (source images, optimized at build)
public/        fonts/ · favicon (from neelaos-icon) · og-image.png (from FB cover)
```

---

## 7. Accessibility and SEO checklist
- Semantic landmarks, skip link, one `<h1>` per page, logical heading order.
- Decorative canvas, cursor and facets are `aria-hidden`. Terminal demos have a text equivalent.
- Keycap widget: `aria-pressed` buttons, so it also works with keyboard and touch.
- All interactive targets ≥ 44px. Visible gold focus ring.
- Meta and OG/Twitter cards (OG image from the FB cover), favicon set, `sitemap.xml`, SoftwareApplication + FAQPage JSON-LD.

## 8. Build order
1. Scaffold Astro, tokens, base styles, fonts, image pipeline
2. Layout: nav, footer, closing CTA, cursor
3. Home hero (logo assembly, sparks, screenshot frame)
4. Home body: wall, bento + widgets, audience, steps, FAQ preview
5. /features, /download, /faq, /404
6. Reduced-motion pass, a11y pass, Lighthouse pass (target 95+ in every category)

---

## 9. Open decisions
1. **Stack:** Astro (recommended) or plain HTML/CSS/JS?
2. **Download URL:** where is the ISO hosted (GitHub Releases? another URL)? Until then, it's a placeholder.
3. **Missing sections 4 and 5** of the content doc: intentionally cut, or still to come?
4. **Light theme:** skip for v1 (recommended), or ship a toggle now?
5. **Repo / source link:** should the nav and footer link to a GitHub repo?
