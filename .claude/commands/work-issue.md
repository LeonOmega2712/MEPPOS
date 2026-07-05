Start work on an issue end-to-end: resolve scope (from an issue number or a freeform description), create and check out the branch, gather context from project docs, then enter plan mode to design the solution.

**Argument:** `$ARGUMENTS` — either a bare issue number (e.g. `57`) or a freeform description of the scope to address.

---

## Phase 0 — Resolve Scope & Issue Context

1. Inspect `$ARGUMENTS`:
   - **If it is purely a number** (e.g. `57`, `#57`): run `gh issue view <number>` to fetch title, body, labels, and milestone. This is the issue to work on.
   - **Otherwise** (freeform text): treat it as the scope description directly. If the text itself references an issue number (e.g. "fix #42: ..."), also run `gh issue view 42` and merge that context with the freeform description.
   - If a referenced issue number does not exist, tell the user and stop.
2. Display a short summary before continuing:
   - **Issue:** number + title (or "No linked issue — freeform scope" if none)
   - **Scope:** the acceptance criteria / checklist from the issue body, or the freeform description given
3. If the scope is too vague to design a solution (missing acceptance criteria, ambiguous behavior, no clear boundaries), ask the user before proceeding — per CLAUDE.md, assumptions on missing critical information are not allowed.

---

## Phase 1 — Branch Setup

1. Run `git status` and `git diff HEAD`. If there are uncommitted changes, stash them: `git stash push -u -m "work-issue carry"` (never discard without stashing first).
2. Determine the base branch (default `master`). Checkout it and update: `git checkout master && git pull --ff-only`.
3. Infer the branch type from issue labels/title or scope wording: `feat` for features/enhancements, `fix` for bug fixes. Ask the user if ambiguous.
4. Generate the branch name following repo convention: `<type>/<issue-number>-<kebab-title>` (omit the number segment if there is no linked issue).
5. Present the proposed branch name and ask the user to confirm or edit it.
6. On confirmation: `git checkout -b <branch-name>`. If changes were stashed in step 1, run `git stash pop` and resolve any conflicts (never use destructive flags).

**Never create the branch off anything other than an up-to-date base without asking first.**

---

## Phase 2 — Gather Context

1. Read the relevant project docs to ground the design:
   - `CLAUDE.md`
   - `.claude/docs/project-instructions.md`
   - `.claude/docs/menu.md`
   - `.claude/docs/menu.mermaid.md`
   - `.claude/docs/phases/Fase 1 - App Marisquería (Calculadora de Cuentas).md`
   - `.claude/docs/phases/Fase 2 - App Marisqueria (Registro de Cuentas).md`
2. Identify existing code relevant to the scope (use the `Explore` agent for broad searches, or direct `grep`/`Read` for known files).
3. Note any conventions, hard rules, or architectural patterns from the docs that constrain the solution (SOLID/DRY, i18n, CSS in separate files, Windows/macOS compatibility, etc.).

---

## Phase 3 — Plan the Solution

1. Call `EnterPlanMode`.
2. Draft an implementation plan grounded in the issue/scope, the docs read in Phase 2, and the current codebase state (never assume an intermediate or outdated state).
3. If any critical detail is still missing to design correctly, ask the user before finalizing the plan — do not guess.
4. Present the plan via `ExitPlanMode` for approval before writing any code.
