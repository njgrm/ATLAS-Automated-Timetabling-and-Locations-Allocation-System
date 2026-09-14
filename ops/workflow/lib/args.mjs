// ops/workflow/lib/args.mjs
// Strict long-flag parser. Unknown/missing flags are usage errors (exit 2).
export function parseArgs(argv, spec) {
  const required = spec.required || [];
  const allowed = new Set([...required, ...(spec.optional || [])]);
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      return { ok: false, code: "USAGE_UNEXPECTED_ARGUMENT", message: `unexpected argument "${token}"` };
    }
    const name = token.slice(2);
    if (!allowed.has(name)) {
      return { ok: false, code: "USAGE_UNKNOWN_FLAG", message: `unknown flag "${token}"` };
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      return { ok: false, code: `USAGE_MISSING_VALUE_${name.toUpperCase()}`, message: `flag "${token}" requires a value` };
    }
    values[name] = next;
    i += 1;
  }
  for (const key of required) {
    if (values[key] === undefined) {
      return { ok: false, code: `USAGE_MISSING_${key.toUpperCase()}`, message: `missing required flag "--${key}"` };
    }
  }
  return { ok: true, values };
}
