# Cross-Clip Continuity Guide

Continuity is not just a prompt-writing trick. It is a **handoff design problem**.

For multi-clip work, continuity should be planned before execution, then reinforced in prompts and generation strategy.

---

## 1. Plan Continuity First

Before writing final prompts, define continuity where it matters.

Use a table like this:

```text
| Transition | opening_state next shot | closing_state prior shot | Strategy | Notes |
|------------|--------------------------|--------------------------|----------|-------|
| S1→S2 | Maya enters living room holding package | Maya at doorway holding package | parallel + continuity text | location change |
| S2→S3 | Maya seated with watch raised to lamp | Maya seated with watch raised to lamp | serial / ref_video preferred | same location, continuous action |
```

### What Belongs in a State Description
- character position and orientation
- prop state
- emotional state
- lighting state
- important environment state
- whether motion is ongoing or settled

### What Does Not Belong
- soundtrack notes
- camera jargon that only applies to one shot
- long exposition

If a transition matters visually, plan it explicitly. Do not trust the model to infer the seam.

---

## 2. Choose the Right Continuity Strategy

| Situation | Best Strategy |
|-----------|---------------|
| Same location + same character + continuous action | **Serial / ref_video** |
| Same character, different location | **Parallel with strong face + scene anchors** |
| Different characters / different places | **Parallel** |
| Mixed project | **Hybrid** |

The tighter the seam requirement, the less you should rely on prompt-only continuity.

---

## 3. Character Continuity Rules

### Copy Verbatim — Never Abbreviate
The biggest cause of drift is paraphrasing.

```text
WRONG:  "A young woman with black hair"
RIGHT:  "East Asian woman, late 20s, shoulder-length black hair with subtle auburn highlights, warm ivory skin, almond-shaped dark brown eyes"
```

### Highest-Risk Drift Features
1. hair color / length
2. skin tone
3. wardrobe color and cut
4. apparent age
5. signature accessories

### Wardrobe Anchoring Pattern
Use:
```text
[texture/material] + [cut/style] + [color] + [garment]
```

Example:
```text
oversized cream-colored chunky-knit wool cardigan
```

---

## 4. Environment Continuity Rules

If the same location appears again, reuse the same core lighting and environment language.

```text
S2: Soft golden hour side-lighting through large windows, practical lamps as warm fill.
S3: Soft golden hour side-lighting through large windows, practical lamps as warm fill.
```

Do not casually rewrite the same environment as a new one.

If the location transforms, make the transformation explicit:
- base environment stays the same
- changed element is stated clearly

Example:
```text
Same living room as S2, but now filled with warm golden particles from the glowing watch.
```

---

## 5. Prompt-Level Continuity Bridge

When continuity matters, start later shots with a bridge like:

```text
Continuing from the previous shot: [exact prior closing_state].
```

This works best when the state was already planned.

### Include
- pose / placement
- held objects
- emotional tone
- lighting state
- relevant environment state

### Avoid
- restating the whole previous shot
- camera instructions from the old shot
- music cues

---

## 6. Style Prefix Consistency

Keep the same global style block across related clips:

```text
[visual_style]. [color_palette]. [lighting].
```

And keep the same negative block:

```text
Avoid: [negative prompts].
```

This is one of the strongest non-reference continuity tools.

---

## 7. Reference Choices

### Face Consistency
| Method | Consistency | Best For |
|--------|-------------|----------|
| User Asset | High | new recurring characters |
| Character Library | Highest | existing platform characters |
| Text-only | Low | fallback only |

### Environment / Composition Consistency
| Method | Consistency | Best For |
|--------|-------------|----------|
| scene ref_image | High | recurring environments |
| storyboard panel | Medium-High | shared visual DNA |
| text-only | Low | fallback |

### Motion / Seam Consistency
| Method | Consistency | Best For |
|--------|-------------|----------|
| ref_video | Highest | direct shot-to-shot continuation |
| continuity text only | Medium | softer handoffs |

---

## 8. Transition Tactics When Perfect Continuity Is Not Possible

Useful tactics:
1. cut on action
2. motion blur / whip pan at seam
3. close-up to wide change
4. shadow-to-light or light-to-shadow shift
5. short cross-dissolve in post

These do not replace planning. They help hide residual mismatch.

---

## 9. Common Mistakes

| Mistake | Fix |
|---------|-----|
| Abbreviating recurring character descriptions | Copy verbatim every time |
| Treating every transition the same | Mark serial vs parallel in plan |
| No closing_state / opening_state | Add handoff state before prompt writing |
| Rephrasing the same environment repeatedly | Reuse the same core wording |
| Using raw face `ref_image` | Register as asset or use Character Library |
| Expecting prompt prose alone to solve seam continuity | Use stronger anchors or `ref_video` |

---

## Summary Rule

**If the viewer should feel that two clips belong to the same continuous world or action, continuity must be designed before generation, not hoped for after generation.**
