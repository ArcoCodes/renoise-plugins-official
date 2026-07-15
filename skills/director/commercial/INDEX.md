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
| Scene image with incidental faces (face NOT the reference target) | `@Image N` | `ID:ref_image` | Treat as scene ref |
| Person image where face IS the character identity | `@Image N` | `ID:ref_image` | On seedance the face is auto-facepassed on submit; reuse the same material ID across segments for consistency |
| Reference video (chaining own segments only) | `@Video N` | `ID:ref_video` | Up to 3; NOT for external style — use Gemini analysis instead |
| First frame | `@Image N` | `ID:first_frame` | Mutually exclusive with ref_image |

**Face Rule**: On the `seedance-2.0` series, a face image is passed straight as `ID:ref_image` — it is auto-facepassed on submit, so there is no registration step. For a character appearing across multiple segments, upload the face/character-sheet image once and reuse the **same material ID** every time (references dedupe by material ID). On non-seedance models a face may still be blocked by the provider's content review — prefer a seedance model or a text-only description.

---

## Common Workflow

### Phase 1: Requirement Gathering & Asset Analysis

1. **Identify the scenario** — match to A/B/C/D using the table above, then load that scenario file
2. **Asset inventory** — view each image/video the user provides:
   - Images: Read tool → analyze (product? scene? person?)
   - Videos: use Gemini analysis if available; otherwise ask user to describe key frames
3. **Tag each asset**:
   - `has_face: true` → on seedance, use the image directly as `ID:ref_image` (auto-facepassed on submit); for a recurring character reuse the same material ID across segments
   - Assign role: subject anchor / scene calibration / camera reference / beat-sync control
4. **Confirm generation parameters**:
   - Duration: 4–15s per segment (over 15s → multi-segment chaining)
   - Aspect ratio: based on user's request
   - Model:

| Model | Duration | Resolution | Notes |
|-------|----------|------------|-------|
| `seedance-2.0` | 4–15s | 480p / 720p / 1080p / 4k (default 720p) | Default; ref image ≤9, ref video ≤3, audio ≤3, audio generation |
| `seedance-2.0-fast` | 4–15s | 480p / 720p | Faster & cheaper; no 1080p/4k |
| `seedance-2.0-mini` | 4–15s | 480p / 720p | Cheapest Seedance tier; no 1080p/4k |
| `happyhorse-1.0` | 3–15s | 720p / 1080p | No `last_frame`, no ref video |
| `kling-3.0-omni` | default 5s; with ref_video ≤10s; else 3–15s | 720p / 1080p | ref image ≤7, ref video ≤1; no audio; prompt ≤2500 chars |

> **Default models**: the table above lists **video** models — default `seedance-2.0` unless the user names another. Any **image** generated in this flow (presenter portrait, character concept, scene/background concept) defaults to **`seedream-5-0-pro`**; switch off it only when the shot needs `4k`, an extreme banner ratio, or text/logo typography (`seedream-5-0-pro` is capped at `1k`/`2k` and the 8 common ratios — see `references/visual-dev.md`). In every case the default gives way the moment the user names a specific model.

> **Scenario D only**: After Phase 1, execute Phase 1.5 (asset pre-upload) before writing any prompt. See `scenario-d-ugc.md`.

### Phase 2: Prompt Construction

Build the prompt following the matched scenario file's structure. The six-dimension formula always applies, but the organization (paragraph-per-dimension / shot-by-shot / second-by-second timeline) is scenario-specific.

**Language rule**: Draft in the user's language. Translate to English in Phase 4 Step 3 — never before user confirmation. **Spoken-language Hard Rule (any scenario with dialogue / voiceover / narration, not only D)**: confirm the spoken language with the user before writing prompts, write each spoken line **verbatim in that confirmed language** (translating the line changes the voice's language), and for a dialogue-dense segment keep the whole segment prompt in the spoken language. In practice this is always in play for Scenario D (presenter 口播) and for any Scenario C brand film that carries voiceover/narration.

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
Model: seedance-2.0
Duration: N seconds
Aspect ratio: W:H
Spoken language: [only if the segment has dialogue/voiceover — label it explicitly, e.g. "口播：中文"]
Estimated cost: [from `credit estimate`]
---
```

> **Scenario C** uses a different storyboard preview format. See `scenario-c-tvc.md`.

The user may request: modify a dimension → change only that dimension, re-present | adjust an asset role → update mapping, re-present | switch scenario → return to Phase 2.

### Phase 4: Asset Upload & Video Generation

**Step 1 — Upload assets**

> **Scenario D**: If Phase 1.5 was executed, person and product assets are already uploaded — skip re-uploading. Only upload NEW materials not handled in Phase 1.5.

```bash
# Upload each asset (face images included — seedance auto-facepasses on submit, no registration)
node renoise-cli.mjs material upload <file_path>
# → returns material_id
```

**Step 2 — Build the final asset mapping table**

Record all `material_id` values and their roles. Face images use `ID:ref_image` directly; reuse the same material ID for a character that recurs across segments.

**Step 3 — Prompt language decision**

- **With dialogue/voiceover (any scenario, always Scenario D)**: Keep the spoken line — and, for dialogue-dense segments, the whole segment prompt — in the confirmed spoken language. Do NOT translate the spoken line.
- **Without dialogue**: Translate to English. Use professional cinematography terminology. Keep selling-point action descriptions precise.

**Step 4 — Generate**

```bash
node renoise-cli.mjs task generate \
  --prompt "<prompt>" \
  --model seedance-2.0 \
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
# Upload material (face images included — no registration needed)
node renoise-cli.mjs material upload <path>

# Generate video (blocking)
node renoise-cli.mjs task generate \
  --prompt "prompt" --model seedance-2.0 \
  --duration 10 --ratio 9:16 \
  --materials "id1:ref_image,id2:ref_image"

# Chain segment for ref_video
node renoise-cli.mjs task chain <task_id>

# Check balance
node renoise-cli.mjs credit me

# Estimate cost
node renoise-cli.mjs credit estimate --model seedance-2.0 --duration 10
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
| `PrivacyInformation` error | Only on non-seedance models or output review — seedance input faces are auto-facepassed. Switch to a seedance model or describe the person in text |
| Face review rejects an image (task `failed` + `INPUT_IMAGE_*`) | Swap the reference image and retry |
| 402 insufficient credits | `credit me`, inform user, suggest top-up at https://www.renoise.ai |
| Character drifts between segments | Reuse the same face/character-sheet material ID as `ref_image` in every segment + copy full character description verbatim |
| Video ignores actions in prompt | Prompt too dense — reduce to 3–4 actions per 5s window |
| Video looks incoherent | Simplify: 2 camera stages, one mood, fewer actions |
| Segments don't connect | Tail-frame handoff: if the segment carries any other `ref_image` (product/scene — the usual case), attach the tail frame as `TAIL_ID:ref_image:0` + open the prompt with "Use @Image1 as the first frame." (`first_frame` is mutually exclusive with `ref_image`); use native `first_frame` only when there is no other image reference; or `ref_video` for motion carryover |

**Content-moderation errors** (`INPUT_*` / `OUTPUT_*`): the seedance/seedream pipelines are relatively permissive, but four categories are hard blocks that rewording will not pass — political content, religiously sensitive content, sexual content involving minors, and copyrighted content (well-known IP / recognizable public figures). If the prompt or materials touch these, tell the user the platform does not support it rather than retrying; otherwise adjust wording / swap materials and retry.

---

## Important Notes

1. **Language**: Draft in user's language. Translate to English before API call — **except any segment with dialogue/voiceover/narration**, whose spoken line stays verbatim in the confirmed spoken language (always the case for Scenario D 口播; also any Scenario C film with voiceover). Confirm the spoken language before writing prompts.
2. **Asset limits**: seedance-2.0 supports up to 9 ref_images + 3 ref_videos
3. **Duration**: 4–15s per segment; use `task chain` for longer videos
4. **Faces**: on seedance, pass a face image directly as `ID:ref_image` (auto-facepassed on submit); reuse the same material ID for a recurring character
5. **Aspect ratio**: Once confirmed, all reference images should match the same ratio
6. **Cost**: Use `credit estimate` before generating; notify user proactively if balance is low
