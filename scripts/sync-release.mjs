#!/usr/bin/env node
/**
 * Pulls the latest NeelaOS release from GitHub into data/site.json.
 *
 *   node scripts/sync-release.mjs      (then: node build.mjs)
 *
 * Reads https://api.github.com/repos/<repo>/releases/latest and fills in version, date,
 * release notes link, ISO link/name/size and the SHA-256 (from the .sha256 asset).
 * Exits without changes when there is no published release yet.
 * Uses GITHUB_TOKEN if set (higher rate limit in GitHub Actions).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data/site.json");
const data = JSON.parse(readFileSync(DATA, "utf8"));

// "https://github.com/NeelaOS/NeelaOS" → "NeelaOS/NeelaOS"
const repo = new URL(data.links.repo).pathname.replace(/^\/|\/$/g, "");
const headers = { Accept: "application/vnd.github+json", "User-Agent": "neelaos-website" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
if (res.status === 404) {
  console.log(`No published release in ${repo} yet; nothing to sync.`);
  process.exit(0);
}
if (!res.ok) {
  console.error(`GitHub API error ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const rel = await res.json();

const iso = rel.assets.find((a) => a.name.toLowerCase().endsWith(".iso"));
const sha = rel.assets.find((a) => /\.sha256(sum)?$/i.test(a.name));
const gb = (bytes) => `${(bytes / 1024 ** 3).toFixed(1)} GB`;

let sha256 = data.release.sha256;
if (sha) {
  const r = await fetch(sha.browser_download_url, { headers: { "User-Agent": "neelaos-website" } });
  if (r.ok) sha256 = (await r.text()).match(/\b[a-f0-9]{64}\b/i)?.[0]?.toLowerCase() || sha256;
}

const before = JSON.stringify(data);
Object.assign(data.release, {
  version: rel.tag_name.replace(/^v/i, ""),
  date: (rel.published_at || "").slice(0, 10),
  notesUrl: rel.html_url,
  sha256,
});
// GitHub caps release files at 2 GB, so the ISO may be hosted elsewhere. Only take over the
// download fields when the release really has an .iso; otherwise keep what's set by hand.
if (iso) {
  Object.assign(data.release, { available: true, isoFile: iso.name, isoSize: gb(iso.size) });
  data.download.isoUrl = iso.browser_download_url;
}
if (sha) data.download.sha256Url = sha.browser_download_url;

if (JSON.stringify(data) === before) {
  console.log(`Already up to date with ${repo} ${rel.tag_name}.`);
} else {
  writeFileSync(DATA, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Synced ${repo} ${rel.tag_name}: ${iso ? iso.name : "no .iso asset"}${sha256 ? ", sha256 found" : ""}.`);
}
