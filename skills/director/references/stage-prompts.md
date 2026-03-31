# Stage 4: PROMPTS — Writing Video Generation Prompts

> Cross-references:
> - Model capabilities: `Read ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/references/video-capabilities.md`
> - E-com prompt guide: `Read ${CLAUDE_SKILL_DIR}/references/ecom-prompt-guide.md`
> - Narrative pacing: `Read ${CLAUDE_SKILL_DIR}/references/narrative-pacing.md`
> - Continuity: `Read ${CLAUDE_SKILL_DIR}/references/continuity-guide.md`

---

## Single-Clip Modes (A, B)

### Mode A — One 15s Prompt

```
[Style line — 1 line, persistent]

[Character description — full detail]

[0-5s] Stage 1 — action beats + camera.
[Optional dialogue]

[5-10s] Stage 2 — escalation + camera.
[Optional dialogue]

[10-15s] Stage 3 — payoff + camera settles.
[Optional dialogue]

Sound design: [ambient, SFX].
No text, subtitles, watermarks, or logos.
```

### Mode B — 1-3 Variant Prompts

Prompt structure: Product anchoring (1 line) + Model description + Timeline narrative (Hook → Showcase → Scene → Close) + Dialogue + BGM + Negative.

Auto-suggest 3 scene variants. User picks individual or "generate all."

→ **Confirm (A)** / **Confirm ② (B)**: Present prompt(s). Adjust on feedback. Then generate.

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
🎬 [Title] — [N] × 15s

S1 — [Act/Beat label] — Energy: [curve] — [2-word summary]
  → Transition: [type]
S2 — ...
```

### Step 2: Write All Prompts

Each prompt follows this assembly:

```
[Style line — same across ALL segments]

[Character Bible — full, verbatim, every segment the character appears]

[0-5s] ...
[5-10s] ...
[10-15s] ...

[Dialogue in mandatory format if applicable]

Sound design: [ambient, SFX].
[Negative prompts from Style Guide].
```

### Key Prompt Rules

1. **Same style line in every prompt** — persistent visual DNA, no mood/color shifts between segments
2. **Scene-specific mood goes INSIDE time segments** — not in the style line
3. **Full character description copied verbatim every time** — never abbreviate, even in segment 8
4. **Mid-film segments end with motion** — only the FINAL segment ends with "frame holds steady"
5. **Dialogue format**: `Spoken dialogue (say EXACTLY, word-for-word): "[line]"\nTone: [emotion]. Mouth clearly visible when speaking, lip-sync aligned.`

### Material Reference in Prompts

When a shot has an assigned anchor from VISUAL DEV:

| Anchor Type | CLI Flag | In Prompt | When to use |
|-------------|----------|-----------|-------------|
| User Asset (face) | `--materials "asset:27:reference_image"` | "Follow the character appearance from the reference image." | **Default for all 2+ segment characters** |
| Character Library | `--characters "42"` | (automatic, no prompt text needed) | Pre-existing platform characters |
| Scene ref (no face) | `--materials "53:ref_image"` | "Match the environment from the reference image." | Environment anchoring |
| Text-only | (no flag) | Full Character Bible description in prompt | **1-segment characters ONLY** |

> **⚠️ If you find yourself using text-only for a character that appears in 2+ segments, STOP.** Go back to VISUAL DEV and generate their asset first. Text-only for recurring characters causes visible drift between segments and wastes credits on re-generations.

→ **Confirm ③**: Present shot table + rhythm. Adjust on feedback. Then generate.
