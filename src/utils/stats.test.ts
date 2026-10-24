import { finishEta } from './stats';

describe('finishEta', () => {
  it('calcula la fecha a tu ritmo', () => {
    const r = finishEta(
      { status: 'playing', startedAt: '2026-10-01', hoursPlayed: 10 },
      30,
      new Date('2026-10-11T12:00:00'),
    );
    // 1 h/día → quedan 20 h → 20 días
    expect(r?.date).toBe('2026-10-31');
    expect(r?.assumed).toBe(false);
  });
  it('sin horas, a una hora al día', () => {
    const r = finishEta({ status: 'playing', startedAt: null, hoursPlayed: null }, 5, new Date('2026-10-11T12:00:00'));
    expect(r?.date).toBe('2026-10-16');
    expect(r?.assumed).toBe(true);
  });
});
