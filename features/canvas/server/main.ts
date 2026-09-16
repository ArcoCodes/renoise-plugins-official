import { readFile } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { SessionStore } from "./session/session-store.js";
import { ProjectStore } from "./storage/project-store.js";
import { MediaGateway } from "./media/media-gateway.js";
import { registerWhiteboardTools } from "./tools/register-tools.js";
import { WHITEBOARD_RESOURCE_URI } from "./resource-uri.js";
import {
  RENOISE_MATERIAL_RESOURCE_DOMAIN,
  RenoiseMaterialLibrary,
} from "./renoise/material-library.js";

const server = new McpServer({ name: "renoise-whiteboard", version: "1.0.0" });
const sessions = new SessionStore();
const store = new ProjectStore();
const materials = new RenoiseMaterialLibrary();
const mediaGateway = await MediaGateway.start(sessions, store, materials);
const renoiseIcon = `data:image/svg+xml;base64,${Buffer.from(
  await readFile(new URL("../../../assets/icon.svg", import.meta.url)),
).toString("base64")}`;

registerAppResource(server, "Renoise Visual Edit", WHITEBOARD_RESOURCE_URI, {
  title: "Renoise Visual Edit",
  description: "Renoise image and video-frame visual editor for structured revision requests",
  icons: [{ src: renoiseIcon, mimeType: "image/svg+xml", sizes: ["256x256"] }],
}, async () => ({
  contents: [{
    uri: WHITEBOARD_RESOURCE_URI,
    mimeType: RESOURCE_MIME_TYPE,
    text: await readFile(new URL("./widget.html", import.meta.url), "utf8"),
    _meta: {
      ui: {
        csp: {
          // Codex can block the loopback gateway and force the widget to read
          // video bytes through MCP. That fallback creates an in-frame Blob
          // URL, so media-src must explicitly allow the blob scheme.
          resourceDomains: [mediaGateway.origin, "blob:", RENOISE_MATERIAL_RESOURCE_DOMAIN],
          connectDomains: [mediaGateway.origin],
        },
        prefersBorder: false,
      },
    },
  }],
}));

registerWhiteboardTools(server, sessions, store, mediaGateway, materials);

const transport = new StdioServerTransport();
await server.connect(transport);
