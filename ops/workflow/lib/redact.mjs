// ops/workflow/lib/redact.mjs
// Credential-shaped text redaction for local observability state (WF-C03, B1).
//
// Observability state must NEVER carry prompts, responses, credentials, tokens,
// environment contents, browser storage, command output, or source diffs. Any
// free-form text that reaches a heartbeat or notification is passed through
// `redactText`, which both collapses control characters and replaces
// credential-shaped substrings with a typed `[REDACTED:<name>]` marker.
//
// This module is deliberately independent from `lib/checkpoint.mjs`. The
// checkpoint redactor is part of the already-reviewed WF-C02 contract; reusing
// it here would silently change that contract's rejection behaviour. The two
// lists intentionally overlap, and this one is the superset used by the newer
// local-observability surface.
export const SECRET_PATTERNS = [
  { name: "openai-key", re: /\bsk-[A-Za-z0-9_-]{12,}/g },
  { name: "bearer-token", re: /\bbearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi },
  { name: "pem-block", re: /-----BEGIN [A-Z ]+-----/g },
  { name: "private-key", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
  { name: "password-assignment", re: /\bpassword\s*[:=]\s*\S+/gi },
  { name: "api-key-assignment", re: /\bapi[_-]?key\s*[:=]\s*\S+/gi },
  { name: "token-assignment", re: /\b(?:access|refresh|auth|session|id)?[_-]?token\s*[:=]\s*\S+/gi },
  { name: "jwt", re: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g },
  { name: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{16,}/g },
  { name: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "slack-token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g },
];

export function containsSecret(text) {
  if (typeof text !== "string" || text.length === 0) return false;
  return SECRET_PATTERNS.some(({ re }) => {
    re.lastIndex = 0;
    return re.test(text);
  });
}

/**
 * Collapse a free-form value into a short, single-line, credential-free string.
 * Control characters and newlines are removed before pattern replacement so a
 * credential split across lines cannot survive.
 */
export function redactText(value, maxLength = 240) {
  if (value === null || value === undefined) return null;
  let text = typeof value === "string" ? value : String(value);
  // Strip NUL and control characters (keep nothing below 0x20) and collapse
  // newlines/tabs into single spaces so records stay one physical line.
  text = text.replace(/[\u0000-\u001f\u007f]+/g, " ");
  for (const { name, re } of SECRET_PATTERNS) {
    re.lastIndex = 0;
    text = text.replace(re, `[REDACTED:${name}]`);
  }
  text = text.replace(/\s+/g, " ").trim();
  if (typeof maxLength === "number" && maxLength > 0 && text.length > maxLength) {
    text = `${text.slice(0, maxLength - 3)}...`;
  }
  return text;
}

/** Same as redactText but preserves null/undefined instead of an empty string. */
export function redactOptional(value, maxLength = 240) {
  const text = redactText(value, maxLength);
  return text === null || text === "" ? null : text;
}
