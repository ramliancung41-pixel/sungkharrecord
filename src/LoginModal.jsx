import { useState } from "react";

export default function LoginModal({ onClose, onLogin, onGoogle, configured }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run(action) {
    setBusy(true);
    setErr("");
    try {
      await action();
      onClose();
    } catch (ex) {
      setErr(ex.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <form
        className="modal glass"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => onLogin(email, password));
        }}
      >
        <p className="kicker">Restricted</p>
        <h2>Admin keeper</h2>
        <p className="muted">
          Sign in with an authorized Gmail. Only those keepers can add, edit, or delete. Everyone
          else stays read-only.
        </p>
        <button
          className="btn google"
          type="button"
          disabled={busy}
          onClick={() => run(onGoogle)}
        >
          <GoogleMark />
          {busy ? "Opening Google…" : "Sign in with Google"}
        </button>
        <div className="or-line" role="separator">
          <span>or email</span>
        </div>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {err && <p className="error">{err}</p>}
        {!configured && (
          <p className="hint">
            Firebase is not configured. Local keeper: <code>admin@sungkhar.local</code> /{" "}
            <code>SungkharAdmin</code>
          </p>
        )}
        <div className="row">
          <button className="btn gold" disabled={busy} type="submit">
            {busy ? "Signing in…" : "Enter"}
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.3 7.4 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.4c-.2-.7-.4-1.4-.4-2.4s.1-1.7.4-2.4V6.5H1.4C.5 8.3 0 10.1 0 12s.5 3.7 1.4 5.5l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.7 0 3.3.6 4.5 1.7l3.4-3.4C17.9 1.1 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"
      />
    </svg>
  );
}
