# p06d r2 — readable manual-edit and Faculty status controls

Base: `2e0d46f7038a2762a73cea4224b46df6e52b8919`

Audience: an older, mouse-first scheduler who needs to read conflict and Faculty
status at a glance. The region should feel calm and compact, with text that is
large enough to scan and no clipped badge faces.

## Layout decision

- Keep the Conflict Inspector's current sections, spacing, colors, and badge row.
  Replace its arbitrary 9–11px type sizes with the existing named `text-xs`
  token (14px), including its compact status badges and supporting conflict text.
  The shared Badge primitive retains its existing 20px pill and named line box.
- Keep the Faculty profile layout and all badge wording. Remove the local vertical
  padding override from its 15px Adviser badge and give it a 24px box, so the shared
  vertical padding leaves enough room for the 15px line box.
- Add no rows, controls, helper copy, or behavior. No data, routes, or state change.

## Render check

Capture both actual rendered surfaces from an isolated loopback candidate at
1366×768. Check that the conflict labels and details are readable at 14px, the
Faculty 15px badge face is not clipped, and neither surface adds ellipsis or
global scrollbars.
