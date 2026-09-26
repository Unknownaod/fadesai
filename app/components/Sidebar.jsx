"use client";

import { ProBadge } from "./ProBadge";

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
  filteredChats,
  pinnedChats,
  otherChats,
  editingChatId,
  editingTitle,
  setEditingTitle,
  openChat,
  activeChatId,
  togglePin,
  toggleFavorite,
  startRename,
  saveRename,
  setEditingChatId,
  deleteChat,
  user,
  avatarLetter,
  profileOpen,
  setProfileOpen,
  openAuth,
  setSettingsOpen,
  setAboutOpen,
  logout,
}) {
  function renderChat(chat) {
    return (
      <div key={chat.id} className={`chat-item ${activeChatId === chat.id ? "active" : ""}`}>
        {editingChatId === chat.id ? (
          <input
            className="chat-rename"
            value={editingTitle}
            autoFocus
            onChange={(event) => setEditingTitle(event.target.value)}
            onBlur={() => saveRename(chat.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveRename(chat.id);
              }
              if (event.key === "Escape") {
                setEditingChatId(null);
                setEditingTitle("");
              }
            }}
          />
        ) : (
          <button className="chat-item-main" type="button" onClick={() => openChat(chat)}>
            <span className="chat-icon">{chat.favorite ? "★" : "◌"}</span>
            <span className="chat-title">{chat.title}</span>
          </button>
        )}

        {editingChatId !== chat.id && (
          <div className="chat-actions">
            <button
              type="button"
              title={chat.pinned ? "Unpin" : "Pin"}
              aria-label={chat.pinned ? "Unpin chat" : "Pin chat"}
              onClick={() => togglePin(chat.id)}
            >
              {chat.pinned ? "◆" : "◇"}
            </button>

            <button
              type="button"
              title="Favorite"
              aria-label="Favorite chat"
              onClick={() => toggleFavorite(chat.id)}
            >
              {chat.favorite ? "★" : "☆"}
            </button>

            <button type="button" title="Rename" aria-label="Rename chat" onClick={() => startRename(chat)}>
              ···
            </button>

            <button type="button" title="Delete" aria-label="Delete chat" onClick={() => deleteChat(chat.id)}>
              ×
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {sidebarOpen && (
        <button
          className="sidebar-overlay"
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <div className="brand-mark">
              <img src={logoSrc} alt="Fades" className="brand-mark-img" />
            </div>

            <div className="brand-name">
              Fades
              <small>AI</small>
            </div>
          </div>

          <button
            className="sidebar-close"
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            ×
          </button>
        </div>

        <button
          className="sidebar-new-chat"
          type="button"
          onClick={createChat}
          disabled={loading || cloudChatsLoading}
        >
          <span>+</span>
          <strong>New chat</strong>
          <kbd>⌘K</kbd>
        </button>

        <div className="sidebar-search">
          <span>⌕</span>
          <input
            ref={searchInputRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
          />
        </div>

        <div className="chat-list">
          {cloudChatsLoading ? (
            <div className="empty-chats">
              <span className="empty-icon">◌</span>
              <p>Loading chats</p>
              <small>Syncing your Fades account.</small>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="empty-chats">
              <span className="empty-icon">◌</span>
              <p>{search ? "No matches" : "No chats yet"}</p>
              <small>
                {search
                  ? "Try another search."
                  : user
                  ? "Start a conversation and it will be saved to your account."
                  : "Start a conversation. Guest chats are temporary."}
              </small>
            </div>
          ) : (
            <>
              {pinnedChats.length > 0 && (
                <div className="chat-group">
                  <div className="chat-group-title">Pinned</div>
                  {pinnedChats.map(renderChat)}
                </div>
              )}

              {otherChats.length > 0 && (
                <div className="chat-group">
                  <div className="chat-group-title">{pinnedChats.length > 0 ? "Recent" : "Chats"}</div>
                  {otherChats.map(renderChat)}
                </div>
              )}
            </>
          )}
        </div>

        <div className="sidebar-bottom">
          <button
            className="sidebar-user"
            type="button"
            onClick={() => {
              if (user) {
                setProfileOpen((current) => !current);
              } else {
                openAuth("login");
              }
            }}
          >
            <div className="user-avatar">{user ? avatarLetter : "?"}</div>

            <div className="user-info">
              <strong className="user-name-line">
                <span>{user ? user.displayName || user.username : "Guest"}</span>
                {user?.plan === "pro" && <ProBadge />}
              </strong>

              <span>{user ? user.email : "Guest mode"}</span>
            </div>

            <span className="user-arrow">⌄</span>
          </button>

          {profileOpen && user && (
            <div className="profile-menu">
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(true);
                  setProfileOpen(false);
                }}
              >
                Settings
              </button>

              <button
                type="button"
                onClick={() => {
                  setAboutOpen(true);
                  setProfileOpen(false);
                }}
              >
                About Fades
              </button>

              <button type="button" className="danger" onClick={logout}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
