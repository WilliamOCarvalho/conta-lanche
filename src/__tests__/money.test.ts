import { formatBRL, formatCurrencyInput, parseBRLToCents } from '../services/money';

describe('valores em reais', () => {
  it('converte a máscara brasileira em centavos inteiros', () => {
    expect(parseBRLToCents('R$ 1.234,56')).toBe(123456);
    expect(parseBRLToCents('8,5')).toBe(850);
    expect(parseBRLToCents('25')).toBe(2500);
  });

  it('rejeita formatos inválidos e valores fora do limite seguro', () => {
    expect(parseBRLToCents('8,999')).toBeNull();
    expect(parseBRLToCents('-3,00')).toBeNull();
    expect(parseBRLToCents('9007199254740992')).toBeNull();
  });

  it('formata e mascara sem incluir centavos fracionários no armazenamento', () => {
    expect(formatBRL(123456)).toBe('R$ 1.234,56');
    expect(formatCurrencyInput('123456')).toBe('1.234,56');
  });
});
