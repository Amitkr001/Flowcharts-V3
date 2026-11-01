const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = () => {
  console.log('Connected to ws');
  ws.send(JSON.stringify({ op: 'sub', sym: 'BTCUSD' }));
};

const venuePrices = new Map();

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.t === 'snap') {
    console.log('Venues:', msg.venues);
    console.log('Snap last price:', msg.lastPrice);
    console.log('Tick count in snap:', msg.ticks?.length);
    if (msg.ticks) {
      const recent = msg.ticks.slice(-200);
      for (const [t, p, q, s, vIdx] of recent) {
        const vName = msg.venues[vIdx] || `v${vIdx}`;
        if (!venuePrices.has(vName)) venuePrices.set(vName, []);
        venuePrices.get(vName).push(p);
      }
      for (const [vName, arr] of venuePrices) {
        const min = Math.min(...arr);
        const max = Math.max(...arr);
        const last = arr[arr.length - 1];
        console.log(`Venue: ${vName} | count: ${arr.length} | last: ${last} | min: ${min} | max: ${max}`);
      }
    }
  } else if (msg.t === 'tk') {
    for (const [t, p, q, s, vIdx] of msg.d) {
      console.log(`Live tick: venueIdx=${vIdx} (${msg.venues?.[vIdx] ?? vIdx}) price=${p} qty=${q} side=${s}`);
    }
    setTimeout(() => { ws.close(); process.exit(0); }, 3000);
  }
};
