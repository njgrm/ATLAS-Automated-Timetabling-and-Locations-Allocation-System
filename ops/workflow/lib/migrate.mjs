// ops/workflow/lib/migrate.mjs
// Pure migration of earlier delivery-cycle state documents onto the current
// contract. It is deterministic, never mutates its input, and preserves every
// historical identity verbatim.
//
// 1.0.0 -> 1.1.0:
//   - the ambiguous `git.remoteSha` scalar becomes a nullable, explicitly
//     non-self-referential `git.remoteObservation` snapshot { ref, sha,
//     observedAt, kind }; a recorded SHA is never required to equal the commit
//     that contains the field or the current tip;
//   - `registry.revision` is introduced as the document CAS token;
//   - the top-level `leases` array is introduced.
import { isPlainObject } from "./schema.mjs";

export const LEGACY_CONTRACT_VERSION = "1.0.0";
export const CONTRACT_VERSION = "1.1.0";

export function migrateStateDocument(input, options = {}) {
  if (!isPlainObject(input)) throw new TypeError("migrateStateDocument expects a plain object");
  const doc = JSON.parse(JSON.stringify(input));
  const changes = [];

  if (doc.contractVersion === LEGACY_CONTRACT_VERSION) {
    doc.contractVersion = CONTRACT_VERSION;
    changes.push("contractVersion 1.0.0 -> 1.1.0");
  }

  if (!isPlainObject(doc.registry)) doc.registry = {};
  if (doc.registry.revision === undefined) {
    doc.registry.revision = 1;
    changes.push("registry.revision initialized to 1");
  }

  if (!Array.isArray(doc.leases)) {
    doc.leases = [];
    changes.push("leases initialized to []");
  }

  for (const stream of doc.streams || []) {
    const git = stream.git;
    if (!isPlainObject(git)) continue;
    if (!Object.prototype.hasOwnProperty.call(git, "remoteSha")) {
      if (!Object.prototype.hasOwnProperty.call(git, "remoteObservation")) {
        git.remoteObservation = null;
        changes.push(`${stream.id}: remoteObservation initialized to null`);
      }
      continue;
    }
    const legacy = git.remoteSha;
    if (legacy === null || legacy === undefined) {
      git.remoteObservation = null;
    } else {
      git.remoteObservation = {
        ref: (options.refFor && options.refFor(stream)) || "refs/remotes/origin/main",
        sha: legacy,
        observedAt: (options.observedAtFor && options.observedAtFor(stream)) || stream.stateUpdatedAt,
        kind: (options.kindFor && options.kindFor(stream)) || "REMOTE_TRACKING_REF",
      };
    }
    delete git.remoteSha;
    changes.push(`${stream.id}: remoteSha -> remoteObservation`);
  }

  return { doc, changed: changes.length > 0, changes };
}
