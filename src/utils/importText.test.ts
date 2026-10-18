import { parseImportText } from './importText';

test('lee título, año, estado y nota en cualquier orden', () => {
  const r = parseImportText(`1. Hades | pasado | 9
- Sekiro: Shadows Die Twice | 2019 | Terminado
Pokémon Platinum (2008) | jugando
# comentario

Tunic;7/10;beat
Jump King | en pausa`);
  expect(r).toEqual([
    { title: 'Hades', year: null, status: 'beaten', rating: 9 },
    { title: 'Sekiro: Shadows Die Twice', year: 2019, status: 'beaten', rating: null },
    { title: 'Pokémon Platinum', year: 2008, status: 'playing', rating: null },
    { title: 'Tunic', year: null, status: 'beaten', rating: 7 },
    { title: 'Jump King', year: null, status: 'paused', rating: null },
  ]);
});

test('títulos con números no se confunden', () => {
  expect(parseImportText('Pikmin 1 + 2\nBlasphemous 2 | 2023')).toEqual([
    { title: 'Pikmin 1 + 2', year: null, status: null, rating: null },
    { title: 'Blasphemous 2', year: 2023, status: null, rating: null },
  ]);
});
