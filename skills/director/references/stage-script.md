# Stage 2: SCRIPT — PLAN FREEZE CORE

SCRIPT is a **PLAN** stage.

Goal: convert the brief into a structure concrete enough to execute without guessing. This is where the project stops being an idea and becomes a plan.

> Cross-references:
> - Story craft: `Read ${CLAUDE_SKILL_DIR}/references/story-development.md`
> - Internal checks: `Read ${CLAUDE_SKILL_DIR}/references/coherence-checklist.md`
> - Style options: `Read ${CLAUDE_SKILL_DIR}/references/style-library.md`

---

## Stage Contract

### Required Inputs
- INTAKE summary
- mode selection
- material status
- budget snapshot

### Required Outputs
Before leaving SCRIPT, produce:
- story structure appropriate to the mode
- segment-by-segment purpose
- character usage plan
- initial anchor needs summary
- style direction
- explicit blockers, if any remain

### Blocking Conditions
Do **not** move to VISUAL DEV or PROMPTS if any of these are missing:
- what each segment is supposed to do
- which characters appear where
- which recurring characters require assets
- which environments / products / visual anchors matter enough to plan for
- what kind of continuity matters between segments

The exact format varies by mode, but the planning completeness requirement does not.

---

## Common Planning Outputs for All Modes

No matter the mode, SCRIPT should answer these questions:

1. **What changes from beginning to end?**
2. **What is each segment for?**
3. **Who appears in each segment?**
4. **Which elements need anchoring to avoid drift?**
5. **Where does continuity matter enough to plan explicitly?**

For multi-clip work, add a lightweight anchor forecast like:

```md
Anchor Needs Summary
- Character anchors needed: Maya, Guard
- Environment anchors needed: hallway, apartment living room
- Strong continuity required: S2→S3 and S3→S4
- Parallel-safe transitions: S1→S2 only
```

---

## Mode A — Micro-Check

Three lines. If any answer is unclear, resolve it before writing prompts.

```text
Hook  (0-3s):  What expectation am I violating? Why would the viewer NOT swipe?
Build (3-10s): What CHANGES between the start and end of this section?
Close (10-15s): What emotion does the viewer walk away with? Is it earned?
```

Required outputs:
- micro-check
- style direction
- any required anchor note (if product / character / environment reference matters)

→ **Confirm ①**: present the micro-check package, then proceed to PROMPTS.

---

## Mode B — Micro-Story

Structure:

```text
BEFORE:    [viewer problem / status quo]
TRANSFORM: [how the product changes things]
AFTER:     [new reality]
```

User-facing confirmation fields:
```json
{
  "product_type": "...",
  "selling_points": ["...", "..."],
  "scene": "...",
  "model_appearance": "...",
  "dialogue_tone": "..."
}
```

Also decide:
- how many variants to generate
- whether the product image alone is enough anchor
- whether model consistency matters across variants

→ **Confirm ①**: product analysis + micro-story + anchor note.

---

## Mode C — Logline + Treatment (Original)

### Step 1: Logline
```text
When [INCITING INCIDENT], a [CHARACTER] must [GOAL], but [OBSTACLE] threatens [STAKES].
```

### Step 2: Treatment
Write 2-3 sentences per segment. Describe what the viewer sees and feels. Dialogue should emerge from the scene, not explain it from outside.

### Step 3: Internal Coherence Check
Run the checklist silently:
- every scene transition is THEREFORE or BUT
- adjacent scenes do not target the same emotion
- character actions are motivated
- dialogue lines serve a purpose

Fix silently before presenting.

### Step 4: Character Asset Plan (MANDATORY)
For every character:

```text
| Character | Segments | Asset Strategy | Justification |
|-----------|----------|----------------|---------------|
| [name]    | S1,S3,S5 | ✅ Generate Asset | Appears in 3 segments |
| [name]    | S3       | ❌ Text-only | Single segment only |
```

Rule: any character appearing in **2+ segments** must be `✅ Generate Asset` or mapped to an existing Character Library entry.

### Step 5: Segment Purpose Table (MANDATORY)

```text
| Segment | Story Function | Emotion | Key Location | Continuity Importance |
|---------|----------------|---------|--------------|-----------------------|
| S1      | setup          | curiosity | hallway     | low |
| S2      | discovery      | wonder    | living room | high |
```

### Step 6: Style Direction
Propose 1-2 style options.

### Step 7: Anchor Needs Summary
List the important anchors and continuity links before VISUAL DEV.

Output to user:
- logline
- treatment
- character asset plan
- segment purpose table
- anchor needs summary
- style recommendation

→ **Confirm ①**: approve story + style + asset logic.

---

## Mode D — Select + Condense (Adaptation)

### Step 1: Parse Source Material
Extract:
- scene inventory
- character roster
- emotional peaks
- visually strong moments

### Step 2: Recommend a Condensed Plan
Include:
- suggested segment count
- selected scenes + rationale
- emotional arc
- what is cut and why

### Step 3: Write Condensed Treatment
Only for the selected scenes.

### Step 4: Character Asset Plan (MANDATORY)
Use the same table structure as Mode C.

### Step 5: Segment Purpose Table (MANDATORY)
Use the same structure as Mode C.

### Step 6: Anchor Needs Summary
Identify:
- recurring characters needing assets
- key environments needing anchors
- segments that need tight continuity
- segments safe for looser transitions

### Step 7: Internal Coherence Check
Run silently.

### Step 8: Style Direction
Based on period / tone / genre of the source.

Output to user:
- scene selection table
- emotional arc
- treatment
- character asset plan
- segment purpose table
- anchor needs summary
- style direction

→ **Confirm ①**: approve selection + treatment + asset logic.

---

## Mode E — Beat Sheet (Montage / MV)

### Step 1: Core Emotion
One word: nostalgia, euphoria, melancholy, adrenaline, etc.

### Step 2: Beat Sheet
```text
S1: [visual keyword] — mood: [X] — energy: [N/10]
S2: [visual keyword] — mood: [X] — energy: [N/10]
...
```

### Step 3: Rhythm Reference
BPM, genre, reference track / feel.

### Step 4: Segment Purpose Table
Even without plot, define what each segment contributes.

### Step 5: Anchor Needs Summary
Which environments, recurring subjects, or visual motifs need anchoring?
Which transitions need strong continuity, if any?

### Step 6: Style Direction

Output to user:
- core emotion
- beat sheet
- rhythm reference
- segment purpose table
- anchor needs summary
- style direction

→ **Confirm ①**: approve the beat sheet package.

---

## Exit Format

Before leaving SCRIPT, the user-facing package should look like a plan, not a loose brainstorm. Example:

```md
## Story Plan
Logline: ...
Treatment: ...

## Segment Purpose
S1: setup
S2: discovery
S3: escalation
S4: resolution

## Character Asset Plan
...

## Anchor Needs Summary
...

## Style Direction
...
```

If the plan is too vague to survive execution without guesswork, stay in SCRIPT.
