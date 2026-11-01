import fs from 'fs';

const path = 'web/src/components/Docks.tsx';
let code = fs.readFileSync(path, 'utf8');

const oldRegex = /const bk = new Map<number, \[number, number\]>\(\); let mx = 1;[\s\S]*?if \(lb\) for \(const \[k, \[s, b\]\] of lb\.fp\) \{ const kk = Math\.floor\(\(k \* row \+ row \* 1e-6\) \/ row\); vol\.set\(kk, \(vol\.get\(kk\) \|\| 0\) \+ s \+ b\); \}/;

const newBlock = `const bk = new Map<number, [number, number]>(); let mx = 1;
  for (const [p, q] of bids) { const k = Math.round(p / row); const e = bk.get(k) || [0, 0]; e[0] += q; bk.set(k, e); }
  for (const [p, q] of asks) { const k = Math.round(p / row); const e = bk.get(k) || [0, 0]; e[1] += q; bk.set(k, e); }
  for (const e of bk.values()) mx = Math.max(mx, e[0], e[1]);
  const lb = lastBar(), base = Math.round(px / row), vol = new Map<number, number>();
  if (lb) for (const [k, [s, b]] of lb.fp) { const kk = Math.round((k * row) / row); vol.set(kk, (vol.get(kk) || 0) + s + b); }`;

if (!oldRegex.test(code)) {
  console.error("Could not find DomDock binning in Docks.tsx!");
  process.exit(1);
}

code = code.replace(oldRegex, newBlock);
fs.writeFileSync(path, code, 'utf8');
console.log("Updated web/src/components/Docks.tsx successfully!");
