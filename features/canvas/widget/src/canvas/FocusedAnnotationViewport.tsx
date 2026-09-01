import { useMemo } from "react";
import type { Canvas as FabricCanvas } from "fabric";
import type { WhiteboardDocument } from "../../../shared/document-schema.js";
import { focusedDocumentForTarget } from "../../../shared/ui-helpers.js";
import { documentFromCanvas, type FabricAssetSource } from "./fabric-adapter.js";
import { FabricViewport } from "./FabricViewport.js";
import type { WhiteboardTool } from "./interaction-controller.js";
import type { Camera, ThemeName } from "../../../shared/ui-helpers.js";
import type { RecoveryDiagnosticEvent } from "../diagnostics/recovery-diagnostics.js";

export function FocusedAnnotationViewport({
  document,
  targetId,
  camera,
  theme,
  tool,
  onToolComplete,
  onReady,
  onFocusedChanged,
  onSelection,
  onViewChanged,
  onSceneResume,
  onDiagnostic,
  readAsset,
}: {
  document: WhiteboardDocument;
  targetId: string;
  camera: Camera;
  theme: ThemeName;
  tool: WhiteboardTool;
  onToolComplete: (tool: WhiteboardTool) => void;
  onReady: (canvas: FabricCanvas) => void;
  onFocusedChanged: (targetId: string, focused: WhiteboardDocument) => void;
  onSelection: (ids: string[]) => void;
  onViewChanged: (camera: Camera) => void;
  onSceneResume?: (reason: string) => void;
  onDiagnostic?: (event: RecoveryDiagnosticEvent) => void;
  readAsset: (assetId: string) => Promise<FabricAssetSource>;
}) {
  const focused = useMemo(
    () => focusedDocumentForTarget(document, targetId),
    [document, targetId],
  );

  return (
    <FabricViewport
      document={focused}
      annotations={focused.page.annotations}
      camera={camera}
      theme={theme}
      tool={tool}
      temporaryHand={false}
      activeTargetId={targetId}
      onToolComplete={onToolComplete}
      onReady={onReady}
      onChanged={(canvas) => onFocusedChanged(targetId, documentFromCanvas(canvas, focused))}
      onSelection={onSelection}
      onViewChanged={onViewChanged}
      onSceneResume={onSceneResume}
      onDiagnostic={onDiagnostic}
      readAsset={readAsset}
      fixedMedia
    />
  );
}
