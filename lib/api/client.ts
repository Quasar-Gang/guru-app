import type { CoachingSnapshot } from "../contracts";
import { SNAPSHOT } from "../mock/snapshot";
import { GuruCoreClient, readConfig } from "./guru-core";
import { adaptSnapshot, type SnapshotOrigins } from "./snapshot-adapter";

/**
 * The one entry point the pages use.
 *
 * Server-side only, because the guru-core bearer token is a server secret — it is
 * imported by server components alone, and nothing here is marked "use client".
 * Every
 * station is a server component that calls `loadSnapshot()` and hands the result
 * to a client component, so the token never reaches the browser and the UI never
 * learns whether the data came over the network.
 *
 * Unconfigured or unreachable, this returns the demonstration fixture. That is
 * not a silent failure: a backend outage should not blank the page mid-demo, and
 * `origins` records which sections were live.
 */

const FIXTURE_ORIGINS: SnapshotOrigins = {
  horizon: "fixture",
  imports: "fixture",
  baselineQuestions: "fixture",
  shapes: "fixture",
  goalTree: "fixture",
  ledger: "fixture",
  schedule: "fixture",
};

export interface LoadedSnapshot {
  snapshot: CoachingSnapshot;
  origins: SnapshotOrigins;
  /** Present when guru-core is configured but the read failed. */
  error: string | null;
}

/**
 * guru-core rate-limits at 60 requests a minute, and one render costs eleven
 * reads. Three stations opened in quick succession would spend half the budget,
 * so the assembled snapshot is held for a short window and shared across them.
 *
 * Thirty seconds is not a compromise here: the product's own cadence is a
 * quarter, and nothing on these pages changes faster than a page load.
 */
const CACHE_TTL_MS = 30_000;

let cached: { at: number; value: LoadedSnapshot } | null = null;

export async function loadSnapshot(): Promise<LoadedSnapshot> {
  const config = readConfig();
  if (!config) return { snapshot: SNAPSHOT, origins: FIXTURE_ORIGINS, error: null };

  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  try {
    const { snapshot, origins } = await adaptSnapshot(new GuruCoreClient(config));
    // One line per read saying which sections were live. Without it a partial
    // fallback is invisible, and an invisible fallback is the worst kind.
    console.log(`[guru-core] ${JSON.stringify(origins)}`);
    const value: LoadedSnapshot = { snapshot, origins, error: null };
    cached = { at: Date.now(), value };
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[guru-core] falling back to the fixture: ${message}`);
    return { snapshot: SNAPSHOT, origins: FIXTURE_ORIGINS, error: message };
  }
}

/** Drops the cached snapshot so the next read is fresh. Used after a write. */
export function invalidateSnapshot(): void {
  cached = null;
}

/** The raw client, for the few places that write rather than read. */
export function coreClient(): GuruCoreClient | null {
  const config = readConfig();
  return config ? new GuruCoreClient(config) : null;
}

export { GuruCoreError } from "./guru-core";
