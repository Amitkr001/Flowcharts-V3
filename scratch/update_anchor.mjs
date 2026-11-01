import fs from 'fs';

// 1. Update web/src/data/bars.ts
{
  const path = 'web/src/data/bars.ts';
  let code = fs.readFileSync(path, 'utf8');

  const oldBlock = `    if (fresh) {
      if (this.aggMs) this.flushCluster();
      const bt = this.spec.kind === 'time' ? Math.floor(t / (this.spec.sec * 1000)) * this.spec.sec * 1000 : t;
      c = { t: bt, o: p, h: p, l: p, c: p, v: 0, b: 0, s: 0, fp: new Map(), big: [] };
      this.bars.push(c); this.n = 0;
    }
    if (p > c.h) c.h = p; if (p < c.l) c.l = p; c.c = p;`;

  const newBlock = `    const isPrimary = (vi === 0 || vi === undefined);
    if (fresh) {
      if (this.aggMs) this.flushCluster();
      const bt = this.spec.kind === 'time' ? Math.floor(t / (this.spec.sec * 1000)) * this.spec.sec * 1000 : t;
      c = { t: bt, o: p, h: p, l: p, c: p, v: 0, b: 0, s: 0, fp: new Map(), big: [], hasPrimary: isPrimary };
      this.bars.push(c); this.n = 0;
    }
    if (isPrimary) {
      if (!(c as any).hasPrimary) {
        c.o = p; c.h = p; c.l = p; c.c = p; (c as any).hasPrimary = true;
      } else {
        if (p > c.h) c.h = p; if (p < c.l) c.l = p; c.c = p;
      }
    } else if (!(c as any).hasPrimary) {
      if (p > c.h) c.h = p; if (p < c.l) c.l = p; c.c = p;
    }`;

  if (!code.includes("if (p > c.h) c.h = p; if (p < c.l) c.l = p; c.c = p;")) {
    console.error("Could not find candle update block in bars.ts");
    process.exit(1);
  }

  code = code.replace(oldBlock, newBlock);
  fs.writeFileSync(path, code, 'utf8');
  console.log("Updated web/src/data/bars.ts successfully!");
}

// 2. Update server/src/market.ts
{
  const path = 'server/src/market.ts';
  let code = fs.readFileSync(path, 'utf8');

  const oldTarget = `    const tkSize = this.def.tick || 1e-8;
    const normP = +(Math.round(t.p / tkSize) * tkSize).toFixed(this.def.dec);
    this.last = normP;`;

  const newTarget = `    const tkSize = this.def.tick || 1e-8;
    const normP = +(Math.round(t.p / tkSize) * tkSize).toFixed(this.def.dec);
    if (t.ex === this.def.sources[0]?.ex || this.def.sources.length === 1) {
      this.last = normP;
    }`;

  if (!code.includes(oldTarget)) {
    console.error("Could not find this.last = normP in server/src/market.ts");
    process.exit(1);
  }

  code = code.replace(oldTarget, newTarget);
  fs.writeFileSync(path, code, 'utf8');
  console.log("Updated server/src/market.ts successfully!");
}
