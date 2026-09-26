"use client";

import { useCallback, useState } from "react";
import { API_URL } from "../lib/constants";

// `onSessionChange` is called any time the signed-in user changes (login,
// logout, signup, verification, account deletion) so the caller can reset
// chat state. `onAbortActive` aborts any in-flight generation.
export function useAuth({ showToast, onSessionChange, onAbortActive }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");

  const [verificationOpen, setVerificationOpen] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationSubmitting, setVerificationSubmitting] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [resendSubmitting, setResendSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [deleteAccountConfirmOpen, setDeleteAccountConfirmOpen] = useState(false);
  const [deleteAccountSubmitting, setDeleteAccountSubmitting] = useState(false);

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        setUser(null);
        onSessionChange?.();
        return;
      }

      const data = await response.json();
      const authenticatedUser = data?.success && data?.user ? data.user : null;

      onSessionChange?.();
      setUser(authenticatedUser);
    } catch (error) {
      console.error("Session check failed:", error);
      setUser(null);
      onSessionChange?.();
    } finally {
      setAuthLoading(false);
    }
  }, [onSessionChange]);

  function openAuth(mode = "login") {
    setAuthMode(mode);
    setAuthError("");
    setAuthEmail("");
    setAuthUsername("");
    setAuthPassword("");
    setAuthDisplayName("");
    setAuthOpen(true);
  }

  function openVerification(email) {
    setVerificationEmail(email?.trim() || "");
    setVerificationCode("");
    setVerificationError("");
    setVerificationSubmitting(false);
    setResendSubmitting(false);
    setResendCooldown(60);

    setAuthOpen(false);
    setVerificationOpen(true);
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (authSubmitting) return;

    setAuthError("");
    setAuthSubmitting(true);
    onSessionChange?.(); // clear guest state before authenticating

    try {
      const endpoint = authMode === "login" ? "/auth/login" : "/auth/signup";

      const body =
        authMode === "login"
          ? { email: authEmail.trim(), password: authPassword }
          : {
              email: authEmail.trim(),
              username: authUsername.trim(),
              password: authPassword,
              displayName: authDisplayName.trim() || authUsername.trim(),
            };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => null);

      // Login attempted before email verification.
      if (response.status === 403 && data?.error === "EMAIL_NOT_VERIFIED") {
        setAuthSubmitting(false);
        setVerificationEmail(authEmail.trim());
        setVerificationCode("");
        setVerificationError("");
        setAuthOpen(false);
        setVerificationOpen(true);
        return;
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Authentication failed.");
      }

      // Signup intentionally does NOT create a session.
      if (authMode === "signup" && data?.requiresEmailVerification) {
        const email = authEmail.trim();
        setAuthSubmitting(false);
        setVerificationEmail(email);
        setVerificationCode("");
        setVerificationError("");
        setAuthOpen(false);
        setVerificationOpen(true);
        setResendCooldown(60);
        showToast("Verification code sent to your email.");
        return;
      }

      // Successful login.
      setUser(data.user);
      setAuthOpen(false);
      setAuthEmail("");
      setAuthUsername("");
      setAuthPassword("");
      setAuthDisplayName("");
      showToast("Welcome back.");
    } catch (error) {
      console.error("Authentication error:", error);
      setAuthError(error?.message || "Unable to connect to the Fades account service.");
      setUser(null);
      onSessionChange?.();
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function submitVerification(event) {
    event.preventDefault();
    if (verificationSubmitting) return;

    const email = verificationEmail.trim();
    const code = verificationCode.trim();

    if (!email) {
      setVerificationError("Enter the email address for your account.");
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setVerificationError("Enter the 6-digit verification code.");
      return;
    }

    setVerificationError("");
    setVerificationSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || data?.error || "That verification code is invalid.");
      }

      setUser(data.user);
      setVerificationOpen(false);
      setVerificationEmail("");
      setVerificationCode("");
      setVerificationError("");
      onSessionChange?.();
      showToast("Email verified. Welcome to Fades.");
    } catch (error) {
      console.error("Email verification error:", error);

      let message = error?.message || "Unable to verify your email.";
      if (message === "VERIFICATION_CODE_EXPIRED") {
        message = "That code has expired. Request a new code.";
      }
      if (message === "VERIFICATION_TOO_MANY_ATTEMPTS") {
        message = "Too many incorrect attempts. Request a new code.";
      }
      if (message === "INVALID_VERIFICATION_CODE") {
        message = "That code is incorrect. Check your email and try again.";
      }

      setVerificationError(message);
    } finally {
      setVerificationSubmitting(false);
    }
  }

  async function resendVerification() {
    if (resendSubmitting || resendCooldown > 0) return;

    const email = verificationEmail.trim();
    if (!email) {
      setVerificationError("Enter your email address first.");
      return;
    }

    setVerificationError("");
    setResendSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message || data?.error || "Unable to send a new verification code."
        );
      }

      setVerificationCode("");
      setResendCooldown(60);
      showToast("A new verification code was sent.");
    } catch (error) {
      console.error("Resend verification error:", error);

      let message = error?.message || "Unable to send a new verification code.";
      if (message === "VERIFICATION_RESEND_COOLDOWN") {
        message = "Please wait before requesting another code.";
      }

      setVerificationError(message);
    } finally {
      setResendSubmitting(false);
    }
  }

  function backToAuth() {
    if (verificationSubmitting || resendSubmitting) return;

    setVerificationOpen(false);
    setVerificationCode("");
    setVerificationError("");

    setAuthMode("login");
    setAuthError("");
    setAuthEmail(verificationEmail);
    setAuthPassword("");

    setAuthOpen(true);
  }

  async function logout() {
    onAbortActive?.();

    try {
      await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" });
    } catch (error) {
      console.error("Logout failed:", error);
    }

    setUser(null);
    onSessionChange?.();
    showToast("You've been signed out.");
  }

  const deleteAccount = useCallback(async () => {
    if (!user || deleteAccountSubmitting) return;

    setDeleteAccountSubmitting(true);
    onAbortActive?.();

    try {
      const response = await fetch(`${API_URL}/auth/account`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || data?.message || "Unable to delete your account.");
      }

      setUser(null);
      onSessionChange?.();
      setDeleteAccountConfirmOpen(false);
      showToast("Your Fades account has been deleted.");
    } catch (error) {
      console.error("Account deletion failed:", error);
      showToast(error?.message || "Unable to delete your account.", "error");
    } finally {
      setDeleteAccountSubmitting(false);
    }
  }, [user, deleteAccountSubmitting, showToast, onSessionChange, onAbortActive]);

  return {
    user,
    authLoading,
    checkSession,

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
    openVerification,
    submitVerification,
    resendVerification,
    backToAuth,

    deleteAccountConfirmOpen,
    setDeleteAccountConfirmOpen,
    deleteAccountSubmitting,
    deleteAccount,

    logout,
  };
}
