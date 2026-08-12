import { Check, FolderLock, Image, Maximize2, Video } from "lucide-react";

export function ReviewLauncher(props: {
  authorized: boolean;
  connected: boolean;
  projectDir: string;
  imageCount: number;
  videoCount: number;
  annotationCount: number;
  error: string;
  onOpen: () => void;
}) {
  return (
    <main className="review-launcher">
      <section className="review-launcher-card" aria-label="Renoise 标注板">
        <div className="review-launcher-heading">
          <span className="review-launcher-mark" aria-hidden>R</span>
          <div>
            <h1>Renoise 标注板</h1>
            <p>在图片或视频帧上标注修改意图</p>
          </div>
          {props.authorized && <span className="review-ready"><Check />已连接</span>}
        </div>
        <div className="review-project">
          <FolderLock />
          <code>{props.projectDir || "等待项目目录…"}</code>
        </div>
        {props.authorized ? (
          <div className="review-summary" aria-label="标注内容统计">
            <span><Image />{props.imageCount} 图片</span>
            <span><Video />{props.videoCount} 视频</span>
            <span>{props.annotationCount} 组批注</span>
          </div>
        ) : (
          <p className="review-permission">打开前将批准上方项目目录；不会访问其他目录。</p>
        )}
        <button
          className="review-open-button"
          disabled={!props.connected || !props.projectDir}
          onClick={props.onOpen}
        >
          <Maximize2 />
          {props.authorized ? "打开标注板" : "批准并打开标注板"}
        </button>
        {props.error && <p className="inline-error">{props.error}</p>}
      </section>
    </main>
  );
}
