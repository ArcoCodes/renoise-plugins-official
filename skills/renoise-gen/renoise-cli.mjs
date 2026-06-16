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
    super(401, body, "Authentication failed \u2014 check your API key");
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
var RenoiseClient = class {
  baseUrl;
  apiKey;
  constructor(config) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
  }
  buildAuthHeaders() {
    return { "X-API-Key": this.apiKey };
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
  // ---- Character ----
  async listCharacters(params = {}) {
    const qs = new URLSearchParams();
    if (params.category) qs.set("category", params.category);
    if (params.usage_group) qs.set("usage_group", params.usage_group);
    if (params.search) qs.set("search", params.search);
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    return this.request("GET", `/characters?${qs}`);
  }
  async getCharacter(id) {
    return this.request("GET", `/characters/${id}`);
  }
  async importCharacters(characters) {
    return this.request("POST", "/characters/import", { characters });
  }
  async getCharacterImageUploadUrl(id, contentType) {
    return this.request("POST", `/characters/${id}/image`, { content_type: contentType });
  }
  async addCharacterGrant(userId, grantType, grantValue) {
    const body = { user_id: userId, grant_type: grantType };
    if (grantValue) body.grant_value = grantValue;
    return this.request("POST", "/characters/grants", body);
  }
  // ---- Asset ----
  async createAsset(params) {
    return this.request("POST", "/assets", params);
  }
  async getAsset(id) {
    return this.request("GET", `/assets/${id}`);
  }
  async listAssets(params = {}) {
    const qs = new URLSearchParams();
    if (params.groupId) qs.set("groupId", String(params.groupId));
    if (params.status) qs.set("status", params.status);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.offset) qs.set("offset", String(params.offset));
    return this.request("GET", `/assets?${qs}`);
  }
  async deleteAsset(id) {
    return this.request("DELETE", `/assets/${id}`);
  }
  async waitForAsset(id, options = {}) {
    const interval = options.pollInterval ?? 1e4;
    const timeout = options.timeout ?? 3e5;
    const start = Date.now();
    while (true) {
      const data = await this.getAsset(id);
      const asset = data.asset || data;
      const status = asset.status;
      options.onPoll?.(asset);
      if (status === "active") return asset;
      if (status === "failed") {
        throw new ApiError(400, asset, `Asset ${id} failed: ${asset.error_message || "unknown error"}`);
      }
      if (Date.now() - start > timeout) {
        throw new Error(`Asset ${id} timed out after ${timeout / 1e3}s (status: ${status})`);
      }
      await new Promise((r) => setTimeout(r, interval));
    }
  }
  // ---- Asset Group ----
  async createAssetGroup(name) {
    return this.request("POST", "/asset-groups", { name });
  }
  async listAssetGroups() {
    return this.request("GET", "/asset-groups");
  }
};

// src/cli.ts
import { readFileSync, writeFileSync } from "fs";
import { join, extname, basename } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
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
var IMAGE_MODELS = /* @__PURE__ */ new Set(["gpt-image-2", "nano-banana-2", "nano-banana-pro", "midjourney-v7", "midjourney"]);

function createClient(baseUrlOverride) {
  loadEnv();
  const apiKey = process.env["RENOISE_API_KEY"];
  if (!apiKey) {
    console.error("Error: RENOISE_API_KEY is required for /api/public/v1.\nSet it via environment variable or .env file.");
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
  asset       Register materials as Ark assets (for face/character use)
  character   Browse available characters
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
  --prompt <text>             (required) Generation prompt
  --model <name>              Model name (default: renoise-2.0 / sd-2.0)
  --type <video|image>        Optional task type; must match model
  --duration <seconds>        Video duration (default: 5)
  --ratio <w:h>               Aspect ratio (default: 1:1)
  --resolution <1k|2k|4k|720p|1080p>
  --watermark                 Add watermark to video task (10% credit discount)
  --audio-generation <0|1>    Enable/disable model audio generation when supported
  --no-audio-generation       Disable model audio generation
  --template-id <id>          Create task from template
  --tags <a,b,c>              Comma-separated tags
  --materials <spec>          Material refs: "id:role" or "asset:id:role"; role required
  --characters <spec>         Character refs: "id1,id2" or "id1:role,id2:role"

Options for list:
  --status <status>           Filter by status
  --tag <tag>                 Filter by tag
  --type <video|image>        Filter by task type
  --provider <provider>       Filter by provider
  --ids <id1,id2>             Fetch specific task IDs
  --limit <n>                 Max results (default: 20)
  --offset <n>                Pagination offset

Options for wait:
  --interval <seconds>        Poll interval (default: 10)
  --timeout <seconds>         Timeout (default: 600)

Examples:
  renoise task generate --prompt "a cat dancing" --duration 5
  renoise task generate --prompt "cute cat" --model nano-banana-2 --resolution 2k
  renoise task generate --prompt "cinematic hero frame of a lone astronaut on Mars" --model nano-banana-pro --resolution 2k --ratio 16:9
  renoise task generate --prompt "hero product shot with bold typography" --model gpt-image-2 --resolution 2k --ratio 16:9
  renoise task generate --prompt "stylized fantasy portrait" --model midjourney-v7 --ratio 3:4
  renoise task create --prompt "epic scene" --duration 10 --ratio 16:9
  renoise task list --status completed --limit 5
  renoise task result 123
  renoise task wait 123 --interval 15
  renoise task chain 123      # downloads video result → uploads as material → prints material ID
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

Examples:
  renoise material list
  renoise material upload /path/to/image.jpg
  renoise material upload /path/to/video.mp4 --type video
`.trim();
var HELP_CHARACTER = `
renoise character \u2014 Manage characters

Commands:
  list                        List available characters
  get <id>                    Get character detail
  create <image> [options]    Create character from image (admin)
  grant <char_id> [user_id]   Grant character access (admin)

Options for list:
  --category <category>       Filter by category
  --usage_group <group>       Filter by usage group
  --search <keyword>          Search by name
  --page <n>                  Page number
  --page_size <n>             Page size

Options for create:
  --name <name>               Character name (required)
  --code <code>               Character code (default: auto from name)
  --gender <m/f>              Gender (default: m)
  --category <category>       Category (default: custom)
  --usage_group <group>       Usage group (default: custom)
  --asset_id <id>             Asset ID (default: custom_<timestamp>)

Examples:
  renoise character list
  renoise character get 3
  renoise character create ./portrait.png --name "Li Shande" --gender m
  renoise character grant 42
`.trim();
var HELP_ASSET = `
renoise asset \u2014 Register materials as Ark assets

Register uploaded images as Ark assets so they can be used as
reference_image in video generation WITHOUT triggering face/privacy
detection. This is the recommended way to use AI-generated character
images as consistent references across multiple video segments.

Commands:
  create <material_id>        Register a material as an asset
  register <material_id>      Alias for create + wait until active
  get <id>                    Get asset detail and status
  list                        List your assets
  wait <id>                   Wait for asset to become active
  delete <id>                 Soft-delete an asset

Options for create/register:
  --name <name>               Asset name (default: material filename)
  --group_id <id>             Asset group ID (default: auto)

Options for list:
  --status <status>           Filter by status (pending/processing/active/failed)
  --group_id <id>             Filter by group
  --limit <n>                 Max results (default: 50)
  --offset <n>                Pagination offset

Options for wait:
  --interval <seconds>        Poll interval (default: 10)
  --timeout <seconds>         Timeout (default: 300)

Workflow:
  1. Upload image:    renoise material upload portrait.png
  2. Register asset:  renoise asset register 3497 --name "Mei"
  3. Use in video:    renoise task generate --prompt "..." \\
                        --materials "asset:27:reference_image"

Once active, use in task materials as:
  --materials "asset:<asset_id>:reference_image"
`.trim();
var HELP_CREDIT = `
renoise credit \u2014 Balance and transactions

Commands:
  me                          Show current user info and balance
  estimate                    Estimate task cost
  history                     Show credit transaction history

Options for estimate:
  --model <name>              Model name
  --duration <seconds>        Duration
  --resolution <value>        Resolution variant (image: 1k/2k/4k; video: 720p/1080p)
  --hasVideoRef               Has video reference material
  --variant <variant>         Pricing variant override
  --watermark                 Apply video watermark discount

Options for history:
  --limit <n>                 Max results (default: 20)
  --offset <n>                Pagination offset

Examples:
  renoise credit me
  renoise credit estimate --model renoise-2.0 --duration 5
  renoise credit estimate --model gpt-image-2 --resolution 2k
  renoise credit history --limit 10
`.trim();
async function taskGenerate(client, flags) {
  if (!flags.prompt) {
    console.error("Error: --prompt is required.\n");
    console.log(HELP_TASK);
    process.exit(1);
  }
  const params = buildCreateParams(flags);
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
  if (!flags.prompt) {
    console.error("Error: --prompt is required.\n");
    console.log(HELP_TASK);
    process.exit(1);
  }
  const params = buildCreateParams(flags);
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
  const url = result.videoUrl || result.imageUrl;
  if (!url) {
    console.error(`Task #${id} has no video or image result.`);
    process.exit(1);
  }
  const isVideo = !!result.videoUrl;
  const ext = isVideo ? "mp4" : "png";
  const tmpPath = join(tmpdir(), `chain-${id}.${ext}`);
  // 2. Download
  console.log(`Downloading ${isVideo ? "video" : "image"} to ${tmpPath}...`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  const arrayBuf = await resp.arrayBuffer();
  writeFileSync(tmpPath, Buffer.from(arrayBuf));
  console.log(`Downloaded: ${(arrayBuf.byteLength / 1024 / 1024).toFixed(1)}MB`);
  // 3. Upload as material
  const type = isVideo ? "video" : "image";
  const buffer = readFileSync(tmpPath);
  const filename = `chain-${id}.${ext}`;
  console.log(`Uploading as ${type} material...`);
  const data = await client.uploadMaterial(buffer, filename, type);
  const matId = data.material?.id || data.id;
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
  console.log(`Uploading ${filename} (${type}, ${(buffer.byteLength / 1024).toFixed(1)}KB)...`);
  const data = await client.uploadMaterial(buffer, filename, type);
  if (data.action === "exists") {
    console.log(`Material already exists: #${data.material.id}`);
  } else {
    console.log(`Material uploaded: #${data.material.id}`);
  }
  json(data);
}
async function characterList(client, flags) {
  const data = await client.listCharacters({
    category: flags.category,
    usage_group: flags.usage_group,
    search: flags.search,
    page: flags.page ? parseInt(flags.page) : void 0,
    page_size: flags.page_size ? parseInt(flags.page_size) : void 0
  });
  console.log(`Found ${data.characters.length} character(s) (total: ${data.total}):
`);
  for (const ch of data.characters) {
    console.log(`  #${String(ch.id).padEnd(4)} ${ch.code.padEnd(5)} ${ch.name.padEnd(16)} ${ch.category.padEnd(8)} ${ch.usage_group}`);
  }
}
async function characterGet(client, positional) {
  const id = parseInt(positional[0]);
  if (!id) {
    console.error("Error: character ID required.\nUsage: renoise character get <id>");
    process.exit(1);
  }
  json(await client.getCharacter(id));
}
async function characterCreate(client, positional, flags) {
  const imagePath = positional[0];
  if (!imagePath) {
    console.error("Error: image path required.\nUsage: renoise character create <image> --name <name>");
    process.exit(1);
  }
  if (!flags.name) {
    console.error("Error: --name is required.");
    process.exit(1);
  }
  const fs = await import("fs");
  const path = await import("path");
  if (!fs.existsSync(imagePath)) {
    console.error(`Error: file not found: ${imagePath}`);
    process.exit(1);
  }
  const code = flags.code || flags.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const gender = flags.gender || "m";
  const category = flags.category || "custom";
  const usageGroup = flags.usage_group || "custom";
  const assetId = flags.asset_id || `custom_${Date.now()}`;

  // Step 1: import character record
  console.log(`Creating character "${flags.name}" (code: ${code})...`);
  const importResult = await client.importCharacters([{
    code, name: flags.name, gender, category,
    usage_group: usageGroup, asset_id: assetId,
  }]);
  console.log(`  Import: ${importResult.imported} created, ${importResult.skipped} skipped`);
  if (importResult.imported === 0) {
    console.error("  Character code may already exist. Try a different --code.");
    process.exit(1);
  }

  // Step 2: find the newly created character
  const listResult = await client.listCharacters({ search: code, page: 1, page_size: 5 });
  const char = listResult.characters.find(c => c.code === code);
  if (!char) {
    console.error("  Created but could not find character. Check admin panel.");
    process.exit(1);
  }
  console.log(`  Character ID: #${char.id}`);

  // Step 3: upload image
  const ext = path.extname(imagePath).toLowerCase();
  const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  console.log(`  Uploading image (${contentType})...`);
  const uploadInfo = await client.getCharacterImageUploadUrl(char.id, contentType);
  const fileBuffer = fs.readFileSync(imagePath);
  const uploadResp = await fetch(uploadInfo.upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: fileBuffer,
  });
  if (!uploadResp.ok) {
    console.error(`  Image upload failed: ${uploadResp.status} ${uploadResp.statusText}`);
    process.exit(1);
  }
  console.log(`  Image uploaded to: ${uploadInfo.storage_path}`);

  // Step 4: grant access to current user
  const me = await client.getMe();
  console.log(`  Granting access to user ${me.user.id}...`);
  try {
    await client.addCharacterGrant(me.user.id, "character", String(char.id));
    console.log(`  Access granted.`);
  } catch (e) {
    if (e.message && e.message.includes("already exists")) {
      console.log(`  Grant already exists.`);
    } else {
      console.log(`  Grant note: ${e.message} (may need 'all' grant)`);
    }
  }

  console.log(`\n✅ Character created: #${char.id} "${flags.name}"`);
  console.log(`   Use in video: --characters "${char.id}"`);
}
async function characterGrant(client, positional) {
  const charId = positional[0];
  if (!charId) {
    console.error("Error: character ID required.\nUsage: renoise character grant <char_id> [user_id]");
    process.exit(1);
  }
  const me = await client.getMe();
  const userId = positional[1] || me.user.id;
  console.log(`Granting character #${charId} to user ${userId}...`);
  const result = await client.addCharacterGrant(userId, "character", String(charId));
  json(result);
}
// ── Asset commands ──
async function assetCreate(client, positional, flags) {
  const materialId = parseInt(positional[0]);
  if (!materialId) {
    console.error("Error: material ID required.\nUsage: renoise asset create <material_id> [--name <name>]");
    process.exit(1);
  }
  const params = { materialId };
  if (flags.name) params.name = flags.name;
  if (flags.group_id) params.groupId = parseInt(flags.group_id);
  console.log(`Creating asset from material #${materialId}...`);
  const data = await client.createAsset(params);
  console.log(`Asset created: #${data.id} (${data.status})`);
  json(data);
}
async function assetRegister(client, positional, flags) {
  const materialId = parseInt(positional[0]);
  if (!materialId) {
    console.error("Error: material ID required.\nUsage: renoise asset register <material_id> [--name <name>]");
    process.exit(1);
  }
  const params = { materialId };
  if (flags.name) params.name = flags.name;
  if (flags.group_id) params.groupId = parseInt(flags.group_id);
  console.log(`Creating asset from material #${materialId}...`);
  const data = await client.createAsset(params);
  console.log(`Asset #${data.id} created (${data.status}). Waiting for activation...`);
  const interval = (flags.interval ? parseInt(flags.interval) : 10) * 1e3;
  const timeout = (flags.timeout ? parseInt(flags.timeout) : 300) * 1e3;
  try {
    const asset = await client.waitForAsset(data.id, {
      pollInterval: interval,
      timeout,
      onPoll: (a) => {
        console.log(`  [${new Date().toLocaleTimeString()}] ${a.status}${a.ark_asset_id ? " (ark: " + a.ark_asset_id + ")" : ""}`);
      }
    });
    console.log(`\n\u2705 Asset #${asset.id} is active!`);
    console.log(`   Ark Asset ID: ${asset.ark_asset_id}`);
    console.log(`   Use in video: --materials "asset:${asset.id}:reference_image"`);
    json({ asset });
  } catch (e) {
    console.error(`\n\u274C ${e.message}`);
    process.exit(1);
  }
}
async function assetGet(client, positional) {
  const id = parseInt(positional[0]);
  if (!id) {
    console.error("Error: asset ID required.\nUsage: renoise asset get <id>");
    process.exit(1);
  }
  json(await client.getAsset(id));
}
async function assetList(client, flags) {
  const data = await client.listAssets({
    groupId: flags.group_id ? parseInt(flags.group_id) : void 0,
    status: flags.status,
    limit: flags.limit ? parseInt(flags.limit) : 50,
    offset: flags.offset ? parseInt(flags.offset) : 0
  });
  console.log(`Found ${data.assets.length} asset(s):\n`);
  for (const a of data.assets) {
    const arkId = a.ark_asset_id ? ` ark:${a.ark_asset_id}` : "";
    console.log(`  #${String(a.id).padEnd(4)} ${a.status.padEnd(12)} ${a.name}${arkId}`);
  }
}
async function assetWait(client, positional, flags) {
  const id = parseInt(positional[0]);
  if (!id) {
    console.error("Error: asset ID required.\nUsage: renoise asset wait <id>");
    process.exit(1);
  }
  const interval = (flags.interval ? parseInt(flags.interval) : 10) * 1e3;
  const timeout = (flags.timeout ? parseInt(flags.timeout) : 300) * 1e3;
  console.log(`Waiting for asset #${id} (poll every ${interval / 1e3}s, timeout ${timeout / 1e3}s)...`);
  try {
    const asset = await client.waitForAsset(id, {
      pollInterval: interval,
      timeout,
      onPoll: (a) => {
        console.log(`  [${new Date().toLocaleTimeString()}] ${a.status}`);
      }
    });
    console.log(`\n\u2705 Asset #${asset.id} is active!`);
    json({ asset });
  } catch (e) {
    console.error(`\n\u274C ${e.message}`);
    process.exit(1);
  }
}
async function assetDelete(client, positional) {
  const id = parseInt(positional[0]);
  if (!id) {
    console.error("Error: asset ID required.\nUsage: renoise asset delete <id>");
    process.exit(1);
  }
  await client.deleteAsset(id);
  console.log(`Asset #${id} deleted.`);
}
async function creditMe(client) {
  json(await client.getMe());
}
async function creditEstimate(client, flags) {
  const variant = !flags.variant && flags.model && IMAGE_MODELS.has(flags.model) && flags.resolution
    ? flags.resolution
    : flags.variant;
  json(await client.estimateCost({
    model: flags.model,
    duration: flags.duration ? parseInt(flags.duration) : void 0,
    resolution: flags.resolution,
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
  if (flags.model) params.model = flags.model;
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
  const allMaterials = [];
  if (flags.materials) {
    for (const m of flags.materials.split(",")) {
      const parts = m.trim().split(":");
      if (parts[0] === "asset") {
        // asset:ID:role format
        const assetId = parseInt(parts[1]);
        const role = parts[2];
        if (!role) throw new Error(`Material role is required for --materials entry '${m}'. Use asset:id:role, e.g. asset:27:reference_image`);
        allMaterials.push({ user_asset_id: assetId, role });
      } else {
        const [id, role] = parts;
        if (!role) throw new Error(`Material role is required for --materials entry '${m}'. Use id:role, e.g. 123:ref_image`);
        allMaterials.push({ id: parseInt(id), role });
      }
    }
  }
  if (flags.characters) {
    for (const m of flags.characters.split(",")) {
      const trimmed = m.trim();
      const parts = trimmed.split(":");
      const charId = parseInt(parts[0]);
      const role = parts[1] || "reference_image";
      allMaterials.push({ character_id: charId, role });
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
  if (result.resolutions && Object.keys(result.resolutions).length) {
    console.log(`  Resolutions: ${Object.keys(result.resolutions).join(", ")}`);
  }
  if (result.warning) console.log(`  Warning: ${result.warning}`);
  json(result);
}
var DOMAIN_HELP = {
  task: HELP_TASK,
  material: HELP_MATERIAL,
  asset: HELP_ASSET,
  character: HELP_CHARACTER,
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
      case "asset":
        switch (action) {
          case "create":
            await assetCreate(client, subPositional, flags);
            break;
          case "register":
            await assetRegister(client, subPositional, flags);
            break;
          case "get":
            await assetGet(client, subPositional);
            break;
          case "list":
            await assetList(client, flags);
            break;
          case "wait":
            await assetWait(client, subPositional, flags);
            break;
          case "delete":
            await assetDelete(client, subPositional);
            break;
          default:
            console.error(`Unknown asset action: ${action}
`);
            console.log(HELP_ASSET);
            process.exit(1);
        }
        break;
      case "character":
        switch (action) {
          case "list":
            await characterList(client, flags);
            break;
          case "get":
            await characterGet(client, subPositional);
            break;
          case "create":
            await characterCreate(client, subPositional, flags);
            break;
          case "grant":
            await characterGrant(client, subPositional);
            break;
          default:
            console.error(`Unknown character action: ${action}
`);
            console.log(HELP_CHARACTER);
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
