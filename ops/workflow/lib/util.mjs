// ops/workflow/lib/util.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function readBytes(filePath) {
  try {
    return { ok: true, bytes: fs.readFileSync(filePath) };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

// Write bytes via a temp file in the same directory, then rename over the target.
export function writeFileAtomicSync(filePath, contents) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, contents);
  fs.renameSync(tmp, filePath);
}
