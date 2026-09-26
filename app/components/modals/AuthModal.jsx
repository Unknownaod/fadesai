"use client";

export function AuthModal({ auth, logoSrc }) {
  const {
    authOpen,
    setAuthOpen,
    authMode,
    authSubmitting,
    authError,
    authEmail,
    setAuthEmail,
    authUsername,
    setAuthUsername,
    authPassword,
    setAuthPassword,
    authDisplayName,
    setAuthDisplayName,
    openAuth,
    submitAuth,
  } = auth;

  if (!authOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={() => {
        if (!authSubmitting) setAuthOpen(false);
      }}
    >
      <div className="login-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button
          className="modal-close"
          type="button"
          aria-label="Close"
          onClick={() => !authSubmitting && setAuthOpen(false)}
        >
          ×
        </button>

        <div className="modal-logo">
          <img src={logoSrc} alt="Fades" className="modal-logo-img" />
        </div>

        <h2>{authMode === "login" ? "Welcome back" : "Create your Fades account"}</h2>

        <p>
          {authMode === "login"
            ? "Sign in to continue using Fades."
            : "Create an account to keep your Fades experience connected."}
        </p>

        <form className="auth-form" onSubmit={submitAuth}>
          {authError && <div className="auth-error">{authError}</div>}

          {authMode === "signup" && (
            <>
              <div className="auth-field">
                <label htmlFor="fades-name">Display name</label>
                <input
                  id="fades-name"
                  type="text"
                  value={authDisplayName}
                  onChange={(event) => setAuthDisplayName(event.target.value)}
                  placeholder="Fades User"
                  autoComplete="name"
                  disabled={authSubmitting}
                />
              </div>

              <div className="auth-field">
                <label htmlFor="fades-username">Username</label>
                <input
                  id="fades-username"
                  type="text"
                  value={authUsername}
                  onChange={(event) => setAuthUsername(event.target.value)}
                  placeholder="fadesuser"
                  minLength={3}
                  maxLength={24}
                  required
                  autoComplete="username"
                  disabled={authSubmitting}
                />
              </div>
            </>
          )}

          <div className="auth-field">
            <label htmlFor="fades-email">Email</label>
            <input
              id="fades-email"
              type="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              disabled={authSubmitting}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="fades-password">Password</label>
            <input
              id="fades-password"
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="••••••••"
              minLength={8}
              required
              autoComplete={authMode === "login" ? "current-password" : "new-password"}
              disabled={authSubmitting}
            />
          </div>

          <button className="auth-submit" type="submit" disabled={authSubmitting}>
            {authSubmitting ? "Please wait..." : authMode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="auth-switch">
          {authMode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            disabled={authSubmitting}
            onClick={() => openAuth(authMode === "login" ? "signup" : "login")}
          >
            {authMode === "login" ? "Create one" : "Sign in"}
          </button>
        </div>

        <div className="login-divider">
          <span>or</span>
        </div>

        <button
          className="guest-button"
          type="button"
          disabled={authSubmitting}
          onClick={() => setAuthOpen(false)}
        >
          Continue as guest
        </button>

        <small className="login-note">Guest chats are temporary and are not saved.</small>
      </div>
    </div>
  );
}
