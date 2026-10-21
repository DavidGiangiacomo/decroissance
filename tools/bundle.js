// Assemble une version en un seul fichier (dist/decroissance.html) pour partage.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let html = read('index.html');
html = html.replace('<link rel="stylesheet" href="style.css">', `<style>\n${read('style.css')}\n</style>`);
for (const f of ['data.js', 'engine.js', 'audio.js', 'main.js']) html = html.replace(`<script src="${f}"></script>`, `<script>\n${read(f)}\n</script>`);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/decroissance.html'), html);
console.log('dist/decroissance.html', html.length, 'octets');
