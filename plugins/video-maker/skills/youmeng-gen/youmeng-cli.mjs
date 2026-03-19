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
    super(401, body, "Authentication failed \u2014 check your token");
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
var YoumengClient = class {
  baseUrl;
  token;
  constructor(config) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.token = config.token;
  }
  // ---- HTTP ----
  async request(method, path, body) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      Authorization: `Bearer ${this.token}`
    };
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
  // ---- User / Credit ----
  async getMe() {
    return this.request("GET", "/api/me");
  }
  async estimateCost(params) {
    const qs = new URLSearchParams();
    if (params.model) qs.set("model", params.model);
    if (params.duration) qs.set("duration", String(params.duration));
    if (params.hasVideoRef) qs.set("hasVideoRef", "1");
    return this.request("GET", `/api/credit/estimate?${qs}`);
  }
  async getCreditHistory(limit = 50, offset = 0) {
    return this.request("GET", `/api/credit/history?limit=${limit}&offset=${offset}`);
  }
  // ---- Task ----
  async createTask(params) {
    return this.request("POST", "/api/tasks", params);
  }
  async listTasks(params = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.tag) qs.set("tag", params.tag);
    qs.set("limit", String(params.limit ?? 50));
    qs.set("offset", String(params.offset ?? 0));
    return this.request("GET", `/api/tasks?${qs}`);
  }
  async getTask(id) {
    return this.request("GET", `/api/tasks/${id}`);
  }
  async getTaskResult(id) {
    return this.request("GET", `/api/tasks/${id}/result`);
  }
  async cancelTask(id) {
    return this.request("POST", `/api/tasks/${id}/cancel`);
  }
  async updateTags(id, tags) {
    return this.request("PATCH", `/api/tasks/${id}/tags`, { tags });
  }
  async listTags() {
    return this.request("GET", "/api/tags");
  }
  /**
   * Poll a task until it reaches a terminal state (completed/failed/cancelled).
   */
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
  // ---- Material ----
  async uploadMaterial(file, filename, type = "image") {
    const url = `${this.baseUrl}/api/materials/upload`;
    const form = new FormData();
    const blob = file instanceof Blob ? file : new Blob([file]);
    form.append("file", blob, filename);
    form.append("type", type);
    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
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
    return this.request("GET", `/api/materials?${qs}`);
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
  return new YoumengClient({
    baseUrl: env("YOUMENG_BASE_URL", "https://staging--ujgsvru36x4korjj10nq.edgespark.app"),
    token: env("YOUMENG_TOKEN")
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
YOUMENG CLI \u2014 Video generation task management

Usage:
  youmeng-cli.mjs <command> [options]

Commands:
  me                          Show current user info and credit balance
  estimate                    Estimate task cost before creating
  credit-history              Show credit transaction history

  create                      Create a new video generation task
  list                        List tasks with optional filters
  get <id>                    Get task detail by ID
  result <id>                 Get task result (video URL, cover URL)
  wait <id>                   Wait for task to complete (polling)
  cancel <id>                 Cancel a pending task (refunds credits)
  tags                        List all your tags
  tag <id> --tags a,b,c       Update tags on a task

  materials                   List your uploaded materials
  upload <file>               Upload a material (image or video)

  help                        Show this help message

Environment:
  YOUMENG_TOKEN      (required) Bearer token from browser login
  YOUMENG_BASE_URL   (optional) API base URL
                     Default: https://staging--ujgsvru36x4korjj10nq.edgespark.app

Examples:
  # Check balance
  node youmeng-cli.mjs me

  # Estimate cost for a 15s video
  node youmeng-cli.mjs estimate --model seedance-2.0 --duration 15

  # Create a task (default 15s with storyboard prompt)
  node youmeng-cli.mjs create --prompt "[0-5s] A cat sits on the moon. [5-12s] It starts dancing. [12-15s] Wide pull back."

  # Create with options
  node youmeng-cli.mjs create --prompt "a cat dancing" --model seedance-2.0 --duration 10 --ratio 16:9 --tags demo,test

  # Upload a material
  node youmeng-cli.mjs upload /path/to/image.jpg
  node youmeng-cli.mjs upload /path/to/video.mp4 --type video

  # Create with material reference
  node youmeng-cli.mjs create --prompt "make this dance" --materials "42:ref_video"

  # List completed tasks
  node youmeng-cli.mjs list --status completed --limit 10

  # Get result
  node youmeng-cli.mjs result 123

  # Wait for task to finish and get result
  node youmeng-cli.mjs wait 123 --interval 15 --timeout 300

  # Cancel a pending task
  node youmeng-cli.mjs cancel 123
`.trim();
var HELP_CREATE = `
Create a new video generation task.

Usage:
  youmeng-cli.mjs create --prompt <text> [options]

Options:
  --prompt <text>       (required) Video generation prompt
  --model <name>        Model name (default: seedance-2.0)
  --duration <seconds>  Video duration in seconds (default: 15)
  --ratio <w:h>         Aspect ratio (default: 1:1, options: 1:1, 16:9, 9:16)
  --tags <a,b,c>        Comma-separated tags
  --materials <spec>    Material references, format: "id:role" or "id1:role1,id2:role2"
                        Roles: ref_video, image1, image2, etc.

Examples:
  youmeng-cli.mjs create --prompt "[0-5s] Close-up of a cat on the moon. [5-12s] It dances, orbit camera. [12-15s] Wide pull back, frame holds."
  youmeng-cli.mjs create --prompt "[0-5s] ... [5-12s] ... [12-15s] ..." --ratio 16:9 --tags cinematic
  youmeng-cli.mjs create --prompt "dance like this" --materials "42:ref_video" --duration 5
`.trim();
var HELP_LIST = `
List tasks with optional filters.

Usage:
  youmeng-cli.mjs list [options]

Options:
  --status <status>     Filter by status: pending, running, completed, failed, cancelled
  --tag <tag>           Filter by tag
  --limit <n>           Max results (default: 20)
  --offset <n>          Pagination offset (default: 0)

Examples:
  youmeng-cli.mjs list
  youmeng-cli.mjs list --status completed --limit 5
  youmeng-cli.mjs list --tag demo
`.trim();
var HELP_WAIT = `
Wait for a task to complete by polling.

Usage:
  youmeng-cli.mjs wait <task-id> [options]

Options:
  --interval <seconds>  Poll interval in seconds (default: 10)
  --timeout <seconds>   Timeout in seconds (default: 600)

Examples:
  youmeng-cli.mjs wait 123
  youmeng-cli.mjs wait 123 --interval 15 --timeout 300
`.trim();
async function cmdMe(client) {
  const me = await client.getMe();
  json(me);
}
async function cmdEstimate(client, flags) {
  const est = await client.estimateCost({
    model: flags.model,
    duration: flags.duration ? parseInt(flags.duration) : void 0,
    hasVideoRef: flags.hasVideoRef === "true" || flags.hasVideoRef === "1"
  });
  json(est);
}
async function cmdCreditHistory(client, flags) {
  const limit = flags.limit ? parseInt(flags.limit) : 20;
  const offset = flags.offset ? parseInt(flags.offset) : 0;
  const data = await client.getCreditHistory(limit, offset);
  json(data);
}
async function cmdCreate(client, flags) {
  if (!flags.prompt) {
    console.error("Error: --prompt is required.\n");
    console.log(HELP_CREATE);
    process.exit(1);
  }
  const params = { prompt: flags.prompt };
  if (flags.model) params.model = flags.model;
  params.duration = flags.duration ? parseInt(flags.duration) : 15;
  if (flags.ratio) params.ratio = flags.ratio;
  if (flags.tags) params.tags = flags.tags.split(",").map((t) => t.trim());
  if (flags.materials) {
    params.materials = flags.materials.split(",").map((m) => {
      const [id, role] = m.trim().split(":");
      return { id: parseInt(id), role: role || "ref_video" };
    });
  }
  const data = await client.createTask(params);
  console.log(`Task created: id=${data.task.id}, status=${data.task.status}`);
  if (data.task.estimatedCredit) console.log(`Cost: ${data.task.estimatedCredit} credits`);
  json(data);
}
async function cmdList(client, flags) {
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
async function cmdGet(client, positional) {
  const id = parseInt(positional[0]);
  if (!id) {
    console.error("Error: task ID required.\nUsage: youmeng-cli.mjs get <id>");
    process.exit(1);
  }
  const data = await client.getTask(id);
  json(data);
}
async function cmdResult(client, positional) {
  const id = parseInt(positional[0]);
  if (!id) {
    console.error("Error: task ID required.\nUsage: youmeng-cli.mjs result <id>");
    process.exit(1);
  }
  const data = await client.getTaskResult(id);
  json(data);
}
async function cmdWait(client, positional, flags) {
  const id = parseInt(positional[0]);
  if (!id) {
    console.error("Error: task ID required.\nUsage: youmeng-cli.mjs wait <id>");
    process.exit(1);
  }
  const interval = (flags.interval ? parseInt(flags.interval) : 10) * 1e3;
  const timeout = (flags.timeout ? parseInt(flags.timeout) : 600) * 1e3;
  console.log(`Waiting for task #${id} (poll every ${interval / 1e3}s, timeout ${timeout / 1e3}s)...`);
  const result = await client.waitForTask(id, {
    pollInterval: interval,
    timeout,
    onPoll: (task) => {
      console.log(`  [${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] status: ${task.status}`);
    }
  });
  console.log("\nTask completed!");
  json(result);
}
async function cmdCancel(client, positional) {
  const id = parseInt(positional[0]);
  if (!id) {
    console.error("Error: task ID required.\nUsage: youmeng-cli.mjs cancel <id>");
    process.exit(1);
  }
  const data = await client.cancelTask(id);
  console.log(`Task #${id} cancelled.`);
  json(data);
}
async function cmdTags(client) {
  const data = await client.listTags();
  json(data);
}
async function cmdTag(client, positional, flags) {
  const id = parseInt(positional[0]);
  if (!id || !flags.tags) {
    console.error("Usage: youmeng-cli.mjs tag <id> --tags a,b,c");
    process.exit(1);
  }
  const tags = flags.tags.split(",").map((t) => t.trim());
  const data = await client.updateTags(id, tags);
  json(data);
}
async function cmdUpload(client, positional, flags) {
  const filePath = positional[0];
  if (!filePath) {
    console.error("Error: file path required.\nUsage: youmeng-cli.mjs upload <file> [--type image|video]");
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
async function cmdMaterials(client, flags) {
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
async function main() {
  const args = process.argv.slice(2);
  const { flags, positional } = parseArgs(args);
  const command = positional[0];
  const subPositional = positional.slice(1);
  if (!command || command === "help" || flags.help === "true" && !positional.length) {
    console.log(HELP);
    return;
  }
  if (flags.help === "true") {
    const helpMap = {
      create: HELP_CREATE,
      list: HELP_LIST,
      wait: HELP_WAIT
    };
    console.log(helpMap[command] || HELP);
    return;
  }
  const client = createClient();
  try {
    switch (command) {
      case "me":
        await cmdMe(client);
        break;
      case "estimate":
        await cmdEstimate(client, flags);
        break;
      case "credit-history":
        await cmdCreditHistory(client, flags);
        break;
      case "create":
        await cmdCreate(client, flags);
        break;
      case "list":
        await cmdList(client, flags);
        break;
      case "get":
        await cmdGet(client, subPositional);
        break;
      case "result":
        await cmdResult(client, subPositional);
        break;
      case "wait":
        await cmdWait(client, subPositional, flags);
        break;
      case "cancel":
        await cmdCancel(client, subPositional);
        break;
      case "tags":
        await cmdTags(client);
        break;
      case "tag":
        await cmdTag(client, subPositional, flags);
        break;
      case "materials":
        await cmdMaterials(client, flags);
        break;
      case "upload":
        await cmdUpload(client, subPositional, flags);
        break;
      default:
        console.error(`Unknown command: ${command}
`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (e) {
    if (e instanceof AuthError) {
      console.error(`Auth Error: ${e.message}`);
      console.error("Make sure YOUMENG_TOKEN is set correctly.");
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
