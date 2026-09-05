import type { Horizon, HorizonId, Quarter } from "./contracts";

/**
 * Horizon is the first decision in station 1 because it sets the scale of
 * everything after it: retest frequency, milestone density, slot count.
 *
 * Only the one-year horizon is open. The others are listed and marked closed
 * on purpose — a narrowed scope is a trade-off, and trade-offs stay visible.
 */

/** Hard cap on promotion slots per quarter. Does not carry over. */
export const SLOT_CAP = 3;

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  return date.toISOString().slice(0, 10);
}

function previousDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function quartersFrom(start: string, months: number): Quarter[] {
  const count = Math.round(months / 3);
  return Array.from({ length: count }, (_, index) => {
    const quarterStart = addMonths(start, index * 3);
    return {
      id: `Q${index + 1}`,
      start: quarterStart,
      end: previousDay(addMonths(start, (index + 1) * 3)),
    };
  });
}

const OPTIONS: { id: HorizonId; label: string; months: number; available: boolean }[] = [
  { id: "3m", label: "3 個月", months: 3, available: false },
  { id: "6m", label: "6 個月", months: 6, available: false },
  { id: "1y", label: "1 年", months: 12, available: true },
  { id: "lifeStage", label: "人生階段", months: 60, available: false },
];

/**
 * Builds every horizon option so the closed ones can still be rendered.
 * A year is the right scale because it is long enough for two to four
 * retests — one retest has no trend — and short enough that the
 * falsification condition expires while the user still cares.
 */
export function buildHorizons(start: string): Horizon[] {
  return OPTIONS.map((option) => {
    const quarters = quartersFrom(start, option.months);
    return {
      id: option.id,
      label: option.label,
      available: option.available,
      start,
      end: previousDay(addMonths(start, option.months)),
      quarters,
      firstReconcileAt: quarters[0].end,
      retestCount: quarters.length,
      slotCap: SLOT_CAP,
    };
  });
}

export function horizonById(start: string, id: HorizonId): Horizon {
  const found = buildHorizons(start).find((horizon) => horizon.id === id);
  if (!found) throw new Error(`Unknown horizon: ${id}`);
  return found;
}
