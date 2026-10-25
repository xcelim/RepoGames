import { parseImportText } from './importText';

test('lee título, año, estado y nota en cualquier orden', () => {
  const r = parseImportText(`1. Hades | pasado | 9
- Sekiro: Shadows Die Twice | 2019 | Terminado
Pokémon Platinum (2008) | jugando
# comentario

Tunic;7/10;beat
Jump King | en pausa`);
  expect(r).toEqual([
    { title: 'Hades', year: null, status: 'beaten', rating: 9, platform: null },
    { title: 'Sekiro: Shadows Die Twice', year: 2019, status: 'beaten', rating: null, platform: null },
    { title: 'Pokémon Platinum', year: 2008, status: 'playing', rating: null, platform: null },
    { title: 'Tunic', year: null, status: 'beaten', rating: 7, platform: null },
    { title: 'Jump King', year: null, status: 'paused', rating: null, platform: null },
  ]);
});

test('títulos con números no se confunden', () => {
  expect(parseImportText('Pikmin 1 + 2\nBlasphemous 2 | 2023')).toEqual([
    { title: 'Pikmin 1 + 2', year: null, status: null, rating: null, platform: null },
    { title: 'Blasphemous 2', year: 2023, status: null, rating: null, platform: null },
  ]);
});

test('plataforma y visto', () => {
  expect(
    parseImportText(
      'Zelda: The Minish Cap | Game Boy Advance | pasado | 9\nZelda II | NES | visto | 6\nMario Kart DS | DS | jugado | 7',
    ),
  ).toEqual([
    { title: 'Zelda: The Minish Cap', year: null, status: 'beaten', rating: 9, platform: 'Game Boy Advance' },
    { title: 'Zelda II', year: null, status: 'watched', rating: 6, platform: 'NES' },
    { title: 'Mario Kart DS', year: null, status: 'library', rating: 7, platform: 'Nintendo DS' },
  ]);
});
