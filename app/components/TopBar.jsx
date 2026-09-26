"use client";

export function TopBar({
  setSidebarOpen,
  logoSrc,
  hasMessages,
  exportCurrentChat,
  setSettingsOpen,
  authLoading,
  user,
  openAuth,
  avatarLetter,
  setProfileOpen,
  createChat,
  loading,
  cloudChatsLoading,
}) {
  return (
    <header className="topbar">
      <button
        className="mobile-menu"
        type="button"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open sidebar"
      >
        ☰
      </button>

      <div className="mobile-brand">
        <div className="brand-mark">
          <img src={logoSrc} alt="Fades" className="brand-mark-img" />
        </div>

        <div className="brand-name">
          Fades
          <small>AI</small>
        </div>
      </div>

      <div className="topbar-spacer" />

      <div className="header-controls">
        {hasMessages && (
          <button className="header-control" type="button" onClick={exportCurrentChat}>
            Export
          </button>
        )}

        <button className="header-control" type="button" onClick={() => setSettingsOpen(true)}>
          Settings
        </button>
      </div>

      {!authLoading &&
        (!user ? (
          <button className="login-button" type="button" onClick={() => openAuth("login")}>
            Sign in
          </button>
        ) : (
          <button
            className="header-avatar"
            type="button"
            aria-label="Open account menu"
            onClick={() => {
              setSidebarOpen(true);
              setProfileOpen(true);
            }}
          >
            {avatarLetter}
          </button>
        ))}

      <button className="new-chat" type="button" onClick={createChat} disabled={loading || cloudChatsLoading}>
        <span className="plus">+</span>
        <span>New chat</span>
      </button>
    </header>
  );
}
