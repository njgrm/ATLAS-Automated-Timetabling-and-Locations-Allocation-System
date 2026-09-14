// ops/workflow/lib/git.mjs
// Minimal read-only Git helpers. Never mutates the repository.
import { spawnSync } from "node:child_process";

export function runGit(args, cwd) {
  const res = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", windowsHide: true });
  if (res.error) {
    return { ok: false, status: -1, stdout: "", stderr: String(res.error.message || res.error) };
  }
  return {
    ok: res.status === 0,
    status: res.status,
    stdout: res.stdout || "",
    stderr: res.stderr || "",
  };
}

export function resolveRepoRoot(dir) {
  const res = runGit(["rev-parse", "--show-toplevel"], dir);
  if (!res.ok) return null;
  const root = res.stdout.trim();
  return root.length > 0 ? root : null;
}

export function shaExists(repoRoot, sha) {
  const res = runGit(["cat-file", "-e", `${sha}^{commit}`], repoRoot);
  return res.ok;
}

export function isAncestor(repoRoot, ancestor, descendant) {
  const res = runGit(["merge-base", "--is-ancestor", ancestor, descendant], repoRoot);
  return res.ok;
}

export function isAncestorOrEqual(repoRoot, ancestor, descendant) {
  if (ancestor === descendant) return true;
  return isAncestor(repoRoot, ancestor, descendant);
}

export function diffNameOnly(repoRoot, base, candidate) {
  const res = runGit(["diff", "--name-only", "--no-renames", `${base}...${candidate}`], repoRoot);
  if (!res.ok) return null;
  return res.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// Normalize a path for scope/identity comparison (case-insensitive on Windows).
export function normalizePath(p) {
  return String(p)
    .replace(/\\/g, "/")
    .replace(/\/+$/, "")
    .toLowerCase();
}
