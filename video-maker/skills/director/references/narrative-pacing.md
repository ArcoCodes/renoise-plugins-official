# Narrative Pacing Guide

A comprehensive reference for structuring long videos (>15s) with cinematic narrative rhythm. The director MUST read this before generating multi-segment video prompts.

## Core Principle

**Every video tells a story, even a product ad.** Multi-segment videos fail when treated as a sequence of independent clips. Instead, design them as one continuous narrative with an emotional arc, energy variation, and intentional transitions.

## Narrative Arc Templates

### 30s — 2 Segments (Hook → Payoff)

```
Segment 1 (15s)                    Segment 2 (15s)
├─ Hook [0-5s] ⚡ Energy: 7       ├─ Escalation [0-7s] ⚡ Energy: 8
├─ Setup [5-10s] ⚡ Energy: 5     ├─ Climax [7-11s] ⚡ Energy: 10
└─ Build [10-15s] ⚡ Energy: 6    └─ Resolution [11-15s] ⚡ Energy: 4
```

**Energy curve**: `7 → 5 → 6 │ 8 → 10 → 4`
**Key**: S1 builds curiosity, S2 delivers and resolves.

### 45s — 3 Segments (Setup → Confrontation → Resolution)

```
Segment 1 (15s) — ACT I            Segment 2 (15s) — ACT II           Segment 3 (15s) — ACT III
├─ Hook [0-4s] ⚡ 8                ├─ Complication [0-5s] ⚡ 7        ├─ Climax [0-5s] ⚡ 10
├─ World [4-10s] ⚡ 4              ├─ Rising [5-10s] ⚡ 8             ├─ Release [5-10s] ⚡ 6
└─ Inciting [10-15s] ⚡ 6          └─ Tension peak [10-15s] ⚡ 9      └─ Coda [10-15s] ⚡ 3
```

**Energy curve**: `8 → 4 → 6 │ 7 → 8 → 9 │ 10 → 6 → 3`
**Key**: Classic three-act. S2 ends on tension, S3 opens with climax.

### 60s — 4 Segments (Hook → Development → Climax → Coda)

```
Segment 1 (15s) — HOOK             Segment 2 (15s) — DEVELOPMENT
├─ Attention grab [0-5s] ⚡ 8      ├─ Deepen [0-7s] ⚡ 5
├─ Context [5-10s] ⚡ 5            ├─ Complicate [7-12s] ⚡ 7
└─ Promise [10-15s] ⚡ 6           └─ Raise stakes [12-15s] ⚡ 8

Segment 3 (15s) — CLIMAX           Segment 4 (15s) — CODA
├─ Build-up [0-5s] ⚡ 9            ├─ Aftermath [0-5s] ⚡ 5
├─ Peak moment [5-10s] ⚡ 10       ├─ Reflection [5-10s] ⚡ 3
└─ Turning point [10-15s] ⚡ 8     └─ Final image [10-15s] ⚡ 4
```

**Energy curve**: `8→5→6 │ 5→7→8 │ 9→10→8 │ 5→3→4`
**Key**: S3 is the emotional peak. S4 gives the audience time to feel.

### 90s-180s — 6-12 Segments (Extended Three-Act)

For long content, follow this proportional structure:

| Act | Duration | Segments | Energy Range | Purpose |
|-----|----------|----------|-------------|---------|
| **I — Setup** | 20% | 1-2 | 5-8 | Hook, establish world, introduce conflict |
| **II-A — Rising** | 30% | 2-4 | 6-9 | Complications, deepening, subplot |
| **Midpoint** | 10% | 1 | 8-10 | Major revelation or reversal |
| **II-B — Escalation** | 20% | 2-3 | 7-10 | Stakes raise, momentum builds |
| **III — Climax+Resolve** | 20% | 2-3 | 10→3 | Peak action, emotional resolution, coda |

**Rule**: Place the energy peak at 70-80% of total duration, never at the very end.

## Energy Curve Rules

### Mandatory Constraints

1. **No flat lines**: Never have 3+ consecutive segments at the same energy level. Audiences disengage from monotony.
2. **Drop before climax**: Energy must dip at least 2 points before the climax segment. Silence makes the explosion louder.
3. **Breathing room**: After any ⚡8+ segment, the next segment must open at ⚡6 or lower.
4. **Distinct ending**: Final segment energy ≠ middle segment energy. End on resolution (low) or surprise (high), not the same plateau.
5. **Opening hook**: First 3-5 seconds must be ⚡7+. You have 3 seconds to earn the viewer's attention.

### Energy Level Reference

| Level | Feeling | Camera | Pacing |
|-------|---------|--------|--------|
| 1-2 | Stillness, meditation | Static, slow drift | Long holds, silence |
| 3-4 | Calm, reflective | Gentle push/pull | Unhurried, room to breathe |
| 5-6 | Steady, engaging | Smooth tracking, orbit | Moderate, conversational |
| 7-8 | Exciting, dynamic | Fast tracking, whip pans | Quick cuts, momentum |
| 9-10 | Peak intensity | Snap zooms, vertigo, rapid cuts | Maximum density, beat-synced |

## Camera Rhythm Patterns

### Breathing Rhythm (fast → slow → fast)
The most natural viewing rhythm. Alternate between tight, energetic sequences and open, calm moments.
```
[S1] Close-up montage, quick cuts ⚡8
[S2] Wide establishing shot, slow drift ⚡4
[S3] Medium tracking, building pace ⚡7
[S4] Extreme close-up → snap to wide reveal ⚡10
```

### Tension Ramp (gradual build)
Start wide and slow, progressively tighten shots and accelerate cuts.
```
[S1] Extreme wide, static ⚡3
[S2] Medium shot, gentle tracking ⚡5
[S3] Close-up, faster cuts ⚡7
[S4] Extreme close-up, rapid montage ⚡10
```

### Pulse Pattern (rhythmic peaks)
Regular energy spikes, like a heartbeat. Good for music-driven content.
```
[S1] Build ⚡6 → peak ⚡9
[S2] Drop ⚡4 → peak ⚡8
[S3] Drop ⚡3 → peak ⚡10
[S4] Sustain ⚡7 → fade ⚡3
```

## Segment Transition Design

Each transition between segments must be intentionally designed. Never default to a hard cut without purpose.

### 7 Transition Types

| Type | Technique | When to Use | Prompt Keywords |
|------|-----------|-------------|-----------------|
| **Action Bridge** | End S1 mid-action → S2 continues the motion | Physical movement, dance, sports | `Continuing the motion from the previous shot:` |
| **Gaze Lead** | Character looks toward something → S2 reveals it | Mystery, discovery, reaction | `Revealing what they're looking at:` |
| **Sound Bridge** | S1 fades with S2's ambient sound bleeding in | Scene changes, time shifts | `The sound of [next scene] begins before the cut.` |
| **Match Cut** | Similar shape/color/motion links two different shots | Thematic connections, metaphor | `Matching the circular shape:` / `The spinning motion carries into:` |
| **Emotional Shift** | Abrupt mood change (quiet→loud or loud→quiet) | Surprises, twists, contrast | `Suddenly:` / `The silence breaks with:` |
| **Time Jump** | Visual time indicators (light change, clock, seasons) | Montage, passage of time | `Hours later:` / `As night falls:` |
| **Spatial Flow** | Camera moves through a door/window/portal into new space | Exploration, journey, reveal | `The camera pushes through the doorway into:` |

### Transition Selection Guide

| From Energy → To Energy | Recommended Transitions |
|------------------------|------------------------|
| High → High | Action Bridge, Match Cut |
| High → Low | Emotional Shift, Time Jump |
| Low → High | Emotional Shift, Sound Bridge |
| Low → Low | Spatial Flow, Gaze Lead |
| Any → Climax | Sound Bridge (build), then Action Bridge (peak) |
| Climax → Resolution | Emotional Shift, Time Jump |

### How Transitions Work with ref_video Chaining

When using serial chain generation (each segment's video passed as `ref_video` to the next), the model **physically continues from the previous segment's ending frame**. This changes how you design transitions:

- **You don't need to describe the previous ending** in the next segment's prompt — the ref_video already provides that context
- **Focus the transition design on the ENDING of each segment** — what the last 2-3 seconds look like determines how the next segment begins
- **The `Continuing from the previous shot:` prefix** tells the model to seamlessly extend rather than start fresh
- **Transition keywords in the prompt** (Gaze Lead, Spatial Flow, etc.) still help because they tell the model the *intent* of the transition, even though the visual anchor comes from ref_video

**Example**: If S1 ends with a character looking right toward a door, and S2's prompt says `Continuing from the previous shot: the door opens to reveal a sunlit garden`, the model will generate S2 starting from that exact visual context.

## Video Type Pacing Templates

### Product Advertisement (30-60s)

```
ACT I — INTRIGUE (20%)
  Hook: Mystery/problem/desire. Don't show the product yet.
  Energy: 7→5

ACT II — SHOWCASE (50%)
  Reveal: Product enters frame dramatically
  Function: Show key features in action (not listing specs)
  Emotion: Connect product to a feeling or lifestyle
  Energy: 6→8→7

ACT III — CLOSE (30%)
  Payoff: The "aha" moment or emotional climax
  Brand: Logo/tagline, but make it feel earned
  Energy: 9→4
```

**Common mistake**: Showing the product in frame 1. Build anticipation first.

### Short Drama (60-180s)

```
ACT I — ORDINARY WORLD (15-20%)
  Establish the character and their normal life
  Energy: 5→4

INCITING INCIDENT (5-10%)
  Something disrupts the normal → story begins
  Energy: 4→8

ACT II — RISING ACTION (40-50%)
  Obstacles, complications, deepening conflict
  Include at least one "false victory" or "false defeat"
  Energy: 6→7→8→6→9

CLIMAX (10-15%)
  The decisive moment — highest emotional intensity
  Energy: 10

RESOLUTION (10-15%)
  New equilibrium — changed character, new understanding
  Energy: 5→3
```

**Common mistake**: Flat Act II. Add reversals — things seem to get better, then get worse.

### Brand Story (45-90s)

```
PROBLEM (20%)
  Show the world before — what's missing, what's broken
  Energy: 6→4

JOURNEY (40%)
  Exploration, experimentation, the search for something better
  Energy: 5→7→6→8

DISCOVERY (25%)
  The brand/product as the answer — but show it through story, not claims
  Energy: 9→10

INSPIRATION (15%)
  Leave the viewer with a feeling, not a sales pitch
  Energy: 5→3
```

**Common mistake**: Making the "discovery" about features. Make it about transformation.

## Rhythm Blueprint Format

Before writing any multi-segment prompt, output a rhythm blueprint for user confirmation:

```
🎬 RHYTHM BLUEPRINT — [Title] ([Duration])

Segments: [N] × 15s
Narrative arc: [Template name]
Overall energy curve: [number sequence]

S1 (0-15s) — [Act label]
  Goal: [What this segment achieves narratively]
  Energy: [start]→[mid]→[end]
  Camera: [Primary movement]
  → Transition to S2: [Type] — [Brief description]

S2 (15-30s) — [Act label]
  Goal: ...
  Energy: ...
  Camera: ...
  → Transition to S3: ...

[... repeat for all segments ...]

Key moments:
  - Hook (0-3s): [Description]
  - Midpoint ([time]): [Description]
  - Climax ([time]): [Description]
  - Final image ([time]): [Description]
```

Present this blueprint BEFORE writing prompts. Iterate on structure before investing in prompt details.
