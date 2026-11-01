import fs from 'fs';

const txt = fs.readFileSync('scratch/user_request_2838.txt', 'utf8');

function showSection(name, nextName) {
  const i1 = txt.indexOf(name);
  const i2 = nextName ? txt.indexOf(nextName, i1) : txt.length;
  console.log(`=== ${name} ===`);
  console.log(txt.slice(i1, i2));
}

showSection("File 4: web/src/chart/drawings.ts", "File 5: web/src/data/bookwatch.ts");
showSection("File 5: web/src/data/bookwatch.ts", "File 6: web/src/pages/useSeries.ts");
showSection("File 6: web/src/pages/useSeries.ts", "3. How to Apply");
