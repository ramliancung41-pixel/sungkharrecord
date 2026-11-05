export function IconBtn({ label, danger = false, onClick, children }) {
  return (
    <button
      type="button"
      className={`icon-btn ${danger ? "danger" : ""}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function IconPencil() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
      <path
        d="M4 20h4l10.2-10.2a1.6 1.6 0 0 0 0-2.3L16.5 5.8a1.6 1.6 0 0 0-2.3 0L4 16v4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="m13.6 6.4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconNote() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
      <path
        d="M7 4.5h7.2L19 9.2V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V6A1.5 1.5 0 0 1 7.5 4.5H7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M14 4.8V9h4.4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 13h6M9 16.5h4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconDove({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <path
        d="M3.5 14c2.3.2 4.1-.4 5.6-1.9 1.7-1.7 3-4.2 6.2-4.8 1.6-.3 2.9.3 3.6 1.3l1.6-.4-1.1 1.4c0 3.7-2.7 6.8-7 7.3-2.5.3-4.7-.3-6.4-1.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.8 11.7c-.8-2.7 0-5.4 2.3-7.4 1.1 2.2 1.2 4.4.5 6.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m6.4 16.8-2.3 2.9M8.6 17.4l-1.2 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="17.3" cy="9.4" r="0.7" fill="currentColor" />
    </svg>
  );
}

export function IconFlower({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      {[0, 72, 144, 216, 288].map((deg) => (
        <path
          key={deg}
          d="M12 8.1c-1.5-1.5-1.4-3.6 0-4.8 1.4 1.2 1.5 3.3 0 4.8Z"
          transform={`rotate(${deg} 12 10)`}
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      ))}
      <circle cx="12" cy="10" r="1.5" fill="currentColor" />
      <path d="M12 11.9v8.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M12 17.2c1.5-1.7 3.3-2 4.6-1.4-1 1.6-2.7 2.1-4.6 1.4Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
      <path d="M5 7h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M10 4h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M7 7l.8 12.2A1.5 1.5 0 0 0 9.3 20.5h5.4a1.5 1.5 0 0 0 1.5-1.3L17 7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
