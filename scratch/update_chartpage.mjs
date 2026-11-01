import fs from 'fs';

const path = 'web/src/pages/ChartPage.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add import soundFX
if (!code.includes("import { soundFX } from '../lib/audio';")) {
  code = code.replace(
    "import { recordFill } from '../lib/journal';",
    "import { recordFill } from '../lib/journal';\nimport { soundFX } from '../lib/audio';"
  );
  console.log("Added soundFX import.");
}

// 2. Wire soundFX in market subscription
const subRegex = /b\.onFill = \(f, before, after, avg\) => \{ recordFill\(sym\.id, f\.px, f\.pnl, before, after, avg, \(\) => eng\.current\?\.screenshot\(\) \?\? null\); \};[\s\S]*?const off = m\.on\(\(ev, d\) => \{ if \(ev === 'tk'\) b\.onTicks\(d\); if \(ev === 'snap' && m\.ticks\.length\) b\.last = m\.lastPrice; if \(ev === 'st' \|\| ev === 'snap'\) setStatusTick\(x => x \+ 1\); \}\);/;

const newSubBlock = `b.onFill = (f, before, after, avg) => {
      soundFX.playExecution();
      recordFill(sym.id, f.px, f.pnl, before, after, avg, () => eng.current?.screenshot() ?? null);
    };
    setBroker(b);
    const off = m.on((ev, d) => {
      if (ev === 'tk') {
        b.onTicks(d);
        for (const t of d) {
          const notional = t[1] * t[2];
          if (notional >= bigUsd) {
            soundFX.playBigTrade(t[3] > 0);
            break;
          }
        }
      } else if (ev === 'lq' && d?.length) {
        soundFX.playLiquidation();
      }
      if (ev === 'snap' && m.ticks.length) b.last = m.lastPrice;
      if (ev === 'st' || ev === 'snap') setStatusTick(x => x + 1);
    });`;

if (!subRegex.test(code)) {
  console.error("Could not find subscription block in ChartPage.tsx!");
  process.exit(1);
}

code = code.replace(subRegex, newSubBlock);
fs.writeFileSync(path, code, 'utf8');
console.log("Updated ChartPage.tsx successfully!");
