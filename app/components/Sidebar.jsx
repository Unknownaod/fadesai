"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProBadge } from "./ProBadge";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "https://api.fades.lol"
).replace(/\/+$/, "");

const GAMING_PAGES = [
  { id: "gaming", label: "Gaming Hub", icon: "🎮", description: "Your gaming dashboard" },
  { id: "gaming-news", label: "Gaming News", icon: "📰", description: "Latest stories from gaming sites" },
  { id: "gaming-releases", label: "New Releases", icon: "🚀", description: "New and upcoming games" },
  { id: "gaming-esports", label: "Esports", icon: "🏆", description: "Competitive gaming news" },
  { id: "gaming-updates", label: "Game Updates", icon: "🔄", description: "Patches and announcements" },
  { id: "gaming-deals", label: "Gaming Deals", icon: "🏷️", description: "Sales and discounts" },
  { id: "gaming-pc", label: "PC Gaming", icon: "🖥️", description: "PC games and hardware" },
  { id: "gaming-playstation", label: "PlayStation", icon: "🎯", description: "PlayStation news" },
  { id: "gaming-xbox", label: "Xbox", icon: "🟩", description: "Xbox news" },
  { id: "gaming-nintendo", label: "Nintendo", icon: "🍄", description: "Nintendo news" },
];

const MOBILE_BREAKPOINT = 900;

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
      (value) => typeof value === "string" && value.trim().length > 0
    ) || ""
  );
}

function getProfileName(profile) {
  if (!profile || typeof profile !== "object") return "";

  return (
    profile.name ||
    profile.displayName ||
    profile.username ||
    profile.user?.name ||
    profile.user?.displayName ||
    profile.user?.username ||
    ""
  );
}

function getProfileEmail(profile) {
  if (!profile || typeof profile !== "object") return "";

  return profile.email || profile.user?.email || "";
}

async function fetchCurrentUser(signal) {
  const response = await fetch(`${API_BASE}/auth/me`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Unable to load account (${response.status})`);
  }

  return response.json();
}

export function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  logoSrc,
  createChat,
  loading,
  cloudChatsLoading,
  search,
  setSearch,
  searchInputRef,
  filteredChats = [],
  pinnedChats = [],
  otherChats = [],
  editingChatId,
  editingTitle,
  setEditingTitle,
  activeChatId,
  openChat,
  deleteChat,
  startRename,
  saveRename,
  cancelRename,
  togglePin,
  toggleFavorite,
  activePage = "chat",
  onNavigate,

  // Account data supplied by the parent, when available.
  user = null,
  isPro = false,
  onSignOut,
  onOpenSettings,
  onOpenAbout,
}) {
  const router = useRouter();

  const [gamingExpanded, setGamingExpanded] = useState(() =>
    activePage.startsWith("gaming")
  );
  const [profileOpen, setProfileOpen] = useState(false);

  // Used when the parent doesn't provide a user object.
  const [fetchedUser, setFetchedUser] = useState(null);
  const [profileImageFailed, setProfileImageFailed] = useState(false);

  const bottomRef = useRef(null);

  useEffect(() => {
    if (activePage.startsWith("gaming")) {
      setGamingExpanded(true);
    }
  }, [activePage]);

  // Pull the signed-in account from the Fades API if no user was supplied.
  useEffect(() => {
    if (user) {
      setFetchedUser(null);
      return;
    }

    const controller = new AbortController();

    fetchCurrentUser(controller.signal)
      .then((data) => {
        const profile = data?.user || data?.account || data;

        // Avoid treating an unauthenticated response as a signed-in user.
        if (
          data?.authenticated === false ||
          data?.loggedIn === false ||
          data?.success === false
        ) {
          setFetchedUser(null);
          return;
        }

        setFetchedUser(profile);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setFetchedUser(null);
        }
      });

    return () => controller.abort();
  }, [user]);

  // Use parent data first, then the fetched profile.
  const account = user || fetchedUser;

  // Reset the broken-image fallback when the profile image changes.
  const profileImage = getProfileImage(account);

  useEffect(() => {
    setProfileImageFailed(false);
  }, [profileImage]);

  useEffect(() => {
    if (!profileOpen) return;

    const onDown = (event) => {
      if (
        bottomRef.current &&
        !bottomRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    };

    const onKey = (event) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileOpen]);

  const closeOnMobile = () => {
    if (
      typeof window !== "undefined" &&
      window.innerWidth < MOBILE_BREAKPOINT
    ) {
      setSidebarOpen?.(false);
    }
  };

  const navigate = (page) => {
    onNavigate?.(page);
    closeOnMobile();
  };

  const goSettings = () => {
    setProfileOpen(false);
    closeOnMobile();

    if (onOpenSettings) {
      onOpenSettings();
    } else {
      router.push("/settings");
    }
  };

  const goAbout = () => {
    setProfileOpen(false);
    closeOnMobile();

    if (onOpenAbout) {
      onOpenAbout();
    } else {
      router.push("/settings?tab=about");
    }
  };

  const signOut = () => {
    setProfileOpen(false);
    setFetchedUser(null);
    onSignOut?.();
  };

  const displayName =
    getProfileName(account) ||
    getProfileEmail(account)?.split("@")[0] ||
    "Guest";

  const email = getProfileEmail(account);

  const displaySub =
    email || (isPro ? "Fades AI Pro" : "Not signed in");

  const initial = (
    getProfileName(account) ||
    email ||
    "G"
  )
    .trim()
    .charAt(0)
    .toUpperCase();

  const renderChat = (chat) => {
    const id = chat.id ?? chat._id;
    const title = chat.title || "New chat";
    const isActive = id === activeChatId && activePage === "chat";
    const isEditing = id === editingChatId;

    return (
      <div
        key={id}
        className={`chat-item ${isActive ? "active" : ""}`}
      >
        {isEditing ? (
          <input
            className="chat-rename"
            autoFocus
            value={editingTitle ?? title}
            onChange={(event) =>
              setEditingTitle?.(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") saveRename?.(id);
              if (event.key === "Escape") cancelRename?.();
            }}
            onBlur={() => saveRename?.(id)}
            aria-label="Rename chat"
          />
        ) : (
          <>
            <button
              type="button"
              className="chat-item-main"
              title={title}
              onClick={() => {
                navigate("chat");
                openChat?.(id);
              }}
            >
              <span className="chat-icon">
                {chat.favorite ? "★" : "💬"}
              </span>

              <span className="chat-title">{title}</span>

              {chat.pinned && (
                <span className="chat-icon" title="Pinned">
                  📌
                </span>
              )}
            </button>

            <div className="chat-actions">
              <button
                type="button"
                title="Rename chat"
                aria-label={`Rename ${title}`}
                onClick={() => startRename?.(id, title)}
              >
                ✎
              </button>

              <button
                type="button"
                title={chat.pinned ? "Unpin chat" : "Pin chat"}
                aria-label={chat.pinned ? "Unpin chat" : "Pin chat"}
                onClick={() => togglePin?.(id)}
              >
                📌
              </button>

              <button
                type="button"
                title={
                  chat.favorite
                    ? "Remove favorite"
                    : "Add favorite"
                }
                aria-label={
                  chat.favorite
                    ? "Remove favorite"
                    : "Add favorite"
                }
                onClick={() => toggleFavorite?.(id)}
              >
                {chat.favorite ? "★" : "☆"}
              </button>

              <button
                type="button"
                title="Delete chat"
                aria-label={`Delete ${title}`}
                onClick={() => deleteChat?.(id)}
              >
                ✕
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const hasChats = filteredChats.length > 0;

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen?.(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        {/* Top */}
        <div className="sidebar-top">
          <button
            type="button"
            className="sidebar-brand"
            onClick={() => navigate("chat")}
            title="Fades AI home"
          >
            <span className="brand-mark">
              <img
                src={logoSrc || "/logo.png"}
                alt=""
                className="brand-mark-img"
              />
            </span>

            <span className="brand-name">
              Fades AI
              {isPro && <ProBadge />}
            </span>
          </button>

          <button
            type="button"
            className="sidebar-close"
            onClick={() => setSidebarOpen?.(false)}
            aria-label="Close sidebar"
          >
            ×
          </button>
        </div>

        {/* New chat */}
        <button
          type="button"
          className="sidebar-new-chat"
          onClick={() => {
            navigate("chat");
            createChat?.();
          }}
          disabled={loading}
        >
          <span>+</span>
          <strong>New chat</strong>
        </button>

        {/* Gaming navigation */}
        <nav className="sidebar-nav" aria-label="Gaming">
          <div className="sidebar-nav-row">
            <button
              type="button"
              className={`sidebar-nav-item ${
                activePage.startsWith("gaming") ? "active" : ""
              }`}
              onClick={() => navigate("gaming")}
              title="Open Gaming Hub"
            >
              <span className="sidebar-nav-icon">🎮</span>
              <span>Gaming Hub</span>
            </button>

            <button
              type="button"
              className="sidebar-nav-toggle"
              onClick={() => setGamingExpanded((value) => !value)}
              aria-expanded={gamingExpanded}
              aria-label={
                gamingExpanded
                  ? "Collapse gaming navigation"
                  : "Expand gaming navigation"
              }
            >
              {gamingExpanded ? "⌄" : "›"}
            </button>
          </div>

          {gamingExpanded && (
            <div className="sidebar-subnav">
              {GAMING_PAGES.filter(
                (page) => page.id !== "gaming"
              ).map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className={`sidebar-nav-item sub ${
                    activePage === page.id ? "active" : ""
                  }`}
                  onClick={() => navigate(page.id)}
                  title={page.description}
                >
                  <span className="sidebar-nav-icon">
                    {page.icon}
                  </span>
                  <span>{page.label}</span>
                </button>
              ))}
            </div>
          )}
        </nav>

        {/* Search */}
        <div className="sidebar-search">
          <span>⌕</span>
          <input
            ref={searchInputRef}
            value={search ?? ""}
            onChange={(event) =>
              setSearch?.(event.target.value)
            }
            placeholder="Search chats"
            aria-label="Search chats"
          />
        </div>

        {/* Chats */}
        <div className="chat-list">
          {cloudChatsLoading && (
            <div className="chat-list-heading">
              Syncing your chats…
            </div>
          )}

          {!search && pinnedChats.length > 0 && (
            <section className="chat-group">
              <div className="chat-group-title">Pinned</div>
              {pinnedChats.map(renderChat)}
            </section>
          )}

          {hasChats ? (
            <section className="chat-group">
              <div className="chat-group-title">
                {search ? "Search results" : "Recent chats"}
              </div>
              {filteredChats.map(renderChat)}
            </section>
          ) : (
            <div className="empty-chats">
              <div className="empty-icon">💬</div>
              <p>
                {search
                  ? "No chats match your search"
                  : "No chats yet"}
              </p>
              <small>
                {search
                  ? "Try a different keyword."
                  : "Your conversations will appear here."}
              </small>
            </div>
          )}

        {/* Account menu */}
        <div className="sidebar-bottom" ref={bottomRef}>
          {profileOpen && (
            <div className="profile-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={goSettings}
              >
                Settings
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={goAbout}
              >
                About
              </button>

              {onSignOut && (
                <button
                  type="button"
                  role="menuitem"
                  className="danger"
                  onClick={signOut}
                >
                  Sign out
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            className="sidebar-user"
            onClick={() => setProfileOpen((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
          >
            <span className="user-avatar">
              {profileImage && !profileImageFailed ? (
                <img
                  src={profileImage}
                  alt={`${displayName}'s profile`}
                  referrerPolicy="no-referrer"
                  onError={() => setProfileImageFailed(true)}
                  style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                initial
              )}
            </span>

            <span className="user-info">
              <strong>{displayName}</strong>
              <span>{displaySub}</span>
            </span>

            <span className="user-arrow">
              {profileOpen ? "⌄" : "⌃"}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
