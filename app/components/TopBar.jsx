"use client";

import { useEffect, useState } from "react";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "https://api.fades.lol"
).replace(/\/+$/, "");

function getProfileImage(profile) {
  if (!profile || typeof profile !== "object") return "";

  const candidates = [
    profile.image,
    profile.avatar,
    profile.avatarUrl,
    profile.avatarURL,
    profile.profilePicture,
    profile.profilePictureUrl,
    profile.profileImage,
    profile.photoURL,
    profile.picture,
    profile.user?.image,
    profile.user?.avatar,
    profile.user?.avatarUrl,
    profile.user?.profilePicture,
    profile.user?.picture,
    profile.account?.image,
    profile.account?.avatar,
  ];

  return (
    candidates.find(
      (value) => typeof value === "string" && value.trim()
    ) || ""
  );
}

function getAvatarLetter(profile, fallback = "G") {
  const name =
    profile?.name ||
    profile?.displayName ||
    profile?.username ||
    profile?.user?.name ||
    profile?.user?.username ||
    profile?.email ||
    profile?.user?.email ||
    "";

  return name.trim().charAt(0).toUpperCase() || fallback;
}

export function TopBar({
  setSidebarOpen,
  logoSrc,
  hasMessages,
  exportCurrentChat,
  authLoading,
  user,
  openAuth,
  avatarLetter = "G",
  setProfileOpen,
  createChat,
  loading,
  cloudChatsLoading,
}) {
  const [fetchedUser, setFetchedUser] = useState(null);
  const [imageFailed, setImageFailed] = useState(false);

  // Fetch the current Fades account when the parent doesn't provide one.
  useEffect(() => {
    if (user || authLoading) {
      setFetchedUser(null);
      return;
    }

    const controller = new AbortController();

    fetch(`${API_BASE}/auth/me`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (!data) return;

        if (
          data.authenticated === false ||
          data.loggedIn === false ||
          data.success === false
        ) {
          setFetchedUser(null);
          return;
        }

        setFetchedUser(data.user || data.account || data);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setFetchedUser(null);
        }
      });

    return () => controller.abort();
  }, [user, authLoading]);

  const account = user || fetchedUser;
  const profileImage = getProfileImage(account);

  const letter = getAvatarLetter(account, avatarLetter);

  useEffect(() => {
    setImageFailed(false);
  }, [profileImage]);

  const openAccountMenu = () => {
    setSidebarOpen?.(true);
    setProfileOpen?.(true);
  };

  return (
    <header className="topbar">
      <button
        className="mobile-menu"
        type="button"
        onClick={() => setSidebarOpen?.(true)}
        aria-label="Open sidebar"
      >
        ☰
      </button>

      <div className="mobile-brand">
        <div className="brand-mark">
          <img
            src={logoSrc || "/logo.png"}
            alt="Fades"
            className="brand-mark-img"
          />
        </div>

        <div className="brand-name">
          Fades
          <small>AI</small>
        </div>
      </div>

      <div className="topbar-spacer" />

      <div className="header-controls">
        {hasMessages && (
          <button
            className="header-control"
            type="button"
            onClick={exportCurrentChat}
          >
            Export
          </button>
        )}

        <button
          className="header-control"
          type="button"
          onClick={() => {
            window.location.href = "/settings";
          }}
        >
          Settings
        </button>
      </div>

      {!authLoading &&
        (!user && !fetchedUser ? (
          <button
            className="login-button"
            type="button"
            onClick={() => openAuth?.("login")}
          >
            Sign in
          </button>
        ) : (
          <button
            className="header-avatar"
            type="button"
            aria-label="Open account menu"
            title="Your account"
            onClick={openAccountMenu}
          >
            {profileImage && !imageFailed ? (
              <img
                src={profileImage}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setImageFailed(true)}
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              letter
            )}
          </button>
        ))}

      <button
        className="new-chat"
        type="button"
        onClick={createChat}
        disabled={loading || cloudChatsLoading}
      >
        <span className="plus">+</span>
        <span>New chat</span>
      </button>
    </header>
  );
}

export default TopBar;
