"use client";

export function DeleteAccountModal({ auth, logoSrc }) {
  const {
    deleteAccountConfirmOpen,
    setDeleteAccountConfirmOpen,
    deleteAccountSubmitting,
    deleteAccount,
  } = auth;

  if (!deleteAccountConfirmOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={() => {
        if (!deleteAccountSubmitting) setDeleteAccountConfirmOpen(false);
      }}
    >
      <div className="login-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button
          className="modal-close"
          type="button"
          aria-label="Close"
          disabled={deleteAccountSubmitting}
          onClick={() => setDeleteAccountConfirmOpen(false)}
        >
          ×
        </button>

        <div className="modal-logo">
          <img src={logoSrc} alt="Fades" className="modal-logo-img" />
        </div>

        <h2>Delete your account?</h2>

        <p>
          This permanently deletes your Fades account, conversations, messages, and active sessions. This
          action cannot be undone.
        </p>

        <button className="auth-submit" type="button" disabled={deleteAccountSubmitting} onClick={deleteAccount}>
          {deleteAccountSubmitting ? "Deleting account..." : "Delete Account"}
        </button>

        <button
          className="guest-button"
          type="button"
          disabled={deleteAccountSubmitting}
          onClick={() => setDeleteAccountConfirmOpen(false)}
        >
          Keep my account
        </button>

        <small className="login-note">This permanently removes your account and associated Fades data.</small>
      </div>
    </div>
  );
}
