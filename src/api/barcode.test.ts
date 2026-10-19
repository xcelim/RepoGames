import { cleanProductTitle } from './barcode';

test('limpia el nombre del producto', () => {
  expect(cleanProductTitle('Super Mario Odyssey (Nintendo Switch)')).toBe('Super Mario Odyssey');
  expect(cleanProductTitle('Hades - Nintendo Switch - Standard Edition')).toBe('Hades');
  expect(cleanProductTitle('Sekiro: Shadows Die Twice PS4')).toBe('Sekiro: Shadows Die Twice');
  expect(cleanProductTitle('Pokémon Brilliant Diamond [Nintendo Switch]')).toBe('Pokémon Brilliant Diamond');
});
