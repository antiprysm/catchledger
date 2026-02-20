export type ExpenseCategory =
  | "FUEL"
  | "ICE"
  | "BAIT"
  | "GEAR"
  | "MAINTENANCE"
  | "FEES"
  | "PACKAGING"
  | "OTHER";

export type Expense = {
  id: string;
  occurredAt: string; // ISO
  category: ExpenseCategory;
  amount: number; // positive dollars
  note?: string;
  createdAt: string;
  updatedAt: string;
};
