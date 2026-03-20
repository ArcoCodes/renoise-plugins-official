#!/usr/bin/env python3
"""
Beat analysis for short film editing.
Analyzes audio to extract BPM, beat positions, section boundaries,
and suggests clip cut points within Seedance's 5-15s constraint.

Usage: python3 analyze-beats.py <audio_file>
Output: JSON to stdout

Dependencies: pip3 install librosa soundfile numpy
"""

import json
import sys
from pathlib import Path

try:
    import librosa
    import numpy as np
except ImportError:
    print(
        json.dumps({
            "error": "Missing dependencies. Install with: pip3 install librosa soundfile numpy"
        }),
        file=sys.stderr,
    )
    sys.exit(1)


MIN_SEGMENT_S = 5.0
MAX_SEGMENT_S = 15.0


def analyze_beats(audio_path: str) -> dict:
    """Analyze audio file and return beat/section/cut data."""
    y, sr = librosa.load(audio_path, sr=22050)
    total_duration = librosa.get_duration(y=y, sr=sr)

    # Beat tracking
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
    bpm = float(np.round(tempo, 1)) if np.ndim(tempo) == 0 else float(np.round(tempo[0], 1))

    # Section boundary detection via spectral change
    # Use a smaller number of segments for short audio
    n_segments = max(4, min(10, int(total_duration / 10)))
    boundaries = _detect_sections(y, sr, n_segments)

    # Build sections with labels
    section_labels = _label_sections(boundaries, total_duration)

    # Generate suggested cuts respecting 5-15s constraint
    suggested_cuts = _suggest_cuts(section_labels, beat_times, total_duration)

    return {
        "bpm": bpm,
        "total_duration_s": round(total_duration, 2),
        "beats": [round(b, 3) for b in beat_times],
        "sections": section_labels,
        "suggested_cuts": suggested_cuts,
    }


def _detect_sections(y, sr, n_segments: int) -> list[float]:
    """Detect section boundaries using spectral features."""
    # Compute spectral features
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    features = np.vstack([chroma, mfcc])

    # Use agglomerative clustering for boundary detection
    try:
        bound_frames = librosa.segment.agglomerative(features, k=n_segments)
        bound_times = librosa.frames_to_time(bound_frames, sr=sr).tolist()
    except Exception:
        # Fallback: evenly spaced sections
        duration = librosa.get_duration(y=y, sr=sr)
        bound_times = [i * duration / n_segments for i in range(1, n_segments)]

    # Remove boundaries too close to start/end
    bound_times = [b for b in bound_times if 2.0 < b < (librosa.get_duration(y=y, sr=sr) - 2.0)]

    return sorted(set(round(b, 2) for b in bound_times))


def _label_sections(boundaries: list[float], total_duration: float) -> list[dict]:
    """Assign labels to sections based on position in the track."""
    labels_map = ["intro", "verse", "build", "chorus", "bridge", "verse2", "chorus2", "outro"]
    points = [0.0] + boundaries + [total_duration]
    sections = []

    for i in range(len(points) - 1):
        label_idx = min(i, len(labels_map) - 1)
        sections.append({
            "start": round(points[i], 2),
            "end": round(points[i + 1], 2),
            "label": labels_map[label_idx],
        })

    return sections


def _suggest_cuts(
    sections: list[dict],
    beats: list[float],
    total_duration: float,
) -> list[dict]:
    """
    Generate suggested cut points respecting 5-15s segment constraints.
    Uses section boundaries as primary cuts, then subdivides or merges as needed.
    """
    raw_segments = []
    for sec in sections:
        start = sec["start"]
        end = sec["end"]
        duration = end - start
        label = sec["label"]

        if duration <= MAX_SEGMENT_S:
            raw_segments.append({"time": start, "end": end, "duration": round(duration, 2), "section": label})
        else:
            # Subdivide long sections at beat points
            sub_segments = _subdivide_at_beats(start, end, beats, label)
            raw_segments.extend(sub_segments)

    # Merge segments that are too short
    merged = _merge_short_segments(raw_segments)

    # Final pass: ensure all within bounds
    result = []
    for seg in merged:
        dur = seg["end"] - seg["time"]
        if dur >= MIN_SEGMENT_S:
            result.append({
                "time": round(seg["time"], 2),
                "end": round(seg["end"], 2),
                "duration": round(dur, 2),
                "section": seg["section"],
            })

    # Handle edge case: if no valid segments, create evenly spaced ones
    if not result:
        n = max(1, int(total_duration / 10))
        seg_dur = total_duration / n
        for i in range(n):
            s = i * seg_dur
            e = min((i + 1) * seg_dur, total_duration)
            result.append({
                "time": round(s, 2),
                "end": round(e, 2),
                "duration": round(e - s, 2),
                "section": f"segment_{i + 1}",
            })

    return result


def _subdivide_at_beats(
    start: float,
    end: float,
    beats: list[float],
    label: str,
) -> list[dict]:
    """Split a long section at beat points into 5-15s segments."""
    section_beats = [b for b in beats if start <= b <= end]
    if not section_beats:
        # No beats found; split evenly
        n = max(2, int((end - start) / 10))
        seg_len = (end - start) / n
        return [
            {
                "time": round(start + i * seg_len, 2),
                "end": round(start + (i + 1) * seg_len, 2),
                "duration": round(seg_len, 2),
                "section": label,
            }
            for i in range(n)
        ]

    segments = []
    current_start = start

    for beat in section_beats:
        if beat - current_start >= MAX_SEGMENT_S:
            # Find the best beat to cut at (closest to target ~10s)
            target = current_start + 10.0
            candidates = [b for b in section_beats if current_start + MIN_SEGMENT_S <= b <= current_start + MAX_SEGMENT_S]
            if candidates:
                cut = min(candidates, key=lambda b: abs(b - target))
                segments.append({
                    "time": round(current_start, 2),
                    "end": round(cut, 2),
                    "duration": round(cut - current_start, 2),
                    "section": label,
                })
                current_start = cut

    # Final segment
    if end - current_start >= MIN_SEGMENT_S:
        segments.append({
            "time": round(current_start, 2),
            "end": round(end, 2),
            "duration": round(end - current_start, 2),
            "section": label,
        })
    elif segments:
        # Extend the last segment
        segments[-1]["end"] = round(end, 2)
        segments[-1]["duration"] = round(end - segments[-1]["time"], 2)
    else:
        segments.append({
            "time": round(start, 2),
            "end": round(end, 2),
            "duration": round(end - start, 2),
            "section": label,
        })

    return segments


def _merge_short_segments(segments: list[dict]) -> list[dict]:
    """Merge segments shorter than MIN_SEGMENT_S with their neighbors."""
    if not segments:
        return []

    merged = [segments[0].copy()]

    for seg in segments[1:]:
        prev = merged[-1]
        prev_dur = prev["end"] - prev["time"]
        seg_dur = seg["end"] - seg["time"]

        if seg_dur < MIN_SEGMENT_S:
            # Try merging with previous if combined still <= MAX
            combined = prev_dur + seg_dur
            if combined <= MAX_SEGMENT_S:
                prev["end"] = seg["end"]
                prev["duration"] = round(combined, 2)
                continue

        if prev_dur < MIN_SEGMENT_S:
            # Extend previous into current
            combined = prev_dur + seg_dur
            if combined <= MAX_SEGMENT_S:
                prev["end"] = seg["end"]
                prev["duration"] = round(combined, 2)
                prev["section"] = seg["section"]
                continue

        merged.append(seg.copy())

    return merged


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 analyze-beats.py <audio_file>", file=sys.stderr)
        print("Supported formats: mp3, aac, wav, m4a, ogg, flac", file=sys.stderr)
        sys.exit(1)

    audio_path = sys.argv[1]
    if not Path(audio_path).exists():
        print(json.dumps({"error": f"File not found: {audio_path}"}), file=sys.stderr)
        sys.exit(1)

    result = analyze_beats(audio_path)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
