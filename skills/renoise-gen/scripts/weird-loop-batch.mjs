#!/usr/bin/env node

/**
 * Batch test: generate a random image with Renoise, then use that same image
 * as BOTH first_frame and last_frame for a weird looping video.
 *
 * Workflow per item:
 * 1) Generate a random seed image with nano-banana-2
 * 2) Download the image locally
 * 3) Upload it as a Renoise material
 * 4) Create a video task using the same material as first_frame + last_frame
 * 5) Optionally wait for the final video result
 *
 * Usage:
 *   node skills/renoise-gen/scripts/weird-loop-batch.mjs --count 3 --ratio 9:16
 *   node skills/renoise-gen/scripts/weird-loop-batch.mjs --count 5 --queue-only
 *   node skills/renoise-gen/scripts/weird-loop-batch.mjs --dry-run
 */

import fs from "fs/promises";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_BASE_URL = "https://www.renoise.ai/api/public/v1";

const SUBJECTS = [
  "a porcelain astronaut with cracked gold seams",
  "a velvet crow wearing a tiny royal cape",
  "a cathedral made from translucent fruit jelly",
  "an antique television with a human eye for a screen",
  "a chrome koi fish floating in midair",
  "a vending machine full of miniature thunderstorms",
  "a lonely carousel horse with plant roots for legs",
  "a transparent wolf containing a miniature city",
  "a stack of office chairs fused into a ceremonial throne",
  "a ballerina made of folded maps and wet ink",
  "a taxidermy peacock built from cassette tape ribbons",
  "a lighthouse growing from a gigantic mushroom",
];

const ENVIRONMENTS = [
  "inside a flooded supermarket at blue hour",
  "on a rooftop garden above a sleeping megacity",
  "in a deserted amusement park under aurora lights",
  "inside a brutalist museum filled with ankle-deep milk",
  "in a candlelit subway tunnel overtaken by moss",
  "inside a moonlit greenhouse with impossible geometry",
  "in a forgotten hotel lobby drifting through space",
  "inside a silent opera house buried in pink sand",
  "on a rain-soaked chessboard the size of a plaza",
  "inside an endless office corridor with velvet curtains",
];

const STYLES = [
  "surreal cinematic still, highly detailed, dramatic lighting",
  "dreamlike arthouse film frame, tactile textures, moody color palette",
  "hyper-detailed speculative fantasy, elegant composition, soft film grain",
  "uncanny retro-futurist cinema, rich contrast, atmospheric depth",
  "poetic surrealism, premium production design, volumetric light",
  "strange fashion editorial aesthetic, immaculate framing, bold visual hierarchy",
];

const LOOP_VARIATIONS = [
  "The middle section should escalate through impossible cause-and-effect, like dream logic obeying hidden ritual rules.",
  "Make the transformations progressively stranger, but keep visual continuity and camera logic readable.",
  "Let objects mutate, architecture breathe, and physical scale collapse in a way that feels mesmerizing rather than random.",
  "Push the imagery toward bizarre metamorphosis, uncanny symbolism, and elegant visual absurdity.",
  "Make the world drift through irrational but cinematic events, as if reality is folding and then stitching itself back together.",
  "Favor eerie, memorable, visually surprising actions over generic motion. The weirdness should feel intentional and escalating.",
];

const CAMERA_FLOWS = [
  "Start with a gentle push in, widen into a smooth orbit during the strange escalation, then let the camera naturally complete its move into the original framing.",
  "Begin with a locked heroic frame, drift into a deliberate lateral move through the weirdest phase, then let the motion settle organically into the exact opening composition.",
  "Start with a patient dolly in, let the camera arc around the subject during the transformations, then let the move complete in a way that naturally lands back on the first-frame composition.",
  "Open almost still, then perform a creeping push and tilt as reality mutates, and let the camera resolve forward into the original viewpoint without feeling rewound.",
];

const CYCLIC_MOTIFS = [
  "Seed a clear visual motif in the opening seconds and keep reinterpreting it at larger and stranger scales until it becomes the path back to the original image.",
  "Introduce one uncanny rule of the world early, then let each later event feel like a bigger consequence of that same rule until the scene closes the loop.",
  "Make one recurring shape, motion, or texture echo through the whole scene so the ending feels like the completion of a pattern rather than a reset.",
  "Use visual rhymes across the segment: the same gesture, shape, or arrangement should reappear in transformed forms before finally resolving into the opening frame.",
];

const PROGRESSION_RULES = [
  "Every phase should feel like a forward evolution of the previous one, not a detached random event.",
  "The weirdness should accumulate consequences, with each new image arising from what just happened before it.",
  "Build a chain of transformations where each stage logically mutates into the next, even if the logic is dreamlike.",
  "Treat the whole clip as one continuous metamorphosis with clear stages, not a series of unrelated surreal moments.",
];

const LOOP_GOALS = [
  "The viewer should feel that the ending was always hidden inside the beginning and has now fully emerged.",
  "The final return should feel earned, inevitable, and satisfying, like a ritual, orbit, or closed circuit completing itself.",
  "By the final second, the scene should feel as if it has progressed all the way around a circle and arrived home.",
  "The loop should feel like destiny closing, not correction or repair.",
];

const MAJOR_TRANSFORMATIONS = [
  "The central subject splits into multiple distorted versions of itself that swarm through the space and take over the frame.",
  "The subject unfolds into impossible mechanical-organic anatomy, revealing secret inner worlds and hidden moving structures.",
  "The subject suddenly grows to architectural scale and dominates the whole environment like a living monument.",
  "The subject dissolves into ribbons, smoke, liquid, or fragments that whirl through the scene as independent forces.",
  "The subject turns the surrounding world into an extension of itself, infecting every surface with its shape, rhythm, and texture.",
];

const ENVIRONMENT_REACTIONS = [
  "The surrounding architecture bends, breathes, and rearranges itself; the floor rises like a wave, walls open into impossible depth, and shadows detach and act independently.",
  "The environment becomes unstable and alive: gravity tilts sideways, objects begin orbiting, reflections disobey reality, and background details mutate in sympathy with the subject.",
  "The whole space undergoes obvious large-scale changes: doors appear where there were none, the ceiling liquefies, perspective stretches unnaturally, and the room briefly turns inside out.",
  "Make the background participate aggressively: props duplicate, surfaces blossom into strange textures, hidden eyes or mouths appear, and the location transforms into a ritual stage.",
];

const RETURN_PATTERNS = [
  "In the last seconds, let the bizarre events progress into a new configuration that just happens to become the original arrangement, as if the scene has completed a ritual cycle and arrived home.",
  "Guide every fragment, clone, shadow, and environmental distortion into a satisfying final construction of the first-frame tableau without feeling rewound.",
  "Make the ending feel inevitable rather than reversed: disparate weird elements should combine, condense, and lock into place until the first-frame composition emerges as a newly completed state.",
];

const CLOSURE_MECHANISMS = [
  "The final image should be rebuilt from transformed debris, shadows, smoke, ribbons, or light condensing into the opening tableau.",
  "The closing composition should emerge through accretion, weaving, blooming, crystallizing, or settling, not by retracing previous motion.",
  "Treat the first-frame image as the end product of the weird process: the scene manufactures it in real time from the peak chaos.",
  "The ending should feel like assembly, convergence, and locking into place, not restoration or undoing.",
];

const ANTI_RETRACE_RULES = [
  "Do not mirror earlier motion vectors or send objects back along the same paths they used before.",
  "Never retrace the camera move beat-for-beat; the camera may settle into the original framing, but by completing a different continuous move rather than reversing one.",
  "Do not undo transformations one by one. New actions in the final phase must create the last frame from the weirdness itself.",
  "Avoid a palindromic structure where the second half simply reverses the first half. The route into the ending must differ from the route out of the beginning.",
];

const ENDING_VERBS = [
  "condense",
  "weave",
  "crystallize",
  "assemble",
  "grow",
  "settle",
  "knit",
  "coalesce",
];

const AUDIO_STYLES = [
  "surreal arthouse sound design with deep ambient resonance",
  "eerie retro-futurist score with subtle mechanical pulses",
  "dreamlike cinematic ambience with ritual percussion and distant drones",
  "haunting gallery-installation soundscape with soft metallic echoes",
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

function printHelp() {
  console.log(`
weird-loop-batch.mjs

Generate random Renoise seed images and turn each into a weird looping video by
using the same image as both first_frame and last_frame.

Options:
  --count <n>          Number of items to make (default: 1)
  --ratio <ratio>      1:1 | 16:9 | 9:16 (default: 9:16)
  --duration <sec>     Video duration 5-15 (default: 15)
  --resolution <res>   Image resolution 1k | 2k (default: 2k)
  --anchor-mode <m>    first-only | first-last (default: first-only)
                       use first-last when you want a hard same-image start/end loop.
  --out <dir>          Output dir (default: ./tmp/weird-loop-batch/<timestamp>)
  --tag <tag>          Extra Renoise task tag
  --queue-only         Create video tasks but do not wait for completion
  --poll <sec>         Poll interval seconds (default: 10)
  --timeout <sec>      Wait timeout seconds for each task (default: 900)
  --base-url <url>     Override Renoise API base URL
  --dry-run            Print prompts/config only, no API calls
  --help               Show this help

Environment:
  RENOISE_API_KEY or RENOISE_AUTH_TOKEN
  Optional: RENOISE_BASE_URL
`);
}

function loadEnv() {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(__dirname, ".env"),
    path.join(__dirname, "..", ".env"),
    path.join(__dirname, "..", "..", ".env"),
    path.join(__dirname, "..", "..", "..", ".env"),
  ];

  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
    break;
  }
}

class ApiError extends Error {
  constructor(status, body, message) {
    super(message || `API Error ${status}: ${JSON.stringify(body)}`);
    this.status = status;
    this.body = body;
  }
}

class RenoiseClient {
  constructor({ baseUrl, apiKey, authToken }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.authToken = authToken;
  }

  headers() {
    const headers = {};
    if (this.apiKey) headers["X-API-Key"] = this.apiKey;
    if (this.authToken) headers["Authorization"] = `Bearer ${this.authToken}`;
    return headers;
  }

  async request(method, apiPath, body) {
    const response = await fetch(`${this.baseUrl}${apiPath}`, {
      method,
      headers: body
        ? { ...this.headers(), "Content-Type": "application/json" }
        : this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(response.status, data, data.error || response.statusText);
    }
    return data;
  }

  createTask(params) {
    return this.request("POST", "/tasks", params);
  }

  getTask(id) {
    return this.request("GET", `/tasks/${id}`);
  }

  getTaskResult(id) {
    return this.request("GET", `/tasks/${id}/result`);
  }

  async waitForTask(id, { pollMs = 10000, timeoutMs = 900000 } = {}) {
    const startedAt = Date.now();
    while (true) {
      const { task } = await this.getTask(id);
      console.log(`    [task #${id}] ${task.status}`);

      if (task.status === "completed") {
        return this.getTaskResult(id);
      }
      if (task.status === "failed") {
        throw new Error(`Task ${id} failed: ${task.error || "unknown error"}`);
      }
      if (task.status === "cancelled") {
        throw new Error(`Task ${id} was cancelled`);
      }
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`Task ${id} timed out after ${Math.round(timeoutMs / 1000)}s`);
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }

  async uploadMaterial(buffer, filename, type = "image") {
    const form = new FormData();
    form.append("file", new Blob([buffer]), filename);
    form.append("type", type);

    const response = await fetch(`${this.baseUrl}/materials/upload`, {
      method: "POST",
      headers: this.headers(),
      body: form,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(response.status, data, data.error || response.statusText);
    }
    return data;
  }
}

function createRandomConcept(index, anchorMode = "first-only") {
  const subject = pick(SUBJECTS);
  const environment = pick(ENVIRONMENTS);
  const style = pick(STYLES);
  const variation = pick(LOOP_VARIATIONS);
  const cameraFlow = pick(CAMERA_FLOWS);
  const transformation = pick(MAJOR_TRANSFORMATIONS);
  const environmentReaction = pick(ENVIRONMENT_REACTIONS);
  const returnPattern = pick(RETURN_PATTERNS);
  const cyclicMotif = pick(CYCLIC_MOTIFS);
  const progressionRule = pick(PROGRESSION_RULES);
  const loopGoal = pick(LOOP_GOALS);
  const closureMechanism = pick(CLOSURE_MECHANISMS);
  const antiRetraceRule = pick(ANTI_RETRACE_RULES);
  const endingVerb = pick(ENDING_VERBS);
  const audioStyle = pick(AUDIO_STYLES);

  const imagePrompt = [
    subject,
    environment,
    style,
    "single coherent hero image, no text, no watermark",
  ].join(", ");

  const anchorParagraph = anchorMode === "first-last"
    ? `The provided first and last frame are the same image. Treat them as hard anchors, but make the journey feel like a forward-moving cycle rather than an out-and-back return. Keep ${subject} as the central subject in ${environment}. ${cameraFlow}`
    : `The provided first frame is the opening anchor. Let the video naturally loop into that same composition by the end through forward progression. Keep ${subject} as the central subject in ${environment}. ${cameraFlow}`;

  const videoPrompt = [
    `${style}.`,
    `High-definition, rich detail, cinematic texture, natural color, soft lighting. Motion natural and fluid, no stiffness, no frame stuttering, no flickering.`,
    anchorParagraph,
    `The whole segment should behave like a closed surreal circuit. ${cyclicMotif} ${progressionRule} ${loopGoal} ${closureMechanism} ${antiRetraceRule}`,
    `The route into the ending should differ from the route out of the beginning. The final image should feel manufactured by the weird process itself, not restored by reversal.`,
    `[0-3s] The scene begins exactly on the supplied opening frame. A precise disturbance appears inside the existing composition, revealing the hidden logic of this world. The first strange event grows directly out of the opening image.`,
    `[3-7s] The disturbance evolves into a major readable transformation. ${transformation} The escalation feels like a natural consequence of what has already begun.`,
    `[7-11s] The weirdness spreads across the whole frame. ${environmentReaction} ${variation} The action remains continuous and cinematic, with bold visible changes and a clear sense of cumulative progression.`,
    `[11-15s] ${returnPattern} New forward-moving actions ${endingVerb} the opening tableau out of the peak weirdness. The last frame lands on the exact opening composition, pose, scale, framing, lighting, and color palette, but it feels newly completed, inevitable, and satisfying rather than reversed. Frame holds steady.`,
    `Audio style: ${audioStyle}. No spoken dialogue.`,
    `No text, subtitles, watermarks, or logos.`,
  ].join("\n\n");

  return {
    id: `item-${String(index + 1).padStart(3, "0")}-${slugify(subject).slice(0, 24)}`,
    subject,
    environment,
    style,
    imagePrompt,
    videoPrompt,
  };
}

function extFromUrl(url, fallback = ".png") {
  try {
    const ext = path.extname(new URL(url).pathname);
    return ext || fallback;
  } catch {
    return fallback;
  }
}

async function downloadFile(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed ${response.status}: ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(destination, Buffer.from(arrayBuffer));
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function createDistinctVisualClone(inputPath, outputPath) {
  const sips = spawnSync("sips", ["-s", "format", "png", inputPath, "--out", outputPath], {
    stdio: "pipe",
    encoding: "utf8",
  });

  if (sips.status === 0 && existsSync(outputPath)) {
    return;
  }

  // Fallback: copy the file and append harmless trailing bytes.
  // PNG decoders generally ignore trailing bytes after IEND, while the binary
  // content differs enough to avoid server-side dedupe on raw file hash.
  const original = await fs.readFile(inputPath);
  const trailer = Buffer.from(`\nWEIRD_LOOP_CLONE_${Date.now()}_${Math.random()}\n`, "utf8");
  await fs.writeFile(outputPath, Buffer.concat([original, trailer]));
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function appendJsonl(filePath, data) {
  await fs.appendFile(filePath, `${JSON.stringify(data)}\n`, "utf8");
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    printHelp();
    return;
  }

  const count = Number.parseInt(flags.count || "1", 10);
  const ratio = flags.ratio || "9:16";
  const duration = Number.parseInt(flags.duration || "15", 10);
  const resolution = flags.resolution || "2k";
  const anchorMode = flags["anchor-mode"] || "first-only";
  const pollMs = Number.parseInt(flags.poll || "10", 10) * 1000;
  const timeoutMs = Number.parseInt(flags.timeout || "900", 10) * 1000;
  const queueOnly = Boolean(flags["queue-only"]);
  const dryRun = Boolean(flags["dry-run"]);
  const batchStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.resolve(flags.out || `tmp/weird-loop-batch/${batchStamp}`);
  const manifestPath = path.join(outDir, "manifest.jsonl");

  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("--count must be a positive integer");
  }
  if (!["1:1", "16:9", "9:16"].includes(ratio)) {
    throw new Error("--ratio must be one of: 1:1, 16:9, 9:16");
  }
  if (duration < 5 || duration > 15) {
    throw new Error("--duration must be between 5 and 15 seconds");
  }
  if (!["1k", "2k"].includes(resolution)) {
    throw new Error("--resolution must be 1k or 2k");
  }
  if (!["first-only", "first-last"].includes(anchorMode)) {
    throw new Error("--anchor-mode must be first-only or first-last");
  }

  await ensureDir(outDir);

  const runConfig = {
    createdAt: new Date().toISOString(),
    count,
    ratio,
    duration,
    resolution,
    anchorMode,
    queueOnly,
    dryRun,
    outputDir: outDir,
    extraTag: flags.tag || null,
  };
  await writeJson(path.join(outDir, "config.json"), runConfig);

  console.log(`Output: ${outDir}`);
  console.log(`Items: ${count} | ratio=${ratio} | duration=${duration}s | resolution=${resolution} | anchorMode=${anchorMode}`);
  if (queueOnly) console.log("Mode: queue-only (video tasks will be created but not awaited)");
  if (dryRun) console.log("Mode: dry-run (no API calls)");

  let client = null;
  if (!dryRun) {
    loadEnv();
    const apiKey = process.env.RENOISE_API_KEY;
    const authToken = process.env.RENOISE_AUTH_TOKEN;
    if (!apiKey && !authToken) {
      throw new Error("RENOISE_API_KEY or RENOISE_AUTH_TOKEN is required (or use --dry-run)");
    }
    client = new RenoiseClient({
      baseUrl: flags["base-url"] || process.env.RENOISE_BASE_URL || DEFAULT_BASE_URL,
      apiKey,
      authToken,
    });
  }

  for (let i = 0; i < count; i++) {
    const concept = createRandomConcept(i, anchorMode);
    const itemDir = path.join(outDir, concept.id);
    await ensureDir(itemDir);
    await writeJson(path.join(itemDir, "concept.json"), concept);

    console.log(`\n=== ${concept.id} ===`);
    console.log(`Subject: ${concept.subject}`);
    console.log(`Image prompt: ${concept.imagePrompt}`);
    console.log(`Video prompt: ${concept.videoPrompt}`);

    const tags = ["weird-loop", batchStamp, concept.id];
    if (flags.tag) tags.push(flags.tag);

    if (dryRun) {
      await appendJsonl(manifestPath, {
        type: "dry-run",
        concept,
        tags,
        itemDir,
      });
      continue;
    }

    console.log("  1) Generating random seed image...");
    const imageTask = await client.createTask({
      prompt: concept.imagePrompt,
      model: "nano-banana-2",
      resolution,
      ratio,
      tags,
    });
    const imageTaskId = imageTask.task.id;
    console.log(`     image task #${imageTaskId}`);
    const imageResult = await client.waitForTask(imageTaskId, { pollMs, timeoutMs });
    if (!imageResult.imageUrl) {
      throw new Error(`Image task ${imageTaskId} completed without imageUrl`);
    }

    const imageExt = extFromUrl(imageResult.imageUrl);
    const seedImagePath = path.join(itemDir, `seed${imageExt}`);
    console.log(`  2) Downloading seed image -> ${seedImagePath}`);
    await downloadFile(imageResult.imageUrl, seedImagePath);

    const firstFramePath = path.join(itemDir, `first-frame${path.extname(seedImagePath) || ".png"}`);
    const lastFramePath = anchorMode === "first-last"
      ? path.join(itemDir, `last-frame.png`)
      : null;
    await fs.copyFile(seedImagePath, firstFramePath);
    if (lastFramePath) {
      console.log("  3) Preparing separate first/last-frame files from the same image...");
      await createDistinctVisualClone(seedImagePath, lastFramePath);
    } else {
      console.log("  3) Preparing first-frame anchor file...");
    }

    console.log(
      anchorMode === "first-last"
        ? "  4) Uploading first/last-frame files as separate Renoise materials..."
        : "  4) Uploading first-frame file as Renoise material...",
    );
    const firstFrameBytes = await fs.readFile(firstFramePath);
    const firstUploadResult = await client.uploadMaterial(
      firstFrameBytes,
      path.basename(firstFramePath),
      "image",
    );
    const firstFrameMaterialId = firstUploadResult.material?.id;
    let lastFrameMaterialId = null;
    if (!firstFrameMaterialId) {
      throw new Error("Material upload succeeded but first_frame material id was not returned");
    }
    console.log(`     first_frame material #${firstFrameMaterialId}`);

    if (lastFramePath) {
      const lastFrameBytes = await fs.readFile(lastFramePath);
      const lastUploadResult = await client.uploadMaterial(
        lastFrameBytes,
        path.basename(lastFramePath),
        "image",
      );
      lastFrameMaterialId = lastUploadResult.material?.id;
      if (!lastFrameMaterialId) {
        throw new Error("Material upload succeeded but last_frame material id was not returned");
      }
      console.log(`     last_frame  material #${lastFrameMaterialId}`);
    }

    console.log("  5) Creating weird loop video task...");
    const materials = [{ id: firstFrameMaterialId, role: "first_frame" }];
    if (lastFrameMaterialId) {
      materials.push({ id: lastFrameMaterialId, role: "last_frame" });
    }
    const videoTask = await client.createTask({
      prompt: concept.videoPrompt,
      model: "renoise-2.0",
      duration,
      ratio,
      tags,
      materials,
    });
    const videoTaskId = videoTask.task.id;
    console.log(`     video task #${videoTaskId}`);

    const manifestEntry = {
      createdAt: new Date().toISOString(),
      concept,
      itemDir,
      tags,
      imageTaskId,
      imageResult,
      seedImagePath,
      anchorMode,
      firstFramePath,
      lastFramePath,
      firstFrameMaterialId,
      lastFrameMaterialId,
      videoTaskId,
      queueOnly,
    };

    if (!queueOnly) {
      console.log("  6) Waiting for video result...");
      const videoResult = await client.waitForTask(videoTaskId, { pollMs, timeoutMs });
      await writeJson(path.join(itemDir, "result.json"), {
        ...manifestEntry,
        videoResult,
      });
      await appendJsonl(manifestPath, {
        ...manifestEntry,
        videoResult,
      });
      console.log(`     done: ${videoResult.videoUrl || "(no videoUrl returned)"}`);
    } else {
      await writeJson(path.join(itemDir, "queued.json"), manifestEntry);
      await appendJsonl(manifestPath, manifestEntry);
      console.log("     queued without waiting");
    }
  }

  console.log("\nFinished.");
  console.log(`Manifest: ${manifestPath}`);
}

main().catch((error) => {
  console.error(`\nERROR: ${error.message}`);
  process.exit(1);
});
