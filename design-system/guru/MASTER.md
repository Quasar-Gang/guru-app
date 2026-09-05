# Guru design system

## Direction

User preference: strong technology character, minimal composition. Use a near-black
canvas, cool cyan accents, quiet borders and restrained geometry. Typography and
task hierarchy carry the interface; avoid decorative glow, grids and motivational
filler. Keep Traditional Chinese product copy, with English only as optional small
section identifiers. Never require English to understand an action.

## Skill evidence

Source: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
Read `.claude/skills/ui-ux-pro-max/SKILL.md` and its reference checklists.
Ran `search.py 'habit tracker calm productivity' --design-system -p Guru`.
The playful clay style was not a fit. The narrower retry
`search.py 'productivity minimal' --design-system -p Guru` returned Flat Design,
supporting dark mode, typography-focused hierarchy and restrained transitions.
Use that structural guidance, with the user's cool dark palette taking precedence
over the suggested light palette. Keep Geist and the native Traditional Chinese
sans-serif fallback rather than adding a Latin-only font dependency.
The React `forms` search confirmed controlled inputs and semantic form submission.

## Tokens and rules

- Canvas #090c12; panels #111720; raised surface #17202c.
- Primary text #edf3fa; secondary text #a4b0c0; accent #7dd3fc.
- Base text 16px / 1.65. Supporting copy 14px; metadata no smaller than 12px.
- Headings 32–48px / 1.25, balanced wrapping, no aggressive Chinese tracking.
- Spacing 8 / 16 / 24 / 32 / 48; card radii 8–12px.
- Controls at least 44px high, visible keyboard focus, explicit disabled state.
- Use flat surfaces and borders; reserve shadow for the modal overlay.
- Respect reduced motion, text scaling, safe areas and narrow screens.
- User content wraps. Status is expressed in text as well as color.

## Product journey and acceptance criteria

| Story | User outcome | Backend authority | Required UI states |
| --- | --- | --- | --- |
| First visit | Understand the product and choose sign-in or a clearly labeled sample | `/v1/me` | Sample, connecting, signed in, retry |
| Define a goal | Enter a goal and availability without learning API terminology | Profile + plan sessions | Goal, optional context, validation, generating |
| Clarify | Answer only missing information without losing work | Session questions and answers | Required versus skippable, submitting, retry |
| Choose pace | Compare generated alternatives and activate one | Session plans + plan update | Draft, active, selecting, error |
| Act today | See task time, instructions and completion state | Plan tasks | Loading, empty, pending, done, missed, skipped |
| Review | Save today's outcomes and understand actual progress | Check-ins + plan progress | Saving, saved, no history, sample labels |
| Adapt | Preview future changes before applying | Revisions | Generating, proposed, accept, reject, error |
| Take the plan elsewhere | Export or synchronize with visible feedback | Exports + Google integration | Authorization, pending, ready, failed |
| Manage | Rename, archive or confirm deletion | Plan lifecycle | Saving, recoverable failure, empty collection |

## Completion audit

Implementation is in progress. A passing server render alone does not prove the
full journey. Validate the build, API contract and interactive states, then record
any hosting or live-backend limitations explicitly. Review all three main screens,
creation and settings, questions, comparison, revision and management dialogs.
