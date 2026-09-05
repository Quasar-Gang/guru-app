export type GoalDraft = { goal: string; weeks: string; capacity: string; traitId: string; personaId: string; importIds: string[] };
export type PendingWork = {
  draft?: GoalDraft;
  sessionId?: string;
  revision?: { planId: string; id: string };
};

export function readPendingWork(
  storage: Pick<Storage, "getItem">,
  key: string,
): PendingWork {
  try {
    const value = JSON.parse(storage.getItem(key) || "{}");
    if (!value || typeof value !== "object") return {};
    return {
      ...(value.draft && ["goal", "weeks", "capacity", "traitId", "personaId"].every((key) => typeof value.draft[key] === "string") && Array.isArray(value.draft.importIds)
        ? { draft: { goal: value.draft.goal, weeks: value.draft.weeks, capacity: value.draft.capacity, traitId: value.draft.traitId, personaId: value.draft.personaId, importIds: value.draft.importIds.filter((id: unknown) => typeof id === "string") } } : {}),
      ...(typeof value.sessionId === "string" && value.sessionId
        ? { sessionId: value.sessionId }
        : {}),
      ...(typeof value.revision?.planId === "string" &&
      typeof value.revision?.id === "string"
        ? { revision: { planId: value.revision.planId, id: value.revision.id } }
        : {}),
    };
  } catch {
    return {};
  }
}

export function writePendingWork(
  storage: Pick<Storage, "getItem" | "setItem">,
  key: string,
  patch: PendingWork,
): void {
  if (!key) return;
  try {
    storage.setItem(
      key,
      JSON.stringify({ ...readPendingWork(storage, key), ...patch }),
    );
  } catch {
    /* Storage restrictions must not interrupt the server operation. */
  }
}
