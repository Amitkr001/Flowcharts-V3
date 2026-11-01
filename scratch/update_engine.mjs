import fs from 'node:fs';

const filePath = 'web/src/chart/engine.ts';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Heatmap rendering block
const oldHeatmapRegex = /\/\* ---------- liquidity heatmap ---------- \*\/[\s\S]*?(?=\/\* ---------- order-flow zones behind price ---------- \*\/)/;
const newHeatmap = `/* ---------- liquidity heatmap ---------- */
    if (heat && this.md) {
      const cols = this.md.heat;
      let a = 0, b = cols.length - 1; while (a <= b) { const m = (a + b) >> 1; if (cols[m].t < tLo) a = m + 1; else b = m - 1; }
      const i0 = Math.max(0, a - 1);
      const sizes: number[] = [];
      for (let i = i0; i < cols.length && cols[i].t <= tHi && cols[i].t <= tEnd; i++) {
        for (const l of cols[i].l) if (l[1] > 0) sizes.push(l[1]);
      }
      sizes.sort((x, y) => x - y);
      // Use 98th percentile resting size as reference ceiling so a single spoof order doesn't black out the entire heatmap
      const p98 = sizes.length ? sizes[Math.min(sizes.length - 1, Math.floor(sizes.length * 0.98))] : 1;
      const contrast = Math.max(0.2, Math.min(1.0, this.flow.heatContrast || 0.55));
      const mx = Math.max(1e-9, p98 * (1.25 - contrast * 0.75));
      const rowH = Math.max(1.2, pxRow);
      for (let i = i0; i < cols.length && cols[i].t <= tHi && cols[i].t <= tEnd; i++) {
        const c = cols[i], x = this.timeToX(c.t);
        const nx = i + 1 < cols.length ? this.timeToX(cols[i + 1].t) : x + Math.max(2, cw * 0.5);
        const w = Math.max(1.5, Math.min(Math.max(1.5, nx - x), cw * 6) + 0.75);
        for (const [p, q, s] of c.l) {
          const yy = yOf(p + row * 0.5);
          if (yy > mainH || yy + rowH < 0) continue;
          const ix = Math.min(63, Math.floor(Math.pow(Math.min(1, q / mx), contrast) * 63));
          if (ix < (this.flow.heatCutoff ?? 4)) continue;
          ctx.fillStyle = s > 0 ? HEAT_BID[ix] : HEAT_ASK[ix];
          ctx.fillRect(x, yy, w, rowH + 0.6);
        }
      }
      ctx.lineWidth = 1.5;
      for (let i = Math.max(first, 1); i <= last; i++) {
        const p0 = bars[i - 1], c = bars[i];
        ctx.strokeStyle = c.c >= p0.c ? BULL : '#a47cf2';
        ctx.beginPath(); ctx.moveTo(xOf(i - 1), yOf(p0.c)); ctx.lineTo(xOf(i), yOf(c.c)); ctx.stroke();
      }
      for (let i = first; i <= last; i++) {
        if (cw < 3 && i % 2) continue;
        const c = bars[i];
        ctx.fillStyle = c.b >= c.s ? '#7be36f' : '#b27ae6';
        ctx.beginPath(); ctx.arc(xOf(i), yOf(c.c), 1.8, 0, 7); ctx.fill();
      }
      if (ov.bubbles) for (let i = first; i <= last; i++) for (const t of bars[i].big) this.bubble(xOf(i), yOf(t[1]), t[2], t[1], t[3], true);
    }
    `;

if (oldHeatmapRegex.test(code)) {
  code = code.replace(oldHeatmapRegex, newHeatmap);
  console.log('✓ Heatmap block replaced');
} else {
  console.warn('⚠️ Could not match oldHeatmapRegex');
}

// 2. DOM ladder strip block
const oldDomRegex = /\/\* ---------- DOM ladder strip \(heatmap\) ---------- \*\/[\s\S]*?(?=const ax = plotW \+ ladW;)/;
const newDom = `/* ---------- DOM ladder strip (heatmap) ---------- */
    if (ladW && this.md) {
      const lx = plotW; ctx.fillStyle = bg; ctx.fillRect(lx, 0, ladW, mainH);
      const lv = new Map<number, [number, number]>(); let mx = 1;
      for (const [p, q] of this.md.book.b) { const k = Math.round(p / row); const e = lv.get(k) || [0, 1]; e[0] += q; lv.set(k, e); }
      for (const [p, q] of this.md.book.a) { const k = Math.round(p / row); const e = lv.get(k) || [0, -1]; e[0] += q; e[1] = -1; lv.set(k, e); }
      for (const e of lv.values()) mx = Math.max(mx, e[0]);
      const step = Math.max(1, Math.ceil(13 / pxRow));
      ctx.font = \`10.5px \${MONO}\`; ctx.textBaseline = 'middle';
      for (const [k, [q, s]] of lv) {
        if (k % step) continue;
        const yy = yOf(k * row);
        if (yy < 6 || yy > mainH - 6) continue;
        ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, (q / mx) * 2);
        ctx.fillStyle = s > 0 ? '#1aa51a' : '#6b2fb3';
        ctx.fillRect(lx, yy - 6.5, 4 + Math.min(1, q / mx) * 30, 13);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.fillText(fmtQ(q), lx + 3, yy);
      }
    }
    `;

if (oldDomRegex.test(code)) {
  code = code.replace(oldDomRegex, newDom);
  console.log('✓ DOM ladder block replaced');
} else {
  console.warn('⚠️ Could not match oldDomRegex');
}

// 3. drawFootprint method
const oldFootprintRegex = /private drawFootprint\([\s\S]*?(?=private drawProfile\()/;
const newFootprint = `private drawFootprint(bars: Bar[], first: number, last: number, xOf: (i: number) => number, yOf: (p: number) => number, row: number, pxRow: number, cw: number) {
    const ctx = this.ctx, mode = this.opt.fpMode || 'ba', ratio = this.flow.fpRatio || 3, minV = this.flow.fpMinVol || 0;
    const mul = Math.max(1, Math.ceil(16 / pxRow)), rowPx = pxRow * mul, colW = cw * 0.88, showTxt = cw >= 56 && rowPx >= 11;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    for (let i = first; i <= last; i++) {
      const c = bars[i], x0 = xOf(i) - colW / 2, up = c.c >= c.o;
      ctx.fillStyle = up ? BULL : BEAR;
      ctx.fillRect(x0, yOf(c.h), 2, Math.max(1, yOf(c.l) - yOf(c.h)));
      const yb = yOf(Math.max(c.o, c.c)); ctx.fillRect(x0 - 1, yb, 5, Math.max(2, yOf(Math.min(c.o, c.c)) - yb));
      if (!c.fp.size) {
        ctx.fillStyle = '#ffffff0c'; ctx.fillRect(x0 + 8, yOf(c.h), colW - 10, Math.max(1, yOf(c.l) - yOf(c.h)));
        if (showTxt) { ctx.fillStyle = '#4a5361'; ctx.font = \`10px \${FONT}\`; ctx.fillText('no tick data', x0 + colW / 2, (yOf(c.h) + yOf(c.l)) / 2); }
        continue;
      }
      const rows = new Map<number, [number, number]>();
      for (const [k, [s, b]] of c.fp) { const rk = Math.floor(k / mul); const r = rows.get(rk) || [0, 0]; r[0] += s; r[1] += b; rows.set(rk, r); }
      let mx = 0, poc = 0, mxD = 1e-12;
      for (const [rk, r] of rows) {
        const t = r[0] + r[1];
        if (t > mx) { mx = t; poc = rk; }
        mxD = Math.max(mxD, Math.abs(r[1] - r[0]));
      }
      const cx0 = x0 + 8, cW = colW - 10, half = cW / 2;
      const effMinV = minV > 0 ? minV : mx * 0.05;
      for (const [rk, [s, b]] of rows) {
        const centerPrice = (rk * mul + (mul - 1) * 0.5) * row;
        const yy = yOf(centerPrice + (mul * row) * 0.5);
        const h = Math.max(1, rowPx - 1.5), tot = s + b, d = b - s, fs = Math.min(12, rowPx * 0.72);
        if (mode === 'delta') {
          const a = Math.abs(d) / mxD;
          ctx.fillStyle = d >= 0 ? \`rgba(34,197,139,\${0.12 + 0.6 * a})\` : \`rgba(139,92,246,\${0.15 + 0.65 * a})\`;
          ctx.fillRect(cx0, yy + 1, cW, h);
          if (showTxt) { ctx.font = \`\${a > 0.6 ? '700 ' : ''}\${fs}px \${MONO}\`; ctx.fillStyle = '#f2f2f2'; ctx.fillText((d > 0 ? '+' : '') + fmtQ(d), cx0 + half, yy + 1 + h / 2); }
        } else if (mode === 'vol') {
          ctx.fillStyle = b >= s ? 'rgba(34,197,139,0.45)' : 'rgba(139,92,246,0.5)';
          ctx.fillRect(cx0, yy + 1, Math.max(3, (tot / mx) * cW), h);
          if (showTxt) { ctx.font = \`\${fs}px \${MONO}\`; ctx.fillStyle = '#f2f2f2'; ctx.textAlign = 'left'; ctx.fillText(fmtQ(tot), cx0 + 4, yy + 1 + h / 2); ctx.textAlign = 'center'; }
        } else {
          const strong = Math.abs(d) / (tot || 1) > 0.45 && tot > mx * 0.35;
          ctx.fillStyle = b >= s ? (strong ? 'rgba(34,197,139,0.75)' : 'rgba(34,197,139,0.35)') : (strong ? 'rgba(139,92,246,0.8)' : 'rgba(139,92,246,0.38)');
          ctx.fillRect(cx0, yy + 1, Math.max(4, (tot / mx) * half), h);
          if (showTxt) {
            const below = rows.get(rk - 1), above = rows.get(rk + 1);
            const imbB = !!below && b >= below[0] * ratio && b >= effMinV;
            const imbS = !!above && s >= above[1] * ratio && s >= effMinV;
            ctx.font = \`\${imbS ? '700 ' : ''}\${fs}px \${MONO}\`; ctx.fillStyle = imbS ? '#ff3df5' : '#e9edf2'; ctx.fillText(fmtQ(s), cx0 + half * 0.5, yy + 1 + h / 2);
            ctx.font = \`\${imbB ? '700 ' : ''}\${fs}px \${MONO}\`; ctx.fillStyle = imbB ? '#00e5ff' : '#e9edf2'; ctx.fillText(fmtQ(b), cx0 + half * 1.5, yy + 1 + h / 2);
          }
        }
        if (rk === poc) { ctx.strokeStyle = '#e6c84a'; ctx.lineWidth = 1.5; ctx.strokeRect(cx0 + 0.5, yy + 1.5, cW - 1, h - 1); ctx.lineWidth = 1; }
      }
      if (showTxt) {
        const dl = c.b - c.s;
        ctx.font = \`600 11px \${MONO}\`; ctx.fillStyle = dl >= 0 ? BULL : BEAR_HI;
        ctx.fillText(\`Δ \${dl > 0 ? '+' : ''}\${fmtQ(dl)}\`, x0 + colW / 2, yOf(c.l) + rowPx / 2 + 12);
        ctx.fillStyle = '#6b7684'; ctx.font = \`10.5px \${MONO}\`;
        ctx.fillText(\`V \${fmtQ(c.v)}\`, x0 + colW / 2, yOf(c.l) + rowPx / 2 + 26);
      }
    }
    ctx.textAlign = 'left';
  }

  `;

if (oldFootprintRegex.test(code)) {
  code = code.replace(oldFootprintRegex, newFootprint);
  console.log('✓ Footprint block replaced');
} else {
  console.warn('⚠️ Could not match oldFootprintRegex');
}

// 4. renderSingleProfile method
const oldRspRegex = /private renderSingleProfile\([\s\S]*?(?=private drawImbalanceZones\()/;
const newRsp = `private renderSingleProfile(
    bars: Bar[],
    first: number,
    last: number,
    isDaily: boolean,
    side: 'right' | 'left',
    yOf: (p: number) => number,
    row: number,
    pxRow: number,
    plotW: number,
    mainH: number,
    fmtP: (p: number) => string
  ) {
    const ctx = this.ctx, f = this.flow;

    let f0 = first;
    if (isDaily) {
      const d0 = new Date(bars[last].t);
      d0.setUTCHours(0, 0, 0, 0);
      const dayStartMs = d0.getTime();
      f0 = last;
      while (f0 > 0 && bars[f0 - 1].t >= dayStartMs) f0--;
    }
    if (f0 > last) return;

    const rawProf = new Map<number, { s: number; b: number; tot: number }>();
    let totVol = 0, totBuy = 0, totSell = 0;
    const addRaw = (k: number, s: number, b: number) => {
      let r = rawProf.get(k);
      if (!r) { r = { s: 0, b: 0, tot: 0 }; rawProf.set(k, r); }
      r.s += s; r.b += b; r.tot += s + b;
      totVol += s + b; totBuy += b; totSell += s;
    };

    for (let i = f0; i <= last; i++) {
      const c = bars[i];
      if (c.fp && c.fp.size > 0) {
        for (const [k, [s, b]] of c.fp) addRaw(k, s, b);
      } else {
        const kLo = Math.round(c.l / row), kHi = Math.round(c.h / row);
        const bLo = Math.round(Math.min(c.o, c.c) / row), bHi = Math.round(Math.max(c.o, c.c) / row);
        let wSum = 0;
        for (let k = kLo; k <= kHi; k++) wSum += (k >= bLo && k <= bHi) ? 2 : 1;
        if (wSum > 0) {
          const sUnit = c.s / wSum, bUnit = c.b / wSum;
          for (let k = kLo; k <= kHi; k++) {
            const w = (k >= bLo && k <= bHi) ? 2 : 1;
            addRaw(k, sUnit * w, bUnit * w);
          }
        }
      }
    }
    if (!rawProf.size || totVol <= 0) return;

    const targetBinPx = 4.5;
    const kGroup = Math.max(1, Math.round(targetBinPx / Math.max(0.001, pxRow)));
    const binH = Math.max(2, Math.min(pxRow * kGroup - 0.8, 30));

    const binnedProf = new Map<number, { s: number; b: number; tot: number; pv: number; price: number; maxK: number; maxKVol: number }>();
    for (const [k, v] of rawProf) {
      const binKey = Math.floor(k / kGroup) * kGroup;
      let bin = binnedProf.get(binKey);
      if (!bin) {
        bin = { s: 0, b: 0, tot: 0, pv: 0, price: (binKey + (kGroup - 1) / 2) * row, maxK: k, maxKVol: v.tot };
        binnedProf.set(binKey, bin);
      }
      bin.s += v.s; bin.b += v.b; bin.tot += v.tot;
      bin.pv += (k * row) * v.tot;
      if (v.tot > bin.maxKVol) { bin.maxKVol = v.tot; bin.maxK = k; }
    }
    for (const bin of binnedProf.values()) {
      // Exact price of the dominant sub-row inside the bin so POC/VAH/VAL never drift from tick grid
      bin.price = bin.maxK * row;
    }

    let maxBinVol = 0, pocKey = 0, maxDelta = 0, deltaPocKey = 0;
    for (const [bk, bin] of binnedProf) {
      if (bin.tot > maxBinVol) { maxBinVol = bin.tot; pocKey = bk; }
      const d = Math.abs(bin.b - bin.s);
      if (d > maxDelta) { maxDelta = d; deltaPocKey = bk; }
    }
    if (maxBinVol <= 0) return;

    const binKeys = [...binnedProf.keys()].sort((a, b) => a - b);
    const pocIdx = binKeys.indexOf(pocKey);
    const vaPct = Math.max(0.5, Math.min(0.95, (f?.vpVaPct || 70) / 100));
    const targetVa = totVol * vaPct;

    const inVaSet = new Set<number>();
    inVaSet.add(pocKey);
    let curVaVol = binnedProf.get(pocKey)!.tot;
    let up = pocIdx + 1, dn = pocIdx - 1;
    while (curVaVol < targetVa && (up < binKeys.length || dn >= 0)) {
      const upVol = up < binKeys.length ? binnedProf.get(binKeys[up])!.tot : -1;
      const dnVol = dn >= 0 ? binnedProf.get(binKeys[dn])!.tot : -1;
      if (upVol >= dnVol && up < binKeys.length) {
        inVaSet.add(binKeys[up]);
        curVaVol += upVol;
        up++;
      } else if (dn >= 0) {
        inVaSet.add(binKeys[dn]);
        curVaVol += dnVol;
        dn--;
      } else break;
    }

    const pocPrice = binnedProf.get(pocKey)!.price;
    const deltaPocPrice = binnedProf.get(deltaPocKey)!.price;
    const valPrice = binnedProf.get(binKeys[Math.max(0, dn + 1)])!.price;
    const vahPrice = binnedProf.get(binKeys[Math.min(binKeys.length - 1, up - 1)])!.price;

    const maxW = Math.min(plotW * 0.42, Math.max(130, plotW * ((f?.vpWidth || 22) / 100)));
    const vpMode = f?.vpMode || 'split';
    const isSplit = vpMode === 'split';

    for (const [bk, bin] of binnedProf) {
      const midPrice = (bk + (kGroup - 1) / 2) * row;
      const yy = Math.round(yOf(midPrice));
      if (yy < -20 || yy > mainH + 20) continue;
      const yTop = Math.round(yy - binH / 2);
      const inVa = inVaSet.has(bk);
      const isPoc = (bk === pocKey);
      const isHvn = bin.tot >= maxBinVol * 0.85;

      if (vpMode === 'split' || vpMode === 'normal') {
        const allocW = isSplit ? maxW * 0.65 : maxW;
        const wNorm = Math.max(2, (bin.tot / maxBinVol) * allocW);
        const buyRatio = bin.b / (bin.tot || 1);
        const wBuy = wNorm * buyRatio;
        const wSell = wNorm - wBuy;

        let buyCol: string, sellCol: string;
        if (isPoc) {
          buyCol = 'rgba(230, 200, 74, 0.95)';
          sellCol = 'rgba(215, 175, 45, 0.95)';
        } else if (inVa) {
          buyCol = 'rgba(46, 189, 133, 0.82)';
          sellCol = 'rgba(168, 85, 247, 0.82)';
        } else {
          buyCol = 'rgba(46, 189, 133, 0.28)';
          sellCol = 'rgba(168, 85, 247, 0.28)';
        }

        if (side === 'right') {
          const barLeft = plotW - wNorm;
          ctx.fillStyle = sellCol;
          ctx.fillRect(barLeft, yTop, wSell, binH);
          ctx.fillStyle = buyCol;
          ctx.fillRect(barLeft + wSell, yTop, wBuy, binH);
          if (isHvn && !isPoc) {
            ctx.fillStyle = '#eb2f2f';
            ctx.fillRect(barLeft - 3, yTop, 3, binH);
          }
        } else {
          ctx.fillStyle = buyCol;
          ctx.fillRect(0, yTop, wBuy, binH);
          ctx.fillStyle = sellCol;
          ctx.fillRect(wBuy, yTop, wSell, binH);
          if (isHvn && !isPoc) {
            ctx.fillStyle = '#eb2f2f';
            ctx.fillRect(wNorm, yTop, 3, binH);
          }
        }
      }

      if (vpMode === 'split' || vpMode === 'delta') {
        const allocW = isSplit ? maxW * 0.32 : maxW;
        const delta = bin.b - bin.s;
        const absDelta = Math.abs(delta);
        const wDelta = Math.max(1, (absDelta / (maxDelta || 1)) * allocW);
        const isPos = delta >= 0;

        const dCol = isPos
          ? (inVa ? 'rgba(34, 197, 139, 0.90)' : 'rgba(34, 197, 139, 0.35)')
          : (inVa ? 'rgba(168, 85, 247, 0.90)' : 'rgba(168, 85, 247, 0.35)');

        if (side === 'right') {
          const deltaBase = plotW - maxW;
          ctx.fillStyle = dCol;
          ctx.fillRect(deltaBase, yTop, wDelta, binH);
        } else {
          const deltaBase = maxW;
          ctx.fillStyle = dCol;
          ctx.fillRect(deltaBase - wDelta, yTop, wDelta, binH);
        }
      }
    }

    ctx.strokeStyle = 'rgba(229, 207, 122, 0.40)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    let started = false;
    for (const bk of binKeys) {
      const bin = binnedProf.get(bk)!;
      const midPrice = (bk + (kGroup - 1) / 2) * row;
      const yy = Math.round(yOf(midPrice));
      if (yy < 0 || yy > mainH) continue;
      const allocW = isSplit ? maxW * 0.65 : maxW;
      const wNorm = Math.max(2, (bin.tot / maxBinVol) * allocW);
      const tipX = side === 'right' ? plotW - wNorm : wNorm;
      if (!started) { ctx.moveTo(tipX, yy); started = true; }
      else { ctx.lineTo(tipX, yy); }
    }
    if (started) ctx.stroke();

    const yyPoc = Math.round(yOf(pocPrice));
    if (yyPoc >= 0 && yyPoc <= mainH) {
      ctx.strokeStyle = 'rgba(230, 200, 74, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, yyPoc);
      ctx.lineTo(plotW, yyPoc);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = '#e6c84a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      if (side === 'right') { ctx.moveTo(plotW - maxW, yyPoc); ctx.lineTo(plotW, yyPoc); }
      else { ctx.moveTo(0, yyPoc); ctx.lineTo(maxW, yyPoc); }
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    const yyVah = Math.round(yOf(vahPrice));
    if (yyVah >= 0 && yyVah <= mainH) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(side === 'right' ? plotW - maxW : 0, yyVah);
      ctx.lineTo(side === 'right' ? plotW : maxW, yyVah);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const yyVal = Math.round(yOf(valPrice));
    if (yyVal >= 0 && yyVal <= mainH) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(side === 'right' ? plotW - maxW : 0, yyVal);
      ctx.lineTo(side === 'right' ? plotW : maxW, yyVal);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const drawVpTag = (x: number, y: number, s: string, bgc: string, fg: string, align: 'left' | 'right') => {
      if (!isFinite(y) || y < 0 || y > mainH) return;
      ctx.font = \`600 10px \${FONT}\`;
      const tw = ctx.measureText(s).width + 8;
      const tagX = align === 'right' ? x - tw : x;
      ctx.fillStyle = bgc;
      ctx.fillRect(tagX, y - 7.5, tw, 15);
      ctx.fillStyle = fg;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(s, tagX + 4, y);
    };

    const prefix = isDaily ? 'D-' : '';
    if (side === 'right') {
      drawVpTag(plotW, yyPoc, \`\${prefix}POC \${fmtP(pocPrice)} (\${fmtQ(binnedProf.get(pocKey)!.tot)})\`, '#e6c84a', '#111315', 'right');
      drawVpTag(plotW, yyVah, \`\${prefix}VAH \${fmtP(vahPrice)}\`, '#0369a1', '#f0f9ff', 'right');
      drawVpTag(plotW, yyVal, \`\${prefix}VAL \${fmtP(valPrice)}\`, '#0369a1', '#f0f9ff', 'right');
      if (isSplit && deltaPocPrice !== pocPrice) {
        const yyDeltaPoc = Math.round(yOf(deltaPocPrice));
        if (yyDeltaPoc >= 0 && yyDeltaPoc <= mainH) {
          drawVpTag(plotW - maxW * 0.65, yyDeltaPoc, \`ΔPOC \${fmtP(deltaPocPrice)}\`, '#7c3aed', '#ffffff', 'right');
        }
      }
    } else {
      drawVpTag(0, yyPoc, \`\${prefix}POC \${fmtP(pocPrice)} (\${fmtQ(binnedProf.get(pocKey)!.tot)})\`, '#e6c84a', '#111315', 'left');
      drawVpTag(0, yyVah, \`\${prefix}VAH \${fmtP(vahPrice)}\`, '#0369a1', '#f0f9ff', 'left');
      drawVpTag(0, yyVal, \`\${prefix}VAL \${fmtP(valPrice)}\`, '#0369a1', '#f0f9ff', 'left');
    }

    const netDelta = totBuy - totSell;
    const buyPct = Math.round((totBuy / (totVol || 1)) * 100);
    const sellPct = 100 - buyPct;
    const title = isDaily ? 'DAILY VP (UTC)' : 'VISIBLE VP';
    const badgeText = \`\${title}  ·  Vol: \${fmtQ(totVol)}  ·  Buy: \${buyPct}%  ·  Sell: \${sellPct}%  ·  Δ: \${netDelta >= 0 ? '+' : ''}\${fmtQ(netDelta)}\`;

    ctx.font = \`600 10.5px \${FONT}\`;
    const bW = ctx.measureText(badgeText).width + 24;
    const bX = side === 'right' ? plotW - bW - 8 : 8;
    const bY = 8;

    ctx.fillStyle = 'rgba(18, 20, 24, 0.88)';
    if (typeof (ctx as any).roundRect === 'function') {
      ctx.beginPath();
      (ctx as any).roundRect(bX, bY, bW, 20, 4);
      ctx.fill();
    } else {
      ctx.fillRect(bX, bY, bW, 20);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = isDaily ? '#38bdf8' : '#2ebd85';
    ctx.beginPath();
    ctx.arc(bX + 10, bY + 10, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(badgeText, bX + 18, bY + 10);
  }

  `;

if (oldRspRegex.test(code)) {
  code = code.replace(oldRspRegex, newRsp);
  console.log('✓ renderSingleProfile block replaced');
} else {
  console.warn('⚠️ Could not match oldRspRegex');
}

// 5. drawImbalanceZones & drawWalls methods
const oldZonesAndWallsRegex = /private drawImbalanceZones\([\s\S]*?(?=\/\* ================================================================ interaction \*\/)/;
const newZonesAndWalls = `private drawImbalanceZones(bars: Bar[], first: number, last: number, xOf: (i: number) => number, yOf: (p: number) => number, row: number, plotW: number, cw: number) {
    const ctx = this.ctx, n = bars.length, ratio = this.flow.fpRatio || 3, minV = this.flow.fpMinVol || 0, zones: { i: number; lo: number; hi: number; side: 1 | -1 }[] = [];
    for (let i = Math.max(0, first - 200); i <= last; i++) {
      const c = bars[i]; if (c.fp.size < 4) continue;
      const ks = [...c.fp.keys()].sort((a, b) => a - b);
      let maxRowVol = 0;
      for (const [, [s, b]] of c.fp) if (s + b > maxRowVol) maxRowVol = s + b;
      const effMinV = minV > 0 ? minV : maxRowVol * 0.08;

      let rb = 0, bS = 0, bE = 0, rs = 0, sS = 0, sE = 0;
      for (let j = 1; j <= ks.length; j++) {
        const cur = j < ks.length ? c.fp.get(ks[j])! : null, prev = c.fp.get(ks[j - 1])!;
        const adj = !!cur && (ks[j] - ks[j - 1] <= 2);
        if (adj && cur![1] >= prev[0] * ratio && cur![1] >= effMinV) {
          if (!rb) bS = ks[j]; bE = ks[j]; rb++;
        } else {
          if (rb >= 3) zones.push({ i, lo: (bS - 0.5) * row, hi: (bE + 0.5) * row, side: 1 });
          rb = 0;
        }
        if (adj && prev[0] >= cur![1] * ratio && prev[0] >= effMinV) {
          if (!rs) sS = ks[j - 1]; sE = ks[j - 1]; rs++;
        } else {
          if (rs >= 3) zones.push({ i, lo: (sS - 0.5) * row, hi: (sE + 0.5) * row, side: -1 });
          rs = 0;
        }
      }
    }
    for (const z of zones) {
      let end = n;
      for (let j = z.i + 1; j < n; j++) if (z.side > 0 ? bars[j].l < z.lo : bars[j].h > z.hi) { end = j; break; }
      if (end < first) continue;
      const x1 = xOf(z.i) - cw / 2, x2 = end >= n ? plotW : xOf(end), y1 = yOf(z.hi), y2 = yOf(z.lo), open = end >= n;
      const col = z.side > 0 ? '0,229,255' : '255,61,245';
      ctx.fillStyle = \`rgba(\${col},\${open ? 0.16 : 0.07})\`; ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.fillStyle = \`rgba(\${col},\${open ? 0.9 : 0.4})\`; ctx.fillRect(x1, y1, 2, y2 - y1);
      if (open) { ctx.strokeStyle = \`rgba(\${col},0.55)\`; ctx.beginPath(); ctx.moveTo(x1, y1 + 0.5); ctx.lineTo(x2, y1 + 0.5); ctx.moveTo(x1, y2 - 0.5); ctx.lineTo(x2, y2 - 0.5); ctx.stroke(); }
    }
  }

  private drawWalls(yOf: (p: number) => number, plotW: number, mainH: number, row: number, xLast: number) {
    const ctx = this.ctx, md = this.md!, lv = new Map<number, [number, 1 | -1]>();
    for (const [p, q] of md.book.b) { const k = Math.round(p / row); const e = lv.get(k) || [0, 1]; e[0] += q; lv.set(k, e); }
    for (const [p, q] of md.book.a) { const k = Math.round(p / row); const e = lv.get(k) || [0, -1]; e[0] += q; e[1] = -1; lv.set(k, e); }
    if (lv.size < 6) return;
    const sizes = [...lv.values()].map(e => e[0]).sort((a, b) => a - b), med = sizes[sizes.length >> 1] || 1, mx = sizes[sizes.length - 1];
    const mult = settings.get().wallMult || 3;
    const pick = (side: 1 | -1) => [...lv.entries()].filter(([, e]) => e[1] === side && e[0] >= med * mult).sort((a, b) => b[1][0] - a[1][0]).slice(0, 3);
    ctx.font = \`600 10.5px \${MONO}\`; ctx.textBaseline = 'middle';
    for (const [k, [q, side]] of [...pick(1), ...pick(-1)]) {
      const yy = yOf(k * row); if (yy < 4 || yy > mainH - 4) continue;
      const col = side > 0 ? '34,197,139' : '164,124,242', w = 1 + 3 * (q / mx), x0 = Math.max(0, xLast + 6);
      ctx.strokeStyle = \`rgba(\${col},0.18)\`; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(x0, yy); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = \`rgba(\${col},0.75)\`; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(plotW, yy); ctx.stroke(); ctx.lineWidth = 1;
      const s = \`\${side > 0 ? 'BID' : 'ASK'} \${fmtQ(q)}\`, tw = ctx.measureText(s).width + 10;
      ctx.fillStyle = side > 0 ? '#14684a' : '#4b2d86'; ctx.fillRect(plotW - tw - 4, yy - 8, tw, 16); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(s, plotW - tw + 1, yy);
    }
  }

  `;

if (oldZonesAndWallsRegex.test(code)) {
  code = code.replace(oldZonesAndWallsRegex, newZonesAndWalls);
  console.log('✓ Zones & Walls blocks replaced');
} else {
  console.warn('⚠️ Could not match oldZonesAndWallsRegex');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('web/src/chart/engine.ts update completed successfully!');
