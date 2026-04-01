# Stage 4: PROMPTS — EXECUTE PREP

PROMPTS is an **EXECUTE PREP** stage.

Goal: convert the frozen plan into prompt packages that the model can execute reliably. PROMPTS is not where missing planning decisions should be invented.

> Cross-references:
> - Model capabilities: `Read ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/references/video-capabilities.md`
> - E-com prompt guide: `Read ${CLAUDE_SKILL_DIR}/references/ecom-prompt-guide.md`
> - Narrative pacing: `Read ${CLAUDE_SKILL_DIR}/references/narrative-pacing.md`
> - Continuity / handoff: `Read ${CLAUDE_SKILL_DIR}/references/continuity-guide.md`

---

## Stage Contract

### Required Inputs
- frozen plan from INTAKE + SCRIPT
- anchor outputs from VISUAL DEV where applicable
- style direction
- segment purpose table
- continuity strategy table for multi-clip work

### Required Outputs
Before leaving PROMPTS, produce:
- final prompt package(s)
- shot table / rhythm blueprint for multi-clip work
- prompt-to-anchor alignment
- continuity handoff language where required

### Blocking Conditions
Do **not** proceed if:
- the shot purpose is unclear
- an important anchor is still undefined
- continuity strategy is still unresolved
- a required recurring human, environment, or product / prop anchor is missing

If any of those are true, return to PLAN / VISUAL DEV. Do not patch around them with fancy wording.

---

## Prompt Principles

1. **Prompts implement the plan; they do not replace the plan.**
2. **Same style line across related segments.**
3. **Full recurring character description copied verbatim every time.**
4. **Prompt wording should reflect anchor strategy already chosen.**
5. **Every quality-critical recurring element should follow the frozen anchor plan, not ad-hoc prompt invention.**
6. **When continuity matters, use explicit handoff state instead of vague continuation language.**

---

## Single-Clip Modes (A, B)

### Mode A — One 15s Prompt

```text
[Style line]

[Character / subject description]

[0-5s] stage 1 — action + camera
[5-10s] stage 2 — escalation + camera
[10-15s] stage 3 — payoff + camera

[Dialogue block if needed]
Sound design: [ambient, SFX].
No text, subtitles, watermarks, or logos.
```

### Mode B — 1-3 Variant Prompts

Structure:
- product anchoring line
- model / creator description
- timeline narrative: hook → showcase → use case → close
- dialogue block
- sound / vibe
- negatives

If generating variants, change scene logic on purpose. Do not create random variants that lack a distinct selling angle.

→ **Confirm (A)** / **Confirm ② (B)**: present prompt package(s), then generate.

---

## Multi-Clip Modes (C, D, E)

### Step 1: Validate the Plan Before Writing

Make sure these artifacts exist:

```text
- Segment Purpose Table
- Anchor Registry
- Scene / Environment Anchor Plan
- Continuity Strategy Table
- Shot → Anchor Mapping
```

If any is missing, stop and go back.

### Step 2: Write the Shot Table + Rhythm Blueprint

For each segment:

```text
S[N]: [scene description] | camera: [movement] | energy: [X→Y→Z]
      opening: [opening_state]
      closing: [closing_state]
      transition → S[N+1]: [type / serial / parallel]
      anchors: human [asset:28], environment [material:53], extra [product:66 / storyboard:72 / ref_video]
```

Present a concise rhythm view:

```text
🎬 [Title] — [N] × 15s

S1 — [beat label] — [energy] — [summary]
S2 — ...
```

### Step 3: Write All Prompts

Each prompt should assemble from the plan in this order:

```text
[Style line — identical across related segments]

[Optional continuity bridge derived from prior closing_state]

[Character Bible — full, verbatim, for all recurring characters present]

[Anchor guidance if relevant: follow the chosen human anchor / match environment reference image / preserve product or object anchor]

[0-5s] ...
[5-10s] ...
[10-15s] ...

[Dialogue block if needed]

Sound design: [ambient, SFX].
[Negative prompts].
```

---

## Key Prompt Rules

### 1. Style Consistency
Use the same style line across all related clips. Mood shifts belong inside the timed action blocks, not in the global style line.

### 2. Character Consistency
Recurring characters must use the exact same description every time. Never abbreviate because "the model already knows."

### 3. Environment Consistency
If the plan says a shot uses a scene anchor, the prompt should explicitly respect that anchor. Do not describe a totally different environment than the reference you are sending.

### 4. Continuity Discipline
If a shot depends on the previous shot's ending, start from the planned handoff state, not a vague reset.

### 5. Ending Behavior
Only the final segment should settle fully. Mid-story segments should usually end with motion, tension, or an unfinished handoff when the next segment needs to pick up cleanly.

### 6. Anchor Discipline
Characters are not the only things that drift. If the plan defines a recurring environment, product, or prop anchor, keep the prompt aligned with that anchor instead of casually reinventing it.

### 7. Dialogue Format
Use the forced format when needed:

```text
Spoken dialogue (say EXACTLY, word-for-word): "[line]"
Tone: [emotion]. Mouth clearly visible when speaking, lip-sync aligned.
```

---

## Material Reference in Prompts

| Anchor Type | CLI Flag | Prompt Role | When to Use |
|-------------|----------|-------------|-------------|
| User Asset | `--materials "asset:27:reference_image"` | locks recurring custom human identity | default for recurring new people |
| Character Library | `--characters "42"` | locks platform human identity | pre-existing characters |
| Scene / product / object ref | `--materials "53:ref_image"` | anchors environment, product, or prop appearance | recurring or important non-face elements |
| Storyboard panel | `--materials "72:ref_image"` | anchors visual DNA / composition | multi-shot consistency |
| ref_video | `--materials "88:ref_video"` | strongest motion / seam continuity | serial transitions |
| Text-only | none | fallback only | one-off elements |

> If prompt writing reveals that a recurring human, important environment, or critical product / prop still has no credible anchor, return to VISUAL DEV.

---

## Exit Format

Before leaving PROMPTS, the output should look like a packaged execution spec, not loose text.

Example:

```md
## Prompt Package
Style line: ...

## Shot Table
S1 ...
S2 ...

## Prompt-to-Anchor Mapping
S1 → asset:27 + material:53
S2 → asset:27 + material:61
S3 → asset:27 + ref_video:88

## Final Prompts
...
```

→ **Confirm ③**: present the shot table + prompt package, then generate.
