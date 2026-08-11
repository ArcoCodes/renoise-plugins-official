# Scenario B — Product Brand Film

**Trigger**: Single-shot product showcase, ≤5s. The product is the sole subject — one API call, no narrative structure, no live presenter. If the user wants >5s or multiple shots, use Scenario C instead.

---

## Six-Dimension Emphasis

| Dimension | Emphasis |
|-----------|----------|
| **Subject** | Product is the absolute center — strictly lock appearance and proportions with its `@material:{id}` reference |
| **Selling-Point Action** | Micro-actions revealing texture or efficacy: water droplets sliding, light reflections flowing, material deforming and recovering |
| **Scene & Tone** | Calibrate with the scene's `@material:{id}` reference — emphasize lighting consistency and color palette |
| **Camera Language** | Steady, slow, refined — macro close-up + slow orbit. Never handheld. |
| **Audio** | Brand music beat sync; reserve timing for logo reveal at the end |
| **Post-Production** | Product logo must not distort; material texture must be realistic; proportions strictly consistent with the product material token |

---

## Prompt Writing Notes

- Every selling-point claim must translate into a **visible micro-action** — never abstract adjectives
- "Premium feel" → describe the specific lighting setup (rim light angle, color temperature, shadow softness)
- "Hydrating" → water droplets condensing, slowly sliding, surface tension visible
- "Durable" → material under stress, recovering perfectly, no deformation
- The product must remain **centered and stable** throughout — no camera movements that cause the product to drift out of frame
- End frame: reserve 2s for logo/slogan reveal (fade to black + centered text)

---

## Example

**Brief**: 10-second brand film for a men's serum. Premium feel, highlight the moisturizing effect. Minimalist modern background with cinematic lighting. End with the brand logo.

**Assets**:
- `@material:101` (product hi-res photo) → subject anchor
- `@material:102` (high-contrast modern space photo) → scene calibration

**Prompt**:

> Display the men's serum glass bottle from @material:101 at the center of the frame, with translucent texture and proportions strictly matching the original. **[Subject]**
>
> Crystalline water droplets condense on the serum surface, slowly sliding down the bottle body, showcasing an intense sense of hydrating moisture. **[Selling-Point Action]**
>
> Reference @material:102's minimalist modern space with high-contrast cool blue tones; sidelight creates a sharp, sculpted rim light. **[Scene & Tone]**
>
> Camera begins with a macro close-up, slowly and steadily orbiting the bottle while pushing in. **[Camera Language]**
>
> In the final 2 seconds, a soft chime marks the beat as a silver brand logo fades in at the center of the frame. **[Audio]**
>
> No frame flickering, product logo must not distort, water droplet dynamics must be realistic. **[Post-Production Constraints]**

**Why it works**: "Premium feel" is replaced with a specific lighting setup. "Moisturizing effect" is translated into the visible micro-action of water droplets condensing and sliding. The `@` reference states exactly what was extracted from each image.
