"use client";

import ReactMarkdown from "react-markdown";
import { formatTime } from "../lib/format";
import { ThinkingBlock } from "./ThinkingBlock";

const MARKDOWN_COMPONENTS = {
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

export function Messages({
  messages,
  messagesContainerRef,
  messagesEndRef,
  handleMessagesScroll,
  settings,
  user,
  copyText,
  resendFrom,
  loading,
}) {
  return (
    <div
      className="messages"
      ref={messagesContainerRef}
      onScroll={handleMessagesScroll}
      role="log"
      aria-live="polite"
    >
      {messages.map((item, index) => (
        <div
          key={item.id}
          className={`message-row ${item.role} ${
            item.error ? "error" : ""
          }`}
        >
          <div className="message-label">
            {item.role === "user" ? (
              <>
                {user?.displayName ||
                  user?.username ||
                  "You"}

                {user?.plan === "pro" && (
                  <span className="pro-badge">
                    PRO
                  </span>
                )}
              </>
            ) : (
              "Fades"
            )}

            {settings.showTimestamps &&
            item.createdAt
              ? ` · ${formatTime(item.createdAt)}`
              : ""}
          </div>

          {/* =========================
              GENERATING INDICATOR
          ========================= */}

          {item.role === "assistant" &&
          item.streaming &&
          !item.content ? (
            <div
              className="generating"
              aria-label="Fades is generating a response"
            >
              Generating...
            </div>
          ) : (
            <div className="message-content">
              {item.role === "assistant" ? (
                <>
                  <ReactMarkdown
                    components={MARKDOWN_COMPONENTS}
                  >
                    {item.content}
                  </ReactMarkdown>

                  {item.streaming && (
                    <span
                      className="streaming-cursor"
                      aria-hidden="true"
                    />
                  )}
                </>
              ) : (
                item.content
              )}
            </div>
          )}

          {/* =========================
              MESSAGE ACTIONS
          ========================= */}

          {item.role === "assistant" &&
          !item.streaming && (
            <div className="message-actions">
              <button
                type="button"
                onClick={() =>
                  copyText(item.content)
                }
              >
                Copy
              </button>

              <button
                type="button"
                onClick={() =>
                  resendFrom(index)
                }
                disabled={loading}
              >
                {item.error
                  ? "Retry"
                  : "Regenerate"}
              </button>
            </div>
          )}
        </div>
      ))}

      <div ref={messagesEndRef} />
    </div>
  );
}
