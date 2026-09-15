"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import "./globals.css";

export default function Home() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  const suggestions = [
    {
      title: "Explain something",
      description: "Break down a complicated topic",
      prompt: "Explain something complicated to me in a simple way.",
    },
    {
      title: "Build something",
      description: "Create code, websites, and more",
      prompt: "Help me build something.",
    },
    {
      title: "Get creative",
      description: "Brainstorm ideas and possibilities",
      prompt: "Give me some creative ideas.",
    },
    {
      title: "Learn something",
      description: "Understand something new",
      prompt: "Teach me something interesting.",
    },
  ];

  /*
  =========================================================
  AUTO SCROLL
  =========================================================
  */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  /*
  =========================================================
  AUTO RESIZE TEXTAREA
  =========================================================
  */

  function resizeTextarea() {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";

    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }

  /*
  =========================================================
  SEND MESSAGE
  =========================================================
  */

  async function sendMessage(event, overrideMessage = null) {
    event?.preventDefault();

    const text = (overrideMessage !== null ? overrideMessage : message).trim();

    if (!text || loading) {
      return;
    }

    setMessage("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,

          /*
          Send the conversation to the server.

          This allows Fades to understand things like:

          User: My name is Kareem.
          Fades: Nice to meet you.

          User: What's my name?
          Fades: Your name is Kareem.
          */

          history: messages.map((item) => ({
            role: item.role,
            content: item.content,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Fades could not process the request.");
      }

      const assistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply || "I wasn't able to generate a response.",
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (error) {
      console.error("Fades AI error:", error);

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, something went wrong while connecting to Fades AI.",
          error: true,
        },
      ]);
    } finally {
      setLoading(false);

      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }

  /*
  =========================================================
  SUGGESTIONS
  =========================================================
  */

  function useSuggestion(prompt) {
    setMessage(prompt);

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }

  /*
  =========================================================
  NEW CHAT
  =========================================================
  */

  function newChat() {
    if (loading) {
      return;
    }

    setMessages([]);
    setMessage("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  }

  /*
  =========================================================
  COPY RESPONSE
  =========================================================
  */

  async function copyMessage(content) {
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  }

  /*
  =========================================================
  REGENERATE
  =========================================================
  */

  async function regenerateMessage(index) {
    if (loading) {
      return;
    }

    const previousUserMessage = [...messages]
      .slice(0, index)
      .reverse()
      .find((item) => item.role === "user");

    if (!previousUserMessage) {
      return;
    }

    const messagesWithoutResponse = messages.filter(
      (_, messageIndex) => messageIndex !== index
    );

    setMessages(messagesWithoutResponse);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: previousUserMessage.content,

          history: messagesWithoutResponse
            .filter((item) => item.id !== previousUserMessage.id)
            .map((item) => ({
              role: item.role,
              content: item.content,
            })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Fades could not regenerate the response.");
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply,
        },
      ]);
    } catch (error) {
      console.error("Regeneration error:", error);

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, I couldn't regenerate that response.",
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <main className="app">
      <div className="ambient" />
      <div className="noise" />

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <span>f</span>
          </div>

          <div className="brand-name">
            <span>Fades</span>
            <small>AI</small>
          </div>
        </div>

        <button className="new-chat" type="button" onClick={newChat} disabled={loading}>
          <span className="plus">+</span>
          <span>New chat</span>
        </button>
      </header>

      {/* =====================================================
          MAIN AREA
      ===================================================== */}

      <section className={`hero ${hasMessages ? "chat-active" : ""}`}>
        {!hasMessages ? (
          <div className="hero-content">
            <div className="fade-rule" aria-hidden="true" />

            <h1>What can I help with?</h1>

            <p>Ask a question, work through a problem, or start from an idea below.</p>

            <div className="suggestions">
              {suggestions.map((item) => (
                <button
                  key={item.title}
                  className="suggestion"
                  type="button"
                  onClick={() => useSuggestion(item.prompt)}
                >
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages" role="log" aria-live="polite">
            {messages.map((item, index) => (
              <div
                key={item.id}
                className={`message-row ${item.role} ${item.error ? "error" : ""}`}
              >
                <div className="message-label">{item.role === "user" ? "You" : "Fades"}</div>

                <div className="message-content">
                  {item.role === "assistant" ? (
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p>{children}</p>,
                        strong: ({ children }) => <strong>{children}</strong>,
                        em: ({ children }) => <em>{children}</em>,
                        ul: ({ children }) => <ul>{children}</ul>,
                        ol: ({ children }) => <ol>{children}</ol>,
                        li: ({ children }) => <li>{children}</li>,
                        h1: ({ children }) => <h2>{children}</h2>,
                        h2: ({ children }) => <h3>{children}</h3>,
                        h3: ({ children }) => <h4>{children}</h4>,
                        blockquote: ({ children }) => <blockquote>{children}</blockquote>,
                        code: ({ inline, children, ...props }) => {
                          if (inline) {
                            return <code {...props}>{children}</code>;
                          }

                          return (
                            <pre>
                              <code {...props}>{children}</code>
                            </pre>
                          );
                        },
                      }}
                    >
                      {item.content}
                    </ReactMarkdown>
                  ) : (
                    item.content
                  )}
                </div>

                {item.role === "assistant" && !item.error && (
                  <div className="message-actions">
                    <button type="button" onClick={() => copyMessage(item.content)} title="Copy">
                      Copy
                    </button>

                    <button
                      type="button"
                      onClick={() => regenerateMessage(index)}
                      disabled={loading}
                      title="Regenerate"
                    >
                      Regenerate
                    </button>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="message-row assistant">
                <div className="message-label">Fades</div>

                <div className="message-content thinking">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </section>

      {/* =====================================================
          COMPOSER
      ===================================================== */}

      <div className="composer-container">
        <form className="composer" onSubmit={sendMessage}>
          <button type="button" className="composer-add" aria-label="Add attachment">
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
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();

                sendMessage(event);
              }
            }}
            placeholder="Message Fades..."
            rows={1}
            disabled={loading}
          />

          <button
            type="submit"
            className={`send ${message.trim() ? "active" : ""}`}
            aria-label="Send message"
            disabled={loading || !message.trim()}
          >
            ↑
          </button>
        </form>

        <div className="composer-footer">
          <span>Fades may make mistakes. Check important information.</span>
          <span className="model-label">Fades AI</span>
        </div>
      </div>
    </main>
  );
}
