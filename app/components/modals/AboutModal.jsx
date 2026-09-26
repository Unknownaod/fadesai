"use client";

import { MODEL_NAME } from "../../lib/constants";

export function AboutModal({ aboutOpen, setAboutOpen, logoSrc, user }) {
  if (!aboutOpen) return null;

  return (
    <div className="modal-backdrop" onMouseDown={() => setAboutOpen(false)}>
      <div className="login-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" aria-label="Close" onClick={() => setAboutOpen(false)}>
          ×
        </button>

        <div className="modal-logo">
          <img src={logoSrc} alt="Fades" className="modal-logo-img" />
        </div>

        <h2>Fades AI</h2>

        <p>
          Running {MODEL_NAME} on your own inference infrastructure.{" "}
          {user
            ? "Your conversations are synced to your Fades account."
            : "Guest conversations are temporary and are not saved."}
        </p>

        <button className="guest-button" type="button" onClick={() => setAboutOpen(false)}>
          Close
        </button>

        <small className="login-note">Fades AI · v1.0</small>
      </div>
    </div>
  );
}
