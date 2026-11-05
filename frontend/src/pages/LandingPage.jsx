
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/landing.css';

const VIDEO_URL =
    'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104036_bd6924f6-3c8e-417e-8465-6d03c8c2e9e6.mp4';

const POSTER_URL =
    'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/82e7eb75-c65f-490a-99b5-f3d1cad54200.webp';

function Arrow() {
    return (
        <svg className="landing-arrow" viewBox="0 0 12 10" fill="none" aria-hidden="true">
            <path
                d="M0.8 5h10M7.1 1.4 10.9 5l-3.8 3.6"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export default function LandingPage() {
    const [menuOpen, setMenuOpen] = useState(false);
    const videoA = useRef(null);
    const videoB = useRef(null);

    // Entrance animation
    useEffect(() => {
        const root = document.documentElement;
        const reducedMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches;

        if (reducedMotion) return;

        let started = false;
        let cleaned = false;
        let bootTimer;
        let safetyTimer;

        root.classList.add('anim');

        const clean = () => {
            if (cleaned) return;
            cleaned = true;

            clearTimeout(bootTimer);
            clearTimeout(safetyTimer);
            root.removeEventListener('animationend', onAnimationEnd, true);
            root.classList.remove('anim', 'go');
        };

        const onAnimationEnd = (event) => {
            if (
                event.animationName === 'pillIn' &&
                event.target.classList.contains('btn-ghost')
            ) {
                clean();
            }
        };

        const start = () => {
            if (started || cleaned) return;
            started = true;

            clearTimeout(bootTimer);
            root.addEventListener('animationend', onAnimationEnd, true);
            safetyTimer = setTimeout(clean, 2600);
            root.classList.add('go');
        };

        bootTimer = setTimeout(start, 900);

        if (document.fonts?.ready) {
            document.fonts.ready.then(start, start);
        } else {
            start();
        }

        return clean;
    }, []);

    // Smoothly cross-fade the two background videos at the loop point.
    useEffect(() => {
        const a = videoA.current;
        const b = videoB.current;

        if (!a || !b) return;

        const reducedMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches;

        if (reducedMotion) {
            a.removeAttribute('autoplay');
            a.pause();
            b.pause();

            try {
                a.currentTime = 0;
            } catch (_) { }

            return;
        }

        const FADE = 0.9;

        let current = a;
        let next = b;
        let swapping = false;
        let swapTimer;

        const play = (video) => {
            const promise = video.play();
            if (promise?.catch) promise.catch(() => { });
        };

        const tick = () => {
            if (swapping || !current.duration || !Number.isFinite(current.duration)) {
                return;
            }

            if (current.duration - current.currentTime > FADE) return;

            swapping = true;

            const outgoing = current;
            const incoming = next;

            try {
                incoming.currentTime = 0;
            } catch (_) { }

            play(incoming);
            incoming.classList.add('is-active');
            outgoing.classList.remove('is-active');

            current = incoming;
            next = outgoing;

            swapTimer = setTimeout(() => {
                outgoing.pause();

                try {
                    outgoing.currentTime = 0;
                } catch (_) { }

                swapping = false;
            }, FADE * 1000 + 100);
        };

        a.addEventListener('timeupdate', tick);
        b.addEventListener('timeupdate', tick);

        play(a);

        return () => {
            clearTimeout(swapTimer);
            a.removeEventListener('timeupdate', tick);
            b.removeEventListener('timeupdate', tick);
            a.pause();
            b.pause();
        };
    }, []);

    // Close mobile menu when clicking outside or pressing Escape.
    useEffect(() => {
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') setMenuOpen(false);
        };

        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, []);

    const closeMenu = () => setMenuOpen(false);

    const menuLinks = [
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Transactions', to: '/transactions' },
        { label: 'Analytics', to: '/analytics' },
        { label: 'AI Assistant', to: '/ai-chat' },
        { label: 'Settings', to: '/settings' },
    ];

    return (
        <main className="landing-hero">
            {/* Animated background */}
            <div className="landing-bg" aria-hidden="true">
                <video
                    ref={videoA}
                    className="landing-video is-active"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    disablePictureInPicture
                    poster={POSTER_URL}
                >
                    <source src={VIDEO_URL} type="video/mp4" />
                </video>

                <video
                    ref={videoB}
                    className="landing-video"
                    muted
                    loop
                    playsInline
                    preload="auto"
                    disablePictureInPicture
                    poster={POSTER_URL}
                >
                    <source src={VIDEO_URL} type="video/mp4" />
                </video>

                <div className="landing-overlay" />
            </div>

            {/* Navigation */}
            <header className="landing-nav">
                <Link to="/" className="landing-brand">
                    <span className="landing-brand-mark">S</span>
                    <span className="landing-brand-name">SmartSpend</span>
                </Link>

                <nav className="landing-nav-links" aria-label="Primary navigation">
                    {menuLinks.map((item) => (
                        <Link key={item.to} to={item.to}>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="landing-nav-actions">
                    <Link to="/login" className="landing-login">
                        Log in
                    </Link>

                    <Link to="/register" className="landing-nav-start">
                        Get Started <Arrow />
                    </Link>
                </div>

                <button
                    className={`landing-burger ${menuOpen ? 'active' : ''}`}
                    type="button"
                    aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={menuOpen}
                    aria-controls="landing-mobile-menu"
                    onClick={() => setMenuOpen((open) => !open)}
                >
                    <span />
                </button>
            </header>

            {/* Mobile navigation */}
            <nav
                className={`landing-menu ${menuOpen ? 'open' : ''}`}
                id="landing-mobile-menu"
                aria-label="Mobile navigation"
                aria-hidden={!menuOpen}
            >
                {menuLinks.map((item) => (
                    <Link
                        key={item.to}
                        to={item.to}
                        onClick={closeMenu}
                        tabIndex={menuOpen ? 0 : -1}
                    >
                        {item.label}
                    </Link>
                ))}

                <div className="landing-menu-divider" />

                <Link to="/login" onClick={closeMenu} tabIndex={menuOpen ? 0 : -1}>
                    Log in
                </Link>

                <Link
                    to="/register"
                    className="landing-mobile-start"
                    onClick={closeMenu}
                    tabIndex={menuOpen ? 0 : -1}
                >
                    Get Started <Arrow />
                </Link>
            </nav>

            {/* Hero content */}
            <section className="landing-content">
                <h1>
                    <span className="landing-line">
                        <span className="landing-line-inner">Your money,</span>
                    </span>
                    <span className="landing-line">
                        <span className="landing-line-inner">under control.</span>
                    </span>
                </h1>

                <p className="landing-subtitle">
                    Track your expenses, manage your income, and understand
                    <br />
                    your financial habits with powerful analytics and AI.
                    <br />
                    Make smarter decisions. Build a better financial future.
                </p>

                <div className="landing-ctas">
                    <Link to="/register" className="landing-btn landing-primary btn-primary">
                        Get Started <Arrow />
                    </Link>

                    <Link to="/login" className="landing-btn landing-secondary btn-ghost">
                        Log in <Arrow />
                    </Link>
                </div>

                <div className="landing-caption">
                    <span className="landing-caption-dot" />
                    Your personal finance companion
                </div>
            </section>
        </main>
    );
}
