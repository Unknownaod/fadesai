"use client";

import { ProBadge } from "../../ProBadge";

export function AccountTab({
  user,
  avatarLetter,
  logout,
  deleteAccountSubmitting,
  setDeleteAccountConfirmOpen,
  setSettingsOpen,
  openAuth,
}) {
  if (!user) {
    return (
      <div className="settings-empty-card">
        <div className="settings-empty-icon">◎</div>
        <h3>You're using Fades as a guest</h3>
        <p>Sign in or create an account to sync conversations, manage your account, and access account features.</p>

        <button
          className="settings-action-button"
          type="button"
          onClick={() => {
            setSettingsOpen(false);
            openAuth("login");
          }}
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="settings-card">
        <div className="account-summary">
          <div className="settings-account-avatar">{avatarLetter}</div>

          <div className="account-summary-info">
            <div className="account-name">
              {user.displayName || user.username}
              {user.plan === "pro" && <ProBadge />}
            </div>

            <div className="account-email">{user.email}</div>

            <span className="account-status">
              <span className="settings-status-dot" />
              Signed in
            </span>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-heading">
          <div className="settings-card-icon">◎</div>
          <div>
            <h3 className="settings-title">Account</h3>
            <p className="settings-description">Manage your Fades account and subscription.</p>
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-row-label">
            <div>Fades Pro</div>
            <div>
              {user.plan === "pro"
                ? "Manage your Fades Pro subscription."
                : "Explore Fades Pro and available features."}
            </div>
          </div>

          <button
            className="settings-action-button"
            type="button"
            onClick={() => {
              setSettingsOpen(false);
              window.location.href = "/pro";
            }}
          >
            {user.plan === "pro" ? "Manage" : "View Pro"}
          </button>
        </div>

        <div className="settings-row">
          <div className="settings-row-label">
            <div>Sign out</div>
            <div>End your current Fades session.</div>
          </div>

          <button className="settings-action-button" type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>

      <div className="settings-card settings-danger-card">
        <div className="settings-card-heading">
          <div className="settings-card-icon">!</div>
          <div>
            <h3 className="settings-title">Delete account</h3>
            <p className="settings-description">
              Permanently delete your account, conversations, messages, and active sessions.
            </p>
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-row-label">
            <div>Delete my Fades account</div>
            <div>This action cannot be undone.</div>
          </div>

          <button
            className="settings-action-button"
            type="button"
            disabled={deleteAccountSubmitting}
            onClick={() => {
              setDeleteAccountConfirmOpen(true);
              setSettingsOpen(false);
            }}
          >
            Delete account
          </button>
        </div>
      </div>
    </>
  );
}
