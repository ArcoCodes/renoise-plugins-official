# Stage 4: PROMPTS — Writing Video Generation Prompts

> Cross-references:
> - Model capabilities: `Read ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/references/video-capabilities.md`
> - E-com prompt guide: `Read ${CLAUDE_SKILL_DIR}/references/ecom-prompt-guide.md`
> - Narrative pacing: `Read ${CLAUDE_SKILL_DIR}/references/narrative-pacing.md`
> - Continuity: `Read ${CLAUDE_SKILL_DIR}/references/continuity-guide.md`
> - Multi-reference: `Read ${CLAUDE_SKILL_DIR}/references/multi-reference-guide.md`
> - Common pitfalls: `Read ${CLAUDE_SKILL_DIR}/references/common-pitfalls.md`

---

## Single-Clip Modes (A, B)

### Mode A — One 15s Prompt

Follow the 8-element formula: Subject → Action → Scene → Lighting → Camera → Style → Quality → Constraints.

```
[Style line + Quality parameters — 1 line, persistent]

[Character description — full detail]

[0-5s] Stage 1 — subject + action beats + scene context + camera.
[Optional dialogue]

[5-10s] Stage 2 — escalation + camera.
[Optional dialogue]

[10-15s] Stage 3 — payoff + camera settles.
[Optional dialogue]

Sound design: [ambient, SFX].
Face stable without deformation, facial features clear, body proportions normal,
motion natural and fluid, no stiffness, no frame stuttering, no flickering.
No text, subtitles, watermarks, or logos.
```

### Mode B - 1-3 Variant Prompts

Prompt structure: Product anchoring (1 line) + Model description + Timeline narrative (Hook → Showcase → Scene → Close) + Dialogue + BGM + Negative.

Auto-suggest 3 scene variants. User picks individual or "generate all."

→ **Confirm (A)** / **Confirm 2 (B)**: Present prompt(s). Adjust on feedback. Then generate.

---

## Multi-Clip Modes (C, D, E)

### Step 1: Shot Table + Rhythm Blueprint

For each segment:
```
S[N]: [scene description] | camera: [movement] | energy: [X→Y→Z]
      dialogue: "[line]" | transition → S[N+1]: [type]
      characters: asset:28 (Li Shande), asset:29 (Liu) | scene: material:53 / text-only
```

**Every character in the shot MUST reference their asset ID from the Character-to-Asset Registry.** If a segment has no character assets listed, it means either (a) no characters appear, or (b) all characters are 1-segment-only with documented text-only justification.

Present the rhythm blueprint:
```
🎬 [Title] - [N] × 15s

S1 - [Act/Beat label] - Energy: [curve] - [2-word summary]
  → Transition: [type]
S2 - ...
```

### Step 2: Write All Prompts

Each prompt follows this assembly (the **8-element formula** applied to timeline format):

```
[Style line + Quality parameters — same across ALL segments]

[Material role declarations — if using multi-reference]
"@Image1 (asset:27) is the protagonist. @Image2 (material:53) is the scene reference."

[Character Bible — full, verbatim, every segment the character appears]

[0-5s] Subject + action (with completion state) + scene context + camera.
[5-10s] Subject + escalation + camera.
[10-15s] Subject + payoff + camera.

[Dialogue in mandatory format if applicable]

Sound design: [ambient, SFX].
Face stable without deformation, facial features clear, body proportions normal,
motion natural and fluid, no stiffness, no frame stuttering, no flickering.
[Additional negative prompts from Style Guide].
```

### Key Prompt Rules

1. **Same style line + quality parameters in every prompt** — persistent visual DNA, no mood/color shifts between segments
2. **Scene-specific mood goes INSIDE time segments** — not in the style line
3. **Full character description copied verbatim every time** — never abbreviate, even in segment 8
4. **Mid-film segments end with motion** — only the FINAL segment ends with “frame holds steady”
5. **Dialogue format**: `Spoken dialogue (say EXACTLY, word-for-word): "[line]"\nTone: [emotion]. Mouth clearly visible when speaking, lip-sync aligned.`
6. **One camera movement per time stage** — never request push + pull + pan simultaneously in the same 5s window
7. **Action completion** — describe where each action ends, not just where it starts (e.g., "raises hand from side to shoulder height, then holds")
8. **Externalize emotions** — use body signals ("lips quiver, eyes redden") not abstract adjectives ("very sad")
9. **Material role declarations** — when using multi-reference, always declare each material's purpose at the start
10. **Stability constraints MANDATORY** — always end with the face/body stability block for character content

### Material Reference in Prompts

When a shot has an assigned anchor from VISUAL DEV:

| Anchor Type | CLI Flag | In Prompt | When to use |
|-------------|----------|-----------|-------------|
| User Asset (face) | `--materials "asset:27:reference_image"` | "Follow the character appearance from the reference image." | **Default for all 2+ segment characters** |
| Character Library | `--characters "42"` | (automatic, no prompt text needed) | Pre-existing platform characters |
| Scene ref (no face) | `--materials "53:ref_image"` | "Match the environment from the reference image." | Environment anchoring |
| Text-only | (no flag) | Full Character Bible description in prompt | **1-segment characters ONLY** |

> **⚠️ If you find yourself using text-only for a character that appears in 2+ segments, STOP.** Go back to VISUAL DEV and generate their asset first. Text-only for recurring characters causes visible drift between segments and wastes credits on re-generations.

### Multi-Reference Material Integration

When a shot uses multiple reference materials (character asset + scene ref + motion ref), include a **material role declaration block** before the character description:

```
@Image1 (asset:27) is the protagonist's appearance reference — maintain identical face, hair, and clothing.
@Image2 (material:53) provides the environment and color palette.
@Video1 (material:88) provides camera movement reference only — do NOT copy its characters or setting.

[Character Bible follows...]
```

**Rules for multi-reference prompts:**
1. Declare every material's role explicitly — never let the model guess
2. For motion references, explicitly exclude character/scene copying
3. For multi-character scenes, map each image to its specific character by name
4. Keep total materials ≤ 5 for stability

See `Read ${CLAUDE_SKILL_DIR}/references/multi-reference-guide.md` for full @ syntax details.

→ **Confirm ③**: Present shot table + rhythm. Adjust on feedback. Then generate.
