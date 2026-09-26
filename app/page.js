"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./globals.css";
import logoImage from "./logo.png";

import { useToasts } from "./hooks/useToasts";
import { useSettings } from "./hooks/useSettings";
import { useChats } from "./hooks/useChats";
import { useAuth } from "./hooks/useAuth";

import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { Hero } from "./components/Hero";
import { Messages } from "./components/Messages";
import { Composer } from "./components/Composer";
import { Toasts } from "./components/Toasts";

import { AuthModal } from "./components/modals/AuthModal";
import { VerificationModal } from "./components/modals/VerificationModal";
import { SettingsModal } from "./components/modals/SettingsModal";
import { DeleteAccountModal } from "./components/modals/DeleteAccountModal";
import { AboutModal } from "./components/modals/AboutModal";
import { ClearChatsModal } from "./components/modals/ClearChatsModal";

export default function Home() {
  const { toasts, showToast } = useToasts();
  const { settings, updateSetting } = useSettings();

  return (
    <HomeInner
      toasts={toasts}
      showToast={showToast}
      settings={settings}
      updateSetting={updateSetting}
    />
  );
}

// Split out so useChats can be re-created once `user` is known, without
// breaking the rules of hooks (user comes from useAuth, which itself needs
// a couple of callbacks from useChats).
function HomeInner({ toasts, showToast, settings, updateSetting }) {
  const [user, setUserBridge] = useState(null);

  const chats = useChats({ user, showToast });
  const auth = useAuth({
    showToast,
    onSessionChange: chats.resetForSessionChange,
    onAbortActive: chats.abortActive,
  });

  // Keep the bridged `user` value used by useChats in sync with auth's user.
  useEffect(() => {
    setUserBridge(auth.user);
  }, [auth.user]);

  useEffect(() => {
    auth.checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* UI-only state (not worth a hook of their own) */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("general");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const searchInputRef = useRef(null);

  const copyText = useCallback(
    async (content) => {
      try {
        await navigator.clipboard.writeText(content);
        showToast("Copied.");
      } catch (error) {
        console.error("Copy failed:", error);
        showToast("Unable to copy. Check clipboard permissions.", "error");
      }
    },
    [showToast]
  );

  /* Keyboard shortcuts */
  useEffect(() => {
    function handleKeyboard(event) {
      if (typeof event.key !== "string") return;

      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (modifier && event.shiftKey && key === "f") {
        event.preventDefault();
        setSidebarOpen(true);
        window.setTimeout(() => searchInputRef.current?.focus(), 60);
        return;
      }

      if (modifier && !event.shiftKey && key === "k") {
        event.preventDefault();
        chats.createChat();
        return;
      }

      if (event.key === "Escape") {
        setSidebarOpen(false);
        setProfileOpen(false);
        setSettingsOpen(false);
        setAboutOpen(false);
        setModelOpen(false);
        setClearConfirmOpen(false);

        if (
          !auth.authSubmitting &&
          !auth.verificationSubmitting &&
          !auth.resendSubmitting &&
          !auth.deleteAccountSubmitting
        ) {
          auth.setAuthOpen(false);
          auth.setVerificationOpen(false);
          auth.setDeleteAccountConfirmOpen(false);
        }
      }
    }

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [
    auth.authSubmitting,
    auth.verificationSubmitting,
    auth.resendSubmitting,
    auth.deleteAccountSubmitting,
    chats.createChat,
  ]);

  const avatarLetter =
    auth.user?.displayName?.charAt(0)?.toUpperCase() ||
    auth.user?.username?.charAt(0)?.toUpperCase() ||
    "F";

  const logoSrc = logoImage.src;

  // Wrap actions that close the sidebar/profile menu on mobile, matching
  // the original behavior of createChat/openChat also closing the sidebar.
  const createChat = useCallback(async () => {
    const id = await chats.createChat();
    setSidebarOpen(false);
    return id;
  }, [chats]);

  const openChat = useCallback(
    (chat) => {
      chats.openChat(chat);
      setSidebarOpen(false);
      setProfileOpen(false);
    },
    [chats]
  );

  return (
    <main className="app">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        logoSrc={logoSrc}
        createChat={createChat}
        loading={chats.loading}
        cloudChatsLoading={chats.cloudChatsLoading}
        search={chats.search}
        setSearch={chats.setSearch}
        searchInputRef={searchInputRef}
        filteredChats={chats.filteredChats}
        pinnedChats={chats.pinnedChats}
        otherChats={chats.otherChats}
        editingChatId={chats.editingChatId}
        editingTitle={chats.editingTitle}
        setEditingTitle={chats.setEditingTitle}
        openChat={openChat}
        activeChatId={chats.activeChatId}
        togglePin={chats.togglePin}
        toggleFavorite={chats.toggleFavorite}
        startRename={chats.startRename}
        saveRename={chats.saveRename}
        setEditingChatId={chats.setEditingChatId}
        deleteChat={chats.deleteChat}
        user={auth.user}
        avatarLetter={avatarLetter}
        profileOpen={profileOpen}
        setProfileOpen={setProfileOpen}
        openAuth={auth.openAuth}
        setSettingsOpen={setSettingsOpen}
        setAboutOpen={setAboutOpen}
        logout={auth.logout}
      />

      <div className="main-shell">
        <TopBar
          setSidebarOpen={setSidebarOpen}
          logoSrc={logoSrc}
          hasMessages={chats.hasMessages}
          exportCurrentChat={chats.exportCurrentChat}
          setSettingsOpen={setSettingsOpen}
          authLoading={auth.authLoading}
          user={auth.user}
          openAuth={auth.openAuth}
          avatarLetter={avatarLetter}
          setProfileOpen={setProfileOpen}
          createChat={createChat}
          loading={chats.loading}
          cloudChatsLoading={chats.cloudChatsLoading}
        />

        <section className={`hero ${chats.hasMessages ? "chat-active" : ""}`}>
          {!chats.hasMessages ? (
            <Hero applySuggestion={chats.applySuggestion} user={auth.user} />
          ) : (
            <Messages
              messages={chats.messages}
              messagesContainerRef={chats.messagesContainerRef}
              messagesEndRef={chats.messagesEndRef}
              handleMessagesScroll={chats.handleMessagesScroll}
              settings={settings}
              user={auth.user}
              copyText={copyText}
              resendFrom={chats.resendFrom}
              loading={chats.loading}
            />
          )}
        </section>

        <Composer
          message={chats.message}
          setMessage={chats.setMessage}
          textareaRef={chats.textareaRef}
          resizeTextarea={chats.resizeTextarea}
          sendMessage={chats.sendMessage}
          loading={chats.loading}
          stopGeneration={chats.stopGeneration}
          settings={settings}
          updateSetting={updateSetting}
          hasMessages={chats.hasMessages}
          setClearConfirmOpen={setClearConfirmOpen}
          modelOpen={modelOpen}
          setModelOpen={setModelOpen}
          setAboutOpen={setAboutOpen}
          showToast={showToast}
        />
      </div>

      <AuthModal auth={auth} logoSrc={logoSrc} />
      <VerificationModal auth={auth} logoSrc={logoSrc} />

      <SettingsModal
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        settingsTab={settingsTab}
        setSettingsTab={setSettingsTab}
        settings={settings}
        updateSetting={updateSetting}
        user={auth.user}
        avatarLetter={avatarLetter}
        auth={auth}
        logoSrc={logoSrc}
        chats={chats.chats}
        totalMessages={chats.totalMessages}
        exportAllChats={chats.exportAllChats}
        fileInputRef={chats.fileInputRef}
        setClearConfirmOpen={setClearConfirmOpen}
        setAboutOpen={setAboutOpen}
      />

      <DeleteAccountModal auth={auth} logoSrc={logoSrc} />
      <AboutModal aboutOpen={aboutOpen} setAboutOpen={setAboutOpen} logoSrc={logoSrc} user={auth.user} />
      <ClearChatsModal
        clearConfirmOpen={clearConfirmOpen}
        setClearConfirmOpen={setClearConfirmOpen}
        clearAllChats={() => {
          chats.clearAllChats();
          setClearConfirmOpen(false);
          setSettingsOpen(false);
        }}
        user={auth.user}
      />

      <input
        ref={chats.fileInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={chats.handleImport}
      />

      <Toasts toasts={toasts} />
    </main>
  );
}
