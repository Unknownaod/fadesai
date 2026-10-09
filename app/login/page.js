"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import "./login.css";

/*
 * =========================================================
 * FADES LOGIN  →  app/login/page.js   (served at fades.lol/login)
 * =========================================================
 * Uses the auth API (cookie session):
 *   GET  /auth/me                   → current user (401 when signed out)
 *   POST /auth/login                → { email, password, code? }
 *        401 TWOFA_REQUIRED         → ask for the authenticator / backup code
 *        403 EMAIL_NOT_VERIFIED     → ask for the emailed 6-digit code
 *   POST /auth/signup               → { username, email, password }
 *        201 requiresEmailVerification
 *   POST /auth/verify-email         → { email, code }  (sets the session)
 *   POST /auth/resend-verification  → { email }
 *   POST /auth/logout
 *   POST /auth/browser/link         → { code }
 *
 * Query params:
 *   ?from=browser   shows the "you can close this tab" screen
 *   ?next=/chat     where to go after login (default "/")
 *   ?code=<32 hex>  sign-in handoff from Fades Browser. After login the
 *                   page asks "Connect Fades Browser?" and, on confirm,
 *                   POSTs /auth/browser/link { code } so the browser can
 *                   claim its own token (no shared cookies needed).
 *
 * Styles live in ./login.css
 */

const AUTH_API = "https://api.fades.lol/auth";
const LOGO = "/logo.png";
const CODE_RE = /^[a-f0-9]{32}$/;
const RESEND_COOLDOWN_S = 60;

/* short code shown on both sides so the user can confirm they match */
function formatUserCode(code) {
  const text = code.slice(0, 8).toUpperCase();

  return `${text.slice(0, 4)}-${text.slice(4)}`;
}

function buildBody(mode, { username, email, password }) {
  return mode === "signup"
    ? { username: username.trim(), email: email.trim(), password }
    : { email: email.trim(), password };
}

async function authFetch(path, options = {}) {
  const response = await fetch(`${AUTH_API}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      (data && (data.error || data.message)) ||
        (response.status === 401
          ? "Wrong email or password."
          : `Something went wrong (${response.status}).`)
    );

    error.status = response.status;
    error.data = data; // lets callers read requiresTwoFactor, requiresEmailVerification, ...

    throw error;
  }

  return data;
}

function LoginForm() {
  const params = useSearchParams();
  const fromBrowser = params.get("from") === "browser";
  const rawNext = params.get("next") || "/";
  // only allow same-site relative redirects
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const rawCode = params.get("code") || "";
  const code = CODE_RE.test(rawCode) ? rawCode : "";

  const [mode, setMode] = useState("login");
  const [step, setStep] = useState("form"); // form | twofa | verify
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [twofaCode, setTwofaCode] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [link, setLink] = useState("idle"); // idle | linking | linked | cancelled
  const [linkError, setLinkError] = useState("");

  const finish = (account) => {
    setUser(account);

    if (!fromBrowser && !code) window.location.assign(next);
  };

  const connectBrowser = async () => {
    setLink("linking");
    setLinkError("");

    try {
      await authFetch("/browser/link", {
        method: "POST",
        body: JSON.stringify({ code }),
      });

      setLink("linked");
    } catch (linkFailure) {
      setLink("idle");
      setLinkError(
        linkFailure.status === undefined
          ? "Can't reach Fades right now. Try again."
          : linkFailure.message
      );
    }
  };

  /* already signed in? */
  useEffect(() => {
    let cancelled = false;

    authFetch("/me")
      .then((data) => {
        const account = data && (data.user || data);

        if (!cancelled && account && (account.id || account.username || account.email)) {
          setUser(account);
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setChecking(false));

    return () => {
      cancelled = true;
    };
  }, []);

  /* resend countdown */
  useEffect(() => {
    if (cooldown <= 0) return undefined;

    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);

    return () => clearTimeout(timer);
  }, [cooldown]);

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  const resetToForm = () => {
    setStep("form");
    setTwofaCode("");
    setVerifyCode("");
    setError("");
    setNotice("");
  };

  /* ---------- email verification ---------- */

  const sendCode = async (email, { auto = false } = {}) => {
    setError("");

    try {
      await authFetch("/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });

      setNotice(`We sent a 6-digit code to ${email.trim()}.`);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (sendError) {
      if (auto) {
        // a code may already be active (e.g. just sent at signup) – don't alarm the user
        setNotice(sendError.message);
      } else {
        setError(
          sendError.status === undefined
            ? "Can't reach Fades right now. Try again."
            : sendError.message
        );
      }
    }
  };

  const submitVerify = async (event) => {
    event.preventDefault();

    if (busy) return;

    setError("");

    if (!/^\d{6}$/.test(verifyCode)) {
      setError("Enter the 6-digit code from your email.");

      return;
    }

    setBusy(true);

    try {
      const data = await authFetch("/verify-email", {
        method: "POST",
        body: JSON.stringify({ email: form.email.trim(), code: verifyCode }),
      });

      finish((data && data.user) || {});
    } catch (verifyError) {
      setError(
        verifyError.status === undefined
          ? "Can't reach Fades right now. Check your connection and try again."
          : verifyError.message
      );
    } finally {
      setBusy(false);
    }
  };

  /* ---------- sign in / sign up ---------- */

  const submit = async (event) => {
    event.preventDefault();

    if (busy) return;

    setError("");
    setNotice("");

    if (!form.email.trim() || !form.password) {
      setError("Enter your email and password.");

      return;
    }

    if (mode === "signup") {
      if (!form.username.trim()) {
        setError("Pick a username.");

        return;
      }

      if (form.password.length < 8) {
        setError("Password must be at least 8 characters.");

        return;
      }
    }

    setBusy(true);

    try {
      const data = await authFetch(mode === "signup" ? "/signup" : "/login", {
        method: "POST",
        body: JSON.stringify(buildBody(mode, form)),
      });

      // new accounts must verify their email before they get a session
      if (data && data.requiresEmailVerification) {
        setVerifyCode("");
        setStep("verify");
        setNotice(`We sent a 6-digit code to ${form.email.trim()}.`);
        setCooldown(RESEND_COOLDOWN_S);

        return;
      }

      // some APIs return the user, some only set the cookie – confirm with /me
      let account = data && (data.user || (data.id || data.username ? data : null));

      if (!account) {
        const me = await authFetch("/me");

        account = me && (me.user || me);
      }

      finish(account || {});
    } catch (submitError) {
      const data = submitError.data;

      if (data && data.requiresTwoFactor && data.error === "TWOFA_REQUIRED") {
        setTwofaCode("");
        setStep("twofa");
      } else if (submitError.status === 403 && data && data.requiresEmailVerification) {
        setVerifyCode("");
        setStep("verify");
        setBusy(false);
        await sendCode(form.email, { auto: true });

        return;
      } else {
        setError(
          submitError.status === undefined
            ? "Can't reach Fades right now. Check your connection and try again."
            : submitError.message
        );
      }
    } finally {
      setBusy(false);
    }
  };

  /* ---------- two-step verification ---------- */

  const submitTwofa = async (event) => {
    event.preventDefault();

    if (busy) return;

    setError("");

    const cleaned = twofaCode.trim();

    if (!cleaned) {
      setError("Enter your 6-digit code or a backup code.");

      return;
    }

    setBusy(true);

    try {
      const data = await authFetch("/login", {
        method: "POST",
        body: JSON.stringify({ ...buildBody("login", form), code: cleaned }),
      });

      let account = data && data.user;

      if (!account) {
        const me = await authFetch("/me");

        account = me && (me.user || me);
      }

      finish(account || {});
    } catch (twofaError) {
      setError(
        twofaError.status === undefined
          ? "Can't reach Fades right now. Check your connection and try again."
          : twofaError.message
      );
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    try {
      await authFetch("/logout", { method: "POST" });
    } catch {}

    setUser(null);
    resetToForm();
    setForm((f) => ({ ...f, password: "" }));
  };

  const name = user && (user.username || user.name || user.email || "your account");

  return (
    <main className="fl-page">
      <div className="fl-glow fl-glow-1" />
      <div className="fl-glow fl-glow-2" />

      <section className="fl-card">
        <div className="fl-brand">
          <img src={LOGO} alt="" width="40" height="40" />
          <strong>Fades</strong>
        </div>

        {checking ? (
          <div className="fl-center">
            <div className="fl-spinner" />
          </div>
        ) : user && code ? (
          <div className="fl-done">
            {link === "linked" ? (
              <>
                <div className="fl-check">✓</div>

                <h1>Browser connected</h1>

                <p>
                  You're signed in. This tab will close on its own — if it
                  doesn't, you can close it.
                </p>
              </>
            ) : link === "cancelled" ? (
              <>
                <h1>Not connected</h1>

                <p>Nothing was shared with the browser. You can close this tab.</p>
              </>
            ) : (
              <>
                <h1>Connect Fades Browser?</h1>

                <p>
                  Signed in as <b>{name}</b>. Only continue if this code
                  matches the one shown in your browser:
                </p>

                <div className="fl-code">{formatUserCode(code)}</div>

                {linkError && (
                  <div className="fl-error" role="alert">
                    {linkError}
                  </div>
                )}

                <div className="fl-actions">
                  <button
                    className="fl-primary"
                    onClick={connectBrowser}
                    disabled={link === "linking"}
                  >
                    {link === "linking" ? "Connecting…" : "Yes, connect"}
                  </button>

                  <button className="fl-ghost" onClick={() => setLink("cancelled")}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        ) : user ? (
          <div className="fl-done">
            <div className="fl-check">✓</div>

            <h1>You're signed in</h1>

            <p>
              Signed in as <b>{name}</b>.
              {fromBrowser
                ? " You can close this tab and head back to Fades Browser — your sync will pick up automatically."
                : ""}
            </p>

            <div className="fl-actions">
              {!fromBrowser && (
                <button className="fl-primary" onClick={() => window.location.assign(next)}>
                  Continue
                </button>
              )}

              <button className="fl-ghost" onClick={signOut}>
                Sign out
              </button>
            </div>
          </div>
        ) : step === "twofa" ? (
          <>
            <h1>Two-step verification</h1>

            <p className="fl-sub">
              Enter the 6-digit code from your authenticator app, or one of
              your backup codes.
            </p>

            <form onSubmit={submitTwofa} noValidate>
              <label>
                <span>Authentication code</span>

                <input
                  className="fl-otp"
                  value={twofaCode}
                  onChange={(event) => setTwofaCode(event.target.value)}
                  autoComplete="one-time-code"
                  autoCapitalize="off"
                  spellCheck={false}
                  maxLength={12}
                  placeholder="123456"
                  autoFocus
                />
              </label>

              {error && (
                <div className="fl-error" role="alert">
                  {error}
                </div>
              )}

              <button className="fl-primary" type="submit" disabled={busy}>
                {busy ? "Checking…" : "Verify and sign in"}
              </button>
            </form>

            <p className="fl-foot">
              <button type="button" onClick={resetToForm}>
                ← Back to sign in
              </button>
            </p>
          </>
        ) : step === "verify" ? (
          <>
            <h1>Verify your email</h1>

            <p className="fl-sub">
              Enter the 6-digit code we emailed to <b>{form.email.trim()}</b>.
              It expires in 10 minutes.
            </p>

            <form onSubmit={submitVerify} noValidate>
              <label>
                <span>Verification code</span>

                <input
                  className="fl-otp"
                  value={verifyCode}
                  onChange={(event) =>
                    setVerifyCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  autoFocus
                />
              </label>

              {notice && <div className="fl-notice">{notice}</div>}

              {error && (
                <div className="fl-error" role="alert">
                  {error}
                </div>
              )}

              <button className="fl-primary" type="submit" disabled={busy}>
                {busy ? "Verifying…" : "Verify email"}
              </button>
            </form>

            <p className="fl-foot">
              Didn't get it?{" "}
              <button
                type="button"
                onClick={() => sendCode(form.email)}
                disabled={cooldown > 0}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </p>

            <p className="fl-foot fl-foot-tight">
              <button type="button" onClick={resetToForm}>
                ← Back to sign in
              </button>
            </p>
          </>
        ) : (
          <>
            <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>

            <p className="fl-sub">
              {mode === "login"
                ? "Sign in to sync your bookmarks, history and tabs."
                : "One account for Fades Browser, Chat and Mail."}
            </p>

            <div className="fl-tabs" role="tablist">
              <button
                role="tab"
                aria-selected={mode === "login"}
                className={mode === "login" ? "active" : ""}
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Sign in
              </button>

              <button
                role="tab"
                aria-selected={mode === "signup"}
                className={mode === "signup" ? "active" : ""}
                onClick={() => {
                  setMode("signup");
                  setError("");
                }}
              >
                Create account
              </button>
            </div>

            <form onSubmit={submit} noValidate>
              {mode === "signup" && (
                <label>
                  <span>Username</span>

                  <input
                    value={form.username}
                    onChange={set("username")}
                    autoComplete="username"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder="yourname"
                  />
                </label>
              )}

              <label>
                <span>Email</span>

                <input
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  autoComplete="email"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="you@example.com"
                  autoFocus
                />
              </label>

              <label>
                <span>Password</span>

                <div className="fl-password">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={set("password")}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder={mode === "login" ? "Your password" : "At least 8 characters"}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              {error && (
                <div className="fl-error" role="alert">
                  {error}
                </div>
              )}

              <button className="fl-primary" type="submit" disabled={busy}>
                {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
              </button>
            </form>

            <p className="fl-foot">
              {mode === "login" ? "New to Fades? " : "Already have an account? "}

              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setError("");
                }}
              >
                {mode === "login" ? "Create an account" : "Sign in"}
              </button>
            </p>
          </>
        )}
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
