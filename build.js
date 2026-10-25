// Copies the static site into dist/ for deployment. No dependencies.
const fs = require('fs');
const path = require('path');

const root = __dirname;
const dist = path.join(root, 'dist');
const files = ['index.html', 'style.css', 'script.js'];
const optional = ['Yahia-Delly-CV.pdf', 'favicon.ico', 'photo.jpg'];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);

for (const f of files) {
  fs.copyFileSync(path.join(root, f), path.join(dist, f));
  console.log(`copied ${f}`);
}
for (const f of optional) {
  if (fs.existsSync(path.join(root, f))) {
    fs.copyFileSync(path.join(root, f), path.join(dist, f));
    console.log(`copied ${f}`);
  }
}
console.log('build complete: dist/');
