"use client";

import { useEffect, useState } from "react";
import "./install.css";

const WINDOWS_DOWNLOAD = "#";
const MAC_DOWNLOAD = "#";
const LINUX_DOWNLOAD = "#";

export default function InstallPage() {
  const [platform, setPlatform] = useState("windows");

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes("mac")) {
      setPlatform("mac");
    } else if (userAgent.includes("linux")) {
      setPlatform("linux");
    } else {
      setPlatform("windows");
    }
  }, []);

  const platformInfo = {
    windows: {
      name: "Windows",
      description: "Download Fades AI for Windows and use it as a desktop app.",
      button: "Download for Windows",
      href: WINDOWS_DOWNLOAD,
      requirements: "Windows 10 or later",
    },
    mac: {
      name: "macOS",
      description: "The Fades AI desktop app for macOS is coming soon.",
      button: "Coming Soon",
      href: "#",
      requirements: "macOS 12 or later",
    },
    linux: {
      name: "Linux",
      description: "The Fades AI desktop app for Linux is coming soon.",
      button: "Coming Soon",
      href: "#",
      requirements: "Modern 64-bit Linux",
    },
  };

  const current = platformInfo[platform];

  return (
    <main className="install-page">
      <nav className="install-nav">
        <a href="/" className="brand">
          <span className="brand-mark">F</span>
          <span>fades</span>
        </a>

        <div className="nav-links">
          <a href="/">Fades AI</a>
          <a href="/pro">Pro</a>
        </div>
      </nav>

      <section className="install-hero">
        <div className="hero-badge">
          <span className="status-dot" />
          Fades AI Desktop
        </div>

        <h1>
          Fades AI,
          <br />
          <span>wherever you are.</span>
        </h1>

        <p className="hero-description">
          Get the Fades AI desktop app for a faster, more focused AI
          experience right from your computer.
        </p>

        <div className="download-card">
          <div className="download-icon">
            {platform === "windows" && "⊞"}
            {platform === "mac" && "●"}
            {platform === "linux" && "◈"}
          </div>

          <div className="download-info">
            <h2>Fades AI for {current.name}</h2>
            <p>{current.description}</p>
            <span className="requirements">
              {current.requirements}
            </span>
          </div>

          <a
            className={`download-button ${
              platform !== "windows" ? "disabled" : ""
            }`}
            href={current.href}
            onClick={(event) => {
              if (platform !== "windows") {
                event.preventDefault();
              }
            }}
          >
            {current.button}
            {platform === "windows" && <span>↓</span>}
          </a>
        </div>

        <div className="platform-switcher">
          <button
            className={platform === "windows" ? "active" : ""}
            onClick={() => setPlatform("windows")}
          >
            Windows
          </button>

          <button
            className={platform === "mac" ? "active" : ""}
            onClick={() => setPlatform("mac")}
          >
            macOS
          </button>

          <button
            className={platform === "linux" ? "active" : ""}
            onClick={() => setPlatform("linux")}
          >
            Linux
          </button>
        </div>

        <p className="web-option">
          Don't want to install anything?{" "}
          <a href="/">Use Fades AI in your browser →</a>
        </p>
      </section>

      <section className="features">
        <div className="feature">
          <div className="feature-number">01</div>
          <h3>Your account</h3>
          <p>
            Sign in with your existing Fades account. Your conversations and
            Pro subscription stay connected.
          </p>
        </div>

        <div className="feature">
          <div className="feature-number">02</div>
          <h3>Built for desktop</h3>
          <p>
            Keep Fades AI available from your desktop without having to keep
            another browser tab open.
          </p>
        </div>

        <div className="feature">
          <div className="feature-number">03</div>
          <h3>Always improving</h3>
          <p>
            Get the latest Fades AI features as the application continues to
            evolve.
          </p>
        </div>
      </section>

      <section className="install-help">
        <div>
          <span className="small-label">NEED HELP?</span>
          <h2>Having trouble installing?</h2>
          <p>
            Make sure your computer meets the requirements and that you are
            downloading the correct version for your operating system.
          </p>
        </div>

        <a href="/" className="help-button">
          Open Fades AI
        </a>
      </section>

      <footer className="install-footer">
        <div className="footer-brand">
          <span className="brand-mark">F</span>
          <span>fades</span>
        </div>

        <div className="footer-links">
          <a href="/">Fades AI</a>
          <a href="/pro">Pro</a>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
        </div>

        <span className="copyright">
          © {new Date().getFullYear()} Fades
        </span>
      </footer>
    </main>
  );
}

