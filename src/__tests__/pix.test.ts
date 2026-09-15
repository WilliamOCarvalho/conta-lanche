import type { Purchase, Vendor } from '../types';
import { consolidatePixPurchases, crc16Pix, generatePixPayload, normalizePixText, validatePixGeneration, validatePixKey } from '../services/pix';

const purchase = (id: string, vendorId: string, amountCents: number, purchaseDate: string): Purchase => ({
  id, vendorId, vendorName: 'Maria', description: null, observation: null, purchaseDate, amountCents,
  photoPath: `${id}.jpg`, paymentStatus: 'pending', paymentDate: null, createdAt: purchaseDate, updatedAt: purchaseDate,
});

const vendor = (overrides: Partial<Vendor> = {}): Vendor => ({
  id: 'vendor-1', name: 'Maria', pixKey: 'maria@example.com', pixBeneficiaryName: null,
  contact: null, observation: null, active: true, createdAt: '2026-09-01', updatedAt: '2026-09-01', ...overrides,
});

describe('Pix', () => {
  test.each([
    ['529.982.247-25', 'cpf', '52998224725'],
    ['04.252.011/0001-10', 'cnpj', '04252011000110'],
    ['+55 (11) 99999-9999', 'phone', '+5511999999999'],
    ['MARIA@EXAMPLE.COM', 'email', 'maria@example.com'],
    ['123e4567-e12b-12d1-a456-426655440000', 'random', '123e4567-e12b-12d1-a456-426655440000'],
  ])('identifica e normaliza a chave %s', (key, type, normalized) => {
    expect(validatePixKey(key)).toEqual({ valid: true, type, normalized });
  });

  test.each(['111.111.111-11', '04.252.011/0001-00', 'sem-arroba', '+123'])('rejeita a chave inválida %s', (key) => {
    expect(validatePixKey(key).valid).toBe(false);
  });

  test('soma em centavos e consolida período de um vendedor', () => {
    const result = consolidatePixPurchases([
      purchase('a', 'vendor-1', 850, '2026-09-30'),
      purchase('b', 'vendor-1', 1250, '2026-09-01'),
    ]);
    expect(result).toEqual({ valid: true, summary: { vendorId: 'vendor-1', count: 2, from: '2026-09-01', to: '2026-09-30', totalCents: 2100 } });
  });

  test('impede consolidação de vendedores diferentes', () => {
    const result = consolidatePixPurchases([purchase('a', 'vendor-1', 850, '2026-09-01'), purchase('b', 'vendor-2', 900, '2026-09-02')]);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/apenas um vendedor/);
  });

  test('calcula o CRC16 do exemplo oficial do Banco Central', () => {
    const payloadWithoutCrc = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
    expect(crc16Pix(payloadWithoutCrc)).toBe('1D3D');
  });

  test('gera payload estático com chave, valor e CRC válido', () => {
    const payload = generatePixPayload({ pixKey: 'maria@example.com', amountCents: 4750, beneficiaryName: 'María da Silva', city: 'São Paulo' });
    expect(payload).toContain('0014br.gov.bcb.pix');
    expect(payload).toContain('0117maria@example.com');
    expect(payload).toContain('540547.50');
    expect(payload).toContain('5914MARIA DA SILVA');
    expect(payload).toContain('6009SAO PAULO');
    expect(payload).toContain('62070503***');
    expect(payload.slice(-4)).toBe(crc16Pix(payload.slice(0, -4)));
    expect(normalizePixText('São Paulo', 15)).toBe('SAO PAULO');
  });

  test('valida todas as condições antes da geração', () => {
    const selected = [purchase('a', 'vendor-1', 1000, '2026-09-01')];
    expect(validatePixGeneration([], vendor(), 'São Paulo').valid).toBe(false);
    expect(validatePixGeneration(selected, vendor({ pixKey: null }), 'São Paulo').valid).toBe(false);
    expect(validatePixGeneration(selected, vendor(), '').valid).toBe(false);
    expect(validatePixGeneration(selected, vendor(), 'São Paulo').valid).toBe(true);
    expect(consolidatePixPurchases([purchase('zero', 'vendor-1', 0, '2026-09-01')]).valid).toBe(false);
  });
});
