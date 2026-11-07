import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeCanvas } from "qrcode.react";

const QR_FG = "#0b0d14";
const QR_BG = "#f6eedb";

function IconQr() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 18v2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Builds share targets from the address the site is open on, so the QR always follows the live deployment. */
export function siteTargets(extra = []) {
  const origin = window.location.origin;
  return [
    { id: "tree", label: "Family tree", caption: "Sungkhar Tuanthu · Family tree", url: `${origin}/` },
    { id: "carelnak", label: "Carelnak", caption: "Carelnak · Family stories", url: `${origin}/carelnak` },
    ...extra,
  ];
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Renders a printable 1080×1350 card: title, QR on an ivory panel, and the link underneath. */
async function buildCard(qrCanvas, target) {
  await document.fonts?.ready;
  const W = 1080;
  const H = 1350;
  const card = document.createElement("canvas");
  card.width = W;
  card.height = H;
  const ctx = card.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#14161f");
  bg.addColorStop(1, "#07080c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.2, 0, 0, W * 0.2, 0, W * 0.9);
  glow.addColorStop(0, "rgba(212,180,90,0.22)");
  glow.addColorStop(1, "rgba(212,180,90,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(240,212,138,0.7)";
  ctx.lineWidth = 3;
  roundRect(ctx, 40, 40, W - 80, H - 80, 44);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#d4b45a";
  ctx.font = "600 30px Outfit, system-ui, sans-serif";
  ctx.fillText("SCAN TO OPEN", W / 2, 150);
  ctx.fillStyle = "#efe8d8";
  ctx.font = "600 78px 'Cormorant Garamond', Georgia, serif";
  ctx.fillText(target.caption.split(" · ")[0], W / 2, 245);
  ctx.fillStyle = "#b7b0a0";
  ctx.font = "400 34px Outfit, system-ui, sans-serif";
  ctx.fillText(target.caption.split(" · ")[1] || "", W / 2, 300);

  const panel = 720;
  const px = (W - panel) / 2;
  const py = 360;
  ctx.fillStyle = QR_BG;
  ctx.shadowColor = "rgba(212,180,90,0.45)";
  ctx.shadowBlur = 50;
  roundRect(ctx, px, py, panel, panel, 36);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.drawImage(qrCanvas, px + 40, py + 40, panel - 80, panel - 80);

  ctx.fillStyle = "#f0d48a";
  ctx.font = "500 36px Outfit, system-ui, sans-serif";
  ctx.fillText(target.url.replace(/^https?:\/\//, "").replace(/\/$/, ""), W / 2, py + panel + 110);
  ctx.fillStyle = "#b7b0a0";
  ctx.font = "italic 400 34px 'Cormorant Garamond', Georgia, serif";
  ctx.fillText("Sungkhar Tuanthu · a living family record", W / 2, H - 110);

  return card;
}

export function ShareQrModal({ targets, initialTarget, onClose }) {
  const [targetId, setTargetId] = useState(initialTarget || targets[0]?.id);
  const [status, setStatus] = useState("");
  const printRef = useRef(null);
  const target = targets.find((t) => t.id === targetId) || targets[0];
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!status) return undefined;
    const t = window.setTimeout(() => setStatus(""), 2200);
    return () => window.clearTimeout(t);
  }, [status]);

  async function download() {
    const qr = printRef.current;
    if (!qr) return;
    const card = await buildCard(qr, target);
    const link = document.createElement("a");
    link.download = `sungkhar-${target.id}-qr.png`;
    link.href = card.toDataURL("image/png");
    link.click();
    setStatus("QR code downloaded");
  }

  async function copy() {
    setStatus((await copyText(target.url)) ? "Link copied" : "Could not copy — press and hold the link");
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: target.caption, url: target.url });
    } catch {
      /* closed by the user */
    }
  }

  return createPortal(
    <div className="share-back" onClick={onClose} role="dialog" aria-modal="true" aria-label="Share via QR code">
      <div className="share-card" onClick={(e) => e.stopPropagation()}>
        <div className="share-head">
          <div>
            <p className="kicker">Share</p>
            <h2>Scan to open</h2>
          </div>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>

        {targets.length > 1 && (
          <div className="share-targets" role="tablist" aria-label="What to share">
            {targets.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === target.id}
                className={t.id === target.id ? "active" : ""}
                onClick={() => setTargetId(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="share-qr">
          <QRCodeCanvas
            value={target.url}
            size={232}
            level="M"
            marginSize={2}
            fgColor={QR_FG}
            bgColor={QR_BG}
            title={`QR code for ${target.url}`}
          />
        </div>
        <p className="share-caption">{target.caption}</p>
        <a className="share-url" href={target.url} target="_blank" rel="noopener">
          {target.url.replace(/^https?:\/\//, "")}
        </a>

        <div className="share-actions">
          <button type="button" className="btn gold" onClick={download}>
            Download QR code
          </button>
          <button type="button" className="btn ghost" onClick={copy}>
            Copy link
          </button>
          {canNativeShare && (
            <button type="button" className="btn ghost" onClick={nativeShare}>
              Share…
            </button>
          )}
        </div>
        <p className="share-status" aria-live="polite">
          {status}
        </p>

        <div className="share-print" aria-hidden="true">
          <QRCodeCanvas ref={printRef} value={target.url} size={640} level="M" marginSize={1} fgColor={QR_FG} bgColor={QR_BG} />
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ShareQrButton({ targets, initialTarget, label = "Share" }) {
  const [open, setOpen] = useState(false);
  const list = useMemo(() => targets || siteTargets(), [targets]);
  return (
    <>
      <button type="button" className="btn ghost share-btn" onClick={() => setOpen(true)} aria-label="Share via QR code">
        <IconQr />
        <span>{label}</span>
      </button>
      {open && <ShareQrModal targets={list} initialTarget={initialTarget} onClose={() => setOpen(false)} />}
    </>
  );
}
