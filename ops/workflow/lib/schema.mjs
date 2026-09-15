// ops/workflow/lib/schema.mjs
// Loads and enforces the authoritative cycle-state JSON Schema.
// Fail-closed: unreadable schema => SCHEMA_LOAD_FAILED; unsupported keyword =>
// SCHEMA_UNSUPPORTED_KEYWORD. No external dependencies.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Resolved relative to this module, never to the state document and never to cwd.
export const DEFAULT_SCHEMA_PATH = path.resolve(HERE, "..", "schema", "cycle-state.schema.json");

export const SUPPORTED_KEYWORDS = new Set([
  "$schema",
  "$id",
  "$defs",
  "$ref",
  "title",
  "description",
  "type",
  "required",
  "additionalProperties",
  "properties",
  "enum",
  "const",
  "pattern",
  "items",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
]);

export function loadSchema(schemaPath = DEFAULT_SCHEMA_PATH) {
  let raw;
  try {
    raw = fs.readFileSync(schemaPath, "utf8");
  } catch (err) {
    return { ok: false, code: "SCHEMA_LOAD_FAILED", message: `cannot read schema at ${schemaPath}: ${err.message}` };
  }
  try {
    return { ok: true, schema: JSON.parse(raw), schemaPath };
  } catch (err) {
    return { ok: false, code: "SCHEMA_LOAD_FAILED", message: `cannot parse schema at ${schemaPath}: ${err.message}` };
  }
}

// Recursively scan the schema for keywords this validator does not implement.
export function findUnsupportedKeywords(node, location = "#", out = []) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => findUnsupportedKeywords(item, `${location}[${i}]`, out));
    return out;
  }
  if (!isPlainObject(node)) return out;
  for (const [key, value] of Object.entries(node)) {
    if (key === "properties" || key === "$defs") {
      if (isPlainObject(value)) {
        for (const [defKey, defVal] of Object.entries(value)) {
          findUnsupportedKeywords(defVal, `${location}/${defKey}`, out);
        }
      }
      continue;
    }
    if (key === "items") {
      findUnsupportedKeywords(value, `${location}/items`, out);
      continue;
    }
    if (!SUPPORTED_KEYWORDS.has(key)) {
      out.push({ keyword: key, location });
    }
  }
  return out;
}

export function validateValue(schema, value, valuePath, root, errors) {
  if (schema === true || schema === undefined) return;
  if (schema === false) {
    errors.push({ code: "SCHEMA_FALSE_SCHEMA", message: "schema forbids any value here", path: valuePath });
    return;
  }
  if (!isPlainObject(schema)) {
    errors.push({ code: "SCHEMA_INVALID", message: "schema node is not an object", path: valuePath });
    return;
  }
  if (typeof schema.$ref === "string") {
    const target = resolveRef(schema.$ref, root);
    if (!target) {
      errors.push({ code: "SCHEMA_REF", message: `unresolvable $ref ${schema.$ref}`, path: valuePath });
      return;
    }
    validateValue(target, value, valuePath, root, errors);
    return;
  }

  const types = schema.type === undefined ? null : Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types) {
    const ok = types.some((t) => valueMatchesType(value, t));
    if (!ok) {
      errors.push({
        code: "SCHEMA_TYPE",
        message: `expected ${types.join("|")} but found ${typeName(value)}`,
        path: valuePath,
      });
      return;
    }
  }

  if ("const" in schema && !deepEqual(value, schema.const)) {
    errors.push({ code: "SCHEMA_CONST", message: `expected const ${JSON.stringify(schema.const)}`, path: valuePath });
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => deepEqual(value, candidate))) {
    errors.push({
      code: "SCHEMA_ENUM",
      message: `value ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`,
      path: valuePath,
    });
  }

  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      errors.push({ code: "SCHEMA_MIN_LENGTH", message: `string shorter than ${schema.minLength}`, path: valuePath });
    }
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
      errors.push({ code: "SCHEMA_MAX_LENGTH", message: `string longer than ${schema.maxLength}`, path: valuePath });
    }
    if (typeof schema.pattern === "string") {
      let re;
      try {
        re = new RegExp(schema.pattern);
      } catch (err) {
        errors.push({ code: "SCHEMA_PATTERN_INVALID", message: `invalid pattern: ${err.message}`, path: valuePath });
        re = null;
      }
      if (re && !re.test(value)) {
        errors.push({ code: "SCHEMA_PATTERN", message: `string does not match ${schema.pattern}`, path: valuePath });
      }
    }
  }

  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      errors.push({ code: "SCHEMA_MINIMUM", message: `value below minimum ${schema.minimum}`, path: valuePath });
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      errors.push({ code: "SCHEMA_MAXIMUM", message: `value above maximum ${schema.maximum}`, path: valuePath });
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      errors.push({ code: "SCHEMA_MIN_ITEMS", message: `array shorter than ${schema.minItems}`, path: valuePath });
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      errors.push({ code: "SCHEMA_MAX_ITEMS", message: `array longer than ${schema.maxItems}`, path: valuePath });
    }
    if (schema.items !== undefined) {
      value.forEach((item, i) => validateValue(schema.items, item, `${valuePath}[${i}]`, root, errors));
    }
    return;
  }

  if (isPlainObject(value)) {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
          errors.push({ code: "SCHEMA_REQUIRED", message: `missing required key "${key}"`, path: valuePath });
        }
      }
    }
    const props = isPlainObject(schema.properties) ? schema.properties : {};
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(props, key)) {
          errors.push({ code: "SCHEMA_UNKNOWN_KEY", message: `unknown key "${key}"`, path: `${valuePath}.${key}` });
        }
      }
    }
    for (const [key, subSchema] of Object.entries(props)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        validateValue(subSchema, value[key], `${valuePath}.${key}`, root, errors);
      }
    }
  }
}

export function validateDocument(doc, schema) {
  const errors = [];
  validateValue(schema, doc, "$", schema, errors);
  return errors;
}

function resolveRef(ref, root) {
  if (typeof ref !== "string" || !ref.startsWith("#/")) return null;
  let cur = root;
  for (const segment of ref.slice(2).split("/")) {
    const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    if (cur && typeof cur === "object" && Object.prototype.hasOwnProperty.call(cur, key)) {
      cur = cur[key];
    } else {
      return null;
    }
  }
  return cur;
}

export function typeName(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

export function valueMatchesType(value, type) {
  switch (type) {
    case "null":
      return value === null;
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return isPlainObject(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "number":
      return typeof value === "number";
    default:
      return false;
  }
}

export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]));
  }
  return false;
}
