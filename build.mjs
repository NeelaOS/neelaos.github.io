#!/usr/bin/env node
/**
 * NeelaOS site builder. Zero dependencies, Node 18+.
 *
 *   node build.mjs
 *
 * Reads data/site.json, renders every file in src/ into the site root and inlines the
 * minified stylesheet, so the published site is plain static HTML that search engines
 * and LLM crawlers can read without running JavaScript.
 *
 * Template syntax (src/*):
 *   {{path.to.value}}            HTML-escaped value
 *   {{{path}}}                   raw value
 *   {{#each list}}...{{/each}}   loop; inside, fields resolve on the item first, {{this}} / {{@index}}
 *   {{#if path}}...{{else}}...{{/if}}   and {{#unless path}}...{{/unless}}
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const data = JSON.parse(read("data/site.json"));

/* ---------------------------------------------------------------- template engine */
const TOKEN = /\{\{\{\s*([\w.@]+)\s*\}\}\}|\{\{\s*(#each|#if|#unless|\/each|\/if|\/unless|else)?\s*([\w.@]*)\s*\}\}/g;

function parse(src) {
  const root = { children: [] };
  const stack = [root];
  const add = (node) => {
    const top = stack[stack.length - 1];
    (top.inElse ? top.elseChildren : top.children).push(node);
  };
  let last = 0;
  for (const m of src.matchAll(TOKEN)) {
    if (m.index > last) add({ t: "text", v: src.slice(last, m.index) });
    last = m.index + m[0].length;
    if (m[1]) add({ t: "raw", p: m[1] });
    else if (!m[2]) add({ t: "var", p: m[3] });
    else if (m[2] === "else") stack[stack.length - 1].inElse = true;
    else if (m[2][0] === "#") {
      const node = { t: m[2].slice(1), p: m[3], children: [], elseChildren: [] };
      add(node);
      stack.push(node);
    } else {
      const open = stack.pop();
      if (!open || `/${open.t}` !== m[2]) throw new Error(`Template: unexpected {{${m[2]}}}`);
    }
  }
  if (stack.length !== 1) throw new Error(`Template: unclosed {{#${stack[stack.length - 1].t}}}`);
  if (last < src.length) add({ t: "text", v: src.slice(last) });
  return root.children;
}

function lookup(path, scopes) {
  if (path === "this") return scopes[scopes.length - 1];
  const [head, ...rest] = path.split(".");
  for (let i = scopes.length - 1; i >= 0; i--) {
    const s = scopes[i];
    if (s !== null && typeof s === "object" && head in s) {
      return rest.reduce((v, k) => (v == null ? undefined : v[k]), s[head]);
    }
  }
  return undefined;
}

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const truthy = (v) => (Array.isArray(v) ? v.length > 0 : Boolean(v));

function renderNodes(nodes, scopes, escape = esc) {
  let out = "";
  for (const n of nodes) {
    if (n.t === "text") out += n.v;
    else if (n.t === "var") out += escape(lookup(n.p, scopes));
    else if (n.t === "raw") out += lookup(n.p, scopes) ?? "";
    else if (n.t === "if" || n.t === "unless") {
      const ok = truthy(lookup(n.p, scopes)) === (n.t === "if");
      out += renderNodes(ok ? n.children : n.elseChildren, scopes, escape);
    } else if (n.t === "each") {
      const list = lookup(n.p, scopes) || [];
      if (!list.length) out += renderNodes(n.elseChildren, scopes, escape);
      list.forEach((item, i) => {
        out += renderNodes(n.children, [...scopes, { "@index": i, "@number": i + 1, "@first": i === 0 }, item], escape);
      });
    }
  }
  return out;
}
const render = (src, ctx, escape) => renderNodes(parse(src), [ctx], escape);
// HTML and XML get entity-escaped values; plain-text files (llms.txt, robots.txt) stay literal.
const escapeFor = (file) => (/\.(html|xml)$/.test(file) ? esc : /\.webmanifest$/.test(file) ? (v) => JSON.stringify(String(v ?? "")).slice(1, -1) : (v) => String(v ?? ""));

/* ---------------------------------------------------------------- helpers */
const minifyCss = (css) => css
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\s+/g, " ")
  .replace(/\s*([{};,>])\s*/g, "$1")
  .replace(/;}/g, "}")
  .trim();

const abs = (p) => new URL(p, data.site.url).href;
const jsonLd = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c");
const strip = (s) => s.replace(/<[^>]+>/g, "");

/* Release notes come from GitHub as Markdown. This renders the subset release notes use
   (headings, lists, tables, code, bold/italic, links). Input is escaped first, so raw HTML
   in the notes can never reach the page. */
function inline(text) {
  const codes = [];
  let t = esc(text).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|\W)_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>");
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}
function markdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = /^#\s/.test(lines[0] || "") ? 1 : 0; // the window title already names the release
  const cells = (row) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const LIST = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^```/.test(line)) {
      const buf = [];
      for (i++; i < lines.length && !/^```/.test(lines[i]); i++) buf.push(lines[i]);
      i++;
      out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { const lvl = Math.min(h[1].length + 1, 5); out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); i++; continue; }
    if (/^\s*\|/.test(line)) {
      const rows = [];
      for (; i < lines.length && /^\s*\|/.test(lines[i]); i++) rows.push(cells(lines[i]));
      const head = rows[0];
      const body = rows.slice(rows[1] && rows[1].every((c) => /^:?-{2,}:?$/.test(c)) ? 2 : 1);
      const thead = head.some(Boolean) ? `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>` : "";
      out.push(`<div class="notes__table"><table>${thead}<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    const first = line.match(LIST);
    if (first) {
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(LIST);
        if (m && m[1].length <= first[1].length) { items.push(m[3]); i++; continue; }
        if (items.length && lines[i].trim() && /^\s+/.test(lines[i])) { items[items.length - 1] += " " + lines[i].trim(); i++; continue; }
        break;
      }
      const tag = /\d/.test(first[2]) ? "ol" : "ul";
      out.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</${tag}>`);
      continue;
    }
    const para = [];
    for (; i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\s*\|)/.test(lines[i]) && !LIST.test(lines[i]); i++) para.push(lines[i].trim());
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return out.join("\n");
}

const KEY_LABEL = { win: "Win", ctrl: "Ctrl", shift: "Shift", alt: "Alt", escape: "Esc", arrowleft: "←", arrowright: "→" };
const KEY_NAME = { win: "Windows key", arrowleft: "Left arrow", arrowright: "Right arrow", ".": "Period", escape: "Escape" };

/* ---------------------------------------------------------------- view model */
const { site, release, download, links, author } = data;
const today = new Date().toISOString().slice(0, 10);
const downloadHref = download.isoUrl || download.releasesLatestUrl;

const shortcuts = data.shortcuts.map((s) => {
  const alts = s.keys.split("|").map((c) => c.split("+"));
  // "win+arrowleft|win+arrowright" renders as Win + ← / →
  const caps = [];
  alts.forEach((combo, ai) => combo.forEach((k, ki) => {
    if (ai > 0 && ki < combo.length - 1) return; // shared modifiers are drawn once
    caps.push({ k, label: KEY_LABEL[k] || k.toUpperCase(), sep: caps.length === 0 ? "" : ai > 0 ? "/" : "+" });
  }));
  const spoken = alts.map((c) => c.map((k) => KEY_NAME[k] || KEY_LABEL[k] || k.toUpperCase()).join(" + ")).join(" or ");
  return { ...s, caps, spoken };
});

const wallpapers = data.wallpapers.map((w) => ({
  ...w,
  avif: [480, 768, 1280, 1920].map((x) => `img/wp-${w.id}-${x}.avif ${x}w`).join(", "),
  webp: [480, 768, 1280, 1920].map((x) => `img/wp-${w.id}-${x}.webp ${x}w`).join(", "),
  thumb: `img/wp-${w.id}-480.webp`,
  thumbAvif: `img/wp-${w.id}-480.avif`,
}));

const installSteps = [
  { name: "Download and verify", text: `Download ${release.isoFile} (${release.isoSize}) and ${release.isoFile}.sha256 from GitHub Releases, then check it: on Windows run Get-FileHash ${release.isoFile} in PowerShell and compare with the .sha256 file; on Linux run sha256sum -c ${release.isoFile}.sha256.` },
  { name: "Write it to a USB stick", text: "Use a USB stick of 8 GB or more with Rufus (choose DD image mode), Fedora Media Writer or balenaEtcher. The stick will be erased." },
  { name: "Boot from the USB", text: "Restart, open the boot menu (usually F12, F11, F9, Esc or F2), select the USB stick and choose Start NeelaOS." },
  { name: "Try it or install it", text: "NeelaOS runs live from the USB without changing your PC. Click Install NeelaOS and Neela Setup asks for your language, keyboard, disk (whole disk, or alongside Windows) and account. Keep the default Btrfs layout to get restore points." },
  { name: "Restart and log in", text: "Remove the USB stick and log in. Stay online for 10 to 20 minutes while the Welcome app sets up VS Code, Brave and media codecs." },
];

const authorId = abs("#creator");
const orgId = abs("#organization");
const appId = abs("#software");
const graph = [
  { "@type": "WebSite", "@id": abs("#website"), url: site.url, name: site.name, description: site.description, inLanguage: site.language, publisher: { "@id": authorId } },
  {
    "@type": "Organization", "@id": orgId, name: "NeelaOS", url: site.url, logo: abs("img/icon-512.png"),
    founder: { "@id": authorId }, sameAs: [links.org, links.repo],
  },
  {
    "@type": "Person", "@id": authorId, name: author.name, url: authorId, image: abs(author.image),
    jobTitle: author.role, description: author.bio, sameAs: author.socials.map((s) => s.url),
  },
  {
    "@type": "SoftwareApplication",
    "@id": appId, name: "NeelaOS", alternateName: "Neela OS", url: site.url,
    description: site.description, applicationCategory: "OperatingSystem", applicationSubCategory: "Linux distribution",
    operatingSystem: `Linux (Fedora Remix, ${release.base}, ${release.desktop})`,
    softwareVersion: release.version, ...(release.date ? { datePublished: release.date } : {}),
    downloadUrl: downloadHref, installUrl: abs("#install"), releaseNotes: release.notesUrl,
    fileSize: release.isoSize, processorRequirements: "64-bit Intel or AMD (x86_64)",
    memoryRequirements: "4 GB RAM (8 GB recommended)", storageRequirements: "40 GB",
    screenshot: abs("img/desktop-1920.webp"), image: abs("img/og-image.jpg"),
    isBasedOn: { "@type": "SoftwareApplication", name: "Fedora Linux", url: links.fedora },
    featureList: [
      "Windows-familiar desktop with Start button, taskbar and Win key shortcuts",
      "Files app laid out like File Explorer",
      "C/C++, Python, Java, Node.js, SQLite, Git and Podman preinstalled",
      "VS Code with extensions installed on first boot",
      "Ubuntu-style sudo apt install commands",
      "rgit: one-command Git",
      "One-click Dev packs for every course",
      "Automatic restore points before updates and daily",
      "Neela Dark and Neela Light themes, six original wallpapers",
    ],
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", availability: release.available ? "https://schema.org/InStock" : "https://schema.org/PreOrder", url: downloadHref },
    author: { "@id": authorId }, creator: { "@id": authorId }, publisher: { "@id": orgId },
  },
  {
    "@type": "HowTo", "@id": abs("#install"), name: "How to install NeelaOS",
    totalTime: "PT10M",
    supply: data.requirements.map((r) => ({ "@type": "HowToSupply", name: `${r.label}: ${r.value}` })),
    step: installSteps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.name, text: s.text, url: abs("#install") })),
  },
  {
    "@type": "FAQPage", "@id": abs("#faq"),
    mainEntity: data.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: strip(f.a) } })),
  },
  {
    "@type": "WebPage", "@id": abs("#webpage"), url: site.url, name: site.title, description: site.description,
    isPartOf: { "@id": abs("#website") }, about: { "@id": appId }, mainEntity: { "@id": appId },
    primaryImageOfPage: abs("img/og-image.jpg"), dateModified: today, inLanguage: site.language,
  },
];

const ctx = {
  ...data,
  notesHtml: release.notes ? markdown(release.notes) : "",
  shortcuts, wallpapers, installSteps,
  year: new Date().getFullYear(),
  today,
  css: minifyCss(read("css/style.css")),
  // 404.html is served at any path, so its URLs must be root-absolute
  css404: minifyCss(read("css/style.css")).replaceAll('url("fonts/', 'url("/fonts/'),
  jsonld: jsonLd({ "@context": "https://schema.org", "@graph": graph }),
  dl: {
    href: downloadHref,
    hasIso: Boolean(download.isoUrl),
    isoDirect: /\/file\//.test(download.isoUrl || ""),
    hasSha: Boolean(download.sha256Url),
    label: download.isoUrl ? `Download ${release.isoFile}` : "Download NeelaOS",
  },
  abs: {
    url: site.url, og: abs("img/og-image.jpg"), icon: abs("img/icon-512.png"), author: abs(author.image),
    desktop: abs("img/desktop-1920.webp"), llms: abs("llms.txt"), llmsFull: abs("llms-full.txt"), sitemap: abs("sitemap.xml"),
    wallpapers: data.wallpapers.map((w) => ({ name: w.name, url: abs(`img/wp-${w.id}-1920.webp`) })),
  },
  devPacksList: data.devPacks.map((name, i) => ({ name, checked: i === 0 || i === 2 })),
};

/* ---------------------------------------------------------------- render src/ → root */
const files = readdirSync(join(ROOT, "src"));
for (const f of files) {
  const out = render(read(`src/${f}`), ctx, escapeFor(f));
  writeFileSync(join(ROOT, f), out.replace(/\n{3,}/g, "\n\n"));
}
console.log(`Built ${files.length} files: ${files.join(", ")}`);
console.log(`Download button → ${downloadHref}${release.available ? "" : "  (release.available = false: coming-soon notice shown)"}`);
