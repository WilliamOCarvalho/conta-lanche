import type { Holiday, Payment, PaymentStatus, Purchase, PurchaseFilters, Vendor } from '../types';
import { getDatabase } from './database';
import { groupPaymentCandidates } from '../services/paymentBatches';

const nowISO = () => new Date().toISOString();
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

type PurchaseRow = {
  id: string; vendor_id: string; vendor_name: string; description: string | null; observation: string | null;
  purchase_date: string; amount_cents: number; photo_path: string; payment_status: PaymentStatus;
  payment_date: string | null; created_at: string; updated_at: string;
};
const purchaseFromRow = (row: PurchaseRow): Purchase => ({
  id: row.id, vendorId: row.vendor_id, vendorName: row.vendor_name, description: row.description,
  observation: row.observation, purchaseDate: row.purchase_date, amountCents: row.amount_cents,
  photoPath: row.photo_path, paymentStatus: row.payment_status, paymentDate: row.payment_date,
  createdAt: row.created_at, updatedAt: row.updated_at,
});
const purchaseSelect = `SELECT p.*, v.name AS vendor_name FROM purchases p JOIN vendors v ON v.id = p.vendor_id`;

export async function listVendors(activeOnly = false): Promise<Vendor[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; name: string; pix_key: string | null; contact: string | null; observation: string | null; active: number; created_at: string; updated_at: string }>(
    `SELECT * FROM vendors ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY active DESC, name COLLATE NOCASE`);
  return rows.map((r) => ({ id: r.id, name: r.name, pixKey: r.pix_key, contact: r.contact, observation: r.observation, active: r.active === 1, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export async function saveVendor(input: { id?: string; name: string; pixKey?: string; contact?: string; observation?: string; active?: boolean }): Promise<string> {
  const db = await getDatabase(), id = input.id ?? newId(), now = nowISO();
  if (input.id) await db.runAsync('UPDATE vendors SET name=?, pix_key=?, contact=?, observation=?, active=?, updated_at=? WHERE id=?', input.name.trim(), input.pixKey?.trim() || null, input.contact?.trim() || null, input.observation?.trim() || null, input.active === false ? 0 : 1, now, id);
  else await db.runAsync('INSERT INTO vendors (id,name,pix_key,contact,observation,active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)', id, input.name.trim(), input.pixKey?.trim() || null, input.contact?.trim() || null, input.observation?.trim() || null, now, now);
  return id;
}

export async function setVendorActive(id: string, active: boolean) {
  const db = await getDatabase(); await db.runAsync('UPDATE vendors SET active=?, updated_at=? WHERE id=?', active ? 1 : 0, nowISO(), id);
}

export async function listPurchases(filters: PurchaseFilters = {}): Promise<Purchase[]> {
  const clauses: string[] = [], values: Array<string | number> = [];
  if (filters.from) { clauses.push('p.purchase_date >= ?'); values.push(filters.from); }
  if (filters.to) { clauses.push('p.purchase_date <= ?'); values.push(filters.to); }
  if (filters.vendorId) { clauses.push('p.vendor_id = ?'); values.push(filters.vendorId); }
  if (filters.status) { clauses.push('p.payment_status = ?'); values.push(filters.status); }
  if (filters.minCents !== undefined) { clauses.push('p.amount_cents >= ?'); values.push(filters.minCents); }
  if (filters.maxCents !== undefined) { clauses.push('p.amount_cents <= ?'); values.push(filters.maxCents); }
  const db = await getDatabase();
  const rows = await db.getAllAsync<PurchaseRow>(`${purchaseSelect} ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY p.purchase_date DESC, p.created_at DESC`, ...values);
  return rows.map(purchaseFromRow);
}

export async function getPurchase(id: string): Promise<Purchase | null> {
  const db = await getDatabase(); const row = await db.getFirstAsync<PurchaseRow>(`${purchaseSelect} WHERE p.id = ?`, id);
  return row ? purchaseFromRow(row) : null;
}

export async function savePurchase(input: { id?: string; vendorId: string; description?: string; observation?: string; purchaseDate: string; amountCents: number; photoPath: string }): Promise<string> {
  const db = await getDatabase(), id = input.id ?? newId(), now = nowISO();
  await db.withTransactionAsync(async () => {
    if (input.id) {
      await db.runAsync('UPDATE purchases SET vendor_id=?,description=?,observation=?,purchase_date=?,amount_cents=?,photo_path=?,updated_at=? WHERE id=?',
        input.vendorId, input.description?.trim() || null, input.observation?.trim() || null, input.purchaseDate, input.amountCents, input.photoPath, now, id);
      const linked = await db.getFirstAsync<{ payment_id: string }>('SELECT payment_id FROM payment_purchases WHERE purchase_id=?', id);
      if (linked) {
        const total = await db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(p.amount_cents),0) AS total FROM payment_purchases pp JOIN purchases p ON p.id=pp.purchase_id WHERE pp.payment_id=?', linked.payment_id);
        await db.runAsync('UPDATE payments SET total_cents=? WHERE id=?', total?.total ?? 0, linked.payment_id);
      }
    } else {
      await db.runAsync(`INSERT INTO purchases (id,vendor_id,description,observation,purchase_date,amount_cents,photo_path,payment_status,payment_date,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,'pending',NULL,?,?)`, id, input.vendorId, input.description?.trim() || null, input.observation?.trim() || null, input.purchaseDate, input.amountCents, input.photoPath, now, now);
    }
  });
  return id;
}

export async function deletePurchase(id: string): Promise<string | null> {
  const db = await getDatabase(); const row = await db.getFirstAsync<{ photo_path: string }>('SELECT photo_path FROM purchases WHERE id=?', id);
  if (!row) return null;
  await db.withTransactionAsync(async () => {
    const linked = await db.getFirstAsync<{ payment_id: string }>('SELECT payment_id FROM payment_purchases WHERE purchase_id=?', id);
    await db.runAsync('DELETE FROM purchases WHERE id=?', id);
    if (linked) {
      const remaining = await db.getFirstAsync<{ count: number; total: number }>('SELECT COUNT(pp.purchase_id) AS count, COALESCE(SUM(p.amount_cents),0) AS total FROM payment_purchases pp JOIN purchases p ON p.id=pp.purchase_id WHERE pp.payment_id=?', linked.payment_id);
      if (!remaining?.count) await db.runAsync('DELETE FROM payments WHERE id=?', linked.payment_id);
      else await db.runAsync('UPDATE payments SET total_cents=? WHERE id=?', remaining.total, linked.payment_id);
    }
  });
  return row.photo_path;
}

export async function setPurchasesPaid(ids: string[], paymentDate: string, observation?: string): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    const placeholders = ids.map(() => '?').join(',');
    const rows = await db.getAllAsync<{ id: string; vendor_id: string; purchase_date: string; amount_cents: number }>(
      `SELECT id,vendor_id,purchase_date,amount_cents FROM purchases WHERE payment_status='pending' AND id IN (${placeholders})`, ...ids);
    for (const batch of groupPaymentCandidates(rows.map((row) => ({ id: row.id, vendorId: row.vendor_id, purchaseDate: row.purchase_date, amountCents: row.amount_cents })))) {
      const paymentId = newId();
      const period = batch.referencePeriod || paymentDate.slice(0, 7);
      await db.runAsync('INSERT INTO payments (id,vendor_id,reference_period,payment_date,total_cents,observation,created_at) VALUES (?,?,?,?,?,?,?)', paymentId, batch.vendorId, period, paymentDate, batch.totalCents, observation?.trim() || null, nowISO());
      for (const purchase of batch.purchases) {
        await db.runAsync('INSERT INTO payment_purchases (payment_id,purchase_id) VALUES (?,?)', paymentId, purchase.id);
        await db.runAsync("UPDATE purchases SET payment_status='paid', payment_date=?, updated_at=? WHERE id=?", paymentDate, nowISO(), purchase.id);
      }
    }
  });
}

export async function setPurchasesPending(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    const placeholders = ids.map(() => '?').join(',');
    const payments = await db.getAllAsync<{ payment_id: string }>(`SELECT DISTINCT payment_id FROM payment_purchases WHERE purchase_id IN (${placeholders})`, ...ids);
    for (const id of ids) await db.runAsync("UPDATE purchases SET payment_status='pending', payment_date=NULL, updated_at=? WHERE id=?", nowISO(), id);
    for (const row of payments) {
      await db.runAsync(`DELETE FROM payment_purchases WHERE payment_id=? AND purchase_id IN (${placeholders})`, row.payment_id, ...ids);
      const remaining = await db.getFirstAsync<{ count: number; total: number }>('SELECT COUNT(pp.purchase_id) AS count, COALESCE(SUM(p.amount_cents),0) AS total FROM payment_purchases pp JOIN purchases p ON p.id=pp.purchase_id WHERE pp.payment_id=?', row.payment_id);
      if (!remaining?.count) await db.runAsync('DELETE FROM payments WHERE id=?', row.payment_id);
      else {
        await db.runAsync('UPDATE payments SET total_cents=? WHERE id=?', remaining.total, row.payment_id);
      }
    }
  });
}

export async function listPayments(): Promise<Array<Payment & { vendorName: string; purchaseCount: number }>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; vendor_id: string; reference_period: string; payment_date: string; total_cents: number; observation: string | null; created_at: string; vendor_name: string; purchase_count: number }>(
    'SELECT pay.*, v.name AS vendor_name, COUNT(pp.purchase_id) AS purchase_count FROM payments pay JOIN vendors v ON v.id=pay.vendor_id LEFT JOIN payment_purchases pp ON pp.payment_id=pay.id GROUP BY pay.id ORDER BY pay.payment_date DESC, pay.created_at DESC');
  return rows.map((r) => ({ id: r.id, vendorId: r.vendor_id, referencePeriod: r.reference_period, paymentDate: r.payment_date, totalCents: r.total_cents, observation: r.observation, createdAt: r.created_at, vendorName: r.vendor_name, purchaseCount: r.purchase_count }));
}

export async function getPaymentForPurchase(purchaseId: string): Promise<(Payment & { vendorName: string; purchaseCount: number }) | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ id: string; vendor_id: string; reference_period: string; payment_date: string; total_cents: number; observation: string | null; created_at: string; vendor_name: string; purchase_count: number }>(
    'SELECT pay.*, v.name AS vendor_name, COUNT(pp_all.purchase_id) AS purchase_count FROM payment_purchases pp JOIN payments pay ON pay.id=pp.payment_id JOIN vendors v ON v.id=pay.vendor_id LEFT JOIN payment_purchases pp_all ON pp_all.payment_id=pay.id WHERE pp.purchase_id=? GROUP BY pay.id LIMIT 1', purchaseId);
  return row ? { id: row.id, vendorId: row.vendor_id, referencePeriod: row.reference_period, paymentDate: row.payment_date, totalCents: row.total_cents, observation: row.observation, createdAt: row.created_at, vendorName: row.vendor_name, purchaseCount: row.purchase_count } : null;
}

export async function listHolidays(): Promise<Holiday[]> {
  const db = await getDatabase(); const rows = await db.getAllAsync<{ id: string; date: string; description: string; type: Holiday['type'] }>('SELECT * FROM non_working_days ORDER BY date');
  return rows;
}
export async function saveHoliday(input: { date: string; description: string; type: Holiday['type'] }) {
  const db = await getDatabase(); await db.runAsync('INSERT OR REPLACE INTO non_working_days (id,date,description,type) VALUES (COALESCE((SELECT id FROM non_working_days WHERE date=?),?),?,?,?)', input.date, newId(), input.date, input.description.trim(), input.type);
}
export async function deleteHoliday(id: string) { const db = await getDatabase(); await db.runAsync('DELETE FROM non_working_days WHERE id=?', id); }

export type BackupData = { version: 2; vendors: Vendor[]; purchases: Purchase[]; payments: Payment[]; paymentLinks: Array<{ paymentId: string; purchaseId: string }>; holidays: Holiday[]; settings: Array<{ key: string; value: string }>; };
export async function readBackupData(): Promise<BackupData> {
  const db = await getDatabase();
  const [vendors, purchases, payments, paymentLinks, holidays, settings] = await Promise.all([
    listVendors(), listPurchases(), listPayments(), db.getAllAsync<{ payment_id: string; purchase_id: string }>('SELECT * FROM payment_purchases'), listHolidays(), db.getAllAsync<{ key: string; value: string }>('SELECT * FROM settings'),
  ]);
  return { version: 2, vendors, purchases, payments: payments.map((p) => ({ id: p.id, vendorId: p.vendorId, referencePeriod: p.referencePeriod, paymentDate: p.paymentDate, totalCents: p.totalCents, observation: p.observation, createdAt: p.createdAt })), paymentLinks: paymentLinks.map((p) => ({ paymentId: p.payment_id, purchaseId: p.purchase_id })), holidays, settings };
}

export async function replaceWithBackup(data: BackupData, photos: Array<{ oldPath: string; newPath: string }>) {
  const db = await getDatabase(), pathMap = new Map(photos.map((p) => [p.oldPath, p.newPath]));
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM payment_purchases; DELETE FROM payments; DELETE FROM purchases; DELETE FROM vendors; DELETE FROM non_working_days; DELETE FROM settings;');
    for (const v of data.vendors) await db.runAsync('INSERT INTO vendors (id,name,pix_key,contact,observation,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)', v.id, v.name, v.pixKey ?? null, v.contact, v.observation, v.active ? 1 : 0, v.createdAt, v.updatedAt);
    for (const p of data.purchases) await db.runAsync('INSERT INTO purchases VALUES (?,?,?,?,?,?,?,?,?,?,?)', p.id, p.vendorId, p.description, p.observation, p.purchaseDate, p.amountCents, pathMap.get(p.photoPath) ?? p.photoPath, p.paymentStatus, p.paymentDate, p.createdAt, p.updatedAt);
    for (const p of data.payments) await db.runAsync('INSERT INTO payments VALUES (?,?,?,?,?,?,?)', p.id, p.vendorId, p.referencePeriod, p.paymentDate, p.totalCents, p.observation, p.createdAt);
    for (const link of data.paymentLinks) await db.runAsync('INSERT INTO payment_purchases (payment_id,purchase_id) VALUES (?,?)', link.paymentId, link.purchaseId);
    for (const h of data.holidays) await db.runAsync('INSERT INTO non_working_days VALUES (?,?,?,?)', h.id, h.date, h.description, h.type);
    for (const s of data.settings) await db.runAsync('INSERT INTO settings VALUES (?,?)', s.key, s.value);
  });
}
