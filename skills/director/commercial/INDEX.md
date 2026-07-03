# Commercial Video — Index

E-commerce, advertising, and brand video production guide. Break down vague creative briefs into precise, controllable AI video prompts using the six-dimension formula, then generate via the Renoise API.

---

## Step 1: Identify the Scenario

Route by asking these questions in order — stop at the first match:

1. **Does the user want a presenter speaking on camera?** ("口播", "带货", "测评", "主播出镜") → **D**
2. **Does the user provide a reference video to replicate?** → **A**
3. **Is this a brand film longer than 5s, or explicitly multi-shot?** → **C**
4. **Otherwise** (quick single-shot product showcase, ≤5s) → **B**

| Scenario | Trigger | Read |
|----------|---------|------|
| **A — Viral Replication** | User provides a viral/trending video and wants to replicate its style with their own product | `Read ${CLAUDE_SKILL_DIR}/commercial/scenario-a-viral.md` |
| **B — Product Showcase** | Single-shot product close-up, ≤5s — one API call, product is the sole subject | `Read ${CLAUDE_SKILL_DIR}/commercial/scenario-b-brand.md` |
| **C — Brand Film / TVC** | Brand film >5s, or multi-shot narrative — may include product-only shots as segments | `Read ${CLAUDE_SKILL_DIR}/commercial/scenario-c-tvc.md` |
| **D — UGC / Live-Presenter** | Real person presenting on camera — review, testing, talking-head endorsement, 带货口播 | `Read ${CLAUDE_SKILL_DIR}/commercial/scenario-d-ugc.md` |


---

## Core Formula

Every prompt must cover these six dimensions, assembled in this order:

```
Subject + Selling-Point Action + Scene & Tone + Camera Language + Audio + Post-Production Constraints
```

| Dimension | Definition | Ask yourself |
|-----------|-----------|-------------|
| **Subject** | The absolute visual center — determines audience identification and product perception | What should the viewer see first? |
| **Selling-Point Action** | Translate abstract sales copy into concrete micro-actions or pain-point scenarios | What visible action makes the viewer "see" the selling point? |
| **Scene & Tone** | Shooting environment, lighting, art direction | Where should the viewer feel they are? |
| **Camera Language** | Specific angles and transitions that create visual hooks and impact | How should the camera move to grab attention? |
| **Audio** | Sound effects / beat sync — pre-embed visual actions that align with audio cues | Which moment must synchronize with sound? |
| **Post-Production Constraints** | Reserve space for overlays; set negative rules (prohibitions) | What flaws must never appear on screen? |

---

## Asset Reference Rules

Use `@` references in prompts to anchor visuals to the user's assets. Each reference must state **what is being referenced** and **what it's being used for**:

```
the serum glass bottle from @Image 1         ← what was referenced + what info was extracted
reference the camera movement of @Video 1    ← explicitly only partial features, not everything
```

| Reference type | Prompt syntax | Renoise `--materials` role | Notes |
|---------------|--------------|---------------------------|-------|
| Product / scene image (no faces) | `@Image N` | `ID:ref_image` | Up to 9 |
| Scene image with incidental faces (face NOT the reference target) | `@Image N` | `ID:ref_image` | Treat as scene ref, no registration needed |
| Person image where face IS the character identity | `@Image N` | `asset:ID:reference_image` | Must `asset register` first |
| Reference video (chaining own segments only) | `@Video N` | `ID:ref_video` | Up to 3; NOT for external style — use Gemini analysis instead |
| First frame | `@Image N` | `ID:first_frame` | Mutually exclusive with ref_image |

**Face Privacy Rule**: Renoise blocks ANY image with a recognizable human face passed as `ref_image` — even if the face isn't the intended reference target. **Any image containing a human face must be registered as a User Asset before use.** Do this automatically in Phase 4 Step 1 without asking the user.

```bash
node renoise-cli.mjs asset register <material_id> --name "<name>"
# → returns asset_id; use as asset:ID:reference_image in --materials
```

---

## Common Workflow

### Phase 1: Requirement Gathering & Asset Analysis

1. **Identify the scenario** — match to A/B/C/D using the table above, then load that scenario file
2. **Asset inventory** — view each image/video the user provides:
   - Images: Read tool → analyze (product? scene? person?)
   - Videos: use Gemini analysis if available; otherwise ask user to describe key frames
3. **Tag each asset**:
   - `has_face: true` → must register as User Asset in Phase 4 (or Phase 1.5 for Scenario D)
   - Assign role: subject anchor / scene calibration / camera reference / beat-sync control
4. **Confirm generation parameters**:
   - Duration: 4–15s per segment (over 15s → multi-segment chaining)
   - Aspect ratio: based on user's request
   - Model:

| Model | Duration | Resolution | Notes |
|-------|----------|------------|-------|
| `renoise-2.0` | 4–15s | 720p / 1080p | Default; ref image ≤9, ref video ≤3, audio generation |
| `renoise-2.0-fast` | 4–15s | 720p only | Faster & cheaper |
| `happyhorse-1.0` | 3–15s | 720p / 1080p | No `last_frame`, no ref video |
| `kling-3.0-omni` | 3/5/10/15s | 720p / 1080p | ref image ≤7, ref video ≤1; no audio; prompt ≤2500 chars |

> **Scenario D only**: After Phase 1, execute Phase 1.5 (asset pre-upload) before writing any prompt. See `scenario-d-ugc.md`.

### Phase 2: Prompt Construction

Build the prompt following the matched scenario file's structure. The six-dimension formula always applies, but the organization (paragraph-per-dimension / shot-by-shot / second-by-second timeline) is scenario-specific.

**Language rule**: Draft in the user's language. Translate to English in Phase 4 Step 3 — never before user confirmation. **Exception: Scenario D with dialogue — keep the entire prompt in the user's language permanently.**

**DO:**
- Place `@` references immediately next to their descriptions, stating what was referenced and what it's used for
- When referencing a video, explicitly annotate "reference only XX, NOT YY"
- Use concrete micro-actions — never abstract adjectives like "premium" or "cinematic"
- Include at least 2 negative rules (prohibitions) for the most failure-prone elements

**DON'T:**
- Write vague terms → replace with specific lighting / color / material / motion descriptions
- Omit any of the six dimensions
- Assume the AI understands brand tone → anchor every visual standard with `@` assets

> **⚠️ Physical Continuity Rule (applies to all scenarios and products)**
>
> The model cannot generate implicit state transitions — it teleports between states (cap on → product applied; sealed bag → open; folded clothing → worn). Any product moving from **packaged/stored state** to **in-use state** must use one of two strategies:
>
> - **Skip the transition**: begin the timeline with the product already in its in-use state. Never mention the packaged state in the same or adjacent time segment.
> - **Make it explicit**: dedicate a separate time segment to the preparation action ("presenter unscrews the cap and sets it aside"), then start the demo in the next segment.
>
> Applies universally: bottle caps, sealed pouches, cardboard boxes, clothing tags, zip-lock bags, foil wrappers, shoe boxes — any packaging.

> **⚠️ Action Granularity Rule (applies to all scenarios and products)**
>
> Never compress a multi-step physical process into one sentence. The model renders a single sentence as a single instantaneous event.
>
> **Minimum 3 sub-steps per demo action**, each on its own sentence, each describing the **mid-action / incomplete state** — not the end state:
>
> | ❌ Compressed (avoid) | ✅ Granular (target) |
> |---|---|
> | "pumps foundation onto cheek and blends it in" | ① A small pump of product lands on the cheekbone. ② One fingertip gently taps the center — product not yet spread. ③ Slow outward circles; edges still unblended at the frame edge. |
> | "scrubs the serum onto her arm and it absorbs" | ① Drops serum onto the back of the hand, lets it pool. ② Fingertip spreads it across half the skin — other half still bare. ③ Presses palm flat; skin slowly drinks it in. |
> | "tries on the jacket and zips it up" | ① Slides one arm in, sleeve hanging loose. ② Pulls the other side across the chest, fabric slightly bunched. ③ Zipper drawn up slowly, jacket settling into shape. |
>
> Add pace qualifiers to each sub-step: *slowly*, *gently*, *just barely*, *one corner at a time*. Give the model a continuous journey, not a jump cut.

### Phase 3: User Confirmation

> 🚨 **HARD RULE — Language**: The entire Phase 3 preview MUST be written in the **user's language** (Chinese if user spoke Chinese, etc.). This includes every prompt dimension, every description, every label. **NEVER show English prompt text to the user during preview.** English translation happens ONLY in Phase 4 Step 3, silently, right before the API call. Showing English here is a workflow violation.

Present the full prompt in the standard preview format and wait for explicit confirmation before Phase 4:

```
--- Prompt Preview ---

[Full prompt in USER'S LANGUAGE, each dimension as its own paragraph, tagged with [维度名称] / [Dimension Name] in user's language]

--- Asset Mapping ---
@Image 1 → [filename / description] → Renoise role: ref_image
@Video 1 → [filename / description] → Gemini analysis only (NOT uploaded to Renoise)

--- Generation Parameters ---
Model: renoise-2.0
Duration: N seconds
Aspect ratio: W:H
Estimated cost: [show if queryable]
---
```

> **Scenario C** uses a different storyboard preview format. See `scenario-c-tvc.md`.

The user may request: modify a dimension → change only that dimension, re-present | adjust an asset role → update mapping, re-present | switch scenario → return to Phase 2.

### Phase 4: Asset Upload & Video Generation

**Step 1 — Upload assets & auto-register faces**

> **Scenario D**: If Phase 1.5 was executed, person and product assets are already uploaded — skip re-uploading. Only upload NEW materials not handled in Phase 1.5.

```bash
# Upload
node renoise-cli.mjs material upload <file_path>
# Auto-register if has_face: true (do NOT wait or ask user)
node renoise-cli.mjs asset register <material_id> --name "<descriptive name>"
# ~30–60 seconds. Wait for completion before proceeding.
```

**Step 2 — Build the final asset mapping table**

Record all `material_id` and `asset_id` values. Update roles: `ref_image` → `asset:ID:reference_image` for any registered face assets.

**Step 3 — Prompt language decision**

- **With dialogue (Scenario D)**: Keep prompt in the user's language. Do NOT translate.
- **Without dialogue (A/B/C)**: Translate to English. Use professional cinematography terminology. Keep selling-point action descriptions precise.

**Step 4 — Generate**

```bash
node renoise-cli.mjs task generate \
  --prompt "<prompt>" \
  --model renoise-2.0 \
  --duration <seconds> \
  --ratio <ratio> \
  --materials "<id1>:<role1>,<id2>:<role2>"
```

> **Scenario C multi-clip**: See assembly instructions in `scenario-c-tvc.md` Phase 4 Step 5.

**Step 5 — Multi-segment chaining** (only when total video exceeds 15s)

```bash
node renoise-cli.mjs task chain <segment1_task_id>
# → prints material_id for ref_video
node renoise-cli.mjs task generate \
  --prompt "segment 2 prompt" \
  --materials "<chained_id>:ref_video,<other_materials>"
```

**Step 6 — Return results**

Present: video URL, cover image, generation time. If unsatisfactory, ask which dimension to adjust and regenerate.

---

## Renoise CLI Reference

```bash
# Upload material
node renoise-cli.mjs material upload <path>

# Register face as User Asset
node renoise-cli.mjs asset register <material_id> --name "name"

# Generate video (blocking)
node renoise-cli.mjs task generate \
  --prompt "prompt" --model renoise-2.0 \
  --duration 10 --ratio 9:16 \
  --materials "id1:ref_image,asset:id2:reference_image"

# Chain segment for ref_video
node renoise-cli.mjs task chain <task_id>

# Check balance
node renoise-cli.mjs credit me

# Estimate cost
node renoise-cli.mjs credit estimate --model renoise-2.0 --duration 10
```

**Materials mode — mutually exclusive, do not mix:**

| Mode | Role combination | Use case |
|------|-----------------|----------|
| First frame | `first_frame` | Lock the opening frame |
| First + last frame | `first_frame` + `last_frame` | Lock opening and ending |
| Multimodal reference | `ref_image` / `ref_video` / `reference_image` | Most common |

**Timeout note**: Multi-anchor generations take 8–12 minutes per segment. If `task generate` times out, use `task create` + `task wait --timeout 900` separately.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `PrivacyInformation` error | Register face image as User Asset first |
| 402 insufficient credits | `credit me`, inform user, suggest top-up at https://www.renoise.ai |
| Character drifts between segments | Use User Asset + copy full character description verbatim |
| Video ignores actions in prompt | Prompt too dense — reduce to 3–4 actions per 5s window |
| Video looks incoherent | Simplify: 2 camera stages, one mood, fewer actions |
| Segments don't connect | Use tail-frame → `first_frame` for exact state handoff, or `ref_video` for motion carryover |

---

## Important Notes

1. **Language**: Draft in user's language. Translate to English before API call — except Scenario D (dialogue prompts stay in user's language for lip-sync)
2. **Asset limits**: renoise-2.0 supports up to 9 ref_images + 3 ref_videos
3. **Duration**: 4–15s per segment; use `task chain` for longer videos
4. **Face privacy**: Any image with a human face → User Asset registration required
5. **Aspect ratio**: Once confirmed, all reference images should match the same ratio
6. **Cost**: Use `credit estimate` before generating; notify user proactively if balance is low
