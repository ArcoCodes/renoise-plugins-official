# Stage 5-6: GENERATE & ASSEMBLE — EXECUTE

This is the **EXECUTE** stage.

Goal: run the approved prompt package, preserve planned continuity, review the outputs against the frozen plan, and assemble only after the clips are good enough.

---

## Execute Rule

During execution, do not silently rewrite the plan.

If you discover missing critical detail such as:
- an unanchored recurring human
- a missing environment reference
- a missing product / prop anchor that the shot depends on
- an unresolved transition strategy
- a prompt that cannot faithfully represent the planned shot

then **pause and return to PLAN / VISUAL DEV / PROMPTS** before continuing.

---

## Stage 5: GENERATE

### Pre-Flight Check (BLOCKING)

Before submitting any task, verify all of the following.

#### 1. Plan Freeze Exists
You have:
- approved segment / shot table
- prompt package
- shot → anchor mapping
- continuity strategy table for multi-clip work

If not, stop.

#### 2. Anchor Integrity Check
Verify that all quality-critical anchors are resolved:
- every recurring human has an active face-safe anchor
- recurring environments have their planned anchors
- recurring products / props have their planned anchors when required
- shot → anchor mapping is complete

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs asset list --status active
```
Cross-check against the Anchor Registry and Shot → Anchor Mapping.

#### 3. Budget Check
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs credit me
```

#### 4. Continuity Strategy Check
For each transition that needs tight continuity, confirm whether it is:
- **serial / ref_video**
- **parallel with strong anchors**
- **hybrid**

Do not treat this as a cosmetic detail.

---

## Generation Strategy

| Condition | Strategy | Why |
|-----------|----------|-----|
| Same human + same location + continuous action | **Serial** (`ref_video`) | best seam continuity |
| Same human + different locations | **Parallel** with strong anchors | continuity matters less than identity |
| Different people / locations | **Parallel** | fastest |
| Mixed project | **Hybrid** | serial inside continuity-critical blocks, parallel elsewhere |

---

## Execution Commands

### Single Clip (A, B)
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --prompt "<prompt>" --duration 15 --ratio <ratio> \
  [--materials "ID:ref_image"] [--materials "asset:ID:reference_image"] [--tags "project-tag"]
```

### Parallel Multi-Clip
```bash
# Submit all at once
for each segment:
  node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task create \
    --prompt "<prompt>" --duration 15 --ratio <ratio> \
    --materials "asset:ASSET_ID:reference_image" --tags "<project>,s<N>"
# Wait for completion
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task wait <id>
```

### Serial Chain (`ref_video`)
```bash
# Generate S1
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --prompt "<S1>" --duration 15 --ratio <ratio> --tags "<project>,s1"

# Download S1
curl -s -o "${PROJECT_DIR}/videos/S1.mp4" "<video-url>"

# Upload as ref_video for S2
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs material upload "${PROJECT_DIR}/videos/S1.mp4"

# Generate S2 using S1 continuity
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --prompt "Continuing from the previous shot: <S2>" --duration 15 --ratio <ratio> \
  --materials "MATERIAL_ID:ref_video" --tags "<project>,s2"
```

### Download Results Immediately
Video URLs expire after 1 hour:
```bash
curl -s -o "${PROJECT_DIR}/videos/S<N>.mp4" "<video-url>"
```

---

## Execute Validation Before Assembly

Before assembling multi-clip work, quickly review each clip against the plan.

Check:
- human identity fidelity
- environment fidelity
- product / prop fidelity when relevant
- action accuracy
- camera behavior
- dialogue / lip-sync if relevant
- seam continuity where the next segment depends on it

If a clip fails because the **plan was incomplete**, go back and fix the plan.
If a clip fails because the **execution was weak**, adjust prompt / anchor / generation strategy and retry.

Do not rush to assembly just because generation succeeded technically.

---

## Stage 6: ASSEMBLE

### Concatenate
```bash
cd "${PROJECT_DIR}/videos"
printf "file '%s'\n" S1.mp4 S2.mp4 S3.mp4 ... > concat.txt
ffmpeg -y -f concat -safe 0 -i concat.txt -c copy "${PROJECT_DIR}/final.mp4"
```

### Post-Production Guidance
- **Serial segments** should already connect smoothly
- **Parallel segments** often benefit from a 0.3-0.5s cross-dissolve
- Strip inconsistent AI audio and apply shared BGM when needed

```bash
ffmpeg -i final.mp4 -an -c:v copy silent.mp4
ffmpeg -i silent.mp4 -i bgm.mp3 -c:v copy -c:a aac -shortest final-with-bgm.mp4
```

---

## Post-Delivery Preferences

After delivery, optional preference update:
```bash
cat > ~/.claude/renoise/preferences.json << 'EOF'
{
  "preferred_styles": ["..."],
  "avoid": ["..."],
  "default_ratio": "16:9",
  "default_dialogue_language": "zh-CN"
}
EOF
```

---

## Final Reminder

Execution quality comes from respecting the plan:
- anchors must stay aligned with prompts
- quality-critical anchors are not limited to people; environments and props can also be blocking
- continuity-critical shots need the right generation strategy
- failed continuity is usually a planning failure first, prompt failure second
