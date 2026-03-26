# E-commerce Short Video Prompt Guide

## 15-Second E-commerce Video Prompt Template

### Core Structure: One Continuous 15-Second Narrative

Unlike Apple's "Don't Blink" rapid-cut style, e-commerce product videos are **one continuous shot** that uses camera movement changes to showcase the product and model.

**Writing order**: Timeline narrative + Ad-6D elements interspersed

```
[Opening 0-3s] HOOK — Product MUST appear in Frame 1 + fast camera movement + start speaking immediately. Never build up slowly.
[Showcase 3-8s] Product close-up + material details + model interaction
[Scene 8-12s] Lifestyle scenario + usage effect + atmosphere
[Close 12-15s] Model faces camera + product freeze frame + natural ending
```

### Product Anchoring (Start of Prompt, One Sentence)

Product appearance is conveyed by the reference image. The prompt only needs **one sentence** stating what the product is + its use case:

```
The product is a [brand] [product type] for [primary use case], shown in the reference image.
The product must match the reference image exactly in every frame. Do not invent any packaging, box, or container unless the reference image shows one.
```

**Examples**:
- `The product is a K brand lightweight gym tote bag for fitness and daily commute, shown in the reference image.`
- `The product is a Keep peanut-shaped massage ball for back and muscle recovery, shown in the reference image.`

**Key**: Do not repeat product color, material, shape, or logo descriptions in the prompt — that information is already in the reference image. Save prompt space for the hook and visual narrative.

### Model Consistency Description

Immediately after the product anchoring, anchor the model's appearance:

```
A [age_range]-year-old [gender] with [hair description], [skin tone], [body type], wearing [outfit description]...
```

**Note**: Models are described entirely through text — never upload real person reference images (privacy detection will block images containing realistic human faces).

## Category-Specific Keywords

### Clothing

- **Fabric**: flowing silk, crisp cotton, soft cashmere, stretchy knit, lightweight chiffon, structured tweed
- **Motion**: fabric sways gently, hem flutters in breeze, pleats catch light, drape follows body movement
- **Showcase**: twirls to show full skirt volume, adjusts collar detail, runs fingers along seam
- **Scene**: sunlit café terrace, cherry blossom garden path, minimalist white studio, golden hour rooftop

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
- **Wear/Use**: puts on, adjusts, styles with
- **Activate**: opens, activates, applies
- **Emotion**: smiles confidently, looks surprised, nods approvingly, expresses delight

### Clothing-Specific
- twirls gracefully, walks toward camera, poses with hand on hip, flips hair to show neckline, adjusts sleeve cuff, smooths fabric over hip, turns to reveal back detail

### Electronics-Specific
- unboxes with anticipation, swipes through interface, holds up comparing to face size, places in pocket to show portability, tilts to catch light on screen

### Beauty-Specific
- applies with practiced motion, checks reflection, touches cheek feeling texture, pouts showing lip color, blinks showing eye makeup

## Dialogue Writing Guidelines

**Core principle**: Dialogue must be in English, embedded within the video prompt. Do not output subtitles separately.

**Embedding format** (forced lip-sync):
```
Spoken dialogue (say EXACTLY, word-for-word): "..."
Mouth clearly visible when speaking, lip-sync aligned.
```
Using `Spoken dialogue (say EXACTLY, word-for-word):` instead of simply `says "..."` significantly improves lip-sync accuracy. Follow each dialogue line with `Mouth clearly visible when speaking, lip-sync aligned.` to ensure the mouth is visible.

**Style**: Best-friend casual tone — like recommending to a friend, not reading ad copy. Every sentence carries specific information (numbers, comparisons, usage scenarios) — no filler.

### Hook Dialogue (0-3s) — First Line to Stop the Scroll

**Subversive** (most effective):
- "Stop scrolling — I threw out all my gym equipment for these three bands."
- "This tiny thing replaced my entire gym bag."
- "Business trip day three and I still have not skipped a workout."

**Personal experience**:
- "My nighttime routine that actually changed my body."
- "The one thing I have been recommending to literally everyone."

**Key**: Start speaking fast, paired with fast camera movement (whip pan / snap dolly in). Never start slow.

### Selling Point Dialogue (3-8s) — Specific Specs + Personal Experience

- "Ten, fifteen, twenty pounds — I started pink, now I am on green, and they never roll up on you."
- "Three resistance levels, folds flat, weighs literally nothing — this is my entire travel gym."
- Must include: specific numbers + personal usage experience + differentiating advantage

### Scene Dialogue (8-12s) — Where to Use + Portability / Versatility

- "I do legs in my living room, arms on work trips — they fold smaller than my phone."
- "Park, backyard, hotel balcony — I have zero excuses now."
- Must include: at least 2 usage scenarios + portability/versatility

### Closing Dialogue (12-15s) — Natural Personal Recommendation, No Hard Sell

**Good closings** (recommended):
- "Honestly the best forty bucks I have spent this year."
- "Trust me just start — future you will be so grateful."
- "Best thing I ever packed."
- "You are welcome."

**Avoid these closings** (too pushy):
- ~~"Link below — grab yours before they sell out."~~
- ~~"Click the link for a special discount."~~
- ~~"Limited stock, hurry up!"~~

## Hook Strategy (The First 3 Seconds)

**Data**: 63% of high-CTR TikTok videos capture users in the first 3 seconds. Users make the "watch or swipe" decision in just **1.7 seconds**. Videos with 65%+ 3-second retention rate get **4-7x** more impressions.

### Visual Hook Techniques (pick one for prompt opening)

| Technique | Prompt Phrasing | Effect |
|-----------|----------------|--------|
| **Snap zoom-in** | `Camera snaps in extreme close-up on the [product]` | Product in Frame 1, maximum impact |
| **Product slides in** | `The [product] slides into frame from the right` | Sudden appearance creates micro-suspense |
| **Hand thrust** | `A hand thrusts the [product] toward the camera` | Direct, strong UGC feel |
| **Close-up → wide reveal** | `Extreme macro on [texture detail], camera rapidly pulls back to reveal...` | Hook curiosity with detail, then reveal full picture |
| **Whip pan in** | `Camera whip-pans with motion blur and lands on the [product]` | Strong rhythm, visual impact |

### Hook Core Rules

1. **Product MUST appear in Frame 1** — never start with someone walking, opening a door, or establishing the environment
2. **Frame 1 MUST have motion** — static opening = instant swipe
3. **Model MUST start speaking within the first 2 seconds** — audio retains more than visuals
4. **Hook dialogue should feel like stopping a friend** — not reading ad copy

### Hook Dialogue Formulas (ranked by effectiveness)

1. **Result-first**: "This $30 bag replaced my gym bag AND my purse." — Show the result directly
2. **Subversive**: "Stop carrying two bags to the gym — you only need this one." — Challenge existing habits
3. **Social proof**: "200K people bought this last month and I finally get why." — FOMO
4. **Pain point question**: "Why is your gym bag always so heavy?" — Hit the pain point directly
5. **Personal story**: "I was that person with three bags until I found this." — Relatability

## Camera Movement Pacing (15s Continuous Shot)

```
[0-3s]  HOOK — Product in Frame 1! Fast camera movement + start speaking immediately
        Recommended: extreme close-up snap in / whip pan / product slides into frame
        Avoid: camera slowly pushes in, person walking as buildup, empty establishing shot
        Pacing: Complete the first camera change within 1-2 seconds

[3-8s]  SHOWCASE — Close-up → medium shot transition, showcase product details
        Recommended: fast snap dolly in on details,
              camera orbits or slides to reveal texture

[8-12s] SCENE — Pull back to medium/wide shot, show usage scenario
        Recommended: camera pulls back to reveal full scene,
              natural movement as model interacts with environment

[12-15s] CLOSE — Return to medium shot, face camera, freeze
         Recommended: camera pushes in tight, then settles,
               model faces camera, product in frame,
               frame holds steady (this final hold is important)
```

## BGM Instructions (Specified in Prompt)

The video model can generate background music within the video. **Always add a BGM instruction at the end of the prompt**:

```
Background music: [genre/mood description], [tempo], [energy level].
```

**BGM Selection Guide**:

| Product Category | Recommended BGM | Prompt Phrasing |
|-----------------|-----------------|-----------------|
| Sports / Fitness | Rhythmic electronic / lo-fi | `Background music: upbeat electronic lo-fi beat, medium-fast tempo, energetic and motivating.` |
| Beauty / Skincare | Warm R&B / chill pop | `Background music: warm chill R&B, slow-medium tempo, soft and intimate.` |
| Electronics | Clean minimal / tech | `Background music: clean minimal electronic, medium tempo, modern and sleek.` |
| Fashion | Indie pop / trendy | `Background music: trendy indie pop, medium tempo, stylish and confident.` |
| Home | Acoustic / ambient | `Background music: warm acoustic guitar, slow tempo, cozy and relaxing.` |
| Food | Jazz / feel-good | `Background music: feel-good jazz, medium tempo, cheerful and appetizing.` |

**Key**: BGM should match the video pacing — the hook segment needs energy, the closing can ease up. Music style should match the product's brand tone.

## Prompt Writing Style: Director Dictation

Prompts should be written as if a director is dictating on set — 6-10 English sentences, each doing only one thing. Avoid packing multiple actions into one long sentence.

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

**Bad writing** (too many actions crammed in one sentence):
```
A woman enters carrying a pink ball while the camera pans and she says "..." as she lies down and rolls.
```

## Prompt Quality Checklist

- [ ] Pure English director-dictation style paragraph (6-10 sentences, one thing per sentence)
- [ ] **Product anchoring at the start** (one sentence: what the product is + use case + match reference image + no-packaging lock)
- [ ] Model appearance anchoring description immediately after
- [ ] **Dialogue uses `Spoken dialogue (say EXACTLY, word-for-word):` format** (English, 4 lines, best-friend casual tone)
- [ ] `Mouth clearly visible when speaking, lip-sync aligned.` after each dialogue line
- [ ] Hook dialogue in the first sentence, paired with fast camera movement
- [ ] Closing dialogue is natural, no hard sell
- [ ] Includes specific product material/texture descriptors
- [ ] At least 3 camera movement changes
- [ ] Includes lighting/atmosphere description
- [ ] Model has clear physical interaction with product
- [ ] Ending frame holds steady
- [ ] Overall pacing: fast open → detailed showcase → scene → freeze
- [ ] **BGM instruction at the end** (`Background music: [genre], [tempo], [energy]`)
- [ ] Hook segment has product in Frame 1, no buildup

## Renoise Submission Notes

- **Must upload product image** as material (image1) — product accuracy improves significantly
- **Never upload real person/model images** — privacy detection will block them (error: PrivacyInformation)
- Model appearance is controlled entirely by prompt text description
- Product images should ideally be clean white-background product photos, avoid images with marketing text overlays
- For batch generation: upload the product image once, reuse the material ID and swap scenes/dialogue
