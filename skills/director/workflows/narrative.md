# Narrative / Short-Film Workflow

Use for drama, comedy, short film, montage, MV, and story adaptation. Read `references/prompt-craft.md` before drafting prompts. For recurring characters, props, wardrobe, or locations, also read `references/visual-dev.md`.

## Intake

If the brief already specifies characters, visible action, mood, setting, duration, and references, start drafting. Otherwise ask only for missing decisions:

| Missing decision | Ask |
|---|---|
| Characters | How many, what do they look like, and what is their relationship? |
| Story/action | What physically happens? Is there a conflict, reveal, or transformation? |
| Mood/style | What should the viewer feel? Any visual references? |
| Setting | Where and when does it happen? |
| Duration | How long should the finished video be? |
| Speech | Does anyone speak, and in what language? Apply the Director spoken-language gate. |
| References | Are there authorized character, prop, product, or location references? |

Select and inspect the video model before deciding whether this is one clip or multiple segments.

## Single Clip

Use when the requested duration fits one advertised model duration.

1. Write one model-appropriate, high-density prompt using `model-routing` and `prompt-craft.md`.
2. Hand the complete prompt, references, and model parameters to the active host execution workflow.
3. Record any task identifier returned by the host.

## Multi-Clip: Two Gates

Resolve both creative gates in order before handing video generation to the host. They structure the plan but do not create extra text-confirmation pauses: the active host owns every approval boundary. Paid anchor images may execute during Gate 2 through that workflow:

```text
brief → Gate 1 Story → Gate 2 anchor plan/cost → final manifest/prompts → host execution boundary → generate video → QC → assemble
```

### Gate 1 — Story

Present:

- **Logline:** `When [INCITING INCIDENT], a [CHARACTER] must [GOAL], but [OBSTACLE] threatens [STAKES].`
- **Treatment:** two or three sentences per scene describing what the viewer sees and feels, with dialogue embedded naturally.

Rules:

- Connect scenes with consequence (**THEREFORE**) or complication (**BUT**), not a sequence of **AND THEN** events. At least 30% of transitions should complicate the story.
- Do not target the same viewer emotion in adjacent scenes.
- For adaptations, keep visual, emotional, self-contained scenes; cut exposition-heavy material and externalize internal thought through action.
- Hand the resolved story into Gate 2 under the active host's approval policy; do not invent a separate text confirmation.

### Gate 2 — Consistency Manifest

After the story is resolved:

1. Hand every needed character/location anchor prompt and selected image model to the active host execution workflow.
2. Surface generated anchors and follow the host's selection or replacement policy without inventing another confirmation step.
3. Draft all segment prompts and present the final manifest below in one editable block, then hand it to the active host workflow; pause only when that host's policy requires it.

| Item | Lock |
|---|---|
| Characters | Approved reference for each recurring character, plus constant traits and plot-driven changes |
| Props/wardrobe | Fixed material, color, and form; explicit state changes |
| Scenes | Approved environment-only reference or one fixed recurring-location description |
| Style Bible | One verbatim `art style + camera language + color grade + NEGATIVE line` string |
| Transition Table | Every cut's previous OUT state, next IN state, and linking technique |
| Spoken language | Confirmed language for each speaking segment |
| Shot Mapping | Exact material and advertised role used by each segment |
| Segment prompts | Full prompt for every segment, including live parameters and summed cost |

Preparation:

- Inventory host-authorized materials and match them to approved needs.
- For an invented character appearing in two or more segments, generate one design sheet, show it for approval, register it as reusable material, and reuse it through an advertised video-model role.
- For a recurring location, create an environment-only concept image when a written lock is insufficient.
- Track plot-critical props and wardrobe as constant or plot-evolving. Stage each evolution as its own visible transformation.
- Not every shot needs every anchor; record actual choices in Shot Mapping.

Prompt construction:

- Apply the selected model's prompting profile.
- Prepend the Style Bible verbatim to every segment.
- Copy full applicable character and prop blocks verbatim.
- Start each segment after S1 with `Continuing from the previous shot: [position, pose, prop state, emotion, light, environment].`
- Keep spoken lines in the confirmed language.
- Give each intermediate segment an ending hook matching the Transition Table.

## Generate

Reinspect live model capabilities immediately before submission. Reuse stable materials through advertised roles; use a tail frame only through an advertised image/frame role, and reuse completed video only through a compatible video-reference capability.

Run read-only preparation in parallel when independent. Hand generation to the active host workflow, which owns submission concurrency, approvals, idempotency, task identifiers, and interruption recovery.

## QC and Assembly

Before final assembly, compare every segment and cut against the confirmed manifest:

- same identity, wardrobe, props, and recurring-location state;
- same art style and color grade;
- boundaries match the Transition Table;
- spoken language is correct;
- no failed physical action or unusable frame.

Report the result and hand only failed segments back to the host for regeneration. Assemble only when the host exposes media editing; otherwise return ordered clips plus the transition plan.

If soundtrack or enhancement is requested, choose a live model by task fit and guidance, then hand only advertised inputs and outputs to the active host workflow.

## Creative Recovery

| Problem | Adjustment |
|---|---|
| Character drifts | Verify the same approved material, advertised role, and verbatim character block |
| Actions are ignored | Reduce to three or four actions per five-second window |
| Clip is incoherent | Use one mood, at most two camera stages, and fewer actions |
| Segments do not connect | Repair OUT/IN states and continuity routing; use a short cross-dissolve only when media editing is available |
