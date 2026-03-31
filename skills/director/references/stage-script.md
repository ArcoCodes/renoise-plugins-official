# Stage 2: SCRIPT — Story & Structure Development

Each mode has a different script structure. Internal coherence checks run silently before presenting to the user.

> Cross-references:
> - Story craft: `Read ${CLAUDE_SKILL_DIR}/references/story-development.md`
> - Internal checks: `Read ${CLAUDE_SKILL_DIR}/references/coherence-checklist.md`
> - Style options: `Read ${CLAUDE_SKILL_DIR}/references/style-library.md`

---

## Mode A — Micro-Check

Three lines. If any answer is unclear, ask the user before proceeding.

```
Hook  (0-3s):  What expectation am I violating? Why would the viewer NOT swipe?
Build (3-10s): What CHANGES between the start and end of this section?
Close (10-15s): What emotion does the viewer walk away with? Is it earned?
```

→ **Confirm ①**: Present the micro-check. Proceed to PROMPTS (skip VISUAL DEV).

---

## Mode B — Micro-Story

```
BEFORE:    [viewer's problem / status quo]
TRANSFORM: [how the product changes things]
AFTER:     [new reality]
```

User confirms 5 fields:
```json
{
  "product_type": "...",
  "selling_points": ["...", "..."],
  "scene": "...",
  "model_appearance": "...",
  "dialogue_tone": "..."
}
```

→ **Confirm ①**: Present product analysis + micro-story. Proceed to PROMPTS (skip VISUAL DEV for single-clip; do product analysis for multi-scene).

---

## Mode C — Logline + Treatment (Original)

**Step 1: Logline** — one sentence:
```
When [INCITING INCIDENT], a [CHARACTER] must [GOAL], but [OBSTACLE] threatens [STAKES].
```

**Step 2: Treatment** — prose narrative, 2-3 sentences per scene. Describe what the viewer SEES and FEELS. Embed dialogue naturally.

**Step 3 (internal, not shown to user)**: Run coherence self-check:
- Every scene transition is THEREFORE or BUT (no AND THEN)
- No two adjacent scenes target the same viewer emotion
- Every character action has explicit motivation
- Every dialogue line serves a purpose (reveal / conflict / emotion / character)

If any check fails, fix the treatment silently before presenting.

**Step 4: Character Asset Plan (MANDATORY).** For every character in the treatment, produce this table:

```
| Character | Segments | Asset Strategy | Justification |
|-----------|----------|----------------|---------------|
| [name]    | S1,S3,S5 | ✅ Generate Asset | Appears in 3 segments |
| [name]    | S3       | ❌ Text-only     | Single scene only |
```

**Rule: Any character appearing in 2+ segments MUST have strategy "✅ Generate Asset".** Text-only is permitted ONLY for characters in exactly 1 segment.

**Step 5: Style direction** — propose 1-2 style options based on content.

Output to user: **logline + treatment + character asset plan + style recommendation** (one concise package).

→ **Confirm ①**: User approves or adjusts the story + style + character plan.

---

## Mode D — Select + Condense (Adaptation)

The source material already contains the story. The task is to **select** the best moments and **condense** them for video.

**Step 1: Parse source material.** Extract:
- Scene inventory (number + one-line summary each)
- Character roster (name + appearance + key traits)
- Emotional peaks / most visual moments

**Step 2: Recommend a plan.**
- Suggested segment count (based on budget + story density)
- Selected scenes + rationale for each
- Emotional arc formed by the selected scenes
- What's cut and why

**Step 3: Write condensed treatment** for selected scenes only (2-3 sentences each).

**Step 4: Character Asset Plan (MANDATORY).** For every character extracted in Step 1, produce this table:

```
| Character | Segments | Asset Strategy | Justification |
|-----------|----------|----------------|---------------|
| [name]    | S1,S3,S5 | ✅ Generate Asset | Appears in 3 segments |
| [name]    | S3,S5    | ✅ Generate Asset | Appears in 2 segments |
| [name]    | S4       | ❌ Text-only     | Single scene, minor role |
```

**Rule: Any character appearing in 2+ segments MUST have strategy "✅ Generate Asset".** Text-only is permitted ONLY for characters in exactly 1 segment. This table feeds directly into VISUAL DEV Step 3a — every "✅ Generate Asset" row becomes a character sheet to generate.

Include the asset cost in the budget estimate: ~12 credits per character image + ~0 for registration.

**Step 5 (internal)**: Coherence self-check on the condensed version.

**Step 6: Style direction** — propose style based on source material's tone/period/genre.

Output to user: **scene selection table + emotional arc + treatment + character asset plan + style**.

→ **Confirm ①**: User approves or adjusts scene selection + treatment + character plan.

---

## Mode E — Beat Sheet (Montage / MV)

No narrative causation required. Structure is driven by **mood + rhythm**.

**Step 1: Core emotion** — one word (nostalgia, euphoria, melancholy, adrenaline...).

**Step 2: Beat sheet** — per segment:
```
S1: [visual keyword] — mood: [X] — energy: [N/10]
S2: [visual keyword] — mood: [X] — energy: [N/10]
...
```

**Step 3: Rhythm reference** — BPM, genre, reference track/mood.

**Step 4: Style direction.**

Output to user: **core emotion + beat sheet + energy curve + style**.

→ **Confirm ①**: User approves or adjusts the beat sheet.
