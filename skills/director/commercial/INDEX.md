# Commercial Video — Router and Shared Prompt Rules

Use this index for e-commerce, advertising, and brand work. Read only the matched scenario file.

## Route

Ask in order and stop at the first match:

1. Presenter speaking on camera (`口播`, `带货`, `测评`, `主播出镜`) → **D**
2. Reference video to replicate → **A**
3. Brand film longer than 5s or explicitly multi-shot → **C**
4. Otherwise, single-shot product showcase up to 5s → **B**

| Scenario | Read |
|---|---|
| A — Reference Video Remake / 剪同款 | `commercial/scenario-a-viral.md` |
| B — Product Showcase | `commercial/scenario-b-brand.md` |
| C — Brand Film / TVC | `commercial/scenario-c-tvc.md` |
| D — UGC / Live Presenter | `commercial/scenario-d-ugc.md` |

Scenario A may be entered directly from Director. Its dedicated gates override the common phases below.

## Six-Dimension Formula

Build every commercial prompt in this order:

```text
Subject + Selling-Point Action + Scene & Tone + Camera Language + Audio + Post-Production Constraints
```

| Dimension | Question |
|---|---|
| Subject | What must the viewer see first? |
| Selling-Point Action | What visible action proves the selling point? |
| Scene & Tone | What specific light, environment, palette, and physical atmosphere create the feeling? |
| Camera Language | Which framing or movement creates the hook? |
| Audio | Which ambient, speech, effect, or beat must align with the action? |
| Post-Production | Which likely failures must be prohibited or reserved for later overlays? |

## Phase 1 — Brief and References

1. Load the matched scenario.
2. Ask only for missing essentials: product references, visible selling points, target audience/platform, duration, ratio, and presenter/spoken language when applicable.
3. Analyze each host-authorized image or video through the host's media-analysis capability; Scenario A requests a reusable replacement template.
4. Tag each reference as subject anchor, scene calibration, camera reference, or beat-sync control.
5. Select and inspect live models using `model-routing`. Use only advertised parameters, roles, combinations, and limits.

For recurring people or products, register once and reuse the same material through a supported role. Use canonical material tokens and state what each controls:

```text
the serum glass bottle from @material:101
use @material:202 only for camera movement, not identity or product
```

Scenario D performs its documented reference registration before prompt writing.

## Phase 2 — Construct the Prompt

Draft the approval preview in the user's language. A non-dialogue final generation prompt may be translated to concise professional English after approval. Any spoken line stays verbatim in the confirmed spoken language; dialogue-dense prompts stay entirely in that language.

Required:

- Replace abstract claims such as “premium” or “hydrating” with concrete light, material, motion, and reaction.
- Put each material token directly beside the controlled subject.
- For reference video, state which traits to use and which identities/content not to copy.
- Include at least two negative constraints for the most likely failures.
- Cover all six dimensions, organized according to the matched scenario.

### Physical Continuity

A product cannot silently teleport from packaged/stored to in-use state. Choose one:

- Start with the product already ready for use and never mention packaging nearby; or
- Dedicate a visible beat to opening/preparing it, then demonstrate it in the following beat.

This applies to caps, pouches, boxes, tags, wrappers, folded clothing, and similar state changes.

### Action Granularity

Never compress a multi-step physical process into one sentence. Give each demonstration at least three visible sub-steps, each describing an incomplete mid-action state and pace:

1. A small pump lands on the cheekbone and remains pooled.
2. One fingertip gently taps the center; it is not spread yet.
3. Slow outward circles spread it halfway; the unblended edge stays visible.

## Phase 3 — Approval Preview

Present the entire preview in the user's language and wait for explicit approval:

```text
--- Prompt Preview ---

[Full prompt, with each dimension labelled in the user's language]

--- Reference Mapping ---
@material:101 → description → advertised role
@material:202 → description → advertised role

--- Generation Parameters ---
Model: live selection
Duration / ratio / resolution: advertised values
Spoken language: only for speaking segments
Estimated cost: per generation and total
Available balance: live value
---
```

Scenario C uses its storyboard preview; Scenario A uses its two-gate remake preview.

## Phase 4 — Generate and Return

- Reinspect the selected model immediately before submission.
- Translate only non-speaking prompts when useful; never translate confirmed spoken lines.
- Submit through the host's approval-controlled capability and record every returned task ID.
- Reuse shared materials for multi-segment work and choose continuity only from advertised roles.
- Return result links, task IDs, cover images when available, generation time, and warnings.
- On revision, preserve approved references/results and adjust only the rejected dimension or segment.

For insufficient balance, report the live value and suggest top-up at https://www.renoise.ai. For moderation, follow Director's explicit host-error rule.
