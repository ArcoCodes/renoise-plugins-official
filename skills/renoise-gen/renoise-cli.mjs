#!/usr/bin/env node

// src/errors.ts
var ApiError = class extends Error {
  constructor(status, body, message) {
    super(message || `API Error ${status}: ${JSON.stringify(body)}`);
    this.status = status;
    this.body = body;
    this.name = "ApiError";
  }
};
var AuthError = class extends ApiError {
  constructor(body) {
    super(401, body, "Authentication failed \u2014 check your API key. Create or rotate one at https://www.renoise.ai/developer");
    this.name = "AuthError";
  }
};
var InsufficientCreditError = class extends ApiError {
  available;
  required;
  constructor(body) {
    super(402, body, `Insufficient credits: need ${body.required}, have ${body.available}`);
    this.name = "InsufficientCreditError";
    this.available = body.available ?? 0;
    this.required = body.required ?? 0;
  }
};

// src/client.ts
var PLUGIN_VERSION = "0.3.0";
var RenoiseClient = class {
  baseUrl;
  apiKey;
  constructor(config) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
  }
  buildAuthHeaders() {
    return {
      "X-API-Key": this.apiKey,
      "X-Client-Name": "renoise-plugin",
      "X-Client-Version": PLUGIN_VERSION
    };
  }
  // ---- HTTP ----
  async request(method, path, body) {
    const url = `${this.baseUrl}${path}`;
    const headers = this.buildAuthHeaders();
    if (body) headers["Content-Type"] = "application/json";
    const resp = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : void 0
    });
    if (resp.status === 401) throw new AuthError(await resp.json().catch(() => ({})));
    if (resp.status === 402) throw new InsufficientCreditError(await resp.json().catch(() => ({})));
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new ApiError(resp.status, data, data.error);
    return data;
  }
  // ---- Credit ----
  async getMe() {
    return this.request("GET", "/me");
  }
  async estimateCost(params) {
    const qs = new URLSearchParams();
    if (params.model) qs.set("model", params.model);
    if (params.duration) qs.set("duration", String(params.duration));
    if (params.resolution) qs.set("resolution", params.resolution);
    if (params.variant) qs.set("variant", params.variant);
    if (params.hasVideoRef) qs.set("hasVideoRef", "1");
    if (params.watermark) qs.set("watermark", "1");
    return this.request("GET", `/credit/estimate?${qs}`);
  }
  async getCreditHistory(limit = 50, offset = 0) {
    return this.request("GET", `/credit/history?limit=${limit}&offset=${offset}`);
  }
  // ---- Task ----
  async createTask(params) {
    return this.request("POST", "/tasks", params);
  }
  async listTasks(params = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.tag) qs.set("tag", params.tag);
    if (params.type) qs.set("type", params.type);
    if (params.provider) qs.set("provider", params.provider);
    if (params.ids) qs.set("ids", params.ids);
    qs.set("limit", String(params.limit ?? 50));
    qs.set("offset", String(params.offset ?? 0));
    return this.request("GET", `/tasks?${qs}`);
  }
  async getTask(id) {
    return this.request("GET", `/tasks/${id}`);
  }
  async getTaskResult(id) {
    return this.request("GET", `/tasks/${id}/result`);
  }
  async cancelTask(id) {
    return this.request("POST", `/tasks/${id}/cancel`);
  }
  async updateTags(id, tags) {
    return this.request("PATCH", `/tasks/${id}/tags`, { tags });
  }
  async listTags() {
    return this.request("GET", "/tags");
  }
  async waitForTask(id, options = {}) {
    const interval = options.pollInterval ?? 1e4;
    const timeout = options.timeout ?? 6e5;
    const start = Date.now();
    while (true) {
      const { task } = await this.getTask(id);
      options.onPoll?.(task);
      if (task.status === "completed") {
        return this.getTaskResult(id);
      }
      if (task.status === "failed") {
        throw new ApiError(400, { error: task.error, status: "failed" }, `Task ${id} failed: ${task.error}`);
      }
      if (task.status === "cancelled") {
        throw new ApiError(400, { status: "cancelled" }, `Task ${id} was cancelled`);
      }
      if (Date.now() - start > timeout) {
        throw new Error(`Task ${id} timed out after ${timeout / 1e3}s (status: ${task.status})`);
      }
      await new Promise((r) => setTimeout(r, interval));
    }
  }
  async generate(params, options) {
    const { task } = await this.createTask(params);
    return this.waitForTask(task.id, options);
  }
  // ---- Material ----
  async uploadMaterial(file, filename, type = "image") {
    const url = `${this.baseUrl}/materials/upload`;
    const form = new FormData();
    const blob = file instanceof Blob ? file : new Blob([file]);
    form.append("file", blob, filename);
    form.append("type", type);
    const resp = await fetch(url, {
      method: "POST",
      headers: this.buildAuthHeaders(),
      body: form
    });
    if (resp.status === 401) throw new AuthError(await resp.json().catch(() => ({})));
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new ApiError(resp.status, data, data.error);
    return data;
  }
  async listMaterials(params = {}) {
    const qs = new URLSearchParams();
    if (params.type) qs.set("type", params.type);
    if (params.search) qs.set("search", params.search);
    if (params.id) qs.set("id", String(params.id));
    if (params.ids) qs.set("ids", params.ids);
    if (params.mine) qs.set("mine", "true");
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.offset) qs.set("offset", String(params.offset));
    return this.request("GET", `/materials?${qs}`);
  }
  async getUploadUrl(filename, contentType) {
    return this.request("POST", "/materials/upload-url", { filename, contentType });
  }
  async registerMaterial(params) {
    return this.request("POST", "/materials", params);
  }
};

// src/cli.ts
import { readFileSync, writeFileSync } from "fs";
import { join, extname, basename } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
var __dir = fileURLToPath(new URL(".", import.meta.url));
function loadEnv() {
  const candidates = [
    join(process.cwd(), ".env"),
    join(__dir, ".env")
  ];
  for (const p of candidates) {
    try {
      const content = readFileSync(p, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"') || val.startsWith("'") && val.endsWith("'")) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
      break;
    } catch {
    }
  }
}
function env(key, fallback) {
  const v = process.env[key] ?? fallback;
  if (!v) {
    console.error(`Error: ${key} is not set.
Set it via environment variable or .env file.`);
    process.exit(1);
  }
  return v;
}
var DEFAULT_BASE_URL = "https://www.renoise.ai/api/public/v1";
var IMAGE_MODELS = /* @__PURE__ */ new Set(["gpt-image-2", "nano-banana-2", "nano-banana-2-lite", "nano-banana-pro", "midjourney-v7", "midjourney", "mj-v8.1", "midjourney-v8.1", "mj-8.1", "seedream-5-0-lite", "seedream-5-0-pro", "grok-image", "grok-image-quality"]);
var AUDIO_MODELS = /* @__PURE__ */ new Set(["lyria-clip", "lyria", "lyria-3-clip", "seed-audio-1.0", "seed-audio"]);
var UPLOAD_DIRECT_LIMIT = 50 * 1024 * 1024;
// 主推名 + 废弃别名统一映射到 byteplus 提交名（与平台前端提交出口的映射保持一致）
var SEEDANCE_BYTEPLUS_MAP = {
  // 主推名
  "seedance-2.0": "seedance-2.0-byteplus",
  "seedance-2.0-fast": "seedance-2.0-fast-byteplus",
  "seedance-2.0-mini": "seedance-2.0-mini-byteplus",
  // 废弃别名（本次仍接受 + warn；下一个大版本移除）
  "renoise-2.0": "seedance-2.0-byteplus",
  "sd-2.0": "seedance-2.0-byteplus",
  "youmeng-2.0": "seedance-2.0-byteplus",
  "renoise-2.0-fast": "seedance-2.0-fast-byteplus",
  "sd-2.0-fast": "seedance-2.0-fast-byteplus",
  "youmeng-2.0-fast": "seedance-2.0-fast-byteplus",
  "renoise-2.0-mini": "seedance-2.0-mini-byteplus",
  "sd-2.0-mini": "seedance-2.0-mini-byteplus",
  "youmeng-2.0-mini": "seedance-2.0-mini-byteplus"
};
var DEPRECATED_MODEL_ALIASES = {
  "renoise-2.0": "seedance-2.0",
  "sd-2.0": "seedance-2.0",
  "youmeng-2.0": "seedance-2.0",
  "renoise-2.0-fast": "seedance-2.0-fast",
  "sd-2.0-fast": "seedance-2.0-fast",
  "youmeng-2.0-fast": "seedance-2.0-fast",
  "renoise-2.0-mini": "seedance-2.0-mini",
  "sd-2.0-mini": "seedance-2.0-mini",
  "youmeng-2.0-mini": "seedance-2.0-mini"
};
function toSubmitModel(model) {
  // 未显式指定 model 的视频任务：平台缺省会落到非 byteplus 档，CLI 必须显式发 byteplus 名。
  const m = model ?? "seedance-2.0";
  if (DEPRECATED_MODEL_ALIASES[m]) {
    console.error(`⚠️  '${m}' is deprecated, use '${DEPRECATED_MODEL_ALIASES[m]}'`);
  }
  return SEEDANCE_BYTEPLUS_MAP[m] ?? m;
}
// 模型能力/约束表（各字段以 Renoise 平台的模型约束为准，平台更新时同步此表）。
// key = CLI 实际提交名（seedance 系列一律 byteplus）；未列约束的字段一律不校验（宁松勿紧）。
var SEEDANCE_RATIOS = ["9:16", "16:9", "1:1", "4:3", "3:4", "21:9"];
var MODEL_CONSTRAINTS = {
  // ---- video ----
  "seedance-2.0-byteplus": { type: "video", resolutions: ["480p", "720p", "1080p", "4k"], ratios: SEEDANCE_RATIOS, maxRefImages: 9, maxRefVideos: 3, maxRefAudios: 3, allowFramesWithRefs: false },
  "seedance-2.0-fast-byteplus": { type: "video", resolutions: ["480p", "720p"], ratios: SEEDANCE_RATIOS, maxRefImages: 9, maxRefVideos: 3, maxRefAudios: 3, allowFramesWithRefs: false },
  "seedance-2.0-mini-byteplus": { type: "video", resolutions: ["480p", "720p"], ratios: SEEDANCE_RATIOS, maxRefImages: 9, maxRefVideos: 3, maxRefAudios: 3, allowFramesWithRefs: false },
  "happyhorse-1.0": { type: "video", resolutions: ["720p", "1080p"], ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"], maxRefImages: 9, maxRefVideos: 0, noLastFrame: true },
  "kling-3.0-omni": { type: "video", resolutions: ["720p", "1080p"], ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"], maxRefImages: 7, maxRefVideos: 1 },
  "grok-video": { type: "video", resolutions: ["480p", "720p"], ratios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"], maxRefImages: 7, maxRefVideos: 0 },
  "grok-video-1.5": { type: "video", resolutions: ["480p", "720p"], ratios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"], maxRefImages: 1, maxRefVideos: 0, exactlyOneImage: true },
  "gemini-omni-flash": { type: "video", resolutions: ["720p"], ratios: ["16:9", "9:16"], maxRefImages: 6, maxRefVideos: 1, maxRefAudios: 0, requireRatio: true, allowFramesWithRefs: true },
  "upscale-video-volcano-mediakit": { type: "video", resolutions: ["1080p", "2k", "4k"], exactlyOneSource: true },
  // ---- image ----
  "nano-banana-2": { type: "image", resolutions: ["1k", "2k", "4k"], ratios: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "1:4", "4:1", "1:8", "8:1"] },
  "nano-banana-2-lite": { type: "image", resolutions: ["1k"], ratios: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "1:4", "4:1", "1:8", "8:1"], maxRefImages: 14, maxRefVideos: 0, maxRefAudios: 0 },
  "nano-banana-pro": { type: "image", resolutions: ["1k", "2k", "4k"], ratios: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] },
  "midjourney-v7": { type: "image", ratios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"], maxRefImages: 4 },
  "mj-v8.1": { type: "image", ratios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"], maxRefImages: 4 },
  "gpt-image-2": { type: "image", resolutions: ["1k", "2k", "4k"], ratios: ["1:1", "3:2", "2:3", "3:4", "4:3", "16:9", "9:16", "21:9"], maxRefImages: 16 },
  "seedream-5-0-lite": { type: "image", resolutions: ["2k", "3k", "4k"], ratios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"], maxRefImages: 14, maxRefVideos: 0, maxRefAudios: 0 },
  "seedream-5-0-pro": { type: "image", resolutions: ["1k", "2k"], ratios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"], maxRefImages: 10, maxRefVideos: 0, maxRefAudios: 0 },
  "grok-image": { type: "image", resolutions: ["1k", "2k"], ratios: ["1:1", "3:4", "4:3", "9:16", "16:9", "2:3", "3:2"], maxRefImages: 3, maxRefVideos: 0 },
  "grok-image-quality": { type: "image", resolutions: ["1k", "2k"], ratios: ["1:1", "3:4", "4:3", "9:16", "16:9", "2:3", "3:2"], maxRefImages: 3, maxRefVideos: 0 },
  "upscale-image-volcano-mediakit": { type: "image", resolutions: ["1080p", "2k", "4k"], exactlyOneSource: true },
  // ---- audio ----
  "lyria-clip": { type: "audio", maxRefImages: 1, maxRefVideos: 0 },
  "seed-audio-1.0": { type: "audio", maxRefImages: 1, maxRefVideos: 0, maxRefAudios: 3, imageAudioExclusive: true }
};
// role → 期望的素材媒体类型（用于 type×role 前置校验，D11-d）。
var ROLE_MEDIA_TYPE = {
  ref_image: "image",
  reference_image: "image",
  first_frame: "image",
  last_frame: "image",
  mask: "image",
  ref_video: "video",
  reference_video: "video",
  source_video: "video",
  ref_audio: "audio",
  reference_audio: "audio"
};
function mimeForUpload(ext, type) {
  const map = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif"
  };
  if (map[ext]) return map[ext];
  return type === "video" ? "video/mp4" : type === "audio" ? "audio/mpeg" : "image/jpeg";
}
// 按 size 分流的统一上传入口（<50MB multipart 直传；>=50MB 走 upload-url + PUT + register）。
// materialUpload 与 taskChain 共用，避免 chain 的大视频结果（1080p/4k 长片段）撞 50MB 直传上限。
async function uploadBySize(client, buffer, filename, type) {
  const big = buffer.byteLength >= UPLOAD_DIRECT_LIMIT;
  const sizeMB = (buffer.byteLength / 1024 / 1024).toFixed(1);
  console.log(`Uploading ${filename} (${type}, ${sizeMB}MB)${big ? " via presigned URL" : ""}...`);
  if (big) {
    const mime = mimeForUpload(extname(filename).toLowerCase(), type);
    const { uploadUrl, path } = await client.getUploadUrl(filename, mime);
    const putResp = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": mime }, body: buffer });
    if (!putResp.ok) throw new Error(`PUT upload failed: ${putResp.status}`);
    const md5 = createHash("md5").update(buffer).digest("hex");
    return client.registerMaterial({ name: filename, md5, type, storagePath: path, mimeType: mime, size: buffer.byteLength });
  }
  return client.uploadMaterial(buffer, filename, type);
}
// CLI 前置拦截"确定会被服务端拒绝"的素材/参数组合，报错文案与服务端一致。
// 宁松勿紧：本表未设的约束、以及仅服务端才校验的规则，一律放行交服务端。
async function validateBeforeSubmit(params, client) {
  const model = params.model;
  const materials = params.materials || [];
  // e. AUDIO_MODELS 带 resolution/ratio/duration → warn + 剥离（先做，避免后续 resolution/ratio 白名单误判）。
  if (model && AUDIO_MODELS.has(model)) {
    for (const key of ["resolution", "ratio", "duration"]) {
      if (params[key] !== void 0) {
        console.error(`⚠️  ${model} does not accept '${key}'; stripping it.`);
        delete params[key];
      }
    }
  }
  const c = model ? MODEL_CONSTRAINTS[model] : void 0;
  // 引用素材计数（角色集合与服务端校验一致）。
  const refImageCount = materials.filter((m) => m.role === "reference_image" || m.role === "ref_image").length;
  const refVideoCount = materials.filter((m) => m.role === "ref_video" || m.role === "reference_video" || m.role === "source_video").length;
  const refAudioCount = materials.filter((m) => m.role === "ref_audio" || m.role === "reference_audio").length;
  if (c) {
    // a. resolution / ratio 白名单 + requireRatio。
    if (params.resolution && c.resolutions && !c.resolutions.includes(params.resolution)) {
      throw new Error(`Resolution '${params.resolution}' is not supported by model '${model}'. Supported: ${c.resolutions.join(", ")}`);
    }
    if (c.requireRatio && !params.ratio) {
      throw new Error(`Model '${model}' requires an aspect ratio; supported: ${(c.ratios || []).join(", ")}`);
    }
    if (params.ratio && c.ratios && !c.ratios.includes(params.ratio)) {
      throw new Error(`Aspect ratio '${params.ratio}' is not supported by model '${model}'. Supported: ${c.ratios.join(", ")}`);
    }
    // c. "恰好 1 个"类规则先于数量上限，报错文案更贴合模型语义（grok-video-1.5 / upscale-*）。
    if (c.exactlyOneSource && materials.length !== 1) {
      throw new Error(`${model} requires exactly 1 source material`);
    }
    if (c.exactlyOneImage) {
      // 输入图计数含 first_frame（与服务端 grok 的输入图判定一致），
      // 避免把 `ID:first_frame` 这类合法输入图误拦。
      const inputImageCount = materials.filter((m) => m.role === "reference_image" || m.role === "ref_image" || m.role === "first_frame").length;
      if (inputImageCount !== 1) throw new Error(`${model} requires exactly 1 input image`);
    }
    // b. 参考素材数量上限（含 0 = 完全禁止该类引用）。
    if (refImageCount > 0 && c.maxRefImages !== void 0 && refImageCount > c.maxRefImages) {
      throw new Error(`Model '${model}' supports at most ${c.maxRefImages} reference images`);
    }
    if (refVideoCount > 0 && c.maxRefVideos !== void 0 && refVideoCount > c.maxRefVideos) {
      throw new Error(`Model '${model}' supports at most ${c.maxRefVideos} reference videos`);
    }
    if (refAudioCount > 0 && c.maxRefAudios !== void 0 && refAudioCount > c.maxRefAudios) {
      throw new Error(`Model '${model}' supports at most ${c.maxRefAudios} audio references`);
    }
    // 其余角色规则。
    if (c.imageAudioExclusive && refImageCount > 0 && refAudioCount > 0) {
      throw new Error(`seed-audio: reference image cannot be combined with reference audio`);
    }
    if (refAudioCount > 0 && refImageCount === 0 && refVideoCount === 0 && c.type !== "audio") {
      throw new Error(`reference_audio cannot be the only reference input`);
    }
    if (materials.length) {
      const roles = materials.map((m) => m.role);
      const hasLastFrame = roles.includes("last_frame");
      const hasFirstFrame = roles.includes("first_frame");
      const hasRefImage = roles.includes("reference_image") || roles.includes("ref_image");
      if (hasLastFrame && !hasFirstFrame) {
        throw new Error(`Last frame requires a first frame`);
      }
      if ((hasFirstFrame || hasLastFrame) && hasRefImage && !c.allowFramesWithRefs) {
        throw new Error(`Frames and reference images cannot be used together`);
      }
      if (c.noLastFrame && hasLastFrame) {
        throw new Error(`HappyHorse does not support last frame`);
      }
    }
  }
  // d. 素材 type × role 匹配：一次 GET /materials?ids= 拉 type 后逐条比对。
  const idRoles = materials.filter((m) => m.id && ROLE_MEDIA_TYPE[m.role]);
  if (idRoles.length) {
    let typeById = {};
    try {
      const data = await client.listMaterials({ ids: idRoles.map((m) => m.id).join(",") });
      for (const mat of data.materials || []) typeById[mat.id] = mat.type;
    } catch {
      return; // 拉取失败不阻塞提交（宁松勿紧），交服务端校验。
    }
    for (const m of idRoles) {
      const expected = ROLE_MEDIA_TYPE[m.role];
      const actual = typeById[m.id];
      if (actual && actual !== expected) {
        const suggest = actual === "video" ? "ref_video" : actual === "audio" ? "ref_audio" : "ref_image";
        throw new Error(`Material #${m.id} is type '${actual}' but role '${m.role}' expects ${expected}. Use ':${suggest}' for ${actual} materials.`);
      }
    }
  }
}

function createClient(baseUrlOverride) {
  loadEnv();
  const apiKey = process.env["RENOISE_API_KEY"];
  if (!apiKey) {
    console.error("Error: RENOISE_API_KEY is not set.\nCreate one at https://www.renoise.ai/developer, then export RENOISE_API_KEY=fk_... (or put it in a .env file).");
    process.exit(1);
  }
  const baseUrl = baseUrlOverride || env("RENOISE_BASE_URL", DEFAULT_BASE_URL);
  return new RenoiseClient({ baseUrl, apiKey });
}

function json(data) {
  console.log(JSON.stringify(data, null, 2));
}
function parseArgs(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "true";
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}
var HELP = `
RENOISE CLI \u2014 AI generation task management

Usage:
  renoise <domain> <action> [options]

Domains:
  task        Create, list, and manage generation tasks
  material    Upload and manage materials
  credit      Check balance and transaction history

Environment:
  RENOISE_API_KEY     Required for /api/public/v1. Sent as X-API-Key.
  RENOISE_BASE_URL    (optional) Full API base URL (including /api/public/v1)
                      Default: https://www.renoise.ai/api/public/v1

Global Flags:
  --base-url <url>    Override API base URL for this command

Run "renoise <domain> help" for domain-specific commands.
`.trim();
var HELP_TASK = `
renoise task \u2014 Manage generation tasks

Commands:
  generate                    Create task + wait for result (one step)
  create                      Create a task (returns immediately)
  list                        List tasks
  get <id>                    Get task detail
  result <id>                 Get task result
  wait <id>                   Wait for task to complete
  cancel <id>                 Cancel a pending task
  chain <id>                  Download completed task result → upload as material (for ref_video chaining)
  tags                        List all your tags
  tag <id> --tags a,b,c       Update tags on a task

Options for generate/create:
  --prompt <text>             (required, except upscale-* models) Generation prompt
  --model <name>              Model name (default video: seedance-2.0)
  --type <video|image|audio>  Optional task type; must match model
  --duration <seconds>        Video duration (default: 5)
  --ratio <w:h>               Aspect ratio (default: 1:1)
  --resolution <1k|2k|3k|4k|480p|720p|1080p>
  --watermark                 Add watermark to video task (credit discount applies)
  --audio-generation <0|1>    Enable/disable model audio generation when supported
  --no-audio-generation       Disable model audio generation
  --template-id <id>          Create task from template
  --tags <a,b,c>              Comma-separated tags
  --materials <spec>          Material refs: "id:role" or "id:role:index"; role required
                              roles: ref_image / ref_video / ref_audio / first_frame /
                              last_frame / source_video (aliases: reference_image, ...)
                              index sets @ImageN/@VideoN ordering in the prompt

Deprecated model aliases: renoise-2.0* / sd-2.0* / youmeng-2.0* still map to the
seedance-2.0 series (with a deprecation warning) but will be removed next major
version. Use seedance-2.0 / seedance-2.0-fast / seedance-2.0-mini instead.

Options for list:
  --status <status>           Filter by status
  --tag <tag>                 Filter by tag
  --type <video|image|audio>  Filter by task type
  --provider <provider>       Filter by provider
  --ids <id1,id2>             Fetch specific task IDs
  --limit <n>                 Max results (default: 20)
  --offset <n>                Pagination offset

Options for wait:
  --interval <seconds>        Poll interval (default: 10)
  --timeout <seconds>         Timeout (default: 600)

Examples:
  renoise task generate --prompt "a cat dancing" --model seedance-2.0 --duration 5 --ratio 16:9
  renoise task generate --prompt "quick draft, cheaper tier" --model seedance-2.0-mini --duration 10 --ratio 9:16
  renoise task generate --prompt "cute cat" --model nano-banana-2 --resolution 2k
  renoise task generate --prompt "cinematic hero frame of a lone astronaut on Mars" --model nano-banana-pro --resolution 2k --ratio 16:9
  renoise task generate --prompt "hero product shot with bold typography" --model gpt-image-2 --resolution 2k --ratio 16:9
  renoise task generate --prompt "editorial photo" --model seedream-5-0-pro --resolution 2k --ratio 3:4
  renoise task generate --prompt "the character in the reference image turns to face the camera" --model grok-video-1.5 --materials "42:ref_image" --duration 8 --ratio 16:9
  renoise task generate --prompt "a chef plating a dessert, warm kitchen lighting" --model gemini-omni-flash --materials "VID:source_video" --ratio 16:9
  renoise task generate --model lyria-clip --prompt "warm acoustic folk BGM, no vocals"
  renoise task generate --model upscale-video-volcano-mediakit --resolution 2k --materials "77:ref_video"   # no --prompt needed
  renoise task create --prompt "epic scene" --model seedance-2.0 --duration 10 --ratio 16:9
  renoise task list --status completed --limit 5
  renoise task result 123
  renoise task wait 123 --interval 15
  renoise task chain 123      # downloads video/audio result → uploads as material → prints material ID
`.trim();
var HELP_MATERIAL = `
renoise material \u2014 Manage materials

Commands:
  list                        List your uploaded materials
  upload <file>               Upload a material (image, video, or audio)

Options for list:
  --type <image|video|audio>  Filter by type
  --search <keyword>          Search by name
  --id <id>                   Fetch one material by id
  --ids <id1,id2>             Fetch multiple material ids
  --mine                      Only list current user's materials
  --limit <n>                 Max results (default: 20)

Options for upload:
  --type <image|video|audio>  Override auto-detected type

Files < 50MB upload directly (multipart). Files >= 50MB automatically use the
presigned-URL flow (upload-url + PUT + register), so no manual steps are needed.

Examples:
  renoise material list
  renoise material upload /path/to/image.jpg
  renoise material upload /path/to/video.mp4 --type video
`.trim();
var HELP_CREDIT = `
renoise credit \u2014 Balance and transactions

Commands:
  me                          Show current user info and balance
  estimate                    Estimate task cost
  history                     Show credit transaction history

Options for estimate:
  --model <name>              Model name (seedance aliases are mapped automatically)
  --duration <seconds>        Duration (video only)
  --resolution <value>        Resolution variant (image: 1k/2k/3k/4k; video: 480p/720p/1080p/2k/4k)
  --hasVideoRef               Has video reference material
  --variant <variant>         Pricing variant override
  --watermark                 Apply video watermark discount

The response includes estimatedCredit, balance, sufficient, and discountPercent
(the applied discount: max of watermark and user-generated-content discount).
All cost figures come from live estimation; this CLI does not hardcode prices.

Options for history:
  --limit <n>                 Max results (default: 20)
  --offset <n>                Pagination offset

Examples:
  renoise credit me
  renoise credit estimate --model seedance-2.0 --duration 5 --resolution 1080p
  renoise credit estimate --model gpt-image-2 --resolution 2k
  renoise credit history --limit 10
`.trim();
async function taskGenerate(client, flags) {
  const isUpscale = (flags.model || "").startsWith("upscale-");
  if (!flags.prompt && !isUpscale) {
    console.error("Error: --prompt is required.\n");
    console.log(HELP_TASK);
    process.exit(1);
  }
  const params = buildCreateParams(flags);
  await validateBeforeSubmit(params, client);
  const interval = (flags.interval ? parseInt(flags.interval) : 10) * 1e3;
  const timeout = (flags.timeout ? parseInt(flags.timeout) : 600) * 1e3;

  console.log("Creating task...");
  const { task } = await client.createTask(params);
  console.log(`Task #${task.id} created (${task.status}). Waiting for completion...`);
  if (task.estimatedCredit) console.log(`Cost: ${task.estimatedCredit} credits`);
  const result = await client.waitForTask(task.id, {
    pollInterval: interval,
    timeout,
    onPoll: (t) => {
      console.log(`  [${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] ${t.status}`);
    }
  });
  console.log("\nDone!");
  printResult(result);
}
async function taskCreate(client, flags) {
  const isUpscale = (flags.model || "").startsWith("upscale-");
  if (!flags.prompt && !isUpscale) {
    console.error("Error: --prompt is required.\n");
    console.log(HELP_TASK);
    process.exit(1);
  }
  const params = buildCreateParams(flags);
  await validateBeforeSubmit(params, client);
  const data = await client.createTask(params);
  console.log(`Task created: id=${data.task.id}, status=${data.task.status}`);
  if (data.task.estimatedCredit) console.log(`Cost: ${data.task.estimatedCredit} credits`);
  json(data);
}
async function taskList(client, flags) {
  const data = await client.listTasks({
    status: flags.status,
    tag: flags.tag,
    type: flags.type,
    provider: flags.provider,
    ids: flags.ids,
    limit: flags.limit ? parseInt(flags.limit) : 20,
    offset: flags.offset ? parseInt(flags.offset) : 0
  });
  console.log(`Found ${data.tasks.length} task(s):
`);
  for (const t of data.tasks) {
    const tags = (() => {
      try {
        return JSON.parse(t.tags || "[]");
      } catch {
        return [];
      }
    })();
    const tagStr = tags.length ? ` [${tags.join(", ")}]` : "";
    console.log(`  #${t.id}  ${t.status.padEnd(10)}  ${t.model}  ${t.prompt.slice(0, 60)}${tagStr}`);
  }
}
async function taskGet(client, positional) {
  const id = parseInt(positional[0]);
  if (!id) {
    console.error("Error: task ID required.\nUsage: renoise task get <id>");
    process.exit(1);
  }
  json(await client.getTask(id));
}
async function taskResult(client, positional) {
  const id = parseInt(positional[0]);
  if (!id) {
    console.error("Error: task ID required.\nUsage: renoise task result <id>");
    process.exit(1);
  }
  const result = await client.getTaskResult(id);
  printResult(result);
}
async function taskWait(client, positional, flags) {
  const id = parseInt(positional[0]);
  if (!id) {
    console.error("Error: task ID required.\nUsage: renoise task wait <id>");
    process.exit(1);
  }
  const interval = (flags.interval ? parseInt(flags.interval) : 10) * 1e3;
  const timeout = (flags.timeout ? parseInt(flags.timeout) : 600) * 1e3;
  console.log(`Waiting for task #${id} (poll every ${interval / 1e3}s, timeout ${timeout / 1e3}s)...`);
  const result = await client.waitForTask(id, {
    pollInterval: interval,
    timeout,
    onPoll: (task) => {
      console.log(`  [${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] ${task.status}`);
    }
  });
  console.log("\nDone!");
  printResult(result);
}
async function taskCancel(client, positional) {
  const id = parseInt(positional[0]);
  if (!id) {
    console.error("Error: task ID required.\nUsage: renoise task cancel <id>");
    process.exit(1);
  }
  await client.cancelTask(id);
  console.log(`Task #${id} cancelled.`);
}
async function taskChain(client, positional) {
  const id = parseInt(positional[0]);
  if (!id) {
    console.error("Error: task ID required.\nUsage: renoise task chain <id>\n\nDownloads completed task result and uploads as material for ref_video chaining.");
    process.exit(1);
  }
  // 1. Get result
  console.log(`Getting result for task #${id}...`);
  const result = await client.getTaskResult(id);
  const url = result.videoUrl || result.imageUrl || result.audioUrl;
  if (!url) {
    console.error(`Task #${id} has no video, image, or audio result.`);
    process.exit(1);
  }
  const type = result.videoUrl ? "video" : result.imageUrl ? "image" : "audio";
  const ext = type === "video" ? "mp4" : type === "image" ? "png" : "mp3";
  const tmpPath = join(tmpdir(), `chain-${id}.${ext}`);
  // 2. Download
  console.log(`Downloading ${type} to ${tmpPath}...`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  const arrayBuf = await resp.arrayBuffer();
  writeFileSync(tmpPath, Buffer.from(arrayBuf));
  console.log(`Downloaded: ${(arrayBuf.byteLength / 1024 / 1024).toFixed(1)}MB`);
  // 3. Upload as material（复用 size 分流：chain 的大视频结果 >=50MB 时自动走预签名三步上传）
  const buffer = readFileSync(tmpPath);
  const filename = `chain-${id}.${ext}`;
  const data = await uploadBySize(client, buffer, filename, type);
  const mat = data.material || data;
  const matId = mat.id;
  console.log(`\nMaterial #${matId} ready.`);
  console.log(`Use as: --materials "${matId}:ref_${type}"`);
  json(data);
}
async function taskTags(client) {
  json(await client.listTags());
}
async function taskTag(client, positional, flags) {
  const id = parseInt(positional[0]);
  if (!id || !flags.tags) {
    console.error("Usage: renoise task tag <id> --tags a,b,c");
    process.exit(1);
  }
  const tags = flags.tags.split(",").map((t) => t.trim());
  json(await client.updateTags(id, tags));
}
async function materialList(client, flags) {
  const data = await client.listMaterials({
    type: flags.type,
    search: flags.search,
    id: flags.id ? parseInt(flags.id) : void 0,
    ids: flags.ids,
    mine: flags.mine === "true" || flags.mine === "1",
    limit: flags.limit ? parseInt(flags.limit) : 20,
    offset: flags.offset ? parseInt(flags.offset) : 0
  });
  console.log(`Found ${data.materials.length} material(s):
`);
  for (const m of data.materials) {
    console.log(`  #${m.id}  ${m.type.padEnd(6)}  ${m.name}`);
  }
}
async function materialUpload(client, positional, flags) {
  const filePath = positional[0];
  if (!filePath) {
    console.error("Error: file path required.\nUsage: renoise material upload <file> [--type image|video|audio]");
    process.exit(1);
  }
  const ext = extname(filePath).toLowerCase();
  const videoExts = [".mp4", ".mov", ".avi", ".webm", ".mkv"];
  const audioExts = [".mp3", ".wav", ".aac", ".ogg", ".m4a"];
  const type = flags.type || (videoExts.includes(ext) ? "video" : audioExts.includes(ext) ? "audio" : "image");
  const buffer = readFileSync(filePath);
  const filename = basename(filePath);
  const data = await uploadBySize(client, buffer, filename, type);
  const mat = data.material || data;
  if (data.action === "exists") {
    console.log(`Material already exists: #${mat.id}`);
  } else {
    console.log(`Material uploaded: #${mat.id}`);
  }
  json(data);
}
async function creditMe(client) {
  json(await client.getMe());
}
async function creditEstimate(client, flags) {
  // 应用 byteplus 映射（seedance 系列 → byteplus；废弃别名附 deprecation warning），否则估到非 byteplus 档的价。
  const model = flags.model ? toSubmitModel(flags.model) : void 0;
  const isAudio = !!model && AUDIO_MODELS.has(model);
  const variant = !flags.variant && model && IMAGE_MODELS.has(model) && flags.resolution
    ? flags.resolution
    : flags.variant;
  json(await client.estimateCost({
    model,
    // audio 模型不发 duration / resolution（避免 lyria 计费 variant 漂移）。
    duration: isAudio ? void 0 : flags.duration ? parseInt(flags.duration) : void 0,
    resolution: isAudio ? void 0 : flags.resolution,
    variant,
    hasVideoRef: flags.hasVideoRef === "true" || flags.hasVideoRef === "1",
    watermark: flags.watermark === "true" || flags.watermark === "1"
  }));
}
async function creditHistory(client, flags) {
  const limit = flags.limit ? parseInt(flags.limit) : 20;
  const offset = flags.offset ? parseInt(flags.offset) : 0;
  json(await client.getCreditHistory(limit, offset));
}
function buildCreateParams(flags) {
  const params = { prompt: flags.prompt };
  // model 改写（D1）：显式 model 走 toSubmitModel（seedance 系列 → byteplus；废弃别名附 warning）。
  if (flags.model) {
    params.model = toSubmitModel(flags.model);
  } else if (!flags.type || flags.type === "video") {
    // 未指定 model 且是 video 任务：平台缺省会落到非 byteplus 档，CLI 必须显式发 byteplus 名。
    params.model = "seedance-2.0-byteplus";
  }
  // --type image / --type audio 且未指定 model：不发 model（不能误兜 seedance 视频模型），
  // 由服务端报错 / 文档指引用户显式指定 model。
  if (flags.type) params.type = flags.type;
  if (flags.duration) params.duration = parseInt(flags.duration);
  if (flags.ratio) params.ratio = flags.ratio;
  if (flags.resolution) params.resolution = flags.resolution;
  if (flags.templateId) params.template_id = parseInt(flags.templateId);
  if (flags.template_id) params.template_id = parseInt(flags.template_id);
  if (flags["template-id"]) params.template_id = parseInt(flags["template-id"]);
  if (flags.watermark === "true" || flags.watermark === "1") params.watermark = true;
  if (flags.audioGeneration !== void 0) params.audioGeneration = flags.audioGeneration === "true" || flags.audioGeneration === "1";
  if (flags.audio_generation !== void 0) params.audioGeneration = flags.audio_generation === "true" || flags.audio_generation === "1";
  if (flags["audio-generation"] !== void 0) params.audioGeneration = flags["audio-generation"] === "true" || flags["audio-generation"] === "1";
  if (flags["no-audio-generation"] !== void 0) params.audioGeneration = false;
  if (flags.tags) params.tags = flags.tags.split(",").map((t) => t.trim());
  // upscale-*：画质增强，surface=upscale，prompt 可空（D9）。
  if ((params.model || "").startsWith("upscale-")) {
    params.surface = "upscale";
    if (!params.prompt) params.prompt = "";
  }
  const allMaterials = [];
  if (flags.materials) {
    for (const m of flags.materials.split(",")) {
      // id:role[:index]；asset: 前缀已废弃（D3-a'）。
      const parts = m.trim().split(":");
      if (parts[0] === "asset") {
        throw new Error(`--materials 'asset:...' 已废弃：assets 已下线，请直接使用 material ID（seedance 提交即自动开白），例如 "12345:ref_image"`);
      }
      const [id, role, idx] = parts;
      // role 必填；空串（如 "ID::INDEX"）同样报错。
      if (!role) throw new Error(`Material role is required for --materials entry '${m}'. Use id:role[:index], e.g. 123:ref_image`);
      const entry = { id: parseInt(id), role };
      if (idx !== void 0) {
        if (!/^\d+$/.test(idx)) throw new Error(`invalid index '${idx}' in '${m}'`);
        entry.index = parseInt(idx);
      }
      allMaterials.push(entry);
    }
  }
  if (allMaterials.length) params.materials = allMaterials;
  return params;
}
function printResult(result) {
  console.log(`Task #${result.taskId}  ${result.status}`);
  if (result.videoUrl) console.log(`  Video: ${result.videoUrl}`);
  if (result.coverUrl) console.log(`  Cover: ${result.coverUrl}`);
  if (result.imageUrl) console.log(`  Image: ${result.imageUrl}`);
  if (result.audioUrl) console.log(`  Audio: ${result.audioUrl}`);
  if (result.resolutions && Object.keys(result.resolutions).length) {
    console.log(`  Resolutions: ${Object.keys(result.resolutions).join(", ")}`);
  }
  if (result.warning) console.log(`  Warning: ${result.warning}`);
  json(result);
}
var DOMAIN_HELP = {
  task: HELP_TASK,
  material: HELP_MATERIAL,
  credit: HELP_CREDIT
};
async function main() {
  const args = process.argv.slice(2);
  const { flags, positional } = parseArgs(args);
  const domain = positional[0];
  const action = positional[1];
  const subPositional = positional.slice(2);
  if (!domain || domain === "help" || flags.help === "true") {
    console.log(HELP);
    return;
  }
  if (action === "help" || !action && flags.help !== "true") {
    console.log(DOMAIN_HELP[domain] || HELP);
    return;
  }
  if (flags.help === "true") {
    console.log(DOMAIN_HELP[domain] || HELP);
    return;
  }
  const baseUrlOverride = flags["base-url"] || null;
  const client = createClient(baseUrlOverride);
  if (baseUrlOverride) {
    console.log(`\u2139\uFE0F  Using API: ${baseUrlOverride}`);
  }
  try {
    switch (domain) {
      case "task":
        switch (action) {
          case "generate":
            await taskGenerate(client, flags);
            break;
          case "create":
            await taskCreate(client, flags);
            break;
          case "list":
            await taskList(client, flags);
            break;
          case "get":
            await taskGet(client, subPositional);
            break;
          case "result":
            await taskResult(client, subPositional);
            break;
          case "wait":
            await taskWait(client, subPositional, flags);
            break;
          case "cancel":
            await taskCancel(client, subPositional);
            break;
          case "chain":
            await taskChain(client, subPositional);
            break;
          case "tags":
            await taskTags(client);
            break;
          case "tag":
            await taskTag(client, subPositional, flags);
            break;
          default:
            console.error(`Unknown task action: ${action}
`);
            console.log(HELP_TASK);
            process.exit(1);
        }
        break;
      case "material":
        switch (action) {
          case "list":
            await materialList(client, flags);
            break;
          case "upload":
            await materialUpload(client, subPositional, flags);
            break;
          default:
            console.error(`Unknown material action: ${action}
`);
            console.log(HELP_MATERIAL);
            process.exit(1);
        }
        break;
      case "credit":
        switch (action) {
          case "me":
            await creditMe(client);
            break;
          case "estimate":
            await creditEstimate(client, flags);
            break;
          case "history":
            await creditHistory(client, flags);
            break;
          default:
            console.error(`Unknown credit action: ${action}
`);
            console.log(HELP_CREDIT);
            process.exit(1);
        }
        break;
      default:
        console.error(`Unknown domain: ${domain}
`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (e) {
    if (e instanceof AuthError) {
      console.error(`Auth Error: ${e.message}`);
      console.error("Make sure RENOISE_API_KEY is set correctly.");
      process.exit(1);
    }
    if (e instanceof InsufficientCreditError) {
      console.error(`Credit Error: ${e.message}`);
      console.error(`  Available: ${e.available}, Required: ${e.required}`);
      process.exit(1);
    }
    if (e instanceof ApiError) {
      console.error(`API Error (${e.status}): ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}
main();
