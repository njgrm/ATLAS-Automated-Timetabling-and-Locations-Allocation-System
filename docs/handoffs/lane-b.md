# Lane B resumable handoff — ACTOR-SCHOOL-MUTATIONS-C01

Base: `ccf31e772c4a4d258eba15e85d74815ff2c3ef10`.

The prior candidate `cea65921286c269981efecfad832da7486d0d5d9` passed its
recorded matrix but independent single-agent QA found two blockers: the strict
parser coerced `true` and `[1]` to school `1`, and the dispatch counter covered
only one Prisma delegate. This correction adds a type guard before numeric
conversion, adds boolean/array/object cases for all eight routes, and records
all enumerable Prisma model operations plus raw/transaction operations. It
continues to use isolated HTTP listeners and makes no database mutation.

Current candidate: the next commit on `work/actor-school-mutations-c01`; it
must be pushed after `git fetch origin`, then independently reviewed by range
from Git. Lane A is concurrently working `DUP-READ-CALLERS-C01` on client
paths; do not touch that stream, its worktree, browser, runtime, or continuity
documents.

Decisive commands run before this checkpoint:

```text
npm run test:actor-school-mutations  # passed 1/1
npm run build                         # passed
git diff --check                      # passed
```

Next: run `npx tsx src/__tests__/runtime-router-actor-scope.test.ts`, commit
only the two authorized source/test paths plus this handoff, fetch and push,
then perform a fresh review of the correction commit and its blast radius.
