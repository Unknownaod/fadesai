
"use client";

import { useState } from "react";
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
}) {
  const [gamingExpanded, setGamingExpanded] = useState(
    activePage.startsWith("gaming")
  );

  const navigate = (page) => {
    onNavigate?.(page);
    if (typeof window !== "undefined" && window.innerWidth < 760) {
      setSidebarOpen?.(false);
    }
  };

  const renderChat = (chat) => {
    const id = chat.id ?? chat._id;
    const title = chat.title || "New chat";
    const isActive = id === activeChatId;
    const isEditing = id === editingChatId;

    return (
      <div
        key={id}
        className={`sidebar-chat ${isActive ? "active" : ""}`}
      >
        {isEditing ? (
          <form
            className="sidebar-chat-edit"
            onSubmit={(event) => {
              event.preventDefault();
              saveRename?.(id);
            }}
          >
            <input
              autoFocus
              value={editingTitle ?? title}
              onChange={(event) => setEditingTitle?.(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") cancelRename?.();
              }}
              aria-label="Rename chat"
            />
            <button type="submit" title="Save title">✓</button>
          </form>
        ) : (
          <>
            <button
              type="button"
              className="sidebar-chat-open"
              onClick={() => openChat?.(id)}
              title={title}
            >
              <span className="sidebar-chat-icon">
                {chat.favorite ? "⭐" : "💬"}
              </span>
              <span className="sidebar-chat-title">{title}</span>
              {chat.pinned && <span title="Pinned">📌</span>}
            </button>

            <div className="sidebar-chat-actions">
              <button
                type="button"
                title="Rename chat"
                onClick={() => startRename?.(id, title)}
              >
                ✏️
              </button>
              <button
                type="button"
                title={chat.pinned ? "Unpin chat" : "Pin chat"}
                onClick={() => togglePin?.(id)}
              >
                📌
              </button>
              <button
                type="button"
                title={chat.favorite ? "Remove favorite" : "Add favorite"}
                onClick={() => toggleFavorite?.(id)}
              >
                {chat.favorite ? "★" : "☆"}
              </button>
              <button
                type="button"
                title="Delete chat"
                onClick={() => deleteChat?.(id)}
              >
                🗑️
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen?.(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
        <div className="sidebar-header">
          <button
            type="button"
            className="sidebar-brand"
            onClick={() => navigate("chat")}
            title="Fades AI home"
          >
            <img src={logoSrc || "/logo.png"} alt="" className="sidebar-logo" />
            <span>Fades AI</span>
            <ProBadge />
          </button>

          <button
            type="button"
            className="sidebar-close"
            onClick={() => setSidebarOpen?.(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? "‹" : "›"}
          </button>
        </div>

        <div className="sidebar-main-actions">
          <button
            type="button"
            className="sidebar-primary-button"
            onClick={() => {
              navigate("chat");
              createChat?.();
            }}
            disabled={loading}
          >
            <span>＋</span>
            <span>New chat</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-button ${activePage === "chat-search" ? "selected" : ""}`}
            onClick={() => {
              navigate("chat");
              searchInputRef?.current?.focus();
            }}
          >
            <span>🔎</span>
            <span>Search chats</span>
          </button>
        </div>

        <div className="sidebar-section">
          <button
            type="button"
            className={`sidebar-section-heading ${activePage.startsWith("gaming") ? "selected" : ""}`}
            onClick={() => {
              setGamingExpanded((expanded) => !expanded);
              navigate("gaming");
            }}
            aria-expanded={gamingExpanded}
          >
            <span className="sidebar-section-heading-left">
              <span>🎮</span>
              <span>Gaming</span>
            </span>
            <span className="sidebar-chevron">{gamingExpanded ? "⌄" : "›"}</span>
          </button>

          {gamingExpanded && (
            <div className="sidebar-gaming-links">
              {GAMING_PAGES.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className={`sidebar-nav-button sidebar-gaming-button ${
                    activePage === page.id ? "selected" : ""
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
        </div>

        <div className="sidebar-search-wrap">
          <input
            ref={searchInputRef}
            value={search ?? ""}
            onChange={(event) => setSearch?.(event.target.value)}
            placeholder="Search your chats..."
            className="sidebar-search"
            aria-label="Search chats"
          />
          {search && (
            <button
              type="button"
              className="sidebar-search-clear"
              onClick={() => setSearch?.("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="sidebar-chat-list">
          {cloudChatsLoading && (
            <div className="sidebar-empty">Syncing your chats…</div>
          )}

          {!search && pinnedChats.length > 0 && (
            <section className="sidebar-chat-group">
              <div className="sidebar-chat-group-title">PINNED</div>
              {pinnedChats.map(renderChat)}
            </section>
          )}

          <section className="sidebar-chat-group">
            <div className="sidebar-chat-group-title">
              {search ? "SEARCH RESULTS" : "RECENT CHATS"}
            </div>

            {filteredChats.length > 0 ? (
              filteredChats.map(renderChat)
            ) : (
              <div className="sidebar-empty">
                {search ? "No chats match your search." : "Your conversations will appear here."}
              </div>
            )}
          </section>

          {!search && otherChats.length > 0 && (
            <section className="sidebar-chat-group">
              <div className="sidebar-chat-group-title">OTHER CHATS</div>
              {otherChats.map(renderChat)}
            </section>
          )}
        </div>

        <div className="sidebar-footer">
          <button
            type="button"
            className={`sidebar-nav-button ${activePage === "settings" ? "selected" : ""}`}
            onClick={() => navigate("settings")}
          >
            <span>⚙️</span>
            <span>Settings</span>
          </button>
          <div className="sidebar-footer-caption">
            Fades AI · Gaming and beyond
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
