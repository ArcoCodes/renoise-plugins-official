# E-commerce Short Video Prompt Guide

## 15-Second E-commerce Video Prompt Template

### Core Structure: One Continuous 15-Second Narrative

Unlike Apple's "Don't Blink" rapid-cut style, e-commerce product videos use **one continuous shot**, showcasing product and model through camera movement changes.

**Writing order**: Timeline narrative + Ad-6D elements interspersed

```
[Opening 0-3s] HOOK — Product must appear in frame 1 + fast camera move + start speaking immediately. Never slow-start.
[Showcase 3-8s] Product close-up + material details + model interaction
[Scene 8-12s] Real-life scenario + usage demonstration + atmosphere
[Close 12-15s] Model facing camera + product hold + natural closing
```

### Product Anchor (prompt opening, one sentence)

Product appearance is conveyed through the reference image — the prompt only needs **one sentence** stating what the product is + its purpose:

```
The product is a [brand] [product type] for [primary use case], shown in the reference image.
The product must match the reference image exactly in every frame. Do not invent any packaging, box, or container unless the reference image shows one.
```

**Examples**:
- `The product is a K brand lightweight gym tote bag for fitness and daily commute, shown in the reference image.`
- `The product is a Keep peanut-shaped massage ball for back and muscle recovery, shown in the reference image.`

**Key**: Do not repeat color, material, shape, or logo descriptions in the prompt — this info is already in the reference image. Save prompt space for the hook and visual narrative.

### Model Consistency Description

Immediately after the product anchor, lock the model's appearance:

```
A [age_range]-year-old [gender] with [hair description], [skin tone], [body type], wearing [outfit description]...
```

**Note**: Model appearance is described entirely through text — do not upload real-person reference images (privacy detection will block images containing real human faces).

## Category-Specific Keywords

### Clothing
- **Fabric**: flowing silk, crisp cotton, soft cashmere, stretchy knit, lightweight chiffon, structured tweed
- **Motion**: fabric sways gently, hem flutters in breeze, pleats catch light, drape follows body movement
- **Showcase**: twirls to show full skirt volume, adjusts collar detail, runs fingers along seam
- **Scene**: sunlit cafe terrace, cherry blossom garden path, minimalist white studio, golden hour rooftop

### Electronics
- **Material**: anodized aluminum, gorilla glass surface, matte finish, chamfered edges catch light
- **Motion**: screen illuminates face, finger glides across display, device rotates to reveal thin profile
- **Showcase**: holds up to camera showing screen, taps interface with precision, places on wireless charger
- **Scene**: modern desk setup, coffee shop workspace, commuter holding device, bedside nightstand

### Beauty
- **Texture**: dewy finish, velvety matte, glossy sheen, shimmering particles, creamy texture
- **Motion**: applies with brush stroke, blends with fingertip, lips press together, eyelids flutter
- **Showcase**: close-up of application, before-after glow, product swatch on skin, mirror reflection
- **Scene**: vanity mirror with ring light, bathroom morning routine, getting ready for night out

### Food
- **Texture**: steam rises, sauce glistens, crispy golden crust, juice drips, cheese stretches
- **Motion**: pours into bowl, breaks apart to reveal filling, scoops with spoon, bites with satisfaction
- **Showcase**: overhead flat lay, cross-section reveal, slow-motion pour, garnish placement
- **Scene**: rustic kitchen counter, outdoor picnic, cozy dining table, street food stall

### Home
- **Material**: warm wood grain, soft linen texture, smooth ceramic, brushed brass hardware
- **Motion**: hand caresses surface, opens drawer smoothly, arranges on shelf, light shifts across surface
- **Showcase**: styled vignette, before-after room transformation, detail close-up, scale with hand
- **Scene**: morning light through curtains, minimalist living room, cozy bedroom corner, modern kitchen

## Model-Product Interaction Vocabulary

### General Actions
- **Showcase**: holds up to camera, presents with both hands, turns to show different angle
- **Touch**: runs fingers along, gently touches, traces the outline of
- **Wear**: puts on, adjusts, styles with
- **Use**: opens, activates, applies
- **Emotion**: smiles confidently, looks surprised, nods approvingly, expresses delight

### Clothing-Specific
- twirls gracefully, walks toward camera, poses with hand on hip, flips hair to show neckline, adjusts sleeve cuff, smooths fabric over hip, turns to reveal back detail

### Electronics-Specific
- unboxes with anticipation, swipes through interface, holds up comparing to face size, places in pocket to show portability, tilts to catch light on screen

### Beauty-Specific
- applies with practiced motion, checks reflection, touches cheek feeling texture, pouts showing lip color, blinks showing eye makeup

## Dialogue Writing Guidelines

**Core principle**: Dialogue must be in English, embedded in the video prompt. Do not output separate subtitles.

**Embedding format** (forced lip-sync):
```
Spoken dialogue (say EXACTLY, word-for-word): "..."
Mouth clearly visible when speaking, lip-sync aligned.
```
Using `Spoken dialogue (say EXACTLY, word-for-word):` instead of simple `says "..."` significantly improves lip-sync accuracy. Follow each dialogue line with `Mouth clearly visible when speaking, lip-sync aligned.` to ensure mouth visibility.

**Style**: Casual friend vibe — like recommending to a friend, not reading ad copy. Every sentence carries specific info (numbers, comparisons, usage scenarios), no filler.

### Hook Dialogue (0-3s) — First line to stop the scroll

**Subversive** (most effective):
- "Stop scrolling — I threw out all my gym equipment for these three bands."
- "This tiny thing replaced my entire gym bag."
- "Business trip day three and I still have not skipped a workout."

**Personal experience**:
- "My nighttime routine that actually changed my body."
- "The one thing I have been recommending to literally everyone."

**Key**: Must start speaking immediately, paired with fast camera move (whip pan / snap dolly in) — never slow-start.

### Feature Dialogue (3-8s) — Specific specs + usage experience

- "Ten, fifteen, twenty pounds — I started pink, now I am on green, and they never roll up on you."
- "Three resistance levels, folds flat, weighs literally nothing — this is my entire travel gym."
- Must include: specific numbers + personal experience + differentiating advantage

### Scenario Dialogue (8-12s) — Where to use + portability/versatility

- "I do legs in my living room, arms on work trips — they fold smaller than my phone."
- "Park, backyard, hotel balcony — I have zero excuses now."
- Must include: at least 2 usage scenarios + portability/versatility

### Closing Dialogue (12-15s) — Natural personal recommendation, no hard sell

**Good closings** (recommended):
- "Honestly the best forty bucks I have spent this year."
- "Trust me just start — future you will be so grateful."
- "Best thing I ever packed."
- "You are welcome."

**Avoid these closings** (too pushy):
- ~~"Link below — grab yours before they sell out."~~
- ~~"Click the link for a special discount."~~

## Hook Strategy (First 3 Seconds — Make or Break)

**Data**: 63% of high-CTR TikTok videos hook the viewer within the first 3 seconds. Users make the "watch or scroll" decision in just **1.7 seconds**. Videos with 65%+ 3-second retention rate get **4-7x** more impressions.

### Visual Hook Techniques (pick one for the prompt opening)

| Technique | Prompt Wording | Effect |
|-----------|---------------|--------|
| **Speed zoom-in** | `Camera snaps in extreme close-up on the [product]` | Product appears in frame 1, maximum impact |
| **Product slides in** | `The [product] slides into frame from the right` | Sudden appearance, creates micro-suspense |
| **Hand thrust** | `A hand thrusts the [product] toward the camera` | Direct, strong UGC feel |
| **Close-up to reveal** | `Extreme macro on [texture detail], camera rapidly pulls back to reveal...` | Hook curiosity with detail, then reveal full picture |
| **Whip pan** | `Camera whip-pans with motion blur and lands on the [product]` | Strong rhythm, visual impact |

### Hook Core Rules

1. **Product must appear in frame 1** — no walking, opening doors, or establishing shots first
2. **Frame 1 must have motion** — static opening = instant scroll
3. **Model must start speaking within 2 seconds** — voice retains viewers better than visuals
4. **Hook dialogue should feel like stopping a friend** — not reading ad copy

### Hook Dialogue Formulas (ranked by effectiveness)

1. **Result-first**: "This $30 bag replaced my gym bag AND my purse." — show the result immediately
2. **Subversive**: "Stop carrying two bags to the gym — you only need this one." — challenge existing habits
3. **Social proof**: "200K people bought this last month and I finally get why." — FOMO
4. **Pain point**: "Why is your gym bag always so heavy?" — hit the pain point
5. **Personal story**: "I was that person with three bags until I found this." — relatability

## Camera Movement Pacing (15-second continuous shot)

```
[0-3s]  HOOK — Product in frame 1! Fast camera move + start speaking immediately
        Recommended: extreme close-up snap in / whip pan / product slides into frame
        Avoid: camera slowly pushes in, walking preamble, establishing shots
        Pacing: complete first camera change within 1-2 seconds

[3-8s]  SHOWCASE — Close-up to medium shot transition, showing product details
        Recommended: fast snap dolly in on details,
              camera orbits or slides to reveal texture

[8-12s] SCENE — Pull back to medium/wide shot, show usage scenario
        Recommended: camera pulls back to reveal full scene,
              natural movement as model interacts with environment

[12-15s] CLOSE — Return to medium shot, face camera, hold
         Recommended: camera pushes in tight, then settles,
               model faces camera, product in frame,
               frame holds steady (this final hold is critical)
```

## BGM Music Directive (specify in prompt)

The video model can generate background music within the video. **Must add BGM directive at the end of the prompt**:

```
Background music: [genre/mood description], [tempo], [energy level].
```

**BGM Selection Guide**:

| Product Category | Recommended BGM | Prompt Wording |
|-----------------|-----------------|----------------|
| Sports/Fitness | High-energy electronic/lo-fi | `Background music: upbeat electronic lo-fi beat, medium-fast tempo, energetic and motivating.` |
| Beauty/Skincare | Warm R&B / chill pop | `Background music: warm chill R&B, slow-medium tempo, soft and intimate.` |
| Electronics | Clean minimal / tech | `Background music: clean minimal electronic, medium tempo, modern and sleek.` |
| Fashion | Indie pop / trendy | `Background music: trendy indie pop, medium tempo, stylish and confident.` |
| Home | Acoustic / ambient | `Background music: warm acoustic guitar, slow tempo, cozy and relaxing.` |
| Food | Jazz / feel-good | `Background music: feel-good jazz, medium tempo, cheerful and appetizing.` |

**Key**: BGM should match the video pacing — hook section needs energy, closing can ease off. Music style should match the product's tone.

## Prompt Writing Style: Director Dictation

Prompts should be written as if a director is dictating instructions on set — 6-10 English sentences, each doing one thing. Avoid stuffing multiple actions into one long sentence.

**Good writing** (one action/camera instruction per sentence):
```
Camera snaps in on a close-up of the pink peanut massage ball sitting on a yoga mat.
A 25-year-old woman with a high ponytail and black leggings walks into frame.
She picks up the ball and holds it up to the camera.
Spoken dialogue (say EXACTLY, word-for-word): "This little thing saved my back after deadlifts."
Mouth clearly visible when speaking, lip-sync aligned.
She places the ball on the mat and lies down on it, rolling her spine.
Camera pulls back to a medium shot showing the full living room scene.
...
```

**Bad writing** (too many actions in one sentence):
```
A woman enters carrying a pink ball while the camera pans and she says "..." as she lies down and rolls.
```

## Prompt Quality Checklist

- [ ] Pure English director-dictation paragraph (6-10 sentences, one thing each)
- [ ] **Product anchor at the beginning** (one sentence: what the product is + purpose + match reference image + no packaging lock)
- [ ] Model appearance anchor description immediately after
- [ ] **Dialogue uses `Spoken dialogue (say EXACTLY, word-for-word):` format** (English, 4 lines, casual friend vibe)
- [ ] Each dialogue line followed by `Mouth clearly visible when speaking, lip-sync aligned.`
- [ ] Hook dialogue first, paired with fast camera move
- [ ] Closing dialogue feels natural, no hard sell
- [ ] Includes specific product material description keywords
- [ ] At least 3 camera changes
- [ ] Includes lighting/atmosphere description
- [ ] Clear model-product interaction
- [ ] Final frame holds steady
- [ ] Overall pacing: fast open > detail showcase > scenario > hold
- [ ] **BGM directive at the end** (`Background music: [genre], [tempo], [energy]`)
- [ ] Hook section — product appears in frame 1, no preamble

## Renoise Submission Notes

- **Must upload product image** as material (image1) — significantly improves product accuracy
- **Do not upload real-person/model images** — privacy detection will block them (error: PrivacyInformation)
- Model appearance is controlled entirely through prompt text descriptions
- Product images should ideally be clean white-background product-only photos, avoiding images with marketing text overlays
- For batch generation: reuse the same material ID, just change the scenario/dialogue
