import MediaGallery from "./MediaGallery";

export default function MediaDrawer({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="media-back" onClick={onClose}>
      <aside className="media-panel glass" onClick={(e) => e.stopPropagation()}>
        <header className="media-head">
          <div>
            <p className="kicker">Gallery</p>
            <h2>Family media</h2>
            <p className="muted">
              View and play photos, videos, and audio. Managing links requires an Admin sign-in.
            </p>
          </div>
          <button className="btn ghost" type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <MediaGallery compact />
      </aside>
    </div>
  );
}
