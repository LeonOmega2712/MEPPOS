Prepare a pull request end-to-end: branch verification, issue context, code review, documentation check, commit message generation, and guided commit/push/PR creation.

Execute the following phases in order. After each phase, wait for the user's decision before continuing to the next.

**Auto-advance rule (applies to every phase):** if a phase completes and finds nothing that requires user intervention, confirmation, or correction (no ambiguous issue, no branch switch needed, no code-quality or alignment findings, no outdated docs), report the clean result in one line and continue to the next phase automatically — do not ask "proceed?" when there is nothing to decide. This rule does **not** apply to Phase 3's commit / push / PR steps, which always require explicit confirmation by design.

---

## Phase 0 — Branch Verification & Issue Context

1. Run `git branch --show-current` to identify the current branch.
2. Run `git status` and `git diff HEAD` to see the working-tree changes (needed to infer the issue if the branch does not hint at one).
3. **Identify the issue for the current changes:**
   - First, try to extract an issue number from the branch name (e.g., `feat/3-swr-caching-settings-tabs` → `#3`, `fix/35-navbar-login-auth-race-condition` → `#35`).
   - If an issue number is found, run `gh issue view <number>` and use it.
   - If no issue is encoded in the branch name (e.g., on `master` or a generically-named branch), run `gh issue list --state open` and compare each issue's title/body against the diff to infer the most likely match. Then:
     - If there is a confident match, present the inference (`I believe these changes address issue #N — "<title>". Confirm?`) and wait for the user.
     - If there is no confident match, ask the user which issue these changes address (or to confirm there is no issue).
   - If the user confirms there is no existing issue but one should exist, offer to create it with `gh issue create --assignee @me --milestone "<active-milestone>"` (see step 4 in Phase 3 for how to resolve the active milestone). Wait for confirmation before creating.
4. **Verify the current branch is correct for that issue:**
   - If the current branch already encodes the confirmed issue number, the branch is correct — proceed to step 5.
   - If the current branch does **not** match the confirmed issue (including being on `master` or on a branch for a different issue):
     - Determine the base branch. Default to `master`, but if the current branch has commits ahead of `master` and the new issue is a sub-task or follow-up of the work on the current branch, ask the user whether the new branch should be based on the current branch instead of `master`.
     - Generate a branch name following the repo convention: `<type>/<issue-number>-<kebab-title>` where `<type>` is `feat` for features/enhancements or `fix` for bug fixes (infer from the issue labels or title; if ambiguous, ask).
     - Present the proposed branch name and base, and ask the user to confirm or edit.
     - On confirmation, carry the working-tree changes to the new branch:
       1. `git stash push -u -m "prepare-pr carry"` (include untracked files).
       2. `git checkout <base-branch>` and `git pull --ff-only` to be up to date.
       3. `git checkout -b <new-branch>`.
       4. `git stash pop`.
     - Resolve any stash-pop conflicts before continuing. Never use destructive flags.
5. Display a summary of:
   - **Branch:** current branch name (after any switch in step 4)
   - **Issue:** title and number (or "No linked issue" if the user confirmed there is none)
   - **Checklist:** acceptance criteria or task list from the issue body (if any)
6. This context will be used in Phase 1 (to verify changes align with the issue) and Phase 3 (to reference the issue in the commit message and PR).

**Never commit or push to `master` directly.** If at the end of step 4 the branch is still `master`, stop and ask the user before proceeding.

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
5. If there are findings in either category, ask the user:
   - **Apply fixes** — implement the suggested improvements
   - **Skip** — move to Phase 2 without changes

   Otherwise, apply the auto-advance rule and continue to Phase 2.

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
4. If there are outdated sections, ask the user:
   - **Apply all** — update all outdated docs
   - **Pick files** — let the user choose which docs to update
   - **Skip** — move to Phase 3 without changes

   Otherwise, apply the auto-advance rule and continue to Phase 3.

---

## Phase 3 — Commit Message, Commit, Push, Pull Request

1. Run `git diff HEAD` again (to capture any changes from Phase 1 and 2).
2. Run `git log --oneline -5` to match existing commit style.
3. Generate a single commit message that:
   - Starts with a past-tense verb (Added, Fixed, Updated, Simplified, Refactored, Improved, etc.)
   - Is as short as possible while remaining clear
   - Groups related changes with commas when needed
   - Matches the tone and style of the existing commit history
   - **Never** includes `Co-Authored-By` or any AI signature.
4. Resolve the **active milestone** for new issues/PRs by running `gh api "repos/{owner}/{repo}/milestones?state=open" --jq '.[0].title'` (there is normally one open milestone corresponding to the current phase). Cache the title for reuse below. If none is open, ask the user which milestone to use or whether to skip.
5. Output the commit message inside a code block so the user can review it.
6. **Ask the user, one step at a time, and wait for confirmation between each:**
   1. **Create the commit?** — on yes, `git add` the relevant files explicitly (do not use `git add -A` or `git add .`) and run `git commit -m "<message>"`. Do not amend.
   2. **Push to `origin`?** — on yes, `git push -u origin <current-branch>`. Refuse if the current branch is `master`.
   3. **Open the pull request?** — on yes, run:
      ```
      gh pr create \
        --base master \
        --head <current-branch> \
        --assignee @me \
        --milestone "<active-milestone-title>" \
        --title "<short title derived from commit message>" \
        --body "$(cat <<'EOF'
      ## Summary
      <1–3 bullets describing the change, derived from the diff>

      ## Test plan
      - [ ] <relevant verification step>

      Closes #<issue-number>
      EOF
      )"
      ```
      - Omit `Closes #N` if there is no linked issue.
      - No `Co-Authored-By` or AI signature in the body.
      - Return the PR URL when done.
7. If the user declines any step, stop there and report the current state (committed but not pushed, pushed but no PR, etc.).

---

## General rule for issues and PRs

Any issue or pull request created by this command (or as a side effect of it) must be created with `--assignee @me` and `--milestone "<active-milestone-title>"` so it is assigned to the user and tied to the current phase milestone.
