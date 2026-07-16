# Scenario A — Viral Video Replication

**Trigger**: The user provides a viral/trending video and wants to replicate its style with their own product or brand.

---

## How the Reference Video Is Used

Run Gemini analysis on the reference video to extract all style elements as **text** — do NOT upload the reference video to Renoise as `ref_video`. The `ref_video` role is for chaining your own generated segments, not external style reference. Passing the original video to Renoise risks copying the original person or product into the output.

Extract the following from the reference video via Gemini:

| Element | What to extract |
|---------|----------------|
| Camera | Movement type (push-in, pull-out, orbit, handheld, static, drone), rhythm, angles used |
| Pacing | Cut frequency, tension arc, where energy peaks |
| Expression | Key emotional beats — body language, facial expression, energy level |
| Scene | Background environment, lighting style, color grading / color tone |
| Shot structure | How the product enters frame, lingers, exits; angles used |
| Visual effects | Transitions, overlays, motion graphics |
| Audio | Rhythm structure, beat-sync points, sound design style |

Encode all extracted elements as **text descriptions in the prompt** — never as uploaded materials.

---

## Six-Dimension Emphasis

| Dimension | Emphasis |
|-----------|----------|
| **Subject** | Anchor with `@product image`, replacing the original video's product |
| **Selling-Point Action** | Replicate the original video's core selling-point action, adapted to the user's product |
| **Scene & Tone** | Use Gemini analysis output to replicate the vibe: scene environment, lighting style, color grading, pacing, shot structure, visual effects, overall mood and energy |
| **Camera Language** | Use Gemini analysis output to describe camera movement and rhythm — encode as text only, not passed as a material |
| **Audio** | Maintain the original video's rhythm structure and beat-sync points |
| **Post-Production** | Emphasize facial stability, readable product packaging text |

---

## Prompt Writing Notes

- Replace all person/character references from the original video with new descriptions or `@` asset references
- The product from the original video is fully replaced by `@product image`
- Style elements (lighting, color, pacing, camera) come from Gemini analysis text, not from the video material
- If the original video has a presenter, either: introduce a new presenter (upload a face image and use `ID:ref_image`) or restructure as a product-only clip

---

## Example

**Brief**: Replicate this viral skincare ad — same handheld energy, same close-up on skin texture, but with our serum.

**Gemini analysis output**:
- Camera: handheld, close-up on face and product, slight natural sway
- Pacing: 2–3s per shot, energetic but not frantic
- Expression: casual, genuine, no performance
- Scene: minimal white background, single ring light, home-feel
- Color: slightly warm, natural skin tones preserved

**Prompt**:

> The serum bottle from @Image 1, proportions and label strictly matching the original, held casually in hand at cheek level. **[Subject]**
>
> Presenter pumps one drop onto the back of the hand and slowly spreads it with a fingertip — skin texture and pore detail remain fully visible as the serum absorbs. **[Selling-Point Action]**
>
> Minimal white background, single warm ring light at 45°, home-feel with no studio polish. Warm natural skin tones, no beauty filter. **[Scene & Tone]**
>
> Handheld close-up throughout, slight natural camera sway. Cut every 2–3 seconds, energetic but not frantic. **[Camera Language]**
>
> No music, no voiceover — ambient room tone only. Beat-sync with the moment the serum visibly absorbs into skin. **[Audio]**
>
> Skin texture and pore detail must remain visible — no smoothing. Product label must be clearly readable. No overexposed highlights. **[Post-Production Constraints]**
