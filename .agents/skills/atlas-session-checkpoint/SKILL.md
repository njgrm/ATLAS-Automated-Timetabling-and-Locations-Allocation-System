---
name: atlas-session-checkpoint
description: Capture the minimum durable ATLAS handoff before a fresh Codex session at a lane boundary, QA verdict, or completed deployment. Do not use during active uncommitted work.
metadata:
  short-description: Minimal ATLAS fresh-session handoff
---

# ATLAS session checkpoint

Use this only at a durable lane boundary, after a QA verdict, or after a completed deployment.
Do not use it to interrupt an uncommitted correction, active browser custody, or a HIGH action.

1. Reconcile the current lane state from Git, `docs/plans/live-state.md`, and the existing
   lane handoff. Do not trust a stale task title or pasted transcript.
2. Record only the current objective and verdict; branch, base, and candidate SHA; changed
   paths or committed artifact; decisive completed gates and the remaining blocker; custody
   for the worktree, browser, runtime, and live-state file; and one next action.
3. Update the existing lane handoff, not a parallel ledger. Update `live-state.md` only when
   an operational fact, blocker, or next action has actually changed.
4. State the intended disposition (`KEEP_ACTIVE`, `RETIRE_AFTER_INTEGRATION`, or
   `PRESERVE_FOR_DECISION`). Start the fresh session only after the handoff is committed or
   otherwise durable under the current stream's rules.

Never paste full logs, prior reasoning, credentials, or browser transcripts into the handoff.
If the context threshold is unavailable, report that fact rather than inventing a count.
