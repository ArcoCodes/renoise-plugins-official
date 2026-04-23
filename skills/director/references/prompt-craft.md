# Prompt Craft - Writing High-Density Video Prompts

This is the most important reference in the director skill. **The quality of the video is determined by the quality of the prompt.** Everything else (pipeline, asset registration, assembly) is infrastructure. This document teaches you how to write prompts that make renoise-2.0 produce cinematic results.

---

## The Core Principle

**Write like a director dictating on set, not like a screenwriter summarizing a scene.**

Bad: "She picks up a thermos and places it on the pedestal. He looks at it skeptically."

Good: "She reaches into the case. Pulls out a large industrial thermos - silver, cylindrical, 40 centimeters tall. She holds it up. Tilts her head. Squints. She hands it to him with the energy of someone presenting a solution. He receives it. Holds it at arm's length. Looks at it. Looks at the pedestal - which requires something approximately three times larger and entirely decorative."

The model responds to **specificity and physical detail**. Every action should have a visible physical result. Every object should have material, size, and color. Every gesture should have intention.

---

## Prompt Structure

A complete prompt has these sections, in this order:

### 1. Style & Camera Foundation (2-3 lines)

Persistent visual DNA. Film stock, lens, grade, aspect ratio. This stays **identical across all segments** of a multi-clip project.

```
Cinematic 16:9 widescreen. Shot on ARRI Alexa 65, Cooke vintage cinema lenses.
35mm film grain, Kodak Vision3 500T grade - bleached desert, blown-out sky, brutal noon heat.
Hyperrealistic skin, zero retouching. Hard overhead sun, ink-black shadows.
```

Not a checklist - a **visual world declaration**. The model should feel the texture of the image from this alone.

### 2. Characters (full block per character)

Each character gets: **identity lock + appearance + wardrobe + narrative function + behavioral pattern**.

```
@avatar_girl — Prop Sourcer. Female, identity lock.
Utility vest, all pockets stuffed with visibly wrong items, clipboard permanently in hand.
She was responsible for bringing the props. She brought everything except the correct one.
She has an explanation for this. She always has an explanation for this.
```

**Why narrative function matters**: telling the model "she always has an explanation" changes her body language in every frame - the way she holds her clipboard, the way she gestures, the confident tilt of her head when presenting a thermos as a solution. Pure appearance descriptions ("brown hair, blue vest") give the model nothing to act with.

For multi-clip: copy the **entire character block verbatim** into every segment prompt. Never abbreviate.

### 3. Key Props & Environment (if important to the story)

Name the props that matter. Describe their role, not just their appearance.

```
THE PROP: One large decorative vase. Tall, ornate, needed on the pedestal for the shot.
It is not here. It was never here. Everything that follows is a consequence of this single fact.

THE PEDESTAL: Center frame, background. Empty. Visible in almost every shot.
It does not move. It does not care. It will still be empty at the end.
```

### 4. Genre Engine (optional but powerful)

A short declaration of the **narrative mechanism** that drives the video. This tells the model what kind of escalation or rhythm to expect.

```
[COMEDY ENGINE]
The structure is a ratchet - each cycle tightens one notch:
Wrong prop attempted → fails on set → blame exchanged → next wrong prop → fails worse → more blame.
The pedestal never gets filled. The argument never gets resolved.
```

Other examples:
- **Suspense**: "Each shot reveals one more piece of evidence. The audience should know something the character doesn't."
- **Romance**: "Push and pull - every approach is followed by a retreat. The distance between them shrinks by inches."
- **Product reveal**: "Build anticipation by showing the problem three times before the solution enters frame."

### 5. Timeline - Action-by-Action (the body of the prompt)

This is where most prompts fail. The difference between a mediocre and an excellent prompt is **density and specificity** in the timeline.

**For single clips (≤15s): use 1-2 second granularity.**
**For multi-clip segments: use 2-3 second granularity minimum.**

Never use the 5-second blocks `[0-5s] [5-10s] [10-15s]` as your primary structure - they're too coarse. Use them only as rough section markers if needed, but fill them with beat-by-beat action.

#### How to write a timeline beat

Each beat should contain:
- **Who** does **what** (specific physical action)
- **How** it looks (object details, spatial relationships)
- **What happens** as a result (physical consequence, reaction)

```
1-2s: [WRONG PROP ATTEMPT 1 - THE THERMOS]
She reaches into a case. Pulls out a large industrial thermos - silver, cylindrical,
40 centimeters tall. She holds it up. Tilts her head. Squints.
She hands it to him with the energy of someone presenting a solution.
He receives it. Holds it at arm's length. Looks at it.
Looks at the pedestal - which requires something approximately three times larger
and entirely decorative.
He looks at her.
She points at the pedestal. Her expression: put it there.
He walks it to the pedestal. Places it. Steps back.
The thermos sits on the pedestal - tiny, silver, industrial, obviously a thermos.
A beat. Both stare at it.
```

Notice: no camera instructions mixed in. The action is pure narrative. Camera can be a separate note if needed, but action comes first.

### 6. Sound Design (per-segment, not a footnote)

Sound design is **not optional**. renoise-2.0 generates audio with the video. Specific sound descriptions improve both the audio AND the visual output - they help the model understand the physical reality of the scene.

**Bad** (what the old framework did):
```
Sound design: desert ambient, SFX.
```

**Good** (per-beat sound layer):
```
Sound: thermos placed on pedestal - a hollow metal ring - silence - footsteps returning -
thermos placed back into hands - another hollow ring.
```

```
Sound: clipboard pages, desert wind, his footsteps arriving,
the specific silence of shared professional catastrophe.
```

```
Sound: reflector sheet wrapping sounds, tape ripping, footsteps to pedestal -
then the wind hitting the construction - slow rotation - then the collapse:
plastic cones hitting cracked earth, reflector sheet crumpling, tape releasing -
then her pen on paper.
```

Write sound for **each timeline segment**. Layer ambient + action SFX + character sounds. Name specific materials and their acoustic properties.

### 7. Realism & Stability Lock (closing block)

Instead of just listing things to avoid, **declare what physical reality should look like** in this video. Affirmative constraints are stronger than negative ones.

```
[REALISM LOCK]
Prop physics: thermos rings on pedestal accurately, cone construction topples
with realistic wind physics and material cascade, final assemblage has plausible
structural integrity for its two-second hold.
Clipboard tug-of-war: realistic paper tension, neither character releases it.
Walkie-talkie crackle: accurate radio audio texture.
@avatar_girl — female, zero identity drift. Vest pockets depleting continuously.
@avatar_boy — male, zero identity drift. Gaffer tape roll visibly smaller across takes.
No music. No voiceover. No subtitles. No text. Diegetic audio only.
16:9 enforced. No glitches, no floating objects, no duplicated limbs.
```

This section does two things:
1. Tells the model the **physics rules** of the world (how materials behave, how objects sound)
2. Locks **continuity details** that should persist (depleting pockets, shrinking tape roll)

---

## Multi-Clip: Structure & Continuity

### Narrative Arc Templates

Use these as starting structures, then let the story reshape them:

- **30s (2 segments)**: S1 = hook + setup, S2 = escalation + payoff
- **45s (3 segments)**: S1 = setup + inciting incident, S2 = rising complications, S3 = climax + resolution
- **60s (4 segments)**: S1 = hook, S2 = development, S3 = climax, S4 = resolution/coda
- **90s+ (6-12 segments)**: Act I (20%) setup → Act II-A (30%) rising → Midpoint reversal → Act II-B (20%) escalation → Act III (20%) climax + resolve. Place the peak at 70-80% of total duration.

### Transition Types Between Segments

Design the **ending of each segment** to set up the next:

| Transition | Technique | When to Use |
|------------|-----------|-------------|
| **Action Bridge** | End mid-action → next segment continues the motion | Physical movement, chase, dance |
| **Gaze Lead** | Character looks toward something → next segment reveals it | Mystery, discovery |
| **Sound Bridge** | Next scene's ambient sound bleeds into current ending | Location changes |
| **Match Cut** | Similar shape/color/motion links two different shots | Thematic connections |
| **Emotional Shift** | Abrupt mood change (quiet→loud or loud→quiet) | Surprises, twists |
| **Time Jump** | Visual time indicators (light change, seasons) | Montage, passage of time |
| **Spatial Flow** | Camera moves through a door/window into new space | Exploration, journey |

### Serial continuity routing: choose based on the scene goal

For continuity blocks in the same location, choose the method based on what must stay fixed:

**Use tail-frame → next `first_frame` when:**
- The next shot must open on an exact composition from the previous shot
- Pose, gaze, lighting state, or prop placement needs to match precisely
- You want a clean visual handoff, but the next shot can develop new motion after the opening frame

Workflow:
1. End the current segment on a clean, readable composition
2. Generate the segment
3. Extract the previous segment's tail frame with ffmpeg
4. Upload that extracted image and use it as the next segment's `first_frame`

Recommended extraction command:
```bash
ffmpeg -sseof -0.2 -i previous-segment.mp4 -frames:v 1 -q:v 2 -y next-first-frame.jpg
```

When you design segment endings for this workflow, the final 1-2 seconds should settle into a clear pose, gaze direction, lighting state, and prop state that can survive extraction as a single still frame.

**Use `ref_video` when:**
- Motion/style transfer matters more than pinning the next shot's opening frame
- The transition itself is dynamic and the previous clip's movement should influence the next one
- A single extracted still frame is not enough to carry the intended continuity

When using `ref_video` serial chain, the model physically continues from the previous segment's ending frame — focus transition design on the **last 2-3 seconds** of each segment.

### Same style line everywhere
Copy your style foundation block (Section 1) identically into every segment.

### Full character block everywhere
Copy the entire character description (Section 2) verbatim into every segment. Never abbreviate "East Asian woman, late 20s, shoulder-length black hair with subtle auburn highlights" to "the woman" or "Maya."

#### Drift vulnerability ranking

Features that drift most easily across segments (highest risk first):
1. **Hair color & length** - most volatile. Always specify shade, length, texture.
2. **Skin tone** - use specific terms ("warm ivory", "deep espresso brown"), not vague ("light", "dark").
3. **Clothing color** - must include texture + cut + color: "oversized cream-colored chunky-knit wool cardigan" not "white sweater".
4. **Age** - state explicitly: "late 20s" not "young woman".

#### Wardrobe three-part formula
Every garment: `[texture/material] + [cut/style] + [color]`
```
"Oversized cream-colored chunky-knit wool cardigan"
 ↑ cut      ↑ color     ↑ texture/material  ↑ garment
```

Accessories and unique features act as visual anchors - include in every prompt:
- Jewelry: "Small gold hoop earrings, thin gold chain bracelet on left wrist"
- Tattoos: "Small constellation tattoo on inner right wrist"
- Props: "Clipboard permanently in hand"

### Bridge formula
Every segment after S1 must start with:
```
Continuing from the previous shot: [exact ending state of previous segment -
character position, prop state, emotional state, lighting state].
```

What to include: character position + pose, prop state, emotional expression, lighting state, environmental state (door open, etc.).
What NOT to include: camera angles (new shot may differ), music cues, dialogue.

### Continuity tracking
Track prop/wardrobe state changes across segments. If her vest pockets are full in S1 and half-empty in S3, say so. If his tape roll is smaller, say so. These micro-details make the video feel like one continuous world.

### Hiding inevitable inconsistency
AI clips will have ~80% visual consistency at best. Design transitions to mask the remaining 20%:
- **Whip pan / motion blur** at segment boundaries hides appearance jumps
- **Close-up → Wide** scale change between segments masks small differences
- **Cut on action** (end mid-movement, start completing it) - the viewer follows the action, not appearance
- **Cross-dissolve** (0.3-0.5s) in post-production softens visual jumps between parallel-generated clips

---

## Adaptation & Source Material

When adapting existing material (novels, screenplays, manga):

**Prioritize scenes that are:**
- Visually striking - strong imagery the AI model can render well
- Emotionally intense - peaks in the character's arc
- Self-contained - comprehensible without extensive context
- Action-rich - physical movement, not just dialogue/internal monologue

**Deprioritize:**
- Exposition-heavy scenes (hard to visualize)
- Scenes requiring >2 characters simultaneously (AI struggles with crowds)
- Scenes that only make sense with full novel context

**Condensation techniques:**
- Merge two scenes that serve similar purposes into one segment
- Cut transitional scenes - jump straight to the next emotional beat
- Externalize internal monologue - show the emotion through action/expression
- Simplify multi-character scenes to focus on 1-2 key characters

---

## What NOT to Do

- **Don't write generic actions**: "She interacts with the object" → write exactly what she does with her hands
- **Don't summarize**: "They argue about whose fault it is" → write the specific pointing gestures, clipboard grabs, stepping patterns
- **Don't front-load camera instructions**: action first, camera second. The model needs to understand the scene before knowing how to film it
- **Don't use energy numbers**: "⚡ Energy: 7" means nothing to renoise-2.0. Write the actual pacing - fast cuts, slow holds, motion blur
- **Don't put BGM instructions for narrative videos**: if the video should have diegetic audio only, say so. BGM instructions are for e-commerce/product videos.
- **Don't skip sound design**: every silent prompt is a wasted opportunity to improve the visual output

---

## Referencing Materials in Prompts - The `@name` Syntax

When you attach reference images (character photos, product shots, scene refs) as materials, you **must** also reference them in the prompt text using `@name`. This tells the model which uploaded image corresponds to which character or object in your prompt.

### Setup: Upload → Register → Write `@name` in prompt

**Step 1: Upload and register materials** (see visual-dev.md for details)

```bash
# Upload character image
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs material upload avatar_girl.png
# → material ID #101

# Register as asset (required for images with faces)
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs asset register 101 --name "avatar_girl"
# → asset ID #27

# Same for second character
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs material upload avatar_boy.png
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs asset register 102 --name "avatar_boy"
# → asset ID #28
```

**Step 2: Use `@name` in the prompt** to bind each reference to its character.

`@name` does NOT include file extensions - use `@avatar_girl`, not `@avatar_girl.png`.

```
[CHARACTERS]
@avatar_girl - Prop Sourcer. Female, identity lock. Utility vest, clipboard in hand.
She was responsible for bringing the props. She brought everything except the correct one.

@avatar_boy - Prop Executor. Male, identity lock. Matching utility vest, tool belt,
walkie-talkie on shoulder.

[TIMELINE]
0-2s: @avatar_girl reaches into the case. Pulls out a thermos.
She hands it to @avatar_boy with the energy of someone presenting a solution.
@avatar_boy receives it. Holds it at arm's length.
```

**Step 3: Attach materials via CLI when generating:**

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --prompt "<prompt with @avatar_girl and @avatar_boy references>" \
  --materials "asset:27:reference_image,asset:28:reference_image" \
  --duration 15 --ratio 16:9
```

The `@name` in the prompt is matched to the attached materials by name. The model uses the reference images to maintain the character's visual identity throughout the video.

### Rules

- **`@name` must match the material/asset name** you registered (e.g. `--name "avatar_girl"` → `@avatar_girl` in prompt). Do NOT include file extensions.
- **Use `@name` every time the character appears** - not just in the character definition block. In the timeline, write `@avatar_girl reaches into the case` so the model knows which face to apply to that action.
- **Multiple characters**: each gets their own `@name` and their own asset entry in the comma-separated `--materials` flag: `--materials "asset:27:reference_image,asset:28:reference_image"`
- **Works for non-face materials too**: product shots, scene references, etc. Upload as material, reference with `@name` in the prompt.
- **For face-containing images**: always register as User Asset first (`asset register`), then use `--materials "asset:ID:reference_image"`. Raw face materials will be blocked by privacy detection.

### Without `@name` (weaker)

If you pass `--materials "asset:27:reference_image"` but don't use `@name` in the prompt, the model receives the reference image but doesn't know which character it maps to. It may apply the reference randomly or ignore it. **Always use `@name` in the prompt when attaching reference materials.**

---

## Dialogue Format

When a character speaks, use the forced lip-sync format:

```
Spoken dialogue (say EXACTLY, word-for-word): "Stop scrolling - I threw out all my gym equipment for these three bands."
Mouth clearly visible when speaking, lip-sync aligned.
```

This format significantly improves lip-sync accuracy. Follow each dialogue line with the lip-sync instruction. Keep dialogue lines under 15 words each, max 3-4 lines per 15s segment.

---

## Complete Single-Clip Example

Below is the density and specificity level you should target for every prompt.

```
Cinematic 16:9 widescreen. Shot on ARRI Alexa 65, Cooke vintage cinema lenses.
35mm film grain, Kodak Vision3 500T grade - bleached desert, blown-out sky, brutal noon heat.
Hyperrealistic skin, zero retouching. Hard overhead sun, ink-black shadows.
Motion blur on all fast prop handling, gestures, reactive stumbles.

[CHARACTERS]
@avatar_girl - Prop Sourcer. Female, identity lock. Utility vest, all pockets stuffed
with visibly wrong items, clipboard permanently in hand. She was responsible for bringing
the props. She brought everything except the correct one. She has an explanation for this.

@avatar_boy - Prop Executor. Male, identity lock. Matching utility vest, tool belt,
walkie-talkie on shoulder. He receives what she gives him and makes it work on set.
Nothing she gives him works.

THE PROP: One large decorative vase. Tall, ornate, needed on the pedestal for the shot.
It is not here.
THE PEDESTAL: Center frame, background. Empty. Visible in almost every shot.

[COMEDY ENGINE]
The structure is a ratchet - each cycle tightens one notch:
Wrong prop attempted → fails on set → blame exchanged → next wrong prop → fails worse.

[TIMELINE]
0-2s: Wide shot. Desert. The pedestal. Empty.
He walks toward it from frame right - hands out, ready to receive the vase.
Stops. Looks at the empty pedestal. Turns slowly toward her.
She is at her prop cases - three large cases open on the cracked earth.
Looking at her clipboard. Then at the cases. Then at the clipboard again.

2-4s: She reaches into a case. Pulls out a large industrial thermos - silver,
cylindrical, 40 centimeters tall. Holds it up. Tilts her head. Squints.
Hands it to him with the energy of someone presenting a solution.
He receives it. Holds it at arm's length. Looks at the pedestal -
which requires something approximately three times larger.
Walks it to the pedestal. Places it. Steps back.
The thermos sits on the pedestal - tiny, silver, obviously a thermos.
A beat. Both stare at it.

4-6s: He points at the cases. His gesture: where is the actual vase.
She points at her clipboard. Her gesture: it was on the list.
He takes the clipboard. Points at a line. She takes it back. Points at a different line.
He points at the cases. She points at the clipboard. He points at the pedestal.
She points at the clipboard. Neither has moved toward a solution.
The pedestal is still empty in the background.

6-8s: She pulls two traffic cones from the case. Stacks them inverted on each other.
Wraps them in a silver reflector sheet. Tapes it. The result: a vaguely cylindrical
silver object. She presents it with full confidence.
He carries it to the pedestal. Places it. Steps back.
A gust of wind hits. The construction rotates slowly - a full lazy rotation -
then topples sideways onto the desert floor. Cascading crumple of reflector sheet
and plastic. He watches it fall. Turns to her.
She is already writing on her clipboard.

8-10s: Both working now - simultaneously, not communicating.
She stacks a hard hat on the thermos, wraps in reflector material.
He tapes three water bottles together, adds a funnel for an ornate top.
They finish at the same time. Both hold up their constructions. Look at each other's.
Swap - without speaking - try the other person's version. Still wrong.
He begins taping her construction to his. She watches. Then helps.
The result: tall, silver, multi-material, structurally questionable,
and completely unlike a decorative vase in every possible way.

10-12s: They carry it together to the pedestal. Place it. Step back.
It holds. Both look at it.
This should be the end. It is not the end.
She opens her clipboard. Points to the original vase on the list.
He points to the confirmation field - which shows his signature.
He confirmed receipt of a vase that was not there.
She points at his signature. He points at the list entry.
She points at his signature again.
The clipboard between them like a net, neither able to let go.

12-15s: Wide shot. The walkie-talkie crackles. Director's voice - shot cancelled.
Different location. Moving on. No vase needed.
Neither of them moves. She points at the clipboard. He points at her.
Extreme wide shot - the desert vast, the production leaving in soft-focus background,
two figures in the mid-ground still pointing, clipboard between them,
the argument continuing at the same volume into the empty desert.
The crew is gone. They are still there. Cut to black.

[SOUND DESIGN]
0-2s: Desert wind, footsteps on cracked earth, clipboard pages turning.
2-4s: Thermos placed on pedestal - hollow metal ring - silence - footsteps back.
4-6s: Clipboard changing hands, pages flipping, two sets of pointing gestures cutting air.
6-8s: Reflector sheet wrapping, tape ripping, wind hitting construction, slow rotation,
collapse - plastic on earth, reflector crumpling, tape releasing, pen on paper.
8-10s: Rapid assembly - tape, plastic, metal, foil - the swap - reluctant sync.
10-12s: Paper tension sound, fingers gripping clipboard, neither releasing, desert wind.
12-15s: Walkie-talkie crackle, vehicle engines receding, wind picking up,
two voices still arguing - not angry, just automatic - fading into black.

[REALISM LOCK]
@avatar_girl - female, zero identity drift. Vest pockets depleting continuously.
@avatar_boy - male, zero identity drift. Gaffer tape roll visibly smaller.
Prop physics: thermos rings accurately, cone construction topples with realistic wind physics.
Clipboard: same physical object throughout, edges worn by end.
No music. No voiceover. No subtitles. No text. Diegetic audio only.
16:9 enforced. No glitches, no floating objects, no duplicated limbs.
```

This is the target. Every prompt you write should aim for this level of density, specificity, and physical reality.
