Prepare a pull request end-to-end with stricter repo-specific review gates: branch verification, issue context, scoped code review, targeted documentation validation, commit message generation, and guided commit/push/PR creation.

Execute the following phases in order. After each phase, wait for the user's decision before continuing to the next.

**Auto-advance rule (applies to every phase):** if a phase completes and finds nothing that requires user intervention, confirmation, or correction (no ambiguous issue, no branch switch needed, no review findings, no outdated docs, no milestone ambiguity), report the clean result in one line and continue to the next phase automatically. This rule does **not** apply to Phase 3's commit / push / PR steps, which always require explicit confirmation by design.

---

## Phase 0 — Branch Verification, Issue Context, Milestone Context

1. Run `git branch --show-current`, `git status --short`, `git diff --stat HEAD`, and `git diff HEAD` to identify the current branch and working-tree scope.
2. Identify the issue for the current changes:
   - First, try to extract an issue number from the branch name (for example `feat/53-order-rounds` → `#53`).
   - If an issue number is found, run `gh issue view <number>` and verify the issue title/body roughly match the diff. Do not trust branch naming alone.
   - If no issue is encoded in the branch name, run `gh issue list --state open` and compare issue titles/bodies against the diff.
   - If there is a confident match, present the inference and wait for the user to confirm.
   - If there is no confident match, ask the user which issue these changes address or whether there is intentionally no issue.
3. Resolve the milestone context now, not later:
   - If an issue was identified and it already has a milestone, use that milestone.
   - Otherwise, list open milestones with `gh api "repos/{owner}/{repo}/milestones?state=open"` and choose the matching phase milestone by title.
   - If only one open milestone exists, use it.
   - If multiple plausible milestones exist, present the options and ask the user to choose.
   - Cache the resolved milestone title for any issue or PR created later in this command.
4. If the user confirms there is no existing issue but one should exist:
   - Propose a concise issue title derived from the diff.
   - Create it only after confirmation with `gh issue create --assignee @me --milestone "<resolved-milestone-title>"`.
5. Verify the current branch is correct for the confirmed issue:
   - If the current branch already encodes the confirmed issue number and its scope matches the diff, the branch is correct.
   - If the current branch does not match the confirmed issue, determine the base branch:
     - Default to `master`.
     - If the current branch has commits ahead of `master` and the new issue is clearly a follow-up or sub-task of that work, ask whether the new branch should be based on the current branch instead.
   - Generate a branch name following the repo convention: `<type>/<issue-number>-<kebab-title>`.
   - Present the proposed branch name and base, and ask the user to confirm or edit.
   - On confirmation, carry the working-tree changes to the new branch:
     1. Confirm whether the user intentionally has partially staged changes.
     2. If needed, `git stash push -u -m "prepare-pr-codex carry"`.
     3. `git checkout <base-branch>`.
     4. `git pull --ff-only`.
     5. `git checkout -b <new-branch>`.
     6. `git stash pop`.
   - Resolve any stash-pop conflicts before continuing. Never use destructive flags.
6. Display a summary of:
   - **Branch:** current branch name
   - **Issue:** title and number, or `No linked issue`
   - **Milestone:** resolved milestone title, or `None`
   - **Checklist:** acceptance criteria or task list from the issue body, if any
7. This context must be reused in Phase 1 and Phase 3.

**Never commit or push to `master` directly.** If at the end of this phase the branch is still `master`, stop and ask the user before proceeding.

---

## Phase 1 — Code Review, Test Impact, Issue Alignment

1. Run `git diff --stat HEAD`, `git diff HEAD`, and review every changed file intentionally.
2. Classify each changed file by concern:
   - frontend UI or routing
   - frontend API integration
   - backend API or auth
   - data model or schema
   - tests
   - docs or config
3. Review the changes with repo-specific gates, not generic style checks only:
   - **Correctness / regression risk:** logic bugs, broken flows, unsafe assumptions, error handling gaps, auth/security risks, missing edge cases
   - **Issue alignment:** which acceptance criteria are met, partially met, missing, or contradicted
   - **Test coverage impact:** whether existing tests cover the change, whether new tests are required, and whether changed behavior can regress silently
   - **Convention compliance:** rules from `CLAUDE.md` and `.claude/docs/project-instructions.md`
4. Apply mandatory repo-specific checks:
   - If frontend behavior or routing changed, check accessibility, UX feedback, and perceived performance implications.
   - If backend behavior changed, check validation, error handling, authorization, and response-shape stability.
   - If E2E-covered frontend flows changed and any `/api/*` requests were added or altered, verify the relevant mocks exist in `frontend/e2e/helpers/mocks.ts` or another shared mock helper. Missing stubs must be treated as a review finding, not a suggestion.
   - If the diff includes unrelated changes outside the linked issue scope, force an explicit decision: keep in this PR, split to another branch, or remove before commit.
5. Present findings in this structure:
   - **Correctness / risk** — grouped by severity: High / Medium / Low
   - **Issue alignment** — `Met`, `Partially met`, `Missing`, `Out of scope`
   - **Test impact** — `Covered`, `Needs tests`, `Needs mock updates`, `Unclear`
   - **Convention violations** — only if present
   - If nothing is found in a section, say so explicitly.
6. If there are findings:
   - Separate them into:
     - **Safe to auto-fix now** — low-risk, unambiguous fixes
     - **Needs user decision** — scope, behavior, architecture, or product ambiguity
   - Ask the user:
     - **Apply safe fixes** — implement the safe fixes and re-run this phase
     - **Skip fixes** — continue to Phase 2 with findings noted
     - **Stop** — end the command here
7. If there are no findings, apply the auto-advance rule and continue to Phase 2.

---

## Phase 2 — Targeted Documentation Check

1. Do not read every doc file by default. Start by mapping changed areas to likely documentation impact:
   - `README.md` for setup, commands, architecture overview, or developer workflow changes
   - `CLAUDE.md` and `.claude/docs/project-instructions.md` for repo rules or workflow expectations
   - `.claude/docs/menu.md` and `.claude/docs/menu.mermaid.md` for menu/data-model changes
   - `.claude/docs/phases/` specs for feature-scope or phase-progress changes
2. Read only the documentation files relevant to the diff. Escalate to a broader doc sweep only if the change touches shared architecture, APIs, authentication, data model, or phase-level feature status.
3. Compare documentation against the actual codebase state and classify results as:
   - **Must update** — docs would be incorrect or misleading if left unchanged
   - **Nice to update** — docs could be clearer but are not wrong
   - **Unaffected** — no update needed
4. Report:
   - one line per affected doc file
   - the exact section that is outdated
   - what it should say instead at a high level
5. If any documentation is in **Must update**:
   - ask the user:
     - **Apply all required doc updates**
     - **Pick files**
     - **Skip docs**
6. If only **Nice to update** items exist, summarize them and continue unless the user wants them handled.
7. If all relevant docs are unaffected, apply the auto-advance rule and continue to Phase 3.

---

## Phase 3 — Commit Message, Commit, Push, Pull Request

1. Run `git diff --stat HEAD`, `git diff HEAD`, and `git log --oneline -5`.
2. Generate a single commit message that:
   - starts with a past-tense verb
   - is as short as possible while remaining clear
   - reflects the actual files intended for commit
   - matches the tone of recent commit history
   - never includes `Co-Authored-By` or any AI signature
3. Reconfirm the milestone before PR creation:
   - prefer the milestone attached to the linked issue
   - otherwise use the cached milestone from Phase 0
   - if neither is available, ask the user whether to proceed without a milestone
4. Generate a PR title from the commit message and a PR body that includes:
   - `## Summary` with 1-3 bullets derived from the diff
   - `## Test plan` with concrete verification steps derived from the changed areas
   - `## Risks / Notes` only if Phase 1 found known tradeoffs, partial acceptance criteria, or deferred work
   - `Closes #<issue-number>` if there is a linked issue
5. Output the proposed commit message and PR body for review.
6. Ask the user, one step at a time, and wait for confirmation between each:
   1. **Create the commit?**
      - Stage only the intended files explicitly.
      - Do not use `git add -A` or `git add .`.
      - Run `git commit -m "<message>"`.
      - Do not amend.
   2. **Push to `origin`?**
      - Run `git push -u origin <current-branch>`.
      - Refuse if the current branch is `master`.
   3. **Open the pull request?**
      - Run `gh pr create --base master --head <current-branch> --assignee @me --title "<title>"`.
      - Add `--milestone "<resolved-milestone-title>"` when a milestone is available.
      - Add the generated PR body.
      - Return the PR URL when done.
7. If the user declines any step, stop there and report the exact current state.

---

## General rule for issues and PRs

Any issue or pull request created by this command, or as a side effect of it, must be created with `--assignee @me`.

If a resolved milestone exists, any issue or pull request created by this command must also use `--milestone "<resolved-milestone-title>"`. Never guess the milestone title when the repository contains multiple plausible options.
