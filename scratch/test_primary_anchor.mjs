const ws = new WebSocket('ws://localhost:8080/ws');
ws.onopen = () => {
  ws.send(JSON.stringify({ op: 'sub', sym: 'BTCUSD' }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.t === 'snap') {
    ws.close();
    testMixedWithPrimaryAnchor(msg.ticks);
  }
};

function testMixedWithPrimaryAnchor(ticks) {
  const sec = 60;
  const bars = [];
  
  const add = (tk) => {
    const [t, p, q, s, vi] = tk;
    let c = bars[bars.length - 1];
    let fresh = !c || c.k;
    if (!fresh) {
      fresh = Math.floor(t / (sec * 1000)) * sec * 1000 > c.t;
    }
    const isPrimary = (vi === 0 || vi === undefined);

    if (fresh) {
      const bt = Math.floor(t / (sec * 1000)) * sec * 1000;
      c = { t: bt, o: p, h: p, l: p, c: p, v: 0, b: 0, s: 0, k: false, hasPrimary: isPrimary };
      bars.push(c);
    }
    
    if (isPrimary) {
      if (!c.hasPrimary) {
        c.o = p; c.h = p; c.l = p; c.c = p; c.hasPrimary = true;
      } else {
        if (p > c.h) c.h = p;
        if (p < c.l) c.l = p;
        c.c = p;
      }
    }
    c.v += q;
    s > 0 ? (c.b += q) : (c.s += q);
  };

  for (const t of ticks) add(t);
  
  console.log('--- TEST WITH PRIMARY ANCHOR ON MIXED TICKS ---');
  for (const b of bars.slice(-10)) {
    const dateStr = new Date(b.t).toISOString().slice(11, 19);
    console.log(`${dateStr} | O:${b.o.toFixed(1)} H:${b.h.toFixed(1)} L:${b.l.toFixed(1)} C:${b.c.toFixed(1)} | range:${(b.h - b.l).toFixed(1)} | vol:${b.v.toFixed(2)}`);
  }
}
