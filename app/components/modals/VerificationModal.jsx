"use client";

export function VerificationModal({ auth, logoSrc }) {
  const {
    verificationOpen,
    setVerificationOpen,
    verificationEmail,
    verificationCode,
    setVerificationCode,
    verificationSubmitting,
    verificationError,
    setVerificationError,
    resendSubmitting,
    resendCooldown,
    submitVerification,
    resendVerification,
    backToAuth,
  } = auth;

  if (!verificationOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={() => {
        if (!verificationSubmitting && !resendSubmitting) setVerificationOpen(false);
      }}
    >
      <div className="login-modal verification-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button
          className="modal-close"
          type="button"
          aria-label="Close"
          disabled={verificationSubmitting || resendSubmitting}
          onClick={() => setVerificationOpen(false)}
        >
          ×
        </button>

        <div className="modal-logo">
          <img src={logoSrc} alt="Fades" className="modal-logo-img" />
        </div>

        <h2>Verify your email</h2>

        <p>
          We sent a 6-digit verification code to
          <strong> {verificationEmail}</strong>.
        </p>

        <form className="auth-form" onSubmit={submitVerification}>
          {verificationError && <div className="auth-error">{verificationError}</div>}

          <div className="auth-field">
            <label htmlFor="fades-verification-code">Verification code</label>
            <input
              id="fades-verification-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={verificationCode}
              onChange={(event) => {
                const value = event.target.value.replace(/\D/g, "").slice(0, 6);
                setVerificationCode(value);
                setVerificationError("");
              }}
              placeholder="000000"
              maxLength={6}
              pattern="[0-9]{6}"
              autoFocus
              required
              disabled={verificationSubmitting}
              style={{ textAlign: "center", letterSpacing: "0.35em", fontSize: "1.35rem", fontWeight: 700 }}
            />
          </div>

          <button
            className="auth-submit"
            type="submit"
            disabled={verificationSubmitting || verificationCode.length !== 6}
          >
            {verificationSubmitting ? "Verifying..." : "Verify email"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "18px" }}>
          <p style={{ marginBottom: "10px" }}>Didn't receive the code?</p>

          <button
            type="button"
            className="guest-button"
            disabled={resendSubmitting || resendCooldown > 0}
            onClick={resendVerification}
          >
            {resendSubmitting
              ? "Sending..."
              : resendCooldown > 0
              ? `Resend code in ${resendCooldown}s`
              : "Resend code"}
          </button>
        </div>

        <button
          type="button"
          className="guest-button"
          disabled={verificationSubmitting || resendSubmitting}
          onClick={backToAuth}
          style={{ marginTop: "10px" }}
        >
          Back to sign in
        </button>

        <small className="login-note">Your verification code expires after 10 minutes.</small>
      </div>
    </div>
  );
}
