import { Rect } from "fabric";
import { targetOverlayGeometry } from "../src/canvas/FabricViewport.js";

declare global {
  interface Window {
    __targetOverlayResult?: Record<string, unknown>;
  }
}

const target = new Rect({
  left: 120,
  top: 100,
  width: 405,
  height: 537,
  originX: "left",
  originY: "top",
  strokeWidth: 0,
});
target.setCoords();
const targetBounds = target.getBoundingRect();
const overlay = new Rect({
  ...targetOverlayGeometry(targetBounds),
  strokeWidth: 0,
});
overlay.setCoords();
const overlayBounds = overlay.getBoundingRect();

window.__targetOverlayResult = {
  targetBounds,
  overlayBounds,
  originX: overlay.originX,
  originY: overlay.originY,
};
document.body.dataset.targetOverlayReady = "true";
