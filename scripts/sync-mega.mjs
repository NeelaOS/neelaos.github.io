#!/usr/bin/env node
/**
 * Reads the public MEGA folder in data/site.json (download.megaFolder) and fills in:
 *   download.isoUrl / download.sha256Url  direct links to each file inside the folder
 *   release.isoFile / release.isoSize     from the .iso file
 *   release.sha256                         read from the .sha256 file
 *
 *   node scripts/sync-mega.mjs      (then: node build.mjs)
 *
 * MEGA encrypts names and contents; the key is the part of the folder link after "#".
 * Zero dependencies (Node 18+). On any error it leaves data/site.json untouched.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDecipheriv } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data/site.json");
const data = JSON.parse(readFileSync(DATA, "utf8"));
const folderUrl = data.download.megaFolder;
if (!folderUrl) { console.log("download.megaFolder is empty; skipping MEGA sync."); process.exit(0); }

const m = folderUrl.match(/mega\.nz\/folder\/([\w-]+)#([\w-]+)/);
if (!m) { console.error(`Not a MEGA folder link: ${folderUrl}`); process.exit(1); }
const [, folderId, folderKeyB64] = m;

const b64 = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
const ecbDecrypt = (key, buf) => {
  const d = createDecipheriv("aes-128-ecb", key, null);
  d.setAutoPadding(false);
  return Buffer.concat([d.update(buf), d.final()]);
};
const api = async (body) => {
  const r = await fetch(`https://g.api.mega.co.nz/cs?id=${Date.now()}&n=${folderId}`, { method: "POST", body: JSON.stringify([body]) });
  const json = await r.json();
  const res = Array.isArray(json) ? json[0] : json;
  if (typeof res === "number") throw new Error(`MEGA API error ${res}`);
  return res;
};

try {
  const folderKey = b64(folderKeyB64);
  const { f: nodes } = await api({ a: "f", c: 1, ca: 1, r: 1 });

  const files = nodes.filter((n) => n.t === 0).map((n) => {
    const raw = ecbDecrypt(folderKey, b64(n.k.split("/")[0].split(":")[1])); // 32 bytes for files
    const key = Buffer.alloc(16);
    for (let i = 0; i < 16; i++) key[i] = raw[i] ^ raw[i + 16];  // AES key = k[0..15] XOR k[16..31]
    const iv = Buffer.concat([raw.subarray(16, 24), Buffer.alloc(8)]);
    const d = createDecipheriv("aes-128-cbc", key, Buffer.alloc(16));
    d.setAutoPadding(false);
    const attr = Buffer.concat([d.update(b64(n.a)), d.final()]).toString("utf8");
    const name = JSON.parse(attr.slice(4, attr.lastIndexOf("}") + 1)).n; // "MEGA{...}\0\0"
    return { name, size: n.s, handle: n.h, key, iv, url: `${folderUrl.split("#")[0]}#${folderKeyB64}/file/${n.h}` };
  });

  const iso = files.find((f) => /\.iso$/i.test(f.name));
  const sha = files.find((f) => /\.sha256(sum)?$/i.test(f.name));
  if (!iso) console.log(`MEGA: no .iso in the folder yet (found: ${files.map((f) => f.name).join(", ") || "nothing"}); Download buttons open the folder.`);

  let sha256 = data.release.sha256;
  if (sha) {
    const { g } = await api({ a: "g", g: 1, n: sha.handle });
    const enc = Buffer.from(await (await fetch(g)).arrayBuffer());
    const d = createDecipheriv("aes-128-ctr", sha.key, sha.iv);
    const text = Buffer.concat([d.update(enc), d.final()]).toString("utf8");
    sha256 = text.match(/\b[a-f0-9]{64}\b/i)?.[0]?.toLowerCase() || sha256;
  }

  const before = JSON.stringify(data);
  const gb = (bytes) => `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  data.release.sha256 = sha256;
  if (iso) Object.assign(data.release, { isoFile: iso.name, isoSize: gb(iso.size) });
  // Direct link to the ISO inside the folder once it's there; until then, the folder itself.
  Object.assign(data.download, { isoUrl: iso ? iso.url : folderUrl, sha256Url: sha ? sha.url : folderUrl });

  if (JSON.stringify(data) === before) console.log("MEGA: already up to date.");
  else {
    writeFileSync(DATA, `${JSON.stringify(data, null, 2)}\n`);
    console.log(`MEGA: ${iso ? `${iso.name} (${gb(iso.size)})` : "no ISO yet"}${sha ? `, sha256 ${sha256.slice(0, 12)}…` : ", no .sha256 file"}`);
  }
} catch (err) {
  console.error(`MEGA sync skipped: ${err.message}`);
  process.exit(0); // never break the site build because MEGA is unreachable
}
