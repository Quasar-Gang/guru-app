"use server";

import { coreClient, invalidateSnapshot } from "@/lib/api/client";

/**
 * Accepting the draft is the one control on these pages that maps one to one
 * onto a guru-core write: a plan is started or archived, never edited into
 * something else. Wanting a different plan means wanting a different hypothesis.
 *
 * The button's behaviour does not change. It still locks the panel immediately;
 * this call is what makes the lock outlive the tab when a backend is configured.
 * With no backend it is a no-op, exactly as before.
 */
export async function acceptPlan(): Promise<{ ok: boolean; message: string | null }> {
  const client = coreClient();
  if (!client) return { ok: true, message: null };

  try {
    const plans = await client.plans();
    const target = plans.find((plan) => plan.status === "draft") ?? plans.at(-1);
    if (!target) return { ok: true, message: null };
    if (target.status === "active") return { ok: true, message: null };
    await client.setPlanStatus(target.id, "active");
    invalidateSnapshot();
    return { ok: true, message: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[guru-core] could not activate the plan: ${message}`);
    return { ok: false, message };
  }
}
