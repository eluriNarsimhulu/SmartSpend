import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import '../styles/auth-background.css';

const BACKGROUND_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_105406_16f4600d-7a92-4292-b96e-b19156c7830a.mp4';

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="auth-page auth-video-page">
      {/* Full-screen background video */}
      <video
        className="auth-background-video"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      >
        <source src={BACKGROUND_VIDEO} type="video/mp4" />
      </video>

      {/* Dark overlays */}
      <div className="auth-video-overlay" />
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />

      {/* Background decoration */}
      <div className="auth-grid-pattern" />

      {/* Top navigation */}
      <header className="auth-topbar">
        <Link to="/" className="auth-top-brand">
          <span className="auth-brand-icon">S</span>
          <span>SmartSpend</span>
        </Link>

        <Link to="/" className="auth-home-link">
          Back to home <span aria-hidden="true">↗</span>
        </Link>
      </header>

      {/* Login / Register content */}
      <section className="auth-content">
        <div className="auth-intro">
          <span className="auth-eyebrow">
            <span className="auth-status-dot" />
            YOUR FINANCIAL JOURNEY STARTS HERE
          </span>

          <h2>
            Take control of
            <br />
            <span>your money.</span>
          </h2>

          <p>
            Make smarter financial decisions with a clearer view
            of your spending, savings, and financial goals.
          </p>
        </div>

        <div className="auth-card">
          <Logo />

          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>

          {children}

          <p className="auth-footer">{footer}</p>
        </div>
      </section>

      <footer className="auth-bottom-note">
        <span className="auth-status-dot" />
        Your personal finance companion
      </footer>
    </main>
  );
}