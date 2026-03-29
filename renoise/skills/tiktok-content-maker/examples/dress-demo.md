# Full Example: Keep Resistance Bands 15-Second Product Video

## Input

- Product image: Keep brand elastic resistance loop bands, 3-pack (pink/blue/green), pastel macaron colors
- Model reference: Athletic female, blonde ponytail, sports bra + fitted shorts (analysis only, NOT uploaded to Renoise)

## Product Analysis Results

```json
{
  "product": {
    "type": "elastic resistance loop bands",
    "color": "pink 10lb, blue 15lb, mint green 20lb",
    "material": "TPE elastic material, matte finish, soft and skin-friendly",
    "highlights": "Three different resistance levels for progressive training, foldable and portable, macaron color aesthetic",
    "brand_tone": "Young, sporty, trendy fitness"
  },
  "model": {
    "gender": "female",
    "age_range": "25-30",
    "hair": "blonde high ponytail",
    "outfit": "black sports bra + black fitted shorts",
    "vibe": "confident, energetic, professional fitness"
  },
  "scene_suggestions": [
    "bright modern living room morning workout",
    "hotel room travel fitness",
    "bedroom pre-sleep stretching"
  ],
  "selling_points": [
    "Three resistance levels for progressive training, suitable for beginners to advanced",
    "Compact and portable, folds into a bag for anytime anywhere workouts",
    "Macaron color palette, aesthetically pleasing, no rolling up"
  ]
}
```

## Generated Script

### 1. Video Prompt (English, with dialogue)

> The product is a set of three Keep brand elastic resistance loop bands — flat, wide, smooth matte TPE material with a soft rubbery texture, each band approximately 5cm wide and forming a closed loop. Colors: pastel pink (lightest resistance), sky blue (medium), mint green (heaviest). Each band has a small white "Keep" logo printed on the surface. The bands must match the reference image exactly in color, width, shape, material finish, and logo placement throughout every frame of the video. A fit young woman in her mid-twenties with blonde hair in a high ponytail, light tan skin, athletic build, wearing a black sports bra and black fitted shorts, holds the three pastel-colored Keep resistance bands fanned out in her hand — camera starts extreme close-up on the bands showing their flat wide shape and matte surface then whip pans up to her face as she says "Stop scrolling — I threw out all my gym equipment for these three bands." Morning sunlight from a large window catches the smooth TPE finish. Camera does a fast snap dolly in on her hands as she stretches the blue band taut, the flat wide band maintaining its shape and thickness as it stretches, she says "Ten, fifteen, twenty pounds — I started pink, now I am on green, and they never roll up on you." She has the mint green band already looped around both ankles, camera pulls back to medium shot as she performs side leg raises, the wide flat band visible around her ankles keeping its shape, she says "I do legs in my living room, arms on work trips — they fold smaller than my phone" while transitioning into a squat pulse with the pink band above her knees. Without stopping she grabs all three bands, folds them into a tiny square and tucks them into a small gym bag pocket, camera pushes in tight, then she looks straight into the camera with a knowing grin and says "Honestly the best forty bucks I have spent this year," the pastel colors pop against her black outfit, warm golden backlight creates a soft halo, frame holds steady.

### 2. Dialogue Script (English)

```
[0-3s]   "Stop scrolling — I threw out all my gym equipment for these three bands."
[3-8s]   "Ten, fifteen, twenty pounds — I started pink, now I'm on green, and they never roll up on you."
[8-12s]  "I do legs in my living room, arms on work trips — they fold smaller than my phone."
[12-15s] "Honestly the best forty bucks I've spent this year."
```

### 3. BGM/Sound Design Suggestions

- **BGM**: High-energy trap-pop beat, BPM 125-135, bass drop synced with 0s hook
- **Sound effects**:
  - [0s] Resistance band snap sound — paired with opening impact
  - [3s] Quick whoosh transition sound
  - [8s] Athletic rhythm drum accent
  - [12s] Bass swell + freeze-frame hit

## Renoise Submission

```bash
# 1. Upload product image (product image only, NOT model image)
node renoise-cli.mjs material upload <product-image-path>
# → returns material id, e.g. 194

# 2. Submit task (with product image material, all-in-one)
node renoise-cli.mjs task generate \
  --prompt "<Video Prompt above>" \
  --model renoise-2.0 --duration 15 --ratio 9:16 \
  --tags ecom,keep,resistance-band \
  --materials "194:image1"
```

## Multi-Scene Batch Generation

Same product can reuse the material ID with different scenarios:

| Scene | Hook Dialogue | Scene Keywords |
|-------|--------------|----------------|
| Outdoor park morning workout | "This tiny thing replaced my entire gym bag." | sunlit park lawn, golden hour, dewy grass |
| Hotel travel fitness | "Business trip day three and I still have not skipped a workout." | hotel room, city skyline, suitcase |
| Bedroom pre-sleep stretching | "My nighttime routine that actually changed my body." | cozy bedroom, string lights, yoga mat |
