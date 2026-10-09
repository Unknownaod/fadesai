"use client";

import { MODEL_NAME } from "../lib/constants";
import { ThinkingBlock } from "./ThinkingBlock";

export function Composer({
  message,
  setMessage,
  textareaRef,
  resizeTextarea,
  sendMessage,
  loading,
  stopGeneration,
  settings,
  updateSetting,
  hasMessages,
  setClearConfirmOpen,
  modelOpen,
  setModelOpen,
  setAboutOpen,
  showToast,
}) {
  return (
    <div className="composer-container">
      <form className="composer" onSubmit={sendMessage}>
        <div className="composer-row">
          <button
            type="button"
            className="composer-add"
            aria-label="Add an attachment"
            onClick={() => showToast("Attachments are coming soon.")}
          >
            +
          </button>

          <textarea
            ref={textareaRef}
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              resizeTextarea();
            }}
            onKeyDown={(event) => {
              const send = settings.enterToSend
                ? event.key === "Enter" && !event.shiftKey
                : event.key === "Enter" && (event.metaKey || event.ctrlKey);

              if (send) {
                event.preventDefault();
                sendMessage(event);
              }
            }}
            placeholder="Message Fades..."
            rows={1}
            disabled={loading}
          />

          {loading ? (
            <button type="button" className="send" onClick={stopGeneration} aria-label="Stop generating">
              ■
            </button>
          ) : (
            <button
              type="submit"
              className={`send ${message.trim() ? "active" : ""}`}
              aria-label="Send message"
              disabled={!message.trim()}
            >
              ↑
            </button>
          )}
        </div>

        <div className="composer-tools">
          <button
            type="button"
            className="model-selector"
            onClick={() => setModelOpen((current) => !current)}
          >
            <span className="model-dot" />
            {MODEL_NAME}
            <span>⌄</span>
          </button>

          <button
            type="button"
            className={`composer-tool ${settings.showTimestamps ? "active" : ""}`}
            onClick={() => updateSetting("showTimestamps", !settings.showTimestamps)}
          >
            <span className="composer-tool-icon">◷</span>
            Timestamps
          </button>

          {hasMessages && (
            <button type="button" className="composer-tool" onClick={() => setClearConfirmOpen(true)}>
              <span className="composer-tool-icon">×</span>
              Clear chats
            </button>
          )}
        </div>

        {modelOpen && (
          <div className="dropdown" style={{ left: 8, bottom: 46 }}>
            <button type="button" className="dropdown-item active" onClick={() => setModelOpen(false)}>
              {MODEL_NAME}
            </button>

            <div className="dropdown-divider" />

            <button
              type="button"
              className="dropdown-item"
              onClick={() => {
                setModelOpen(false);
                setAboutOpen(true);
              }}
            >
              About this model
            </button>
          </div>
        )}
      </form>

      <div className="composer-footer">
        <span>
          {settings.enterToSend
            ? "Enter to send · Shift + Enter for a new line"
            : "⌘ + Enter to send · Enter for a new line"}
        </span>

        <span className="model-label">{MODEL_NAME}</span>
      </div>
    </div>
  );
}
