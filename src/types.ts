export type PaymentStatus = 'pending' | 'paid';
export type Vendor = {
  id: string; name: string; pixKey: string | null; contact: string | null; observation: string | null;
  active: boolean; createdAt: string; updatedAt: string;
};
export type Purchase = {
  id: string; vendorId: string; vendorName?: string; description: string | null;
  observation: string | null; purchaseDate: string; amountCents: number;
  photoPath: string; paymentStatus: PaymentStatus; paymentDate: string | null;
  createdAt: string; updatedAt: string;
};
export type Payment = {
  id: string; vendorId: string; referencePeriod: string; paymentDate: string;
  totalCents: number; observation: string | null; createdAt: string;
};
export type Holiday = { id: string; date: string; description: string; type: 'holiday' | 'non_working'; };
export type PurchaseFilters = {
  from?: string; to?: string; vendorId?: string; status?: PaymentStatus;
  minCents?: number; maxCents?: number;
};
