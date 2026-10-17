/* global __dirname */
// Genera supabase/seed.sql con el catálogo y las bibliotecas oficiales.
// Uso: node scripts/generate-seed.js
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const cache = {};

// Carga un archivo .ts del proyecto (resolviendo el atajo @/) sin herramientas extra.
function load(file) {
  const full = file.endsWith('.ts') ? file : `${file}.ts`;
  if (cache[full]) return cache[full].exports;
  const source = fs.readFileSync(full, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const module = { exports: {} };
  cache[full] = module;
  const localRequire = (request) => {
    if (request.startsWith('@/')) return load(path.join(root, 'src', request.slice(2)));
    if (request.startsWith('.')) return load(path.join(path.dirname(full), request));
    return require(request);
  };
  new Function('require', 'module', 'exports', outputText)(localRequire, module, module.exports);
  return module.exports;
}

const { OFFICIAL_LISTS } = load(path.join(root, 'src/data/catalog'));

const q = (v) =>
  v === null || v === undefined
    ? 'null'
    : typeof v === 'number' || typeof v === 'boolean'
      ? String(v)
      : `'${String(v).replace(/'/g, "''")}'`;

// Solo las bibliotecas oficiales: sus juegos los descarga la app de la base de datos (IGDB / RAWG).
const lines = ['-- Generado por scripts/generate-seed.js. No lo edites a mano.', 'begin;', ''];
lines.push('insert into public.lists (id, owner_id, name, description, visibility, color, color2, icon, official) values');
lines.push(
  OFFICIAL_LISTS.map(
    (l) => `  (${[l.id, null, l.name, l.description, 'public', l.color, l.color2, l.icon, true].map(q).join(', ')})`,
  ).join(',\n') +
    '\non conflict (id) do update set name = excluded.name, description = excluded.description, color = excluded.color, color2 = excluded.color2, icon = excluded.icon;',
);
lines.push('', 'commit;', '');

fs.writeFileSync(path.join(root, 'supabase/seed.sql'), lines.join('\n'));
console.log(`seed.sql: ${OFFICIAL_LISTS.length} listas oficiales`);
