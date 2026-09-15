import type { Purchase, Vendor } from '../types';

export type PixKeyType = 'cpf' | 'cnpj' | 'phone' | 'email' | 'random';
export type PixKeyValidation =
  | { valid: true; type: PixKeyType; normalized: string }
  | { valid: false; error: string };

const onlyDigits = (value: string) => value.replace(/\D/g, '');

function hasValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(value[index]) * (length + 1 - index);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(value[9]) && digit(10) === Number(value[10]);
}

function hasValidCnpj(value: string): boolean {
  if (!/^\d{14}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const digit = (length: 12 | 13) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(value[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return digit(12) === Number(value[12]) && digit(13) === Number(value[13]);
}

export function validatePixKey(rawValue: string): PixKeyValidation {
  const value = rawValue.trim();
  if (!value) return { valid: false, error: 'Informe uma chave Pix.' };

  if (value.includes('@')) {
    const normalized = value.toLowerCase();
    if (/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(normalized) && normalized.length <= 77) return { valid: true, type: 'email', normalized };
    return { valid: false, error: 'E-mail inválido. Confira o endereço usado como chave Pix.' };
  }

  if (/^[0-9.\/-]+$/.test(value)) {
    const digits = onlyDigits(value);
    if (digits.length === 11) return hasValidCpf(digits)
      ? { valid: true, type: 'cpf', normalized: digits }
      : { valid: false, error: 'CPF inválido. Confira os 11 dígitos da chave Pix.' };
    if (digits.length === 14) return hasValidCnpj(digits)
      ? { valid: true, type: 'cnpj', normalized: digits }
      : { valid: false, error: 'CNPJ inválido. Confira os 14 dígitos da chave Pix.' };
  }

  if (value.startsWith('+')) {
    const normalized = `+${onlyDigits(value)}`;
    if (/^\+[1-9]\d{7,14}$/.test(normalized)) return { valid: true, type: 'phone', normalized };
    return { valid: false, error: 'Telefone inválido. Use o formato internacional, por exemplo +5511999999999.' };
  }

  const normalizedUuid = value.toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalizedUuid)) {
    return { valid: true, type: 'random', normalized: normalizedUuid };
  }

  return { valid: false, error: 'Chave Pix inválida. Informe um CPF, CNPJ, telefone com código do país, e-mail ou chave aleatória.' };
}

export function maskPixKey(rawValue: string): string {
  const result = validatePixKey(rawValue);
  if (!result.valid) return 'chave inválida';
  const { normalized, type } = result;
  if (type === 'email') {
    const [local = '', domain = ''] = normalized.split('@');
    return `${local.slice(0, Math.min(2, local.length))}••••@${domain}`;
  }
  if (type === 'phone') return `${normalized.slice(0, 3)}••••••${normalized.slice(-4)}`;
  if (type === 'cpf') return `•••.${normalized.slice(3, 6)}.•••-${normalized.slice(-2)}`;
  if (type === 'cnpj') return `••.${normalized.slice(2, 5)}.•••/••••-${normalized.slice(-2)}`;
  return `${normalized.slice(0, 4)}••••••••${normalized.slice(-4)}`;
}

export function normalizePixText(value: string, maxLength: number): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 $%*+\-./:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

const emvField = (id: string, value: string): string => {
  if (value.length > 99) throw new Error(`Campo Pix ${id} excede o tamanho permitido.`);
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
};

export function crc16Pix(value: string): string {
  let crc = 0xffff;
  for (let index = 0; index < value.length; index += 1) {
    crc ^= value.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generatePixPayload(input: { pixKey: string; amountCents: number; beneficiaryName: string; city: string }): string {
  const key = validatePixKey(input.pixKey);
  if (!key.valid) throw new Error(key.error);
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new Error('O valor total do Pix deve ser maior que zero.');
  const beneficiaryName = normalizePixText(input.beneficiaryName, 25);
  const city = normalizePixText(input.city, 15);
  const amount = `${Math.floor(input.amountCents / 100)}.${String(input.amountCents % 100).padStart(2, '0')}`;
  if (!beneficiaryName) throw new Error('O nome do beneficiário não pode ficar vazio.');
  if (!city) throw new Error('Configure a cidade para geração do Pix.');

  const merchantAccount = emvField('00', 'br.gov.bcb.pix') + emvField('01', key.normalized);
  const additionalData = emvField('05', '***');
  const withoutCrc = emvField('00', '01')
    + emvField('26', merchantAccount)
    + emvField('52', '0000')
    + emvField('53', '986')
    + emvField('54', amount)
    + emvField('58', 'BR')
    + emvField('59', beneficiaryName)
    + emvField('60', city)
    + emvField('62', additionalData)
    + '6304';
  return withoutCrc + crc16Pix(withoutCrc);
}

export type PixSelectionSummary = {
  vendorId: string;
  count: number;
  from: string;
  to: string;
  totalCents: number;
};

export type PixSelectionResult =
  | { valid: true; summary: PixSelectionSummary }
  | { valid: false; error: string };

export function consolidatePixPurchases(purchases: Purchase[]): PixSelectionResult {
  if (!purchases.length) return { valid: false, error: 'Selecione pelo menos uma compra para gerar o Pix.' };
  const vendorId = purchases[0]!.vendorId;
  if (purchases.some((purchase) => purchase.vendorId !== vendorId)) return { valid: false, error: 'Selecione compras de apenas um vendedor por Pix.' };
  const totalCents = purchases.reduce((total, purchase) => total + purchase.amountCents, 0);
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) return { valid: false, error: 'O valor total do Pix deve ser maior que zero.' };
  const dates = purchases.map((purchase) => purchase.purchaseDate).sort();
  return { valid: true, summary: { vendorId, count: purchases.length, from: dates[0]!, to: dates[dates.length - 1]!, totalCents } };
}

export function validatePixGeneration(purchases: Purchase[], vendor: Vendor | undefined, city: string): PixSelectionResult {
  const selection = consolidatePixPurchases(purchases);
  if (!selection.valid) return selection;
  if (!vendor || vendor.id !== selection.summary.vendorId) return { valid: false, error: 'Não foi possível localizar o vendedor selecionado.' };
  if (!vendor.pixKey) return { valid: false, error: 'Este vendedor não possui uma chave Pix cadastrada.' };
  const key = validatePixKey(vendor.pixKey);
  if (!key.valid) return { valid: false, error: key.error };
  if (!normalizePixText(city, 15)) return { valid: false, error: 'Configure uma cidade válida para geração do Pix.' };
  return selection;
}
