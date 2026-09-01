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
      <section className="review-launcher-card" aria-label="Renoise Visual Edit">
        <div className="review-launcher-heading">
          <span className="review-launcher-mark" aria-hidden>R</span>
          <div>
            <h1>Renoise Visual Edit</h1>
            <p>Annotate revision intent on images or video frames</p>
          </div>
          {props.authorized && <span className="review-ready"><Check />Connected</span>}
        </div>
        <div className="review-project">
          <FolderLock />
          <code>{props.projectDir || "Waiting for project directory…"}</code>
        </div>
        {props.authorized ? (
          <div className="review-summary" aria-label="Annotation summary">
            <span><Image />{props.imageCount} images</span>
            <span><Video />{props.videoCount} videos</span>
            <span>{props.annotationCount} annotations</span>
          </div>
        ) : (
          <p className="review-permission">The project directory above will be approved before opening. No other directories will be accessed.</p>
        )}
        <button
          className="review-open-button"
          disabled={!props.connected || !props.projectDir}
          onClick={props.onOpen}
        >
          <Maximize2 />
          {props.authorized ? "Open visual editor" : "Approve and open visual editor"}
        </button>
        {props.error && <p className="inline-error">{props.error}</p>}
      </section>
    </main>
  );
}
