export type BuyerType = "RESTAURANT" | "CHEF" | "MARKET" | "PERSON" | "OTHER";

export type SaleLine = {
  itemId: string;
  speciesName: string;
  unit: string; // or UnitType if you already have it
  unitPrice: number;
  quantity: number;
  subtotal: number;
  originCatchLocation?: string,
  originCaughtAt?: string,
  originCatchMethod?: string,
  originBatchId?: string;
};

export type Sale = {
  id: string;
  occurredAt: string; // ISO
  paymentMethod: "CASH" | "VENMO" | "CASHAPP" | "PAYPAL" | "OTHER";
  paymentNote?: string;

  // ✅ NEW — buyer identity (compliance)
  buyerName: string;              // required
  buyerType: BuyerType;           // required
  buyerContact?: string;          // optional (phone/email)

  lines: SaleLine[];
  total: number;

  createdAt: string;
  updatedAt: string;
  saleLocationType?: "TRUCK" | "HOME" | "DOCK" | "OTHER",
  saleLocationNote?: string,
  buyerLicenseId?: string,
};

export type PaymentMethod =
  | "CASH"
  | "PAYPAL"
  | "CASHAPP"
  | "VENMO"
  | "OTHER";
