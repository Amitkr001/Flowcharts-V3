import fs from 'fs';

const path = 'web/src/lib/types.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  'est?: boolean;\n}',
  'est?: boolean;\n  hasPrimary?: boolean;\n}'
);

fs.writeFileSync(path, code, 'utf8');
console.log('Added hasPrimary to web/src/lib/types.ts');
