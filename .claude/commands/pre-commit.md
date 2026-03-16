Pre-commit routine: issue verification, code review, documentation check, and commit message generation.

Execute the following 4 phases in order. After each phase, wait for the user's decision before continuing to the next.

---

## Phase 0 — Issue Context

1. Run `git branch --show-current` to identify the current branch.
2. Extract the issue number from the branch name (e.g., `18-refactor-repository-cleanup` → issue `#18`).
3. If an issue number is found, run `gh issue view <number>` to fetch its title, description, and acceptance criteria.
4. Display a summary of:
   - **Branch:** current branch name
   - **Issue:** title and number (or "No linked issue" if not found)
   - **Checklist:** acceptance criteria or task list from the issue body (if any)
5. This context will be used in Phase 1 (to verify changes align with the issue) and Phase 3 (to reference the issue in the commit message).

---

## Phase 1 — Code Review & Issue Alignment

1. Run `git diff HEAD` to see all uncommitted changes.
2. Review the changed files for:
   - Code that can be optimized or refactored (DRY violations, unnecessary complexity, duplicated logic)
   - Missing accessibility attributes, type safety issues, or potential bugs
   - Violations of project conventions (see CLAUDE.md)
3. If an issue was identified in Phase 0, verify:
   - Which acceptance criteria or checklist items are addressed by the current changes
   - Whether any criteria are partially addressed or missing from the changes
   - Flag any changes that seem unrelated to the issue scope
4. Present findings as a concise list grouped by:
   - **Issue alignment** — criteria met, partially met, or not addressed (only if an issue was found)
   - **Code quality** — grouped by severity (High / Medium / Low)
   - If nothing is found in either category, say so.
5. Ask the user:
   - **Apply fixes** — implement the suggested improvements
   - **Skip** — move to Phase 2 without changes

---

## Phase 2 — Documentation Check

1. Read ALL project documentation files:
   - `README.md`
   - `CLAUDE.md`
   - `.claude/docs/project-instructions.md`
   - `.claude/docs/menu.md`
   - `.claude/docs/menu.mermaid.md`
   - `.claude/docs/phases/Fase 1 - App Marisquería (Calculadora de Cuentas).md`
   - `.claude/docs/phases/Fase 2 - App Marisqueria (Registro de Cuentas).md`
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
