name git-hygiene
description Enforce this repo's Git Workflow standard — branch naming, branch source/target rules, commit message format, merge strategy, and branch cleanup. Use whenever creating a branch, committing, opening/merging a PR, or deleting a branch in this repo, or when invoked as /git-hygiene.
git-hygiene
Source of truth: the "Git flow" section of CLAUDE.md.

This skill owns all git conventions for this repo — branch naming, base/target branches, commit message format, merge strategy, PR mechanics, and cleanup. Other skills (plan-with-me, execute-with-me, and any orchestrator) must defer to this file rather than restating or paraphrasing a format. If another skill's example contradicts this file, this file wins.

Branch model
Branch Purpose Receives from Direct commits
main Live production code (auto-deploys on Vercel) dev, hotfix/_ Never
dev Integration, source of truth feature/_, bugfix/_, hotfix/_ Never
feature/_ New features/enhancements branched from main Yes (this is where work happens)
bugfix/_ Non-urgent bug fixes branched from main Yes
hotfix/\* Urgent production issues branched from main Yes
Rules:

feature/_ and bugfix/_ always start from main and PR into dev.
hotfix/\* also starts from main (production).
main is never committed to directly; it only receives dev (and hotfix/\*) via Pull Request.
All merges into protected branches happen via Pull Request — never push directly to main or dev.
Branch naming
Format: <prefix>/<short-description>, lowercase, hyphen-separated.

Allowed prefixes: feature/, bugfix/, fix/, hotfix/, refactor/, chore/, docs/
Examples: feature/user-authentication, fix/auth-rate-limiter, hotfix/login-crash
Rules: lowercase only, alphanumeric + hyphens only (no underscores, dots, emoji), no trailing slash, aim for under 50 characters.
Before creating a branch: confirm the correct base branch (main for feature/bugfix/hotfix).

Base branch
feature/_, bugfix/_, refactor/_, docs/_ → base off main, PR targets dev.
hotfix/\* → base off main, PR targets main and dev.
dev is promoted into main via Pull Request.
Commit message format
<type>(<scope>): <description>
Type: feat | fix | refactor | docs | test | chore | style
Scope (optional): short lowercase area of the codebase (e.g. auth, api).
Description: imperative mood, lowercase, no trailing period. Keep the first line under 50 characters.
WIP end-of-day commits: prefix with [WIP], e.g. feat(auth): [WIP] starting google oauth integration. Flag to the user that these should be squashed before the PR is finalized — don't silently rewrite history yourself.
Atomic commit rule
One commit = one logical change.

If the message needs "and", it's probably two commits.
For multi-day features, commit in logical milestones (models → service logic → tests → UI → wiring) rather than one giant commit.
Before committing, check git status/git diff for staged changes spanning unrelated concerns; if found, propose splitting via targeted git add <path> / git add -p and confirm with the user first.
Stage specific files, never git add -A / git add ..
Merge strategy (when opening/advising on PRs)
feature/_ or bugfix/_ → dev: standard merge via PR (repo history uses merge commits, e.g. "Merge pull request #21").
Promotion dev → main: standard merge via PR.
hotfix/\* → main and dev: standard merge into both — missing the dev merge causes a regression in the next release. Always call this out if advising on a hotfix.
CI (and the Vercel preview build) must pass on all PRs.

Hotfix handling
Branch from main, name hotfix/short-description.
Apply fix, rely on rigorous local testing (hotfixes bypass the normal QA cycle).
Dual merge: PR into main AND dev. Never skip the dev merge.
Requires at least one senior peer review even under P0 pressure — never merge alone.
Increment the patch version (semver) and tag production immediately after merge (e.g. v1.2.0 → v1.2.1).
Delete the hotfix branch once the production deploy is verified.
Branch cleanup
Delete feature/_ and bugfix/_ branches immediately after merge to dev.
Delete hotfix/\* branches immediately after merge to both main and dev.
Never delete main or dev — these are permanently protected, no force-push, no deletion.
If a branch was deleted before merging by accident, it may be recoverable via git reflog if the local repo wasn't cleared.
Pull requests
PRs are opened by a human in the GitHub web UI.

An agent's job at PR time is to prepare, not to submit:

Push the branch — only with explicit approval in that turn (see the permission rules below).
Produce the PR body (summary, changes, how it was verified, risks/follow-ups).
Hand the user a ready-to-paste title and body, plus: target branch (dev for feature/_/bugfix/_), merge strategy (standard merge), and the reminder that CI must pass.
Commit and push permission
Commits during an approved plan execution are pre-authorized. When the user approves executing a plan (e.g. via execute-with-me), that approval covers the per-phase commits inside that execution. The orchestrator does not stop to ask for each one — the phase checkpoints already gate the work.
Push, merge, tag, PR creation, and branch deletion are never pre-authorized. Each one needs its own explicit yes from the user in that turn, every time, regardless of any earlier approval. These are the operations that leave the machine or touch shared history.
Outside of an approved execution, the default stands: do not commit unless the user asked for a commit in this turn.
Never rewrite published history (push --force, rebase onto a pushed branch, amending a pushed commit) without an explicit request naming that operation.
Procedure when asked to do git work in this repo
Run git status, git branch --show-current, and git log --oneline -5 to see current state.
Confirm which branch type this is and that its base/target matches the rules above; flag any mismatch (e.g. a feature/_ branched off dev instead of main) before proceeding.
For commits: follow the commit message format and atomic commit rule above.
For merges/PRs: recommend the correct merge strategy for the target branch; never merge/push to a protected branch directly. Remember PRs are opened by hand — see the PR section above.
For branch deletion: only delete ephemeral branches (feature/_, bugfix/_, hotfix/_) and only after confirming the merge landed; never delete a protected branch.
Follow the Commit and push permission rules above: commits are pre-authorized only inside an approved plan execution; push, merge, tag, PR, and delete always need an explicit ask in that turn.
