import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Composer, type ComposerItem } from "../src/composer/Composer.js";
import type { RenoiseMaterialReference } from "../../shared/document-schema.js";

declare global {
  interface Window {
    __submittedIntent?: { ids: string[]; prompt: string };
    __addThirdClip?: () => void;
    __materialPool?: RenoiseMaterialReference[];
    __promptDraft?: string;
    __clearOnSubmit?: boolean;
    __rejectSubmit?: boolean;
    __setHarnessDraft?: (prompt: string, draftKey?: string) => void;
    __materialRequests?: string[];
    __materialTypes?: Array<"image" | "video" | undefined>;
    __setMaterialPool?: (materials: RenoiseMaterialReference[]) => void;
    __resetItems?: () => void;
    __gatewayMaterialPreviewBroken?: boolean;
  }
}

const initialItems: ComposerItem[] = [
  { id: "object_target_a", assetId: "asset_a", label: "角色图 A.png" },
  { id: "object_target_b", assetId: "asset_b", label: "镜头 B.mp4", timeLabel: "00:04.000" },
];

const tinyPreview = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const listHarnessMaterials = async ({ offset, search, type }: { offset: number; search?: string; type?: "image" | "video" }) => {
  window.__materialRequests?.push(search ?? "");
  window.__materialTypes?.push(type);
  if (search === "slow") await new Promise((resolve) => setTimeout(resolve, 450));
  if (search === "fast") await new Promise((resolve) => setTimeout(resolve, 10));
  if (search === "pages") return {
    materials: [{
      materialId: offset ? 202 : 201,
      name: offset ? "Infinite page two" : "Infinite page one",
      type: "image" as const,
      mimeType: "image/png",
      previewCapability: true,
      previewUrl: tinyPreview,
    }],
    hasMore: offset === 0,
  };
  const materials = offset ? [] : search ? [
      { materialId: search === "fast" ? 104 : 103, name: `${search} result`, type: "image" as const, mimeType: "image/png", previewCapability: true, previewUrl: tinyPreview },
    ] : [
      { materialId: 101, name: "Hero reference", type: "image" as const, mimeType: "image/png", previewCapability: true, previewUrl: tinyPreview },
      { materialId: 102, name: "Motion reference", type: "video" as const, mimeType: "video/mp4", previewCapability: false },
    ];
  return {
    materials: type ? materials.filter((material) => material.type === type) : materials,
    hasMore: false,
  };
};

function Harness() {
  const [items, setItems] = useState(initialItems);
  const [materialPool, setMaterialPool] = useState<RenoiseMaterialReference[]>([]);
  const [activeItemId, setActiveItemId] = useState(items[0]?.id);
  const [prompt, setPrompt] = useState("在 [[renoise-clip:object_target_a]] 增加王冠，在 [[renoise-clip:object_target_b]] 调整光线");
  const [draftKey, setDraftKey] = useState("session_test:page_test");
  window.__addThirdClip = () => setItems((current) => current.some(({ id }) => id === "object_target_c") ? current : [...current, { id: "object_target_c", assetId: "asset_c", label: "第三个异步截帧", timeLabel: "00:08.000" }]);
  window.__resetItems = () => setItems(initialItems);
  window.__materialPool = materialPool;
  window.__setMaterialPool = setMaterialPool;
  window.__promptDraft = prompt;
  window.__setHarnessDraft = (value, key) => {
    if (key) setDraftKey(key);
    setPrompt(value);
  };
  window.__materialRequests ??= [];
  window.__materialTypes ??= [];
  return (
    <><button type="button" aria-label="Toolbar control">Toolbar</button><Composer
      key={draftKey}
      items={items}
      activeItemId={activeItemId}
      prompt={prompt}
      draftKey={draftKey}
      materialPool={materialPool}
      outputResolution="720p"
      disabled={false}
      readAsset={async () => "data:image/png;base64,iVBORw0KGgo="}
      readAssetFallback={async () => "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="}
      materialPreviewUrl={() => window.__gatewayMaterialPreviewBroken ? "data:image/png;base64,broken" : tinyPreview}
      listMaterials={listHarnessMaterials}
      onMaterialPoolChange={setMaterialPool}
      onItemChange={setActiveItemId}
      onImportImage={() => undefined}
      onPromptChange={setPrompt}
      onOutputResolutionChange={() => undefined}
      onSubmit={async ({ instruction, itemIds }) => {
        if (window.__rejectSubmit) throw new Error("test rejection");
        window.__submittedIntent = { ids: itemIds, prompt: instruction };
        if (window.__clearOnSubmit) setPrompt("");
      }}
    /></>
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
