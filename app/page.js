"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import "./globals.css";

const STORAGE_KEY = "fades.chats.v1";
const API_URL = "https://api.fades.lol";

export default function Home() {
const [message, setMessage] = useState("");
const [messages, setMessages] = useState([]);
const [chats, setChats] = useState([]);
const [activeChatId, setActiveChatId] = useState(null);

const [loading, setLoading] = useState(false);
const [sidebarOpen, setSidebarOpen] = useState(false);
const [search, setSearch] = useState("");

const [user, setUser] = useState(null);
const [authLoading, setAuthLoading] = useState(true);

const [loginOpen, setLoginOpen] = useState(false);
const [authMode, setAuthMode] = useState("login");
const [authSubmitting, setAuthSubmitting] = useState(false);
const [authError, setAuthError] = useState("");

const [profileOpen, setProfileOpen] = useState(false);

const [authEmail, setAuthEmail] = useState("");
const [authUsername, setAuthUsername] = useState("");
const [authPassword, setAuthPassword] = useState("");
const [authDisplayName, setAuthDisplayName] = useState("");

const [editingChatId, setEditingChatId] = useState(null);
const [editingTitle, setEditingTitle] = useState("");

const textareaRef = useRef(null);
const messagesEndRef = useRef(null);

const suggestions = [
{
title: "Explain something",
description: "Break down a complicated topic",
prompt:
"Explain something complicated to me in a simple way.",
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

# /*

# LOAD LOCAL CHATS + CHECK REAL SESSION

*/

useEffect(() => {
try {
const savedChats = localStorage.getItem(STORAGE_KEY);


  if (savedChats) {
    const parsed = JSON.parse(savedChats);

    if (Array.isArray(parsed)) {
      setChats(parsed);
    }
  }
} catch (error) {
  console.error("Failed to load Fades chats:", error);
}

checkSession();


}, []);

# /*

# CHECK REAL AUTH SESSION

*/

async function checkSession() {
try {
const response = await fetch(`${API_URL}/auth/me`, {
method: "GET",
credentials: "include",
cache: "no-store",
});


  if (!response.ok) {
    setUser(null);
    return;
  }

  const data = await response.json();

  if (data?.success && data?.user) {
    setUser(data.user);
  } else {
    setUser(null);
  }
} catch (error) {
  console.error("Session check failed:", error);
  setUser(null);
} finally {
  setAuthLoading(false);
}


}

# /*

# SAVE CHATS

*/

useEffect(() => {
try {
localStorage.setItem(
STORAGE_KEY,
JSON.stringify(chats)
);
} catch (error) {
console.error("Failed to save chats:", error);
}
}, [chats]);

# /*

# AUTO SCROLL

*/

useEffect(() => {
messagesEndRef.current?.scrollIntoView({
behavior: "smooth",
});
}, [messages, loading]);

# /*

# AUTO RESIZE

*/

function resizeTextarea() {
const textarea = textareaRef.current;


if (!textarea) {
  return;
}

textarea.style.height = "auto";
textarea.style.height = `${Math.min(
  textarea.scrollHeight,
  160
)}px`;


}

# /*

# CREATE CHAT

*/

function createChat() {
if (loading) {
return;
}


const chat = {
  id: crypto.randomUUID(),
  title: "New chat",
  messages: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

setChats((current) => [chat, ...current]);
setActiveChatId(chat.id);
setMessages([]);
setMessage("");

setSidebarOpen(false);

setTimeout(() => {
  textareaRef.current?.focus();
}, 50);


}

# /*

# OPEN CHAT

*/

function openChat(chat) {
if (loading) {
return;
}


setActiveChatId(chat.id);
setMessages(chat.messages || []);
setMessage("");
setSidebarOpen(false);

setTimeout(() => {
  textareaRef.current?.focus();
}, 50);


}

# /*

# GENERATE CHAT TITLE

*/

function generateTitle(text) {
const clean = text.trim().replace(/\s+/g, " ");


if (!clean) {
  return "New chat";
}

if (clean.length <= 42) {
  return clean;
}

return `${clean.slice(0, 42)}...`;


}

# /*

# SEND MESSAGE

*/

async function sendMessage(
event,
overrideMessage = null
) {
event?.preventDefault();


const text = (
  overrideMessage !== null
    ? overrideMessage
    : message
).trim();

if (!text || loading) {
  return;
}

setMessage("");

if (textareaRef.current) {
  textareaRef.current.style.height = "auto";
}

let currentChatId = activeChatId;

if (!currentChatId) {
  const newChat = {
    id: crypto.randomUUID(),
    title: generateTitle(text),
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  currentChatId = newChat.id;

  setChats((current) => [newChat, ...current]);
  setActiveChatId(newChat.id);
}

const userMessage = {
  id: crypto.randomUUID(),
  role: "user",
  content: text,
};

const updatedMessages = [
  ...messages,
  userMessage,
];

setMessages(updatedMessages);
setLoading(true);

const assistantId = crypto.randomUUID();

setMessages((current) => [
  ...current,
  {
    id: assistantId,
    role: "assistant",
    content: "",
    streaming: true,
  },
]);

try {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: text,

      history: messages.map((item) => ({
        role: item.role,
        content: item.content,
      })),
    }),
  });

  if (!response.ok) {
    let errorMessage =
      "Fades could not process the request.";

    try {
      const errorText = await response.text();

      try {
        const errorData = JSON.parse(errorText);

        errorMessage =
          errorData?.error || errorMessage;
      } catch {
        if (errorText) {
          errorMessage = errorText;
        }
      }
    } catch {
      // Ignore error parsing failure.
    }

    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error(
      "Fades returned an empty response."
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let fullResponse = "";

  while (true) {
    const { value, done } =
      await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, {
      stream: true,
    });

    const events = buffer.split("\n\n");

    buffer = events.pop() || "";

    for (const event of events) {
      const lines = event.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data:")) {
          continue;
        }

        const rawData = line
          .slice(5)
          .trim();

        if (!rawData) {
          continue;
        }

        if (rawData === "[DONE]") {
          continue;
        }

        try {
          const data = JSON.parse(rawData);

          if (data.error) {
            throw new Error(data.error);
          }

          const chunk =
            data.content ??
            data.text ??
            data.delta ??
            data.message?.content ??
            "";

          if (!chunk) {
            continue;
          }

          fullResponse += chunk;

          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId
                ? {
                    ...item,
                    content: fullResponse,
                  }
                : item
            )
          );
        } catch (parseError) {
          if (
            parseError instanceof Error &&
            parseError.message !==
              "Unexpected end of JSON input"
          ) {
            console.warn(
              "Fades stream parsing warning:",
              parseError
            );
          }
        }
      }
    }
  }

  const finalMessages = [
    ...updatedMessages,
    {
      id: assistantId,
      role: "assistant",
      content:
        fullResponse ||
        "I wasn't able to generate a response.",
    },
  ];

  setMessages(finalMessages);

  setChats((current) =>
    current.map((chat) => {
      if (chat.id !== currentChatId) {
        return chat;
      }

      return {
        ...chat,
        title:
          chat.title === "New chat"
            ? generateTitle(text)
            : chat.title,
        messages: finalMessages,
        updatedAt: Date.now(),
      };
    })
  );
} catch (error) {
  console.error(
    "Fades AI error:",
    error
  );

  const errorMessage = {
    id: assistantId,
    role: "assistant",
    content:
      error?.message ||
      "Sorry, something went wrong while connecting to Fades AI.",
    error: true,
  };

  setMessages((current) =>
    current.map((item) =>
      item.id === assistantId
        ? errorMessage
        : item
    )
  );

  setChats((current) =>
    current.map((chat) => {
      if (chat.id !== currentChatId) {
        return chat;
      }

      return {
        ...chat,
        messages: [
          ...updatedMessages,
          errorMessage,
        ],
        updatedAt: Date.now(),
      };
    })
  );
} finally {
  setLoading(false);

  setTimeout(() => {
    textareaRef.current?.focus();
  }, 50);
}


}

# /*

# SUGGESTIONS

*/

function useSuggestion(prompt) {
setMessage(prompt);


setTimeout(() => {
  textareaRef.current?.focus();
}, 50);


}

# /*

# NEW CHAT

*/

function newChat() {
createChat();
}

# /*

# DELETE CHAT

*/

function deleteChat(chatId) {
if (loading) {
return;
}


setChats((current) =>
  current.filter(
    (chat) => chat.id !== chatId
  )
);

if (activeChatId === chatId) {
  setActiveChatId(null);
  setMessages([]);
  setMessage("");
}


}

# /*

# RENAME CHAT

*/

function startRename(chat) {
setEditingChatId(chat.id);
setEditingTitle(chat.title);
}

function saveRename(chatId) {
const title = editingTitle.trim();


if (!title) {
  setEditingChatId(null);
  return;
}

setChats((current) =>
  current.map((chat) =>
    chat.id === chatId
      ? {
          ...chat,
          title,
          updatedAt: Date.now(),
        }
      : chat
  )
);

setEditingChatId(null);
setEditingTitle("");


}

# /*

# COPY

*/

async function copyMessage(content) {
try {
await navigator.clipboard.writeText(
content
);
} catch (error) {
console.error(
"Copy failed:",
error
);
}
}

# /*

# REGENERATE

*/

async function regenerateMessage(index) {
if (loading) {
return;
}


const previousUserMessage = [...messages]
  .slice(0, index)
  .reverse()
  .find(
    (item) => item.role === "user"
  );

if (!previousUserMessage) {
  return;
}

const messagesWithoutResponse =
  messages.filter(
    (_, messageIndex) =>
      messageIndex !== index
  );

setMessages(messagesWithoutResponse);

await sendMessage(
  null,
  previousUserMessage.content
);


}

# /*

# OPEN AUTH MODAL

*/

function openAuth(mode = "login") {
setAuthMode(mode);
setAuthError("");
setAuthEmail("");
setAuthUsername("");
setAuthPassword("");
setAuthDisplayName("");
setLoginOpen(true);
setProfileOpen(false);
}

# /*

# REAL LOGIN / SIGNUP

*/

async function submitAuth(event) {
event.preventDefault();


if (authSubmitting) {
  return;
}

setAuthError("");
setAuthSubmitting(true);

try {
  const endpoint =
    authMode === "login"
      ? "/auth/login"
      : "/auth/signup";

  const body =
    authMode === "login"
      ? {
          email: authEmail.trim(),
          password: authPassword,
        }
      : {
          email: authEmail.trim(),
          username:
            authUsername.trim(),
          password: authPassword,
          displayName:
            authDisplayName.trim() ||
            authUsername.trim(),
        };

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      credentials: "include",
      body: JSON.stringify(body),
    }
  );

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !data?.success) {
    throw new Error(
      data?.error ||
        "Authentication failed."
    );
  }

  if (!data.user) {
    throw new Error(
      "Authentication succeeded, but no user account was returned."
    );
  }

  setUser(data.user);
  setLoginOpen(false);

  setAuthEmail("");
  setAuthUsername("");
  setAuthPassword("");
  setAuthDisplayName("");
  setAuthError("");
} catch (error) {
  console.error(
    "Fades authentication error:",
    error
  );

  setAuthError(
    error?.message ||
      "Unable to connect to the Fades account service."
  );
} finally {
  setAuthSubmitting(false);
}


}

# /*

# LOGOUT

*/

async function logout() {
try {
await fetch(
`${API_URL}/auth/logout`,
{
method: "POST",
credentials: "include",
}
);
} catch (error) {
console.error(
"Logout request failed:",
error
);
}


setUser(null);
setProfileOpen(false);


}

# /*

# FILTER CHATS

*/

const filteredChats = chats
.filter((chat) =>
chat.title
.toLowerCase()
.includes(
search.toLowerCase()
)
)
.sort(
(a, b) =>
b.updatedAt - a.updatedAt
);

const hasMessages =
messages.length > 0;

# /*

# RENDER

*/

return ( <main className="app"> <div className="ambient" /> <div className="noise" />


  {sidebarOpen && (
    <button
      className="sidebar-overlay"
      type="button"
      aria-label="Close sidebar"
      onClick={() =>
        setSidebarOpen(false)
      }
    />
  )}

  {/* =====================================================
      SIDEBAR
  ===================================================== */}

  <aside
    className={`sidebar ${
      sidebarOpen ? "open" : ""
    }`}
  >
    <div className="sidebar-top">
      <div className="sidebar-brand">
        <div className="brand-mark">
          <span>f</span>
        </div>

        <div className="brand-name">
          <span>Fades</span>
          <small>AI</small>
        </div>
      </div>

      <button
        className="sidebar-close"
        type="button"
        onClick={() =>
          setSidebarOpen(false)
        }
        aria-label="Close sidebar"
      >
        ×
      </button>
    </div>

    <button
      className="sidebar-new-chat"
      type="button"
      onClick={newChat}
      disabled={loading}
    >
      <span>+</span>
      <strong>New chat</strong>
      <kbd>⌘ K</kbd>
    </button>

    <div className="sidebar-search">
      <span>⌕</span>

      <input
        type="text"
        placeholder="Search chats"
        value={search}
        onChange={(event) =>
          setSearch(
            event.target.value
          )
        }
      />
    </div>

    <div className="chat-list">
      <div className="chat-list-heading">
        <span>Your chats</span>
      </div>

      {filteredChats.length === 0 ? (
        <div className="empty-chats">
          <span className="empty-icon">
            ◌
          </span>

          <p>No chats yet</p>

          <small>
            Start a conversation and
            it will appear here.
          </small>
        </div>
      ) : (
        filteredChats.map((chat) => (
          <div
            key={chat.id}
            className={`chat-item ${
              activeChatId === chat.id
                ? "active"
                : ""
            }`}
          >
            {editingChatId ===
            chat.id ? (
              <input
                className="chat-rename"
                value={editingTitle}
                autoFocus
                onChange={(event) =>
                  setEditingTitle(
                    event.target.value
                  )
                }
                onBlur={() =>
                  saveRename(
                    chat.id
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    saveRename(
                      chat.id
                    );
                  }

                  if (
                    event.key ===
                    "Escape"
                  ) {
                    setEditingChatId(
                      null
                    );
                  }
                }}
              />
            ) : (
              <button
                className="chat-item-main"
                type="button"
                onClick={() =>
                  openChat(chat)
                }
              >
                <span className="chat-icon">
                  ◌
                </span>

                <span className="chat-title">
                  {chat.title}
                </span>
              </button>
            )}

            {!editingChatId && (
              <div className="chat-actions">
                <button
                  type="button"
                  title="Rename"
                  onClick={() =>
                    startRename(
                      chat
                    )
                  }
                >
                  ···
                </button>

                <button
                  type="button"
                  title="Delete"
                  onClick={() =>
                    deleteChat(
                      chat.id
                    )
                  }
                >
                  ×
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>

    <div className="sidebar-bottom">
      <button
        className="sidebar-user"
        type="button"
        onClick={() => {
          if (user) {
            setProfileOpen(
              (current) =>
                !current
            );
          } else {
            openAuth("login");
          }
        }}
      >
        <div className="user-avatar">
          {user?.avatar ||
            user?.displayName
              ?.charAt(0)
              ?.toUpperCase() ||
            user?.username
              ?.charAt(0)
              ?.toUpperCase() ||
            "?"}
        </div>

        <div className="user-info">
          <strong>
            {user?.displayName ||
              user?.username ||
              "Guest"}
          </strong>

          <span>
            {user
              ? user.email
              : "Sign in to Fades"}
          </span>
        </div>

        <span className="user-arrow">
          ⌄
        </span>
      </button>

      {profileOpen && user && (
        <div className="profile-menu">
          <button type="button">
            Account
          </button>

          <button type="button">
            Settings
          </button>

          <button
            type="button"
            className="danger"
            onClick={logout}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  </aside>

  {/* =====================================================
      MAIN APP
  ===================================================== */}

  <div className="main-shell">
    <header className="topbar">
      <button
        className="mobile-menu"
        type="button"
        onClick={() =>
          setSidebarOpen(true)
        }
        aria-label="Open sidebar"
      >
        ☰
      </button>

      <div className="mobile-brand">
        <div className="brand-mark">
          <span>f</span>
        </div>

        <div className="brand-name">
          <span>Fades</span>
          <small>AI</small>
        </div>
      </div>

      <div className="topbar-spacer" />

      {!authLoading &&
        (!user ? (
          <button
            className="login-button"
            type="button"
            onClick={() =>
              openAuth("login")
            }
          >
            Sign in
          </button>
        ) : (
          <button
            className="header-avatar"
            type="button"
            onClick={() =>
              setProfileOpen(
                (current) =>
                  !current
              )
            }
          >
            {user?.displayName
              ?.charAt(0)
              ?.toUpperCase() ||
              user?.username
                ?.charAt(0)
                ?.toUpperCase() ||
              "F"}
          </button>
        ))}

      <button
        className="new-chat"
        type="button"
        onClick={newChat}
        disabled={loading}
      >
        <span className="plus">
          +
        </span>

        <span>New chat</span>
      </button>
    </header>

    {/* ===================================================
        HERO / CHAT
    =================================================== */}

    <section
      className={`hero ${
        hasMessages
          ? "chat-active"
          : ""
      }`}
    >
      {!hasMessages ? (
        <div className="hero-content">
          <div
            className="fade-rule"
            aria-hidden="true"
          />

          <h1>
            What can I help with?
          </h1>

          <p>
            Ask a question, work
            through a problem, or
            start from an idea below.
          </p>

          <div className="suggestions">
            {suggestions.map(
              (item) => (
                <button
                  key={item.title}
                  className="suggestion"
                  type="button"
                  onClick={() =>
                    useSuggestion(
                      item.prompt
                    )
                  }
                >
                  <strong>
                    {item.title}
                  </strong>

                  <span>
                    {
                      item.description
                    }
                  </span>
                </button>
              )
            )}
          </div>
        </div>
      ) : (
        <div
          className="messages"
          role="log"
          aria-live="polite"
        >
          {messages.map(
            (item, index) => (
              <div
                key={item.id}
                className={`message-row ${
                  item.role
                } ${
                  item.error
                    ? "error"
                    : ""
                }`}
              >
                <div className="message-label">
                  {item.role ===
                  "user"
                    ? "You"
                    : "Fades"}
                </div>

                <div className="message-content">
                  {item.role ===
                  "assistant" ? (
                    <ReactMarkdown
                      components={{
                        p: ({
                          children,
                        }) => (
                          <p>
                            {children}
                          </p>
                        ),

                        strong: ({
                          children,
                        }) => (
                          <strong>
                            {children}
                          </strong>
                        ),

                        em: ({
                          children,
                        }) => (
                          <em>
                            {children}
                          </em>
                        ),

                        ul: ({
                          children,
                        }) => (
                          <ul>
                            {children}
                          </ul>
                        ),

                        ol: ({
                          children,
                        }) => (
                          <ol>
                            {children}
                          </ol>
                        ),

                        li: ({
                          children,
                        }) => (
                          <li>
                            {children}
                          </li>
                        ),

                        h1: ({
                          children,
                        }) => (
                          <h2>
                            {children}
                          </h2>
                        ),

                        h2: ({
                          children,
                        }) => (
                          <h3>
                            {children}
                          </h3>
                        ),

                        h3: ({
                          children,
                        }) => (
                          <h4>
                            {children}
                          </h4>
                        ),

                        blockquote: ({
                          children,
                        }) => (
                          <blockquote>
                            {children}
                          </blockquote>
                        ),

                        code: ({
                          inline,
                          children,
                          ...props
                        }) => {
                          if (
                            inline
                          ) {
                            return (
                              <code
                                {...props}
                              >
                                {
                                  children
                                }
                              </code>
                            );
                          }

                          return (
                            <pre>
                              <code
                                {...props}
                              >
                                {
                                  children
                                }
                              </code>
                            </pre>
                          );
                        },
                      }}
                    >
                      {item.content ||
                        (item.streaming
                          ? " "
                          : "")}
                    </ReactMarkdown>
                  ) : (
                    item.content
                  )}
                </div>

                {item.role ===
                  "assistant" &&
                  !item.error &&
                  !item.streaming && (
                    <div className="message-actions">
                      <button
                        type="button"
                        onClick={() =>
                          copyMessage(
                            item.content
                          )
                        }
                        title="Copy"
                      >
                        Copy
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          regenerateMessage(
                            index
                          )
                        }
                        disabled={
                          loading
                        }
                        title="Regenerate"
                      >
                        Regenerate
                      </button>
                    </div>
                  )}
              </div>
            )
          )}

          {loading && (
            <div className="message-row assistant">
              <div className="message-label">
                Fades
              </div>

              <div className="message-content thinking">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          <div
            ref={messagesEndRef}
          />
        </div>
      )}
    </section>

    {/* ===================================================
        COMPOSER
    =================================================== */}

    <div className="composer-container">
      <form
        className="composer"
        onSubmit={sendMessage}
      >
        <button
          type="button"
          className="composer-add"
          aria-label="Add attachment"
        >
          +
        </button>

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(event) => {
            setMessage(
              event.target.value
            );

            resizeTextarea();
          }}
          onKeyDown={(event) => {
            if (
              event.key ===
                "Enter" &&
              !event.shiftKey
            ) {
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
          className={`send ${
            message.trim()
              ? "active"
              : ""
          }`}
          aria-label="Send message"
          disabled={
            loading ||
            !message.trim()
          }
        >
          ↑
        </button>
      </form>

      <div className="composer-footer">
        <span>
          Fades may make mistakes.
          Check important
          information.
        </span>

        <span className="model-label">
          Qwen · Fades AI
        </span>
      </div>
    </div>
  </div>

  {/* =====================================================
      REAL AUTH MODAL
  ===================================================== */}

  {loginOpen && (
    <div
      className="modal-backdrop"
      onMouseDown={() =>
        !authSubmitting &&
        setLoginOpen(false)
      }
    >
      <div
        className="login-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <button
          className="modal-close"
          type="button"
          onClick={() =>
            !authSubmitting &&
            setLoginOpen(false)
          }
          disabled={authSubmitting}
        >
          ×
        </button>

        <div className="modal-logo">
          <span>f</span>
        </div>

        <h2>
          {authMode === "login"
            ? "Welcome back"
            : "Create your account"}
        </h2>

        <p>
          {authMode === "login"
            ? "Sign in to your Fades account and continue your conversations."
            : "Create a Fades account to keep your account and conversations connected."}
        </p>

        {authError && (
          <div className="auth-error">
            {authError}
          </div>
        )}

        <form
          className="auth-form"
          onSubmit={submitAuth}
        >
          {authMode ===
            "signup" && (
            <>
              <label>
                Display name

                <input
                  type="text"
                  value={
                    authDisplayName
                  }
                  onChange={(event) =>
                    setAuthDisplayName(
                      event.target
                        .value
                    )
                  }
                  placeholder="Fades User"
                  autoComplete="name"
                  disabled={
                    authSubmitting
                  }
                />
              </label>

              <label>
                Username

                <input
                  type="text"
                  value={
                    authUsername
                  }
                  onChange={(event) =>
                    setAuthUsername(
                      event.target
                        .value
                    )
                  }
                  placeholder="fadesuser"
                  autoComplete="username"
                  minLength={3}
                  maxLength={24}
                  disabled={
                    authSubmitting
                  }
                />
              </label>
            </>
          )}

          <label>
            Email

            <input
              type="email"
              value={authEmail}
              onChange={(event) =>
                setAuthEmail(
                  event.target
                    .value
                )
              }
              placeholder="you@example.com"
              autoComplete="email"
              required
              disabled={
                authSubmitting
              }
            />
          </label>

          <label>
            Password

            <input
              type="password"
              value={
                authPassword
              }
              onChange={(event) =>
                setAuthPassword(
                  event.target
                    .value
                )
              }
              placeholder="••••••••"
              autoComplete={
                authMode ===
                "login"
                  ? "current-password"
                  : "new-password"
              }
              minLength={8}
              required
              disabled={
                authSubmitting
              }
            />
          </label>

          <button
            className="auth-submit"
            type="submit"
            disabled={
              authSubmitting
            }
          >
            {authSubmitting
              ? "Please wait..."
              : authMode ===
                "login"
              ? "Sign in"
              : "Create account"}
          </button>
        </form>

        <div className="auth-switch">
          <span>
            {authMode ===
            "login"
              ? "Don't have an account?"
              : "Already have an account?"}
          </span>

          <button
            type="button"
            onClick={() =>
              openAuth(
                authMode ===
                  "login"
                  ? "signup"
                  : "login"
              )
            }
            disabled={
              authSubmitting
            }
          >
            {authMode ===
            "login"
              ? "Create one"
              : "Sign in"}
          </button>
        </div>

        <div className="login-divider">
          <span>or</span>
        </div>

        <button
          className="guest-button"
          type="button"
          onClick={() =>
            !authSubmitting &&
            setLoginOpen(false)
          }
          disabled={
            authSubmitting
          }
        >
          Continue as guest
        </button>

        <small className="login-note">
          Guest chats stay on this
          device. Sign in to use a
          Fades account.
        </small>
      </div>
    </div>
  )}
</main>


);
}
