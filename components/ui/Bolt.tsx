export function Bolt() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="bolt-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff9ec9" />
          <stop offset="1" stopColor="#b79cff" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="11" fill="url(#bolt-bg)" />
      <path d="M18 5 9 17.5h5.5L13 27l10-13h-6z" fill="#fff6d6" stroke="#fff6d6" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="10" cy="22" r="1.3" fill="#fff6d6" opacity="0.8" />
      <circle cx="24" cy="9" r="1.1" fill="#fff6d6" opacity="0.8" />
    </svg>
  );
}
