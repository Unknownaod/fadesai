"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import "./login.css";

/*
=========================================================
FADES LOGIN
=========================================================

Auth API:
  GET  /auth/me
  POST /auth/login
  POST /auth/signup
  POST /auth/verify-email
  POST /auth/resend-verification
  POST /auth/forgot-password
  POST /auth/reset-password
  POST /auth/logout
  POST /auth/browser/link

Password recovery:
  1. User enters their email.
  2. POST /auth/forgot-password sends a reset code.
  3. User enters the code and a new password.
  4. POST /auth/reset-password resets the password.
  5. User returns to sign in.

=========================================================
*/

const AUTH_API = "https://api.fades.lol/auth";
const LOGO = "/logo.png";
const CODE_RE = /^[a-f0-9]{32}$/;
const RESEND_COOLDOWN_S = 60;
const OTP_LENGTH = 6;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 1024;

/* ---------------------------------------------------------
   Background decoration
   --------------------------------------------------------- */

function seeded(seed) {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const rand = seeded(11);

const STARS = Array.from({ length: 48 }, () => ({
  x: (rand() * 100).toFixed(2),
  y: (rand() * 100).toFixed(2),
  size: (1 + rand() * 2.2).toFixed(1),
  delay: (rand() * 6).toFixed(2),
  duration: (3 + rand() * 5).toFixed(2),
}));

const SHAPES = [
  { kind: "ring", x: 7, y: 16, size: 74, delay: 0, duration: 15 },
  { kind: "square", x: 86, y: 12, size: 54, delay: -3, duration: 18 },
  { kind: "plus", x: 15, y: 72, size: 40, delay: -6, duration: 16 },
  { kind: "diamond", x: 90, y: 66, size: 60, delay: -2, duration: 20 },
  { kind: "ring", x: 78, y: 86, size: 38, delay: -8, duration: 14 },
  { kind: "square", x: 30, y: 8, size: 34, delay: -5, duration: 17 },
  { kind: "plus", x: 70, y: 30, size: 28, delay: -9, duration: 19 },
  { kind: "diamond", x: 4, y: 46, size: 30, delay: -4, duration: 21 },
  { kind: "ring", x: 54, y: 92, size: 46, delay: -7, duration: 16 },
];

function Background() {
  return (
    <div className="fl-bg" aria-hidden="true">
      <div className="fl-aurora" />
      <div className="fl-orb fl-orb-1" />
      <div className="fl-orb fl-orb-2" />
      <div className="fl-orb fl-orb-3" />
      <div className="fl-grid" />

      {STARS.map((star, index) => (
        <span
          key={index}
          className="fl-star"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`,
          }}
        />
      ))}

      {SHAPES.map((shape, index) => (
        <span
          key={index}
          className={`fl-shape fl-shape-${shape.kind}`}
          style={{
            left: `${shape.x}%`,
            top: `${shape.y}%`,
            width: `${shape.size}px`,
            height: `${shape.size}px`,
            animationDelay: `${shape.delay}s`,
            animationDuration: `${shape.duration}s`,
          }}
        />
      ))}

      <div className="fl-spot" />
      <div className="fl-vignette" />
    </div>
  );
}

/* ---------------------------------------------------------
   Helpers
   --------------------------------------------------------- */

function formatUserCode(code) {
  const text = code.slice(0, 8).toUpperCase();
  return `${text.slice(0, 4)}-${text.slice(4)}`;
}

function buildBody(mode, { username, email, password }) {
  return mode === "signup"
    ? {
        username: username.trim(),
        email: email.trim(),
        password,
      }
    : {
        email: email.trim(),
        password,
      };
}

function passwordStrength(password) {
  if (!password) return { score: 0, label: "" };

  if (password.length < 8) {
    return { score: 0, label: "Too short" };
  }

  let score = 1;

  if (password.length >= 12) score += 1;

  if (
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password)
  ) {
    score += 1;
  }

  if (
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  ) {
    score += 1;
  }

  return {
    score,
    label: ["Too short", "Weak", "Okay", "Good", "Strong"][score],
  };
}

async function authFetch(path, options = {}) {
  const response = await fetch(`${AUTH_API}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
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
    error.data = data;

    throw error;
  }

  return data;
}

function Avatar({ user }) {
  const src =
    user && typeof user.avatar === "string"
      ? user.avatar
      : "";

  const initial = String(
    (user && (user.username || user.name || user.email)) || "F"
  )
    .charAt(0)
    .toUpperCase();

  if (/^https:\/\//i.test(src)) {
    return (
      <img
        className="fl-avatar"
        src={src}
        alt=""
        width="72"
        height="72"
      />
    );
  }

  return (
    <div className="fl-avatar fl-avatar-fallback">
      {initial}
    </div>
  );
}

function CheckIcon() {
  return (
    <div className="fl-check">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </div>
  );
}

function Spinner() {
  return <span className="fl-btn-spin" aria-hidden="true" />;
}

/* ---------------------------------------------------------
   Six-digit OTP input
   --------------------------------------------------------- */

function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
}) {
  const refs = useRef([]);

  const digits = Array.from(
    { length: OTP_LENGTH },
    (_, index) => value[index] || ""
  );

  const focusAt = (index) => {
    const node =
      refs.current[
        Math.max(0, Math.min(OTP_LENGTH - 1, index))
      ];

    if (node) node.focus();
  };

  useEffect(() => {
    if (value === "" && !disabled) {
      focusAt(0);
    }
  }, [value, disabled]);

  const apply = (startIndex, raw) => {
    const clean = raw.replace(/\D/g, "");

    if (!clean) return;

    const next = [...digits];

    for (
      let index = 0;
      index < clean.length && startIndex + index < OTP_LENGTH;
      index += 1
    ) {
      next[startIndex + index] = clean[index];
    }

    const joined = next.join("");

    onChange(joined);

    focusAt(
      Math.min(startIndex + clean.length, OTP_LENGTH - 1)
    );

    if (joined.length === OTP_LENGTH) {
      onComplete?.(joined);
    }
  };

  const onKeyDown = (index, event) => {
    if (event.key === "Backspace") {
      event.preventDefault();

      const next = [...digits];

      if (digits[index]) {
        next[index] = "";
        onChange(next.join(""));
      } else if (index > 0) {
        next[index - 1] = "";
        onChange(next.join(""));
        focusAt(index - 1);
      }
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusAt(index + 1);
    }
  };

  return (
    <div
      className={`fl-otp-row${invalid ? " is-invalid" : ""}`}
      role="group"
      aria-label="6-digit code"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          className={digit ? "filled" : ""}
          value={digit}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          aria-label={`Digit ${index + 1}`}
          onChange={(event) =>
            apply(index, event.target.value)
          }
          onKeyDown={(event) =>
            onKeyDown(index, event)
          }
          onFocus={(event) => event.target.select()}
          onPaste={(event) => {
            event.preventDefault();
            apply(0, event.clipboardData.getData("text"));
          }}
        />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------
   Page
   --------------------------------------------------------- */

function LoginForm() {
  const params = useSearchParams();

  const fromBrowser = params.get("from") === "browser";
  const rawNext = params.get("next") || "/";

  const next =
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//")
      ? rawNext
      : "/";

  const rawCode = params.get("code") || "";
  const code = CODE_RE.test(rawCode) ? rawCode : "";

  const [mode, setMode] = useState("login");

  // form | twofa | verify | forgot | reset
  const [step, setStep] = useState("form");

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [twofaCode, setTwofaCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);

  const [verifyCode, setVerifyCode] = useState("");

  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] =
    useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [capsOn, setCapsOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(0);
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const [link, setLink] = useState("idle");
  const [linkError, setLinkError] = useState("");

  const strength = passwordStrength(
    step === "reset" ? newPassword : form.password
  );

  const finish = (account) => {
    setUser(account);

    if (!fromBrowser && !code) {
      window.location.assign(next);
    }
  };

  const showCodeError = (message) => {
    setError(message);
    setShake((value) => value + 1);
  };

  const onPointerMove = (event) => {
    const node = event.currentTarget;

    node.style.setProperty("--mx", `${event.clientX}px`);
    node.style.setProperty("--my", `${event.clientY}px`);
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

  /* Already signed in? */
  useEffect(() => {
    let cancelled = false;

    authFetch("/me")
      .then((data) => {
        const account = data && (data.user || data);

        if (
          !cancelled &&
          account &&
          (account.id || account.username || account.email)
        ) {
          setUser(account);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /* Shared resend countdown */
  useEffect(() => {
    if (cooldown <= 0) return undefined;

    const timer = setTimeout(
      () => setCooldown((value) => value - 1),
      1000
    );

    return () => clearTimeout(timer);
  }, [cooldown]);

  const set = (key) => (event) => {
    setForm((value) => ({
      ...value,
      [key]: event.target.value,
    }));
  };

  const resetToForm = () => {
    setStep("form");
    setTwofaCode("");
    setUseBackup(false);
    setVerifyCode("");
    setResetCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setError("");
    setNotice("");
    setBusy(false);
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setNotice("");
  };

  const openForgotPassword = () => {
    setStep("forgot");
    setResetCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setError("");
    setNotice("");
  };

  /* -------------------------------------------------------
     FORGOT PASSWORD: REQUEST RESET CODE
     POST /auth/forgot-password
     ------------------------------------------------------- */

  const submitForgotPassword = async (event) => {
    event.preventDefault();

    if (busy) return;

    setError("");
    setNotice("");

    const email = form.email.trim();

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      setError("Enter a valid email address.");
      return;
    }

    setBusy(true);

    try {
      await authFetch("/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      setStep("reset");
      setResetCode("");
      setNewPassword("");
      setConfirmNewPassword("");
      setCooldown(RESEND_COOLDOWN_S);

      setNotice(
        "If an account exists with that email, password reset instructions will be sent. Check your inbox."
      );
    } catch (requestError) {
      setError(
        requestError.status === undefined
          ? "Can't reach Fades right now. Check your connection and try again."
          : requestError.message
      );
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------------------------------
     FORGOT PASSWORD: RESEND CODE
     ------------------------------------------------------- */

  const resendPasswordReset = async () => {
    if (busy || cooldown > 0) return;

    setError("");
    setNotice("");
    setBusy(true);

    try {
      await authFetch("/forgot-password", {
        method: "POST",
        body: JSON.stringify({
          email: form.email.trim(),
        }),
      });

      setCooldown(RESEND_COOLDOWN_S);

      setNotice(
        "If an account exists with that email, a reset code will be sent."
      );
    } catch (requestError) {
      setError(
        requestError.status === undefined
          ? "Can't reach Fades right now. Check your connection and try again."
          : requestError.message
      );
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------------------------------
     RESET PASSWORD
     POST /auth/reset-password
     ------------------------------------------------------- */

  const submitResetPassword = async (event) => {
    event.preventDefault();

    if (busy) return;

    setError("");
    setNotice("");

    if (!/^\d{6}$/.test(resetCode)) {
      setError("Enter the 6-digit password reset code.");
      return;
    }

    if (
      newPassword.length < MIN_PASSWORD_LENGTH ||
      newPassword.length > MAX_PASSWORD_LENGTH
    ) {
      setError(
        `Your new password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`
      );
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("Your passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      await authFetch("/reset-password", {
        method: "POST",
        body: JSON.stringify({
          email: form.email.trim(),
          code: resetCode,
          newPassword,
        }),
      });

      setStep("form");
      setMode("login");

      setForm((value) => ({
        ...value,
        password: "",
      }));

      setResetCode("");
      setNewPassword("");
      setConfirmNewPassword("");

      setError("");
      setNotice(
        "Password reset successfully. Sign in with your new password."
      );

      setShowPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (resetError) {
      setError(
        resetError.status === undefined
          ? "Can't reach Fades right now. Check your connection and try again."
          : resetError.message
      );
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------------------------------
     EMAIL VERIFICATION
     ------------------------------------------------------- */

  const sendCode = async (email, { auto = false } = {}) => {
    setError("");

    try {
      await authFetch("/resend-verification", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
        }),
      });

      setNotice(
        `We sent a 6-digit code to ${email.trim()}.`
      );

      setCooldown(RESEND_COOLDOWN_S);
    } catch (sendError) {
      if (auto) {
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

  const submitVerify = async (value) => {
    if (busy) return;

    setError("");

    if (!/^\d{6}$/.test(value)) {
      showCodeError(
        "Enter the 6-digit code from your email."
      );
      return;
    }

    setBusy(true);

    try {
      const data = await authFetch("/verify-email", {
        method: "POST",
        body: JSON.stringify({
          email: form.email.trim(),
          code: value,
        }),
      });

      finish((data && data.user) || {});
    } catch (verifyError) {
      setVerifyCode("");

      showCodeError(
        verifyError.status === undefined
          ? "Can't reach Fades right now. Check your connection and try again."
          : verifyError.message
      );
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------------------------------
     SIGN IN / SIGN UP
     ------------------------------------------------------- */

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

      if (form.password.length < MIN_PASSWORD_LENGTH) {
        setError("Password must be at least 8 characters.");
        return;
      }
    }

    setBusy(true);

    try {
      const data = await authFetch(
        mode === "signup" ? "/signup" : "/login",
        {
          method: "POST",
          body: JSON.stringify(buildBody(mode, form)),
        }
      );

      if (data && data.requiresEmailVerification) {
        setVerifyCode("");
        setStep("verify");

        setNotice(
          `We sent a 6-digit code to ${form.email.trim()}.`
        );

        setCooldown(RESEND_COOLDOWN_S);
        return;
      }

      let account =
        data &&
        (data.user ||
          (data.id || data.username ? data : null));

      if (!account) {
        const me = await authFetch("/me");
        account = me && (me.user || me);
      }

      finish(account || {});
    } catch (submitError) {
      const data = submitError.data;

      if (
        data &&
        data.requiresTwoFactor &&
        data.error === "TWOFA_REQUIRED"
      ) {
        setTwofaCode("");
        setUseBackup(false);
        setStep("twofa");
      } else if (
        submitError.status === 403 &&
        data &&
        data.requiresEmailVerification
      ) {
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

  /* -------------------------------------------------------
     TWO-STEP VERIFICATION
     ------------------------------------------------------- */

  const submitTwofa = async (value) => {
    if (busy) return;

    setError("");

    const cleaned = String(value || "").trim();

    if (!cleaned) {
      showCodeError(
        "Enter your 6-digit code or a backup code."
      );
      return;
    }

    setBusy(true);

    try {
      const data = await authFetch("/login", {
        method: "POST",
        body: JSON.stringify({
          ...buildBody("login", form),
          code: cleaned,
        }),
      });

      let account = data && data.user;

      if (!account) {
        const me = await authFetch("/me");
        account = me && (me.user || me);
      }

      finish(account || {});
    } catch (twofaError) {
      setTwofaCode("");

      showCodeError(
        twofaError.status === undefined
          ? "Can't reach Fades right now. Check your connection and try again."
          : twofaError.message
      );
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------------------------------
     SIGN OUT
     ------------------------------------------------------- */

  const signOut = async () => {
    try {
      await authFetch("/logout", {
        method: "POST",
      });
    } catch {}

    setUser(null);
    setLink("idle");
    setLinkError("");
    resetToForm();

    setForm((value) => ({
      ...value,
      password: "",
    }));
  };

  const name =
    user &&
    (user.username ||
      user.name ||
      user.email ||
      "your account");

  const stepKey = user
    ? `done-${link}`
    : step === "form"
      ? `form-${mode}`
      : step;

  return (
    <main
      className="fl-page"
      onPointerMove={onPointerMove}
    >
      <Background />

      <div className="fl-stack">
        <section className="fl-card">
          <div className="fl-brand">
            <span className="fl-logo">
              <img
                src={LOGO}
                alt=""
                width="40"
                height="40"
              />
            </span>

            <strong>Fades</strong>
          </div>

          {checking ? (
            <div className="fl-center">
              <div className="fl-spinner" />
            </div>
          ) : (
            <div className="fl-step" key={stepKey}>
              {/* -------------------------------------------
                  BROWSER CONNECTION
                 ------------------------------------------- */}

              {user && code ? (
                <div className="fl-done">
                  {link === "linked" ? (
                    <>
                      <CheckIcon />

                      <h1>Browser connected</h1>

                      <p>
                        You're signed in. This tab will close
                        on its own — if it doesn't, you can
                        close it.
                      </p>
                    </>
                  ) : link === "cancelled" ? (
                    <>
                      <h1>Not connected</h1>

                      <p>
                        Nothing was shared with the browser.
                        You can close this tab.
                      </p>
                    </>
                  ) : (
                    <>
                      <Avatar user={user} />

                      <h1>Connect Fades Browser?</h1>

                      <p>
                        Signed in as <b>{name}</b>. Only
                        continue if this code matches the one
                        shown in your browser:
                      </p>

                      <div className="fl-code">
                        {formatUserCode(code)}
                      </div>

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
                          {link === "linking" ? (
                            <>
                              <Spinner /> Connecting…
                            </>
                          ) : (
                            "Yes, connect"
                          )}
                        </button>

                        <button
                          className="fl-ghost"
                          onClick={() => setLink("cancelled")}
                        >
                          Cancel
                        </button>
                      </div>

                      <p className="fl-foot">
                        Not you?{" "}
                        <button
                          type="button"
                          onClick={signOut}
                        >
                          Switch account
                        </button>
                      </p>
                    </>
                  )}
                </div>
              ) : user ? (
                <div className="fl-done">
                  <Avatar user={user} />

                  <h1>You're signed in</h1>

                  <p>
                    Signed in as <b>{name}</b>.
                    {fromBrowser
                      ? " You can close this tab and head back to Fades Browser — your sync will pick up automatically."
                      : ""}
                  </p>

                  <div className="fl-actions">
                    {!fromBrowser && (
                      <button
                        className="fl-primary"
                        onClick={() =>
                          window.location.assign(next)
                        }
                      >
                        Continue
                      </button>
                    )}

                    <button
                      className="fl-ghost"
                      onClick={signOut}
                    >
                      Switch account
                    </button>
                  </div>
                </div>
              ) : step === "forgot" ? (
                /* -----------------------------------------
                   FORGOT PASSWORD
                   ----------------------------------------- */

                <>
                  <div className="fl-badge" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect
                        x="5"
                        y="10"
                        width="14"
                        height="11"
                        rx="2"
                      />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                      <path d="M12 14v3" />
                    </svg>
                  </div>

                  <h1>Forgot your password?</h1>

                  <p className="fl-sub">
                    No worries. Enter the email address
                    associated with your Fades account and
                    we'll help you reset it.
                  </p>

                  <form
                    onSubmit={submitForgotPassword}
                    noValidate
                  >
                    <label>
                      <span>Email address</span>

                      <input
                        type="email"
                        value={form.email}
                        onChange={set("email")}
                        autoComplete="email"
                        autoCapitalize="off"
                        spellCheck={false}
                        placeholder="you@example.com"
                        autoFocus
                        required
                      />
                    </label>

                    {error && (
                      <div className="fl-error" role="alert">
                        {error}
                      </div>
                    )}

                    <button
                      className="fl-primary"
                      type="submit"
                      disabled={busy}
                    >
                      {busy ? (
                        <>
                          <Spinner /> Sending code…
                        </>
                      ) : (
                        "Send reset code"
                      )}
                    </button>
                  </form>

                  <p className="fl-foot fl-foot-tight">
                    <button
                      type="button"
                      onClick={resetToForm}
                    >
                      ← Back to sign in
                    </button>
                  </p>
                </>
              ) : step === "reset" ? (
                /* -----------------------------------------
                   ENTER RESET CODE + NEW PASSWORD
                   ----------------------------------------- */

                <>
                  <div className="fl-badge" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect
                        x="5"
                        y="10"
                        width="14"
                        height="11"
                        rx="2"
                      />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                      <path d="M12 14v3" />
                    </svg>
                  </div>

                  <h1>Reset your password</h1>

                  <p className="fl-sub">
                    Enter the six-digit code sent to{" "}
                    <b>{form.email.trim()}</b>, then choose
                    a new password.
                  </p>

                  <form
                    onSubmit={submitResetPassword}
                    noValidate
                  >
                    <label>
                      <span>6-digit reset code</span>

                      <OtpInput
                        key={`reset-${shake}`}
                        value={resetCode}
                        onChange={setResetCode}
                        onComplete={() => {}}
                        disabled={busy}
                        invalid={Boolean(error)}
                      />
                    </label>

                    <label>
                      <span>New password</span>

                      <div className="fl-password">
                        <input
                          type={
                            showNewPassword
                              ? "text"
                              : "password"
                          }
                          value={newPassword}
                          onChange={(event) =>
                            setNewPassword(event.target.value)
                          }
                          autoComplete="new-password"
                          placeholder="At least 8 characters"
                          maxLength={MAX_PASSWORD_LENGTH}
                          required
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowNewPassword((value) => !value)
                          }
                          aria-label={
                            showNewPassword
                              ? "Hide new password"
                              : "Show new password"
                          }
                        >
                          {showNewPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </label>

                    {newPassword && (
                      <div
                        className="fl-strength"
                        data-score={strength.score}
                      >
                        <div className="fl-strength-bars">
                          <i />
                          <i />
                          <i />
                          <i />
                        </div>

                        <span>{strength.label}</span>
                      </div>
                    )}

                    <label>
                      <span>Confirm new password</span>

                      <div className="fl-password">
                        <input
                          type={
                            showConfirmPassword
                              ? "text"
                              : "password"
                          }
                          value={confirmNewPassword}
                          onChange={(event) =>
                            setConfirmNewPassword(
                              event.target.value
                            )
                          }
                          autoComplete="new-password"
                          placeholder="Enter your new password again"
                          maxLength={MAX_PASSWORD_LENGTH}
                          required
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword(
                              (value) => !value
                            )
                          }
                          aria-label={
                            showConfirmPassword
                              ? "Hide confirmation password"
                              : "Show confirmation password"
                          }
                        >
                          {showConfirmPassword
                            ? "Hide"
                            : "Show"}
                        </button>
                      </div>
                    </label>

                    {notice && (
                      <div className="fl-notice" role="status">
                        {notice}
                      </div>
                    )}

                    {error && (
                      <div className="fl-error" role="alert">
                        {error}
                      </div>
                    )}

                    <button
                      className="fl-primary"
                      type="submit"
                      disabled={busy}
                    >
                      {busy ? (
                        <>
                          <Spinner /> Resetting password…
                        </>
                      ) : (
                        "Reset password"
                      )}
                    </button>
                  </form>

                  <p className="fl-foot">
                    Didn't receive a code?{" "}
                    <button
                      type="button"
                      onClick={resendPasswordReset}
                      disabled={busy || cooldown > 0}
                    >
                      {cooldown > 0
                        ? `Resend in ${cooldown}s`
                        : "Resend code"}
                    </button>
                  </p>

                  <p className="fl-foot fl-foot-tight">
                    <button
                      type="button"
                      onClick={resetToForm}
                    >
                      ← Back to sign in
                    </button>
                  </p>
                </>
              ) : step === "twofa" ? (
                /* -----------------------------------------
                   TWO-FACTOR AUTHENTICATION
                   ----------------------------------------- */

                <>
                  <div className="fl-badge" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />
                      <path d="M9 12l2 2 4-4" />
                    </svg>
                  </div>

                  <h1>Two-step verification</h1>

                  <p className="fl-sub">
                    {useBackup
                      ? "Enter one of your backup codes. Each one works only once."
                      : "Enter the 6-digit code from your authenticator app."}
                  </p>

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      submitTwofa(twofaCode);
                    }}
                    noValidate
                  >
                    {useBackup ? (
                      <label>
                        <span>Backup code</span>

                        <input
                          className="fl-mono"
                          value={twofaCode}
                          onChange={(event) =>
                            setTwofaCode(event.target.value)
                          }
                          autoCapitalize="off"
                          autoComplete="off"
                          spellCheck={false}
                          maxLength={12}
                          placeholder="xxxxx-xxxxx"
                          autoFocus
                        />
                      </label>
                    ) : (
                      <OtpInput
                        key={shake}
                        value={twofaCode}
                        onChange={setTwofaCode}
                        onComplete={submitTwofa}
                        disabled={busy}
                        invalid={Boolean(error)}
                      />
                    )}

                    {error && (
                      <div className="fl-error" role="alert">
                        {error}
                      </div>
                    )}

                    {useBackup && (
                      <button
                        className="fl-primary"
                        type="submit"
                        disabled={busy}
                      >
                        {busy ? (
                          <>
                            <Spinner /> Checking…
                          </>
                        ) : (
                          "Verify and sign in"
                        )}
                      </button>
                    )}
                  </form>

                  <p className="fl-foot">
                    <button
                      type="button"
                      onClick={() => {
                        setUseBackup((value) => !value);
                        setTwofaCode("");
                        setError("");
                      }}
                    >
                      {useBackup
                        ? "Use authenticator app instead"
                        : "Use a backup code instead"}
                    </button>
                  </p>

                  <p className="fl-foot fl-foot-tight">
                    <button
                      type="button"
                      onClick={resetToForm}
                    >
                      ← Back to sign in
                    </button>
                  </p>
                </>
              ) : step === "verify" ? (
                /* -----------------------------------------
                   EMAIL VERIFICATION
                   ----------------------------------------- */

                <>
                  <div className="fl-badge" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect
                        x="3"
                        y="5"
                        width="18"
                        height="14"
                        rx="3"
                      />
                      <path d="M4 7.5l8 5.5 8-5.5" />
                    </svg>
                  </div>

                  <h1>Verify your email</h1>

                  <p className="fl-sub">
                    Enter the 6-digit code we emailed to{" "}
                    <b>{form.email.trim()}</b>. It expires
                    in 10 minutes.
                  </p>

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      submitVerify(verifyCode);
                    }}
                    noValidate
                  >
                    <OtpInput
                      key={shake}
                      value={verifyCode}
                      onChange={setVerifyCode}
                      onComplete={submitVerify}
                      disabled={busy}
                      invalid={Boolean(error)}
                    />

                    {notice && (
                      <div className="fl-notice" role="status">
                        {notice}
                      </div>
                    )}

                    {error && (
                      <div className="fl-error" role="alert">
                        {error}
                      </div>
                    )}

                    <button
                      className="fl-primary"
                      type="submit"
                      disabled={busy}
                    >
                      {busy ? (
                        <>
                          <Spinner /> Verifying…
                        </>
                      ) : (
                        "Verify email"
                      )}
                    </button>
                  </form>

                  <p className="fl-foot">
                    Didn't get it?{" "}
                    <button
                      type="button"
                      onClick={() => sendCode(form.email)}
                      disabled={cooldown > 0}
                    >
                      {cooldown > 0
                        ? `Resend in ${cooldown}s`
                        : "Resend code"}
                    </button>
                  </p>

                  <p className="fl-foot fl-foot-tight">
                    <button
                      type="button"
                      onClick={resetToForm}
                    >
                      ← Back to sign in
                    </button>
                  </p>
                </>
              ) : (
                /* -----------------------------------------
                   SIGN IN / SIGN UP
                   ----------------------------------------- */

                <>
                  <h1>
                    {mode === "login"
                      ? "Welcome back"
                      : "Create your account"}
                  </h1>

                  <p className="fl-sub">
                    {mode === "login"
                      ? "Sign in to sync your bookmarks, history and tabs."
                      : "One account for Fades Browser, Chat and Mail."}
                  </p>

                  <div
                    className="fl-tabs"
                    role="tablist"
                    data-mode={mode}
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === "login"}
                      className={
                        mode === "login" ? "active" : ""
                      }
                      onClick={() => switchMode("login")}
                    >
                      Sign in
                    </button>

                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === "signup"}
                      className={
                        mode === "signup" ? "active" : ""
                      }
                      onClick={() => switchMode("signup")}
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
                          type={
                            showPassword ? "text" : "password"
                          }
                          value={form.password}
                          onChange={set("password")}
                          onKeyUp={(event) =>
                            setCapsOn(
                              event.getModifierState("CapsLock")
                            )
                          }
                          onKeyDown={(event) =>
                            setCapsOn(
                              event.getModifierState("CapsLock")
                            )
                          }
                          onBlur={() => setCapsOn(false)}
                          autoComplete={
                            mode === "login"
                              ? "current-password"
                              : "new-password"
                          }
                          placeholder={
                            mode === "login"
                              ? "Your password"
                              : "At least 8 characters"
                          }
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowPassword((value) => !value)
                          }
                          aria-label={
                            showPassword
                              ? "Hide password"
                              : "Show password"
                          }
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>

                      {capsOn && (
                        <em className="fl-hint">
                          Caps Lock is on
                        </em>
                      )}
                    </label>

                    {mode === "signup" && form.password && (
                      <div
                        className="fl-strength"
                        data-score={strength.score}
                      >
                        <div className="fl-strength-bars">
                          <i />
                          <i />
                          <i />
                          <i />
                        </div>

                        <span>{strength.label}</span>
                      </div>
                    )}

                    {error && (
                      <div className="fl-error" role="alert">
                        {error}
                      </div>
                    )}

                    {notice && (
                      <div className="fl-notice" role="status">
                        {notice}
                      </div>
                    )}

                    <button
                      className="fl-primary"
                      type="submit"
                      disabled={busy}
                    >
                      {busy ? (
                        <>
                          <Spinner /> Please wait…
                        </>
                      ) : mode === "login" ? (
                        "Sign in"
                      ) : (
                        "Create account"
                      )}
                    </button>
                  </form>

                  {/* FORGOT PASSWORD BUTTON */}
                  {mode === "login" && (
                    <p className="fl-foot fl-foot-tight">
                      <button
                        type="button"
                        onClick={openForgotPassword}
                      >
                        Forgot your password?
                      </button>
                    </p>
                  )}

                  <p className="fl-foot">
                    {mode === "login"
                      ? "New to Fades? "
                      : "Already have an account? "}

                    <button
                      type="button"
                      onClick={() =>
                        switchMode(
                          mode === "login" ? "signup" : "login"
                        )
                      }
                    >
                      {mode === "login"
                        ? "Create an account"
                        : "Sign in"}
                    </button>
                  </p>
                </>
              )}
            </div>
          )}
        </section>

        <div className="fl-chips" aria-hidden="true">
          <span>Fades Browser</span>
          <span>Fades Chat</span>
          <span>Fades Mail</span>
        </div>
      </div>
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
