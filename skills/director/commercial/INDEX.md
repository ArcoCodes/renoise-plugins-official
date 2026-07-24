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
| **A — Reference Video Remake / 剪同款** | User provides a reference video and wants to recreate it with replacement subjects or products | `Read ${CLAUDE_SKILL_DIR}/commercial/scenario-a-viral.md` |
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

Resolve roles and limits from `renoise model <selected-model> --json`. Use only advertised material roles, preserve ordering for `@ImageN`/`@VideoN`, and never copy numeric limits into this guide.

For recurring people or products, upload the approved anchor once and reuse the same material ID through a role supported by the selected model. Follow that model's live `guidance` for face handling and incompatible role combinations.

---

## Common Workflow

### Phase 1: Requirement Gathering & Asset Analysis

1. **Identify the scenario** — match to A/B/C/D using the table above, then load that scenario file
2. **Asset inventory** — inspect each local image/video with `renoise analyze <path> --json`; use `--mode template --target video` for Scenario A. If `analyze` is unavailable, run the Setup / Account recovery flow rather than falling back to copied Gemini code.
3. **Tag each asset** by production purpose: subject anchor, scene calibration, camera reference, or beat-sync control. Reuse the same material ID for recurring anchors.
4. **Confirm live generation parameters**:
   - Run `renoise model --json` and preserve any user-selected model.
   - Otherwise choose the server-advertised default whose `kind` matches the job.
   - Inspect it with `renoise model <selected-model> --json`.
   - Choose duration, ratio, resolution, audio options, roles, and limits only from that response.

Do not maintain a commercial-specific model table. New models and capability changes must be picked up from the CLI without editing this guide.

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
@Image 1 → [filename / description] → Renoise role: <advertised image role>
@Video 1 → [filename / description] → Scenario A: <advertised source/reference-video role>; other scenarios: analysis only unless explicitly approved

--- Generation Parameters ---
Model: [selected from `renoise model --json`]
Duration / aspect ratio: [values advertised by the selected model]
Spoken language: [only if the segment has dialogue/voiceover — label it explicitly, e.g. "口播：中文"]
Estimated cost: [from `renoise task cost <selected-model> --json`]
---
```

> **Scenario C** uses a different storyboard preview format. See `scenario-c-tvc.md`.

The user may request: modify a dimension → change only that dimension, re-present | adjust an asset role → update mapping, re-present | switch scenario → return to Phase 2.

### Phase 4: Asset Upload & Video Generation

**Step 1 — Upload assets**

> **Scenario A**: Follow its dedicated two-gate workflow and upload the approved source video plus replacement slots after the plan is confirmed.
>
> **Scenario D**: If Phase 1.5 was executed, person and product assets are already uploaded — skip re-uploading. Only upload NEW materials not handled in Phase 1.5.

```bash
# Upload each asset once
renoise upload <file_path> --json
# → returns material_id
```

**Step 2 — Build the final asset mapping table**

Record all material IDs and assign only roles advertised by `renoise model <selected-model> --json`. Reuse the same approved material ID for recurring people and products. Follow the central `renoise-gen` material policy; do not add another preparation flow here.

**Step 3 — Prompt language decision**

- **With dialogue/voiceover (any scenario, always Scenario D)**: Keep the spoken line — and, for dialogue-dense segments, the whole segment prompt — in the confirmed spoken language. Do NOT translate the spoken line.
- **Without dialogue**: Translate to English. Use professional cinematography terminology. Keep selling-point action descriptions precise.

**Step 4 — Generate**

```bash
renoise task create <selected-model> \
  --prompt-file <approved-prompt-file> \
  [only parameters and material roles advertised by that model] --json
renoise task wait <task-id> --timeout 15m --json
```

> **Scenario C multi-clip**: See assembly instructions in `scenario-c-tvc.md` Phase 4 Step 5.

**Step 5 — Multi-segment continuity**

Split when the requested duration exceeds the selected model's live maximum. Use `renoise task chain <task-id> --json` only when the next model advertises a compatible video-reference role; otherwise use an advertised image/frame role and the Transition Table.

**Step 6 — Return results**

Present: video URL, cover image, generation time. If unsatisfactory, ask which dimension to adjust and regenerate.

---

## Renoise CLI Reference

Do not duplicate the command or model reference here. Use:

```bash
renoise --help
renoise model --json
renoise model <selected-model> --json
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Input/reference rejection | Read the selected model's live guidance and the central `renoise-gen` material policy. |
| 402 insufficient credits | Run `renoise account status --json`, inform the user, and suggest top-up at https://www.renoise.ai. |
| Character drifts between segments | Reuse the same approved material ID through an advertised role and copy the full character description verbatim. |
| Video ignores actions in prompt | Prompt too dense — reduce to 3–4 actions per 5s window |
| Video looks incoherent | Simplify: 2 camera stages, one mood, fewer actions |
| Segments don't connect | Re-check advertised roles, the opening-state bridge, and the Transition Table; add a short cross-dissolve if needed. |

For moderation errors, follow the structured CLI error and platform policy in the `renoise-gen` skill rather than model-family assumptions.

---

## Important Notes

1. **Language**: Draft in user's language. Translate to English before API call — **except any segment with dialogue/voiceover/narration**, whose spoken line stays verbatim in the confirmed spoken language (always the case for Scenario D 口播; also any Scenario C film with voiceover). Confirm the spoken language before writing prompts.
2. **Capabilities**: limits, durations, ratios, roles, and audio behavior come only from `renoise model <selected-model> --json`.
3. **Faces**: Follow the central `renoise-gen` material policy; do not duplicate model-family behavior here.
4. **Aspect ratio**: Once confirmed, prepare references for the selected model's advertised ratio.
5. **Cost**: Use `renoise task cost` before creating tasks and notify the user if balance is low.
