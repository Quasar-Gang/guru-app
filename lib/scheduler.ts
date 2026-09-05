import type { ScheduleDraft, ScheduleSlot } from "./contracts";

/**
 * The weekly draft. The coach drafts it; the user can only delete.
 *
 * Self-scheduling is systematically optimistic, and the coach's only real
 * advantage is that it has the actual history while the user has memory.
 * Delete-only keeps the user's sense of control while pointing every edit
 * toward less work, which is exactly the direction that corrects optimism.
 *
 * There is no add button. That absence is the feature.
 */

/** Never fill the week. Openings appear at random, and a full week kills them. */
export const LOAD_CEILING = 0.7;

export interface ScheduleSummary {
  loadHours: number;
  capacityHours: number;
  loadPercent: number;
  /** Cumulative branches that fell below their minimum weekly volume. */
  brokenChains: { title: string; scheduled: number; required: number }[];
  overCeiling: boolean;
}

export function summarize(draft: ScheduleDraft): ScheduleSummary {
  const live = draft.slots.filter((slot) => !slot.removed);
  const minutes = live.reduce((total, slot) => total + slot.durationMin, 0);
  const loadHours = Math.round((minutes / 60) * 10) / 10;

  const brokenChains = draft.minWeekly
    .map((rule) => {
      const scheduled = live.filter((slot) => slot.branchId === rule.branchId).length;
      return { title: `${rule.title}${rule.unit}`, scheduled, required: rule.required };
    })
    .filter((entry) => entry.scheduled < entry.required);

  return {
    loadHours,
    capacityHours: draft.capacityHours,
    loadPercent: Math.round((loadHours / draft.capacityHours) * 100),
    brokenChains,
    overCeiling: loadHours / draft.capacityHours > LOAD_CEILING,
  };
}

export function toggleSlot(draft: ScheduleDraft, slotId: string): ScheduleDraft {
  return {
    ...draft,
    slots: draft.slots.map((slot: ScheduleSlot) =>
      slot.id === slotId && !slot.fixed ? { ...slot, removed: !slot.removed } : slot,
    ),
  };
}
