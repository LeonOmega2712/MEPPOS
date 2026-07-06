Create a local git worktree + branch in `.trees/` for one requirement of the issue being worked on — the caller invokes this once per requirement (splitting the issue manually), and this skill only determines the branch name and creates the worktree.

**Argument:** `$ARGUMENTS` — the single requirement (a slice of the current issue) this worktree is for.

---

## Phase 0 — Resolve Issue Context

1. Run `git branch --show-current`.
2. Extract the issue number from the branch name using the repo convention `<type>/<issue-number>-<kebab-title>` (e.g. `feat/48-orders-core-schema-migration` → `48`).
3. If no issue number can be extracted (e.g. on `master` or a non-conventional branch name), ask the user for the issue number before continuing — do not guess, per CLAUDE.md.
4. If it would help disambiguate the branch/slug (e.g. the requirement text is terse or its relation to the issue isn't obvious), run `gh issue view <issue-number>` for title/body context. Skip this call when the requirement is already self-explanatory.
5. Determine the branch type (`feat`/`fix`) the same way as other repo commands: infer from the issue label/title or the requirement wording itself; ask if ambiguous.

---

## Phase 1 — Determine Name & Create the Worktree

1. Derive a short kebab-case slug (3-5 words) from `$ARGUMENTS` describing the requirement.
2. Build the branch name: `<type>/<issue-number>-<kebab-slug>`.
3. Check for collisions: `git branch --list <name>` and `git worktree list`. If the name is already taken, disambiguate the slug (do not silently overwrite or reuse).
4. The worktree path is `.trees/<kebab-slug>` (relative to the repo root). Create the `.trees/` directory if it doesn't exist yet — it should be gitignored; if it isn't already in `.gitignore`, add it before creating the first worktree.
5. Base ref: the **current branch** (the issue's branch already checked out), since this worktree is a sub-slice of the work already in progress here, not a fresh branch off `master`. Only ask the user if the current branch is `master` or otherwise clearly doesn't fit that assumption.
6. Run: `git worktree add -b <branch-name> .trees/<kebab-slug> <base-ref>`
7. Confirm with `git worktree list`.

Never reuse an existing worktree path or branch name without asking first. Do not dispatch an agent or take any further action — creating the worktree is the entire scope of this skill; the caller decides what to do with it next.

---

## Phase 2 — Report

State the branch name and worktree path created, and remind the user they can `cd .trees/<kebab-slug>` to work there, and remove it later with `git worktree remove .trees/<kebab-slug>` once merged.
