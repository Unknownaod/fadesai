"use client";

import { MODEL_NAME } from "../../../lib/constants";

export function AboutTab({ logoSrc, chats, totalMessages, user, setSettingsOpen, setAboutOpen }) {
  return (
    <>
      <div className="settings-card">
        <div className="settings-about-hero">
          <div className="settings-about-logo">
            <img src={logoSrc} alt="Fades" className="settings-about-logo-img" />
          </div>

          <div>
            <span className="settings-eyebrow">FADES AI</span>
            <h3>Simple AI. Built for you.</h3>
            <p>Fades AI runs {MODEL_NAME} on its own inference infrastructure.</p>
          </div>
        </div>

        <div className="settings-stats">
          <div className="settings-stat">
            <div className="settings-stat-value">{chats.length}</div>
            <div className="settings-stat-label">Chats</div>
          </div>

          <div className="settings-stat">
            <div className="settings-stat-value">{totalMessages}</div>
            <div className="settings-stat-label">Messages</div>
          </div>

          <div className="settings-stat">
            <div className="settings-stat-value">{MODEL_NAME}</div>
            <div className="settings-stat-label">Model</div>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row-label">
            <div>Fades AI</div>
            <div>
              {user
                ? "Your conversations are synced to your Fades account."
                : "Guest conversations are temporary and are not saved."}
            </div>
          </div>

          <span className="settings-version">v1.0</span>
        </div>

        <div className="settings-row">
          <div className="settings-row-label">
            <div>Model</div>
            <div>Current model used by the Fades chat experience.</div>
          </div>

          <span className="settings-model-pill">{MODEL_NAME}</span>
        </div>
      </div>

      <button
        className="settings-about-button"
        type="button"
        onClick={() => {
          setSettingsOpen(false);
          setAboutOpen(true);
        }}
      >
        Open full About page
        <span>→</span>
      </button>
    </>
  );
}
