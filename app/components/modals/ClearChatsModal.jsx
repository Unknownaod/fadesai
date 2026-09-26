"use client";

export function ClearChatsModal({ clearConfirmOpen, setClearConfirmOpen, clearAllChats, user }) {
  if (!clearConfirmOpen) return null;

  return (
    <div className="modal-backdrop" onMouseDown={() => setClearConfirmOpen(false)}>
      <div className="login-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button
          className="modal-close"
          type="button"
          aria-label="Close"
          onClick={() => setClearConfirmOpen(false)}
        >
          ×
        </button>

        <h2>Clear all chats?</h2>

        <p>
          Every conversation {user ? "in your Fades account" : "currently open as a guest"} will be removed.
          This cannot be undone.
        </p>

        <button className="auth-submit" type="button" onClick={clearAllChats}>
          Clear everything
        </button>

        <button className="guest-button" type="button" onClick={() => setClearConfirmOpen(false)}>
          Keep my chats
        </button>
      </div>
    </div>
  );
}
