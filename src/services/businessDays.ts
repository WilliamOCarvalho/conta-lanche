const pad = (n: number) => String(n).padStart(2, '0');
export const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Returns the fifth weekday that is not in the supplied ISO-date holiday set. */
export function fifthBusinessDay(year: number, monthIndex: number, holidays: ReadonlySet<string> = new Set()): Date {
  let count = 0;
  const date = new Date(year, monthIndex, 1, 12);
  while (true) {
    const key = dateKey(date);
    const weekday = date.getDay();
    if (weekday !== 0 && weekday !== 6 && !holidays.has(key)) {
      count += 1;
      if (count === 5) return new Date(date);
    }
    date.setDate(date.getDate() + 1);
  }
}

function easterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451), month = Math.floor((h + l - 7 * m + 114) / 31);
  return new Date(year, month - 1, ((h + l - 7 * m + 114) % 31) + 1, 12);
}

/** Brazilian national holidays; movable Good Friday is included. */
export function brazilianNationalHolidays(year: number): Array<{ date: string; description: string }> {
  const fixed: Array<[string, string]> = [
    ['01-01', 'Confraternização Universal'], ['04-21', 'Tiradentes'], ['05-01', 'Dia do Trabalho'],
    ['09-07', 'Independência do Brasil'], ['10-12', 'Nossa Senhora Aparecida'],
    ['11-02', 'Finados'], ['11-15', 'Proclamação da República'], ['11-20', 'Consciência Negra'], ['12-25', 'Natal'],
  ];
  const easter = easterSunday(year);
  const goodFriday = new Date(easter); goodFriday.setDate(easter.getDate() - 2);
  return [...fixed.map(([md, description]) => ({ date: `${year}-${md}`, description })),
    { date: dateKey(goodFriday), description: 'Paixão de Cristo' }];
}

export function nextPaymentDate(reference: Date, holidays: ReadonlySet<string>): Date {
  const thisMonth = fifthBusinessDay(reference.getFullYear(), reference.getMonth(), holidays);
  if (dateKey(reference) <= dateKey(thisMonth)) return thisMonth;
  return fifthBusinessDay(reference.getMonth() === 11 ? reference.getFullYear() + 1 : reference.getFullYear(), (reference.getMonth() + 1) % 12, holidays);
}
