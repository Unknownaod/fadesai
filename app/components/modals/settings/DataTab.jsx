"use client";

export function DataTab({ user, exportAllChats, fileInputRef, setClearConfirmOpen }) {
  return (
    <>
      <div className="settings-card">
        <div className="settings-card-heading">
          <div className="settings-card-icon">↕</div>
          <div>
            <h3 className="settings-title">Your conversations</h3>
            <p className="settings-description">
              {user
                ? "Your conversations are synced to your Fades account."
                : "Guest conversations are temporary and are not stored on this device."}
            </p>
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-row-label">
            <div>Export all chats</div>
            <div>Download every conversation as a JSON file.</div>
          </div>

          <button className="settings-action-button" type="button" onClick={exportAllChats}>
            Export
          </button>
        </div>

        <div className="settings-row">
          <div className="settings-row-label">
            <div>Import chats</div>
            <div>Restore conversations from a Fades JSON export.</div>
          </div>

          <button
            className="settings-action-button"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            Import
          </button>
        </div>
      </div>

      <div className="settings-card settings-danger-card">
        <div className="settings-card-heading">
          <div className="settings-card-icon">×</div>
          <div>
            <h3 className="settings-title">Clear conversations</h3>
            <p className="settings-description">Remove every conversation from your current Fades session.</p>
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-row-label">
            <div>Clear all chats</div>
            <div>This cannot be undone.</div>
          </div>

          <button className="settings-action-button" type="button" onClick={() => setClearConfirmOpen(true)}>
            Clear chats
          </button>
        </div>
      </div>
    </>
  );
}
