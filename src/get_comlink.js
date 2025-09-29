const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../../comlink/comlink');
const destDir = path.resolve(__dirname, '../comlink');

function comlink_source_sync(src, dest) {
  const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        for (const entry of fs.readdirSync(src)) {
            if (entry === '__pycache__') { continue; }
            const srcPath = path.join(src, entry);
            const destPath = path.join(dest, entry);
            comlink_source_sync(srcPath, destPath);
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

comlink_source_sync(srcDir, destDir);
console.log('comlink directory copied to dist/comlink');
