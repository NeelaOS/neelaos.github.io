#!/usr/bin/env node
/**
 * Pulls the latest NeelaOS release from GitHub into data/site.json.
 *
 *   node scripts/sync-release.mjs      (then: node build.mjs)
 *
 * Reads https://api.github.com/repos/<repo>/releases/latest and marks that version as
 * released (version, date, release notes link). Attached files are ignored.
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

// A published release is all we need: show its version as released. Attached files are not
// inspected; every Download button points to the latest release page.
const before = JSON.stringify(data);
Object.assign(data.release, {
  available: true,
  version: rel.tag_name.replace(/^v/i, ""),
  date: (rel.published_at || "").slice(0, 10),
  notesUrl: rel.html_url,
});

if (JSON.stringify(data) === before) {
  console.log(`Already up to date with ${repo} ${rel.tag_name}.`);
} else {
  writeFileSync(DATA, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Synced ${repo} ${rel.tag_name}: shown as released.`);
}
