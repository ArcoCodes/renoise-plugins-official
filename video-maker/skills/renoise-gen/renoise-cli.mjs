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
  authToken;
  constructor(config) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.authToken = config.authToken;
  }
  buildAuthHeaders() {
    const headers = {};
    if (this.apiKey) headers["X-API-Key"] = this.apiKey;
    if (this.authToken) headers["Authorization"] = `Bearer ${this.authToken}`;
    return headers;
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
    if (params.hasVideoRef) qs.set("hasVideoRef", "1");
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
};

// src/cli.ts
import { readFileSync } from "fs";
import { join, extname, basename } from "path";
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
function createClient() {
  loadEnv();
  const apiKey = process.env["RENOISE_API_KEY"];
  const authToken = process.env["RENOISE_AUTH_TOKEN"];
  if (!apiKey && !authToken) {
    console.error("Error: RENOISE_API_KEY or RENOISE_AUTH_TOKEN is required.\nSet one via environment variable or .env file.");
    process.exit(1);
  }
  return new RenoiseClient({
    baseUrl: env("RENOISE_BASE_URL", "https://www.renoise.ai/api/public/v1"),
    apiKey,
    authToken
  });
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
  character   Browse available characters
  credit      Check balance and transaction history

Environment:
  RENOISE_API_KEY     API key (starts with fk_), sent as X-API-Key
  RENOISE_AUTH_TOKEN  Auth token, sent as Authorization: Bearer
                      (at least one of API_KEY or AUTH_TOKEN required)
  RENOISE_BASE_URL    (optional) Full API base URL (including path)
                      Default: https://www.renoise.ai/api/public/v1

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
  tags                        List all your tags
  tag <id> --tags a,b,c       Update tags on a task

Options for generate/create:
  --prompt <text>             (required) Generation prompt
  --model <name>              Model name (default: renoise-2.0)
  --duration <seconds>        Video duration (default: 5)
  --ratio <w:h>               Aspect ratio (default: 1:1)
  --resolution <1k|2k>        Image resolution (for image models)
  --tags <a,b,c>              Comma-separated tags
  --materials <spec>          Material refs: "id:role" or "id1:role1,id2:role2"
  --characters <spec>         Character refs: "id1,id2" or "id1:role,id2:role"

Options for list:
  --status <status>           Filter by status
  --tag <tag>                 Filter by tag
  --limit <n>                 Max results (default: 20)
  --offset <n>                Pagination offset

Options for wait:
  --interval <seconds>        Poll interval (default: 10)
  --timeout <seconds>         Timeout (default: 600)

Examples:
  renoise task generate --prompt "a cat dancing" --duration 5
  renoise task generate --prompt "cute cat" --model nano-banana-2
  renoise task create --prompt "epic scene" --duration 10 --ratio 16:9
  renoise task list --status completed --limit 5
  renoise task result 123
  renoise task wait 123 --interval 15
`.trim();
var HELP_MATERIAL = `
renoise material \u2014 Manage materials

Commands:
  list                        List your uploaded materials
  upload <file>               Upload a material (image or video)

Options for list:
  --type <image|video>        Filter by type
  --search <keyword>          Search by name
  --limit <n>                 Max results (default: 20)

Options for upload:
  --type <image|video>        Override auto-detected type

Examples:
  renoise material list
  renoise material upload /path/to/image.jpg
  renoise material upload /path/to/video.mp4 --type video
`.trim();
var HELP_CHARACTER = `
renoise character \u2014 Browse characters

Commands:
  list                        List available characters
  get <id>                    Get character detail

Options for list:
  --category <category>       Filter by category
  --usage_group <group>       Filter by usage group
  --search <keyword>          Search by name
  --page <n>                  Page number
  --page_size <n>             Page size

Examples:
  renoise character list
  renoise character list --category female --search Jasmine
  renoise character get 3
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
  --hasVideoRef               Has video reference material

Options for history:
  --limit <n>                 Max results (default: 20)
  --offset <n>                Pagination offset

Examples:
  renoise credit me
  renoise credit estimate --model renoise-2.0 --duration 5
  renoise credit history --limit 10
`.trim();
async function taskGenerate(client, flags) {
  if (!flags.prompt) {
    console.error("Error: --prompt is required.\n");
    console.log(HELP_TASK);
    process.exit(1);
  }
  const params = buildCreateParams(flags);
  console.log("Creating task...");
  const { task } = await client.createTask(params);
  console.log(`Task #${task.id} created (${task.status}). Waiting for completion...`);
  if (task.estimatedCredit) console.log(`Cost: ${task.estimatedCredit} credits`);
  const interval = (flags.interval ? parseInt(flags.interval) : 10) * 1e3;
  const timeout = (flags.timeout ? parseInt(flags.timeout) : 600) * 1e3;
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
    console.error("Error: file path required.\nUsage: renoise material upload <file> [--type image|video]");
    process.exit(1);
  }
  const ext = extname(filePath).toLowerCase();
  const videoExts = [".mp4", ".mov", ".avi", ".webm", ".mkv"];
  const type = flags.type || (videoExts.includes(ext) ? "video" : "image");
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
async function creditMe(client) {
  json(await client.getMe());
}
async function creditEstimate(client, flags) {
  json(await client.estimateCost({
    model: flags.model,
    duration: flags.duration ? parseInt(flags.duration) : void 0,
    hasVideoRef: flags.hasVideoRef === "true" || flags.hasVideoRef === "1"
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
  if (flags.duration) params.duration = parseInt(flags.duration);
  if (flags.ratio) params.ratio = flags.ratio;
  if (flags.resolution) params.resolution = flags.resolution;
  if (flags.tags) params.tags = flags.tags.split(",").map((t) => t.trim());
  const allMaterials = [];
  if (flags.materials) {
    for (const m of flags.materials.split(",")) {
      const [id, role] = m.trim().split(":");
      allMaterials.push({ id: parseInt(id), role: role || "ref_video" });
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
  const client = createClient();
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
      case "character":
        switch (action) {
          case "list":
            await characterList(client, flags);
            break;
          case "get":
            await characterGet(client, subPositional);
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
