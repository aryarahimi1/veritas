// Read-only link checker: extracts every http(s) URL from the docs + the demo's on-chain surfaces and
// curls each for a reachable status, so no dead link ships in the submission. Non-2xx/3xx => failure.
// Run:  node scripts/check-links.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FILES = ['README.md', 'SECURITY.md', 'PLAN.md', 'docs/architecture.md'];
const EXPLORER = 'https://stellar.expert/explorer/testnet';

// On-chain surfaces the live demo links (kept in sync with web/src/lib/fixtures.js).
const ONCHAIN = [
  `${EXPLORER}/contract/CB6DCNEGNXP7WQB3XVDABZ2TUNM5DSK4VYXLCE4OZWGXMGSZRGYBOFWV`,
  `${EXPLORER}/contract/CBOLT6FYCO4JKADIN2W66ZZJ4UDC3IW4SMG2MHYFZOIYF273LOI2PXOO`,
  `${EXPLORER}/tx/20c48e426a3bf44b7a719226f06db8f919da9b3028fc2f6ce20355554ddedc28`
];

const urls = new Set(ONCHAIN);
for (const f of FILES) {
  let txt = '';
  try {
    txt = readFileSync(join(ROOT, f), 'utf8');
  } catch {
    continue;
  }
  for (const m of txt.matchAll(/https?:\/\/[^\s)\]}"'>]+/g)) {
    urls.add(m[0].replace(/[.,;]+$/, '')); // trim trailing punctuation
  }
}

const check = async (url) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': 'veritas-link-check' }
    });
    return { url, status: r.status, ok: r.status < 400 };
  } catch (e) {
    return { url, status: 0, ok: false, err: String(e.name || e) };
  } finally {
    clearTimeout(t);
  }
};

const results = await Promise.all([...urls].sort().map(check));
let bad = 0;
for (const r of results) {
  const tag = r.ok ? 'OK  ' : (bad++, 'FAIL');
  console.log(`${tag} ${String(r.status || r.err || '').padEnd(5)} ${r.url}`);
}
console.log(`\n${results.length} links checked, ${bad} failing`);
process.exit(bad ? 1 : 0);
