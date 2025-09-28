const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../../comlink/comlink.py');
const dest = path.resolve(__dirname, '../comlink.py');

fs.copyFileSync(src, dest);
console.log('comlink.py copied to dist/');
