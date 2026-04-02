# ProductionPlan Schema — DAG-Based

The `project.json` is a **directed acyclic graph (DAG)** where nodes are resources (materials, images, videos, assets) and edges are dependencies (ref_image, ref_video, first_frame/last_frame, asset reference, etc.).

This maps directly to the Renoise API's `materials` array — each edge becomes a `{ "id": N, "role": "..." }` entry in the task creation request.

---

## Pipeline Overview

The DAG is built incrementally across six stages:

```
INTAKE → SCRIPT → DESIGN → STORYBOARD → GENERATE → ASSEMBLE
```

| Stage | What happens to the DAG |
|-------|------------------------|
| **INTAKE** | `material` nodes added (existing uploads) |
| **SCRIPT** | Story structure, characters, scenes, segment plan written; `video` node shells created |
| **DESIGN** | `image` nodes (character/scene/concept art variants) generated based on script → user selects → `asset` nodes registered |
| **STORYBOARD** | Per-shot `keyframe` image nodes generated as variants → user selects → wired to video nodes |
| **GENERATE** | Video nodes executed along DAG topology |
| **ASSEMBLE** | `composite` node executed (ffmpeg concat) |

Each stage has a **gate**: the user must confirm outputs before the next stage begins. This prevents expensive downstream rework.

---

## DAG Mental Model

```
  ┌─ SCRIPT ────────────┐
  │ Define characters,  │
  │ scenes, shots       │
  └─────────┬──────────┘
            │
            ▼
  ┌─ DESIGN ───────────────────┐     ┌─ STORYBOARD ──────────────┐     ┌─ GENERATE ─────────────────────┐
  │                                  │     │                           │     │                                │
  │ [char_maya_v1] ─┐                │     │ [kf_S1_v1] ─┐            │     │                                │
  │ [char_maya_v2] ─┼─▶ user picks   │     │ [kf_S1_v2] ─┼─▶ user     │     │ [vid_S1] ──ref_video──▶ [vid_S2]│
  │ [char_maya_v3] ─┘   v2 ✓         │     │ [kf_S1_v3] ─┘   picks v1 │     │                                │
  │       │                          │     │      │                    │     │                                │
  │       ▼                          │     │      ▼                    │     │                                │
  │ [asset_maya]                     │     │ [kf_S1_v1]──ref_image──────────▶│ [vid_S1]                       │
  │                                  │     │                           │     │                                │
  │ [scene_room_v1] ─┐               │     │                           │     │                                │
  │ [scene_room_v2] ─┼─▶ picks v1 ✓  │     │                           │     │                                │
  │       │                          │     │                           │     │                                │
  │       ▼                          │     │                           │     │                                │
  │ [scene_room_v1]──ref_image────────────────────────────────────────────────▶ [vid_S2]                      │
  └──────────────────────────────────┘     └───────────────────────────┘     └────────────────────────────────┘

  [concept_art]──style_anchor──▶ ALL video nodes
```

### Keyframe Chain Pattern

`nano-banana-2` supports `ref_image` input — passing a previously generated image as reference when generating the next one. This enables **chained keyframe generation** where each keyframe inherits visual identity from the previous one:

```
  [kf_S1: Maya at hallway] ──ref_image──▶ [kf_S2: Maya at desk] ──ref_image──▶ [kf_S3: watch glowing]
          │                                       │                                    │
          └──ref_image──▶ [vid_S1]                └──ref_image──▶ [vid_S2]             └──ref_image──▶ [vid_S3]
```

Because each keyframe is generated with the previous one as `ref_image`, the model preserves subject identity (appearance, colors, textures) across the chain while changing scene/action per the new prompt. This is the recommended way to maintain visual consistency across per-shot keyframes.

Each node has a type. Each edge has a role. The DAG determines execution order — a node can only execute when all its input edges are resolved.

---

## Top-Level Structure

```jsonc
{
  "version": "2.0",
  "project": { /* metadata */ },
  "nodes": [ /* all resources */ ],
  "edges": [ /* all dependencies */ ],
  "variant_groups": [ /* variant selection groups */ ],
  "characters": [ /* character definitions, referenced by nodes */ ],
  "style_guide": { /* global style, NOT a node — applied via edges */ },
  "execution": { /* derived from DAG topology */ },
  "budget": { /* credit tracking */ }
}
```

---

## `project`

```jsonc
{
  "id": "proj_abc123",
  "title": "Mystery Package",
  "brief": "Maya finds a mysterious glowing pocket watch at her door",
  "mode": "C",                  // A | B | C | D | E
  "status": "intake",           // intake | script | design | storyboard | ready | executing | completed | failed
  "stage_gates": {              // track user confirmation per stage
    "intake": false,
    "script": false,
    "design": false,
    "storyboard": false
  },
  "ratio": "16:9",
  "target_duration_s": 60,
  "created_at": "2026-04-01T10:00:00Z",
  "updated_at": "2026-04-01T12:30:00Z"
}
```

---

## `nodes`

Every resource in the production is a node. Six node types:

### Node Types

| Type | Description | Renoise Operation | Examples |
|------|-------------|-------------------|----------|
| `material` | Existing file uploaded to Renoise | `material upload` | User's product photos, scene refs, downloaded reference videos |
| `image` | Generated image | `task generate --model nano-banana-2` | Character sheet, scene ref, concept art, storyboard grid |
| `video` | Generated video clip | `task generate --model renoise-2.0` | Each 15s shot |
| `asset` | Registered reusable anchor (face-safe) | `asset register` | Character face anchors |
| `character` | Platform character library entry | pre-existing | Renoise platform characters |
| `composite` | Post-processed output | `ffmpeg` | Final concatenated video |

### Common Node Fields

```jsonc
{
  "id": "node_001",               // unique node ID within project
  "type": "video",                // material | image | video | asset | character | composite
  "label": "S1 — Hallway Discovery",  // human-readable label for canvas
  "status": "pending",            // pending | generating | completed | failed | skipped | candidate | selected | rejected

  // Canvas layout (pixel coordinates for DAG visualization)
  "position": { "x": 400, "y": 200 },

  // All node types share these nullable fields:
  "task_id": null,                // Renoise task ID (for image/video nodes)
  "material_id": null,            // Renoise material ID (for material/image/asset nodes)
  "asset_id": null,               // Renoise asset ID (for asset nodes)
  "result_url": null,             // download/preview URL
  "local_path": null              // local file path
}
```

### `material` Node — Uploaded Existing File

```jsonc
{
  "id": "mat_hallway",
  "type": "material",
  "label": "Hallway Reference",
  "status": "completed",
  "position": { "x": 100, "y": 100 },

  "material_id": 53,
  "local_path": "./materials/hallway-ref.jpg",
  "result_url": "https://...",

  // Gemini analysis (populated during INGEST)
  "analysis": {
    "media_type": "image",         // image | video
    "content_type": "scene",       // product | scene | character-ref | mood-board | reference-video | other
    "tags": ["hallway", "warm-lighting", "apartment"],
    "description": "Warm apartment hallway with wooden floor and amber wall sconce",
    "has_face": false,
    "colors": ["amber", "brown"],
    "suitable_roles": ["ref_image", "first_frame"],
    "relevance": "high",           // against project brief
    "relevance_reason": "Matches S1 hallway scene"
  }
}
```

### `image` Node — Generated Image

```jsonc
{
  "id": "img_maya_sheet",
  "type": "image",
  "label": "Maya Character Sheet",
  "status": "pending",
  "position": { "x": 100, "y": 300 },

  "purpose": "character_sheet",    // character_sheet | scene_ref | concept_art | storyboard_grid | product_sheet | keyframe
  "variant_group": "vg_char_maya", // variant group ID this node belongs to (null if not a variant)
  "prompt": "Character reference sheet for Maya. East Asian woman, late 20s...",
  "model": "nano-banana-2",
  "resolution": "2k",
  "ratio": "1:1",

  "task_id": null,
  "material_id": null,             // populated after download + upload
  "result_url": null
}
```

#### Keyframe Images

Keyframes are `image` nodes with `purpose: "keyframe"`. They represent the desired visual composition for a specific shot — including characters, environment, action, and camera angle.

**Keyframe chain**: to maintain consistency across keyframes, generate them sequentially with `ref_image` edges between them:

```jsonc
// First keyframe — no ref_image input, establishes the visual identity
{ "id": "kf_S1", "type": "image", "label": "KF: Hallway Discovery", "purpose": "keyframe",
  "prompt": "Maya, East Asian woman late 20s, shoulder-length black hair, cream cardigan, kneeling at apartment door picking up a brown package. Warm amber hallway lighting, cinematic, medium close-up.",
  "model": "nano-banana-2", "resolution": "2k", "ratio": "16:9" }

// Second keyframe — ref_image from kf_S1 preserves Maya's appearance
{ "id": "kf_S2", "type": "image", "label": "KF: Unwrapping", "purpose": "keyframe",
  "prompt": "Same woman from the reference image, now seated at a wooden desk unwrapping a brown package. Warm lamp, twilight window. Cinematic, medium shot.",
  "model": "nano-banana-2", "resolution": "2k", "ratio": "16:9" }
```

Edges:
```jsonc
{ "source": "kf_S1", "target": "kf_S2", "role": "ref_image" }  // chain
{ "source": "kf_S1", "target": "vid_S1", "role": "ref_image" }  // feed video
{ "source": "kf_S2", "target": "vid_S2", "role": "ref_image" }  // feed video
```

**Prompt tips for keyframe chains:**
- First keyframe: full character description + scene + action + camera
- Subsequent keyframes: "Same character/person from the reference image" + new scene/action
- Keep style keywords consistent across all keyframe prompts
- nano-banana-2 preserves subject identity (face, clothing, colors, textures) via ref_image

### `video` Node — Generated Video Clip

The core execution unit. Each one = one Renoise `task generate` call.

```jsonc
{
  "id": "vid_S1",
  "type": "video",
  "label": "S1 — Hallway Discovery",
  "status": "pending",
  "position": { "x": 600, "y": 200 },

  "shot_id": "S1",
  "order": 1,
  "duration_s": 15,

  // Story content
  "scene": "Apartment hallway, warm amber lighting",
  "story_function": "setup",
  "emotion": "curiosity",
  "energy": 4,
  "action": "Maya walks down hallway, notices a package on her doormat, kneels to pick it up",
  "camera": "Medium tracking shot follows her, slow push in as she kneels",
  "stages": [
    { "time": "0-5s", "description": "Medium shot — Maya walks down the hallway carrying grocery bags. Camera tracks alongside." },
    { "time": "5-10s", "description": "She stops at her door, notices the package. Puts bags down, kneels. Camera pushes in." },
    { "time": "10-15s", "description": "Close-up — picks up package, turns it over. Curious expression. Camera holds." }
  ],
  "dialogue": null,                // { "line": "...", "language": "en", "tone": "..." } | null
  "sound_design": "Footsteps on wooden floor, keys jingling",

  // Characters referenced
  "characters": ["CHAR_MAYA"],

  // Continuity metadata (for canvas display and prompt assembly)
  "continuity_in": null,
  "continuity_out": "Maya kneeling at door, holding wrapped package at chest height",

  // The final prompt — assembled from story content + incoming edges + style
  "prompt": null,
  "prompt_status": "draft",        // draft | ready | submitted

  // Renoise generation result
  "task_id": null,
  "material_id": null,             // if re-uploaded as material (for ref_video chaining)
  "result_url": null,
  "local_path": null,

  // Canvas display
  "thumbnail_url": null,
  "music_section": "intro"
}
```

### `asset` Node — Registered Face-Safe Anchor

```jsonc
{
  "id": "asset_maya",
  "type": "asset",
  "label": "Maya Face Anchor",
  "status": "pending",
  "position": { "x": 250, "y": 300 },

  "asset_id": null,                // Renoise asset ID, populated after registration
  "name": "Maya",
  "source_node": "img_maya_sheet", // the image node this asset is registered from
  "character_id": "CHAR_MAYA"
}
```

### `character` Node — Platform Character Library

```jsonc
{
  "id": "charlib_42",
  "type": "character",
  "label": "Platform Character: Jasmine",
  "status": "completed",
  "position": { "x": 100, "y": 400 },

  "character_library_id": 42,
  "character_id": "CHAR_JASMINE"
}
```

### `composite` Node — Post-Processed Output

```jsonc
{
  "id": "final_video",
  "type": "composite",
  "label": "Final Cut — 60s",
  "status": "pending",
  "position": { "x": 1000, "y": 300 },

  "operation": "concatenate",       // concatenate | crossfade | add_bgm
  "params": {
    "crossfade_s": 0.3,
    "bgm_path": null
  },
  "local_path": null
}
```

---

## `edges`

Each edge represents a dependency: target node requires source node's output as input. Edges map directly to the Renoise API's `materials` array.

```jsonc
{
  "id": "edge_001",
  "source": "mat_hallway",         // source node ID
  "target": "vid_S1",              // target node ID
  "role": "ref_image"              // the material role / dependency type
}
```

### Edge Roles

These map to Renoise API material roles and other dependency types:

| Role | API Mapping | Source Type | Target Type | Description |
|------|-------------|-------------|-------------|-------------|
| `ref_image` | `{ "id": N, "role": "ref_image" }` | material, image | video, image | Reference image — style/content guidance (image→image for keyframe chains) |
| `ref_video` | `{ "id": N, "role": "ref_video" }` | video (re-uploaded as material) | video | Reference video — motion/style continuity |
| `first_frame` | `{ "id": N, "role": "first_frame" }` | material, image | video | Pin the first frame |
| `last_frame` | `{ "id": N, "role": "last_frame" }` | material, image | video | Pin the last frame |
| `image1` | `{ "id": N, "role": "image1" }` | material, image | video | Additional reference image |
| `image2` | `{ "id": N, "role": "image2" }` | material, image | video | Additional reference image |
| `reference_image` | `{ "asset_id": N, "role": "reference_image" }` | asset | video | Face-safe asset anchor |
| `character_ref` | `{ "character_id": N, "role": "reference_image" }` | character | video | Platform character anchor |
| `source_material` | N/A (internal) | image | asset | Image used to register an asset |
| `clip_input` | N/A (internal) | video | composite | Video clip input for concatenation |
| `style_anchor` | Same as `ref_image` but semantically tagged | image, material | video | Concept art applied to all video nodes |

### Edge Constraints (from Renoise API)

Three mutually exclusive input modes per video node — **cannot mix**:

1. **First frame only**: one `first_frame` edge
2. **First + last frame**: one `first_frame` + one `last_frame` edge
3. **Multimodal reference**: any combination of `ref_image` (1-9), `ref_video` (0-3), `reference_image`, `character_ref`

A video node cannot have `first_frame` AND `ref_image` edges simultaneously.

---

## `characters`

Character definitions, referenced by video nodes.

```jsonc
{
  "id": "CHAR_MAYA",
  "name": "Maya",
  "appearance": "East Asian woman, late 20s, shoulder-length black hair with subtle auburn highlights...",
  "wardrobe": "Oversized cream-colored chunky-knit wool cardigan...",
  "signature_details": "Small gold hoop earrings, thin gold chain bracelet...",
  "voice_tone": "Warm, curious, slightly husky",
  "segments": ["S1", "S2", "S3", "S4"]
}
```

Character anchor strategy is expressed via the **graph structure** (not a field):
- `user_asset`: image node → asset node → (reference_image edge) → video nodes
- `character_library`: character node → (character_ref edge) → video nodes
- `text_only`: no asset/character node, character info embedded in prompt text only

---

## `variant_groups`

A variant group represents a single design need (e.g. "Maya's character design") where multiple candidates are generated for the user to choose from. This is the core mechanism for the DESIGN and STORYBOARD stages.

```jsonc
{
  "id": "vg_char_maya",              // unique variant group ID
  "label": "Maya Character Design",
  "purpose": "character_sheet",      // character_sheet | scene_ref | concept_art | keyframe
  "stage": "design",                // design | storyboard — which stage generates this group
  "shot_id": null,                   // for keyframe groups: which shot this keyframe is for
  "variant_count": 3,                // how many candidates to generate (2-3 typical)
  "candidates": ["img_maya_v1", "img_maya_v2", "img_maya_v3"],  // node IDs of candidate image nodes
  "selected": null,                  // node ID of the user's choice, null until selected
  "base_prompt": "Character reference sheet for Maya. East Asian woman, late 20s...",
  "variant_hints": [                 // optional per-variant prompt tweaks
    "softer features, warmer expression",
    "more angular features, confident expression",
    "rounder face, gentle expression"
  ]
}
```

### Variant Lifecycle

1. **Create**: during DESIGN or STORYBOARD, create the variant group + N candidate `image` nodes with `status: "candidate"`
2. **Generate**: generate all candidates in parallel (same phase)
3. **Present**: show all completed candidates to user side by side
4. **Select**: user picks one → set `selected`, mark winner `status: "selected"`, others `status: "rejected"`
5. **Wire**: only the selected node gets downstream edges (to asset registration, to video nodes, etc.)

### Variant Group Rules

- All candidates must be `image` nodes
- `selected` must be a member of `candidates`
- Downstream edges from the group are blocked until `selected` is set
- Rejected nodes retain `result_url` for reference but have no downstream edges
- The `variant_count` is a guide, not enforced — user can request more if none satisfy
- For keyframe groups, the selected keyframe from the previous shot feeds as `ref_image` into the next shot's candidate generation (keyframe chain with variants)

---

## `style_guide`

Global style applied to all video nodes. Not a node itself — instead expressed as edges from a style anchor node (if any) to all video nodes.

```jsonc
{
  "visual_style": "Cinematic suspense drama, shallow depth of field, subtle film grain",
  "color_palette": ["warm amber", "cool blue shadows", "warm gold climax"],
  "lighting": "Soft golden hour side-lighting through large windows",
  "audio_style": "Subtle tension underscore building to wonder",
  "negative_constraints": "No text, subtitles, watermarks, or logos."
}
```

If a concept art style anchor exists, it's an `image` node with `style_anchor` edges to every video node. The style_guide text is still needed for prompt assembly (the text portion of the style).

---

## `execution`

Derived from DAG topology. The DAG already encodes execution order — a video node can execute only when all incoming edges are resolved.

```jsonc
{
  "estimated_credits": 1400,
  "actual_credits_spent": 0,
  "execution_order": [
    { "phase": 1, "stage": "design", "nodes": ["img_maya_v1","img_maya_v2","img_maya_v3","img_room_v1","img_room_v2","img_concept_v1","img_concept_v2"], "parallel": true },
    { "phase": 2, "stage": "design", "action": "user_selection", "variant_groups": ["vg_char_maya","vg_scene_room","vg_concept"] },
    { "phase": 3, "stage": "design", "nodes": ["asset_maya"], "parallel": false, "depends_on": ["vg_char_maya.selected"] },
    { "phase": 4, "stage": "storyboard", "nodes": ["kf_S1_v1","kf_S1_v2","kf_S1_v3"], "parallel": true },
    { "phase": 5, "stage": "storyboard", "action": "user_selection", "variant_groups": ["vg_kf_S1"] },
    { "phase": 6, "stage": "storyboard", "nodes": ["kf_S2_v1","kf_S2_v2","kf_S2_v3"], "parallel": true, "depends_on": ["vg_kf_S1.selected"] },
    { "phase": 7, "stage": "storyboard", "action": "user_selection", "variant_groups": ["vg_kf_S2"] },
    { "phase": 8, "stage": "generate", "nodes": ["vid_S1", "vid_S2"], "parallel": true },
    { "phase": 9, "stage": "generate", "nodes": ["vid_S3"], "parallel": false, "depends_on": ["vid_S2"] },
    { "phase": 10, "stage": "generate", "nodes": ["vid_S4"], "parallel": false, "depends_on": ["vid_S3"] },
    { "phase": 11, "stage": "assemble", "nodes": ["final_video"], "parallel": false, "depends_on": ["vid_S1","vid_S2","vid_S3","vid_S4"] }
  ]
}
```

Execution phases now include `stage` tags and `user_selection` actions. The DAG cannot advance past a selection phase until the user confirms their choices.

---

## `budget`

```jsonc
{
  "available_credits": 5000,
  "estimated_total": 1400,
  "estimated_breakdown": {
    "images": 200,
    "videos": 1200,
    "assets": 0
  },
  "spent": 0
}
```

---

## Complete Example: Mystery Package

```jsonc
{
  "version": "2.0",
  "project": {
    "id": "proj_mystery",
    "title": "Mystery Package",
    "brief": "Maya finds a mysterious glowing pocket watch at her door",
    "mode": "C",
    "status": "intake",
    "stage_gates": { "intake": false, "design": false, "script": false, "storyboard": false },
    "ratio": "16:9",
    "target_duration_s": 60,
    "created_at": "2026-04-01T10:00:00Z",
    "updated_at": "2026-04-01T10:00:00Z"
  },

  "nodes": [
    // ── Existing Materials ──
    { "id": "mat_hallway", "type": "material", "label": "Hallway Ref", "status": "completed", "position": { "x": 50, "y": 100 }, "material_id": 53, "local_path": "./materials/hallway.jpg", "analysis": { "media_type": "image", "content_type": "scene", "tags": ["hallway", "warm"], "description": "Warm apartment hallway", "has_face": false, "relevance": "high", "relevance_reason": "Matches S1 hallway scene", "colors": ["amber"], "suitable_roles": ["ref_image"] } },

    // ── DESIGN Stage: Character Variants ──
    { "id": "img_maya_v1", "type": "image", "label": "Maya v1 — soft", "status": "candidate", "position": { "x": 50, "y": 250 }, "purpose": "character_sheet", "variant_group": "vg_char_maya", "prompt": "Character reference sheet for Maya. East Asian woman, late 20s, shoulder-length black hair with subtle auburn highlights, warm ivory skin. Soft features, gentle expression. Multiple angles. Clean white background.", "model": "nano-banana-2", "resolution": "2k", "ratio": "1:1" },
    { "id": "img_maya_v2", "type": "image", "label": "Maya v2 — angular", "status": "candidate", "position": { "x": 50, "y": 350 }, "purpose": "character_sheet", "variant_group": "vg_char_maya", "prompt": "Character reference sheet for Maya. East Asian woman, late 20s, shoulder-length black hair with subtle auburn highlights, warm ivory skin. More angular features, confident expression. Multiple angles. Clean white background.", "model": "nano-banana-2", "resolution": "2k", "ratio": "1:1" },
    { "id": "img_maya_v3", "type": "image", "label": "Maya v3 — round", "status": "candidate", "position": { "x": 50, "y": 450 }, "purpose": "character_sheet", "variant_group": "vg_char_maya", "prompt": "Character reference sheet for Maya. East Asian woman, late 20s, shoulder-length black hair with subtle auburn highlights, warm ivory skin. Rounder face, curious expression. Multiple angles. Clean white background.", "model": "nano-banana-2", "resolution": "2k", "ratio": "1:1" },

    // ── DESIGN Stage: Scene Variants ──
    { "id": "img_room_v1", "type": "image", "label": "Living Room v1 — warm", "status": "candidate", "position": { "x": 50, "y": 600 }, "purpose": "scene_ref", "variant_group": "vg_scene_room", "prompt": "Cozy living room with wooden desk near window, warm table lamp, twilight blue light. Bookshelves, plants. Warm amber tones. Cinematic. No people.", "model": "nano-banana-2", "resolution": "2k", "ratio": "16:9" },
    { "id": "img_room_v2", "type": "image", "label": "Living Room v2 — cool", "status": "candidate", "position": { "x": 50, "y": 700 }, "purpose": "scene_ref", "variant_group": "vg_scene_room", "prompt": "Modern living room with wooden desk near window, cool blue twilight light, minimal warm lamp. Bookshelves, plants. Cooler palette. Cinematic. No people.", "model": "nano-banana-2", "resolution": "2k", "ratio": "16:9" },

    // ── DESIGN Stage: Concept Art Variants ──
    { "id": "img_concept_v1", "type": "image", "label": "Concept v1 — amber", "status": "candidate", "position": { "x": 50, "y": 850 }, "purpose": "concept_art", "variant_group": "vg_concept", "prompt": "Concept art sheet: warm amber suspense drama, apartment interior, golden magical light, pocket watch motif. Film grain, shallow depth of field.", "model": "nano-banana-2", "resolution": "2k", "ratio": "16:9" },
    { "id": "img_concept_v2", "type": "image", "label": "Concept v2 — teal", "status": "candidate", "position": { "x": 50, "y": 950 }, "purpose": "concept_art", "variant_group": "vg_concept", "prompt": "Concept art sheet: teal and gold suspense drama, apartment interior, ethereal magical light, pocket watch motif. Anamorphic lens flares, moody.", "model": "nano-banana-2", "resolution": "2k", "ratio": "16:9" },

    // ── Asset (face-safe, created after DESIGN selection) ──
    { "id": "asset_maya", "type": "asset", "label": "Maya Face Anchor", "status": "pending", "position": { "x": 250, "y": 350 }, "name": "Maya", "source_node": null, "character_id": "CHAR_MAYA" },

    // ── STORYBOARD Stage: Keyframe Variants (created after SCRIPT) ──
    // S1 keyframe variants (no ref_image chain input — first in chain)
    { "id": "kf_S1_v1", "type": "image", "label": "KF S1 v1", "status": "candidate", "position": { "x": 400, "y": 100 }, "purpose": "keyframe", "variant_group": "vg_kf_S1", "prompt": "Maya, East Asian woman late 20s, shoulder-length black hair, cream cardigan, walking down warm amber hallway toward door. Medium tracking shot. Cinematic.", "model": "nano-banana-2", "resolution": "2k", "ratio": "16:9" },
    { "id": "kf_S1_v2", "type": "image", "label": "KF S1 v2", "status": "candidate", "position": { "x": 400, "y": 150 }, "purpose": "keyframe", "variant_group": "vg_kf_S1", "prompt": "Maya, East Asian woman late 20s, shoulder-length black hair, cream cardigan, kneeling at apartment door picking up a brown package. Warm amber hallway. Medium close-up. Cinematic.", "model": "nano-banana-2", "resolution": "2k", "ratio": "16:9" },
    // S2 keyframe variants (ref_image from selected S1 keyframe)
    { "id": "kf_S2_v1", "type": "image", "label": "KF S2 v1", "status": "candidate", "position": { "x": 400, "y": 300 }, "purpose": "keyframe", "variant_group": "vg_kf_S2", "prompt": "Same woman from the reference image, now seated at a wooden desk unwrapping a brown package. Warm lamp, twilight window. Cinematic, medium shot.", "model": "nano-banana-2", "resolution": "2k", "ratio": "16:9" },
    { "id": "kf_S2_v2", "type": "image", "label": "KF S2 v2", "status": "candidate", "position": { "x": 400, "y": 350 }, "purpose": "keyframe", "variant_group": "vg_kf_S2", "prompt": "Same woman from the reference image, now at desk lifting a pocket watch from wrapping paper. Close-up on hands and watch. Warm lamp. Cinematic.", "model": "nano-banana-2", "resolution": "2k", "ratio": "16:9" },
    // S3 and S4 keyframes follow same pattern...

    // ── Video Clips ──
    { "id": "vid_S1", "type": "video", "label": "S1 — Hallway", "status": "pending", "position": { "x": 700, "y": 100 }, "shot_id": "S1", "order": 1, "duration_s": 15, "scene": "Apartment hallway", "story_function": "setup", "emotion": "curiosity", "energy": 4, "action": "Maya walks down hallway, finds package", "camera": "Tracking → push in", "stages": [{"time":"0-5s","description":"..."},{"time":"5-10s","description":"..."},{"time":"10-15s","description":"..."}], "characters": ["CHAR_MAYA"], "continuity_in": null, "continuity_out": "Maya holding package at door", "prompt": null, "prompt_status": "draft" },
    { "id": "vid_S2", "type": "video", "label": "S2 — Unwrapping", "status": "pending", "position": { "x": 700, "y": 300 }, "shot_id": "S2", "order": 2, "duration_s": 15, "scene": "Living room desk", "story_function": "discovery", "emotion": "wonder", "energy": 5, "action": "Maya unwraps package, discovers pocket watch", "camera": "Medium → close-up hands", "stages": [{"time":"0-5s","description":"..."},{"time":"5-10s","description":"..."},{"time":"10-15s","description":"..."}], "characters": ["CHAR_MAYA"], "continuity_in": "Maya enters room with package", "continuity_out": "Maya holding watch up to light", "prompt": null, "prompt_status": "draft" },
    { "id": "vid_S3", "type": "video", "label": "S3 — Awakening", "status": "pending", "position": { "x": 900, "y": 300 }, "shot_id": "S3", "order": 3, "duration_s": 15, "scene": "Same living room", "story_function": "escalation", "emotion": "awe", "energy": 8, "action": "Watch spins backward, golden light bursts outward", "camera": "Push in → wide reveal", "stages": [{"time":"0-5s","description":"..."},{"time":"5-10s","description":"..."},{"time":"10-15s","description":"..."}], "characters": ["CHAR_MAYA"], "continuity_in": "Maya seated with watch near face", "continuity_out": "Standing in golden-lit room", "prompt": null, "prompt_status": "draft" },
    { "id": "vid_S4", "type": "video", "label": "S4 — Wonder", "status": "pending", "position": { "x": 1100, "y": 300 }, "shot_id": "S4", "order": 4, "duration_s": 15, "scene": "Same living room, golden aftermath", "story_function": "resolution", "emotion": "wonder", "energy": 5, "action": "Glow settles, Maya places watch on desk, steps back", "camera": "Medium → slow pull back", "stages": [{"time":"0-5s","description":"..."},{"time":"5-10s","description":"..."},{"time":"10-15s","description":"..."}], "characters": ["CHAR_MAYA"], "continuity_in": "Standing with glowing watch", "continuity_out": "Watch pulsing softly on desk", "prompt": null, "prompt_status": "draft" },

    // ── Final Output ──
    { "id": "final", "type": "composite", "label": "Final Cut — 60s", "status": "pending", "position": { "x": 1300, "y": 250 }, "operation": "concatenate" }
  ],

  "edges": [
    // Style anchor → ALL video nodes (source set after DESIGN selection)
    { "id": "e_style_s1", "source": null, "target": "vid_S1", "role": "style_anchor" },
    { "id": "e_style_s2", "source": null, "target": "vid_S2", "role": "style_anchor" },
    { "id": "e_style_s3", "source": null, "target": "vid_S3", "role": "style_anchor" },
    { "id": "e_style_s4", "source": null, "target": "vid_S4", "role": "style_anchor" },

    // Character asset → video nodes (face-safe reference_image)
    { "id": "e_maya_s1", "source": "asset_maya", "target": "vid_S1", "role": "reference_image" },
    { "id": "e_maya_s2", "source": "asset_maya", "target": "vid_S2", "role": "reference_image" },
    { "id": "e_maya_s3", "source": "asset_maya", "target": "vid_S3", "role": "reference_image" },
    { "id": "e_maya_s4", "source": "asset_maya", "target": "vid_S4", "role": "reference_image" },

    // Image → Asset (source set after DESIGN selection)
    { "id": "e_img_asset", "source": null, "target": "asset_maya", "role": "source_material" },

    // Environment refs (source set after DESIGN selection)
    { "id": "e_hall_s1", "source": "mat_hallway", "target": "vid_S1", "role": "ref_image" },
    { "id": "e_room_s2", "source": null, "target": "vid_S2", "role": "ref_image" },

    // Keyframe → video (source set after STORYBOARD selection)
    { "id": "e_kf_s1", "source": null, "target": "vid_S1", "role": "ref_image" },
    { "id": "e_kf_s2", "source": null, "target": "vid_S2", "role": "ref_image" },

    // Keyframe chain (selected S1 kf → S2 kf variants as ref_image)
    // These edges are created dynamically after each keyframe selection

    // Serial ref_video chain (S2 → S3 → S4)
    { "id": "e_s2_s3", "source": "vid_S2", "target": "vid_S3", "role": "ref_video" },
    { "id": "e_s3_s4", "source": "vid_S3", "target": "vid_S4", "role": "ref_video" },

    // All clips → final composite
    { "id": "e_f1", "source": "vid_S1", "target": "final", "role": "clip_input" },
    { "id": "e_f2", "source": "vid_S2", "target": "final", "role": "clip_input" },
    { "id": "e_f3", "source": "vid_S3", "target": "final", "role": "clip_input" },
    { "id": "e_f4", "source": "vid_S4", "target": "final", "role": "clip_input" }
  ],

  "variant_groups": [
    {
      "id": "vg_char_maya",
      "label": "Maya Character Design",
      "purpose": "character_sheet",
      "stage": "design",
      "shot_id": null,
      "variant_count": 3,
      "candidates": ["img_maya_v1", "img_maya_v2", "img_maya_v3"],
      "selected": null,
      "base_prompt": "Character reference sheet for Maya. East Asian woman, late 20s...",
      "variant_hints": ["softer features", "angular features", "rounder face"]
    },
    {
      "id": "vg_scene_room",
      "label": "Living Room Design",
      "purpose": "scene_ref",
      "stage": "design",
      "shot_id": null,
      "variant_count": 2,
      "candidates": ["img_room_v1", "img_room_v2"],
      "selected": null,
      "base_prompt": "Cozy living room with wooden desk near window...",
      "variant_hints": ["warm amber tones", "cooler blue tones"]
    },
    {
      "id": "vg_concept",
      "label": "Style Concept Art",
      "purpose": "concept_art",
      "stage": "design",
      "shot_id": null,
      "variant_count": 2,
      "candidates": ["img_concept_v1", "img_concept_v2"],
      "selected": null,
      "base_prompt": "Concept art sheet for suspense drama...",
      "variant_hints": ["warm amber palette", "teal and gold palette"]
    },
    {
      "id": "vg_kf_S1",
      "label": "S1 Keyframe",
      "purpose": "keyframe",
      "stage": "storyboard",
      "shot_id": "S1",
      "variant_count": 2,
      "candidates": ["kf_S1_v1", "kf_S1_v2"],
      "selected": null,
      "base_prompt": "Maya in warm amber hallway...",
      "variant_hints": ["walking toward door", "kneeling at door"]
    },
    {
      "id": "vg_kf_S2",
      "label": "S2 Keyframe",
      "purpose": "keyframe",
      "stage": "storyboard",
      "shot_id": "S2",
      "variant_count": 2,
      "candidates": ["kf_S2_v1", "kf_S2_v2"],
      "selected": null,
      "base_prompt": "Same woman from the reference image, now at desk...",
      "variant_hints": ["unwrapping package", "lifting pocket watch"]
    }
  ],

  "characters": [
    {
      "id": "CHAR_MAYA",
      "name": "Maya",
      "appearance": "East Asian woman, late 20s, shoulder-length black hair with subtle auburn highlights, warm ivory skin, almond-shaped dark brown eyes, slim build",
      "wardrobe": "Oversized cream-colored chunky-knit wool cardigan over a fitted charcoal cotton turtleneck, high-waisted dark indigo straight-leg jeans, brown leather ankle boots",
      "signature_details": "Small gold hoop earrings, thin gold chain bracelet on left wrist, no rings",
      "voice_tone": "Warm, curious, slightly husky"
    }
  ],

  "style_guide": {
    "visual_style": "Cinematic suspense drama, shallow depth of field, subtle film grain, anamorphic lens flares",
    "color_palette": ["warm amber", "cool blue shadows", "warm gold climax"],
    "lighting": "Soft golden hour side-lighting through large windows, practical lamps as warm fill",
    "audio_style": "Subtle tension underscore building to wonder",
    "negative_constraints": "No text, subtitles, watermarks, or logos."
  },

  "execution": {
    "estimated_credits": 1800,
    "actual_credits_spent": 0,
    "execution_order": [
      { "phase": 1, "stage": "design", "nodes": ["img_maya_v1","img_maya_v2","img_maya_v3","img_room_v1","img_room_v2","img_concept_v1","img_concept_v2"], "parallel": true },
      { "phase": 2, "stage": "design", "action": "user_selection", "variant_groups": ["vg_char_maya","vg_scene_room","vg_concept"] },
      { "phase": 3, "stage": "design", "nodes": ["asset_maya"], "parallel": false },
      { "phase": 4, "stage": "storyboard", "nodes": ["kf_S1_v1","kf_S1_v2"], "parallel": true },
      { "phase": 5, "stage": "storyboard", "action": "user_selection", "variant_groups": ["vg_kf_S1"] },
      { "phase": 6, "stage": "storyboard", "nodes": ["kf_S2_v1","kf_S2_v2"], "parallel": true },
      { "phase": 7, "stage": "storyboard", "action": "user_selection", "variant_groups": ["vg_kf_S2"] },
      { "phase": 8, "stage": "generate", "nodes": ["vid_S1","vid_S2"], "parallel": true },
      { "phase": 9, "stage": "generate", "nodes": ["vid_S3"], "parallel": false },
      { "phase": 10, "stage": "generate", "nodes": ["vid_S4"], "parallel": false },
      { "phase": 11, "stage": "assemble", "nodes": ["final"], "parallel": false }
    ]
  },

  "budget": {
    "available_credits": 5000,
    "estimated_total": 1800,
    "estimated_breakdown": {
      "design_variants": 350,
      "storyboard_variants": 200,
      "videos": 1200,
      "assets": 0
    },
    "spent": 0
  }
}
```

---

## DAG Validation Rules

### Structural
1. No cycles — strictly a DAG
2. Every edge's `source` and `target` reference existing node IDs
3. Every video node must have at least a prompt OR incoming edges
4. `composite` nodes must have ≥1 `clip_input` edge

### Renoise API Constraints
5. **Mutual exclusivity per video node**: cannot have `first_frame` edges AND `ref_image`/`ref_video` edges simultaneously
6. **ref_image limit**: max 9 `ref_image` + `style_anchor` edges per video node
7. **ref_video limit**: max 3 `ref_video` edges per video node
8. **Face safety**: `material` nodes with `analysis.has_face: true` must NOT have `ref_image` edges to video nodes — use `asset` or `character` nodes instead

### Plan Quality
9. **Style consistency**: if any video node has a `style_anchor` edge, ALL video nodes must have one from the same source
10. Characters appearing in 2+ video nodes should have `reference_image` edges (not text-only)
11. Every `serial` transition (ref_video edge between video nodes) must have matching `continuity_out` → `continuity_in`
12. Budget: `execution.estimated_credits` ≤ `budget.available_credits`

### Variant Groups
13. All `candidates` in a variant group must be `image` nodes
14. `selected` must be a member of `candidates` (or null)
15. Edges with `source: null` are **deferred edges** — their source is set when the corresponding variant group selection is made
16. Downstream nodes cannot execute while any upstream variant group has `selected: null`
17. Rejected candidate nodes (`status: "rejected"`) are excluded from execution and edge resolution

---

## Execution Semantics

The executor walks the DAG in topological order:

1. **Resolve phase**: for each node, check all incoming edges are from `completed` nodes
2. **Execute phase**: based on node type:
   - `material`: already completed (uploaded during INGEST)
   - `image`: `renoise-cli task generate --model nano-banana-2 ...` → download → `material upload` → set `material_id`
   - `asset`: `renoise-cli asset register <material_id>` → set `asset_id`
   - `video`: assemble `--materials` flag from incoming edges → `renoise-cli task generate` → download
   - `composite`: `ffmpeg -f concat ...`
3. **Propagate**: when a video node completes and has an outgoing `ref_video` edge, auto-upload the video as material and set the `material_id` for the edge's source resolution

### Edge → CLI Flag Translation

| Edge Role | CLI Flag |
|-----------|----------|
| `ref_image` | `--materials "MATERIAL_ID:ref_image"` |
| `style_anchor` | `--materials "MATERIAL_ID:ref_image"` (same API role) |
| `ref_video` | `--materials "MATERIAL_ID:ref_video"` |
| `first_frame` | `--materials "MATERIAL_ID:first_frame"` |
| `last_frame` | `--materials "MATERIAL_ID:last_frame"` |
| `image1` | `--materials "MATERIAL_ID:image1"` |
| `image2` | `--materials "MATERIAL_ID:image2"` |
| `reference_image` | `--materials "asset:ASSET_ID:reference_image"` |
| `character_ref` | `--characters "CHAR_LIB_ID:reference_image"` |
| `source_material` | internal — triggers `asset register` |
| `clip_input` | internal — used by ffmpeg concat |
