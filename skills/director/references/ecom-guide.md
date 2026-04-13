# E-commerce Video Prompt Guide

For TikTok / short-form product videos. Read `prompt-craft.md` first for general prompt writing — this guide covers e-commerce-specific techniques.

---

## Structure: One Continuous 15s Shot

E-commerce videos are **one continuous shot** with camera movement changes to showcase the product and model. Not rapid-cut montage.

```
[0-3s]   HOOK — Product in Frame 1 + fast camera + start speaking immediately
[3-8s]   SHOWCASE — Product close-up + material details + model interaction
[8-12s]  SCENE — Lifestyle scenario + usage + atmosphere
[12-15s] CLOSE — Face camera + product in frame + frame holds steady
```

---

## Product Anchoring (Start of Prompt)

Product appearance comes from the reference image. The prompt needs only **one sentence**:

```
The product is a [brand] [product type] for [primary use case], shown in the reference image.
The product must match the reference image exactly in every frame.
Do not invent any packaging, box, or container unless the reference image shows one.
```

Do NOT describe product color/material/shape in the prompt — that's in the reference image. Save prompt space for the narrative.

---

## Model Description (Text-Only)

Never upload real person photos (privacy detection blocks them). Describe the model entirely in text:

```
A 25-year-old woman with blonde hair in a high ponytail, light tan skin, athletic build,
wearing a black sports bra and black fitted shorts...
```

---

## The First 3 Seconds (Hook)

63% of high-CTR TikTok videos capture users in the first 3 seconds. The "watch or swipe" decision happens in 1.7 seconds.

**Rules:**
1. Product **must** appear in Frame 1 — never start with someone walking or establishing the environment
2. Frame 1 **must** have motion — static opening = instant swipe
3. Model **must** start speaking within the first 2 seconds

**Visual hook techniques:**

| Technique | Prompt Phrasing |
|-----------|----------------|
| Snap zoom-in | `Camera snaps in extreme close-up on the [product]` |
| Hand thrust | `A hand thrusts the [product] toward the camera` |
| Whip pan | `Camera whip-pans with motion blur and lands on the [product]` |
| Close → wide reveal | `Extreme macro on [texture detail], camera rapidly pulls back to reveal...` |

**Hook dialogue formulas (ranked by effectiveness):**
1. Result-first: "This $30 bag replaced my gym bag AND my purse."
2. Subversive: "Stop carrying two bags to the gym — you only need this one."
3. Social proof: "200K people bought this last month and I finally get why."
4. Pain point: "Why is your gym bag always so heavy?"

---

## Dialogue Guidelines

Best-friend casual tone — recommending to a friend, not reading ad copy. Every sentence carries specific information (numbers, comparisons, scenarios).

```
[0-3s]   Hook: "Stop scrolling — I threw out all my gym equipment for these three bands."
[3-8s]   Specs: "Ten, fifteen, twenty pounds — I started pink, now I'm on green, and they never roll up."
[8-12s]  Scenes: "I do legs in my living room, arms on work trips — they fold smaller than my phone."
[12-15s] Close: "Honestly the best forty bucks I've spent this year."
```

**Closing lines — natural, no hard sell:**
- "Trust me just start — future you will be so grateful."
- "Best thing I ever packed."
- "You're welcome."

**Avoid**: "Link below", "limited stock", "click now" — too pushy.

**Format in prompt:**
```
Spoken dialogue (say EXACTLY, word-for-word): "Stop scrolling — I threw out all my gym equipment for these three bands."
Mouth clearly visible when speaking, lip-sync aligned.
```

---

## Camera Pacing

```
[0-3s]   Fast: extreme close-up snap / whip pan. Complete first camera change in 1-2s.
[3-8s]   Medium: snap dolly on details, orbit to reveal texture.
[8-12s]  Pull back: medium/wide shot, model interacts with environment.
[12-15s] Settle: camera pushes in tight then holds. Frame holds steady.
```

---

## BGM

Always add a BGM instruction at the end of e-commerce prompts:

```
Background music: [genre/mood], [tempo], [energy level].
```

| Category | BGM |
|----------|-----|
| Sports/Fitness | `upbeat electronic lo-fi, medium-fast, energetic and motivating` |
| Beauty/Skincare | `warm chill R&B, slow-medium, soft and intimate` |
| Electronics | `clean minimal electronic, medium, modern and sleek` |
| Fashion | `trendy indie pop, medium, stylish and confident` |
| Home | `warm acoustic guitar, slow, cozy and relaxing` |

---

## Category Keywords

**Clothing**: flowing silk, crisp cotton, fabric sways gently, hem flutters, twirls to show volume
**Electronics**: anodized aluminum, screen illuminates face, finger glides across display, rotates to reveal thin profile
**Beauty**: dewy finish, velvety matte, applies with brush stroke, blends with fingertip
**Food**: steam rises, sauce glistens, crispy golden crust, cheese stretches, slow-motion pour
**Home**: warm wood grain, soft linen texture, hand caresses surface, opens drawer smoothly

---

## Submission

```bash
# Upload product image
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs material upload <product-image>
# → returns material ID (e.g. 194)

# Generate
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --prompt "<prompt>" --model renoise-2.0 --duration 15 --ratio 9:16 \
  --materials "194:ref_image" --tags ecom,<brand>
```

Note: e-commerce videos typically use **9:16** (vertical) ratio, not 16:9.
