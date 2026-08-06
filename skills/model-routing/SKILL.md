---
name: model-routing
description: >
  Internal Renoise model router and model-specific prompting guide. Selects the
  best live image, video, or audio model for a task, then adapts the prompt to
  that model. Use before estimating or generating Renoise media.
user-invocable: false
metadata:
  author: renoise
  version: 0.1.0
  category: media-generation
  tags: [model-routing, prompting, image, video, audio, portable]
---

# Renoise Model Routing

Select by task, not by habit. Then prompt for the selected model instead of sending every model the same generic brief.

## Hard Boundary

Live model capabilities are authoritative for availability, defaults, input roles, combinations, limits, duration, ratio, resolution, and audio controls. This Skill contains only researched routing preferences and prompting styles.

1. Preserve a model explicitly named by the user.
2. Filter candidates by the live capabilities required by the task.
3. Choose the best specialist below.
4. Use the live `isDefault` model only when no specialist clearly fits or candidates tie.
5. Inspect the selected model's live guidance before writing the final prompt.
6. Let the selected model's profile override generic prompt-craft advice when prompt structure, density, or reference wording conflicts.
7. Never pass a role or parameter merely because this guide mentions a public model capability; the Renoise deployment may expose a narrower contract.

## Routing Questions

Classify the request before selecting:

- **Kind:** image, video, or audio.
- **Operation:** create, edit, continue, interpolate, or animate a reference.
- **Priority:** final quality, strict instruction following, aesthetics, identity consistency, speed, or cost.
- **Structure:** exact text/layout, one cinematic shot, multi-shot narrative, dialogue performance, music, or a complete audio scene.
- **References:** none, one source image, several identity/style references, source video, endpoint frames, or voice/audio references.

Do not call a model “best” without naming the task it is best for.

# Image Routing

## Decision Order

| Task | Prefer | Why |
|---|---|---|
| Exact text, UI, diagrams, ads, packaging, compositing, or surgical edits | `gpt-image-2` | Strongest current general instruction following, text rendering, structured layouts, and preservation during edits. |
| General high-quality photorealistic or commercial image | live image default, currently `seedream-5-0-pro` | Production-oriented design, realism, multilingual layouts, and precise edits without paying the latency cost of GPT Image for every ordinary request. |
| Fast/high-volume drafts or A/B variants | `nano-banana-2-lite` | Current speed/scale tier; use for disposable ideation, not intricate multi-reference editing. |
| Balanced Google workflow, extreme aspect ratios, multiple references, or conversational iteration | `nano-banana-2` | Better balance of quality, latency, references, text, and broad aspect-ratio coverage than the older Pro tier for many jobs. |
| Maximum Google-family precision, brand consistency, or reasoning-heavy composition | `nano-banana-pro` | Keep as a specialist; do not choose merely because “Pro” sounds newer or universally better. |
| Best aesthetic exploration, stylized art direction, editorial mood, or concept art | `mj-v8.2` | Current Midjourney aesthetic/default generation tier. |
| Reasoning/search-like visual explanation, many references, or cost-sensitive 2K–4K Seedream work | `seedream-5-0-lite` | Useful when its reasoning/reference niche matters; Pro remains the normal final-delivery Seedream choice. |
| Fast xAI-native iteration | `grok-image-quality` for finals; `grok-image` only for drafts | Quality mode supersedes standard for final output; standard retains a speed/explicit-user niche. |

### Do not auto-select

- `midjourney-v7` and `mj-v8.1`: superseded by `mj-v8.2` for normal generation. Preserve only when the user asks for that version or a known older-version look/compatibility behavior.
- `grok-image`: do not use for final quality when `grok-image-quality` is available.
- `nano-banana-pro`: not obsolete, but Nano Banana 2/Lite currently outperform it on some blind preference benchmarks. Select Pro for its precision/brand/reasoning niche, not as a blanket quality upgrade.

## Image Prompting Styles

### GPT Image 2 — production brief

Use labeled, ordered instructions:

```text
USE: [ad / packaging / UI / infographic / edit]
SCENE/BACKGROUND: ...
SUBJECT: ...
COMPOSITION: ...
LIGHTING/MATERIALS: ...
EXACT TEXT: "..." with placement, hierarchy, font character, and color
PRESERVE: identity, geometry, layout, logo, and all unmentioned elements
CHANGE ONLY: ...
AVOID: ...
```

- Put literal in-image text in quotes and specify hierarchy and placement.
- For edits, say **change only X; preserve everything else**.
- Identify every reference by its job: source, identity, product, layout, or style.
- Prefer one-change iterative edits over rewriting the whole brief.

### Nano Banana family — conversational creative direction

```text
[Subject] + [action] + [location] + [composition] + [style]
Camera/viewpoint: ...
Lighting/materials: ...
Exact text: "..."
Keep unchanged: ...
```

- Use natural language and positive, concrete instructions.
- Nano Banana 2: explicitly relate multiple references and iterate conversationally.
- Lite: keep one clear composition and fewer dependencies; use it for variants.
- Pro: state brand invariants, localization requirements, and complex spatial relationships precisely.

### Seedream 5 — design brief

Put the deliverable format first, then subject, layout, light, exact text, and invariants:

```text
[DELIVERABLE FORMAT and ratio/use case]
Subject and setting: ...
Layout and spatial relationships: ...
Lighting, materials, and palette: ...
Exact visible copy: "..."
Keep exactly: ...
```

- Pro: write like a production designer; pin everything an edit must preserve.
- Lite: natural language works well, but make causal/spatial relationships explicit and assign each reference one job.
- Avoid ornate keyword stacks and vague pronouns in multi-reference edits.

### Midjourney — aesthetic visual phrase

Use a concise visual description, not a requirements document:

```text
[subject], [medium], [environment], [lighting], [palette], [mood], [composition]
```

- Prefer concrete visual nouns and adjectives over keyword spam.
- V8.2 is more literal than older Midjourney versions; specify lighting and composition instead of relying on “cinematic.”
- Use Midjourney for look development, not text-heavy layouts or surgical edits.

### Grok Imagine Image — concise scene direction

```text
[subject doing action] in [setting], [camera/framing], [lighting], [material/style]
```

- Use Quality for final realism, text, and adherence.
- Use standard only for rapid variants or when explicitly requested.
- Keep the prompt concrete and short enough that the main subject and action remain dominant.

# Video Routing

## Decision Order

| Task | Prefer | Why |
|---|---|---|
| General multimodal video, recurring references, product/character continuity, or image-to-video with audio | `seedance-2.0-byteplus` | Safest generalist and live default; strong multimodal reference assignment, continuity, and native audio. |
| Fast draft | `seedance-2.0-fast-byteplus` | Intermediate speed/cost tier. |
| Cheapest/high-volume draft | `seedance-2.0-mini-byteplus` | Use for iteration and selection; finalize important shots on the full tier when quality matters. |
| Short source-video edit or short 720p generation where conversational editing matters | `gemini-omni-flash` | Current benchmark leader/near-leader for short generation and editing; obey its narrower live Renoise contract. |
| Exact first frame, last frame, frame interpolation, 2K/4K delivery, or reference audio paired with images | `hailuo-h3` | Strong endpoint-frame control, instruction following, resolution, and deliberately structured audiovisual prompts. |
| Human action, dialogue acting, multilingual lip sync, or concise commercial/social scenes | `happyhorse-1.0` | Specialist for synchronized character performance; no longer the automatic overall quality leader. |
| Explicit cinematic shot design, human kinetics, or controlled multi-shot dialogue | `kling-3.0-omni` | Specialist camera/action/storyboard model; current aggregate benchmarks do not justify using it as the universal default. |
| One-image animation with restrained motion, camera, and native sound | `grok-video-1.5` | Strong image-to-video specialist when exactly one source image fits the live contract. |
| xAI video needing several image references or explicit Grok preference | `grok-video` | Retains the multi-image/reference niche exposed by Renoise; otherwise prefer 1.5 for one-image animation. |

### Current replacement guidance

- `happyhorse-1.0` and `kling-3.0-omni` have been overtaken on aggregate 2026 blind-preference leaderboards by Gemini Omni Flash, H3, and Seedance in several categories. Keep them for their action/dialogue/camera specialties, not as generic defaults.
- `grok-video-1.5` supersedes the older Grok model for single-image animation; the older model remains useful when its live multi-reference contract is required.
- Seedance Fast and Mini are draft tiers, not alternative final aesthetics. Mini optimizes volume/cost; Fast is the intermediate tier. Do not invent a quality ordering beyond live guidance and actual tests.

## Video Prompting Styles

### Seedance 2.0 family — multimodal director brief

Assign each reference an explicit job, then write shots:

```text
References:
- [material]: subject identity
- [material]: location/style
- [material]: motion/camera/voice

Shot 1: framing, subject action, camera move, environment, sound/dialogue.
Shot 2: ...
Continuity: traits and objects that must remain unchanged.
Constraints: no subtitles/logo/watermark unless requested.
```

- Use 2–3 stable identity features, not an exhaustive biography.
- One camera move per shot.
- Describe body part, speed, force, and physical consequence for actions.
- Externalize emotion through visible behavior.
- Use the same style for Fast/Mini, but reduce scene complexity when drafting.

### Gemini Omni Flash — conversational generation/editing

- For creation: write a direct natural-language shot brief with subject, action, camera, setting, and desired audio.
- For editing: identify the source, say **change only X**, and list what must remain unchanged.
- Make one edit per turn when possible; use follow-up refinement rather than replacing the entire prompt.
- Do not request unsupported source length, duration, ratio, or resolution; live guidance wins.

### MiniMax H3 — mode-specific audiovisual plan

Choose one live mode and prompt accordingly:

- **First frame:** describe only the motion, camera path, action development, and sound after the supplied opening state.
- **Last frame:** describe the plausible path that converges on the supplied ending.
- **First + last:** describe the continuous transition between states; avoid re-describing the two stills. Prefer one coherent shot unless a cut is essential.
- **Reference mode:** assign each image/audio an explicit identity, style, voice, action, or sound job.

For complex work use:

```text
[Shot 1] Visual action and camera motion.
[Shot 2 at time] Cut and continuation.
Overall soundscape: ambience, Foley, non-verbal sound.
Non-diegetic music: instrumentation, tempo, dynamics — or none.
```

Specify camera **type + amplitude + speed** only when they matter. Keep dialogue exact and speakers stable.

### HappyHorse 1.0 — concise performance direction

```text
[subject] [specific action] in [setting], [lighting], [one camera cue].
Dialogue in [language]: "..."
Sound: foreground action, midground Foley, background ambience; no music if unwanted.
```

- Put subject/action first and camera last.
- Prefer one primary camera move and a compact prompt; remove “masterpiece,” “epic,” and other vague quality filler.
- For image-to-video, describe motion and sound rather than the still image.
- Use timed shot labels only when the scene truly needs multiple beats.

### Kling 3.0 Omni — explicit storyboard

```text
Shot 1 (duration): framing, named subject, action, camera, light, sound.
Shot 2 (duration): reaction or continuation, camera, exact dialogue and speaker.
```

- Lead with camera/action language and use stable names for every speaker.
- Keep each shot to one readable action and one camera behavior.
- Write dialogue after the associated action; use “then” or “immediately” for timing.
- Prefer Kling when controlled action/multi-shot staging is the reason for selecting it.

### Grok Imagine Video — animate the change

For image-to-video, do not re-describe the static source:

```text
[subject motion/change], [one camera move], [atmosphere/lighting change].
Sound: specific dialogue/SFX/ambience; no music if unwanted.
```

- Use one primary action or a short causal sequence.
- Front-load the important motion.
- For text-to-video, add the missing subject and setting description.

# Audio Routing

| Task | Prefer | Why |
|---|---|---|
| Standalone song, instrumental, loop, score cue, or music bed | `lyria-clip` | Dedicated music model; fixed short clip suits social, prototype, and scoring cues. |
| Dialogue, narration, voice performance, podcast, dubbing, SFX/ambience, or a complete sound scene | `seed-audio-1.0` | Unified speech + effects + ambience + music scene generation; live default audio model. |

Neither broadly replaces the other: Lyria composes music; Seed Audio directs an audio scene.

## Lyria 3 Clip — composer brief

```text
Genre/style: ...
Mood: ...
Instrumentation: ...
Tempo/rhythm: ... BPM
Vocals: instrumental OR voice type, delivery, and language
Lyrics/theme: exact lyrics or subject
Structure over ~30 seconds: intro → development → ending
Production: mix character, era, space, dynamics
```

- Explicitly say **instrumental** when vocals are unwanted.
- Name instruments, tempo, vocal texture, and language.
- Use timestamps only for meaningful structural changes.
- Describe a musical lineage/era rather than requesting imitation of a living artist.

## Seed Audio 1.0 — sound-scene script

```text
Setting/acoustics: ...
Continuous sound bed: ...
Speaker A (age, accent, timbre, emotion, pace): "Exact line."
Action-tied SFX: ...
Speaker B (...): "Exact line."
Music cue and ending: ...
```

- Treat it as a scene, not a TTS request.
- Label speakers and exact lines; match prompt language to dialogue language.
- Use clean voice references and assign each one speaker role when live capabilities allow.
- Use concrete Foley and ambience; onomatopoeia can clarify transient sounds.
- Use timing only where dialogue synchronization matters.

# Research Basis

Reviewed 2026-08-06. Rankings are directional and decay quickly; live capabilities and task-specific tests override them.

Primary guidance:

- OpenAI GPT Image prompting: https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide
- Google Gemini image prompting: https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-nano-banana and https://ai.google.dev/gemini-api/docs/image-generation
- Midjourney prompting/version docs: https://docs.midjourney.com/hc/en-us/articles/32023408776205-Prompt-Basics and https://docs.midjourney.com/hc/en-us/articles/32199405667853-Version
- ByteDance Seedream: https://seed.bytedance.com/en/blog/deeper-thinking-more-accurate-generation-introducing-seedream-5-0-lite and https://seed.bytedance.com/en/blog/beyond-generation-it-understands-design-introducing-seedream-5-0-pro
- xAI Imagine: https://docs.x.ai/developers/model-capabilities/imagine
- BytePlus Seedance prompt guide: https://docs.byteplus.com/en/docs/ModelArk/2222480
- HappyHorse launch/prompting: https://www.alibabacloud.com/blog/alibaba-rolls-out-happyhorse-1-0-in-limited-beta_603068 and https://fal.ai/learn/tools/prompting-happy-horse
- Kling 3.0 guides: https://kling.ai/quickstart/klingai-video-3-model-user-guide and https://kling.ai/quickstart/klingai-video-3-omni-model-user-guide
- MiniMax H3: https://www.minimax.io/blog/minimax-h3, https://platform.minimax.io/docs/guides/video-generation, and https://huggingface.co/MiniMaxAI/MiniMax-H3/tree/main/docs
- Gemini Omni: https://ai.google.dev/gemini-api/docs/omni
- Lyria prompting: https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-lyria-3-pro
- Seed Audio: https://seed.bytedance.com/en/blog/from-speech-to-audio-creation-introducing-the-seed-audio-1-0-audio-creation-model
- Independent preference evidence: https://artificialanalysis.ai/image/leaderboard/text-to-image, https://artificialanalysis.ai/image/leaderboard/editing, https://artificialanalysis.ai/video/leaderboard/text-to-video, https://artificialanalysis.ai/video/leaderboard/image-to-video, and https://artificialanalysis.ai/video/leaderboard/video-editing
