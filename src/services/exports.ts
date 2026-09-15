import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import JSZip from 'jszip';
import * as DocumentPicker from 'expo-document-picker';
import { readBackupData, replaceWithBackup, type BackupData } from '../db/repository';
import type { Purchase, Vendor } from '../types';
import { formatBRL } from './money';
import { formatDate } from './dates';
import { fileAsBase64, photoAsBase64, removePhoto, restorePhoto } from './photos';

const shareFile = async (uri: string, mimeType: string) => {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Compartilhamento não disponível neste dispositivo.');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: 'Compartilhar arquivo' });
};

export async function exportCSV(items: Purchase[]) {
  const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [['Data', 'Vendedor', 'Descrição', 'Valor', 'Situação', 'Data do pagamento'], ...items.map((p) => [formatDate(p.purchaseDate), p.vendorName ?? '', p.description ?? '', formatBRL(p.amountCents), p.paymentStatus === 'paid' ? 'Pago' : 'Pendente', p.paymentDate ? formatDate(p.paymentDate) : ''])];
  const csv = `\uFEFF${rows.map((row) => row.map((v) => quote(String(v))).join(';')).join('\r\n')}`;
  const uri = `${FileSystem.cacheDirectory}relatorio_lanches_${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await shareFile(uri, 'text/csv');
}

export async function exportPDF(items: Purchase[], title: string) {
  const total = items.reduce((sum, item) => sum + item.amountCents, 0);
  const paid = items.reduce((sum, item) => sum + (item.paymentStatus === 'paid' ? item.amountCents : 0), 0), pending = total - paid;
  const body = items.map((p) => `<tr><td>${formatDate(p.purchaseDate)}</td><td>${escapeHTML(p.vendorName ?? '')}</td><td>${escapeHTML(p.description ?? 'Lanche')}</td><td>${formatBRL(p.amountCents)}</td><td>${p.paymentStatus === 'paid' ? 'Pago' : 'Pendente'}</td></tr>`).join('');
  const html = `<html><meta charset="utf-8"><style>body{font-family:Arial;padding:28px;color:#18251f}h1{color:#246b4b}table{border-collapse:collapse;width:100%;margin-top:20px}th,td{text-align:left;padding:10px;border-bottom:1px solid #e8ece7}th{background:#e8f3ec}strong{font-size:18px}</style><h1>${escapeHTML(title)}</h1><p>${items.length} compras</p><strong>Total: ${formatBRL(total)}</strong><p>Pago: ${formatBRL(paid)} · Pendente: ${formatBRL(pending)}</p><table><thead><tr><th>Data</th><th>Vendedor</th><th>Descrição</th><th>Valor</th><th>Status</th></tr></thead><tbody>${body}</tbody></table></html>`;
  const result = await Print.printToFileAsync({ html });
  await shareFile(result.uri, 'application/pdf');
}
const escapeHTML = (text: string) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));

export async function exportBackup() {
  const backup = await readBackupData();
  const zip = new JSZip();
  for (const purchase of backup.purchases) {
    const base64 = await photoAsBase64(purchase.photoPath);
    zip.file(`photos/${purchase.id}.jpg`, base64, { base64: true });
  }
  zip.file('backup.json', JSON.stringify(backup));
  const archive = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE', compressionOptions: { level: 4 } });
  const uri = `${FileSystem.cacheDirectory}conta-lanche-backup-${Date.now()}.zip`;
  await FileSystem.writeAsStringAsync(uri, archive, { encoding: FileSystem.EncodingType.Base64 });
  await shareFile(uri, 'application/zip');
}

export async function restoreBackup(): Promise<{ purchaseCount: number } | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: ['application/zip', 'application/x-zip-compressed'], copyToCacheDirectory: true });
  if (picked.canceled || !picked.assets[0]) return null;
  const encoded = await fileAsBase64(picked.assets[0].uri);
  const zip = await JSZip.loadAsync(encoded, { base64: true, checkCRC32: true });
  const jsonFile = zip.file('backup.json');
  if (!jsonFile) throw new Error('O arquivo não contém os dados de backup.');
  const raw = JSON.parse(await jsonFile.async('string')) as Omit<BackupData, 'version' | 'vendors'> & {
    version: number; vendors: (Omit<Vendor, 'pixKey' | 'pixBeneficiaryName'> & { pixKey?: unknown; pixBeneficiaryName?: unknown })[];
  };
  const valid = (raw.version === 1 || raw.version === 2) && Array.isArray(raw.vendors) && Array.isArray(raw.purchases)
    && Array.isArray(raw.payments) && Array.isArray(raw.paymentLinks) && Array.isArray(raw.holidays) && Array.isArray(raw.settings)
    && raw.vendors.every((v) => typeof v.id === 'string' && typeof v.name === 'string' && typeof v.active === 'boolean'
      && (v.pixKey === undefined || v.pixKey === null || typeof v.pixKey === 'string')
      && (v.pixBeneficiaryName === undefined || v.pixBeneficiaryName === null || typeof v.pixBeneficiaryName === 'string'))
    && raw.purchases.every((p) => typeof p.id === 'string' && typeof p.vendorId === 'string' && Number.isSafeInteger(p.amountCents) && p.amountCents > 0 && (p.paymentStatus === 'paid' || p.paymentStatus === 'pending') && typeof p.photoPath === 'string')
    && raw.payments.every((p) => typeof p.id === 'string' && typeof p.vendorId === 'string' && Number.isSafeInteger(p.totalCents))
    && raw.paymentLinks.every((link) => typeof link.paymentId === 'string' && typeof link.purchaseId === 'string')
    && raw.holidays.every((h) => typeof h.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(h.date) && typeof h.description === 'string')
    && raw.settings.every((entry) => typeof entry.key === 'string' && typeof entry.value === 'string');
  if (!valid) throw new Error('Formato de backup inválido ou incompatível.');
  const data: BackupData = {
    ...raw, version: 2,
    vendors: raw.vendors.map((vendor) => ({ ...vendor, pixKey: typeof vendor.pixKey === 'string' ? vendor.pixKey : null, pixBeneficiaryName: typeof vendor.pixBeneficiaryName === 'string' ? vendor.pixBeneficiaryName : null })),
  };
  const vendorIds = new Set(data.vendors.map((v) => v.id)), paymentIds = new Set(data.payments.map((p) => p.id)), purchaseIds = new Set(data.purchases.map((p) => p.id));
  if (data.purchases.some((p) => !vendorIds.has(p.vendorId)) || data.payments.some((p) => !vendorIds.has(p.vendorId))
    || data.paymentLinks.some((link) => !paymentIds.has(link.paymentId) || !purchaseIds.has(link.purchaseId))) throw new Error('O backup contém relações inválidas entre registros.');
  const purchaseById = new Map(data.purchases.map((p) => [p.id, p])), paymentById = new Map(data.payments.map((p) => [p.id, p]));
  const linkedPurchases = new Set<string>(), paymentSums = new Map<string, number>();
  for (const link of data.paymentLinks) {
    if (linkedPurchases.has(link.purchaseId)) throw new Error('Uma compra aparece em mais de um pagamento no backup.');
    const purchase = purchaseById.get(link.purchaseId), payment = paymentById.get(link.paymentId);
    if (!purchase || !payment || purchase.paymentStatus !== 'paid' || purchase.vendorId !== payment.vendorId || purchase.paymentDate !== payment.paymentDate) throw new Error('Os vínculos de pagamento do backup são inconsistentes.');
    linkedPurchases.add(link.purchaseId);
    paymentSums.set(link.paymentId, (paymentSums.get(link.paymentId) ?? 0) + purchase.amountCents);
  }
  if (data.purchases.some((p) => p.paymentStatus === 'paid' && !linkedPurchases.has(p.id))
    || data.payments.some((p) => paymentSums.get(p.id) !== p.totalCents)) throw new Error('Os totais ou status de pagamento do backup não conferem.');
  for (const purchase of data.purchases) if (!zip.file(`photos/${purchase.id}.jpg`)) throw new Error(`A foto da compra ${purchase.id} não foi encontrada no backup.`);
  const previousBackup = await readBackupData();
  const restored: { oldPath: string; newPath: string }[] = [];
  try {
    for (const purchase of data.purchases) {
      const image = zip.file(`photos/${purchase.id}.jpg`);
      if (!image) throw new Error(`A foto da compra ${purchase.id} não foi encontrada no backup.`);
      const path = await restorePhoto(await image.async('base64'));
      restored.push({ oldPath: purchase.photoPath, newPath: path });
    }
    await replaceWithBackup(data, restored);
    await Promise.all(previousBackup.purchases.map((purchase) => removePhoto(purchase.photoPath).catch(() => undefined)));
  }
  catch (error) {
    await Promise.all(restored.map(({ newPath }) => removePhoto(newPath).catch(() => undefined)));
    throw error;
  }
  return { purchaseCount: data.purchases.length };
}
