import { strToU8, zipSync } from 'fflate';

import { detectPreset, guessMapping, parseCsv, parseXlsx, readEntries, toTable } from './tableImport';

describe('importar tablas', () => {
  it('lee un CSV con comillas y punto y coma', () => {
    const rows = parseCsv('Título;Estado;Nota\n"Hades; edición";Terminado;9\nTunic;Pendiente;\n');
    expect(rows).toEqual([
      ['Título', 'Estado', 'Nota'],
      ['Hades; edición', 'Terminado', '9'],
      ['Tunic', 'Pendiente', ''],
    ]);
  });

  it('entiende un export tipo Playnite', () => {
    const t = toTable(
      parseCsv(
        'Name,Platforms,CompletionStatus,UserScore,Playtime\nCeleste,PC,Beaten,95,36000\nHalo,Xbox,Not Played,,0',
      ),
    );
    expect(detectPreset(t)).toBe('playnite');
    const e = readEntries(t, guessMapping(t), 'playnite');
    expect(e[0]).toMatchObject({ title: 'Celeste', status: 'beaten', rating: 10, platform: 'PC', hours: 10 });
    expect(e[1]).toMatchObject({ title: 'Halo', status: 'backlog', rating: null, hours: null });
  });

  it('notas en estrellas y columnas sí/no', () => {
    const t = toTable(parseCsv('Title,Rating,Playing,Backlog,Completed\nOkami,4.5,,,2024-03-01\nZelda,,X,,'));
    const e = readEntries(t, guessMapping(t), detectPreset(t));
    expect(e[0]).toMatchObject({ status: 'beaten', rating: 9, finishedAt: '2024-03-01' });
    expect(e[1]).toMatchObject({ status: 'playing' });
  });

  it('lee un Excel', () => {
    const sheet = `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Hollow Knight &amp; co</t></is></c><c r="B2"><v>8</v></c></row></sheetData></worksheet>`;
    const shared = `<sst><si><t>Juego</t></si><si><t>Nota</t></si></sst>`;
    const zip = zipSync({ 'xl/worksheets/sheet1.xml': strToU8(sheet), 'xl/sharedStrings.xml': strToU8(shared) });
    const t = toTable(parseXlsx(zip));
    expect(t.headers).toEqual(['Juego', 'Nota']);
    expect(readEntries(t, guessMapping(t), 'generic')[0]).toMatchObject({ title: 'Hollow Knight & co', rating: 8 });
  });
});
