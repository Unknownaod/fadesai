"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./settings.css";

const API_URL = "https://api.fades.lol";

const SETTINGS_KEY = "fades.settings.v1";

const DEFAULT_SETTINGS = {
  theme: "dark",
  compactMode: false,
  enterToSend: true,
  showTimestamps: true,
};

export default function SettingsPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] =
    useState(DEFAULT_SETTINGS);

  const [activeSection, setActiveSection] =
    useState("account");

  useEffect(() => {
    try {
      const stored =
        window.localStorage.getItem(
          SETTINGS_KEY
        );

      if (stored) {
        const parsed = JSON.parse(stored);

        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
        });
      }
    } catch (error) {
      console.error(
        "Unable to load settings:",
        error
      );
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(settings)
      );
    } catch (error) {
      console.error(
        "Unable to save settings:",
        error
      );
    }
  }, [settings]);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const response = await fetch(
          `${API_URL}/auth/me`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        const data =
          await response.json().catch(
            () => null
          );

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setUser(null);
          return;
        }

        const currentUser =
          data?.user || data;

        setUser(currentUser || null);
      } catch (error) {
        console.error(
          "Unable to load account:",
          error
        );

        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingUser(false);
        }
      }
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateSetting(key, value) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleLogout() {
    setSaving(true);

    try {
      await fetch(
        `${API_URL}/auth/logout`,
        {
          method: "POST",
          credentials: "include",
        }
      );
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );
    } finally {
      setSaving(false);
      router.push("/");
      router.refresh();
    }
  }

  function handleResetSettings() {
    const confirmed =
      window.confirm(
        "Reset all Fades settings to their defaults?"
      );

    if (!confirmed) {
      return;
    }

    setSettings(DEFAULT_SETTINGS);
  }

  function formatDate(value) {
    if (!value) {
      return "Not available";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Not available";
    }

    return date.toLocaleDateString(
      undefined,
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    );
  }

  const isPro =
    user?.plan === "pro";

  const displayName =
    user?.displayName ||
    user?.username ||
    "Fades User";

  const email =
    user?.email ||
    "No email available";

  const sections = [
    {
      id: "account",
      label: "Account",
    },
    {
      id: "appearance",
      label: "Appearance",
    },
    {
      id: "chat",
      label: "Chat",
    },
    {
      id: "ai",
      label: "AI",
    },
    {
      id: "privacy",
      label: "Privacy",
    },
    {
      id: "about",
      label: "About",
    },
  ];

  return (
    <main className="settings-page">
      <div className="settings-shell">
        <header className="settings-header">
          <button
            className="back-button"
            type="button"
            onClick={() => router.push("/")}
            aria-label="Back to Fades"
          >
            <span>←</span>
            <span>Back to Fades</span>
          </button>

          <div className="settings-title">
            <h1>Settings</h1>
            <p>
              Manage your Fades account and
              preferences.
            </p>
          </div>
        </header>

        <div className="settings-layout">
          <aside className="settings-sidebar">
            <div className="sidebar-label">
              Settings
            </div>

            <nav className="settings-nav">
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={
                    activeSection ===
                    section.id
                      ? "settings-nav-item active"
                      : "settings-nav-item"
                  }
                  onClick={() =>
                    setActiveSection(
                      section.id
                    )
                  }
                >
                  {section.label}
                </button>
              ))}
            </nav>
          </aside>

          <section className="settings-content">
            {activeSection ===
              "account" && (
              <div className="settings-section">
                <div className="section-heading">
                  <div>
                    <h2>Account</h2>
                    <p>
                      Manage your Fades
                      account.
                    </p>
                  </div>
                </div>

                {loadingUser ? (
                  <div className="loading-card">
                    <div className="loading-spinner" />
                    <span>
                      Loading account...
                    </span>
                  </div>
                ) : user ? (
                  <>
                    <div className="account-card">
                      <div className="account-avatar">
                        {displayName
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="account-info">
                        <div className="account-name-row">
                          <strong>
                            {displayName}
                          </strong>

                          {isPro && (
                            <span className="pro-badge">
                              PRO
                            </span>
                          )}
                        </div>

                        <span className="account-email">
                          {email}
                        </span>
                      </div>

                      <div
                        className={
                          isPro
                            ? "plan-pill pro"
                            : "plan-pill"
                        }
                      >
                        {isPro
                          ? "Pro"
                          : "Free"}
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="setting-row">
                        <div>
                          <span className="setting-title">
                            Account status
                          </span>

                          <span className="setting-description">
                            Your Fades account
                            is active.
                          </span>
                        </div>

                        <span className="status-pill">
                          Active
                        </span>
                      </div>

                      <div className="setting-row">
                        <div>
                          <span className="setting-title">
                            Email
                          </span>

                          <span className="setting-description">
                            {email}
                          </span>
                        </div>

                        <span className="verified-pill">
                          Verified
                        </span>
                      </div>

                      <div className="setting-row">
                        <div>
                          <span className="setting-title">
                            Member since
                          </span>

                          <span className="setting-description">
                            {formatDate(
                              user.createdAt
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isPro && (
                      <div className="pro-card">
                        <div>
                          <div className="pro-card-title">
                            Fades Pro
                          </div>

                          <div className="pro-card-description">
                            Your Pro subscription
                            is active.
                          </div>
                        </div>

                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() =>
                            router.push(
                              "/pro"
                            )
                          }
                        >
                          Manage Pro
                        </button>
                      </div>
                    )}

                    {!isPro && (
                      <div className="pro-card">
                        <div>
                          <div className="pro-card-title">
                            Upgrade to Pro
                          </div>

                          <div className="pro-card-description">
                            Get higher AI limits,
                            extended context,
                            and priority access.
                          </div>
                        </div>

                        <button
                          type="button"
                          className="primary-button"
                          onClick={() =>
                            router.push(
                              "/pro"
                            )
                          }
                        >
                          View Pro
                        </button>
                      </div>
                    )}

                    <div className="danger-card">
                      <div>
                        <div className="danger-title">
                          Sign out
                        </div>

                        <div className="danger-description">
                          Sign out of your Fades
                          account on this device.
                        </div>
                      </div>

                      <button
                        type="button"
                        className="danger-button"
                        onClick={
                          handleLogout
                        }
                        disabled={saving}
                      >
                        {saving
                          ? "Signing out..."
                          : "Sign out"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="empty-card">
                    <div className="empty-title">
                      You're not signed in
                    </div>

                    <div className="empty-description">
                      Sign in to manage your
                      Fades account.
                    </div>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={() =>
                        router.push("/")
                      }
                    >
                      Go to Fades
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeSection ===
              "appearance" && (
              <div className="settings-section">
                <div className="section-heading">
                  <div>
                    <h2>Appearance</h2>
                    <p>
                      Customize how Fades
                      looks.
                    </p>
                  </div>
                </div>

                <div className="settings-card">
                  <div className="setting-row">
                    <div>
                      <span className="setting-title">
                        Theme
                      </span>

                      <span className="setting-description">
                        Choose the appearance
                        of Fades.
                      </span>
                    </div>

                    <select
                      className="settings-select"
                      value={
                        settings.theme
                      }
                      onChange={(event) =>
                        updateSetting(
                          "theme",
                          event.target
                            .value
                        )
                      }
                    >
                      <option value="dark">
                        Dark
                      </option>
                      <option value="light">
                        Light
                      </option>
                      <option value="system">
                        System
                      </option>
                    </select>
                  </div>

                  <div className="setting-row">
                    <div>
                      <span className="setting-title">
                        Compact mode
                      </span>

                      <span className="setting-description">
                        Use a tighter chat
                        layout.
                      </span>
                    </div>

                    <button
                      type="button"
                      className={
                        settings.compactMode
                          ? "toggle active"
                          : "toggle"
                      }
                      onClick={() =>
                        updateSetting(
                          "compactMode",
                          !settings.compactMode
                        )
                      }
                      aria-label="Toggle compact mode"
                      aria-pressed={
                        settings.compactMode
                      }
                    >
                      <span />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection ===
              "chat" && (
              <div className="settings-section">
                <div className="section-heading">
                  <div>
                    <h2>Chat</h2>
                    <p>
                      Configure your Fades
                      chat experience.
                    </p>
                  </div>
                </div>

                <div className="settings-card">
                  <div className="setting-row">
                    <div>
                      <span className="setting-title">
                        Enter to send
                      </span>

                      <span className="setting-description">
                        Press Enter to send a
                        message.
                      </span>
                    </div>

                    <button
                      type="button"
                      className={
                        settings.enterToSend
                          ? "toggle active"
                          : "toggle"
                      }
                      onClick={() =>
                        updateSetting(
                          "enterToSend",
                          !settings.enterToSend
                        )
                      }
                      aria-label="Toggle Enter to send"
                      aria-pressed={
                        settings.enterToSend
                      }
                    >
                      <span />
                    </button>
                  </div>

                  <div className="setting-row">
                    <div>
                      <span className="setting-title">
                        Show timestamps
                      </span>

                      <span className="setting-description">
                        Show message times in
                        conversations.
                      </span>
                    </div>

                    <button
                      type="button"
                      className={
                        settings.showTimestamps
                          ? "toggle active"
                          : "toggle"
                      }
                      onClick={() =>
                        updateSetting(
                          "showTimestamps",
                          !settings.showTimestamps
                        )
                      }
                      aria-label="Toggle timestamps"
                      aria-pressed={
                        settings.showTimestamps
                      }
                    >
                      <span />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection ===
              "ai" && (
              <div className="settings-section">
                <div className="section-heading">
                  <div>
                    <h2>AI</h2>
                    <p>
                      Information about your
                      Fades AI access.
                    </p>
                  </div>
                </div>

                <div className="settings-card">
                  <div className="setting-row">
                    <div>
                      <span className="setting-title">
                        Current plan
                      </span>

                      <span className="setting-description">
                        Your current Fades AI
                        plan.
                      </span>
                    </div>

                    <span
                      className={
                        isPro
                          ? "plan-pill pro"
                          : "plan-pill"
                      }
                    >
                      {isPro
                        ? "Pro"
                        : "Free"}
                    </span>
                  </div>

                  <div className="setting-row">
                    <div>
                      <span className="setting-title">
                        Daily generations
                      </span>

                      <span className="setting-description">
                        {isPro
                          ? "Up to 500 AI generations per day."
                          : "Up to 50 AI generations per day."}
                      </span>
                    </div>
                  </div>

                  <div className="setting-row">
                    <div>
                      <span className="setting-title">
                        Conversation context
                      </span>

                      <span className="setting-description">
                        {isPro
                          ? "Up to 100 messages of context."
                          : "Up to 30 messages of context."}
                      </span>
                    </div>
                  </div>
                </div>

                {!isPro && (
                  <div className="pro-card">
                    <div>
                      <div className="pro-card-title">
                        Need more?
                      </div>

                      <div className="pro-card-description">
                        Upgrade to Fades Pro for
                        higher limits and extended
                        context.
                      </div>
                    </div>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={() =>
                        router.push(
                          "/pro"
                        )
                      }
                    >
                      Upgrade
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeSection ===
              "privacy" && (
              <div className="settings-section">
                <div className="section-heading">
                  <div>
                    <h2>Privacy</h2>
                    <p>
                      Manage your privacy and
                      local preferences.
                    </p>
                  </div>
                </div>

                <div className="settings-card">
                  <div className="setting-row">
                    <div>
                      <span className="setting-title">
                        Chat storage
                      </span>

                      <span className="setting-description">
                        Account conversations are
                        stored with your Fades
                        account. Guest conversations
                        are temporary.
                      </span>
                    </div>
                  </div>

                  <div className="setting-row">
                    <div>
                      <span className="setting-title">
                        Local preferences
                      </span>

                      <span className="setting-description">
                        Appearance and chat
                        preferences are stored
                        locally on this device.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="reset-card">
                  <div>
                    <div className="reset-title">
                      Reset preferences
                    </div>

                    <div className="reset-description">
                      Reset your local Fades
                      preferences to their
                      defaults.
                    </div>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={
                      handleResetSettings
                    }
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}

            {activeSection ===
              "about" && (
              <div className="settings-section">
                <div className="section-heading">
                  <div>
                    <h2>About</h2>
                    <p>
                      Information about Fades.
                    </p>
                  </div>
                </div>

                <div className="about-card">
                  <div className="about-logo">
                    F
                  </div>

                  <div className="about-content">
                    <h3>Fades</h3>

                    <p>
                      AI built for everyday
                      use.
                    </p>

                    <span>
                      Fades AI
                    </span>
                  </div>
                </div>

                <div className="settings-card">
                  <div className="setting-row">
                    <div>
                      <span className="setting-title">
                        Product
                      </span>

                      <span className="setting-description">
                        Fades AI
                      </span>
                    </div>
                  </div>

                  <div className="setting-row">
                    <div>
                      <span className="setting-title">
                        Website
                      </span>

                      <span className="setting-description">
                        fades.lol
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
