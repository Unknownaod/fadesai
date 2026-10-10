"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "./account.css";

const API_BASE = (process.env.NEXT_PUBLIC_FADES_API || "https://api.fades.lol").replace(/\/+$/, "");

const NAV_ITEMS = [
  { id: "profile", label: "Profile", icon: "◉", description: "Your public identity" },
  { id: "security", label: "Security", icon: "◇", description: "Password and protection" },
  { id: "devices", label: "Devices", icon: "▣", description: "Where you're signed in" },
  { id: "activity", label: "Activity", icon: "↗", description: "Recent account activity" },
  { id: "danger", label: "Delete account", icon: "⌫", description: "Permanently remove your account" },
];

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function getError(data, fallback) {
  return data?.error || data?.message || fallback;
}

export default function AccountPage() {
  const [activeSection, setActiveSection] = useState("profile");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState({ username: "", name: "", email: "", bio: "", avatar: "", currentPassword: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "", signOutOthers: true });
  const [sessions, setSessions] = useState([]);
  const [activity, setActivity] = useState([]);
  const [twofa, setTwofa] = useState({ enabled: false, backupCodesLeft: 0, setup: null, code: "", password: "", backupCodes: [] });
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...options,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw new Error(getError(data, `Request failed (${response.status}).`));
    return data;
  }, []);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const data = await request("/auth/me");
      if (!data.authenticated || !data.user) throw new Error("Sign in to manage your Fades account.");
      setUser(data.user);
      setProfile({
        username: data.user.username || "",
        name: data.user.displayName || data.user.name || "",
        email: data.user.email || "",
        bio: data.user.bio || "",
        avatar: data.user.avatar || "",
        currentPassword: "",
      });
      setTwofa((current) => ({ ...current, enabled: Boolean(data.user.twofaEnabled) }));
    } catch (error) {
      setPageError(error.message || "Unable to load your account.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  const loadSessions = useCallback(async () => {
    try { const data = await request("/auth/sessions"); setSessions(data.sessions || []); }
    catch (error) { setNotice(error.message); }
  }, [request]);

  const loadActivity = useCallback(async () => {
    try { const data = await request("/auth/activity"); setActivity(data.events || []); }
    catch (error) { setNotice(error.message); }
  }, [request]);

  const loadTwofa = useCallback(async () => {
    try {
      const data = await request("/auth/2fa/status");
      setTwofa((current) => ({ ...current, enabled: Boolean(data.enabled), backupCodesLeft: data.backupCodesLeft || 0 }));
    } catch (error) { setNotice(error.message); }
  }, [request]);

  useEffect(() => { loadAccount(); }, [loadAccount]);
  useEffect(() => {
    if (activeSection === "devices") loadSessions();
    if (activeSection === "activity") loadActivity();
    if (activeSection === "security") loadTwofa();
  }, [activeSection, loadSessions, loadActivity, loadTwofa]);

  const initials = useMemo(() => {
    const name = profile.name || profile.username || user?.email || "Fades user";
    return name.trim().split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "F";
  }, [profile.name, profile.username, user?.email]);

  async function runAction(action, successMessage) {
    setBusy(true); setNotice("");
    try { await action(); if (successMessage) setNotice(successMessage); }
    catch (error) { setNotice(error.message || "Something went wrong."); }
    finally { setBusy(false); }
  }

  async function saveProfile(event) {
    event.preventDefault();
    await runAction(async () => {
      const body = { username: profile.username, name: profile.name, bio: profile.bio, avatar: profile.avatar };
      if (profile.email !== (user?.email || "")) { body.email = profile.email; body.currentPassword = profile.currentPassword; }
      const data = await request("/auth/me", { method: "PATCH", body: JSON.stringify(body) });
      setUser((current) => ({ ...current, ...data.user }));
      setProfile((current) => ({ ...current, currentPassword: "", email: data.user?.email || current.email }));
      if (data.user) setUser(data.user);
      if (data.message) setNotice(data.message); else setNotice("Your profile has been saved.");
    });
  }

  async function changePassword(event) {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { setNotice("Your new passwords don't match."); return; }
    await runAction(async () => {
      await request("/auth/password/change", { method: "POST", body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword, signOutOthers: passwordForm.signOutOthers }) });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "", signOutOthers: true });
      if (passwordForm.signOutOthers) await loadSessions();
    }, "Your password has been changed.");
  }

  async function startTwofa() {
    await runAction(async () => {
      const data = await request("/auth/2fa/setup", { method: "POST", body: JSON.stringify({}) });
      setTwofa((current) => ({ ...current, setup: data, code: "", backupCodes: [] }));
    });
  }

  async function enableTwofa(event) {
    event.preventDefault();
    await runAction(async () => {
      const data = await request("/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code: twofa.code }) });
      setTwofa((current) => ({ ...current, enabled: true, setup: null, code: "", backupCodes: data.backupCodes || [], backupCodesLeft: (data.backupCodes || []).length }));
      setUser((current) => ({ ...current, twofaEnabled: true }));
    }, "Two-step verification is now enabled. Save your backup codes somewhere safe.");
  }

  async function disableTwofa(event) {
    event.preventDefault();
    await runAction(async () => {
      await request("/auth/2fa/disable", { method: "POST", body: JSON.stringify({ password: twofa.password, code: twofa.code }) });
      setTwofa((current) => ({ ...current, enabled: false, password: "", code: "", setup: null, backupCodes: [], backupCodesLeft: 0 }));
      setUser((current) => ({ ...current, twofaEnabled: false }));
    }, "Two-step verification has been turned off.");
  }

  async function regenerateBackupCodes(event) {
    event.preventDefault();
    await runAction(async () => {
      const data = await request("/auth/2fa/backup-codes", { method: "POST", body: JSON.stringify({ password: twofa.password }) });
      setTwofa((current) => ({ ...current, backupCodes: data.backupCodes || [], backupCodesLeft: (data.backupCodes || []).length, password: "" }));
    }, "New backup codes generated. Your old backup codes no longer work.");
  }

  async function resendVerification() {
    await runAction(async () => { const data = await request("/auth/email/resend-verification", { method: "POST", body: JSON.stringify({}) }); setNotice(data.message || "Verification email sent."); });
  }

  async function verifyEmail(event) {
    event.preventDefault();
    await runAction(async () => {
      await request("/auth/email/verify", { method: "POST", body: JSON.stringify({ code: verifyCode }) });
      setVerifyCode("");
      const data = await request("/auth/me"); setUser(data.user);
    }, "Your email address has been verified.");
  }

  async function revokeSession(id) {
    await runAction(async () => { await request(`/auth/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }); setSessions((current) => current.filter((item) => item.id !== id)); }, "Device signed out.");
  }

  async function revokeOtherSessions() {
    await runAction(async () => { await request("/auth/sessions/revoke-others", { method: "POST", body: JSON.stringify({}) }); await loadSessions(); }, "Other devices have been signed out.");
  }

  async function signOut() {
    await runAction(async () => { await request("/auth/logout", { method: "POST", body: JSON.stringify({}) }); window.location.href = "/login"; });
  }

  async function deleteAccount(event) {
    event.preventDefault();
    if (!deleteConfirmation) { setNotice("Confirm that you understand this permanently deletes your account."); return; }
    await runAction(async () => {
      await request("/auth/account", { method: "DELETE", body: JSON.stringify({ password: deletePassword }) });
      window.location.href = "/?accountDeleted=1";
    });
  }

  if (loading) return <main className="fa-shell"><div className="fa-loading"><div className="fa-logo">f.</div><span className="fa-spinner" />Loading your Fades account…</div></main>;

  if (pageError) return <main className="fa-shell"><div className="fa-auth-card"><div className="fa-logo">f.</div><h1>Your account, all in one place.</h1><p>{pageError}</p><div className="fa-actions"><button className="fa-button fa-primary" onClick={() => { window.location.href = "/login"; }}>Sign in</button><button className="fa-button fa-secondary" onClick={loadAccount}>Try again</button></div></div></main>;

  return (
    <main className="fa-shell">
      <div className="fa-orb fa-orb-one" /><div className="fa-orb fa-orb-two" />
      <header className="fa-topbar">
        <a className="fa-brand" href="https://fades.lol" aria-label="Fades home"><span className="fa-brand-mark">f.</span><span>fades<span className="fa-brand-dot">.</span></span></a>
        <div className="fa-topbar-right"><span className="fa-topbar-label">ACCOUNT CENTER</span><button className="fa-button fa-secondary fa-small" onClick={signOut}>Sign out <span aria-hidden="true">↗</span></button></div>
      </header>

      <section className="fa-welcome">
        <div><div className="fa-eyebrow"><span className="fa-eyebrow-dot" /> YOUR FADES ID</div><h1>Account <span>center.</span></h1><p>Manage your identity, protect your account, and keep track of where you're signed in.</p></div>
        <div className="fa-welcome-mark" aria-hidden="true">f<span>.</span></div>
      </section>

      {notice && <div className="fa-notice" role="status"><span>✦</span><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss message">×</button></div>}

      <div className="fa-layout">
        <aside className="fa-sidebar">
          <div className="fa-user-mini"><div className="fa-avatar">{profile.avatar ? <img src={profile.avatar} alt="" /> : initials}</div><div className="fa-user-mini-text"><strong>{profile.name || profile.username || "Fades user"}</strong><span>{user?.email}</span></div><span className="fa-status-dot" title="Signed in" /></div>
          <div className="fa-nav-label">MANAGE ACCOUNT</div>
          <nav className="fa-nav" aria-label="Account sections">{NAV_ITEMS.map((item) => <button key={item.id} className={`fa-nav-item ${activeSection === item.id ? "is-active" : ""} ${item.id === "danger" ? "is-danger" : ""}`} onClick={() => { setActiveSection(item.id); setNotice(""); }}><span className="fa-nav-icon">{item.icon}</span><span className="fa-nav-copy"><strong>{item.label}</strong><small>{item.description}</small></span>{activeSection === item.id && <span className="fa-nav-arrow">›</span>}</button>)}</nav>
          <div className="fa-sidebar-footer"><span className="fa-shield">◇</span><div><strong>Your account. Your control.</strong><small>Fades identity settings</small></div></div>
        </aside>

        <section className="fa-content">
          {activeSection === "profile" && <>
            <div className="fa-section-heading"><div><div className="fa-kicker">PERSONAL DETAILS</div><h2>Your profile</h2><p>Choose how you appear across Fades services.</p></div><span className="fa-section-symbol">◉</span></div>
            <div className="fa-card fa-profile-card"><div className="fa-profile-banner"><div className="fa-profile-avatar">{profile.avatar ? <img src={profile.avatar} alt="Profile" /> : initials}</div><div className="fa-profile-intro"><strong>{profile.name || profile.username || "Your name"}</strong><span>@{profile.username || "username"}</span></div><span className="fa-pill">FADES ID</span></div>
              <form className="fa-form" onSubmit={saveProfile}><div className="fa-form-grid"><label className="fa-field"><span>Display name</span><input value={profile.name} maxLength={50} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="How people see you" /></label><label className="fa-field"><span>Username</span><div className="fa-input-prefix"><b>@</b><input value={profile.username} maxLength={24} onChange={(e) => setProfile({ ...profile, username: e.target.value })} placeholder="yourname" /></div><small>3–24 letters, numbers, dots, dashes or underscores.</small></label><label className="fa-field fa-field-wide"><span>Email address</span><input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} required /><small className="fa-inline-status">{user?.emailVerified ? <><span className="fa-green-dot" /> Verified email</> : <><span className="fa-yellow-dot" /> Email not verified</>}</small></label>{profile.email !== (user?.email || "") && <label className="fa-field fa-field-wide"><span>Current password <em>Required to change email</em></span><input type="password" autoComplete="current-password" value={profile.currentPassword} onChange={(e) => setProfile({ ...profile, currentPassword: e.target.value })} required /></label>}<label className="fa-field fa-field-wide"><span>Avatar image URL</span><input type="url" value={profile.avatar} onChange={(e) => setProfile({ ...profile, avatar: e.target.value })} placeholder="https://example.com/avatar.png" /><small>Use a secure https:// image URL.</small></label><label className="fa-field fa-field-wide"><span>Bio <em>{profile.bio.length}/200</em></span><textarea value={profile.bio} maxLength={200} rows={3} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="A little about you…" /></label></div><div className="fa-form-footer"><span>Changes apply to your Fades account.</span><button className="fa-button fa-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}<span>↗</span></button></div></form>
            </div>
            {!user?.emailVerified && <div className="fa-card fa-verification-card"><div className="fa-inline-icon fa-icon-warn">!</div><div className="fa-flex-grow"><h3>Verify your email</h3><p>Verify your email address to help keep your account secure.</p><button className="fa-button fa-secondary" onClick={resendVerification} disabled={busy}>Send verification code</button><form className="fa-verify-form" onSubmit={verifyEmail}><input value={verifyCode} inputMode="numeric" maxLength={6} pattern="[0-9]{6}" onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))} placeholder="6-digit code" aria-label="Email verification code" required /><button className="fa-button fa-primary" disabled={busy || verifyCode.length !== 6}>Verify</button></form></div></div>}
            <div className="fa-card fa-info-row"><div className="fa-inline-icon">⌁</div><div className="fa-flex-grow"><h3>Fades account</h3><p>Your shared identity for Fades services.</p></div><div className="fa-info-right"><span>MEMBER SINCE</span><strong>{formatDate(user?.createdAt).split(",").slice(0, 1).join(",")}</strong></div></div>
          </>}

          {activeSection === "security" && <>
            <div className="fa-section-heading"><div><div className="fa-kicker">KEEP IT PROTECTED</div><h2>Security</h2><p>Make sure only you can access your Fades account.</p></div><span className="fa-section-symbol">◇</span></div>
            <div className="fa-card fa-security-summary"><div className="fa-security-emblem">⌑</div><div className="fa-flex-grow"><h3>Account protection</h3><p>{twofa.enabled ? "Two-step verification is active on your account." : "Add another layer of protection with an authenticator app."}</p></div><span className={`fa-pill ${twofa.enabled ? "fa-pill-green" : ""}`}>{twofa.enabled ? "PROTECTED" : "BASIC PROTECTION"}</span></div>
            <div className="fa-card"><div className="fa-card-heading"><div><h3>Change password</h3><p>Use a strong password you don't use anywhere else.</p></div><span className="fa-mini-symbol">⌁</span></div><form className="fa-form" onSubmit={changePassword}><div className="fa-form-grid"><label className="fa-field fa-field-wide"><span>Current password</span><input type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} required /></label><label className="fa-field"><span>New password</span><input type="password" autoComplete="new-password" minLength={8} maxLength={200} value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} required /><small>At least 8 characters.</small></label><label className="fa-field"><span>Confirm new password</span><input type="password" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} required /></label></div><label className="fa-check-row"><input type="checkbox" checked={passwordForm.signOutOthers} onChange={(e) => setPasswordForm({ ...passwordForm, signOutOthers: e.target.checked })} /><span><strong>Sign out other devices</strong><small>Recommended after changing your password.</small></span></label><div className="fa-form-footer"><span>You'll stay signed in on this device.</span><button className="fa-button fa-primary" disabled={busy}>Update password <span>↗</span></button></div></form></div>
            <div className="fa-card"><div className="fa-card-heading"><div><h3>Two-step verification</h3><p>Use an authenticator app to help prevent unauthorized sign-ins.</p></div><span className={`fa-pill ${twofa.enabled ? "fa-pill-green" : ""}`}>{twofa.enabled ? "ENABLED" : "OPTIONAL"}</span></div>
              {!twofa.enabled && !twofa.setup && <div className="fa-twofa-start"><div className="fa-twofa-steps"><span>01</span><div><strong>Start setup</strong><small>Generate a secret for your authenticator app.</small></div></div><div className="fa-twofa-steps"><span>02</span><div><strong>Confirm your code</strong><small>Enter the 6-digit code from your app.</small></div></div><button className="fa-button fa-primary" onClick={startTwofa} disabled={busy}>Set up two-step verification <span>↗</span></button></div>}
              {twofa.setup && !twofa.enabled && <form className="fa-setup-box" onSubmit={enableTwofa}><h4>Connect your authenticator</h4>{twofa.setup.qr && <img className="fa-qr" src={twofa.setup.qr} alt="Authenticator setup QR code" />}<p>Scan the QR code in your authenticator app, or enter this setup key manually.</p><code className="fa-secret">{twofa.setup.secret}</code><label className="fa-field"><span>6-digit authenticator code</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={twofa.code} onChange={(e) => setTwofa({ ...twofa, code: e.target.value.replace(/\D/g, "") })} required /></label><div className="fa-actions"><button type="button" className="fa-button fa-secondary" onClick={() => setTwofa({ ...twofa, setup: null, code: "" })}>Cancel</button><button className="fa-button fa-primary" disabled={busy || twofa.code.length !== 6}>Enable protection</button></div></form>}
              {twofa.enabled && <div className="fa-twofa-enabled"><div className="fa-enabled-line"><span className="fa-green-check">✓</span><div><strong>Authenticator connected</strong><small>{twofa.backupCodesLeft} backup codes remaining</small></div></div><form className="fa-form fa-backup-form" onSubmit={regenerateBackupCodes}><label className="fa-field"><span>Confirm password to regenerate backup codes</span><input type="password" value={twofa.password} onChange={(e) => setTwofa({ ...twofa, password: e.target.value })} required /></label><button className="fa-button fa-secondary" disabled={busy}>Regenerate backup codes</button></form><form className="fa-form fa-disable-form" onSubmit={disableTwofa}><h4>Turn off two-step verification</h4><div className="fa-form-grid"><label className="fa-field"><span>Password</span><input type="password" value={twofa.password} onChange={(e) => setTwofa({ ...twofa, password: e.target.value })} required /></label><label className="fa-field"><span>Authenticator or backup code</span><input value={twofa.code} onChange={(e) => setTwofa({ ...twofa, code: e.target.value })} required /></label></div><button className="fa-button fa-danger-button" disabled={busy}>Turn off verification</button></form></div>}
              {twofa.backupCodes.length > 0 && <div className="fa-backup-codes"><div><h4>Save your backup codes</h4><p>Each code can only be used once. Store these somewhere safe.</p></div><div className="fa-code-grid">{twofa.backupCodes.map((code) => <code key={code}>{code}</code>)}</div><button className="fa-button fa-secondary" onClick={() => navigator.clipboard?.writeText(twofa.backupCodes.join("\n"))}>Copy backup codes</button></div>}
            </div>
          </>}

          {activeSection === "devices" && <>
            <div className="fa-section-heading"><div><div className="fa-kicker">ACTIVE SESSIONS</div><h2>Your devices</h2><p>Review where your account is signed in and remove devices you don't recognize.</p></div><span className="fa-section-symbol">▣</span></div>
            <div className="fa-card fa-device-intro"><div className="fa-inline-icon">▣</div><div className="fa-flex-grow"><h3>{sessions.length} active {sessions.length === 1 ? "session" : "sessions"}</h3><p>Your current session is marked below. Signing out a device removes its access to your account.</p></div><button className="fa-button fa-secondary" onClick={loadSessions}>↻ Refresh</button></div>
            <div className="fa-card fa-session-list">{sessions.length === 0 ? <div className="fa-empty"><span>▣</span><h3>No sessions found</h3><p>Try refreshing this list.</p></div> : sessions.map((session) => <div className="fa-session" key={session.id}><div className="fa-device-icon">{/phone|android|ios/i.test(`${session.device} ${session.os}`) ? "▯" : "▰"}</div><div className="fa-session-info"><div className="fa-session-title"><strong>{session.device || [session.browser, session.os && `on ${session.os}`].filter(Boolean).join(" ") || "Unknown device"}</strong>{session.current && <span className="fa-pill fa-pill-green">THIS DEVICE</span>}</div><span>{[session.location, session.ip].filter(Boolean).join(" · ") || "Location unavailable"}</span><small>Last active {formatDate(session.lastActive)} · Signed in {formatDate(session.createdAt)}</small></div>{!session.current && <button className="fa-button fa-secondary fa-revoke" onClick={() => revokeSession(session.id)} disabled={busy}>Sign out</button>}</div>)}</div>
            <div className="fa-card fa-warning-row"><div className="fa-inline-icon fa-icon-warn">!</div><div className="fa-flex-grow"><h3>Don't recognize a device?</h3><p>Sign it out, then change your password and review your security activity.</p></div><button className="fa-button fa-danger-button" onClick={revokeOtherSessions} disabled={busy || sessions.filter((s) => !s.current).length === 0}>Sign out other devices</button></div>
          </>}

          {activeSection === "activity" && <>
            <div className="fa-section-heading"><div><div className="fa-kicker">ACCOUNT TIMELINE</div><h2>Security activity</h2><p>Recent sign-ins and important changes to your account.</p></div><span className="fa-section-symbol">↗</span></div>
            <div className="fa-card fa-activity-card"><div className="fa-card-heading"><div><h3>Recent activity</h3><p>Showing the latest security events available for your account.</p></div><button className="fa-button fa-secondary fa-small" onClick={loadActivity}>↻ Refresh</button></div>{activity.length === 0 ? <div className="fa-empty"><span>⌁</span><h3>Nothing to show yet</h3><p>New security events will appear here.</p></div> : <div className="fa-timeline">{activity.map((event) => <div className="fa-timeline-item" key={event.id}><span className={`fa-timeline-dot ${event.success ? "" : "fa-timeline-dot-alert"}`} /><div className="fa-timeline-main"><div className="fa-session-title"><strong>{String(event.type || "activity").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}</strong><span className={`fa-pill ${event.success ? "fa-pill-green" : "fa-pill-red"}`}>{event.success ? "SUCCESS" : "FAILED"}</span></div><p>{[event.device, event.location, event.ip].filter(Boolean).join(" · ") || "No additional device details"}</p><small>{formatDate(event.at)}</small></div></div>)}</div>}</div>
            <div className="fa-security-tip"><span>✦</span><p><strong>Security tip</strong> — If you see an unfamiliar sign-in, sign out that device and update your password immediately.</p></div>
          </>}

          {activeSection === "danger" && <>
            <div className="fa-section-heading"><div><div className="fa-kicker fa-kicker-danger">ACCOUNT CONTROL</div><h2>Delete account</h2><p>Make sure you understand what happens before continuing.</p></div><span className="fa-section-symbol fa-danger-symbol">⌫</span></div>
            <div className="fa-card fa-delete-intro"><div className="fa-delete-icon">!</div><div><h3>This action is permanent</h3><p>Deleting your Fades account permanently removes your account and associated data. This may include your sessions, Fades Browser data, chats, connected app grants, and OAuth apps you registered, as handled by the account API.</p></div></div>
            <div className="fa-card fa-delete-card"><div className="fa-card-heading"><div><h3>Before you delete</h3><p>Please review these points carefully.</p></div></div><ul className="fa-delete-list"><li><span>×</span><div><strong>You may lose access to Fades services</strong><small>Your Fades identity will no longer be available to sign in with.</small></div></li><li><span>×</span><div><strong>Your account data will be removed</strong><small>Associated data covered by the deletion endpoint will be deleted.</small></div></li><li><span>×</span><div><strong>This cannot be undone</strong><small>You won't be able to restore this account after deletion.</small></div></li></ul><form className="fa-delete-form" onSubmit={deleteAccount}><label className="fa-field"><span>Enter your password to continue</span><input type="password" autoComplete="current-password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} required /></label><label className="fa-check-row fa-delete-confirm"><input type="checkbox" checked={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.checked)} /><span><strong>I understand that deleting my account is permanent.</strong><small>This is not a temporary deactivation.</small></span></label><button className="fa-button fa-danger-button fa-delete-submit" disabled={busy || !deleteConfirmation || !deletePassword}>{busy ? "Deleting account…" : "Permanently delete account"}<span>↗</span></button></form></div>
          </>}
          <footer className="fa-content-footer"><span>FADES ACCOUNT CENTER</span><span>Need help? <a href="https://fades.lol">Visit Fades</a></span></footer>
        </section>
      </div>
    </main>
  );
}
