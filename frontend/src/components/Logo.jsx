export default function Logo() {
  return (
    <span className="logo">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="var(--primary)" />
        <path d="M10 21c1 2 3 3 6 3 3.2 0 5-1.4 5-3.5 0-5-10-2.5-10-7.5 0-2.1 1.8-3.5 5-3.5 3 0 4.8 1 5.6 2.8" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span className="logo-text">SmartSpend</span>
    </span>
  );
}
