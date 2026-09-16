"use client";

import { useEffect, useState } from "react";
import "./install.css";

const WINDOWS_DOWNLOAD = "#";
const MAC_DOWNLOAD = "#";
const LINUX_DOWNLOAD = "#";

function FadesLogo({ className = "" }) {
  return (
    <img
      src="/logo.png"
      alt="Fades"
      className={`fades-logo ${className}`}
    />
  );
}

function WindowsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="platform-svg"
      fill="currentColor"
    >
      <path d="M2.5 4.5 10.7 3.3v8.1H2.5V4.5Zm9.5-1.4L21.5 1.7v9.7H12V3.1ZM2.5 12.6h8.2v8.1L2.5 19.5v-6.9Zm9.5 0h9.5v9.7l-9.5-1.4v-8.3Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="platform-svg"
      fill="currentColor"
    >
      <path d="M17.05 12.54c-.02-2.13 1.74-3.16 1.82-3.21a3.93 3.93 0 0 0-3.1-1.67c-1.31-.14-2.58.78-3.25.78-.68 0-1.73-.77-2.85-.75a4.2 4.2 0 0 0-3.53 2.15c-1.52 2.63-.39 6.51 1.07 8.64.73 1.04 1.57 2.19 2.69 2.15 1.08-.04 1.49-.69 2.8-.69 1.3 0 1.67.69 2.81.67 1.17-.02 1.9-1.05 2.61-2.1a8.59 8.59 0 0 0 1.19-2.43 3.76 3.76 0 0 1-2.26-3.54ZM14.91 6.26a3.79 3.79 0 0 0 .87-2.75 3.87 3.87 0 0 0-2.5 1.29 3.62 3.62 0 0 0-.9 2.64 3.2 3.2 0 0 0 2.53-1.18Z" />
    </svg>
  );
}

function LinuxIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="platform-svg"
      fill="currentColor"
    >
      <path d="M12.05 2.25c-2.75 0-4.13 2.31-4.13 5.27 0 1.37-.19 2.42-.67 3.34-.48.93-1.21 1.82-1.71 2.91-.51 1.1-.73 2.49-.18 3.75.43 1.08 1.27 1.67 2.28 1.92-.2.54-.14 1.16.23 1.64.5.66 1.42.84 2.13.4.65-.4 1.14-.88 1.65-1.01.51-.14 1.01.01 1.6.01s1.09-.15 1.6-.01c.51.13 1 .61 1.65 1.01.71.44 1.63.26 2.13-.4.37-.48.43-1.1.23-1.64 1.01-.25 1.85-.84 2.28-1.92.55-1.26.33-2.65-.18-3.75-.5-1.09-1.23-1.98-1.71-2.91-.48-.92-.67-1.97-.67-3.34 0-2.96-1.38-5.27-4.13-5.27h-.4Zm-2.64 9.15c.5.34 1.17.52 1.92.52.76 0 1.43-.18 1.93-.52-.11.82-.83 1.44-1.93 1.44-1.09 0-1.81-.62-1.92-1.44Zm-1.4 5.12c-.42-.35-.65-.87-.65-1.48 0-.58.23-1.07.61-1.37.34-.27.78-.39 1.24-.35-.13.42-.2.87-.2 1.34 0 .8.2 1.52.57 2.11-.58.2-1.15.11-1.57-.25Zm4.04 1.48c-.62 0-1.09-.37-1.09-.87 0-.51.47-.88 1.09-.88.62 0 1.09.37 1.09.88 0 .5-.47.87-1.09.87Zm4.04-1.48c-.42.36-.99.45-1.57.25.37-.59.57-1.31.57-2.11 0-.47-.07-.92-.2-1.34.46-.04.9.08 1.24.35.38.3.61.79.61 1.37 0 .61-.23 1.13-.65 1.48Z" />
    </svg>
  );
}

export default function InstallPage() {
  const [platform, setPlatform] = useState("windows");

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();

    if (
      userAgent.includes("mac") ||
      userAgent.includes("iphone") ||
      userAgent.includes("ipad")
    ) {
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
      description:
        "Download Fades AI for Windows and use it as a desktop app.",
      button: "Download for Windows",
      href: WINDOWS_DOWNLOAD,
      requirements: "Windows 10 or later",
      icon: <WindowsIcon />,
    },
    mac: {
      name: "macOS",
      description:
        "The Fades AI desktop app for macOS is coming soon.",
      button: "Coming Soon",
      href: "#",
      requirements: "macOS 12 or later",
      icon: <AppleIcon />,
    },
    linux: {
      name: "Linux",
      description:
        "The Fades AI desktop app for Linux is coming soon.",
      button: "Coming Soon",
      href: "#",
      requirements: "Modern 64-bit Linux",
      icon: <LinuxIcon />,
    },
  };

  const current = platformInfo[platform];

  return (
    <main className="install-page">
      <nav className="install-nav">
        <a href="/" className="brand">
          <FadesLogo />
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
            {current.icon}
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

            {platform === "windows" && (
              <svg
                viewBox="0 0 24 24"
                className="download-svg"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 4v11" />
                <path d="m7 11 5 5 5-5" />
                <path d="M5 20h14" />
              </svg>
            )}
          </a>
        </div>

        <div className="platform-switcher">
          <button
            className={platform === "windows" ? "active" : ""}
            onClick={() => setPlatform("windows")}
          >
            <WindowsIcon />
            Windows
          </button>

          <button
            className={platform === "mac" ? "active" : ""}
            onClick={() => setPlatform("mac")}
          >
            <AppleIcon />
            macOS
          </button>

          <button
            className={platform === "linux" ? "active" : ""}
            onClick={() => setPlatform("linux")}
          >
            <LinuxIcon />
            Linux
          </button>
        </div>

        <p className="web-option">
          Don't want to install anything?{" "}
          <a href="/">
            Use Fades AI in your browser →
          </a>
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
          <FadesLogo />
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

