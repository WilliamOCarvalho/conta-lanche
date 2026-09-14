export function parseBRLToCents(input: string): number | null {
  const normalized = input.trim().replace(/R\$\s?/i, '').replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;
  const [reais = '0', cents = ''] = normalized.split('.');
  const value = Number(reais) * 100 + Number(cents.padEnd(2, '0'));
  return Number.isSafeInteger(value) ? value : null;
}

export function formatBRL(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const reais = Math.floor(absolute / 100).toLocaleString('pt-BR');
  return `${sign}R$ ${reais},${String(absolute % 100).padStart(2, '0')}`;
}

export function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const cents = Number(digits);
  if (!Number.isSafeInteger(cents)) return '';
  const reais = Math.floor(cents / 100).toLocaleString('pt-BR');
  return `${reais},${String(cents % 100).padStart(2, '0')}`;
}
