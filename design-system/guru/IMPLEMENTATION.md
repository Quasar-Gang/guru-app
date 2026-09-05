# Implementation audit

## Current evidence

The working tree implements the cool dark visual foundation, larger Chinese
typography, flatter surfaces, sample workspace disclosure, account entry point,
goal journey indicator, progressively disclosed optional context, semantic goal
form, hash navigation, persistent human-readable errors, modal focus isolation,
explicit required questions, chart value labels and an empty progress state.

`npm test` passes the language gate, production build and all three existing tests.
`npm run lint` and `npx tsc --noEmit` pass after adding the Cloudflare ambient
types and optional database binding declaration. The existing tests cover API request payloads, errors and the initial
server-rendered shell, not the full interactive journey.

## Required follow-through

- Styles were consolidated by removing 94 overridden declarations, applying a
  minimum 12px type scale, normalizing accent tokens and removing decorative
  gradients/shadows. Final responsive visual review remains outstanding.
- Verify sign-in loading and failure states cannot expose stale personal data as
  sample content. Add explicit loading states for task and plan switches.
- Plan collections now preserve other goals after generation. A selector switches
  plans, comparison loads the selected session, and draft activation is explicit.
  A mounted-app fixture test verifies switching between two existing goals,
  recovering a new session and activating its plan without changing either
  existing goal's active state.
- Generation offers a guarded progress recheck after polling stops. Question
  answers live above the modal and survive close/reopen. Generation and revision
  handles are stored per account and API origin in session storage; reload restores
  a recheck action. Storage failure is nonfatal and tested.
- Task, check-in, selection and lifecycle actions now share a submission guard.
  Rename applies only after success; deleting the final plan clears task state.
  Management, export and revision controls show pending feedback and disable
  repeated submissions. Expired authorization opens the account dialog.
- Revision proposals now retain their lookup handle after timeout and remain
  reopenable after closing. Every changed task is displayed, and decisions target
  the proposal's own plan even if the selected plan changes. Calendar exports
  have a persistent status panel backed by the durable export endpoint. Verify
  the export path against connected fixtures. The mounted-app revision test
  verifies all twelve changes remain visible, reopening works, and accepting
  after switching plans still targets the original revision plan.
- Verify responsive layouts and keyboard interactions at the requested scope;
  narrow server-render tests are not evidence of complete UI/UX verification.
- A new inspected social preview is wired as `public/og-tech.png`, with the old
  asset preserved. Use available hosting capability for delivery. No hosting
  connector is currently exposed in the tools inspected during this work.

The goal remains active. The full redesign is not yet claimed complete.

Navigation now uses Lucide icons. The production build, three existing tests,
language gate, TypeScript check and lint passed with these dependencies installed.

An additional JSDOM interaction test now mounts the actual app and exercises task
completion, check-in availability, plan/progress navigation, chart values, goal
form disclosure, background isolation, Escape and focus restoration. It exposed
and fixed a route-focus race plus autofocus capturing the wrong restore target.
This covers behavior, not visual layout or real Google authorization.

## Backend integration update

The user-supplied `docs-guru-api-integration.md` specifies fixed Google callback
paths and no CORS middleware. Both callback pages now exist, login uses the exact
`/oauth/callback` redirect URI and a per-flow state nonce, and `/api/guru` forwards
requests to the server-controlled upstream. Signed file URLs from that upstream
are rewritten through the proxy; unrelated Google authorization URLs are intact.
The supplied reference remains unchanged and is exempted from the source language
gate. A read-only request through the built proxy reached the running local
backend and returned its expected 401 error for a missing bearer token; `/health`
reported `ok`. This proves transport, not a complete authenticated user journey.

Current verification: eleven tests, production build, TypeScript, lint and
`git diff --check` all pass. Desktop/mobile browser QA approval is pending under
the Sites skill's explicit-request requirement. Calendar context currently only
connects authorization; verify importing context and draft preservation across
that redirect before treating the goal creation journey as fully complete.

## Social asset

Built-in imagegen produced `public/og-tech.png`. Inspected text is correct.
Prompt: "Minimal high-tech guru social preview; near-black #090c12, navy #111720,
ice-blue #7dd3fc, white #edf3fa; generous margins and three outlined plan cards;
exact brand and Traditional Chinese headline/subtitle from the current product;
no people, robots, fake statistics or extra text." Exact product copy is retained
in `app/layout.tsx` and the asset. The original `public/og.png` is preserved.
