import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import {
  RenoiseMaterialReferenceSchema,
  type RenoiseMaterialReference,
} from "../../shared/document-schema.js";
import { WhiteboardError } from "../../shared/errors.js";

const execFileAsync = promisify(execFile);
const CLI_TIMEOUT_MS = 15_000;
const CLI_MAX_BUFFER = 4 * 1024 * 1024;
const PREVIEW_CACHE_TTL_MS = 30_000;
const PREVIEW_CACHE_MAX = 100;
export const RENOISE_MATERIAL_RESOURCE_DOMAIN = "https://asset.renoise.ai";

const CliMaterialSchema = z.object({
  id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
  name: z.string().trim().min(1).max(255),
  // The account material endpoint can legitimately mix audio into an
  // unfiltered page. The visual editor only exposes image/video references,
  // but rejecting the whole envelope because one audio row is present makes
  // the material library appear completely empty.
  type: z.enum(["image", "video", "audio"]),
  mimeType: z.string().trim().min(1).max(127),
  url: z.string().url(),
}).passthrough();

const CliMaterialResponseSchema = z.object({
  materials: z.array(CliMaterialSchema).max(500),
}).passthrough();

export type ResolvedRenoiseMaterial = RenoiseMaterialReference & { url: string };
export type MaterialListInput = {
  search?: string;
  type?: "image" | "video";
  limit: number;
  offset: number;
};

export function trustedRenoiseMaterialPreviewUrl(material: ResolvedRenoiseMaterial) {
  try {
    const url = new URL(material.url);
    return url.protocol === "https:" && url.origin === RENOISE_MATERIAL_RESOURCE_DOMAIN
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function defaultCliCandidates() {
  const configured = process.env.RENOISE_CLI_PATH?.trim();
  if (configured) return [configured];
  // Desktop MCP processes do not necessarily inherit the interactive shell's
  // PATH. Keep the normal PATH lookup first, then cover the standard install
  // locations used by the Renoise setup skill on macOS and Linux.
  return [
    "renoise",
    "/opt/homebrew/bin/renoise",
    "/usr/local/bin/renoise",
    join(homedir(), ".local", "bin", "renoise"),
  ];
}

export class RenoiseMaterialLibrary {
  private readonly previewCache = new Map<number, { material: ResolvedRenoiseMaterial; expiresAt: number }>();
  private readonly previewTtlMs: number;
  private readonly previewCacheMax: number;
  private readonly now: () => number;

  constructor(
    cliPath: string | readonly string[] = defaultCliCandidates(),
    options: { previewTtlMs?: number; previewCacheMax?: number; now?: () => number } = {},
  ) {
    this.cliPaths = typeof cliPath === "string" ? [cliPath] : [...cliPath];
    this.previewTtlMs = options.previewTtlMs ?? PREVIEW_CACHE_TTL_MS;
    this.previewCacheMax = options.previewCacheMax ?? PREVIEW_CACHE_MAX;
    this.now = options.now ?? Date.now;
  }

  private readonly cliPaths: string[];

  private cachePreviewMaterials(materials: ResolvedRenoiseMaterial[]) {
    const now = this.now();
    for (const [id, entry] of this.previewCache) {
      if (entry.expiresAt <= now) this.previewCache.delete(id);
    }
    for (const material of materials) {
      this.previewCache.delete(material.materialId);
      this.previewCache.set(material.materialId, { material, expiresAt: now + this.previewTtlMs });
    }
    while (this.previewCache.size > this.previewCacheMax) {
      const oldest = this.previewCache.keys().next().value as number | undefined;
      if (oldest === undefined) break;
      this.previewCache.delete(oldest);
    }
  }

  private async execute(args: string[]): Promise<{ materials: ResolvedRenoiseMaterial[]; returnedCount: number }> {
    let stdout: string | undefined;
    let lastMissingError: unknown;
    for (const [index, cliPath] of this.cliPaths.entries()) {
      try {
        ({ stdout } = await execFileAsync(cliPath, args, {
          encoding: "utf8",
          timeout: CLI_TIMEOUT_MS,
          maxBuffer: CLI_MAX_BUFFER,
          windowsHide: true,
          shell: false,
        }));
        break;
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
        if (code === "ENOENT" && index < this.cliPaths.length - 1) {
          lastMissingError = error;
          continue;
        }
        const message = error instanceof Error ? error.message : String(error);
        throw new WhiteboardError("INTERNAL", `Renoise material command failed (${cliPath}): ${message}`);
      }
    }
    if (stdout === undefined) {
      const message = lastMissingError instanceof Error ? lastMissingError.message : String(lastMissingError ?? "not found");
      throw new WhiteboardError("INTERNAL", `Renoise CLI was not found in any supported install location: ${message}`);
    }
    let json: unknown;
    try {
      json = JSON.parse(stdout);
    } catch {
      throw new WhiteboardError("INTERNAL", "Renoise material command returned invalid JSON");
    }
    const parsed = CliMaterialResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new WhiteboardError("INTERNAL", `Renoise material response is invalid: ${parsed.error.message}`);
    }
    return {
      returnedCount: parsed.data.materials.length,
      materials: parsed.data.materials
        .filter((material): material is typeof material & { type: "image" | "video" } => material.type !== "audio")
        .map((material) => ({
          ...RenoiseMaterialReferenceSchema.parse({
            materialId: material.id,
            name: material.name,
            type: material.type,
            mimeType: material.mimeType,
          }),
          url: material.url,
        })),
    };
  }

  async list(input: MaterialListInput) {
    const args = ["material", "--json", "--limit", String(input.limit), "--offset", String(input.offset)];
    if (input.search) args.push("--search", input.search);
    if (input.type) args.push("--type", input.type);
    const { materials, returnedCount } = await this.execute(args);
    this.cachePreviewMaterials(materials);
    return { materials, hasMore: returnedCount === input.limit };
  }

  async preview(materialId: number) {
    if (!Number.isSafeInteger(materialId) || materialId <= 0) {
      throw new WhiteboardError("INVALID_MEDIA", "Material ID must be a positive integer");
    }
    const cached = this.previewCache.get(materialId);
    if (cached && cached.expiresAt > this.now()) return cached.material;
    if (cached) this.previewCache.delete(materialId);
    const { materials } = await this.execute(["material", "--json", "--ids", String(materialId)]);
    const material = materials.find((candidate) => candidate.materialId === materialId);
    if (!material) throw new WhiteboardError("ASSET_NOT_FOUND", `Renoise material ${materialId} does not exist`);
    this.cachePreviewMaterials([material]);
    return material;
  }

  async resolve(materialIds: number[]) {
    const ids = [...new Set(materialIds)];
    if (!ids.length) return [];
    if (ids.length > 20 || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      throw new WhiteboardError("INVALID_MEDIA", "Material IDs must be 1-20 positive integers");
    }
    const { materials } = await this.execute(["material", "--json", "--ids", ids.join(",")]);
    const byId = new Map(materials.map((material) => [material.materialId, material]));
    return ids.map((id) => {
      const material = byId.get(id);
      if (!material) throw new WhiteboardError("ASSET_NOT_FOUND", `Renoise material ${id} does not exist`);
      return material;
    });
  }
}
