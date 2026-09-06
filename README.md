# guru web

A coach that tracks a life goal the way a fitness coach tracks a body: measure
the current state, diagnose the weak spot, write the next cycle's prescription —
once a quarter.

It asks the user to record **nothing**. It reads the traces they already leave —
calendar, notes, résumé, health, work systems — books them against the branches
of a goal tree, and reports four outcomes. The fourth is the one that matters:

> **Action happened, the retest did not move.** Every other tracker shows that
> state as green.

The product does not claim an action works. Proving "this goal needs this
action" takes a control group and several years. It only makes *doing without
effect* visible.

---

## The three stations

| Route | Station | What it is | What it decides |
|---|---|---|---|
| `/` | 1 · direction hypothesis | Input and confirmation | How long, what traces exist, which capability the user wants, and how that squares with what they actually did |
| `/plan` | 2 · goal tree draft | A plan awaiting sign-off | The four elements per branch, the effect hypothesis, the falsification condition, and which three branches get a slot |
| `/ledger` | 3 · quarterly reconciliation | A report | The four booking outcomes, the four diagnostic criteria, next quarter's anchors, and a delete-only weekly draft |

Each station takes a different form on purpose — cards, outline, table. Shared
tokens make them one product; different forms make them different screens.

Every number in station 3 is computed by the engine from the trace set in
[`lib/mock/snapshot.ts`](lib/mock/snapshot.ts). Nothing in the ledger is a
typed-in result, so changing a rule changes the report.

---

## Architecture

```
app/
  layout.tsx                 Root shell. Loads the design system in fixed order
  page.tsx                   Station 1  →  components/intake/
  plan/page.tsx              Station 2  →  components/plan/
  ledger/page.tsx            Station 3  →  components/ledger/
  components/StationShell    Surface stack: page → shell → app → card
  styles/                    Vendored mist design system + one extension layer
lib/
  contracts.ts               The domain types. Also the API contract
  horizon.ts                 Horizon → quarters, retest schedule, slot cap
  attribution.ts             Keyword → branch rule table, and the booker
  reconcile.ts               Four outcomes + the four diagnostic criteria
  scheduler.ts               Weekly draft: load, ceiling, chain breaks
  dispatch.ts                Gap dispatch decision
  role-model.ts              Capability → retestable metric, shape, cost
  api/guru-core-types.ts     Wire types, transcribed from guru-core's OpenAPI
  api/guru-core.ts           The HTTP client for guru-core
  api/snapshot-adapter.ts    The only place the two vocabularies meet
  api/client.ts              loadSnapshot() — what the pages call
  mock/snapshot.ts           The demonstration dataset, and the fallback
docs/API.md                  How the two map, and what does not
design/                      Specification and prototypes. Source of truth
tests/                       Engine tests and a server-render smoke test
```

**Pages are presentation over the engines.** Every rule that could be argued
about — how a trace is booked, when a branch counts as stalled, when a schedule
breaks a chain — lives in `lib/` as a pure function with a test, not inside a
component. That is why the pages carry no business logic and the tests need no
DOM.

### The data flow

```
traces ──▶ attribution.ts ──▶ reconcile.ts ──▶ diagnose() ──▶ station 3
              (rule table)      (4 outcomes)     (4 criteria)
```

The attribution rules are exported as data and rendered on the page. A booking
the user cannot see the reason for is a booking they cannot dispute.

---

## Design system

The UI is [mist](design/ui-kit/ui/STYLE.md), vendored into `app/styles/`.

- **`app/styles/mist.tokens.css` and `mist.components.css` are read-only.** They
  are copied from the design system and get overwritten on update. Never edit
  them; re-copy from `design/ui-kit/ui/` instead.
- **Pages carry classes, never styles.** No `style={{ … }}`, no `<style>`, no
  hard-coded colours or sizes. The four data channels
  (`--mist-progress-value`, `--mist-stem`, `--mist-bar`, `--mist-arc`) are the
  only inline custom properties allowed.
- **`app/styles/mist.extensions.css` is tracked debt.** Mist ships no Table and
  no segmented control, and station 3 is a report. The two live there, built from
  mist tokens only. The repayment path is in the file header.

Four constraints that get violated most often: colour is an accent only (nine
tenths of the screen is grey/white/black); depth comes from the surface
brightness ladder, never a shadow; type sizes jump levels inside a block rather
than sitting adjacent; a chart mark's width comes from a token, never `flex: 1`.

---

## Tone

Three rules every sentence on a page has to pass. They are product decisions,
not copy preferences.

1. **Take stock, don't judge.** A coach whose diagnosis is accurate and whose
   tone is a verdict just gets switched off.
2. **Doubt the goal by default.** Seeing a branch fall behind, the right
   response is often "drop it", not "try harder".
3. **Never promise what software cannot do.** No causal proof — only making
   "done, but no effect" visible.

Vocabulary follows accounting: reconcile, book, ledger, audit, assessment,
prescription, anchor. That is the language of the judgement layer, and the
judgement layer is the difference from a habit tracker. **The words
check-in, habit and streak must not appear on a main-line page.**

---

## Getting started

Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` may stay empty — the app then renders the built-in demonstration
dataset with every interaction live. To read from a running
[`guru-core`](../guru-core), set both values:

```dotenv
GURU_API_BASE_URL=http://127.0.0.1:8000
GURU_API_TOKEN=<from POST /v1/auth/google>
```

Both are **server-side only**. The bearer token carries no `NEXT_PUBLIC_` prefix
because that would ship it to the browser; `vite.config.ts` passes it to the
Worker as a var, and every station reads its data in a server component. In a
real deployment it is a Worker secret rather than a var.

Anything that is not an absolute `http(s)` origin is ignored and the fixture is
used, because a relative path cannot be fetched during server rendering and a
silent half-failure would look like the backend answered.

### What comes from the backend

guru-core owns the loop: it reads the uploads, scores every shape with five cited
evidence items, writes the append-only hypothesis, generates the plan, and holds
the quarter against what it predicted. This app maps that onto the three
stations, section by section, and keeps the fixture wherever guru-core has no
concept — the capability retest, anchors, the alternative paths, the coach's
challenges. Those gaps are named rather than filled in, in
[`docs/API.md`](docs/API.md).

Every read falls back on its own and logs the failure, so one unavailable section
never blanks a page. The assembled snapshot is held for 30 seconds because
guru-core rate-limits at 60 requests a minute and one render costs eleven reads.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on Cloudflare Workers runtime |
| `npm run build` | Production build (`dist/`) |
| `npm start` | Serve the production build |
| `npm test` | Language check → typecheck → lint → build → tests |
| `npm run test:unit` | Vitest only |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:language` | Enforces the English-only rule below |

### Tests

`tests/engine.test.ts` covers the claims: the four booking outcomes, the anchor
gap, the chain-break warning, the dispatch decision and the horizon scale.
`tests/adapter.test.ts` covers the backend mapping against payloads shaped like
the ones guru-core returned during integration — including the two cases live
data broke first: a task hanging off a leaf milestone, and a plan starting
tomorrow.
`tests/render.test.ts` boots the built Worker bundle and checks each station
server-renders; it skips when `dist/` is absent, so `vitest` stays useful mid-edit.

### Language rule

The product interface is Traditional Chinese; the project is English. Han
characters are allowed only in the display components under `app/` and the
fixture modules that hold that copy — and never in a comment, even there.
Everything else, including this README, is English. `npm run check:language`
enforces it and the vendored design system is exempt.

## Deployment

React 19 + Next 16 through [vinext](https://www.npmjs.com/package/vinext), built
to Cloudflare Worker-compatible ESM. The Worker entry is `worker/index.ts`;
`.openai/hosting.json` carries the hosting bindings.

---

## Known limits

Honest about what the shell does not do, because the specification is:

- **No sign-in.** The token is configured server-side; there is no login screen,
  so the app reads one account. Adding OAuth is a workflow, not a field.
- **No `noEffect` row against live data.** guru-core models no capability
  retest, and without two measurements there is nothing to compare. Faking one
  would fake the single outcome this product exists to show.
- **Every live branch reads as an anchor gap**, because guru-core models no
  anchors. The criterion is working; the prescriptions beside it are fixture.
- **Vision and the five-year layer are empty.** Intake produces a one-year
  hypothesis and cannot reach them. They render as "not covered this period".
- **Money flow has no source.** Credit-card statements are out of scope, so the
  dispatch cash axis is declared by the user, and the page says so.
- **The constraint criterion is disabled.** It needs two to three quarters of
  history. It is shown as unavailable rather than hidden.
- **Only the sign-off persists.** Accepting the draft activates the plan
  upstream; deletions and the weekly proofread are frontend state.
- **Without a backend everything is the fixture** — import screens are static,
  attribution runs the keyword table, and the shape suggestions are pre-written.

## Licence

Proprietary. See [LICENSE](LICENSE).
