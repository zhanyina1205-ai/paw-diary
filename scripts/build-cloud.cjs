const fs = require('node:fs');
for (const name of ['types', 'domain', 'commands', 'seed']) {
  fs.copyFileSync(`.build/lib/${name}.js`, `cloudfunctions/paw-family/lib/${name}.js`);
}
console.log('Shared calculation and validation modules built for the cloud function.');
