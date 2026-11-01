import fs from 'fs';

const txt = fs.readFileSync('scratch/user_request_2838.txt', 'utf8');

function extractBetween(startStr, endStr) {
  const i1 = txt.indexOf(startStr);
  const i2 = endStr ? txt.indexOf(endStr, i1) : txt.length;
  return txt.slice(i1, i2);
}

fs.writeFileSync('scratch/file4_drawings.txt', extractBetween('File 4: web/src/chart/drawings.ts', 'File 5: web/src/data/bookwatch.ts'), 'utf8');
fs.writeFileSync('scratch/file5_bookwatch.txt', extractBetween('File 5: web/src/data/bookwatch.ts', 'File 6: web/src/pages/ChartPage.tsx'), 'utf8');
fs.writeFileSync('scratch/file6_useSeries.txt', extractBetween('File 6: web/src/pages/ChartPage.tsx', '3. How to Apply'), 'utf8');
console.log('Saved file4, file5, file6 extracts.');
