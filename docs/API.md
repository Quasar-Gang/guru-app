# guru-core API — frontend-derived draft

Status: **draft**. The backend does not exist yet. This document is written the
other way round from usual: the frontend already renders every screen from typed
values, so those types *are* the contract, and this file is their HTTP
projection. The authority is [`lib/contracts.ts`](../lib/contracts.ts); when the
two disagree, the TypeScript wins and this file is stale.

The design rule the shell followed applies here too: **an interaction earned its
place only if it exposed a question the backend has to answer.** Every endpoint
below exists because a control on a page needs it.

## Conventions

| | |
|---|---|
| Base | `{origin}/v1` — set `NEXT_PUBLIC_API_BASE_URL` to `{origin}` (absolute, no `/v1`, no trailing slash) |
| Auth | `Authorization: Bearer <JWT>` on every request once accounts exist. The MVP has no accounts and sends none |
| Content type | `application/json` both ways |
| Dates | `YYYY-MM-DD`. Timestamps are RFC 3339 |
| Empty success | `204 No Content` |
| Errors | `{ "error": { "code": "snake_case", "message": "human readable" } }` |

The client surfaces errors as `GuruApiError` with `status`, `code` and `message`
(see [`lib/api/client.ts`](../lib/api/client.ts)).

Without an absolute origin the client serves the demonstration snapshot from
[`lib/mock/snapshot.ts`](../lib/mock/snapshot.ts) and never touches the network.
The fallback returns the same shapes as the remote call, so switching a backend
on cannot change the rendering contract.

---

## 1 · Snapshot

### `GET /v1/snapshot`

Everything the three stations render, in one document. One request rather than
nine because each station needs a *consistent* view: the ledger's numbers are
computed from the same trace set the plan was locked against, and paging them in
separately would let the two drift.

Returns `CoachingSnapshot`:

| Field | Type | Station |
|---|---|---|
| `horizon` | `Horizon` | 1 |
| `imports` | `ImportSource[]` | 1 |
| `baselineQuestions` | `BaselineQuestion[]` | 1 |
| `roleModel` | `RoleModelDraft` | 1 |
| `shapes` | `ShapeSuggestion[]` | 1 |
| `crossChecks` | `Record<shapeId, CrossCheck>` | 1 |
| `goalTree` | `GoalTree` | 2 |
| `challenges` | `Challenge[]` | 2 |
| `period` | `LedgerPeriod` | 3 |
| `traces` | `Trace[]` | 3 |
| `results` | `ReconcileResult[]` | 3 |
| `diagnosis` | `Diagnosis` | 3 |
| `prescriptions` | `Prescription[]` | 3 |
| `weeklyCheck` | `WeeklyCheckItem[]` | 3 |
| `schedule` | `ScheduleDraft` | 3 |

When the snapshot grows past one request, split it by station
(`/v1/intake`, `/v1/goal-tree`, `/v1/ledger`) rather than by entity — the
consistency requirement is per station, not per table.

---

## 2 · Station 1 · intake

### `POST /v1/role-model:decompose`

Turns "I want *X*'s *Y*" into three cells plus a retest method.

```json
{ "person": "<person>", "capability": "<capability, in the user's own words>" }
```

Returns `CapabilityBreakdown`. When the stated capability cannot be retested as
phrased, return `tooAbstract: true` with the other fields `null` — do **not**
invent a metric. A cumulative branch with no retest method sits at "effect
unknown" forever, and that is the failure this endpoint exists to prevent.

This endpoint is a hard-coded pattern table in the shell
([`lib/role-model.ts`](../lib/role-model.ts)) and a model call in production. The
output shape does not change.

### `POST /v1/shapes`

Generates two or three shape suggestions from the imported traces, the baseline
answers and the role model.

Returns `ShapeSuggestion[]`. **Every card must carry at least one
`evidence` entry.** A card without its evidence line is a motivational poster,
not an inference, and it cannot be argued with — which is the entire point of
showing it. `evidence[].kind` is one of `roleModel`, `imported`,
`baselineAnswers`; with no imports, only the first and third are available and
the response should carry fewer cards rather than weaker ones.

This is the highest-risk endpoint in the product: it is the one thing station 1
cannot compute with rules.

### `GET /v1/shapes/{shapeId}/cross-check`

Runs the imported traces back against the chosen shape.

Returns `CrossCheck`. If the calendar (P0) has not been imported, return
`available: false` and **no items**. Do not assemble something that looks like a
comparison out of the baseline answers; that would be a guess presented as a
reconciliation, and the product's third tone rule forbids promising what the
software cannot do.

### `POST /v1/hypotheses`

Freezes station 1's output.

```json
{ "shapeId": "S-2", "horizonId": "1y", "roleModel": { "person": "…", "capability": "…" } }
```

Returns `Hypothesis` with `version: "v0"`. Hypotheses are **never overwritten**;
a change creates `v1` and both stay readable. The change history is itself a
diagnosis — "you rewrote this three times" says more than any encouragement.

---

## 3 · Station 2 · goal tree

### `GET /v1/goal-tree`

Returns `GoalTree`. `vision` and the five-year layer may be `null`; the client
renders them as "not covered this period" rather than blank. Intake produces a
one-year hypothesis and cannot reach those layers, and pretending otherwise
would put a borrowed vision on the tree.

### `PATCH /v1/goal-tree/branches/{branchId}`

Accepts partial `Branch` updates. Rejects any write to `quarterIndicator` while
`lockedUntil` is in the future with `409 quarter_locked` — the time gate is a
mechanism, not self-discipline. Weekly contact with the system is weekly
opportunity to renegotiate, so the boundary lives in the server.

### `POST /v1/goal-tree:lock`

```json
{ "unansweredChallengeIds": ["Q-1", "Q-3"] }
```

Returns `{ "lockedAt": "2026-06-28", "lockedUntil": "2026-09-30" }`. Unanswered
challenges are not an error — they are carried onto the next reconciliation
agenda. Blocking sign-off on them would just teach people to type anything.

### `POST /v1/paths/{pathId}/attractiveness`

```json
{ "score": 8 }
```

The first score is only a baseline; trend needs a second quarter. Alternative
paths are a standing control group, not a backup file: "A is becoming less
attractive than B" is the only evidence the second causal layer can ever
produce.

---

## 4 · Station 3 · ledger

### `POST /v1/reconcile`

```json
{ "from": "2026-07-01", "to": "2026-09-04" }
```

Returns `{ "period": LedgerPeriod, "results": ReconcileResult[], "diagnosis": Diagnosis }`.

`ReconcileResult.status` is the whole product in one enum:

| Status | Meaning |
|---|---|
| `active` | Branch has action. Progress, and it accumulates into evidence |
| `dormant` | Branch has none. This is where imbalance shows up |
| `unattributed` | Action fits no branch — invisible investment. `branchId` is `null` |
| `noEffect` | Action happened, retest did not move. **Every other tracker shows this as green** |

`Attribution.rule` must be returned to the client and shown. A booking the user
cannot see the reason for is a booking they cannot dispute. Cross-branch traces
go to the primary branch with `crossBranch: true`.

`Diagnosis.constraint` is expected to be empty for the first two to three
quarters. Return it as `severity: "unavailable"` with a reason rather than
omitting it — a criterion that is not yet usable should say so on the dashboard.

### `POST /v1/traces:import`

```json
{ "source": "calendar", "format": "ics", "payload": "…" }
```

Accepts an export file. `source` is one of `calendar | notion | resume | health |
work | ai`. Returns `{ "accepted": 448, "rejected": 0 }`. The MVP ships static
upload screens; parsing is the backend's problem, and the ledger's value is in
the booking result, not in how the data arrived.

### `POST /v1/dispatch`

```json
{ "hours": 2, "energy": "mid", "cash": "ok" }
```

Returns `DispatchAnswer` — a pick, its unit action, and the reasons. Every reason
must trace back to time flow or money flow. This endpoint requires no record
keeping from the user, only a question, which is why it is expected to be the
most-used call in the product.

**Known gap.** Credit-card statements are out of scope, so money flow has no
automatic source and `cash` is a declared input. The UI says so. When statements
come back, `cash` becomes a computed field and this request drops the axis.

### `GET /v1/schedule/next-week` · `PATCH /v1/schedule/slots/{slotId}`

Returns `ScheduleDraft`. The only accepted patch is `{ "removed": true | false }`
and it is rejected with `409 slot_fixed` for slots whose `fixed` is true —
those are existing external anchors and not the coach's to move.

**There is no create endpoint, and that is deliberate.** Drafting for someone
lowers their sense of ownership; the delete right gives it back, and limiting
edits to the "less" direction is exactly the correction that optimism needs.

### `POST /v1/weekly-check`

```json
{ "answers": [{ "id": "w-1", "answer": "yes" }] }
```

The weekly check asks about execution only. It must not accept goal edits — see
`PATCH /v1/goal-tree/branches/{branchId}`. If four weeks in a twelve-week
quarter go unanswered, the server drops the cadence to monthly and records it as
a design mismatch, not a personal failure.

---

## 5 · Not in this API

Registration, multiple users and permissions; live OAuth connectors; social
accountability; on-chain staking. They are named in the specification and are
deliberately outside the MVP boundary. See
[`design/docs/01-solution.md`](../design/docs/01-solution.md) section 10.
