import { filterPurchases, groupPurchasesByVendor, summarizePurchases } from '../services/analytics';
import type { Purchase } from '../types';

const purchases: Purchase[] = [
  { id: '1', vendorId: 'ana', vendorName: 'Ana', description: null, observation: null, purchaseDate: '2026-09-02', amountCents: 850, photoPath: '/a.jpg', paymentStatus: 'pending', paymentDate: null, createdAt: '', updatedAt: '' },
  { id: '2', vendorId: 'ana', vendorName: 'Ana', description: null, observation: null, purchaseDate: '2026-09-04', amountCents: 1250, photoPath: '/b.jpg', paymentStatus: 'paid', paymentDate: '2026-09-05', createdAt: '', updatedAt: '' },
  { id: '3', vendorId: 'bia', vendorName: 'Bia', description: null, observation: null, purchaseDate: '2026-08-31', amountCents: 2000, photoPath: '/c.jpg', paymentStatus: 'pending', paymentDate: null, createdAt: '', updatedAt: '' },
];

describe('relatórios e filtros', () => {
  it('filtra por período, vendedor, status e faixa de valor', () => {
    expect(filterPurchases(purchases, { from: '2026-09-01', vendorId: 'ana', status: 'pending', minCents: 500, maxCents: 1000 }).map((p) => p.id)).toEqual(['1']);
  });

  it('calcula total, pago e pendente em centavos', () => {
    expect(summarizePurchases(purchases)).toEqual({ count: 3, totalCents: 4100, paidCents: 1250, pendingCents: 2850 });
  });

  it('agrupa corretamente por vendedor e ordena pelo valor', () => {
    expect(groupPurchasesByVendor(purchases)).toEqual([
      { vendorId: 'ana', vendorName: 'Ana', count: 2, totalCents: 2100, paidCents: 1250, pendingCents: 850 },
      { vendorId: 'bia', vendorName: 'Bia', count: 1, totalCents: 2000, paidCents: 0, pendingCents: 2000 },
    ]);
  });
});
