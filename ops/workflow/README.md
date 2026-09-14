# ATLAS workflow foundation (`ops/workflow`)

Repository-owned, machine-readable delivery-cycle state with a fail-closed
verifier and a deterministic Markdown register renderer.

The JSON state document (`docs/plans/atlas-delivery-cycles.json`) is the
authority for current cycle state. The generated register
(`docs/plans/atlas-active-delivery-streams.generated.md`) is derived output; the
historical prose register (`docs/plans/atlas-active-delivery-streams.md`) stays
as context only.

## Commands

```bash
npm run workflow:test    # node --test ops/workflow/__tests__/*.test.mjs
npm run workflow:verify  -- --state docs/plans/atlas-delivery-cycles.json
npm run workflow:render  -- --state docs/plans/atlas-delivery-cycles.json --output docs/plans/atlas-active-delivery-streams.generated.md
```

Direct CLI contract:

- `node ops/workflow/verify-cycle.mjs --state <path> [--receipt <path>] [--stream <id>]`
- `node ops/workflow/render-register.mjs --state <path> --output <path>`

Exit codes: `0` ok, `1` state verification failed (or unreadable/unparseable),
`2` usage/config error (missing or unknown flag). There is never a default state
file: `--state` is always required.

Both CLIs print exactly one JSON document with the top-level keys
`status`, `summary`, `nextActions`, `artifacts`, `errors`. Identical input
produces byte-identical stdout and byte-identical rendered output.

## Contract

- Schema: `ops/workflow/schema/cycle-state.schema.json` (JSON Schema 2020-12,
  `additionalProperties: false` everywhere). The verifier always loads this file
  relative to its own module, never from the state document and never from the
  working directory. Missing/unreadable schema => `SCHEMA_LOAD_FAILED`;
  unsupported keyword => `SCHEMA_UNSUPPORTED_KEYWORD`.
- State document: `contractVersion`, `registry`, `coordination`, `streams`,
  `browserCustody`. Every object key is required; null is allowed only where the
  contract declares a nullable type.
- The verifier collects all independent rule violations deterministically
  (schema/parse catastrophes abort early with one explicit code). Rule codes are
  listed in `lib/verify.mjs` and exercised by `__fixtures__/expected.json`.

## Closure receipt

`node ops/workflow/verify-cycle.mjs --state <state> --receipt <path>` mints a
receipt only when validation succeeds. The receipt attests facts (candidate and
integration SHAs, QA/auditor verdicts, gate tally, pinned artifacts), not the
`state` field, so a pre-`COMPLETE` `INTEGRATION_READY` document can be attested.
On failure the receipt file is never created or modified. Stream selection:
`--stream <id>`, else exactly one `COMPLETE` stream, else exactly one stream with
`review.qaVerdict === "ACCEPT_READY"`, else `RECEIPT_STREAM_AMBIGUOUS`.

## Byte-pinned artifacts and line endings

Artifact pins (`streams[].artifacts[].sha256`) and closure receipt pins
(`streams[].closure.receipt.sha256`) are **raw byte SHA-256 values of the LF
form** of the file. They are verified against the working-tree bytes, so a
checkout that rewrites LF to CRLF would invalidate every pin.

The repository root `.gitattributes` therefore forces `eol=lf` for the pinned
classes:

```
ops/workflow/** text eol=lf
docs/plans/** text eol=lf
docs/handoffs/** text eol=lf
```

Any future pinned artifact must live under one of these LF-enforced paths, or
the policy must be extended in the same change. The
`__tests__/artifact-portability.test.mjs` control materializes every pinned
artifact through a real `core.autocrlf=true` Git checkout and fails if a pin
does not survive, and it includes a mutant flow that reproduces the CRLF defect
when the `.gitattributes` rules are absent.

## Renderer

The renderer runs the same validation engine first. On invalid state it exits
`1`, prints the failure JSON, and leaves any existing output untouched. On
success it writes UTF-8 Markdown with LF newlines and a trailing newline. Output
is a pure function of the state file content plus its content SHA-256: no
timestamps, no file paths, no environment values. Stream sections are ordered by
stream id; observation and custody entries are ordered deterministically.

## Fixture harness

`__fixtures__/` holds state templates with `{{BASE_SHA}}`, `{{CANDIDATE_SHA}}`,
`{{INTEGRATION_SHA}}`, `{{OTHER_SHA}}`, and `{{RECEIPT_SHA}}` placeholders.
`__tests__/harness.mjs` materializes them into disposable repositories created
under `os.tmpdir()` (`git init -b main`, fixed `-c user.name`/`-c user.email`/
`-c commit.gpgsign=false`) and never touches the real repository.

`__fixtures__/expected.json` maps each fixture to `{ "expect": "pass"|"fail",
"code": "<intended error code>" }`. Every fixture test asserts the final process
exit code through `child_process` and the intended error code in the stdout
`errors` array. Tests use Node built-ins only; run `npm run workflow:test` and
expect a clean `git status --porcelain` afterwards.
