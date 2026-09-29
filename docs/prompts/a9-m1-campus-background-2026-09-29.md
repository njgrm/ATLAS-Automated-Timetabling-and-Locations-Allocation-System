# A9 m1 — campus map background: fit it, zoom out, lock it (train 11)

Issued by Lane C, 2026-09-29 (evening). Operator: "uploading an image that will serve as the map background is limited,
since we can't zoom out and lock the map in place, causing the map to be cut off with no option for the schedulers to
work around it unless they crop it perfectly, which is a hassle."

## Confirmed in code (origin/main)
- The uploaded image is painted as a fill pattern on a fixed 920x580 world (`CampusMapEditor.tsx:771-781`:
  `fillPatternScaleX = CANVAS_WIDTH / image.width`, `fillPatternScaleY = CANVAS_HEIGHT / image.height`). X and Y are
  scaled independently, so any photo that is not 1.59:1 is stretched or squashed, and the 920x580 box is the whole world:
  nothing outside it can ever be shown.
- Zoom is a multiplier on the fit of that fixed box, clamped (`campusEditorCanvas.ts:336` `CANVAS_MIN_SCALE`), and pan
  is clamped to the box (`:261-270`); the viewer preview clamps 0.8-3x (`CampusMapCanvasPreview.tsx:12-13`). So a
  scheduler cannot zoom out to see the whole photo or place it; only a perfectly pre-cropped 920x580 image works.
- The same fixed box is repeated in `MapView.tsx:13-14`, `CampusMapCanvasPreview.tsx:10-11`, `CampusMapOverview`,
  and the Dashboard `CampusReadinessCard`.
- Storage: only `School.campusImageUrl` (`prisma/schema.prisma:21`); no stored placement.

## What the scheduler must be able to do (plain, mouse-first)
1. Upload any photo or plan (any shape, any size). It appears whole, at its true proportions, fitted to the editor
   ("Fit whole image" is the default). Never stretched, never cropped by ATLAS.
2. A "Background" step in the editor: **Move** (drag the image), **Size** (a slider or − / + buttons, plus "Fit whole
   image" and "Fill the area"), **Reset**, and **Lock background**. Locked by default after the first save; while locked,
   dragging moves buildings only, never the photo. The lock state is visible in words ("Background locked") with an
   Unlock button.
3. Zoom out far enough to see the whole image with margin (at least until the whole image fits at 50% of the view), and
   zoom in to place small buildings; pan anywhere the image reaches. Buttons, not only the mouse wheel; the % is shown.
4. Buildings keep their positions relative to the image when the view zooms or the window resizes.
5. The same framing everywhere the map is shown: map overview, room map inset, Dashboard campus card, Sections room map.
   Each viewer shows the whole locked map fitted, never cropped, with the same zoom buttons.
6. Receipts rule: after save, "Background saved and locked. Buildings stay where you placed them."

## Data
Store the placement with the school (image scale, offset, lock). Prefer extending the existing map/campus settings data
without a migration; if a Prisma migration is unavoidable, it is HIGH (atlas-reviewer-high pre-action) and must be named
in the handoff so A4's train 11 Prisma gate expects it. Existing schools with no placement get "Fit whole image",
locked, and their existing buildings keep their current on-screen positions (prove with the live building layout copied
to staging).

## Proof
Real staging data, 1366x768: upload three images — a wide panorama (3:1), a tall plan (2:3), a small 600x400 photo —
screenshots of editor, overview, Dashboard card and room inset for each: nothing stretched, nothing cut off, whole image
visible at "Fit whole image"; lock, drag a building, the photo does not move; reload, placement kept. `ux-audit.js` on
/map (editor and overview) and /: 0 MAJOR. `test:encoding` green. Unit tests for the placement math (fit, fill, clamp,
building positions stable across zoom/resize). Commit and push wip every 30 min. A9 c7/c8 edit nearby map files: merge
origin/main before each slice and keep their changes.
