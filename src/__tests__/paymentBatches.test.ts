import { groupPaymentCandidates } from '../services/paymentBatches';

describe('pagamentos individuais e em lote', () => {
  it('forma um lote por vendedor, soma centavos e preserva o mês de referência', () => {
    const batches = groupPaymentCandidates([
      { id: '1', vendorId: 'ana', purchaseDate: '2026-09-01', amountCents: 850 },
      { id: '2', vendorId: 'ana', purchaseDate: '2026-09-03', amountCents: 1250 },
      { id: '3', vendorId: 'bia', purchaseDate: '2026-09-04', amountCents: 900 },
      { id: '4', vendorId: 'ana', purchaseDate: '2026-08-31', amountCents: 200 },
    ]);
    expect(batches).toHaveLength(3);
    expect(batches.find((batch) => batch.vendorId === 'ana')).toMatchObject({ referencePeriod: '2026-09', totalCents: 2100, purchases: [{ id: '1' }, { id: '2' }] });
    expect(groupPaymentCandidates([{ id: 'only', vendorId: 'bia', purchaseDate: '2026-08-01', amountCents: 300 }])[0]?.totalCents).toBe(300);
  });
});
