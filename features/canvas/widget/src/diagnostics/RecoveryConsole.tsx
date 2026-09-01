import { ChevronDown, Copy, Download, RefreshCw, Trash2 } from "lucide-react";
import type { RecoveryDiagnosticEntry } from "./recovery-diagnostics.js";

const statusLabel = {
  info: "In progress",
  success: "Complete",
  warning: "Fallback",
  error: "Failed",
} as const;

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(timestamp);
}

export function RecoveryConsole({
  entries,
  open,
  onOpenChange,
  onClear,
  onForceRecovery,
}: {
  entries: RecoveryDiagnosticEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClear: () => void;
  onForceRecovery: () => void;
}) {
  const latest = entries.at(-1);
  const copy = () => {
    const output = entries.map((entry) => [
      formatTimestamp(entry.occurredAt),
      statusLabel[entry.status ?? "info"],
      entry.stage,
      entry.message,
      entry.detail,
    ].filter(Boolean).join(" · ")).join("\n");
    void navigator.clipboard?.writeText(output).catch(() => undefined);
  };
  const download = () => {
    const payload = JSON.stringify({
      exportedAt: new Date().toISOString(),
      location: globalThis.location.href,
      userAgent: navigator.userAgent,
      entries,
    }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `renoise-whiteboard-recovery-${new Date().toISOString().replaceAll(":", "-")}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  if (!open) {
    return (
      <button
        type="button"
        className={`recovery-console-trigger ${latest?.status ?? "info"}`}
        aria-label="Open recovery diagnostics console"
        onClick={() => onOpenChange(true)}
      >
        <span className="recovery-status-dot" aria-hidden />
        <span>Recovery console</span>
        {latest ? <small>{latest.stage}</small> : null}
      </button>
    );
  }

  return (
    <section className="recovery-console" aria-label="Recovery diagnostics console">
      <header>
        <div>
          <strong>Recovery diagnostics</strong>
          <span>{entries.length ? `${entries.length} events` : "Waiting for recovery events"}</span>
        </div>
        <div className="recovery-console-actions">
          <button className="recovery-console-labeled-action" type="button" onClick={copy} aria-label="Copy recovery log" title="Copy log"><Copy /><span>Copy</span></button>
          <button className="recovery-console-labeled-action" type="button" onClick={download} aria-label="Download recovery log JSON" title="Download JSON"><Download /><span>Download</span></button>
          <button type="button" onClick={onClear} aria-label="Clear recovery log" title="Clear log"><Trash2 /></button>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Collapse recovery console" title="Collapse"><ChevronDown /></button>
        </div>
      </header>
      <div className="recovery-console-list" role="log" aria-live="polite">
        {entries.length ? entries.map((entry) => (
          <article className={`recovery-console-entry ${entry.status ?? "info"}`} key={entry.id}>
            <time>{formatTimestamp(entry.occurredAt)}</time>
            <span className="entry-status">{statusLabel[entry.status ?? "info"]}</span>
            <div>
              <strong>{entry.stage}</strong>
              <p>{entry.message}</p>
              {entry.detail ? <code>{entry.detail}</code> : null}
            </div>
          </article>
        )) : <p className="recovery-console-empty">No diagnostic events yet</p>}
      </div>
      <footer>
        <button type="button" onClick={onForceRecovery}><RefreshCw />Reread state and media</button>
        <span>Skips the local media channel and validates project-file reads directly.</span>
      </footer>
    </section>
  );
}
