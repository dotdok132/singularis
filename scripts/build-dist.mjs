import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

for (const file of ['index.html', 'styles.css']) {
  fs.copyFileSync(path.join(root, file), path.join(distDir, file));
}

fs.cpSync(path.join(root, 'js'), path.join(distDir, 'js'), { recursive: true });
console.log('[SINGULARIS] Offline dist bundle ready at ./dist');
