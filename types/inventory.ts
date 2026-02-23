
export type UnitType = "lb" | "kg" | "fish" | "dozen";

export type InventoryItem = {
  id: string;
  speciesName: string;
  unit: UnitType;
  pricePerUnit: number;
  quantity?: number;
  quality?: "LIVE" | "FRESH" | "FROZEN" | "THAWED";
  bestBeforeHours?: number;

  // ✅ Compliance fields
  catchLocation: string;         // required (water body / area)
  catchMethod?: string;          // optional

  caughtAt?: string;             // you already use this (ISO)
  expiresAt?: string;

  createdAt: string;
  updatedAt: string;
  batchId: string;
};
