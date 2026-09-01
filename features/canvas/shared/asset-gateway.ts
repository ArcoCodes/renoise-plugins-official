import { z } from "zod";
import { IdSchema } from "./document-schema.js";

export const AssetGatewayDescriptorSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("loopback-http"),
  origin: z.string().url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  }, "Asset gateway must use an HTTP loopback origin"),
  canvasSessionId: IdSchema,
  accessToken: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.string().datetime(),
});

export type AssetGatewayDescriptor = z.infer<typeof AssetGatewayDescriptorSchema>;
export type AssetVariant = "canvas" | "original";
export type GatewayImportKind = "image" | "video";

function authorizedUrl(descriptor: AssetGatewayDescriptor, pathname: string) {
  const url = new URL(pathname, `${descriptor.origin}/`);
  url.searchParams.set("access_token", descriptor.accessToken);
  return url;
}

export function assetGatewayHealthUrl(descriptor: AssetGatewayDescriptor) {
  return authorizedUrl(descriptor, `/v1/health/${encodeURIComponent(descriptor.canvasSessionId)}`).toString();
}

export function assetGatewayMediaUrl(
  descriptor: AssetGatewayDescriptor,
  assetId: string,
  variant: AssetVariant = "original",
) {
  const parsedAssetId = IdSchema.parse(assetId);
  const url = authorizedUrl(
    descriptor,
    `/v1/assets/${encodeURIComponent(descriptor.canvasSessionId)}/${encodeURIComponent(parsedAssetId)}`,
  );
  if (variant === "canvas") url.searchParams.set("variant", "canvas");
  return url.toString();
}

export function assetGatewayMaterialUrl(descriptor: AssetGatewayDescriptor, materialId: number) {
  if (!Number.isSafeInteger(materialId) || materialId <= 0) throw new Error("Material ID must be a positive integer");
  return authorizedUrl(descriptor, `/v1/materials/${encodeURIComponent(descriptor.canvasSessionId)}/${materialId}`).toString();
}

export function assetGatewayImportUrl(
  descriptor: AssetGatewayDescriptor,
  kind: GatewayImportKind,
  metadata: {
    expectedRevision: number;
    fileName: string;
    byteLength: number;
    requestId: string;
    width?: number;
    height?: number;
    durationMs?: number;
    createPlaybackProxy?: boolean;
  },
) {
  const url = authorizedUrl(
    descriptor,
    `/v1/imports/${encodeURIComponent(descriptor.canvasSessionId)}/${kind}`,
  );
  url.searchParams.set("expectedRevision", String(metadata.expectedRevision));
  url.searchParams.set("fileName", metadata.fileName);
  url.searchParams.set("byteLength", String(metadata.byteLength));
  url.searchParams.set("requestId", metadata.requestId);
  if (metadata.width !== undefined) url.searchParams.set("width", String(metadata.width));
  if (metadata.height !== undefined) url.searchParams.set("height", String(metadata.height));
  if (metadata.durationMs !== undefined) url.searchParams.set("durationMs", String(metadata.durationMs));
  if (metadata.createPlaybackProxy) url.searchParams.set("createPlaybackProxy", "1");
  return url.toString();
}
