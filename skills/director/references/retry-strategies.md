# Retry & Quality Review Strategies

When a generated video doesn't meet expectations, use this structured workflow to diagnose, decide, and fix.

## When to Use This Guide

- After Stage 5 (GENERATE): review each clip before assembling
- After Stage 6 (ASSEMBLE): review the assembled cut
- When the user reports issues with a delivered video

---

## Phase 1: Review — What Went Wrong?

### Automated Review (optional)

Use Gemini to analyze generated video against the original prompt:

```bash
# Extract what actually happened in the video
node ${CLAUDE_PLUGIN_ROOT}/skills/gemini-gen/scripts/gemini.mjs \
  --file "${PROJECT_DIR}/videos/S1.mp4" --mode video-script

# Compare against the prompt — look for:
# - Missing actions/beats described in the prompt
# - Character appearance drift from the Character Bible
# - Wrong camera movements or missing camera changes
# - Missing or incorrect dialogue
```

### Manual Review Checklist

For each generated clip, score these dimensions (1-5):

| Dimension | What to Check | Pass Threshold |
|-----------|--------------|----------------|
| **Character fidelity** | Does the character match the Bible/reference? Face, hair, wardrobe, accessories. | ≥3 |
| **Action accuracy** | Did the described actions happen in the right order? | ≥3 |
| **Camera work** | Are the camera movements correct? Timing matches time annotations? | ≥3 |
| **Dialogue sync** | Is the dialogue audible, correct words, lip-synced? | ≥3 |
| **Visual quality** | No artifacts, distortions, extra limbs, text overlays? | ≥3 |
| **Mood/tone** | Does the lighting, color, atmosphere match the style line? | ≥3 |

**Decision**: If any dimension scores 1-2, that clip needs a retry.

---

## Phase 2: Diagnose — Why Did It Fail?

| Symptom | Likely Cause | Diagnosis |
|---------|-------------|-----------|
| Character face changed | No visual anchor, or abbreviated description | Check: was full Character Bible in prompt? Was User Asset / Character Library used? |
| Character wardrobe changed | Incomplete wardrobe description | Check: texture + cut + color for every garment? |
| Actions didn't happen | Prompt too complex, too many actions | Count actions — more than 4-5 per 5s window is too many |
| Wrong camera movement | Ambiguous camera instruction | Check: does the prompt say exactly which direction? |
| Dialogue wrong or missing | Didn't use forced lip-sync format | Check: `Spoken dialogue (say EXACTLY, word-for-word):` format? |
| Video is incoherent/surreal | Conflicting instructions in prompt | Check: one mood per segment? No contradictory descriptions? |
| Style/color mismatch | Different style line from other segments | Check: identical style prefix across all segments? |
| Privacy detection blocked | Face in ref_image | Register as User Asset (`asset register`) |
| Task failed outright | Server issue or policy violation | `task get <id>` for error details |

---

## Phase 3: Fix — Retry Strategies

### Strategy A: Prompt Simplification (most common fix)

When the video is incoherent or actions are wrong:

1. **Reduce action density**: Cut from 6-8 actions to 3-4 per segment
2. **Simplify camera**: Use 2 camera stages instead of 3
3. **Remove conflicting descriptions**: One mood, one lighting, one color temperature
4. **Make time annotations clearer**: `[0-5s]` `[5-10s]` `[10-15s]` with one clear action each

```
BEFORE (too complex):
[0-5s] She walks in, sets bag down, picks up package, looks at it, tilts head, 
       camera tracks from behind then whip pans to over-shoulder then push-in.

AFTER (simplified):
[0-5s] Medium tracking shot following her as she walks down the hallway 
       and notices a package on the doormat. Camera slows to a stop.
```

### Strategy B: Visual Anchor Upgrade

When character consistency is the problem:

1. **No anchor → User Asset**: Generate character sheet → `asset register` → use `asset:ID:reference_image`
2. **Storyboard grid → Individual character sheet**: Grid is weaker for face consistency than a dedicated character sheet
3. **Text-only → User Asset**: If budget allows, always prefer visual anchoring over text-only

### Strategy C: Segment Restructuring

When a segment tries to do too much:

1. **Split a 15s segment** into two: move the complex action to a new segment
2. **Merge two weak segments**: if two adjacent segments are both thin, combine their content
3. **Reorder segments**: sometimes swapping S3 and S4 creates better flow

### Strategy D: Post-Production Fixes

When the video is 80% good but has minor issues:

| Issue | Post-Production Fix |
|-------|-------------------|
| Color/tone mismatch between clips | Apply unified color grade / LUT |
| Slight character drift at transitions | Add cross-dissolve (0.3-0.5s) to mask the jump |
| Audio quality inconsistent | Strip all AI audio, overlay unified BGM |
| Pacing feels off | Speed ramp (90-110%) individual clips |
| Ending feels abrupt | Add fade-to-black (0.5s) |

### Strategy E: Partial Regeneration

When only part of the video is bad:

1. **Identify which segments are good** — keep them
2. **Regenerate only the bad segments** with improved prompts
3. **For serial chains**: if S2 was bad but S1 and S3 were good:
   - Regenerate S2 using S1's output as `ref_video`
   - Check if S3 still connects (it may need regeneration too since it referenced old S2)
4. **For parallel segments**: just regenerate the bad one independently

---

## Phase 4: Decide — Retry Budget

Before retrying, calculate the cost:

| Action | Approximate Cost |
|--------|-----------------|
| Regenerate 1 × 15s video clip | ~300 credits |
| Generate 1 × character sheet (nano-banana-2) | ~50 credits |
| Register 1 × User Asset | 0 credits (free) |
| Gemini video analysis | ~0.5 credits |

**Decision framework:**

```
Score all clips 1-5 across 6 dimensions.

If average ≥ 3.5 across all clips:
  → Proceed to ASSEMBLE. Use post-production fixes for minor issues.

If 1-2 clips score < 3 but others are good:
  → Partial regeneration (Strategy E). Fix only the bad clips.

If most clips score < 3:
  → Diagnose root cause first. Usually it's:
    - Prompt complexity → Strategy A
    - Missing visual anchor → Strategy B
    - Structural issue → Strategy C
  → Fix the root cause, then regenerate all clips.

If budget is tight (< 600 credits remaining):
  → Prioritize Strategy A (prompt simplification, free)
  → Use Strategy D (post-production fixes) over regeneration
```

---

## Common Retry Patterns

### Pattern 1: "Looks great except the face"

```
Cause: No visual anchor for character
Fix:   Generate character sheet → asset register → regenerate with asset:ID:reference_image
Cost:  ~50 (sheet) + ~300 (regenerate) = ~350 credits
```

### Pattern 2: "Actions are all wrong"

```
Cause: Prompt too complex
Fix:   Simplify to 2-3 actions per 5s window, clearer camera instructions
Cost:  ~300 credits (regenerate)
```

### Pattern 3: "Segments look different from each other"

```
Cause: Different style lines, or no shared visual anchor
Fix:   Ensure identical style prefix. Use storyboard grid as ref_image for all segments.
Cost:  ~50 (grid) + ~300×N (regenerate) credits
```

### Pattern 4: "Dialogue is garbled"

```
Cause: Didn't use forced lip-sync format, or too much dialogue
Fix:   Use "Spoken dialogue (say EXACTLY, word-for-word):" format. 
       Reduce to max 3 dialogue lines per 15s. Keep lines under 15 words each.
Cost:  ~300 credits (regenerate)
```

### Pattern 5: "PrivacyInformation error"

```
Cause: Face in ref_image material
Fix:   asset register <material_id> → use asset:ID:reference_image
Cost:  0 credits (asset registration is free), ~300 to regenerate
Time:  ~1 min for asset registration
```
