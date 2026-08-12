import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Composer, type ComposerItem } from "../src/composer/Composer.js";

declare global {
  interface Window {
    __submittedIntent?: { ids: string[]; prompt: string };
  }
}

const initialItems: ComposerItem[] = [
  { id: "object_target_a", assetId: "asset_a", label: "角色图 A.png" },
  { id: "object_target_b", assetId: "asset_b", label: "镜头 B.mp4", timeLabel: "00:04.000" },
];

function Harness() {
  const [items, setItems] = useState(initialItems);
  const [activeItemId, setActiveItemId] = useState(items[0]?.id);
  const [prompt, setPrompt] = useState("在 [[renoise-clip:object_target_a]] 增加王冠，在 [[renoise-clip:object_target_b]] 调整光线");
  return (
    <Composer
      items={items}
      activeItemId={activeItemId}
      prompt={prompt}
      disabled={false}
      readAsset={async () => "data:image/png;base64,iVBORw0KGgo="}
      readAssetFallback={async () => "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="}
      onItemChange={setActiveItemId}
      onItemRemove={(id) => setItems((current) => current.filter((item) => item.id !== id))}
      onImportImage={() => undefined}
      onPromptChange={setPrompt}
      onSubmit={async ({ instruction, itemIds }) => {
        window.__submittedIntent = { ids: itemIds, prompt: instruction };
      }}
    />
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
