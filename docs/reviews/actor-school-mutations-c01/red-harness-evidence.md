# ACTOR-SCHOOL-MUTATIONS-C01 — failing-first capture

Command:

```text
npm run test:actor-school-mutations
```

Result: exited `1` in `0.50s`; the mounted HTTP servers and instrumented Prisma
client were closed in teardown. The first missing-school request reached the
real `enrollProSchoolYearMirror.findUnique` delegate before the 250ms request
bound, proving the unfixed route did not reject before downstream dispatch.

```text
✖ runtime mutation routes fail closed before every downstream dispatch (489.8916ms)

✖ failing tests:

AssertionError [ERR_ASSERTION]: /rollover-recovery/mark-test-data system missing school: expected 400, got 598/AbortError

598 !== 400

actual: 598
expected: 400
operator: strictEqual
```
