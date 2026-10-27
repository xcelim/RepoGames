// Prepara la web para instalarse como app (iPhone: Compartir → Añadir a pantalla de inicio;
// Android y PC: «Instalar app»). Se ejecuta después de `expo export -p web`.
//   node scripts/web-pwa.js dist /RepoGames/app
const fs = require('fs');
const path = require('path');

const out = process.argv[2] || 'dist';
const base = (process.argv[3] || '/RepoGames/app').replace(/\/+$/, '');
const icons = path.join(__dirname, '..', 'assets', 'web');

for (const f of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png'])
  fs.copyFileSync(path.join(icons, f), path.join(out, f));

const manifest = {
  name: 'Saga Quest',
  short_name: 'Saga Quest',
  description: 'Tu registro de partidas: biblioteca, listas, amigos y mucho más.',
  lang: 'es',
  start_url: `${base}/`,
  scope: `${base}/`,
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#0b0b10',
  theme_color: '#0b0b10',
  icons: [
    { src: `${base}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `${base}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: `${base}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));

const head = `
    <link rel="manifest" href="${base}/manifest.webmanifest">
    <link rel="apple-touch-icon" href="${base}/apple-touch-icon.png">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Saga Quest">
    <meta name="format-detection" content="telephone=no">
`;
const file = path.join(out, 'index.html');
let html = fs.readFileSync(file, 'utf8');
html = html
  .replace('<html lang="en">', '<html lang="es">')
  .replace(
    /<meta name="viewport"[^>]*>/,
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />',
  );
if (!html.includes('rel="manifest"')) html = html.replace('</head>', `${head}</head>`);
fs.writeFileSync(file, html);
console.log('Web lista para instalarse como app');
