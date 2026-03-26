# Cross-Clip Continuity Guide

Techniques for maintaining visual consistency across multiple Seedance 2.0 clips.

## Character Description Rules

### Copy Verbatim — Never Abbreviate

The #1 cause of character drift is paraphrasing. Every shot must include the **exact same character description** from the Character Bible.

```
WRONG:  "A young woman with black hair"
RIGHT:  "East Asian woman, late 20s, shoulder-length black hair with subtle auburn highlights, warm ivory skin, almond-shaped dark brown eyes"
```

Even small omissions cause drift. If the Bible says "shoulder-length black hair with subtle auburn highlights", every prompt must say exactly that.

### Drift Vulnerability Ranking

Features that drift most easily (highest risk first):

1. **Hair color & length** — Most volatile. Always specify shade, length, and texture.
2. **Skin tone** — Use specific terms ("warm ivory", "deep espresso brown"), not vague ones ("light", "dark").
3. **Clothing color** — Must include texture + cut + color: "cream-colored chunky-knit wool cardigan" not "white sweater".
4. **Age** — State explicitly: "late 20s" not "young woman".
5. **Body type** — Least volatile but still specify if relevant.

### Wardrobe Anchoring

Three-part wardrobe description for every garment:

```
[texture/material] + [cut/style] + [color]

"Oversized cream-colored chunky-knit wool cardigan"
 ↑ cut      ↑ color     ↑ texture/material  ↑ garment

"Fitted charcoal cotton turtleneck"
 ↑ cut  ↑ color  ↑ material  ↑ garment
```

### Signature Details as Anchors

Accessories and unique features act as visual anchors that help the model maintain identity:
- Jewelry: "Small gold hoop earrings, thin gold chain bracelet on left wrist"
- Tattoos: "Small constellation tattoo on inner right wrist"
- Props: "Always carries a worn leather messenger bag"

Include these in every prompt, even if not the focus of the shot.

## Lighting Consistency

### Same Scene = Same Light Words

If shots S1 and S2 occur in the same location, use **identical lighting descriptors**:

```
S1: "Soft golden hour side-lighting through large windows, practical lamps as secondary fill"
S2: "Soft golden hour side-lighting through large windows, practical lamps as secondary fill"
```

Never rephrase "golden hour side-lighting" as "warm natural light" — the model interprets these differently.

### Cross-Scene Lighting

Different locations can have different lighting, but the **color temperature** should stay consistent with the Style Guide. If the guide says "warm amber tones with cool blue shadows", every location should interpret this within that range.

## Continuity Bridging

### The Bridge Formula

Every shot after S1 must begin with:

```
Continuing from the previous shot: [exact continuity_out from previous shot].
```

This is the single most important technique for visual coherence.

### What to Include in continuity_out

1. **Character position**: "Standing at doorway, facing camera at 3/4 angle"
2. **Prop state**: "Both hands holding small wrapped package at chest height"
3. **Emotional state**: "Curious expression, slight head tilt"
4. **Lighting state**: "Warm pendant light from above, soft shadows on face"
5. **Environmental state**: "Door is open behind her, hallway light visible"

### What NOT to Include

- Camera angles (the new shot may use a different angle)
- Music cues (handled separately)
- Dialogue (new shot has its own script)

## Style Prefix Consistency

### The Global Prefix

Every prompt starts with the exact same style block:

```
[visual_style]. [color_palette]. [lighting].
```

This prefix is the #2 most important consistency tool after character descriptions.

### Negative Prompts

End every prompt with the same negative block:

```
Avoid: [negative_prompts from Style Guide].
```

## Transition Techniques

### Hiding Inconsistency

When character appearance inevitably drifts slightly between clips:

1. **Whip pan / motion blur**: End one shot with fast camera movement, start next with fast movement. The blur hides the transition.
2. **Close-up → Wide**: End on a face close-up, start the next shot wide. The scale change masks small differences.
3. **Cut on action**: End mid-movement (hand reaching), start the next shot completing the movement. The viewer's eye follows the action, not appearance details.
4. **Dark → Light**: End shot in shadow, start next in light. Lighting shift distracts from appearance changes.

### The 80% Rule

AI-generated clips will achieve ~80% visual consistency when following these techniques. The remaining 20% is handled in post-production:
- Color grading to unify color palette
- Subtle speed adjustments for timing
- Audio continuity (shared BGM) creates perceived visual continuity

## Grid Storyboard Method

### Why One Image > Many Images

When generating reference images for each shot independently (even with the same prompt style), each generation starts from a different random seed. This causes:
- Slight differences in character face shape, eye size, hair texture
- Color palette drift between shots
- Inconsistent rendering style (more/less detailed, different line weights)

**The Grid Storyboard method solves this** by generating ALL shots in a single image. Because the AI renders all panels in one context:
- Characters share the exact same face structure, proportions, and styling
- Color palette is unified across all panels
- Rendering technique (line weight, shading style, texture) is consistent
- The AI "remembers" what it drew in Panel 1 when drawing Panel 8

### Workflow

1. Write a single prompt describing all panels with verbatim character descriptions
2. Generate one grid image via `renoise-gen` (`nano-banana-2`)
3. Split into individual panels: `bash split-grid.sh grid.png storyboard/ 2 4`
4. Upload each panel as material for Image-to-Video generation
5. Each Seedance clip now has a visual anchor from the same source

### When to Use

- **Always recommended** for projects with recurring characters
- Especially important for anime/manga/stylized projects where character design must be exact
- Less critical for pure environment/landscape shots with no characters

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Abbreviating character descriptions | Copy the full Character Bible entry every time |
| Rephrasing lighting descriptors | Use identical words for same-location lighting |
| Forgetting continuity bridge | Always start S2+ with "Continuing from the previous shot:" |
| Including BGM in Seedance prompt | Never mention music in video prompts — BGM is overlaid in post |
| Using different style prefixes | Same prefix for every shot, character for character |
| Describing camera in continuity_out | Continuity describes scene state, not camera state |
