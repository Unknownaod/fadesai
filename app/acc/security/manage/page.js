
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "./account.css";

const API_BASE = (
  process.env.NEXT_PUBLIC_FADES_API || "https://api.fades.lol"
).replace(/\/+$/, "");

const NAV_ITEMS = [
  {
    id: "profile",
    label: "Profile",
    icon: "◉",
    description: "Your public identity",
  },
  {
    id: "billing",
    label: "Billing",
    icon: "$",
    description: "Plan and payments",
  },
  {
    id: "security",
    label: "Security",
    icon: "◇",
    description: "Password and protection",
  },
  {
    id: "devices",
    label: "Devices",
    icon: "▣",
    description: "Where you're signed in",
  },
  {
    id: "activity",
    label: "Activity",
    icon: "↗",
    description: "Recent account activity",
  },
  {
    id: "danger",
    label: "Delete account",
    icon: "⌫",
    description: "Permanently remove your account",
  },
];

function formatDate(value) {
  if (!value) return "Unknown";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Unknown"
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function formatShortDate(value) {
  if (!value) return "Unknown";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Unknown"
    : date.toLocaleDateString(undefined, {
        dateStyle: "medium",
      });
}

function getError(data, fallback) {
  return data?.error || data?.message || fallback;
}

function titleCase(value) {
  if (!value) return "Not available";

  return String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMoney(amount, currency = "CAD", options = {}) {
  if (amount === null || amount === undefined || amount === "") {
    return "Not available";
  }

  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return String(amount);
  }

  // The API should return Stripe amounts in minor currency units,
  // such as cents. Set amountInMinorUnits to false for decimal amounts.
  const normalizedAmount = options.amountInMinorUnits === false
    ? numericAmount
    : numericAmount / 100;

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: String(currency || "CAD").toUpperCase(),
    }).format(normalizedAmount);
  } catch {
    return `${normalizedAmount.toFixed(2)} ${currency || "CAD"}`;
  }
}

function safeExternalUrl(value, allowedHosts = []) {
  if (!value) return null;

  try {
    const url = new URL(value);

    if (url.protocol !== "https:") return null;

    if (
      allowedHosts.length > 0 &&
      !allowedHosts.includes(url.hostname)
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function getUserInitials(profile, user) {
  const name =
    profile.name ||
    profile.username ||
    user?.email ||
    "Fades user";

  return (
    name
      .trim()
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "F"
  );
}

function getSubscriptionStatus(subscription) {
  if (!subscription) return "Free plan";

  return titleCase(subscription.status || "unknown");
}

function isSubscriptionActive(subscription) {
  return ["active", "trialing"].includes(
    String(subscription?.status || "").toLowerCase()
  );
}

function getBillingPrice(billing) {
  const subscription = billing.subscription;
  const plan = billing.plan;

  if (subscription?.price != null) {
    return {
      amount: subscription.price,
      currency: subscription.currency || plan?.currency || "CAD",
      interval: subscription.interval || plan?.interval || "",
    };
  }

  if (plan?.price != null) {
    return {
      amount: plan.price,
      currency: plan.currency || "CAD",
      interval: plan.interval || "",
    };
  }

  return null;
}

export default function AccountPage() {
  const [activeSection, setActiveSection] = useState("profile");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const [profile, setProfile] = useState({
    username: "",
    name: "",
    email: "",
    bio: "",
    avatar: "",
    currentPassword: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    signOutOthers: true,
  });

  const [sessions, setSessions] = useState([]);
  const [activity, setActivity] = useState([]);

  const [twofa, setTwofa] = useState({
    enabled: false,
    backupCodesLeft: 0,
    setup: null,
    code: "",
    password: "",
    backupCodes: [],
  });

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");

  const [billing, setBilling] = useState({
    loading: false,
    loaded: false,
    available: false,
    plan: null,
    subscription: null,
    invoices: [],
    paymentMethod: null,
    billingDetails: null,
    error: "",
  });

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
      throw new Error(
        getError(data, `Request failed (${response.status}).`)
      );
    }

    return data;
  }, []);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const data = await request("/auth/me");

      if (!data.authenticated || !data.user) {
        throw new Error("Sign in to manage your Fades account.");
      }

      setUser(data.user);

      setProfile({
        username: data.user.username || "",
        name: data.user.displayName || data.user.name || "",
        email: data.user.email || "",
        bio: data.user.bio || "",
        avatar: data.user.avatar || "",
        currentPassword: "",
      });

      setTwofa((current) => ({
        ...current,
        enabled: Boolean(data.user.twofaEnabled),
      }));
    } catch (error) {
      setPageError(error.message || "Unable to load your account.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  const loadSessions = useCallback(async () => {
    try {
      const data = await request("/auth/sessions");
      setSessions(data.sessions || []);
    } catch (error) {
      setNotice(error.message);
    }
  }, [request]);

  const loadActivity = useCallback(async () => {
    try {
      const data = await request("/auth/activity");
      setActivity(data.events || []);
    } catch (error) {
      setNotice(error.message);
    }
  }, [request]);

  const loadTwofa = useCallback(async () => {
    try {
      const data = await request("/auth/2fa/status");

      setTwofa((current) => ({
        ...current,
        enabled: Boolean(data.enabled),
        backupCodesLeft: data.backupCodesLeft || 0,
      }));
    } catch (error) {
      setNotice(error.message);
    }
  }, [request]);

  const loadBilling = useCallback(async () => {
    setBilling((current) => ({
      ...current,
      loading: true,
      error: "",
    }));

    try {
      const data = await request("/billing/overview");

      setBilling({
        loading: false,
        loaded: true,
        available: true,
        plan: data.plan || data.subscription?.plan || null,
        subscription: data.subscription || null,
        invoices: Array.isArray(data.invoices) ? data.invoices : [],
        paymentMethod: data.paymentMethod || null,
        billingDetails: data.billingDetails || null,
        error: "",
      });
    } catch (error) {
      setBilling((current) => ({
        ...current,
        loading: false,
        loaded: true,
        available: false,
        error:
          error.message ||
          "Unable to load your billing information.",
      }));
    }
  }, [request]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    if (activeSection === "devices") loadSessions();
    if (activeSection === "activity") loadActivity();
    if (activeSection === "security") loadTwofa();
    if (activeSection === "billing" && !billing.loaded) loadBilling();
  }, [
    activeSection,
    billing.loaded,
    loadSessions,
    loadActivity,
    loadTwofa,
    loadBilling,
  ]);

  const initials = useMemo(
    () => getUserInitials(profile, user),
    [profile, user]
  );

  async function runAction(action, successMessage) {
    setBusy(true);
    setNotice("");

    try {
      await action();

      if (successMessage) {
        setNotice(successMessage);
      }
    } catch (error) {
      setNotice(error.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();

    await runAction(async () => {
      const body = {
        username: profile.username,
        name: profile.name,
        bio: profile.bio,
        avatar: profile.avatar,
      };

      if (profile.email !== (user?.email || "")) {
        body.email = profile.email;
        body.currentPassword = profile.currentPassword;
      }

      const data = await request("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      if (data.user) {
        setUser((current) => ({ ...current, ...data.user }));
      }

      setProfile((current) => ({
        ...current,
        currentPassword: "",
        email: data.user?.email || current.email,
      }));

      setNotice(
        data.message || "Your profile has been saved."
      );
    });
  }

  async function changePassword(event) {
    event.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setNotice("Your new passwords don't match.");
      return;
    }

    await runAction(async () => {
      await request("/auth/password/change", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          signOutOthers: passwordForm.signOutOthers,
        }),
      });

      const shouldRefreshSessions = passwordForm.signOutOthers;

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        signOutOthers: true,
      });

      if (shouldRefreshSessions) {
        await loadSessions();
      }

      setNotice("Your password has been changed.");
    });
  }

  async function startTwofa() {
    await runAction(async () => {
      const data = await request("/auth/2fa/setup", {
        method: "POST",
        body: JSON.stringify({}),
      });

      setTwofa((current) => ({
        ...current,
        setup: data,
        code: "",
        backupCodes: [],
      }));

      setNotice("Scan the QR code with your authenticator app.");
    });
  }

  async function enableTwofa(event) {
    event.preventDefault();

    await runAction(async () => {
      const data = await request("/auth/2fa/enable", {
        method: "POST",
        body: JSON.stringify({ code: twofa.code }),
      });

      setTwofa((current) => ({
        ...current,
        enabled: true,
        setup: null,
        code: "",
        backupCodes: data.backupCodes || [],
        backupCodesLeft: (data.backupCodes || []).length,
      }));

      setUser((current) => ({
        ...current,
        twofaEnabled: true,
      }));

      setNotice(
        "Two-step verification is enabled. Save your backup codes somewhere safe."
      );
    });
  }

  async function disableTwofa(event) {
    event.preventDefault();

    await runAction(async () => {
      await request("/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify({
          password: twofa.password,
          code: twofa.code,
        }),
      });

      setTwofa((current) => ({
        ...current,
        enabled: false,
        password: "",
        code: "",
        setup: null,
        backupCodes: [],
        backupCodesLeft: 0,
      }));

      setUser((current) => ({
        ...current,
        twofaEnabled: false,
      }));

      setNotice("Two-step verification has been turned off.");
    });
  }

  async function regenerateBackupCodes(event) {
    event.preventDefault();

    await runAction(async () => {
      const data = await request("/auth/2fa/backup-codes", {
        method: "POST",
        body: JSON.stringify({ password: twofa.password }),
      });

      setTwofa((current) => ({
        ...current,
        backupCodes: data.backupCodes || [],
        backupCodesLeft: (data.backupCodes || []).length,
        password: "",
      }));

      setNotice(
        "New backup codes generated. Your old backup codes no longer work."
      );
    });
  }

  async function resendVerification() {
    await runAction(async () => {
      const data = await request("/auth/email/resend-verification", {
        method: "POST",
        body: JSON.stringify({}),
      });

      setNotice(data.message || "Verification email sent.");
    });
  }

  async function verifyEmail(event) {
    event.preventDefault();

    await runAction(async () => {
      await request("/auth/email/verify", {
        method: "POST",
        body: JSON.stringify({ code: verifyCode }),
      });

      setVerifyCode("");

      const data = await request("/auth/me");

      if (data.user) {
        setUser(data.user);

        setProfile((current) => ({
          ...current,
          email: data.user.email || current.email,
        }));
      }

      setNotice("Your email address has been verified.");
    });
  }

  async function revokeSession(id) {
    await runAction(async () => {
      await request(`/auth/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      setSessions((current) =>
        current.filter((item) => item.id !== id)
      );

      setNotice("Device signed out.");
    });
  }

  async function revokeOtherSessions() {
    await runAction(async () => {
      await request("/auth/sessions/revoke-others", {
        method: "POST",
        body: JSON.stringify({}),
      });

      await loadSessions();
      setNotice("Other devices have been signed out.");
    });
  }

  async function signOut() {
    await runAction(async () => {
      await request("/auth/logout", {
        method: "POST",
        body: JSON.stringify({}),
      });

      window.location.href = "/login";
    });
  }

  async function deleteAccount(event) {
    event.preventDefault();

    if (!deleteConfirmation) {
      setNotice(
        "Confirm that you understand this permanently deletes your account."
      );
      return;
    }

    await runAction(async () => {
      await request("/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ password: deletePassword }),
      });

      window.location.href = "/?accountDeleted=1";
    });
  }

  async function startCheckout() {
    await runAction(async () => {
      const data = await request("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          returnUrl:
            `${window.location.origin}/acc/security/manage?section=billing`,
        }),
      });

      const checkoutUrl = safeExternalUrl(data.url, [
        "checkout.stripe.com",
      ]);

      if (!checkoutUrl) {
        throw new Error(
          "The billing API did not return a valid Stripe Checkout URL."
        );
      }

      window.location.assign(checkoutUrl);
    });
  }

  async function openBillingPortal() {
    await runAction(async () => {
      const data = await request("/billing/portal", {
        method: "POST",
        body: JSON.stringify({
          returnUrl:
            `${window.location.origin}/acc/security/manage?section=billing`,
        }),
      });

      const portalUrl = safeExternalUrl(data.url, [
        "billing.stripe.com",
      ]);

      if (!portalUrl) {
        throw new Error(
          "The billing API did not return a valid Stripe billing portal URL."
        );
      }

      window.location.assign(portalUrl);
    });
  }

  async function refreshBilling() {
    await loadBilling();
  }

  function navigateToSection(section) {
    setActiveSection(section);
    setNotice("");

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("section", section);
      window.history.replaceState({}, "", url);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get("section");

    if (NAV_ITEMS.some((item) => item.id === section)) {
      setActiveSection(section);
    }

    if (params.get("billing") === "success") {
      setNotice(
        "You returned from checkout. Your subscription status will refresh from the billing API."
      );
      setBilling((current) => ({
        ...current,
        loaded: false,
      }));
    }

    if (params.get("billing") === "cancelled") {
      setNotice("Checkout was cancelled. You have not been charged by this return alone.");
    }
  }, []);

  if (loading) {
    return (
      <main className="fa-shell">
        <div className="fa-loading">
          <img className="fa-logo" src="/logo.png" alt="Fades" />
          <span className="fa-spinner" />
          Loading your Fades account…
        </div>
      </main>
    );
  }

  if (pageError) {
    return (
      <main className="fa-shell">
        <div className="fa-auth-card">
          <img className="fa-logo" src="/logo.png" alt="Fades" />
          <h1>Your account, all in one place.</h1>
          <p>{pageError}</p>

          <div className="fa-actions">
            <button
              className="fa-button fa-primary"
              onClick={() => {
                window.location.href = "/login";
              }}
            >
              Sign in
            </button>

            <button
              className="fa-button fa-secondary"
              onClick={loadAccount}
            >
              Try again
            </button>
          </div>
        </div>
      </main>
    );
  }

  const billingPrice = getBillingPrice(billing);
  const subscription = billing.subscription;
  const subscriptionStatus = String(subscription?.status || "").toLowerCase();
  const isPastDue = ["past_due", "unpaid", "incomplete", "incomplete_expired"].includes(
    subscriptionStatus
  );

  return (
    <main className="fa-shell">
      <div className="fa-orb fa-orb-one" />
      <div className="fa-orb fa-orb-two" />

      <header className="fa-topbar">
        <a
          className="fa-brand"
          href="https://fades.lol"
          aria-label="Fades home"
        >
          <img className="fa-brand-logo" src="/logo.png" alt="" />
          <span>
            fades<span className="fa-brand-dot">.</span>
          </span>
        </a>

        <div className="fa-topbar-right">
          <span className="fa-topbar-label">ACCOUNT CENTER</span>

          <button
            className="fa-button fa-secondary fa-small"
            onClick={signOut}
            disabled={busy}
          >
            Sign out <span aria-hidden="true">↗</span>
          </button>
        </div>
      </header>

      <section className="fa-welcome">
        <div>
          <div className="fa-eyebrow">
            <span className="fa-eyebrow-dot" />
            YOUR FADES ID
          </div>

          <h1>
            Account <span>center.</span>
          </h1>

          <p>
            Manage your identity, billing, security, and the devices
            connected to your Fades account.
          </p>
        </div>

        <div className="fa-welcome-mark" aria-hidden="true">
          <img src="/logo.png" alt="" />
        </div>
      </section>

      {notice && (
        <div className="fa-notice" role="status">
          <span>✦</span>
          <span>{notice}</span>

          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      <div className="fa-layout">
        <aside className="fa-sidebar">
          <div className="fa-user-mini">
            <div className="fa-avatar">
              {profile.avatar ? (
                <img src={profile.avatar} alt="" />
              ) : (
                initials
              )}
            </div>

            <div className="fa-user-mini-text">
              <strong>
                {profile.name || profile.username || "Fades user"}
              </strong>
              <span>{user?.email}</span>
            </div>

            <span className="fa-status-dot" title="Signed in" />
          </div>

          <div className="fa-nav-label">MANAGE ACCOUNT</div>

          <nav className="fa-nav" aria-label="Account sections">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`fa-nav-item ${
                  activeSection === item.id ? "is-active" : ""
                } ${item.id === "danger" ? "is-danger" : ""}`}
                onClick={() => navigateToSection(item.id)}
              >
                <span className="fa-nav-icon">{item.icon}</span>

                <span className="fa-nav-copy">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>

                {activeSection === item.id && (
                  <span className="fa-nav-arrow">›</span>
                )}
              </button>
            ))}
          </nav>

          <div className="fa-sidebar-footer">
            <span className="fa-shield">◇</span>
            <div>
              <strong>Your account. Your control.</strong>
              <small>Fades identity settings</small>
            </div>
          </div>
        </aside>

        <section className="fa-content">
          {activeSection === "profile" && (
            <>
              <div className="fa-section-heading">
                <div>
                  <div className="fa-kicker">PERSONAL DETAILS</div>
                  <h2>Your profile</h2>
                  <p>Choose how you appear across Fades services.</p>
                </div>

                <span className="fa-section-symbol">◉</span>
              </div>

              <div className="fa-card fa-profile-card">
                <div className="fa-profile-banner">
                  <div className="fa-profile-avatar">
                    {profile.avatar ? (
                      <img src={profile.avatar} alt="Profile" />
                    ) : (
                      initials
                    )}
                  </div>

                  <div className="fa-profile-intro">
                    <strong>
                      {profile.name || profile.username || "Your name"}
                    </strong>
                    <span>@{profile.username || "username"}</span>
                  </div>

                  <span className="fa-pill">FADES ID</span>
                </div>

                <form className="fa-form" onSubmit={saveProfile}>
                  <div className="fa-form-grid">
                    <label className="fa-field">
                      <span>Display name</span>
                      <input
                        value={profile.name}
                        maxLength={50}
                        onChange={(e) =>
                          setProfile((current) => ({
                            ...current,
                            name: e.target.value,
                          }))
                        }
                        placeholder="How people see you"
                      />
                    </label>

                    <label className="fa-field">
                      <span>Username</span>

                      <div className="fa-input-prefix">
                        <b>@</b>
                        <input
                          value={profile.username}
                          maxLength={24}
                          onChange={(e) =>
                            setProfile((current) => ({
                              ...current,
                              username: e.target.value,
                            }))
                          }
                          placeholder="yourname"
                        />
                      </div>

                      <small>
                        3–24 letters, numbers, dots, dashes or underscores.
                      </small>
                    </label>

                    <label className="fa-field fa-field-wide">
                      <span>Email address</span>
                      <input
                        type="email"
                        value={profile.email}
                        onChange={(e) =>
                          setProfile((current) => ({
                            ...current,
                            email: e.target.value,
                          }))
                        }
                        required
                      />

                      <small className="fa-inline-status">
                        {user?.emailVerified ? (
                          <>
                            <span className="fa-green-dot" />
                            Verified email
                          </>
                        ) : (
                          <>
                            <span className="fa-yellow-dot" />
                            Email not verified
                          </>
                        )}
                      </small>
                    </label>

                    {profile.email !== (user?.email || "") && (
                      <label className="fa-field fa-field-wide">
                        <span>
                          Current password <em>Required to change email</em>
                        </span>

                        <input
                          type="password"
                          autoComplete="current-password"
                          value={profile.currentPassword}
                          onChange={(e) =>
                            setProfile((current) => ({
                              ...current,
                              currentPassword: e.target.value,
                            }))
                          }
                          required
                        />
                      </label>
                    )}

                    <label className="fa-field fa-field-wide">
                      <span>Avatar image URL</span>
                      <input
                        type="url"
                        value={profile.avatar}
                        onChange={(e) =>
                          setProfile((current) => ({
                            ...current,
                            avatar: e.target.value,
                          }))
                        }
                        placeholder="https://example.com/avatar.png"
                      />
                      <small>Use a secure https:// image URL.</small>
                    </label>

                    <label className="fa-field fa-field-wide">
                      <span>
                        Bio <em>{profile.bio.length}/200</em>
                      </span>
                      <textarea
                        value={profile.bio}
                        maxLength={200}
                        rows={3}
                        onChange={(e) =>
                          setProfile((current) => ({
                            ...current,
                            bio: e.target.value,
                          }))
                        }
                        placeholder="A little about you…"
                      />
                    </label>
                  </div>

                  <div className="fa-form-footer">
                    <span>Changes apply to your Fades account.</span>

                    <button
                      className="fa-button fa-primary"
                      type="submit"
                      disabled={busy}
                    >
                      {busy ? "Saving…" : "Save changes"}
                      <span>↗</span>
                    </button>
                  </div>
                </form>
              </div>

              {!user?.emailVerified && (
                <div className="fa-card fa-verification-card">
                  <div className="fa-inline-icon fa-icon-warn">!</div>

                  <div className="fa-flex-grow">
                    <h3>Verify your email</h3>
                    <p>
                      Verify your email address to help keep your account
                      secure.
                    </p>

                    <button
                      className="fa-button fa-secondary"
                      onClick={resendVerification}
                      disabled={busy}
                    >
                      Send verification code
                    </button>

                    <form className="fa-verify-form" onSubmit={verifyEmail}>
                      <input
                        value={verifyCode}
                        inputMode="numeric"
                        maxLength={6}
                        pattern="[0-9]{6}"
                        onChange={(e) =>
                          setVerifyCode(e.target.value.replace(/\D/g, ""))
                        }
                        placeholder="6-digit code"
                        aria-label="Email verification code"
                        required
                      />

                      <button
                        className="fa-button fa-primary"
                        disabled={busy || verifyCode.length !== 6}
                      >
                        Verify
                      </button>
                    </form>
                  </div>
                </div>
              )}

              <div className="fa-card fa-info-row">
                <div className="fa-inline-icon">⌁</div>

                <div className="fa-flex-grow">
                  <h3>Fades account</h3>
                  <p>Your shared identity for Fades services.</p>
                </div>

                <div className="fa-info-right">
                  <span>MEMBER SINCE</span>
                  <strong>{formatShortDate(user?.createdAt)}</strong>
                </div>
              </div>
            </>
          )}

          {activeSection === "billing" && (
            <>
              <div className="fa-section-heading">
                <div>
                  <div className="fa-kicker">SUBSCRIPTION & PAYMENTS</div>
                  <h2>Billing</h2>
                  <p>
                    Manage your Fades plan, payment methods, invoices,
                    and subscription.
                  </p>
                </div>

                <span className="fa-section-symbol">$</span>
              </div>

              {billing.loading && (
                <div className="fa-card fa-billing-loading">
                  <span className="fa-spinner" />
                  Loading your billing information…
                </div>
              )}

              {!billing.loading && billing.error && (
                <div className="fa-card fa-billing-unavailable">
                  <div className="fa-inline-icon fa-icon-warn">!</div>

                  <div className="fa-flex-grow">
                    <h3>Billing information unavailable</h3>
                    <p>{billing.error}</p>
                    <p>
                      Your account and security settings are still
                      available. Check that your billing API is configured.
                    </p>

                    <button
                      className="fa-button fa-secondary"
                      onClick={refreshBilling}
                      disabled={busy}
                    >
                      Try again
                    </button>
                  </div>
                </div>
              )}

              {!billing.loading && billing.available && (
                <>
                  <div className="fa-card fa-billing-hero">
                    <div className="fa-billing-hero-top">
                      <div>
                        <div className="fa-kicker">YOUR CURRENT PLAN</div>

                        <h3>
                          {billing.plan?.name ||
                            subscription?.planName ||
                            (subscription ? "Fades subscription" : "Fades Free")}
                        </h3>

                        <p>
                          {subscription
                            ? `Subscription status: ${getSubscriptionStatus(
                                subscription
                              )}`
                            : "You are currently on the free plan."}
                        </p>
                      </div>

                      <span
                        className={`fa-pill ${
                          isSubscriptionActive(subscription)
                            ? "fa-pill-green"
                            : ""
                        }`}
                      >
                        {getSubscriptionStatus(subscription)}
                      </span>
                    </div>

                    <div className="fa-billing-price">
                      {billingPrice ? (
                        <>
                          <strong>
                            {formatMoney(
                              billingPrice.amount,
                              billingPrice.currency
                            )}
                          </strong>

                          <span>
                            {billingPrice.interval
                              ? `/ ${billingPrice.interval}`
                              : "per billing period"}
                          </span>
                        </>
                      ) : (
                        <strong>
                          {subscription ? "Paid subscription" : "$0"}
                        </strong>
                      )}
                    </div>

                    <div className="fa-billing-summary-grid">
                      <div>
                        <span>Next renewal / period end</span>
                        <strong>
                          {formatDate(
                            subscription?.currentPeriodEnd ||
                              subscription?.current_period_end
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Subscription started</span>
                        <strong>
                          {formatDate(
                            subscription?.createdAt ||
                              subscription?.created
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Billing interval</span>
                        <strong>
                          {titleCase(
                            subscription?.interval ||
                              billing.plan?.interval
                          )}
                        </strong>
                      </div>
                    </div>

                    {subscription?.cancelAtPeriodEnd && (
                      <div className="fa-billing-alert">
                        Your subscription is scheduled to end at the end
                        of the current billing period.
                      </div>
                    )}

                    {isPastDue && (
                      <div className="fa-billing-alert">
                        Your subscription needs attention. Open the
                        Stripe billing portal to review your payment
                        details.
                      </div>
                    )}

                    <div className="fa-billing-actions">
                      <button
                        className="fa-button fa-primary"
                        onClick={
                          subscription
                            ? openBillingPortal
                            : startCheckout
                        }
                        disabled={busy}
                      >
                        {busy
                          ? "Please wait…"
                          : subscription
                            ? "Manage subscription"
                            : "Upgrade your plan"}
                        <span>↗</span>
                      </button>

                      {subscription && (
                        <button
                          className="fa-button fa-secondary"
                          onClick={openBillingPortal}
                          disabled={busy}
                        >
                          Payment & invoices
                        </button>
                      )}

                      <button
                        className="fa-button fa-secondary"
                        onClick={refreshBilling}
                        disabled={busy}
                      >
                        ↻ Refresh
                      </button>
                    </div>

                    <p className="fa-billing-footnote">
                      Your subscription status will appear here!
                    </p>
                  </div>

                  <div className="fa-card">
                    <div className="fa-card-heading">
                      <div>
                        <h3>Payment method</h3>
                        <p>
                          Review and update the payment method associated
                          with your subscription.
                        </p>
                      </div>

                      <span className="fa-mini-symbol">◇</span>
                    </div>

                    {billing.paymentMethod ? (
                      <div className="fa-payment-method">
                        <div className="fa-payment-icon">▰</div>

                        <div className="fa-flex-grow">
                          <strong>
                            {titleCase(
                              billing.paymentMethod.brand || "Card"
                            )}
                            {billing.paymentMethod.last4
                              ? ` ending in ${billing.paymentMethod.last4}`
                              : ""}
                          </strong>

                          <small>
                            {billing.paymentMethod.expMonth &&
                            billing.paymentMethod.expYear
                              ? `Expires ${String(
                                  billing.paymentMethod.expMonth
                                ).padStart(2, "0")}/${
                                  billing.paymentMethod.expYear
                                }`
                              : "Payment details are managed securely by Stripe."}
                          </small>
                        </div>

                        <button
                          className="fa-button fa-secondary"
                          onClick={openBillingPortal}
                          disabled={busy || !subscription}
                        >
                          Update
                        </button>
                      </div>
                    ) : (
                      <div className="fa-empty">
                        <span>◇</span>
                        <h3>No payment method available</h3>
                        <p>
                          If you have a paid subscription, open the
                          billing portal to manage your payment details.
                        </p>

                        {subscription && (
                          <button
                            className="fa-button fa-secondary"
                            onClick={openBillingPortal}
                            disabled={busy}
                          >
                            Open billing portal
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="fa-card">
                    <div className="fa-card-heading">
                      <div>
                        <h3>Billing details</h3>
                      </div>
                    </div>

                    {billing.billingDetails ? (
                      <div className="fa-billing-details">
                        <div>
                          <span>Billing name</span>
                          <strong>
                            {billing.billingDetails.name || "Not provided"}
                          </strong>
                        </div>

                        <div>
                          <span>Billing email</span>
                          <strong>
                            {billing.billingDetails.email || "Not provided"}
                          </strong>
                        </div>

                        <div>
                          <span>Country</span>
                          <strong>
                            {billing.billingDetails.country || "Not provided"}
                          </strong>
                        </div>
                      </div>
                    ) : (
                      <p className="fa-billing-muted">
                        No separate billing profile was returned by the
                        API. Manage available billing details in Stripe's
                        customer portal.
                      </p>
                    )}

                    <div className="fa-form-footer">
                      <span>Securely managed by Stripe.</span>

                      <button
                        className="fa-button fa-secondary"
                        onClick={openBillingPortal}
                        disabled={busy || !subscription}
                      >
                        Edit billing details
                      </button>
                    </div>
                  </div>

                  <div className="fa-card fa-invoices-card">
                    <div className="fa-card-heading">
                      <div>
                        <h3>Invoices & payment history</h3>
                      </div>

                      <span className="fa-mini-symbol">▤</span>
                    </div>

                    {billing.invoices.length === 0 ? (
                      <div className="fa-empty">
                        <span>▤</span>
                        <h3>No invoices available</h3>
                        <p>
                          Your invoices will appear here!
                        </p>
                      </div>
                    ) : (
                      <div className="fa-invoice-list">
                        {billing.invoices.map((invoice) => {
                          const invoiceUrl = safeExternalUrl(
                            invoice.hostedInvoiceUrl ||
                              invoice.hosted_invoice_url
                          );

                          const invoicePdfUrl = safeExternalUrl(
                            invoice.invoicePdf ||
                              invoice.invoice_pdf
                          );

                          const amount =
                            invoice.amountPaid ??
                            invoice.amount_paid ??
                            invoice.total ??
                            invoice.amount;

                          return (
                            <div
                              className="fa-invoice-row"
                              key={invoice.id}
                            >
                              <div className="fa-invoice-icon">▤</div>

                              <div className="fa-flex-grow">
                                <strong>
                                  {invoice.number ||
                                    invoice.description ||
                                    `Invoice ${invoice.id}`}
                                </strong>

                                <small>
                                  {formatDate(
                                    invoice.createdAt ||
                                      invoice.created_at ||
                                      invoice.created
                                  )}
                                </small>
                              </div>

                              <div className="fa-invoice-amount">
                                <strong>
                                  {formatMoney(
                                    amount,
                                    invoice.currency || "CAD"
                                  )}
                                </strong>

                                <span
                                  className={`fa-pill ${
                                    String(invoice.status).toLowerCase() ===
                                    "paid"
                                      ? "fa-pill-green"
                                      : ""
                                  }`}
                                >
                                  {titleCase(invoice.status)}
                                </span>
                              </div>

                              {(invoiceUrl || invoicePdfUrl) && (
                                <a
                                  className="fa-button fa-secondary"
                                  href={invoiceUrl || invoicePdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {invoiceUrl ? "View invoice" : "PDF"}
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="fa-form-footer">
                      <span>
                        Invoice history depends on your billing API.
                      </span>

                      <button
                        className="fa-button fa-secondary"
                        onClick={openBillingPortal}
                        disabled={busy || !subscription}
                      >
                        Open Stripe portal
                      </button>
                    </div>
                  </div>

                  <div className="fa-card fa-billing-help">
                    <div className="fa-inline-icon">✦</div>

                    <div className="fa-flex-grow">
                      <h3>Need help with billing?</h3>
                      <p>
                        If a payment failed, a subscription looks
                        incorrect, or you need help with an invoice,
                        contact Fades support.
                      </p>

                      <a
                        className="fa-button fa-secondary"
                        href="https://help.fades.lol"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Contact support <span>↗</span>
                      </a>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {activeSection === "security" && (
            <>
              <div className="fa-section-heading">
                <div>
                  <div className="fa-kicker">KEEP IT PROTECTED</div>
                  <h2>Security</h2>
                  <p>
                    Make sure only you can access your Fades account.
                  </p>
                </div>

                <span className="fa-section-symbol">◇</span>
              </div>

              <div className="fa-card fa-security-summary">
                <div className="fa-security-emblem">⌑</div>

                <div className="fa-flex-grow">
                  <h3>Account protection</h3>
                  <p>
                    {twofa.enabled
                      ? "Two-step verification is active on your account."
                      : "Add another layer of protection with an authenticator app."}
                  </p>
                </div>

                <span
                  className={`fa-pill ${
                    twofa.enabled ? "fa-pill-green" : ""
                  }`}
                >
                  {twofa.enabled ? "PROTECTED" : "BASIC PROTECTION"}
                </span>
              </div>

              <div className="fa-card">
                <div className="fa-card-heading">
                  <div>
                    <h3>Change password</h3>
                    <p>
                      Use a strong password you don't use anywhere else.
                    </p>
                  </div>

                  <span className="fa-mini-symbol">⌁</span>
                </div>

                <form className="fa-form" onSubmit={changePassword}>
                  <div className="fa-form-grid">
                    <label className="fa-field fa-field-wide">
                      <span>Current password</span>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={passwordForm.currentPassword}
                        onChange={(e) =>
                          setPasswordForm((current) => ({
                            ...current,
                            currentPassword: e.target.value,
                          }))
                        }
                        required
                      />
                    </label>

                    <label className="fa-field">
                      <span>New password</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={200}
                        value={passwordForm.newPassword}
                        onChange={(e) =>
                          setPasswordForm((current) => ({
                            ...current,
                            newPassword: e.target.value,
                          }))
                        }
                        required
                      />
                      <small>At least 8 characters.</small>
                    </label>

                    <label className="fa-field">
                      <span>Confirm new password</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) =>
                          setPasswordForm((current) => ({
                            ...current,
                            confirmPassword: e.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                  </div>

                  <label className="fa-check-row">
                    <input
                      type="checkbox"
                      checked={passwordForm.signOutOthers}
                      onChange={(e) =>
                        setPasswordForm((current) => ({
                          ...current,
                          signOutOthers: e.target.checked,
                        }))
                      }
                    />

                    <span>
                      <strong>Sign out other devices</strong>
                      <small>
                        Recommended after changing your password.
                      </small>
                    </span>
                  </label>

                  <div className="fa-form-footer">
                    <span>You'll stay signed in on this device.</span>

                    <button
                      className="fa-button fa-primary"
                      disabled={busy}
                    >
                      Update password <span>↗</span>
                    </button>
                  </div>
                </form>
              </div>

              <div className="fa-card">
                <div className="fa-card-heading">
                  <div>
                    <h3>Two-step verification</h3>
                    <p>
                      Use an authenticator app to help prevent unauthorized
                      sign-ins.
                    </p>
                  </div>

                  <span
                    className={`fa-pill ${
                      twofa.enabled ? "fa-pill-green" : ""
                    }`}
                  >
                    {twofa.enabled ? "ENABLED" : "OPTIONAL"}
                  </span>
                </div>

                {!twofa.enabled && !twofa.setup && (
                  <div className="fa-twofa-start">
                    <div className="fa-twofa-steps">
                      <span>01</span>
                      <div>
                        <strong>Start setup</strong>
                        <small>
                          Generate a secret for your authenticator app.
                        </small>
                      </div>
                    </div>

                    <div className="fa-twofa-steps">
                      <span>02</span>
                      <div>
                        <strong>Confirm your code</strong>
                        <small>
                          Enter the 6-digit code from your app.
                        </small>
                      </div>
                    </div>

                    <button
                      className="fa-button fa-primary"
                      onClick={startTwofa}
                      disabled={busy}
                    >
                      Set up two-step verification <span>↗</span>
                    </button>
                  </div>
                )}

                {twofa.setup && !twofa.enabled && (
                  <form className="fa-setup-box" onSubmit={enableTwofa}>
                    <h4>Connect your authenticator</h4>

                    {twofa.setup.qr && (
                      <img
                        className="fa-qr"
                        src={twofa.setup.qr}
                        alt="Authenticator setup QR code"
                      />
                    )}

                    <p>
                      Scan the QR code in your authenticator app, or enter
                      this setup key manually.
                    </p>

                    <code className="fa-secret">
                      {twofa.setup.secret}
                    </code>

                    <label className="fa-field">
                      <span>6-digit authenticator code</span>
                      <input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={twofa.code}
                        onChange={(e) =>
                          setTwofa((current) => ({
                            ...current,
                            code: e.target.value.replace(/\D/g, ""),
                          }))
                        }
                        required
                      />
                    </label>

                    <div className="fa-actions">
                      <button
                        type="button"
                        className="fa-button fa-secondary"
                        onClick={() =>
                          setTwofa((current) => ({
                            ...current,
                            setup: null,
                            code: "",
                          }))
                        }
                      >
                        Cancel
                      </button>

                      <button
                        className="fa-button fa-primary"
                        disabled={busy || twofa.code.length !== 6}
                      >
                        Enable protection
                      </button>
                    </div>
                  </form>
                )}

                {twofa.enabled && (
                  <div className="fa-twofa-enabled">
                    <div className="fa-enabled-line">
                      <span className="fa-green-check">✓</span>
                      <div>
                        <strong>Authenticator connected</strong>
                        <small>
                          {twofa.backupCodesLeft} backup codes remaining
                        </small>
                      </div>
                    </div>

                    <form
                      className="fa-form fa-backup-form"
                      onSubmit={regenerateBackupCodes}
                    >
                      <label className="fa-field">
                        <span>
                          Confirm password to regenerate backup codes
                        </span>
                        <input
                          type="password"
                          autoComplete="current-password"
                          value={twofa.password}
                          onChange={(e) =>
                            setTwofa((current) => ({
                              ...current,
                              password: e.target.value,
                            }))
                          }
                          required
                        />
                      </label>

                      <button
                        className="fa-button fa-secondary"
                        disabled={busy}
                      >
                        Regenerate backup codes
                      </button>
                    </form>

                    <form
                      className="fa-form fa-disable-form"
                      onSubmit={disableTwofa}
                    >
                      <h4>Turn off two-step verification</h4>

                      <div className="fa-form-grid">
                        <label className="fa-field">
                          <span>Password</span>
                          <input
                            type="password"
                            autoComplete="current-password"
                            value={twofa.password}
                            onChange={(e) =>
                              setTwofa((current) => ({
                                ...current,
                                password: e.target.value,
                              }))
                            }
                            required
                          />
                        </label>

                        <label className="fa-field">
                          <span>Authenticator or backup code</span>
                          <input
                            value={twofa.code}
                            onChange={(e) =>
                              setTwofa((current) => ({
                                ...current,
                                code: e.target.value,
                              }))
                            }
                            required
                          />
                        </label>
                      </div>

                      <button
                        className="fa-button fa-danger-button"
                        disabled={busy}
                      >
                        Turn off verification
                      </button>
                    </form>
                  </div>
                )}

                {twofa.backupCodes.length > 0 && (
                  <div className="fa-backup-codes">
                    <div>
                      <h4>Save your backup codes</h4>
                      <p>
                        Each code can only be used once. Store these
                        somewhere safe.
                      </p>
                    </div>

                    <div className="fa-code-grid">
                      {twofa.backupCodes.map((code) => (
                        <code key={code}>{code}</code>
                      ))}
                    </div>

                    <button
                      className="fa-button fa-secondary"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            twofa.backupCodes.join("\n")
                          );
                          setNotice("Backup codes copied.");
                        } catch {
                          setNotice(
                            "Unable to copy automatically. Select and copy the codes manually."
                          );
                        }
                      }}
                    >
                      Copy backup codes
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {activeSection === "devices" && (
            <>
              <div className="fa-section-heading">
                <div>
                  <div className="fa-kicker">ACTIVE SESSIONS</div>
                  <h2>Your devices</h2>
                  <p>
                    Review where your account is signed in and remove
                    devices you don't recognize.
                  </p>
                </div>

                <span className="fa-section-symbol">▣</span>
              </div>

              <div className="fa-card fa-device-intro">
                <div className="fa-inline-icon">▣</div>

                <div className="fa-flex-grow">
                  <h3>
                    {sessions.length} active{" "}
                    {sessions.length === 1 ? "session" : "sessions"}
                  </h3>
                  <p>
                    Your current session is marked below. Signing out a
                    device removes its access to your account.
                  </p>
                </div>

                <button
                  className="fa-button fa-secondary"
                  onClick={loadSessions}
                >
                  ↻ Refresh
                </button>
              </div>

              <div className="fa-card fa-session-list">
                {sessions.length === 0 ? (
                  <div className="fa-empty">
                    <span>▣</span>
                    <h3>No sessions found</h3>
                    <p>Try refreshing this list.</p>
                  </div>
                ) : (
                  sessions.map((session) => (
                    <div className="fa-session" key={session.id}>
                      <div className="fa-device-icon">
                        {/phone|android|ios/i.test(
                          `${session.device} ${session.os}`
                        )
                          ? "▯"
                          : "▰"}
                      </div>

                      <div className="fa-session-info">
                        <div className="fa-session-title">
                          <strong>
                            {session.device ||
                              [
                                session.browser,
                                session.os && `on ${session.os}`,
                              ]
                                .filter(Boolean)
                                .join(" ") ||
                              "Unknown device"}
                          </strong>

                          {session.current && (
                            <span className="fa-pill fa-pill-green">
                              THIS DEVICE
                            </span>
                          )}
                        </div>

                        <span>
                          {[session.location, session.ip]
                            .filter(Boolean)
                            .join(" · ") || "Location unavailable"}
                        </span>

                        <small>
                          Last active {formatDate(session.lastActive)} ·
                          Signed in {formatDate(session.createdAt)}
                        </small>
                      </div>

                      {!session.current && (
                        <button
                          className="fa-button fa-secondary fa-revoke"
                          onClick={() => revokeSession(session.id)}
                          disabled={busy}
                        >
                          Sign out
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="fa-card fa-warning-row">
                <div className="fa-inline-icon fa-icon-warn">!</div>

                <div className="fa-flex-grow">
                  <h3>Don't recognize a device?</h3>
                  <p>
                    Sign it out, then change your password and review your
                    security activity.
                  </p>
                </div>

                <button
                  className="fa-button fa-danger-button"
                  onClick={revokeOtherSessions}
                  disabled={
                    busy ||
                    sessions.filter((session) => !session.current).length === 0
                  }
                >
                  Sign out other devices
                </button>
              </div>
            </>
          )}

          {activeSection === "activity" && (
            <>
              <div className="fa-section-heading">
                <div>
                  <div className="fa-kicker">ACCOUNT TIMELINE</div>
                  <h2>Security activity</h2>
                  <p>
                    Recent sign-ins and important changes to your account.
                  </p>
                </div>

                <span className="fa-section-symbol">↗</span>
              </div>

              <div className="fa-card fa-activity-card">
                <div className="fa-card-heading">
                  <div>
                    <h3>Recent activity</h3>
                    <p>
                      Showing the latest security events available for your
                      account.
                    </p>
                  </div>

                  <button
                    className="fa-button fa-secondary fa-small"
                    onClick={loadActivity}
                  >
                    ↻ Refresh
                  </button>
                </div>

                {activity.length === 0 ? (
                  <div className="fa-empty">
                    <span>⌁</span>
                    <h3>Nothing to show yet</h3>
                    <p>New security events will appear here.</p>
                  </div>
                ) : (
                  <div className="fa-timeline">
                    {activity.map((event) => (
                      <div className="fa-timeline-item" key={event.id}>
                        <span
                          className={`fa-timeline-dot ${
                            event.success ? "" : "fa-timeline-dot-alert"
                          }`}
                        />

                        <div className="fa-timeline-main">
                          <div className="fa-session-title">
                            <strong>
                              {String(event.type || "activity")
                                .replaceAll("_", " ")
                                .replace(/\b\w/g, (letter) =>
                                  letter.toUpperCase()
                                )}
                            </strong>

                            <span
                              className={`fa-pill ${
                                event.success
                                  ? "fa-pill-green"
                                  : "fa-pill-red"
                              }`}
                            >
                              {event.success ? "SUCCESS" : "FAILED"}
                            </span>
                          </div>

                          <p>
                            {[event.device, event.location, event.ip]
                              .filter(Boolean)
                              .join(" · ") ||
                              "No additional device details"}
                          </p>

                          <small>{formatDate(event.at)}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="fa-security-tip">
                <span>✦</span>
                <p>
                  <strong>Security tip</strong> — If you see an unfamiliar
                  sign-in, sign out that device and update your password
                  immediately.
                </p>
              </div>
            </>
          )}

          {activeSection === "danger" && (
            <>
              <div className="fa-section-heading">
                <div>
                  <div className="fa-kicker fa-kicker-danger">
                    ACCOUNT CONTROL
                  </div>
                  <h2>Delete account</h2>
                  <p>
                    Make sure you understand what happens before continuing.
                  </p>
                </div>

                <span className="fa-section-symbol fa-danger-symbol">⌫</span>
              </div>

              <div className="fa-card fa-delete-intro">
                <div className="fa-delete-icon">!</div>

                <div>
                  <h3>This action is permanent</h3>
                  <p>
                    Deleting your Fades account permanently removes your
                    account and associated data. This may include your
                    sessions, Fades Browser data, chats, connected app
                    grants, and OAuth apps you registered, as handled by
                    the account API. Check your paid subscription separately
                    before deletion unless your backend cancels it as part
                    of account deletion.
                  </p>
                </div>
              </div>

              <div className="fa-card fa-delete-card">
                <div className="fa-card-heading">
                  <div>
                    <h3>Before you delete</h3>
                    <p>Please review these points carefully.</p>
                  </div>
                </div>

                <ul className="fa-delete-list">
                  <li>
                    <span>×</span>
                    <div>
                      <strong>You may lose access to Fades services</strong>
                      <small>
                        Your Fades identity will no longer be available to
                        sign in with.
                      </small>
                    </div>
                  </li>

                  <li>
                    <span>×</span>
                    <div>
                      <strong>Your account data will be removed</strong>
                      <small>
                        Associated data covered by the deletion endpoint
                        will be deleted.
                      </small>
                    </div>
                  </li>

                  <li>
                    <span>×</span>
                    <div>
                      <strong>This cannot be undone</strong>
                      <small>
                        You won't be able to restore this account after
                        deletion.
                      </small>
                    </div>
                  </li>
                </ul>

                <form className="fa-delete-form" onSubmit={deleteAccount}>
                  <label className="fa-field">
                    <span>Enter your password to continue</span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      required
                    />
                  </label>

                  <label className="fa-check-row fa-delete-confirm">
                    <input
                      type="checkbox"
                      checked={deleteConfirmation}
                      onChange={(e) =>
                        setDeleteConfirmation(e.target.checked)
                      }
                    />

                    <span>
                      <strong>
                        I understand that deleting my account is permanent.
                      </strong>
                      <small>This is not a temporary deactivation.</small>
                    </span>
                  </label>

                  <button
                    className="fa-button fa-danger-button fa-delete-submit"
                    disabled={
                      busy || !deleteConfirmation || !deletePassword
                    }
                  >
                    {busy
                      ? "Deleting account…"
                      : "Permanently delete account"}
                    <span>↗</span>
                  </button>
                </form>
              </div>
            </>
          )}

          <footer className="fa-content-footer">
            <span>FADES ACCOUNT CENTER</span>
            <span>
              Need help? <a href="https://help.fades.lol">Visit Fades</a>
            </span>
          </footer>
        </section>
      </div>
    </main>
  );
}
