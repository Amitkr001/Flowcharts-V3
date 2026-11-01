const resK = await fetch('http://localhost:8080/api/klines?sym=BTCUSD&tf=60&limit=50');
const klines = await resK.json();

const ws = new WebSocket('ws://localhost:8080/ws');
ws.onopen = () => {
  ws.send(JSON.stringify({ op: 'sub', sym: 'BTCUSD' }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.t === 'snap') {
    ws.close();
    simulate(klines, msg.ticks);
  }
};

function simulate(klines, ticks) {
  console.log(`Simulating with ${klines.length} klines and ${ticks.length} ticks`);
  
  // Let's implement BarBuilder logic
  const sec = 60;
  const bars = [];
  
  const add = (tk) => {
    const [t, p, q, s, vi] = tk;
    let c = bars[bars.length - 1];
    let fresh = !c || c.k;
    if (!fresh) {
      fresh = Math.floor(t / (sec * 1000)) * sec * 1000 > c.t;
    }
    if (c && c.k) {
      const bt = Math.floor(t / (sec * 1000)) * sec * 1000;
      if (bt === c.t) {
        c.k = false;
        c.v = 0; c.b = 0; c.s = 0;
        fresh = false;
      } else if (bt < c.t) return;
    }
    if (fresh) {
      const bt = Math.floor(t / (sec * 1000)) * sec * 1000;
      c = { t: bt, o: p, h: p, l: p, c: p, v: 0, b: 0, s: 0, k: false };
      bars.push(c);
    }
    if (p > c.h) c.h = p;
    if (p < c.l) c.l = p;
    c.c = p;
    c.v += q;
  };

  // First add ticks
  for (const t of ticks) add(t);
  
  // Then seed klines
  const firstBar = bars[0];
  const first = firstBar?.t ?? Infinity;
  const older = [];
  for (const x of klines) {
    if (x.t < first) older.push({ ...x, k: true });
    else if (firstBar && x.t === first && !firstBar.k) {
      firstBar.o = x.o;
      firstBar.h = Math.max(firstBar.h, x.h);
      firstBar.l = Math.min(firstBar.l, x.l);
    }
  }
  bars.unshift(...older);

  console.log(`Total bars built: ${bars.length}`);
  console.log('Last 15 bars:');
  for (const b of bars.slice(-15)) {
    const dateStr = new Date(b.t).toISOString().slice(11, 19);
    console.log(`${dateStr} | O:${b.o.toFixed(1)} H:${b.h.toFixed(1)} L:${b.l.toFixed(1)} C:${b.c.toFixed(1)} | range:${(b.h - b.l).toFixed(1)} | k:${b.k}`);
  }
}
