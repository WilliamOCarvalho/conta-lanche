export type PaymentCandidate = { id: string; vendorId: string; purchaseDate: string; amountCents: number };
export type PaymentBatch = { vendorId: string; referencePeriod: string; totalCents: number; purchases: PaymentCandidate[] };

export function groupPaymentCandidates(purchases: PaymentCandidate[]): PaymentBatch[] {
  const byVendor = new Map<string, PaymentCandidate[]>();
  for (const purchase of purchases) {
    const key = `${purchase.vendorId}:${purchase.purchaseDate.slice(0, 7)}`;
    const group = byVendor.get(key) ?? [];
    group.push(purchase); byVendor.set(key, group);
  }
  return [...byVendor.values()].map((rows) => ({
    vendorId: rows[0]?.vendorId ?? '',
    referencePeriod: rows.map((row) => row.purchaseDate.slice(0, 7)).sort()[0] ?? '',
    totalCents: rows.reduce((sum, row) => sum + row.amountCents, 0),
    purchases: rows,
  }));
}
