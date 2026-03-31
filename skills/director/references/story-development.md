# Story Development Reference

Internal craft guide for the director AI. Use this to write better loglines, treatments, and dialogue. These techniques are applied **silently** — the user sees only the final logline + treatment, not the intermediate analysis steps.

## Logline Formula

```
When [INCITING INCIDENT], a [SPECIFIC CHARACTER] must [GOAL/ACTION],
but [OBSTACLE/CONFLICT] threatens to [STAKES].
```

### Validation (internal)
- Character is specific (not generic "a woman" — what makes them unique?)
- Inciting incident is clear (what disrupts the normal world?)
- Goal is concrete (what is the character trying to DO?)
- Obstacle creates tension (what stands in the way?)
- Stakes are real (what happens if they fail?)

If you can't fill the formula, ask the user clarifying questions. Don't proceed with a vague concept.

---

## Treatment Writing

The treatment is a prose narrative — NOT a shot list. It describes what the viewer SEES and FEELS.

### Format
```
[SCENE 1 — Location, Time]
[2-3 sentences: what happens, what it looks like, how it feels.
Include dialogue naturally embedded in action. Sensory details.]

[SCENE 2 — Location, Time]
[Continue...]
```

### Quality Criteria (self-check before presenting)
- Read it out loud. Does each scene flow into the next?
- Can you picture what the viewer SEES? (If not, add sensory details)
- Does each scene have at least one thing that CHANGES?
- Does dialogue sound like a real person? (If it sounds like a narrator, rewrite)

---

## Internal Coherence Checks

Run these checks on the treatment BEFORE presenting to the user. Fix any failures silently.

### 1. Causal Chain (THEREFORE / BUT)

Link every scene transition with **THEREFORE** (consequence) or **BUT** (complication). Never **AND THEN** (random sequence).

```
GOOD: She finds the document. THEREFORE she reads it. BUT it reveals a trap.
BAD:  She finds the document. AND THEN she reads it. AND THEN it's a trap.
```

**Rule**: At least 30% of links should be BUT (complications). All-THEREFORE = no tension.

### 2. Emotional Variety

No two adjacent scenes should target the exact same viewer emotion. Map the arc:
```
S1: warmth → S2: excitement → S3: horror → S4: despair → S5: determination
     ✅ all different, clear peaks and valleys

S1: tension → S2: tension → S3: tension → S4: release
     ❌ three adjacent tensions = flat and boring
```

If two adjacent scenes feel the same, insert a contrast beat (reversal, surprise, shift).

### 3. Character Motivation

Every character action must have a reason. Check each beat:
- What does the character want?
- Why do they do THIS action (not something else)?
- Do they REACT before they ACT? (Characters should respond to what just happened, not robotically execute the next plot point)

Red flag: "She suddenly runs away" — WHY? Add a trigger.

### 4. Dialogue Purpose

Every line of dialogue must serve at least one function:

| Function | Example |
|----------|---------|
| Reveal information | "The results came back — it's not what we thought." |
| Show character | "I don't run from things. Not anymore." |
| Create conflict | "You knew about this the whole time, didn't you?" |
| Deliver emotion | "I'm okay. I'm... not okay." |
| Carry subtext | "Nice weather." (said while holding back tears) |

If a line just "sounds cool" but serves no function, cut it.

Red flags: exposition dumps ("As you know, we've been working here for 10 years..."), filler ("Wow, that's interesting"), too on-the-nose ("I feel sad because my father left" → better: "I always check the driveway when I hear a car").

---

## Adaptation-Specific Guidance (Mode D)

When adapting existing material (novels, screenplays, manga):

### Scene Selection Criteria

Prioritize scenes that are:
1. **Visually striking** — strong imagery the AI model can render well
2. **Emotionally intense** — peaks in the character's arc
3. **Self-contained** — comprehensible without extensive context
4. **Action-rich** — physical movement, not just dialogue/internal monologue

Deprioritize:
- Exposition-heavy scenes (hard to visualize)
- Scenes requiring many characters simultaneously (AI struggles with >2 characters)
- Scenes that only make sense with full context

### Condensation Techniques

- **Merge** two scenes that serve similar purposes into one segment
- **Cut** transitional scenes (traveling, waiting) — jump straight to the next emotional beat
- **Externalize** internal monologue — show the emotion through action/expression, not narration
- **Simplify** multi-character scenes to focus on 1-2 key characters

---

## Montage-Specific Guidance (Mode E)

Non-narrative content is structured by **rhythm and mood**, not causation.

### Beat Sheet Structure
```
S1: [visual keyword] — mood: [X] — energy: [N/10]
S2: [visual keyword] — mood: [X] — energy: [N/10]
```

### Coherence Without Causation

Montages don't need THEREFORE/BUT chains, but they DO need:
- **Visual motif**: A recurring element (color, shape, object) across segments
- **Energy curve**: Never 3+ segments at the same energy level
- **Emotional arc**: Even without a story, the viewer should feel a journey (e.g. melancholy → hope → euphoria → peace)
- **Style unity**: Same style line, same color palette, same film texture

### Music-Driven Structure

If the user provides a reference track or BPM:
- Map beat drops to energy peaks in the beat sheet
- Plan camera movement changes on major beats
- Use the track's structure (verse/chorus/bridge) to organize segments
