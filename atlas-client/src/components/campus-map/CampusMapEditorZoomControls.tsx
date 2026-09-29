/**
 * A9 m1 — the editor's view cluster, now the SHARED one.
 *
 * This file used to declare its own three buttons. It now re-exports
 * `CampusMapZoomControls`, which is the same component every read-only viewer
 * uses, so this import path and every existing caller still resolve and there is
 * exactly ONE zoom cluster in the product.
 *
 * The shared cluster adds two things the editor's copy did not have, both required
 * by the packet:
 *   - the percentage in WORDS ("75%"), as a live `role="status"`, so a scheduler
 *     can see the zoom level without inferring it from the size of the map;
 *   - the range `0.25`–`4` instead of `0.4`–`2.5`. The old lower bound IS the
 *     reported defect: "we can't zoom out and lock the map in place, causing the
 *     map to be cut off". `zoom` is therefore a REQUIRED prop — the component
 *     cannot render a percentage it does not have.
 */
export { CampusMapZoomControls as CampusMapEditorZoomControls } from '@/components/campus-map/CampusMapZoomControls';
