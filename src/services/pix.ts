import type { PixKeyType, Purchase, Vendor } from '../types';

export type { PixKeyType } from '../types';
export type PixKeyValidation =
  | { valid: true; type: PixKeyType; normalized: string }
  | { valid: false; error: string };

const onlyDigits = (value: string) => value.replace(/\D/g, '');
export const pixKeyTypeOptions: Array<{ value: PixKeyType; label: string }> = [
  { value: 'cpf', label: 'CPF' }, { value: 'cnpj', label: 'CNPJ' }, { value: 'phone', label: 'Telefone' },
  { value: 'email', label: 'E-mail' }, { value: 'random', label: 'Chave aleatória' },
];

function hasValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const digit = (length: number) => { let sum = 0; for (let index = 0; index < length; index += 1) sum += Number(value[index]) * (length + 1 - index); const remainder = (sum * 10) % 11; return remainder === 10 ? 0 : remainder; };
  return digit(9) === Number(value[9]) && digit(10) === Number(value[10]);
}
function hasValidCnpj(value: string): boolean {
  if (!/^\d{14}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const digit = (length: 12 | 13) => { const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const sum = weights.reduce((total, weight, index) => total + Number(value[index]) * weight, 0); const remainder = sum % 11; return remainder < 2 ? 0 : 11 - remainder; };
  return digit(12) === Number(value[12]) && digit(13) === Number(value[13]);
}

/** Only unambiguous legacy formats are inferred. Eleven digits remain undefined. */
export function inferPixKeyType(rawValue: string): PixKeyType | null {
  const value = rawValue.trim();
  if (!value) return null;
  if (value.includes('@')) return 'email';
  if (value.startsWith('+')) return 'phone';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return 'random';
  if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(value)) return 'cpf';
  if (/^[0-9.\/-]+$/.test(value) && onlyDigits(value).length === 14) return 'cnpj';
  return null;
}

export function validatePixKey(rawValue: string, selectedType?: PixKeyType | null): PixKeyValidation {
  const value = rawValue.trim();
  if (!value) return { valid: false, error: 'Informe uma chave Pix.' };
  const type = selectedType ?? inferPixKeyType(value);
  if (!type) return { valid: false, error: 'Selecione o tipo da chave Pix para validar este formato.' };
  if (type === 'email') {
    const normalized = value.toLowerCase();
    return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(normalized) && normalized.length <= 77
      ? { valid: true, type, normalized } : { valid: false, error: 'E-mail inválido. Confira o endereço usado como chave Pix.' };
  }
  if (type === 'cpf') { const digits = onlyDigits(value); return digits.length === 11 && hasValidCpf(digits) ? { valid: true, type, normalized: digits } : { valid: false, error: 'CPF inválido. Informe 11 dígitos verificadores válidos.' }; }
  if (type === 'cnpj') { const digits = onlyDigits(value); return digits.length === 14 && hasValidCnpj(digits) ? { valid: true, type, normalized: digits } : { valid: false, error: 'CNPJ inválido. Informe 14 dígitos verificadores válidos.' }; }
  if (type === 'phone') {
    let digits = onlyDigits(value);
    if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
    if (digits.startsWith('0055')) digits = digits.slice(2);
    const normalized = `+${digits}`;
    return /^\+[1-9]\d{7,14}$/.test(normalized) ? { valid: true, type, normalized } : { valid: false, error: 'Telefone inválido. Use DDD e número, ou o formato +5511999999999.' };
  }
  const normalized = value.toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)
    ? { valid: true, type, normalized } : { valid: false, error: 'Chave aleatória inválida. Informe uma chave EVP no formato UUID.' };
}

export function maskPixKey(rawValue: string, selectedType?: PixKeyType | null): string {
  const result = validatePixKey(rawValue, selectedType);
  if (!result.valid) return 'chave inválida';
  const { normalized, type } = result;
  if (type === 'email') { const [local = '', domain = ''] = normalized.split('@'); return `${local.slice(0, Math.min(2, local.length))}••••@${domain}`; }
  if (type === 'phone') return `${normalized.slice(0, 3)}•••••••${normalized.slice(-4)}`;
  if (type === 'cpf') return `•••.${normalized.slice(3, 6)}.•••-${normalized.slice(-2)}`;
  if (type === 'cnpj') return `••.${normalized.slice(2, 5)}.•••/•••-${normalized.slice(-2)}`;
  return `${normalized.slice(0, 4)}••••••••${normalized.slice(-4)}`;
}

export function normalizePixText(value: string, maxLength: number): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 $%*+\-./:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength); }
const emvField = (id: string, value: string): string => { if (value.length > 99) throw new Error(`Campo Pix ${id} excede o tamanho permitido.`); return `${id}${String(value.length).padStart(2, '0')}${value}`; };
export function crc16Pix(value: string): string { let crc = 0xffff; for (let index = 0; index < value.length; index += 1) { crc ^= value.charCodeAt(index) << 8; for (let bit = 0; bit < 8; bit += 1) crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff; } return crc.toString(16).toUpperCase().padStart(4, '0'); }

export function generatePixPayload(input: { pixKey: string; pixKeyType?: PixKeyType | null; amountCents: number; beneficiaryName: string; city: string }): string {
  const key = validatePixKey(input.pixKey, input.pixKeyType);
  if (!key.valid) throw new Error(key.error);
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new Error('O valor total do Pix deve ser maior que zero.');
  const beneficiaryName = normalizePixText(input.beneficiaryName, 25), city = normalizePixText(input.city, 15);
  const amount = `${Math.floor(input.amountCents / 100)}.${String(input.amountCents % 100).padStart(2, '0')}`;
  if (!beneficiaryName) throw new Error('O nome do beneficiário não pode ficar vazio.'); if (!city) throw new Error('Configure a cidade para geração do Pix.');
  const merchantAccount = emvField('00', 'br.gov.bcb.pix') + emvField('01', key.normalized), additionalData = emvField('05', '***');
  const withoutCrc = emvField('00', '01') + emvField('26', merchantAccount) + emvField('52', '0000') + emvField('53', '986') + emvField('54', amount) + emvField('58', 'BR') + emvField('59', beneficiaryName) + emvField('60', city) + emvField('62', additionalData) + '6304';
  return withoutCrc + crc16Pix(withoutCrc);
}

export type PixSelectionSummary = { vendorId: string; count: number; from: string; to: string; totalCents: number };
export type PixSelectionResult = { valid: true; summary: PixSelectionSummary } | { valid: false; error: string };
export function consolidatePixPurchases(purchases: Purchase[]): PixSelectionResult { if (!purchases.length) return { valid: false, error: 'Selecione pelo menos uma compra para gerar o Pix.' }; const vendorId = purchases[0]!.vendorId; if (purchases.some((purchase) => purchase.vendorId !== vendorId)) return { valid: false, error: 'Selecione compras de apenas um vendedor por Pix.' }; const totalCents = purchases.reduce((total, purchase) => total + purchase.amountCents, 0); if (!Number.isSafeInteger(totalCents) || totalCents <= 0) return { valid: false, error: 'O valor total do Pix deve ser maior que zero.' }; const dates = purchases.map((purchase) => purchase.purchaseDate).sort(); return { valid: true, summary: { vendorId, count: purchases.length, from: dates[0]!, to: dates[dates.length - 1]!, totalCents } }; }
export function validatePixGeneration(purchases: Purchase[], vendor: Vendor | undefined, city: string): PixSelectionResult { const selection = consolidatePixPurchases(purchases); if (!selection.valid) return selection; if (!vendor || vendor.id !== selection.summary.vendorId) return { valid: false, error: 'Não foi possível localizar o vendedor selecionado.' }; if (!vendor.pixKey) return { valid: false, error: 'Este vendedor não possui uma chave Pix cadastrada.' }; const key = validatePixKey(vendor.pixKey, vendor.pixKeyType); if (!key.valid) return { valid: false, error: key.error }; if (!normalizePixText(city, 15)) return { valid: false, error: 'Configure uma cidade válida para geração do Pix.' }; return selection; }
