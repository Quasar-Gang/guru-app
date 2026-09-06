# Backend integration

This app renders one `CoachingSnapshot`. `guru-core` speaks a different
vocabulary — direction runs, fit verdicts, hypotheses, plans, reconciliations.
This document is the map between them, and the honest list of what does not map.

**guru-core's implementation is the authority.** The reference for the API
itself lives in that repository — [`docs/api/README.md`](../../guru-core/docs/api/README.md)
for the call sequences and `docs/api/openapi.json` for the exhaustive spec. When
this document and the running backend disagree, the backend is right.

| Our file | Role |
|---|---|
| [`lib/api/guru-core-types.ts`](../lib/api/guru-core-types.ts) | Wire types, transcribed from the exported OpenAPI document |
| [`lib/api/guru-core.ts`](../lib/api/guru-core.ts) | The HTTP client: auth, the error envelope, one method per route we read |
| [`lib/api/snapshot-adapter.ts`](../lib/api/snapshot-adapter.ts) | The only place the two vocabularies meet |
| [`lib/api/client.ts`](../lib/api/client.ts) | `loadSnapshot()` — what the pages call |

## Configuration

Server-side only. The bearer token must never reach the browser, so it carries no
`NEXT_PUBLIC_` prefix; `vite.config.ts` passes both values to the Worker as vars,
and every station reads its data in a server component.

```dotenv
GURU_API_BASE_URL=http://127.0.0.1:8000
GURU_API_TOKEN=<from POST /v1/auth/google>
```

Leave either empty and the app renders the demonstration fixture with every
interaction intact. That is the demo path, not a broken state.

## What the app reads

Eleven reads per snapshot, nine of them concurrent:

| Call | Feeds |
|---|---|
| `GET /v1/profile` | The horizon anchor and the trace count |
| `GET /v1/imports` · `GET /v1/integrations` | The four import rows' status and detail |
| `GET /v1/questions` | Station 1's question set |
| `GET /v1/quota` | The weekly capacity the draft may spend |
| `GET /v1/role-models` | Each shape's vision, path, accumulation and cost |
| `GET /v1/direction/runs/latest` | The shape cards, the cross-check, the unclassified row |
| `GET /v1/hypotheses` | The goal tree's version and review date |
| `GET /v1/plans` → `GET /v1/plans/{id}` | The branches |
| `GET /v1/plans/{id}/tasks` | Bookings, the weekly proofread, the schedule draft |

guru-core rate-limits at 60 requests a minute, so the assembled snapshot is held
for 30 seconds and shared across the three stations. Nothing on these pages
changes faster than that; the product's own cadence is a quarter.

Every read falls back on its own and logs the failure. One section being
unavailable must not blank the page, and a silent partial fallback is the worst
kind because the page still looks right.

## What the app writes

One call. **Accept and lock this quarter** → `PUT /v1/plans/{id}/status`
`{"status": "active"}`. A plan is started or archived, never edited into
something else; wanting a different plan means wanting a different hypothesis.

Nothing else on these pages writes, because nothing else has an affordance that
maps one to one onto a guru-core route. In particular the app never calls
`POST /v1/hypotheses`: a hypothesis is append-only, and firing one from a
navigation link would write a version every time somebody clicked through.

## The mapping

### Station 1 · direction

| Ours | guru-core | Note |
|---|---|---|
| `shapes[].id` / `.name` | `verdicts[].role_model_code` / `_name` | |
| `shapes[].lede` | `role_models[].vision` | |
| `shapes[].yearLooksLike` | `role_models[].five_year_path` | |
| `shapes[].accumulates` | `role_models[].must_accumulate` | |
| `shapes[].cost` | `verdicts[].cost` | `NOT NULL` upstream; a blank one is rejected in the domain |
| `shapes[].evidence[]` | `verdicts[].evidence[]` | Exactly five, at least one of each stance, every one citing a report in this run — validated before the row is written |
| `shapes[].fitLabel` | `verdicts[].fit` | Six-value enum → badge |
| `crossChecks[].verdict` / `.narrative` | `verdicts[].verdict` / `.note` | |
| `crossChecks[].items[].mark` | `evidence[].stance` | `for` → supports, `against` → missing |
| `crossChecks[].test` / `.cost` | `verdicts[].probe.statement` / `.cost` | One cheap test per verdict, sized to a quarter |
| `baselineQuestions[]` | `GET /v1/questions` | Three, each stating its purpose, each skippable |
| `imports[].status` | `imports[].status` + `integrations[].connected` | The copy stays ours; only status and detail come over the wire |

### Station 2 · the goal tree

| Ours | guru-core |
|---|---|
| `goalTree.version` | `hypotheses[-1].version` |
| `goalTree.lockedUntil` | `hypotheses[-1].review_date` |
| `branches[]` | Top-level `milestones[]` |
| `branches[].quarterIndicator` | `milestones[].metric` |
| `branches[].unitAction` · `durationMin` · `energy` | The milestone's first task: `title`, `duration_minutes`, `task_type` |
| `branches[].minWeekly` | Habit tasks in their busiest week |
| `branches[].type` | `cumulative` when the milestone has habit tasks, `project` when it has any, `undefined` when it has none |
| `branches[].progressPercent` | Done tasks over its tasks |

A milestone with no tasks arrives with no unit action, which the page already
renders as "missing the four elements, cannot be scheduled". That is the right
answer, not a hole.

### Station 3 · the ledger

Milestones nest and tasks do not, so a task hangs off whichever milestone owns
it — often a leaf. Bookings climb back to the root, or every branch would read as
zero action while its children carried the work.

| Ours | guru-core |
|---|---|
| `traces[]` | Tasks with `status: done` |
| `attributions[]` | `task → milestone → root branch`, already booked upstream |
| `results[].status` `active` / `dormant` | Whether the branch has completed tasks |
| `results[].status` `unattributed` | The `unclassified` report's `metrics` |
| `period.autoAttributionRate` | `1 − unclassified.share` |
| `period.daysToQuarterBoundary` | Days to `hypotheses[-1].review_date` |
| `weeklyCheck[]` | The last seven days of tasks, phrased as proofreading |
| `schedule.slots[]` | The next seven days of tasks |
| `schedule.capacityHours` | `quota.weekly_minutes` |

The keyword rule table is **not** used against live data. guru-core has already
booked the work; re-attributing an attributed row through a guess would be worse,
not better. The table still runs the fixture, and the page still shows it,
because it is the first version of the rule a backend attribution pass would use.

## What does not map, and stays a fixture

Named rather than quietly filled in:

| Missing | Consequence |
|---|---|
| **Capability retest** — no baseline, no retest | **No `noEffect` row can appear against live data.** Without two measurements there is nothing to compare, and faking one would fake the single outcome this product exists to show |
| **Anchors** | Every live branch reads as an anchor gap. That is the criterion working, not a mapping shortcut; the anchor prescriptions stay fixture |
| **Alternative paths** | The standing control group has no backend home, so the attractiveness sliders are local |
| **Coach challenges** | The three questions the coach cannot answer are fixture. `structure.assumptions[]` is the nearest thing upstream, but an assumption is not a question |
| **Role-model free text** | guru-core scores a catalogue; it takes no "I want X's Y" input |
| **Apple Health** | No importer upstream, so the row reads "not connected" |
| **Horizon** | guru-core sizes by `duration_weeks` and `review_date`. Only the anchor date is live; the quarters and the retest schedule stay arithmetic here |
| **Reconciliation narrative** | `POST /v1/reconciliations` exists and is read-ready, but opening a review is a write with a decision attached, and no control on these pages asks for one |

`SnapshotOrigins` records which sections were live for each read and is logged
once per snapshot, so a partial fallback is visible in the server log rather than
inferred from the page.
