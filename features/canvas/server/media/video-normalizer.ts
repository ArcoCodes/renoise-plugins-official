import { createHash } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { WhiteboardError } from "../../shared/errors.js";

const execFileAsync = promisify(execFile);
const NORMALIZE_TIMEOUT_MS = 5 * 60 * 1_000;
const MAX_OUTPUT_BUFFER_BYTES = 2 * 1024 * 1024;

type ProbeResult = {
  streams?: Array<{ width?: number; height?: number }>;
  format?: { duration?: string; bit_rate?: string };
};

function executableCandidates(name: "ffmpeg" | "ffprobe") {
  const explicit = process.env[`RENOISE_${name.toUpperCase()}_PATH`];
  const extension = process.platform === "win32" ? ".exe" : "";
  const pathCandidates = (process.env.PATH ?? "")
    .split(delimiter)
    .filter(Boolean)
    .map((directory) => join(directory, `${name}${extension}`));
  const common = process.platform === "win32"
    ? []
    : [`/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`, `/usr/bin/${name}`];
  return [...new Set([explicit, ...pathCandidates, ...common].filter((value): value is string => Boolean(value)))];
}

async function resolveExecutable(name: "ffmpeg" | "ffprobe") {
  for (const candidate of executableCandidates(name)) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next explicit, PATH-derived, or common installation location.
    }
  }
  throw new WhiteboardError(
    "INVALID_MEDIA",
    `This host cannot decode the video and ${name} was not found. Install FFmpeg, restart the host application, and try again.`,
  );
}

async function run(executable: string, args: string[]) {
  try {
    return await execFileAsync(executable, args, {
      timeout: NORMALIZE_TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BUFFER_BYTES,
      windowsHide: true,
    });
  } catch (caught) {
    const stderr = typeof caught === "object" && caught && "stderr" in caught
      ? String((caught as { stderr?: unknown }).stderr ?? "").trim()
      : "";
    const message = stderr.split("\n").filter(Boolean).at(-1)
      ?? (caught instanceof Error ? caught.message : String(caught));
    throw new WhiteboardError("INVALID_MEDIA", `Video compatibility processing failed: ${message}`);
  }
}

async function probe(ffprobe: string, inputPath: string, requireDuration = true) {
  const { stdout } = await run(ffprobe, [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height:format=duration,bit_rate",
    "-of", "json",
    inputPath,
  ]);
  let parsed: ProbeResult;
  try {
    parsed = JSON.parse(stdout) as ProbeResult;
  } catch {
    throw new WhiteboardError("INVALID_MEDIA", "Unable to read video metadata");
  }
  const width = Number(parsed.streams?.[0]?.width);
  const height = Number(parsed.streams?.[0]?.height);
  const durationSeconds = Number(parsed.format?.duration);
  const bitRate = Number(parsed.format?.bit_rate);
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0
    || (requireDuration && (!Number.isFinite(durationSeconds) || durationSeconds <= 0))) {
    throw new WhiteboardError("INVALID_MEDIA", requireDuration ? "The video has no usable frame dimensions or duration" : "The media has no usable frame dimensions");
  }
  return {
    width,
    height,
    durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0,
    bitRate: Number.isFinite(bitRate) && bitRate > 0 ? bitRate : undefined,
  };
}

async function sha256File(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

export type BrowserVideoProxy = {
  playbackPath: string;
  playbackSha256: string;
  playbackByteLength: number;
  posterPath: string;
  posterByteLength: number;
  posterWidth: number;
  posterHeight: number;
  width: number;
  height: number;
  durationMs: number;
};

/**
 * Trust boundary: only the first 16 bytes of the upload were signature-checked,
 * so ffmpeg/ffprobe parse an otherwise untrusted container here. Exposure is
 * bounded by the upload size limit, execFile without a shell, and the process
 * timeout — keep those constraints when changing this pipeline.
 */
export async function createBrowserVideoProxy({
  inputPath,
  playbackPath,
  posterPath,
  maximumPlaybackBytes,
}: {
  inputPath: string;
  playbackPath: string;
  posterPath: string;
  maximumPlaybackBytes: number;
}): Promise<BrowserVideoProxy> {
  const [ffmpeg, ffprobe] = await Promise.all([
    resolveExecutable("ffmpeg"),
    resolveExecutable("ffprobe"),
  ]);
  const source = await probe(ffprobe, inputPath);
  const durationSeconds = Math.max(.001, source.durationSeconds);
  const maximumTotalBitRate = Math.floor(maximumPlaybackBytes * 8 * .88 / durationSeconds);
  const sourceVideoBitRate = source.bitRate ? Math.max(160_000, source.bitRate - 64_000) : 1_500_000;
  const videoBitRate = Math.max(160_000, Math.min(2_000_000, sourceVideoBitRate, maximumTotalBitRate - 64_000));
  if (maximumTotalBitRate <= 224_000) {
    throw new WhiteboardError("INVALID_MEDIA", "The video is too long to create a playback proxy within the annotation board media limit");
  }

  await run(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-i", inputPath,
    "-map", "0:v:0", "-map", "0:a:0?",
    "-vf", "scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p",
    "-c:v", "libvpx-vp9", "-deadline", "good", "-cpu-used", "5", "-row-mt", "1",
    "-b:v", String(videoBitRate),
    "-c:a", "libopus", "-b:a", "64k",
    "-f", "webm",
    playbackPath,
  ]);
  await run(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-i", playbackPath,
    "-frames:v", "1",
    "-vf", "scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2",
    "-f", "image2",
    posterPath,
  ]);

  const [playbackInfo, posterInfo, playbackStat, posterStat, playbackSha256] = await Promise.all([
    probe(ffprobe, playbackPath),
    probe(ffprobe, posterPath, false),
    stat(playbackPath),
    stat(posterPath),
    sha256File(playbackPath),
  ]);
  if (!playbackStat.isFile() || playbackStat.size <= 0 || playbackStat.size > maximumPlaybackBytes) {
    throw new WhiteboardError("INVALID_MEDIA", "The generated video playback proxy exceeds the annotation board media limit");
  }
  if (!posterStat.isFile() || posterStat.size <= 0) {
    throw new WhiteboardError("INVALID_MEDIA", "Video poster generation failed");
  }
  return {
    playbackPath,
    playbackSha256,
    playbackByteLength: playbackStat.size,
    posterPath,
    posterByteLength: posterStat.size,
    posterWidth: posterInfo.width,
    posterHeight: posterInfo.height,
    width: playbackInfo.width,
    height: playbackInfo.height,
    durationMs: Math.max(0, Math.round(playbackInfo.durationSeconds * 1_000)),
  };
}
