import type { Purchase, PurchaseFilters } from '../types';

export function filterPurchases(items: Purchase[], filters: PurchaseFilters): Purchase[] {
  return items.filter((item) => (!filters.from || item.purchaseDate >= filters.from)
    && (!filters.to || item.purchaseDate <= filters.to)
    && (!filters.vendorId || item.vendorId === filters.vendorId)
    && (!filters.status || item.paymentStatus === filters.status)
    && (filters.minCents === undefined || item.amountCents >= filters.minCents)
    && (filters.maxCents === undefined || item.amountCents <= filters.maxCents));
}

export function summarizePurchases(items: Purchase[]) {
  return items.reduce((sum, item) => {
    sum.count += 1; sum.totalCents += item.amountCents;
    if (item.paymentStatus === 'paid') sum.paidCents += item.amountCents;
    else sum.pendingCents += item.amountCents;
    return sum;
  }, { count: 0, totalCents: 0, paidCents: 0, pendingCents: 0 });
}

export function groupPurchasesByVendor(items: Purchase[]) {
  const groups = new Map<string, { vendorId: string; vendorName: string; count: number; totalCents: number; paidCents: number; pendingCents: number }>();
  for (const item of items) {
    const group = groups.get(item.vendorId) ?? { vendorId: item.vendorId, vendorName: item.vendorName ?? 'Vendedor', count: 0, totalCents: 0, paidCents: 0, pendingCents: 0 };
    group.count += 1; group.totalCents += item.amountCents;
    if (item.paymentStatus === 'paid') group.paidCents += item.amountCents;
    else group.pendingCents += item.amountCents;
    groups.set(item.vendorId, group);
  }
  return [...groups.values()].sort((a, b) => b.totalCents - a.totalCents);
}
