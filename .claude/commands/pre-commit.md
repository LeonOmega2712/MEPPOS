Pre-commit routine: code review, documentation check, and commit message generation.

Execute the following 3 phases in order. After each phase, wait for the user's decision before continuing to the next.

---

## Phase 1 — Code Review

1. Run `git diff HEAD` to see all uncommitted changes.
2. Review the changed files for:
   - Code that can be optimized or refactored (DRY violations, unnecessary complexity, duplicated logic)
   - Missing accessibility attributes, type safety issues, or potential bugs
   - Violations of project conventions (see CLAUDE.md)
3. Present findings as a concise list grouped by severity (High / Medium / Low). If nothing is found, say so.
4. Ask the user:
   - **Apply fixes** — implement the suggested improvements
   - **Skip** — move to Phase 2 without changes

---

## Phase 2 — Documentation Check

1. Read ALL project documentation files:
   - `README.md`
   - `CLAUDE.md`
   - `.claude/commands/project-instructions.md`
   - `.claude/commands/menu.md`
   - `.claude/commands/menu.mermaid.md`
   - `.claude/commands/Fase 1 - App Marisquería (Calculadora de Cuentas).md`
2. Compare against the actual codebase state (including any fixes applied in Phase 1):
   - Folder structures, API endpoints, tech stack versions
   - Phase checklists, code patterns, new features/components/pages
3. Report:
   - **Up to date** — files that need no changes (one line each)
   - **Needs update** — specific sections that are outdated and what they should say
4. Ask the user:
   - **Apply all** — update all outdated docs
   - **Pick files** — let the user choose which docs to update
   - **Skip** — move to Phase 3 without changes

---

## Phase 3 — Commit Message

1. Run `git diff HEAD` again (to capture any changes from Phase 1 and 2).
2. Run `git log --oneline -5` to match existing commit style.
3. Generate a single commit message that:
   - Starts with a past-tense verb (Added, Fixed, Updated, Simplified, Refactored, Improved, etc.)
   - Is as short as possible while remaining clear
   - Groups related changes with commas when needed
   - Matches the tone and style of the existing commit history
4. Output ONLY the commit message inside a code block for easy copy-paste.
5. Do NOT run `git add`, `git commit`, or any command that modifies the repository state.
