"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import "./login.css";

/*
 * FADES LOGIN  →  app/login/page.js   (served at fades.lol/login)
 *
 * Auth API (cookie session):
 *   GET  /auth/me                  → current user (401 when signed out)
 *   POST /auth/login               → { email, password }
 *   POST /auth/signup              → { username, email, password }
 *                                    (returns requiresEmailVerification, no session yet)
 *   POST /auth/verify-email        → { email, code }  (sets session cookie)
 *   POST /auth/resend-verification → { email }
 *   POST /auth/logout
 *   POST /auth/browser/link        → { code }
 *
 * Query params:
 *   ?from=browser   shows the "you can close this tab" screen
 *   ?next=/chat     where to go after login (default "/")
 *   ?code=<32 hex>  sign-in handoff from Fades Browser
 *
 * Remembered accounts (email + username only, never passwords) are kept
 * in localStorage so the user can pick one, switch, or remove it.
 */

const AUTH_API = "https://api.fades.lol/auth";
const LOGO = "/logo.png";
const CODE_RE = /^[a-f0-9]{32}$/;
const KNOWN_KEY = "fades-known-accounts";
const MAX_KNOWN = 5;
const RESEND_COOLDOWN = 30;

function formatUserCode(code) {
  const text = code.slice(0, 8).toUpperCase();

  return `${text.slice(0, 4)}-${text.slice(4)}`;
}

function buildBody(mode, { username, email, password }) {
  return mode === "signup"
    ? { username: username.trim(), email: email.trim(), password }
    : { email: email.trim(), password };
}

/* ---------- remembered accounts ---------- */

function loadKnown() {
  try {
    const raw = JSON.parse(localStorage.getItem(KNOWN_KEY) || "[]");

    return Array.isArray(raw) ? raw.filter((a) => a && a.email) : [];
  } catch {
    return [];
  }
}

function saveKnown(list) {
  try {
    localStorage.setItem(KNOWN_KEY, JSON.stringify(list.slice(0, MAX_KNOWN)));
  } catch {}
}

function upsertKnown(list, entry) {
  const key = entry.email.toLowerCase();

  return [
    { email: entry.email, username: entry.username || "", lastUsed: Date.now() },
    ...list.filter((a) => a.email.toLowerCase() !== key),
  ].slice(0, MAX_KNOWN);
}

function initialOf(account) {
  const text = (account && (account.username || account.name || account.email)) || "?";

  return text.trim().charAt(0).toUpperCase() || "?";
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
    const needsVerify = Boolean(data && data.requiresEmailVerification);

    const error = new Error(
      needsVerify
        ? "Please verify your email first."
        : (data && (data.error || data.message)) ||
            (response.status === 401
              ? "Wrong email or password."
              : `Something went wrong (${response.status}).`)
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

function AccountCard({ account }) {
  const name = account.username || account.name || account.email || "Your account";

  return (
    <div className="fl-current">
      <span className="fl-avatar">{initialOf(account)}</span>

      <span className="fl-account-text">
        <strong>{name}</strong>

        {account.email && account.email !== name && <small>{account.email}</small>}
      </span>
    </div>
  );
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
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [link, setLink] = useState("idle"); // idle | linking | linked | cancelled
  const [linkError, setLinkError] = useState("");

  const [known, setKnown] = useState([]);
  const [view, setView] = useState("form"); // form | chooser | verify
  const [selected, setSelected] = useState(null); // remembered account being signed in to

  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verifyInfo, setVerifyInfo] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const remember = (account, fallbackEmail = "") => {
    const email = (account && account.email) || fallbackEmail;

    if (!email) return;

    setKnown((list) => {
      const updated = upsertKnown(list, {
        email,
        username: (account && (account.username || account.name)) || "",
      });

      saveKnown(updated);

      return updated;
    });
  };

  const finish = (account, fallbackEmail) => {
    setUser(account);
    remember(account, fallbackEmail);

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

  /* load remembered accounts + check for an existing session */
  useEffect(() => {
    let cancelled = false;
    const list = loadKnown();

    setKnown(list);
    setView(list.length > 0 ? "chooser" : "form");

    authFetch("/me")
      .then((data) => {
        const account = data && (data.user || data);

        if (!cancelled && account && (account.id || account.username || account.email)) {
          setUser(account);

          if (account.email) {
            const updated = upsertKnown(list, {
              email: account.email,
              username: account.username || account.name || "",
            });

            setKnown(updated);
            saveKnown(updated);
          }
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setChecking(false));

    return () => {
      cancelled = true;
    };
  }, []);

  /* resend cooldown timer */
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);

    return () => clearTimeout(timer);
  }, [cooldown]);

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  /* ---------- account picker actions ---------- */

  const pickAccount = (account) => {
    setSelected(account);
    setMode("login");
    setError("");
    setForm((f) => ({ ...f, email: account.email, password: "" }));
    setView("form");
  };

  const useAnotherAccount = () => {
    setSelected(null);
    setMode("login");
    setError("");
    setForm({ username: "", email: "", password: "" });
    setView("form");
  };

  const backToChooser = () => {
    setSelected(null);
    setError("");
    setForm((f) => ({ ...f, password: "" }));
    setView("chooser");
  };

  const forgetAccount = (email) => {
    const updated = known.filter((a) => a.email.toLowerCase() !== email.toLowerCase());

    setKnown(updated);
    saveKnown(updated);

    if (updated.length === 0) setView("form");
  };

  const signOut = async (nextView) => {
    try {
      await authFetch("/logout", { method: "POST" });
    } catch {}

    setUser(null);
    setLink("idle");
    setLinkError("");
    setSelected(null);
    setError("");
    setForm((f) => ({ ...f, password: "" }));
    setView(nextView || (known.length > 0 ? "chooser" : "form"));
  };

  /* ---------- email verification ---------- */

  const resendCode = async (email = verifyEmail) => {
    if (!email || cooldown > 0) return;

    setVerifyError("");
    setVerifyInfo("");

    try {
      await authFetch("/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      setVerifyInfo("A new code is on its way.");
      setCooldown(RESEND_COOLDOWN);
    } catch (failure) {
      setVerifyError(
        failure.status === undefined
          ? "Can't reach Fades right now. Try again."
          : failure.message
      );
    }
  };

  const goVerify = (email, { resend = false } = {}) => {
    setVerifyEmail(email);
    setVerifyCode("");
    setVerifyError("");
    setVerifyInfo(resend ? "" : `We sent a code to ${email}.`);
    setView("verify");

    if (resend) resendCode(email);
    else setCooldown(RESEND_COOLDOWN);
  };

  const submitVerify = async (event) => {
    event.preventDefault();

    if (verifyBusy) return;

    const value = verifyCode.trim();

    if (!value) {
      setVerifyError("Enter the code from your email.");

      return;
    }

    setVerifyBusy(true);
    setVerifyError("");

    try {
      const data = await authFetch("/verify-email", {
        method: "POST",
        body: JSON.stringify({ email: verifyEmail, code: value }),
      });

      // the cookie is set now – with a ?code= this lands on "Connect Fades Browser?"
      let account = data && data.user;

      if (!account) {
        const me = await authFetch("/me");

        account = me && (me.user || me);
      }

      finish(account || {}, verifyEmail);
    } catch (failure) {
      setVerifyError(
        failure.status === undefined
          ? "Can't reach Fades right now. Try again."
          : failure.message
      );
    } finally {
      setVerifyBusy(false);
    }
  };

  const leaveVerify = () => {
    setVerifyCode("");
    setVerifyError("");
    setVerifyInfo("");
    setMode("login");
    setView(known.length > 0 ? "chooser" : "form");
  };

  /* ---------- submit ---------- */

  const submit = async (event) => {
    event.preventDefault();

    if (busy) return;

    setError("");

    const email = selected ? selected.email : form.email;

    if (!email.trim() || !form.password) {
      setError(selected ? "Enter your password." : "Enter your email and password.");

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
        body: JSON.stringify(buildBody(mode, { ...form, email })),
      });

      // new accounts must verify their email before they get a session
      if (data && data.requiresEmailVerification) {
        setForm((f) => ({ ...f, password: "" }));
        goVerify(email.trim());

        return;
      }

      // some APIs return the user, some only set the cookie – confirm with /me
      let account = data && (data.user || (data.id || data.username ? data : null));

      if (!account) {
        const me = await authFetch("/me");

        account = me && (me.user || me);
      }

      finish(account || {}, email.trim());
    } catch (submitError) {
      if (submitError.data && submitError.data.requiresEmailVerification) {
        // existing account that never verified: send a fresh code
        goVerify(email.trim(), { resend: true });
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
          /* ---------- signed in + browser handoff ---------- */
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

                <button className="fl-link" onClick={() => setLink("idle")}>
                  Changed your mind? Go back
                </button>
              </>
            ) : (
              <>
                <h1>Connect Fades Browser?</h1>

                <p>Only continue if this code matches the one shown in your browser:</p>

                <div className="fl-code">{formatUserCode(code)}</div>

                <AccountCard account={user} />

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

                <button className="fl-link" onClick={() => signOut()}>
                  Not you? Switch account
                </button>
              </>
            )}
          </div>
        ) : user ? (
          /* ---------- signed in ---------- */
          <div className="fl-done">
            <div className="fl-check">✓</div>

            <h1>You're signed in</h1>

            <AccountCard account={user} />

            {fromBrowser && (
              <p>
                You can close this tab and head back to Fades Browser — your
                sync will pick up automatically.
              </p>
            )}

            <div className="fl-actions">
              {!fromBrowser && (
                <button className="fl-primary" onClick={() => window.location.assign(next)}>
                  Continue
                </button>
              )}

              <button className="fl-ghost" onClick={() => signOut()}>
                Switch account
              </button>
            </div>

            <button className="fl-link" onClick={() => signOut("form")}>
              Sign out
            </button>
          </div>
        ) : view === "verify" ? (
          /* ---------- verify email ---------- */
          <>
            <h1>Verify your email</h1>

            <p className="fl-sub">
              Enter the code we sent to <b>{verifyEmail}</b>
              {code ? ", then you can connect Fades Browser." : "."}
            </p>

            <form onSubmit={submitVerify} noValidate>
              <label>
                <span>Verification code</span>

                <input
                  className="fl-code-input"
                  value={verifyCode}
                  onChange={(event) => setVerifyCode(event.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoCapitalize="off"
                  spellCheck={false}
                  maxLength={12}
                  placeholder="Enter code"
                  autoFocus
                />
              </label>

              {verifyError && (
                <div className="fl-error" role="alert">
                  {verifyError}
                </div>
              )}

              {verifyInfo && !verifyError && <div className="fl-info">{verifyInfo}</div>}

              <button className="fl-primary" type="submit" disabled={verifyBusy}>
                {verifyBusy ? "Verifying…" : "Verify"}
              </button>
            </form>

            <p className="fl-foot">
              Didn't get it?{" "}
              <button type="button" onClick={() => resendCode()} disabled={cooldown > 0}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </p>

            <button className="fl-link" onClick={leaveVerify}>
              ‹ Use a different email
            </button>
          </>
        ) : view === "chooser" && known.length > 0 ? (
          /* ---------- choose an account ---------- */
          <>
            <h1>Choose an account</h1>

            <p className="fl-sub">
              Pick an account to continue to Fades{code || fromBrowser ? " Browser" : ""}.
            </p>

            <ul className="fl-accounts">
              {known.map((account) => (
                <li key={account.email}>
                  <button className="fl-account" onClick={() => pickAccount(account)}>
                    <span className="fl-avatar">{initialOf(account)}</span>

                    <span className="fl-account-text">
                      <strong>{account.username || account.email}</strong>

                      {account.username && <small>{account.email}</small>}
                    </span>

                    <span className="fl-account-arrow">›</span>
                  </button>

                  <button
                    className="fl-account-remove"
                    onClick={() => forgetAccount(account.email)}
                    title="Remove from this device"
                    aria-label={`Remove ${account.email} from this device`}
                  >
                    ×
                  </button>
                </li>
              ))}

              <li>
                <button className="fl-account fl-account-other" onClick={useAnotherAccount}>
                  <span className="fl-avatar fl-avatar-plus">＋</span>

                  <span className="fl-account-text">
                    <strong>Use another account</strong>
                  </span>
                </button>
              </li>
            </ul>

            <p className="fl-hint">
              Accounts are remembered on this device only. Passwords are never
              saved.
            </p>
          </>
        ) : (
          /* ---------- sign in / create account ---------- */
          <>
            {known.length > 0 && (
              <button className="fl-back" onClick={backToChooser}>
                ‹ Choose an account
              </button>
            )}

            <h1>
              {selected
                ? "Welcome back"
                : mode === "login"
                ? "Welcome back"
                : "Create your account"}
            </h1>

            <p className="fl-sub">
              {selected
                ? "Enter your password to continue."
                : mode === "login"
                ? "Sign in to sync your bookmarks, history and tabs."
                : "One account for Fades Browser, Chat and Mail."}
            </p>

            {!selected && (
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
            )}

            <form onSubmit={submit} noValidate>
              {selected ? (
                <div className="fl-selected">
                  <AccountCard account={selected} />

                  <button type="button" className="fl-link" onClick={backToChooser}>
                    Not you?
                  </button>
                </div>
              ) : (
                <>
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
                </>
              )}

              <label>
                <span>Password</span>

                <div className="fl-password">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={set("password")}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder={mode === "login" ? "Your password" : "At least 8 characters"}
                    autoFocus={Boolean(selected)}
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

            {!selected && (
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
            )}
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
