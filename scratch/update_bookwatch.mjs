import fs from 'fs';

const path = 'web/src/data/bookwatch.ts';
let code = fs.readFileSync(path, 'utf8');

const oldRegex = /private onTicks\(ts: \[number, number, number, Side, number\?\]\[\]\) \{[\s\S]*?private onBook\(\) \{[\s\S]*?\n  \}/;

const newBlock = `private onTicks(ts: [number, number, number, Side, number?][]) {
    for (const [, p, q, s] of ts) {
      this.last = p;
      const L = this.lv.get(this.key(s > 0 ? -1 : 1, Math.round(p / this.row)));
      if (L) L.traded += q;
    }
  }

  private emit(m: BookMark) { this.marks.push(m); if (this.marks.length > 3000) this.marks.splice(0, 500); this.ls.forEach(f => f(m)); }

  private onBook() {
    const now = Date.now(), row = this.row, bins = new Map<string, { side: Side; k: number; q: number }>();
    const add = (arr: [number, number][], side: Side) => {
      for (const [p, q] of arr) {
        const k = Math.round(p / row), key = this.key(side, k);
        const e = bins.get(key);
        if (e) e.q += q; else bins.set(key, { side, k, q });
      }
    };
    add(this.md.book.b, 1); add(this.md.book.a, -1);
    if (bins.size < 6) return;
    const sizes = [...bins.values()].map(x => x.q).sort((a, b) => a - b), thr = (sizes[sizes.length >> 1] || 0) * this.mult;
    const px = this.last || this.md.lastPrice, near = Math.max(row * 8, px * 0.002);

    for (const [key, b] of bins) {
      const L = this.lv.get(key);
      if (L) {
        if (b.q > L.size * 1.15 && L.traded > L.tradedAtLast) L.refills++;
        L.tradedAtLast = L.traded; L.size = b.q; L.max = Math.max(L.max, b.q);
        if (L.traded >= L.max * 1.5 && L.refills >= 1 && now - L.iceAt > 60_000) {
          L.iceAt = now;
          this.emit({ t: now, p: b.k * row, kind: 'ice', side: b.side, q: L.traded, refills: L.refills });
        }
      } else if (b.q >= thr && thr > 0) {
        this.lv.set(key, { side: b.side, first: now, max: b.q, size: b.q, traded: 0, tradedAtLast: 0, refills: 0, iceAt: 0 });
      }
    }
    for (const [key, L] of this.lv) {
      const b = bins.get(key), k = +key.slice(1), p = k * row;
      if (b && b.q >= L.max * 0.2) continue;
      if (Math.abs(p - px) <= near && now - L.first > 1500) {
        if (L.traded >= L.max * 0.6) this.emit({ t: now, p, kind: 'fill', side: L.side, q: L.max });
        else if (L.traded < L.max * 0.25) this.emit({ t: now, p, kind: 'pull', side: L.side, q: L.max });
      }
      this.lv.delete(key);
    }
  }`;

if (!oldRegex.test(code)) {
  console.error("Could not find onTicks/onBook block in bookwatch.ts!");
  process.exit(1);
}

code = code.replace(oldRegex, newBlock);
fs.writeFileSync(path, code, 'utf8');
console.log("Updated web/src/data/bookwatch.ts successfully!");
