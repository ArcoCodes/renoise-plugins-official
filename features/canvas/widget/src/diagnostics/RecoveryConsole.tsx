import { ChevronDown, Copy, Download, RefreshCw, Trash2 } from "lucide-react";
import type { RecoveryDiagnosticEntry } from "./recovery-diagnostics.js";

const statusLabel = {
  info: "进行中",
  success: "完成",
  warning: "降级",
  error: "失败",
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
        aria-label="打开恢复诊断控制台"
        onClick={() => onOpenChange(true)}
      >
        <span className="recovery-status-dot" aria-hidden />
        <span>恢复控制台</span>
        {latest ? <small>{latest.stage}</small> : null}
      </button>
    );
  }

  return (
    <section className="recovery-console" aria-label="恢复诊断控制台">
      <header>
        <div>
          <strong>恢复诊断</strong>
          <span>{entries.length ? `${entries.length} 条事件` : "等待恢复事件"}</span>
        </div>
        <div className="recovery-console-actions">
          <button className="recovery-console-labeled-action" type="button" onClick={copy} aria-label="复制恢复日志" title="复制日志"><Copy /><span>复制</span></button>
          <button className="recovery-console-labeled-action" type="button" onClick={download} aria-label="下载恢复日志 JSON" title="下载 JSON"><Download /><span>下载</span></button>
          <button type="button" onClick={onClear} aria-label="清空恢复日志" title="清空日志"><Trash2 /></button>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="折叠恢复控制台" title="折叠"><ChevronDown /></button>
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
        )) : <p className="recovery-console-empty">尚无诊断事件</p>}
      </div>
      <footer>
        <button type="button" onClick={onForceRecovery}><RefreshCw />重新读取状态和素材</button>
        <span>会跳过本地媒体通道，直接验证项目文件读取。</span>
      </footer>
    </section>
  );
}
