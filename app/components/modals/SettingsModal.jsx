"use client";

import { GeneralTab } from "./settings/GeneralTab";
import { DataTab } from "./settings/DataTab";
import { AccountTab } from "./settings/AccountTab";
import { AboutTab } from "./settings/AboutTab";

const TABS = [
  { id: "general", icon: "⚙", label: "General", hint: "Appearance & chat" },
  { id: "data", icon: "↕", label: "Data", hint: "Import & export" },
  { id: "account", icon: "◎", label: "Account", hint: "Profile & access" },
  { id: "about", icon: "i", label: "About", hint: "Fades information" },
];

export function SettingsModal({
  settingsOpen,
  setSettingsOpen,
  settingsTab,
  setSettingsTab,
  settings,
  updateSetting,
  user,
  avatarLetter,
  auth,
  logoSrc,
  chats,
  totalMessages,
  exportAllChats,
  fileInputRef,
  setClearConfirmOpen,
  setAboutOpen,
}) {
  if (!settingsOpen) return null;

  return (
    <div className="modal-backdrop" onMouseDown={() => setSettingsOpen(false)}>
      <div className="login-modal settings-panel" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>
          ×
        </button>

        <div className="settings-header">
          <div>
            <span className="settings-eyebrow">FADES AI</span>
            <h2 className="settings-heading">Settings</h2>
            <p className="settings-subheading">Customize your Fades experience.</p>
          </div>

          <div className="settings-status">
            <span className="settings-status-dot" />
            Saved automatically
          </div>
        </div>

        <div className="settings-tabs" role="tablist" aria-label="Settings sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={settingsTab === tab.id}
              className={`settings-tab ${settingsTab === tab.id ? "active" : ""}`}
              onClick={() => setSettingsTab(tab.id)}
            >
              <span className="settings-tab-icon">{tab.icon}</span>
              <span>
                <strong>{tab.label}</strong>
                <small>{tab.hint}</small>
              </span>
            </button>
          ))}
        </div>

        <div className="settings-content">
          {settingsTab === "general" && <GeneralTab settings={settings} updateSetting={updateSetting} />}

          {settingsTab === "data" && (
            <DataTab
              user={user}
              exportAllChats={exportAllChats}
              fileInputRef={fileInputRef}
              setClearConfirmOpen={setClearConfirmOpen}
            />
          )}

          {settingsTab === "account" && (
            <AccountTab
              user={user}
              avatarLetter={avatarLetter}
              logout={auth.logout}
              deleteAccountSubmitting={auth.deleteAccountSubmitting}
              setDeleteAccountConfirmOpen={auth.setDeleteAccountConfirmOpen}
              setSettingsOpen={setSettingsOpen}
              openAuth={auth.openAuth}
            />
          )}

          {settingsTab === "about" && (
            <AboutTab
              logoSrc={logoSrc}
              chats={chats}
              totalMessages={totalMessages}
              user={user}
              setSettingsOpen={setSettingsOpen}
              setAboutOpen={setAboutOpen}
            />
          )}
        </div>

        <div className="settings-footer">
          <div>Fades AI · Preferences</div>
          <button type="button" onClick={() => setSettingsOpen(false)}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
