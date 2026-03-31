# Stage 5-6: GENERATE & ASSEMBLE

## Stage 5: GENERATE

### Pre-Flight Check (BLOCKING)

Before submitting ANY video task, verify:

1. **Character Asset Completeness**: Every character in 2+ segments has a registered asset with status `active`:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs asset list --status active
```
Cross-reference against the Character-to-Asset Registry from VISUAL DEV. If any 2+ segment character is missing an active asset, **STOP and go back to VISUAL DEV**.

2. **Balance Check**:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs credit me
```

### Generation Strategy (Multi-Clip)

| Condition | Strategy | Speed |
|-----------|----------|-------|
| Same character + same location across segments | **Serial** (ref_video chain) | ~8 min × N |
| Same character + different locations (has ref_image per shot) | **Parallel** | ~8 min total |
| Different characters, different locations | **Parallel** | ~8 min total |
| Mixed | **Hybrid** — serial within blocks, parallel between blocks | varies |

### Execution

**Single clip (A, B):**
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --prompt "<prompt>" --duration 15 --ratio <ratio> \
  [--materials "ID:ref_image"] [--materials "asset:ID:reference_image"] [--tags "project-tag"]
```

**Parallel (most common for C/D/E with visual anchoring):**
```bash
# Submit all at once
for each segment:
  node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task create \
    --prompt "<prompt>" --duration 15 --ratio <ratio> \
    --materials "asset:ASSET_ID:reference_image" --tags "<project>,s<N>"
    # For character refs registered as assets, use "asset:ID:reference_image"
    # For scene/product refs (no faces), use "MATERIAL_ID:ref_image"
# Wait for all
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task wait <id>
```

**Serial chain (ref_video for continuous scenes):**
```bash
# S1: generate first
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --prompt "<S1>" --duration 15 --ratio <ratio> --tags "<project>,s1"
# Download S1
curl -s -o "${PROJECT_DIR}/videos/S1.mp4" "<video-url>"
# Upload as ref_video for S2
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs material upload "${PROJECT_DIR}/videos/S1.mp4"
# S2: uses ref_video
node ${CLAUDE_PLUGIN_ROOT}/skills/renoise-gen/renoise-cli.mjs task generate \
  --prompt "Continuing from the previous shot: <S2>" --duration 15 --ratio <ratio> \
  --materials "MATERIAL_ID:ref_video" --tags "<project>,s2"
```

### Download Results

Video URLs expire after 1 hour. Download immediately:
```bash
curl -s -o "${PROJECT_DIR}/videos/S<N>.mp4" "<video-url>"
```

---

## Stage 6: ASSEMBLE (Multi-Clip Only)

### Concatenate

```bash
cd "${PROJECT_DIR}/videos"
printf "file '%s'\n" S1.mp4 S2.mp4 S3.mp4 ... > concat.txt
ffmpeg -y -f concat -safe 0 -i concat.txt -c copy "${PROJECT_DIR}/final.mp4"
```

### Post-Production

- **Between serial segments**: Should be visually smooth (ref_video continuity)
- **Between parallel segments**: Add cross-dissolve (0.3-0.5s) to soften visual jumps
- **BGM overlay**: Strip AI-generated audio, overlay unified BGM:

```bash
ffmpeg -i final.mp4 -an -c:v copy silent.mp4
ffmpeg -i silent.mp4 -i bgm.mp3 -c:v copy -c:a aac -shortest final-with-bgm.mp4
```

### Post-Delivery

After delivery, update preferences:
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
