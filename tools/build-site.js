// Prépare le site publié sur GitHub Pages : les fichiers du jeu dans _site/, et la version jouée
// (hash court et date du commit) inscrite dans index.html, que le pied de page affiche.
// Usage : node tools/build-site.js
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const out = path.join(root, '_site');
const FICHIERS = ['index.html', 'style.css', 'data.js', 'engine.js', 'audio.js', 'main.js'];
const MARQUE = '<meta name="version" content="dev">';

function version() {
  try {
    const git = (cmd) => execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return `${git('git rev-parse --short=7 HEAD')} · ${git('git log -1 --format=%cs')}`;
  } catch (e) {
    return `inconnue · ${new Date().toISOString().slice(0, 10)}`;
  }
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const f of FICHIERS) fs.copyFileSync(path.join(root, f), path.join(out, f));

const v = version();
const page = path.join(out, 'index.html');
const html = fs.readFileSync(page, 'utf8');
if (!html.includes(MARQUE)) throw new Error(`index.html : balise de version introuvable (${MARQUE})`);
fs.writeFileSync(page, html.replace(MARQUE, `<meta name="version" content="${v}">`));
console.log(`_site/ prêt : ${FICHIERS.length} fichiers, version ${v}`);
