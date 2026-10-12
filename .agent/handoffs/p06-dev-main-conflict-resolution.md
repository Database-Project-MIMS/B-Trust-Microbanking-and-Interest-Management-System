# Dev-to-main conflict resolution — 2026-10-12

## PR #103 follow-up — current diagnosis

The earlier single-base checks below are insufficient and their GitHub mergeability
claim is superseded. PR #102 was merged by the user as `773796b`; PR #103 remains
dev into main with the four conflicts shown in the screenshot.
`git merge-base --all` returns BOTH `5253f6d` and `d218109`. Default recursive
simulation combines their histories, while an explicit `d218109` comparison
reproduces exactly GitHub's current-state, account-detail, Phase 6 and UI registry
conflicts. Verify against every returned base, not just the first one.

Authorized follow-up on the current branch: preserve main's shared statement/back
header and place the manager Edit action below it, retaining editing gates and all
record fields; relocate newer state, phase and UI notes away from main's shared
insertion points. M3 account-detail, lead/shared registry and documentation changes
are contributions under the user's conflict-fix request; stewardship is unchanged.
No migration, API, permission, dependency or financial change. No assistant commit,
push, PR creation or branch merge. This note precedes those cross-owner edits.

## Follow-up implementation and verification

The four displayed paths are now changed on `feat/p06-m02-record-details-edit`:
state notes are retained at the end after the shared audit prefix, the Phase 6
record-management paragraph moves to a supplement, and customer/record UI entries
move before the registry's component catalogue. Main's changed insertion blocks
remain intact. Account Edit is a separate loaded-account action row; the existing
canAddHolder, non-CLOSED and !editing gates remain. Fields and AccountEdit survive.
/imprint records existing secondary button/mt-4 tokens, with no new design token.

Both returned merge bases now simulate without conflicts and yield the SAME
result tree; feature-branch integration into current dev is also conflict-free.
Exact API/SQL/dependency diffs are empty. 45 focused account/FD/record/deployment
tests and targeted ESLint pass. Clean source TypeScript and production build pass.
The production build compiles, regenerates valid route types and renders all 71
static build entries with synthetic settings and no real database connection.
Root typecheck
initially sees obsolete generated password routes in .next from the other branch;
the clean verification export avoids changing that cache or the existing preview.

/review: plan alignment and integrity pass; no feature, documentation section or
permission is discarded. Read-only source/history checks retain the merged agent/
branch filters. This correction doesn't mark tasks DONE or approve phase gates.
No schema rebuild is needed because no database/API rule changed. Ignored evidence:
`scratch/dev-main-resolution/pr103-all-bases-verification.json` and follow-up patch.

GitHub still reports conflicts on its PUBLISHED dev tip until the user commits,
pushes the feature branch and integrates its follow-up PR into dev. Recheck actual
PR #103 afterwards; do not promise an unpublished local tree changes GitHub state.
No assistant commit, push, PR creation, actual merge or deployment is performed.

Earlier evidence below is retained as a record of the first attempt.

User authorizes applying the documentation fix to the current branch
`feat/p06-m02-record-details-edit`; no PR creation or merge. Changes remain local
and uncommitted. This is an M2 documentation/integration contribution; original
lead stewardship of memory and M1 deployment stewardship remain unchanged.

## Diagnosis and resolution

Fetched `origin/dev` is `05a1a2676f859c4eb19818f48a4cbb5472c25c28` and
`origin/main` is `88d06ddc02bdce14acde3f93d74431b768acb76b`.
The user's screenshot is [PR #101](https://github.com/Database-Project-MIMS/B-Trust-Microbanking-and-Interest-Management-System/pull/101),
confirmed by read-only GitHub metadata as dev into main at these exact tips.
The screenshot lists six paths. At the current tips, only docs/24 and memory
reproduce conflicts; current-state, account-detail, the Phase 6 document and
ui-registry combine automatically. The patched candidate is checked against
both branches, including all six paths, with zero conflicts.
PR #97 reached main directly; its build/menu commits were subsequently cherry-picked
onto the customer branch. Different ancestry makes Git compare both lines from
`5253f6d`, causing an add/add conflict in docs/24 and overlapping memory insertions.
There are no application or database conflicts.

`docs/24_vercel-build.md` now matches main's shared build guide. The PR #98
supplement is preserved in the existing customer-details handoff, with its relative
link corrected for the new location. The PR #98 memory section moves to the end;
all prior memory content survives. No application, SQL, dependency or task-status
changes are introduced. Main's Node 22 package setting survives the simulation.

## Agent and branch filters

Commit `d0c2d0a` is an ancestor of fetched dev, merged through PR #100 at `05a1a26`.
The current branch also includes it. Agent text/branch/status and branch
text/district/status filters, Search/Clear, strict query schemas and parameterized
scoped service predicates are identical between current HEAD and dev. No missing
feature needs to be sent again. This is source/history verification, not a new
hosted-browser test.

## Verification and review

The isolated candidate patch applies exactly to fetched dev; Git's tree-only
simulation reports zero conflicts with main. TypeScript and all seven deployment
security tests pass on the resulting source snapshot. Whitespace checks pass.
Application, component, service, library, SQL and lockfile differences against dev
are empty. No database rebuild is needed for these Markdown-only edits.

/review: plan alignment and system integrity pass. Production review is limited to
the unchanged application source, TypeScript and deployment tests; no hosted
deployment or new financial operation is performed. All five overview tables were
reviewed; no task newly completes, and existing statuses/phase gates remain intact.

## User-controlled publication

Review and commit the local documentation changes, push only
`feat/p06-m02-record-details-edit`, then use a feature-branch PR targeting dev.
No direct pushes to protected dev or main. Once the user integrates that feature PR,
existing PR #101 should be conflict-free against the checked main tip.
Final local simulations pass for current branch to dev, current branch to main,
and patched dev to main; the real index and HEAD remain unchanged.
Recheck if either remote branch
changes. This session creates no commit, push, PR, branch merge or deployment.
The requested fix was moved back to the current checkout; the unused managed
worktree was queued for archive. Ignored patch/simulation evidence is under
`scratch/dev-main-resolution/`.
