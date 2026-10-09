"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProBadge } from "./ProBadge";

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

// matches the CSS breakpoint where the sidebar becomes a drawer
const MOBILE_BREAKPOINT = 900;

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

  // account
  user = null, // { name, email, image }
  isPro = false, // Pro badge only shows when true
  onSignOut,
  onOpenSettings, // optional override; defaults to router.push("/settings")
  onOpenAbout, // optional override; defaults to router.push("/settings?tab=about")
}) {
  const router = useRouter();

  const [gamingExpanded, setGamingExpanded] = useState(() =>
    activePage.startsWith("gaming")
  );
  const [profileOpen, setProfileOpen] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (activePage.startsWith("gaming")) setGamingExpanded(true);
  }, [activePage]);

  // close the profile menu on outside click / Escape
  useEffect(() => {
    if (!profileOpen) return;

    const onDown = (e) => {
      if (bottomRef.current && !bottomRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setProfileOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileOpen]);

  const closeOnMobile = () => {
    if (typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT) {
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
    if (onOpenSettings) onOpenSettings();
    else router.push("/settings");
  };

  const goAbout = () => {
    setProfileOpen(false);
    closeOnMobile();
    if (onOpenAbout) onOpenAbout();
    else router.push("/settings?tab=about");
  };

  const signOut = () => {
    setProfileOpen(false);
    onSignOut?.();
  };

  const displayName = user?.name || user?.email?.split("@")[0] || "Guest";
  const displaySub = user?.email || (isPro ? "Fades AI Pro" : "Not signed in");
  const initial = (user?.name || user?.email || "G").trim().charAt(0).toUpperCase();

  const renderChat = (chat) => {
    const id = chat.id ?? chat._id;
    const title = chat.title || "New chat";
    const isActive = id === activeChatId && activePage === "chat";
    const isEditing = id === editingChatId;

    return (
      <div key={id} className={`chat-item ${isActive ? "active" : ""}`}>
        {isEditing ? (
          <input
            className="chat-rename"
            autoFocus
            value={editingTitle ?? title}
            onChange={(e) => setEditingTitle?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename?.(id);
              if (e.key === "Escape") cancelRename?.();
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
              <span className="chat-icon">{chat.favorite ? "★" : "💬"}</span>
              <span className="chat-title">{title}</span>
              {chat.pinned && <span className="chat-icon" title="Pinned">📌</span>}
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
                title={chat.favorite ? "Remove favorite" : "Add favorite"}
                aria-label={chat.favorite ? "Remove favorite" : "Add favorite"}
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
        {/* top */}
        <div className="sidebar-top">
          <button
            type="button"
            className="sidebar-brand"
            onClick={() => navigate("chat")}
            title="Fades AI home"
          >
            <span className="brand-mark">
              <img src={logoSrc || "/logo.png"} alt="" className="brand-mark-img" />
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

        {/* new chat */}
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

        {/* gaming nav */}
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
              onClick={() => setGamingExpanded((v) => !v)}
              aria-expanded={gamingExpanded}
              aria-label={
                gamingExpanded ? "Collapse gaming navigation" : "Expand gaming navigation"
              }
            >
              {gamingExpanded ? "⌄" : "›"}
            </button>
          </div>

          {gamingExpanded && (
            <div className="sidebar-subnav">
              {GAMING_PAGES.filter((p) => p.id !== "gaming").map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className={`sidebar-nav-item sub ${
                    activePage === page.id ? "active" : ""
                  }`}
                  onClick={() => navigate(page.id)}
                  title={page.description}
                >
                  <span className="sidebar-nav-icon">{page.icon}</span>
                  <span>{page.label}</span>
                </button>
              ))}
            </div>
          )}
        </nav>

        {/* search */}
        <div className="sidebar-search">
          <span>⌕</span>
          <input
            ref={searchInputRef}
            value={search ?? ""}
            onChange={(e) => setSearch?.(e.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
          />
        </div>

        {/* chats */}
        <div className="chat-list">
          {cloudChatsLoading && <div className="chat-list-heading">Syncing your chats…</div>}

          {!search && pinnedChats.length > 0 && (
            <section className="chat-group">
              <div className="chat-group-title">Pinned</div>
              {pinnedChats.map(renderChat)}
            </section>
          )}

          {hasChats ? (
            <section className="chat-group">
              <div className="chat-group-title">{search ? "Search results" : "Recent chats"}</div>
              {filteredChats.map(renderChat)}
            </section>
          ) : (
            <div className="empty-chats">
              <div className="empty-icon">💬</div>
              <p>{search ? "No chats match your search" : "No chats yet"}</p>
              <small>
                {search
                  ? "Try a different keyword."
                  : "Your conversations will appear here."}
              </small>
            </div>
          )}

          {!search && otherChats.length > 0 && (
            <section className="chat-group">
              <div className="chat-group-title">Other chats</div>
              {otherChats.map(renderChat)}
            </section>
          )}
        </div>

        {/* bottom: click yourself -> profile menu */}
        <div className="sidebar-bottom" ref={bottomRef}>
          {profileOpen && (
            <div className="profile-menu" role="menu">
              <button type="button" role="menuitem" onClick={goSettings}>
                Settings
              </button>
              <button type="button" role="menuitem" onClick={goAbout}>
                About
              </button>
              {onSignOut && (
                <button type="button" role="menuitem" className="danger" onClick={signOut}>
                  Sign out
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            className="sidebar-user"
            onClick={() => setProfileOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
          >
            <span className="user-avatar">
              {user?.image ? (
                <img
                  src={user.image}
                  alt=""
                  style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                initial
              )}
            </span>

            <span className="user-info">
              <strong>{displayName}</strong>
              <span>{displaySub}</span>
            </span>

            <span className="user-arrow">{profileOpen ? "⌄" : "⌃"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
