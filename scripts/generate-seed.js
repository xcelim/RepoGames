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

const { CATALOG_GAMES, OFFICIAL_LISTS, OFFICIAL_ITEMS } = load(path.join(root, 'src/data/catalog'));

const q = (v) =>
  v === null || v === undefined
    ? 'null'
    : typeof v === 'number' || typeof v === 'boolean'
      ? String(v)
      : `'${String(v).replace(/'/g, "''")}'`;

const lines = ['-- Generado por scripts/generate-seed.js. No lo edites a mano.', 'begin;', ''];

lines.push('insert into public.games (id, title, year, platforms, version, series, main, extra, "full", synopsis, note, igdb_query, source) values');
lines.push(
  Object.values(CATALOG_GAMES)
    .map(
      (g) =>
        `  (${[g.id, g.title, g.year, g.platforms, g.version, g.series, g.main, g.extra, g.full, g.synopsis, g.note, g.igdbQuery, 'catalog'].map(q).join(', ')})`,
    )
    .join(',\n') +
    '\non conflict (id) do update set title = excluded.title, year = excluded.year, platforms = excluded.platforms, version = excluded.version, main = excluded.main, extra = excluded.extra, "full" = excluded."full", synopsis = excluded.synopsis, note = excluded.note;',
);
lines.push('');

lines.push('insert into public.lists (id, owner_id, name, description, visibility, color, color2, icon, official) values');
lines.push(
  OFFICIAL_LISTS.map(
    (l) => `  (${[l.id, null, l.name, l.description, 'public', l.color, l.color2, l.icon, true].map(q).join(', ')})`,
  ).join(',\n') +
    '\non conflict (id) do update set name = excluded.name, description = excluded.description, color = excluded.color, color2 = excluded.color2, icon = excluded.icon;',
);
lines.push('');

lines.push("delete from public.list_items where list_id like 'official-%';");
lines.push('insert into public.list_items (id, list_id, game_id, position) values');
lines.push(OFFICIAL_ITEMS.map((i) => `  (${[i.id, i.listId, i.gameId, i.position].map(q).join(', ')})`).join(',\n') + ';');
lines.push('', 'commit;', '');

fs.writeFileSync(path.join(root, 'supabase/seed.sql'), lines.join('\n'));
console.log(`seed.sql: ${Object.keys(CATALOG_GAMES).length} juegos, ${OFFICIAL_LISTS.length} listas`);
