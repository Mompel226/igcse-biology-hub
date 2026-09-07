/* Bump the cache stamp.  node tools/stamp.mjs
   Rewrites every ?v= in index.html AND version.txt from one value.
   version.txt on its own is a lie: the ?v= stamps are the real cache key. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STAMP = String(Math.floor(Date.now() / 1000));
const idx = resolve(REPO, 'index.html');
const html = readFileSync(idx, 'utf8');
const n = (html.match(/\?v=\d+/g) || []).length;
if (!n) { console.error('index.html carries no ?v= stamps'); process.exit(1); }
writeFileSync(idx, html.replace(/\?v=\d+/g, '?v=' + STAMP));
writeFileSync(resolve(REPO, 'version.txt'), STAMP + '\n');
console.log('stamped ' + n + ' assets and version.txt with ' + STAMP);
