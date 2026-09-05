# design/ — mist design system + the station-1 prototype

This folder holds the **project-side copy** of the `mist` design system and the source of the
onboarding prototype that is served from `public/prototypes/01-intake.html`.

It is plain HTML and CSS. No build step, no dependencies, nothing to install.

## Layout

| Path | What it is | Editable |
|---|---|---|
| `ui/` | Design-system copy: tokens, components, specs | **No — read-only** |
| `pages/` | Prototype pages. `01-intake.html` is the live one | Yes |
| `local-overrides.css` | Pressure valve. The only file in here that may declare styles | Yes, but it is tracked as debt |
| `scripts/`, `check.sh`, `serve.py` | Preview and lint tooling | No |

## Four rules

1. **`ui/` is overwritten wholesale** whenever the design system updates. Never edit it — your
   changes would be silently lost on the next update.
2. **Pages carry classes only.** No `<style>` blocks, no `style="color: …"`, no hard-coded colors
   or sizes. The one exception is passing data into a component through the three documented
   custom properties (`--mist-progress-value`, `--mist-stem`, `--mist-bar`).
3. **Missing a component? Do not write one here.** Check `ui/COMPONENTS.md` first; if it is really
   missing, it gets added to the design system upstream and `ui/` is re-copied.
4. **Out of time?** Put it in `local-overrides.css` — the only file here allowed to declare styles.
   `./check.sh` will list every rule in it as outstanding debt.

## Working on it

```bash
# preview
python3 serve.py . 8747      # then open http://localhost:8747/pages/01-intake.html

# component reference, every state of every component
#   http://localhost:8747/ui/reference.html

# lint: hard-coded colors and sizes, inline styles, page-level style rules,
#       references to tokens that do not exist, unreturned overrides
./check.sh

# regenerate the single file that ships in public/
python3 scripts/inline_page.py pages/01-intake.html ../public/prototypes/01-intake.html --standalone
```

`public/prototypes/01-intake.html` is **generated output** — it inlines `ui/*.css` into one
self-contained document so it can be served without any asset paths. Do not hand-edit it;
edit `pages/01-intake.html` and regenerate.

## Two things to know before you review this

- **The prototype content is in Traditional Chinese.** It is the hackathon demo script, presented
  in Chinese, so the copy was written that way. This conflicts with the repo's English-only
  convention — flagging it rather than quietly breaking the rule. Say the word and it gets
  translated or moved out.
- **The top navigation links to stations 2 and 3 point at published Claude artifacts**, not at
  anything in this repo. They are the other two screens of the same demo flow.
