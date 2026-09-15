const OMIT = Symbol("omit-mcp-argument");

function jsonSafeValue(value: unknown): unknown | typeof OMIT {
  if (value === undefined) return OMIT;
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    return value.map((entry) => {
      const safe = jsonSafeValue(entry);
      return safe === OMIT ? null : safe;
    });
  }
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => {
      const safe = jsonSafeValue(entry);
      return safe === OMIT ? [] : [[key, safe]];
    }));
  }
  throw new TypeError(`Unsupported MCP argument value: ${typeof value}`);
}

/**
 * MCP Apps crosses a postMessage -> JSON-RPC boundary. Keep optional values out
 * of the posted object instead of relying on a later JSON.stringify to omit
 * them; some desktop hosts validate the structured-cloned value first.
 */
export function jsonSafeMcpArguments(args: Record<string, unknown>) {
  return jsonSafeValue(args) as Record<string, unknown>;
}
