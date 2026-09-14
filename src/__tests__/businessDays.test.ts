import { brazilianNationalHolidays, dateKey, fifthBusinessDay, nextPaymentDate } from '../services/businessDays';
import { parseBRDate } from '../services/dates';

describe('quinto dia útil', () => {
  it('pula fins de semana e feriados cadastrados', () => {
    expect(dateKey(fifthBusinessDay(2026, 8, new Set(['2026-09-07'])))).toBe('2026-09-08');
    expect(dateKey(fifthBusinessDay(2026, 0, new Set(['2026-01-01'])))).toBe('2026-01-08');
  });

  it('gera feriados nacionais, incluindo a Paixão de Cristo móvel', () => {
    const dates = brazilianNationalHolidays(2026);
    expect(dates.some((holiday) => holiday.date === '2026-04-03')).toBe(true);
    expect(dates.some((holiday) => holiday.date === '2026-11-20')).toBe(true);
  });

  it('mantém o pagamento do mês no próprio quinto dia e avança depois dele', () => {
    const holidays = new Set(['2026-09-07']);
    expect(dateKey(nextPaymentDate(new Date(2026, 8, 8, 18), holidays))).toBe('2026-09-08');
    expect(dateKey(nextPaymentDate(new Date(2026, 8, 9, 8), holidays))).toBe('2026-10-07');
  });

  it('valida e converte datas digitadas no padrão brasileiro', () => {
    expect(parseBRDate('14/09/2026')).toBe('2026-09-14');
    expect(parseBRDate('31/02/2026')).toBeNull();
  });
});
