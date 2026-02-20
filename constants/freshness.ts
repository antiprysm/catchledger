export type QualityStatus = "LIVE" | "FRESH" | "FROZEN" | "THAWED";

export const QUALITY_LABELS: Record<QualityStatus, string> = {
  LIVE: "Live",
  FRESH: "Fresh",
  FROZEN: "Frozen",
  THAWED: "Thawed",
};

export const DEFAULT_BEST_BEFORE_HOURS: Record<QualityStatus, number> = {
  LIVE: 12,
  FRESH: 48,
  FROZEN: 720, // 30 days
  THAWED: 12,
};

export function computeExpiresAt(caughtAtISO: string | undefined, bestBeforeHours: number) {
  if (!caughtAtISO) return undefined;
  const caught = new Date(caughtAtISO).getTime();
  return new Date(caught + bestBeforeHours * 60 * 60 * 1000).toISOString();
}

export function isExpired(expiresAtISO?: string) {
  if (!expiresAtISO) return false;
  return Date.now() > new Date(expiresAtISO).getTime();
}
