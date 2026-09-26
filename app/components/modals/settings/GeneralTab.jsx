"use client";

export function GeneralTab({ settings, updateSetting }) {
  return (
    <>
      <div className="settings-card">
        <div className="settings-card-heading">
          <div className="settings-card-icon">◐</div>
          <div>
            <h3 className="settings-title">Appearance</h3>
            <p className="settings-description">Control how Fades looks on this device.</p>
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-row-label">
            <div>Theme</div>
            <div>Choose dark, light, or follow your system preference.</div>
          </div>

          <select
            className="settings-select"
            value={settings.theme}
            onChange={(event) => updateSetting("theme", event.target.value)}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </div>

        <div className="settings-row">
          <div className="settings-row-label">
            <div>Compact mode</div>
            <div>Reduce spacing so more messages fit on screen.</div>
          </div>

          <button
            type="button"
            aria-label="Toggle compact mode"
            aria-pressed={settings.compactMode}
            className={`toggle ${settings.compactMode ? "active" : ""}`}
            onClick={() => updateSetting("compactMode", !settings.compactMode)}
          />
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-heading">
          <div className="settings-card-icon">✦</div>
          <div>
            <h3 className="settings-title">Chat</h3>
            <p className="settings-description">Change how the composer and messages behave.</p>
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-row-label">
            <div>Enter to send</div>
            <div>Press Enter to send, or use Ctrl/⌘ + Enter when disabled.</div>
          </div>

          <button
            type="button"
            aria-label="Toggle enter to send"
            aria-pressed={settings.enterToSend}
            className={`toggle ${settings.enterToSend ? "active" : ""}`}
            onClick={() => updateSetting("enterToSend", !settings.enterToSend)}
          />
        </div>

        <div className="settings-row">
          <div className="settings-row-label">
            <div>Message timestamps</div>
            <div>Show the time beside each message.</div>
          </div>

          <button
            type="button"
            aria-label="Toggle message timestamps"
            aria-pressed={settings.showTimestamps}
            className={`toggle ${settings.showTimestamps ? "active" : ""}`}
            onClick={() => updateSetting("showTimestamps", !settings.showTimestamps)}
          />
        </div>
      </div>

      <div className="settings-info-banner">
        <span className="settings-info-icon">✓</span>
        <div>
          <strong>Settings are saved automatically</strong>
          <span>Your preferences are stored locally on this device.</span>
        </div>
      </div>
    </>
  );
}
