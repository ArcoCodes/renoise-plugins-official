# Prompt Craft - Writing High-Density Video Prompts

This is the main creative reference in the director Skill. Model capabilities and guidance come from the current host's live capability source; this document only covers model-independent prompt craft. The selected `model-routing` profile overrides this document when a model needs a different structure, density, or reference style.

---

## The Core Principle

**Write like a director dictating on set, not like a screenwriter summarizing a scene.**

Bad: "She picks up a thermos and places it on the pedestal. He looks at it skeptically."

Good: "She reaches into the case. Pulls out a large industrial thermos - silver, cylindrical, 40 centimeters tall. She holds it up. Tilts her head. Squints. She hands it to him with the energy of someone presenting a solution. He receives it. Holds it at arm's length. Looks at it. Looks at the pedestal - which requires something approximately three times larger and entirely decorative."

The model responds to **specificity and physical detail**. Every action should have a visible physical result. Every object should have material, size, and color. Every gesture should have intention.

---

## Prompt Structure

A complete prompt has these sections, in this order:

### 1. Style & Camera Foundation (2-3 lines) — the STYLE BIBLE

Persistent visual DNA. Film stock, lens, grade, aspect ratio. This stays **identical across all segments** of a multi-clip project — it *is* the STYLE BIBLE (see the dedicated section below).

```
Cinematic 16:9 widescreen. Shot on ARRI Alexa 65, Cooke vintage cinema lenses.
35mm film grain, Kodak Vision3 500T grade - bleached desert, blown-out sky, brutal noon heat.
Hyperrealistic skin, zero retouching. Hard overhead sun, ink-black shadows.
NEGATIVE: anime, 3D cartoon render, video-game CG, plastic skin.
```

Not a checklist - a **visual world declaration**. The model should feel the texture of the image from this alone. For any multi-shot project the foundation **must** carry a NEGATIVE line and be prepended verbatim to every segment — see below.

### 2. Characters (full block per character)

Each character gets: **identity lock + appearance + wardrobe + narrative function + behavioral pattern**.

```
@material:101 — Prop Sourcer. Female, identity lock.
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

**For single clips: use roughly 1–2 second granularity within the selected duration.**
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

When the selected model advertises audio generation, sound design is **not optional**. Specific sound descriptions can improve both audio and visual coherence by grounding the physical scene.

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
@material:101 — female, zero identity drift. Vest pockets depleting continuously.
@material:102 — male, zero identity drift. Gaffer tape roll visibly smaller across takes.
No music. No voiceover. No subtitles. No text. Diegetic audio only.
16:9 enforced. No glitches, no floating objects, no duplicated limbs.
```

This section does two things:
1. Tells the model the **physics rules** of the world (how materials behave, how objects sound)
2. Locks **continuity details** that should persist (depleting pockets, shrinking tape roll)

---

## Multi-Clip: Structure & Continuity

### Style Bible (prepend to every segment)

Before splitting into segments, freeze one **STYLE BIBLE** string and prepend it **verbatim** to the top of every segment prompt. It has four parts:

`art style + camera language + color grade + NEGATIVE line`

```
STYLE BIBLE (prepend every segment): photorealistic live-action cinematic wuxia film,
shot on ARRI, shallow depth of field, teal-and-gold grade, volumetric light.
NEGATIVE: anime, 3D cartoon render, video-game CG, plastic skin.
```

Why it matters:
- **Style drift**: without a shared, repeated style declaration the model wanders — a live-action piece can flip to 3D-cartoon / game-CG mid-sequence. The Style Bible pins it every segment.
- **VFX-heavy segments are the highest drift risk.** Segments dense with effects ("golden energy pouring into the body", energy bursts, transformations) pull hardest toward cartoon/CG rendering. **Never drop the NEGATIVE line on these segments** — it is the guardrail.
- **Color-temperature jumps**: put ONE color grade in the Bible ("teal-and-gold grade") and repeat it. Do not let each segment invent its own grade — that is what makes the color temperature leap between shots.

The Style Bible is a locked line item of the director skill's **Gate 2 Consistency Manifest**.

### Transition Table (design cuts before you generate)

For a multi-shot piece, plan the **cut points** explicitly and get them confirmed as part of Gate 2. For every boundary record three things:

| Cut | Prev segment OUT-frame | Next segment IN-frame | Linking technique |
|-----|------------------------|-----------------------|-------------------|
| S1→S2 | hero stands, sword lowered, dusk amber | hero mid-stride, same amber light | motion match + tonal carry |
| S3→S4 | golden light peaks, hero centered & symmetric | hero centered & symmetric, same gold grade | match-cut composition + tonal carry |

Linking techniques: **match-cut composition** (same framing/shape), **motion match** (movement continues across the cut), **tonal carry** (same grade/light state across the cut), **action continuation** (a gesture begun in one shot completes in the next). The out-frame and in-frame states here must agree with what the segment prompts actually describe.

**Good-transition reference — S3→S4**: when S3 ended on a warm-gold, centered, symmetric hero composition and S4 opened on the *same* gold grade and the *same* centered symmetric hero framing, the join was seamless. Match the out-frame's grade **and** composition to the next in-frame; that combination (tonal carry + match-cut) is the strongest continuous-narrative join.

The Transition Table is also what backs the default continuity chain: when the next segment opens on the previous tail frame carried as `ref_image:0` + a "Use @material:101 as the first frame." prompt declaration (see "Serial continuity routing" below), that declaration is a soft lock — the out-frame/in-frame match recorded here is what makes it hold.

### Ending strategy (holds steady is last-segment only)

`frame holds steady` is **not** a per-segment default — using it on every segment produces a video that is four endings stapled together (and, paired with an establishing open on every segment, four beginnings too).

- **Final segment only** → may settle into `frame holds steady` for a clean button.
- **Every intermediate segment** → must end on a **hook the next segment can catch**: an in-progress motion, a gaze lead, or a held composition that the next in-frame matches. Design the last 1-2 seconds as the out-frame recorded in the Transition Table.
- Likewise, only S1 needs a full establishing open; later segments open on the carried continuity state, not a fresh establishing shot.

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

### Serial continuity routing

Inspect the selected model's live capabilities before choosing anchors. Never assume a role or role combination from an old recipe.

- Reuse an approved character/product/scene material through an advertised image-reference role when appearance matters.
- Reuse a completed result only when the selected model advertises a compatible video-reference capability and motion carryover matters.
- For an exact opening state, use a dedicated media capability to extract the previous tail frame and attach it through an advertised frame role. If that capability is unavailable, use an existing approved image reference and describe the intended opening composition; do not guess a local command.
- Reinforce every handoff with the verbatim opening-state bridge and a match cut in the Transition Table. Use a short cross-dissolve only when the host exposes media editing.

Design the end of each intermediate segment as a readable motion/composition hook the next segment can continue.

### Same style line everywhere
Copy your STYLE BIBLE / style foundation block (Section 1) identically into every segment — including its NEGATIVE line. See "Style Bible" above.

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
Track prop/wardrobe state changes across segments in the **Props & Wardrobe Continuity Table** (see visual-dev.md), and copy each key prop's fixed description (material + color + form) verbatim into every segment it appears in. A prop must not silently mutate — e.g. a jade token that is a "translucent green jade shard" stays that, it does not become white porcelain in one segment and raw green stone in another. Distinguish **constant traits** (locked every segment) from **plot-driven changes** (a costume/prop upgrade the plot requires): a plot change must be staged as its **own explicit transformation shot**, never an untransitioned jump between adjacent segments. Small continuity micro-details still help — if her vest pockets are full in S1 and half-empty in S3, say so; if his tape roll is smaller, say so.

### Smoothing residual variance (after you've locked the reference)
**Consistency is engineered, not hoped for.** For any character in 2+ segments, first lock their look with a character-sheet `ref_image` reused in every segment (see `visual-dev.md`) — that is what holds the face, hair, and wardrobe steady. The verbatim character block above and the transition techniques below sit **on top of** that reference lock to smooth any residual frame-to-frame variance between independently generated clips; they are **not** a substitute for locking, and you should never present drift to the user as an expected outcome.

Once the reference is locked, these editing choices absorb the small remaining differences:
- **Whip pan / motion blur** at segment boundaries softens appearance jumps
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
- **Don't use energy numbers**: "⚡ Energy: 7" is not a visual instruction. Write the actual pacing — fast cuts, slow holds, motion blur.
- **Don't put BGM instructions for narrative videos**: if the video should have diegetic audio only, say so. BGM instructions are for e-commerce/product videos.
- **Don't skip sound design**: every silent prompt is a wasted opportunity to improve the visual output

---

## Referencing Materials in Prompts — The `@material:{id}` Syntax

When the host attaches reference images, videos, or audio as materials, reference each one by its returned material ID using `@material:{id}`. IDs bind precisely even when files share a name. IDs such as 101/102 in examples are placeholders—substitute the IDs returned in the current workflow.

### Register → Write `@material:{id}` in prompt

1. Register or select each user-authorized reference through the host's material capability.
2. Record the returned material ID.
3. Write `@material:` followed by that ID (`101` → `@material:101`) and attach the same ID through an advertised material role.

```
[CHARACTERS]
@material:101 - Prop Sourcer. Female, identity lock. Utility vest, clipboard in hand.
She was responsible for bringing the props. She brought everything except the correct one.

@material:102 - Prop Executor. Male, identity lock. Matching utility vest, tool belt,
walkie-talkie on shoulder.

[TIMELINE]
0-2s: @material:101 reaches into the case. Pulls out a thermos.
She hands it to @material:102 with the energy of someone presenting a solution.
@material:102 receives it. Holds it at arm's length.
```

Attach the registered materials through roles advertised by the selected model. The server converts ID tokens to each provider's positional syntax using the submitted material order.

### Rules

- **The token ID and attached material ID must match.** An unattached/orphan token is removed by the server.
- **Use the same token every time the character or object appears**, not just in its definition block.
- **Multiple references**: each gets a distinct material ID, token, purpose, and advertised role; IDs avoid filename collisions.
- **Separate tokens with whitespace or punctuation.** Never concatenate tokens or put digit-leading text directly after one.
- **Works for non-face materials too**: product shots, scene references, props, video, and audio when the model advertises those roles.
- **Face-containing images**: inspect live roles/guidance and reuse the same approved material ID for a recurring character.

### Without an ID token (weaker)

Attaching a material without mapping it in the prompt may leave the model unsure which subject or purpose it represents. Use `@material:{id}` whenever the prompt needs precise assignment.

---

## Dialogue Format

**First, the Spoken-language Hard Rule (see SKILL.md):** any segment with dialogue / voiceover / narration requires you to **confirm the spoken language with the user before writing prompts**, and to write the dialogue line **verbatim in that confirmed language** — the model speaks whatever language the line text is in, so translating the line changes the voice. For a dialogue-dense segment, keep the whole segment prompt in the spoken language so a large English block does not drag the speech toward English. Label the spoken language of each dialogue segment in the Gate 2 preview ("S4 口播：中文").

When a character speaks, write the line in the confirmed language and mark the mouth as visible:

```
Spoken dialogue (say EXACTLY, word-for-word): "别刷了——我把家里的健身器材全扔了，就为了这三条弹力带。"
Mouth clearly visible when speaking.
```

This format can improve mouth motion when the selected model's guidance supports generated speech. Keep lines short, keep the segment's dominant language aligned with the spoken language, and never promise frame-accurate lip sync.

---

## Complete Single-Clip Example

Below is the density and specificity level you should target for every prompt.

```
Cinematic 16:9 widescreen. Shot on ARRI Alexa 65, Cooke vintage cinema lenses.
35mm film grain, Kodak Vision3 500T grade - bleached desert, blown-out sky, brutal noon heat.
Hyperrealistic skin, zero retouching. Hard overhead sun, ink-black shadows.
Motion blur on all fast prop handling, gestures, reactive stumbles.

[CHARACTERS]
@material:101 - Prop Sourcer. Female, identity lock. Utility vest, all pockets stuffed
with visibly wrong items, clipboard permanently in hand. She was responsible for bringing
the props. She brought everything except the correct one. She has an explanation for this.

@material:102 - Prop Executor. Male, identity lock. Matching utility vest, tool belt,
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
@material:101 - female, zero identity drift. Vest pockets depleting continuously.
@material:102 - male, zero identity drift. Gaffer tape roll visibly smaller.
Prop physics: thermos rings accurately, cone construction topples with realistic wind physics.
Clipboard: same physical object throughout, edges worn by end.
No music. No voiceover. No subtitles. No text. Diegetic audio only.
16:9 enforced. No glitches, no floating objects, no duplicated limbs.
```

This is the target for models that reward dense director briefs. Always keep the specificity and physical reality, but let the selected `model-routing` profile set the final density and structure.
