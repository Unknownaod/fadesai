"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const API_URL = "https://api.fades.lol";

const CHAT_STORAGE_KEY = "fades.chats.v2";
const SETTINGS_STORAGE_KEY = "fades.settings.v1";

const DEFAULT_SETTINGS = {
  theme: "dark",
  compactMode: false,
  enterToSend: true,
  showTimestamps: true,
  soundEffects: false,
};

const SUGGESTIONS = [
  {
    title: "Explain something",
    prompt: "Explain a complicated topic to me in a simple way.",
    icon: "✦",
  },
  {
    title: "Write something",
    prompt: "Help me write something professional and polished.",
    icon: "✎",
  },
  {
    title: "Help me code",
    prompt: "Help me debug and improve some code.",
    icon: "</>",
  },
  {
    title: "Brainstorm ideas",
    prompt: "Give me some creative ideas for a project.",
    icon: "◇",
  },
];

function createId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function formatDate(timestamp) {
  if (!timestamp) return "";

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}

function formatTime(timestamp) {
  if (!timestamp) return "";

  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}

function downloadFile(filename, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function normalizeChats(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter(Boolean)
    .map((chat) => ({
      id: chat.id || createId("chat"),
      title: chat.title || "New chat",
      createdAt: chat.createdAt || Date.now(),
      updatedAt: chat.updatedAt || chat.createdAt || Date.now(),
      pinned: Boolean(chat.pinned),
      favorite: Boolean(chat.favorite),
      messages: Array.isArray(chat.messages)
        ? chat.messages
            .filter(
              (message) =>
                message &&
                (message.role === "user" || message.role === "assistant") &&
                typeof message.content === "string"
            )
            .map((message) => ({
              id: message.id || createId("message"),
              role: message.role,
              content: message.content,
              createdAt: message.createdAt || Date.now(),
            }))
        : [],
    }));
}

function extractAssistantText(message) {
  if (!message) return "";

  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === "string") return part;
        return part?.text || part?.content || "";
      })
      .join("");
  }

  return "";
}

function buildHistory(messages) {
  return messages
    .filter(
      (message) =>
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim()
    )
    .slice(-30)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

function MarkdownCode({ inline, children }) {
  const code = String(children ?? "");

  if (inline) {
    return <code className="inline-code">{code}</code>;
  }

  return (
    <pre className="code-block">
      <code>{code}</code>
    </pre>
  );
}

export default function Home() {
  /*
  =======================================================
  CORE CHAT STATE
  =======================================================
  */

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState(null);

  /*
  =======================================================
  UI STATE
  =======================================================
  */

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [toast, setToast] = useState(null);

  const [search, setSearch] = useState("");

  /*
  =======================================================
  AUTH STATE
  =======================================================
  */

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");

  const [authEmail, setAuthEmail] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");

  /*
  =======================================================
  CHAT EDITING
  =======================================================
  */

  const [editingChatId, setEditingChatId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  /*
  =======================================================
  SETTINGS
  =======================================================
  */

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  /*
  =======================================================
  REFS
  =======================================================
  */

  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const searchInputRef = useRef(null);
  const toastTimerRef = useRef(null);

  /*
  =======================================================
  TOAST
  =======================================================
  */

  const showToast = useCallback((text, type = "normal") => {
    setToast({
      id: createId("toast"),
      text,
      type,
    });

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3200);
  }, []);

  /*
  =======================================================
  LOAD LOCAL DATA
  =======================================================
  */

  useEffect(() => {
    try {
      const savedChats = localStorage.getItem(CHAT_STORAGE_KEY);

      if (savedChats) {
        const parsed = JSON.parse(savedChats);
        setChats(normalizeChats(parsed));
      }
    } catch (error) {
      console.error("Failed to load chats:", error);
    }

    try {
      const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);

      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);

        setSettings({
          ...DEFAULT_SETTINGS,
          ...(parsed || {}),
        });
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }, []);

  /*
  =======================================================
  SAVE LOCAL DATA
  =======================================================
  */

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats));
    } catch (error) {
      console.error("Failed to save chats:", error);
    }
  }, [chats]);

  useEffect(() => {
    try {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(settings)
      );
    } catch (error) {
      console.error("Failed to save settings:", error);
    }

    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = settings.theme;
    }
  }, [settings]);

  /*
  =======================================================
  AUTH SESSION
  =======================================================
  */

  const checkSession = useCallback(async () => {
    try {
      setAuthLoading(true);

      const response = await fetch(`${API_URL}/auth/me`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.success && data?.user) {
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
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  /*
  =======================================================
  KEYBOARD SHORTCUTS
  =======================================================
  */

  useEffect(() => {
    const handler = (event) => {
      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        createNewChat();
        return;
      }

      if (
        modifier &&
        event.shiftKey &&
        event.key.toLowerCase() === "f"
      ) {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
        setProfileOpen(false);
        setSettingsOpen(false);
        setAboutOpen(false);
        setModelOpen(false);
        setClearConfirmOpen(false);
        setSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handler);

    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, []);

  /*
  =======================================================
  SCROLL HANDLING
  =======================================================
  */

  useEffect(() => {
    if (!messagesEndRef.current) return;

    messagesEndRef.current.scrollIntoView({
      behavior: loading ? "auto" : "smooth",
      block: "end",
    });
  }, [messages, loading]);

  const handleMessagesScroll = useCallback(() => {
    const element = messagesContainerRef.current;

    if (!element) return;

    const distance =
      element.scrollHeight -
      element.scrollTop -
      element.clientHeight;

    setShowScrollButton(distance > 500);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, []);

  /*
  =======================================================
  TEXTAREA
  =======================================================
  */

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(
      textarea.scrollHeight,
      220
    )}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [message, resizeTextarea]);

  /*
  =======================================================
  CHAT HELPERS
  =======================================================
  */

  const activeChat = useMemo(() => {
    return chats.find((chat) => chat.id === activeChatId) || null;
  }, [chats, activeChatId]);

  const createNewChat = useCallback(() => {
    if (loading) {
      showToast("Stop the current response first.", "error");
      return;
    }

    setActiveChatId(null);
    setMessages([]);
    setMessage("");
    setSidebarOpen(false);
    setProfileOpen(false);

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }, [loading, showToast]);

  const generateChatTitle = useCallback((text) => {
    const cleaned = text
      .replace(/\s+/g, " ")
      .replace(/[\r\n]+/g, " ")
      .trim();

    if (!cleaned) return "New chat";

    if (cleaned.length <= 45) {
      return cleaned;
    }

    return `${cleaned.slice(0, 45).trim()}…`;
  }, []);

  const ensureChat = useCallback(
    (firstMessage) => {
      if (activeChatId) {
        return activeChatId;
      }

      const id = createId("chat");
      const now = Date.now();

      const newChat = {
        id,
        title: generateChatTitle(firstMessage),
        createdAt: now,
        updatedAt: now,
        pinned: false,
        favorite: false,
        messages: [],
      };

      setChats((current) => [newChat, ...current]);
      setActiveChatId(id);

      return id;
    },
    [activeChatId, generateChatTitle]
  );

  const openChat = useCallback(
    (chatId) => {
      if (loading) {
        showToast("Stop the current response first.", "error");
        return;
      }

      const chat = chats.find((item) => item.id === chatId);

      if (!chat) return;

      setActiveChatId(chat.id);
      setMessages(chat.messages || []);
      setMessage("");
      setSidebarOpen(false);
      setProfileOpen(false);

      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    },
    [chats, loading, showToast]
  );

  /*
  =======================================================
  UPDATE CHAT STORAGE
  =======================================================
  */

  const saveMessagesToChat = useCallback(
    (chatId, nextMessages) => {
      setChats((current) =>
        current.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: nextMessages,
                updatedAt: Date.now(),
              }
            : chat
        )
      );
    },
    []
  );

  /*
  =======================================================
  SEND MESSAGE
  =======================================================
  */

  const sendMessage = useCallback(
    async (
      eventOrNull = null,
      suppliedText = null,
      suppliedMessages = null
    ) => {
      if (eventOrNull?.preventDefault) {
        eventOrNull.preventDefault();
      }

      if (loading) return;

      const text =
        suppliedText !== null
          ? suppliedText.trim()
          : message.trim();

      if (!text) return;

      const baseMessages = Array.isArray(suppliedMessages)
        ? suppliedMessages
        : messages;

      const chatId = ensureChat(text);

      const userMessage = {
        id: createId("message"),
        role: "user",
        content: text,
        createdAt: Date.now(),
      };

      const nextMessages = [...baseMessages, userMessage];

      setMessages(nextMessages);
      setMessage("");
      setLoading(true);

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      const assistantId = createId("message");

      setStreamingMessageId(assistantId);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const timeout = setTimeout(() => {
        controller.abort();
      }, 5 * 60 * 1000);

      try {
        const history = buildHistory(baseMessages);

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: text,
            history,
          }),
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          let errorMessage = `Request failed with status ${response.status}.`;

          try {
            const errorData = await response.json();

            if (errorData?.error) {
              errorMessage = errorData.error;
            }
          } catch {
            // Response wasn't JSON.
          }

          throw new Error(errorMessage);
        }

        if (!response.body) {
          throw new Error("The AI response did not contain a stream.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = "";
        let assistantText = "";

        const appendAssistant = (content) => {
          assistantText += content;

          const streamingMessage = {
            id: assistantId,
            role: "assistant",
            content: assistantText,
            createdAt: Date.now(),
          };

          setMessages([...nextMessages, streamingMessage]);
        };

        const processEvent = (rawEvent) => {
          const lines = rawEvent.split(/\r?\n/);

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;

            const payload = line.slice(5).trim();

            if (!payload || payload === "[DONE]") {
              continue;
            }

            let parsed;

            try {
              parsed = JSON.parse(payload);
            } catch {
              continue;
            }

            if (parsed?.error) {
              throw new Error(parsed.error);
            }

            const chunk =
              parsed?.text ??
              parsed?.content ??
              parsed?.delta ??
              parsed?.message?.content ??
              "";

            if (typeof chunk === "string" && chunk) {
              appendAssistant(chunk);
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, {
            stream: true,
          });

          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() || "";

          for (const event of events) {
            processEvent(event);
          }
        }

        buffer += decoder.decode();

        if (buffer.trim()) {
          processEvent(buffer);
        }

        if (!assistantText.trim()) {
          throw new Error(
            "The AI returned an empty response."
          );
        }

        const finalAssistantMessage = {
          id: assistantId,
          role: "assistant",
          content: assistantText,
          createdAt: Date.now(),
        };

        const finalMessages = [
          ...nextMessages,
          finalAssistantMessage,
        ];

        setMessages(finalMessages);
        saveMessagesToChat(chatId, finalMessages);
      } catch (error) {
        if (error?.name === "AbortError") {
          if (assistantTextSafe(messages, assistantId)) {
            // Nothing needed here. The current streamed content remains visible.
          }
        } else {
          console.error("AI request failed:", error);

          const errorMessage = {
            id: assistantId,
            role: "assistant",
            content:
              error?.message ||
              "Something went wrong while contacting Fades AI.",
            createdAt: Date.now(),
          };

          const errorMessages = [
            ...nextMessages,
            errorMessage,
          ];

          setMessages(errorMessages);
          saveMessagesToChat(chatId, errorMessages);

          showToast(
            error?.message || "AI request failed.",
            "error"
          );
        }
      } finally {
        clearTimeout(timeout);

        setLoading(false);
        setStreamingMessageId(null);
        abortControllerRef.current = null;
      }
    },
    [
      ensureChat,
      loading,
      message,
      messages,
      saveMessagesToChat,
      showToast,
    ]
  );

  /*
  =======================================================
  STOP GENERATION
  =======================================================
  */

  const stopGeneration = useCallback(() => {
    if (!abortControllerRef.current) return;

    abortControllerRef.current.abort();
    abortControllerRef.current = null;

    setLoading(false);
    setStreamingMessageId(null);

    showToast("Generation stopped.");
  }, [showToast]);

  /*
  =======================================================
  SUGGESTIONS
  =======================================================
  */

  const useSuggestion = useCallback(
    (prompt) => {
      setMessage(prompt);

      setTimeout(() => {
        textareaRef.current?.focus();
        resizeTextarea();
      }, 50);
    },
    [resizeTextarea]
  );

  /*
  =======================================================
  CHAT ACTIONS
  =======================================================
  */

  const deleteChat = useCallback(
    (chatId) => {
      if (loading) {
        showToast("Stop generation before deleting a chat.", "error");
        return;
      }

      setChats((current) =>
        current.filter((chat) => chat.id !== chatId)
      );

      if (activeChatId === chatId) {
        setActiveChatId(null);
        setMessages([]);
      }

      showToast("Chat deleted.");
    },
    [activeChatId, loading, showToast]
  );

  const togglePinChat = useCallback(
    (chatId) => {
      setChats((current) =>
        current.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                pinned: !chat.pinned,
                updatedAt: Date.now(),
              }
            : chat
        )
      );

      showToast("Chat updated.");
    },
    [showToast]
  );

  const toggleFavoriteChat = useCallback(
    (chatId) => {
      setChats((current) =>
        current.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                favorite: !chat.favorite,
                updatedAt: Date.now(),
              }
            : chat
        )
      );

      showToast("Chat updated.");
    },
    [showToast]
  );

  const beginRename = useCallback((chat) => {
    setEditingChatId(chat.id);
    setEditingTitle(chat.title);
  }, []);

  const cancelRename = useCallback(() => {
    setEditingChatId(null);
    setEditingTitle("");
  }, []);

  const finishRename = useCallback(
    (chatId) => {
      const title = editingTitle.trim();

      if (!title) {
        cancelRename();
        return;
      }

      setChats((current) =>
        current.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                title: title.slice(0, 80),
                updatedAt: Date.now(),
              }
            : chat
        )
      );

      cancelRename();
      showToast("Chat renamed.");
    },
    [cancelRename, editingTitle, showToast]
  );

  const clearAllChats = useCallback(() => {
    if (loading) {
      showToast("Stop generation first.", "error");
      return;
    }

    setChats([]);
    setMessages([]);
    setActiveChatId(null);
    setClearConfirmOpen(false);

    showToast("All chats cleared.");
  }, [loading, showToast]);

  /*
  =======================================================
  COPY MESSAGE
  =======================================================
  */

  const copyMessage = useCallback(
    async (content) => {
      try {
        await navigator.clipboard.writeText(content);
        showToast("Copied to clipboard.");
      } catch {
        showToast("Could not copy that message.", "error");
      }
    },
    [showToast]
  );

  /*
  =======================================================
  REGENERATE
  =======================================================
  */

  const regenerateMessage = useCallback(
    async (index) => {
      if (loading) return;

      const target = messages[index];

      if (!target || target.role !== "assistant") return;

      const previousUserMessage = [...messages]
        .slice(0, index)
        .reverse()
        .find((item) => item.role === "user");

      if (!previousUserMessage) {
        showToast("No user message found.", "error");
        return;
      }

      const beforeAssistant = messages.slice(0, index);

      setMessages(beforeAssistant);

      await sendMessage(
        null,
        previousUserMessage.content,
        beforeAssistant.slice(0, -1)
      );
    },
    [loading, messages, sendMessage, showToast]
  );

  /*
  =======================================================
  RETRY
  =======================================================
  */

  const retryMessage = useCallback(
    async (index) => {
      if (loading) return;

      const target = messages[index];

      if (!target || target.role !== "assistant") return;

      const previousUserMessage = [...messages]
        .slice(0, index)
        .reverse()
        .find((item) => item.role === "user");

      if (!previousUserMessage) {
        showToast("No user message found.", "error");
        return;
      }

      const beforeAssistant = messages.slice(0, index);

      setMessages(beforeAssistant);

      await sendMessage(
        null,
        previousUserMessage.content,
        beforeAssistant.slice(0, -1)
      );
    },
    [loading, messages, sendMessage, showToast]
  );

  /*
  =======================================================
  EXPORT
  =======================================================
  */

  const exportCurrentChat = useCallback(() => {
    if (!activeChat && !messages.length) {
      showToast("There is no chat to export.", "error");
      return;
    }

    const data = {
      exportedAt: new Date().toISOString(),
      app: "Fades AI",
      chat:
        activeChat || {
          id: activeChatId || createId("chat"),
          title: "New chat",
          messages,
        },
    };

    downloadFile(
      `fades-chat-${Date.now()}.json`,
      JSON.stringify(data, null, 2)
    );

    showToast("Chat exported.");
  }, [activeChat, activeChatId, messages, showToast]);

  const exportAllChats = useCallback(() => {
    if (!chats.length) {
      showToast("There are no chats to export.", "error");
      return;
    }

    const data = {
      exportedAt: new Date().toISOString(),
      app: "Fades AI",
      chats,
    };

    downloadFile(
      `fades-chats-${Date.now()}.json`,
      JSON.stringify(data, null, 2)
    );

    showToast("All chats exported.");
  }, [chats, showToast]);

  const importChats = useCallback(
    async (event) => {
      const file = event.target.files?.[0];

      event.target.value = "";

      if (!file) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        let imported = [];

        if (Array.isArray(parsed)) {
          imported = normalizeChats(parsed);
        } else if (Array.isArray(parsed?.chats)) {
          imported = normalizeChats(parsed.chats);
        } else if (parsed?.chat) {
          imported = normalizeChats([parsed.chat]);
        }

        if (!imported.length) {
          throw new Error("No valid chats were found.");
        }

        setChats((current) => {
          const existingIds = new Set(
            current.map((chat) => chat.id)
          );

          const uniqueImported = imported.map((chat) => {
            if (!existingIds.has(chat.id)) return chat;

            return {
              ...chat,
              id: createId("chat"),
            };
          });

          return [...uniqueImported, ...current];
        });

        showToast(
          `${imported.length} chat${
            imported.length === 1 ? "" : "s"
          } imported.`
        );
      } catch (error) {
        console.error("Import failed:", error);
        showToast(
          error?.message || "Could not import chats.",
          "error"
        );
      }
    },
    [showToast]
  );

  /*
  =======================================================
  SETTINGS
  =======================================================
  */

  const updateSetting = useCallback((key, value) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }, []);

  /*
  =======================================================
  AUTH
  =======================================================
  */

  const resetAuthForm = useCallback(() => {
    setAuthEmail("");
    setAuthUsername("");
    setAuthPassword("");
    setAuthDisplayName("");
    setAuthError("");
  }, []);

  const openAuth = useCallback(
    (mode = "login") => {
      setAuthMode(mode);
      resetAuthForm();
      setAuthOpen(true);
      setProfileOpen(false);
    },
    [resetAuthForm]
  );

  const submitAuth = useCallback(
    async (event) => {
      event.preventDefault();

      setAuthSubmitting(true);
      setAuthError("");

      try {
        const endpoint =
          authMode === "signup"
            ? `${API_URL}/auth/signup`
            : `${API_URL}/auth/login`;

        const body =
          authMode === "signup"
            ? {
                email: authEmail,
                username: authUsername,
                password: authPassword,
                displayName:
                  authDisplayName || authUsername,
              }
            : {
                email: authEmail,
                password: authPassword,
              };

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(body),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.success) {
          throw new Error(
            data?.error ||
              `Request failed with status ${response.status}.`
          );
        }

        if (data.user) {
          setUser(data.user);
        } else {
          await checkSession();
        }

        setAuthOpen(false);
        resetAuthForm();

        showToast(
          authMode === "signup"
            ? "Account created."
            : "Welcome back."
        );
      } catch (error) {
        console.error("Authentication failed:", error);

        setAuthError(
          error?.message ||
            "Authentication failed. Please try again."
        );
      } finally {
        setAuthSubmitting(false);
      }
    },
    [
      authDisplayName,
      authEmail,
      authMode,
      authPassword,
      authUsername,
      checkSession,
      resetAuthForm,
      showToast,
    ]
  );

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    }

    setUser(null);
    setProfileOpen(false);

    showToast("Signed out.");
  }, [showToast]);

  /*
  =======================================================
  FILTERED CHATS
  =======================================================
  */

  const filteredChats = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = chats.filter((chat) => {
      if (!query) return true;

      if (chat.title.toLowerCase().includes(query)) {
        return true;
      }

      return (chat.messages || []).some((item) =>
        item.content?.toLowerCase().includes(query)
      );
    });

    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }

      return (
        (b.updatedAt || 0) -
        (a.updatedAt || 0)
      );
    });
  }, [chats, search]);

  /*
  =======================================================
  SEARCH RESULTS
  =======================================================
  */

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return [];

    const results = [];

    for (const chat of chats) {
      for (const item of chat.messages || []) {
        if (
          item.content?.toLowerCase().includes(query)
        ) {
          results.push({
            chat,
            message: item,
          });
        }

        if (results.length >= 30) {
          return results;
        }
      }
    }

    return results;
  }, [chats, search]);

  /*
  =======================================================
  CHAT GROUPING
  =======================================================
  */

  const groupedChats = useMemo(() => {
    const groups = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    const now = new Date();

    for (const chat of filteredChats) {
      const date = new Date(chat.updatedAt || chat.createdAt);

      const sameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);

      const isYesterday =
        date.getFullYear() === yesterday.getFullYear() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getDate() === yesterday.getDate();

      if (sameDay) {
        groups.Today.push(chat);
      } else if (isYesterday) {
        groups.Yesterday.push(chat);
      } else {
        groups.Earlier.push(chat);
      }
    }

    return groups;
  }, [filteredChats]);

  /*
  =======================================================
  RENDER
  =======================================================
  */

  return (
    <main
      className={`app-shell ${
        settings.compactMode ? "compact-mode" : ""
      }`}
    >
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside
        className={`sidebar ${
          sidebarOpen ? "sidebar-open" : ""
        }`}
      >
        <div className="sidebar-inner">
          <div className="sidebar-brand">
            <button
              className="brand-button"
              onClick={createNewChat}
              aria-label="Fades AI"
            >
              <span className="brand-mark">f</span>

              <span className="brand-name">
                Fades
              </span>
            </button>

            <button
              className="icon-button sidebar-close"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              ×
            </button>
          </div>

          <button
            className="new-chat-button"
            onClick={createNewChat}
          >
            <span>＋</span>
            <span>New chat</span>

            <kbd>⌘ K</kbd>
          </button>

          <div className="sidebar-tools">
            <button
              className="sidebar-tool"
              onClick={() => {
                setSearchOpen(true);
                setTimeout(() => {
                  searchInputRef.current?.focus();
                }, 50);
              }}
            >
              <span>⌕</span>
              <span>Search chats</span>
              <kbd>⌘ ⇧ F</kbd>
            </button>

            <button
              className="sidebar-tool"
              onClick={exportAllChats}
            >
              <span>↗</span>
              <span>Export chats</span>
            </button>

            <button
              className="sidebar-tool"
              onClick={() => fileInputRef.current?.click()}
            >
              <span>↙</span>
              <span>Import chats</span>
            </button>
          </div>

          <div className="chat-list">
            {Object.entries(groupedChats).map(
              ([groupName, groupChats]) => {
                if (!groupChats.length) return null;

                return (
                  <div
                    className="chat-group"
                    key={groupName}
                  >
                    <div className="chat-group-title">
                      {groupName}
                    </div>

                    {groupChats.map((chat) => (
                      <div
                        className={`chat-list-item ${
                          activeChatId === chat.id
                            ? "active"
                            : ""
                        }`}
                        key={chat.id}
                      >
                        {editingChatId === chat.id ? (
                          <input
                            className="chat-rename-input"
                            autoFocus
                            value={editingTitle}
                            onChange={(event) =>
                              setEditingTitle(
                                event.target.value
                              )
                            }
                            onBlur={() =>
                              finishRename(chat.id)
                            }
                            onKeyDown={(event) => {
                              if (
                                event.key === "Enter"
                              ) {
                                finishRename(chat.id);
                              }

                              if (
                                event.key === "Escape"
                              ) {
                                cancelRename();
                              }
                            }}
                          />
                        ) : (
                          <button
                            className="chat-item-main"
                            onClick={() =>
                              openChat(chat.id)
                            }
                          >
                            <span className="chat-item-icon">
                              {chat.pinned
                                ? "◆"
                                : "○"}
                            </span>

                            <span className="chat-item-title">
                              {chat.title}
                            </span>
                          </button>
                        )}

                        <div className="chat-item-actions">
                          <button
                            onClick={() =>
                              togglePinChat(chat.id)
                            }
                            title={
                              chat.pinned
                                ? "Unpin"
                                : "Pin"
                            }
                          >
                            {chat.pinned ? "◆" : "◇"}
                          </button>

                          <button
                            onClick={() =>
                              beginRename(chat)
                            }
                            title="Rename"
                          >
                            ✎
                          </button>

                          <button
                            onClick={() =>
                              deleteChat(chat.id)
                            }
                            title="Delete"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
            )}

            {!filteredChats.length && (
              <div className="empty-chat-list">
                <span>No conversations yet.</span>
              </div>
            )}
          </div>

          <div className="sidebar-bottom">
            <button
              className="sidebar-bottom-button"
              onClick={() => setAboutOpen(true)}
            >
              <span>ⓘ</span>
              <span>About Fades</span>
            </button>

            <button
              className="sidebar-bottom-button"
              onClick={() => setSettingsOpen(true)}
            >
              <span>⚙</span>
              <span>Settings</span>
            </button>

            <div className="sidebar-profile">
              {user ? (
                <button
                  className="profile-button"
                  onClick={() =>
                    setProfileOpen((value) => !value)
                  }
                >
                  <span className="avatar">
                    {(user.displayName ||
                      user.username ||
                      "U")
                      .charAt(0)
                      .toUpperCase()}
                  </span>

                  <span className="profile-info">
                    <strong>
                      {user.displayName ||
                        user.username}
                    </strong>

                    <small>
                      @{user.username || "user"}
                    </small>
                  </span>

                  <span className="profile-arrow">
                    ⋯
                  </span>
                </button>
              ) : (
                <button
                  className="sidebar-login-button"
                  onClick={() => openAuth("login")}
                >
                  <span className="avatar guest-avatar">
                    ?
                  </span>

                  <span>
                    Sign in
                  </span>
                </button>
              )}

              {profileOpen && user && (
                <div className="profile-menu">
                  <div className="profile-menu-header">
                    <strong>
                      {user.displayName ||
                        user.username}
                    </strong>

                    <small>
                      {user.email}
                    </small>
                  </div>

                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      setSettingsOpen(true);
                    }}
                  >
                    Settings
                  </button>

                  <button
                    onClick={exportAllChats}
                  >
                    Export chats
                  </button>

                  <button
                    className="danger-action"
                    onClick={logout}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* =================================================
          MAIN CONTENT
      ================================================= */}

      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              ☰
            </button>

            <div className="mobile-brand">
              <span className="brand-mark">f</span>
              <span>Fades</span>
            </div>

            <div className="model-selector">
              <button
                className="model-button"
                onClick={() =>
                  setModelOpen((value) => !value)
                }
              >
                <span className="status-dot" />

                <span>
                  Qwen 3 4B
                </span>

                <span className="model-chevron">
                  {modelOpen ? "⌃" : "⌄"}
                </span>
              </button>

              {modelOpen && (
                <div className="model-menu">
                  <div className="model-menu-title">
                    Active model
                  </div>

                  <button
                    className="model-option active"
                    onClick={() =>
                      setModelOpen(false)
                    }
                  >
                    <span className="status-dot" />

                    <span className="model-option-copy">
                      <strong>Qwen 3 4B</strong>
                      <small>
                        Fades AI • Local inference
                      </small>
                    </span>

                    <span>✓</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="topbar-right">
            <button
              className="icon-button topbar-new-chat"
              onClick={createNewChat}
              title="New chat"
            >
              ＋
            </button>

            {user ? (
              <button
                className="topbar-avatar"
                onClick={() =>
                  setProfileOpen((value) => !value)
                }
                aria-label="Open profile"
              >
                {(user.displayName ||
                  user.username ||
                  "U")
                  .charAt(0)
                  .toUpperCase()}
              </button>
            ) : (
              <button
                className="signin-button"
                onClick={() => openAuth("login")}
              >
                Sign in
              </button>
            )}
          </div>
        </header>

        {/* =================================================
            CHAT AREA
        ================================================= */}

        <div
          className="messages-area"
          ref={messagesContainerRef}
          onScroll={handleMessagesScroll}
        >
          {!messages.length ? (
            <div className="empty-state">
              <div className="hero-mark">
                <span>f</span>
              </div>

              <h1>
                How can I help?
              </h1>

              <p>
                Ask Fades anything. Your AI assistant,
                powered by local inference.
              </p>

              <div className="suggestion-grid">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    className="suggestion-card"
                    key={suggestion.title}
                    onClick={() =>
                      useSuggestion(
                        suggestion.prompt
                      )
                    }
                  >
                    <span className="suggestion-icon">
                      {suggestion.icon}
                    </span>

                    <span className="suggestion-copy">
                      <strong>
                        {suggestion.title}
                      </strong>

                      <small>
                        {suggestion.prompt}
                      </small>
                    </span>

                    <span className="suggestion-arrow">
                      →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div
              className={`conversation ${
                settings.compactMode
                  ? "conversation-compact"
                  : ""
              }`}
            >
              {messages.map((item, index) => {
                const isStreaming =
                  item.id === streamingMessageId;

                const isLast =
                  index === messages.length - 1;

                return (
                  <article
                    className={`message-row ${item.role}`}
                    key={item.id}
                  >
                    <div className="message-avatar">
                      {item.role === "user" ? (
                        user ? (
                          (
                            user.displayName ||
                            user.username ||
                            "U"
                          )
                            .charAt(0)
                            .toUpperCase()
                        ) : (
                          "U"
                        )
                      ) : (
                        <span>f</span>
                      )}
                    </div>

                    <div className="message-content">
                      <div className="message-header">
                        <strong>
                          {item.role === "user"
                            ? user?.displayName ||
                              user?.username ||
                              "You"
                            : "Fades"}
                        </strong>

                        {settings.showTimestamps && (
                          <time>
                            {formatTime(
                              item.createdAt
                            )}
                          </time>
                        )}
                      </div>

                      <div className="message-body">
                        {item.role === "assistant" ? (
                          <>
                            <ReactMarkdown
                              components={{
                                code: MarkdownCode,
                              }}
                            >
                              {item.content}
                            </ReactMarkdown>

                            {isStreaming && (
                              <span className="typing-cursor">
                                ▋
                              </span>
                            )}
                          </>
                        ) : (
                          <p>{item.content}</p>
                        )}
                      </div>

                      {item.role === "assistant" &&
                        !isStreaming &&
                        item.content && (
                          <div className="message-actions">
                            <button
                              onClick={() =>
                                copyMessage(
                                  item.content
                                )
                              }
                            >
                              Copy
                            </button>

                            <button
                              onClick={() =>
                                regenerateMessage(
                                  index
                                )
                              }
                            >
                              Regenerate
                            </button>

                            {isLast && (
                              <button
                                onClick={() =>
                                  retryMessage(index)
                                }
                              >
                                Retry
                              </button>
                            )}
                          </div>
                        )}
                    </div>
                  </article>
                );
              })}

              <div ref={messagesEndRef} />
            </div>
          )}

          {showScrollButton && (
            <button
              className="scroll-bottom-button"
              onClick={scrollToBottom}
              aria-label="Scroll to bottom"
            >
              ↓
            </button>
          )}
        </div>

        {/* =================================================
            COMPOSER
        ================================================= */}

        <div className="composer-wrapper">
          <form
            className="composer"
            onSubmit={(event) =>
              sendMessage(event)
            }
          >
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(event) =>
                setMessage(event.target.value)
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  settings.enterToSend
                ) {
                  event.preventDefault();
                  sendMessage(event);
                }
              }}
              placeholder="Message Fades..."
              rows={1}
              disabled={loading}
            />

            <div className="composer-bottom">
              <div className="composer-hints">
                <span>
                  {settings.enterToSend
                    ? "Enter to send"
                    : "Shift + Enter for new line"}
                </span>
              </div>

              <div className="composer-actions">
                {loading ? (
                  <button
                    type="button"
                    className="stop-button"
                    onClick={stopGeneration}
                  >
                    <span className="stop-icon" />
                    Stop
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="send-button"
                    disabled={!message.trim()}
                    aria-label="Send message"
                  >
                    ↑
                  </button>
                )}
              </div>
            </div>
          </form>

          <div className="composer-disclaimer">
            Fades can make mistakes. Check important
            information.
          </div>
        </div>
      </section>

      {/* =================================================
          SEARCH MODAL
      ================================================= */}

      {searchOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSearchOpen(false);
            }
          }}
        >
          <div className="modal search-modal">
            <div className="modal-header">
              <div>
                <h2>Search chats</h2>
                <p>
                  Find a conversation or message.
                </p>
              </div>

              <button
                className="modal-close"
                onClick={() => setSearchOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="search-input-wrapper">
              <span>⌕</span>

              <input
                ref={searchInputRef}
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search your chats..."
                autoFocus
              />

              <kbd>ESC</kbd>
            </div>

            <div className="search-results">
              {!search.trim() ? (
                <div className="search-empty">
                  Start typing to search your chats.
                </div>
              ) : !searchResults.length ? (
                <div className="search-empty">
                  No matching messages found.
                </div>
              ) : (
                searchResults.map((result, index) => (
                  <button
                    className="search-result"
                    key={`${result.message.id}-${index}`}
                    onClick={() => {
                      openChat(result.chat.id);
                      setSearchOpen(false);
                    }}
                  >
                    <span className="search-result-icon">
                      {result.message.role === "user"
                        ? "U"
                        : "f"}
                    </span>

                    <span className="search-result-copy">
                      <strong>
                        {result.chat.title}
                      </strong>

                      <small>
                        {result.message.content.slice(
                          0,
                          180
                        )}
                        {result.message.content.length >
                        180
                          ? "…"
                          : ""}
                      </small>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          AUTH MODAL
      ================================================= */}

      {authOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setAuthOpen(false);
            }
          }}
        >
          <div className="modal auth-modal">
            <div className="auth-brand">
              <div className="auth-brand-mark">
                f
              </div>

              <h2>
                {authMode === "login"
                  ? "Welcome back"
                  : "Create your account"}
              </h2>

              <p>
                {authMode === "login"
                  ? "Sign in to your Fades account."
                  : "Create an account to get started with Fades."}
              </p>
            </div>

            {authError && (
              <div className="auth-error">
                {authError}
              </div>
            )}

            <form
              className="auth-form"
              onSubmit={submitAuth}
            >
              {authMode === "signup" && (
                <>
                  <label>
                    Display name
                    <input
                      value={authDisplayName}
                      onChange={(event) =>
                        setAuthDisplayName(
                          event.target.value
                        )
                      }
                      placeholder="Your name"
                      autoComplete="name"
                    />
                  </label>

                  <label>
                    Username
                    <input
                      value={authUsername}
                      onChange={(event) =>
                        setAuthUsername(
                          event.target.value
                        )
                      }
                      placeholder="username"
                      autoComplete="username"
                      required
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
                    setAuthEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) =>
                    setAuthPassword(
                      event.target.value
                    )
                  }
                  placeholder="••••••••"
                  autoComplete={
                    authMode === "login"
                      ? "current-password"
                      : "new-password"
                  }
                  required
                />
              </label>

              <button
                className="auth-submit"
                type="submit"
                disabled={authSubmitting}
              >
                {authSubmitting
                  ? "Please wait..."
                  : authMode === "login"
                  ? "Sign in"
                  : "Create account"}
              </button>
            </form>

            <div className="auth-switch">
              {authMode === "login" ? (
                <>
                  <span>
                    Don't have an account?
                  </span>

                  <button
                    onClick={() => {
                      setAuthMode("signup");
                      setAuthError("");
                    }}
                  >
                    Create one
                  </button>
                </>
              ) : (
                <>
                  <span>
                    Already have an account?
                  </span>

                  <button
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError("");
                    }}
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>

            <button
              className="modal-close auth-close"
              onClick={() => setAuthOpen(false)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* =================================================
          SETTINGS MODAL
      ================================================= */}

      {settingsOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSettingsOpen(false);
            }
          }}
        >
          <div className="modal settings-modal">
            <div className="modal-header">
              <div>
                <h2>Settings</h2>
                <p>
                  Customize your Fades experience.
                </p>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setSettingsOpen(false)
                }
              >
                ×
              </button>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">
                Appearance
              </div>

              <div className="setting-row">
                <div>
                  <strong>Theme</strong>
                  <small>
                    Choose how Fades looks.
                  </small>
                </div>

                <select
                  value={settings.theme}
                  onChange={(event) =>
                    updateSetting(
                      "theme",
                      event.target.value
                    )
                  }
                >
                  <option value="dark">
                    Dark
                  </option>
                  <option value="light">
                    Light
                  </option>
                  <option value="system">
                    System
                  </option>
                </select>
              </div>

              <div className="setting-row">
                <div>
                  <strong>Compact mode</strong>
                  <small>
                    Reduce spacing between messages.
                  </small>
                </div>

                <button
                  className={`toggle ${
                    settings.compactMode
                      ? "on"
                      : ""
                  }`}
                  onClick={() =>
                    updateSetting(
                      "compactMode",
                      !settings.compactMode
                    )
                  }
                  aria-label="Toggle compact mode"
                >
                  <span />
                </button>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">
                Chat
              </div>

              <div className="setting-row">
                <div>
                  <strong>
                    Enter to send
                  </strong>
                  <small>
                    Press Enter to send a message.
                  </small>
                </div>

                <button
                  className={`toggle ${
                    settings.enterToSend
                      ? "on"
                      : ""
                  }`}
                  onClick={() =>
                    updateSetting(
                      "enterToSend",
                      !settings.enterToSend
                    )
                  }
                >
                  <span />
                </button>
              </div>

              <div className="setting-row">
                <div>
                  <strong>
                    Show timestamps
                  </strong>
                  <small>
                    Display message times.
                  </small>
                </div>

                <button
                  className={`toggle ${
                    settings.showTimestamps
                      ? "on"
                      : ""
                  }`}
                  onClick={() =>
                    updateSetting(
                      "showTimestamps",
                      !settings.showTimestamps
                    )
                  }
                >
                  <span />
                </button>
              </div>

              <div className="setting-row">
                <div>
                  <strong>
                    Sound effects
                  </strong>
                  <small>
                    Play interface sounds.
                  </small>
                </div>

                <button
                  className={`toggle ${
                    settings.soundEffects
                      ? "on"
                      : ""
                  }`}
                  onClick={() =>
                    updateSetting(
                      "soundEffects",
                      !settings.soundEffects
                    )
                  }
                >
                  <span />
                </button>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">
                Data
              </div>

              <div className="settings-actions">
                <button
                  onClick={exportCurrentChat}
                >
                  Export current chat
                </button>

                <button
                  onClick={exportAllChats}
                >
                  Export all chats
                </button>

                <button
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                >
                  Import chats
                </button>

                <button
                  className="danger-action"
                  onClick={() => {
                    setSettingsOpen(false);
                    setClearConfirmOpen(true);
                  }}
                >
                  Clear all chats
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          ABOUT MODAL
      ================================================= */}

      {aboutOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setAboutOpen(false);
            }
          }}
        >
          <div className="modal about-modal">
            <div className="about-logo">
              f
            </div>

            <h2>Fades AI</h2>

            <p className="about-version">
              Personal AI assistant
            </p>

            <div className="about-description">
              <p>
                Fades is an AI assistant designed to
                provide fast, private and useful
                conversations.
              </p>

              <p>
                This deployment uses Qwen 3 4B through
                Fades&apos; own inference infrastructure.
              </p>
            </div>

            <div className="about-details">
              <div>
                <span>Model</span>
                <strong>
                  Qwen 3 4B
                </strong>
              </div>

              <div>
                <span>Platform</span>
                <strong>
                  Fades AI
                </strong>
              </div>
            </div>

            <button
              className="auth-submit"
              onClick={() => setAboutOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* =================================================
          CLEAR CONFIRMATION
      ================================================= */}

      {clearConfirmOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setClearConfirmOpen(false);
            }
          }}
        >
          <div className="modal confirmation-modal">
            <div className="confirmation-icon">
              !
            </div>

            <h2>Clear all chats?</h2>

            <p>
              This will permanently remove all locally
              stored conversations from this browser.
            </p>

            <div className="confirmation-actions">
              <button
                onClick={() =>
                  setClearConfirmOpen(false)
                }
              >
                Cancel
              </button>

              <button
                className="danger-button"
                onClick={clearAllChats}
              >
                Clear chats
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          HIDDEN IMPORT INPUT
      ================================================= */}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={importChats}
      />

      {/* =================================================
          TOAST
      ================================================= */}

      {toast && (
        <div
          className={`toast toast-${toast.type}`}
        >
          <span className="toast-indicator">
            {toast.type === "error" ? "!" : "✓"}
          </span>

          <span>{toast.text}</span>
        </div>
      )}
    </main>
  );
}

/*
=======================================================
SMALL STREAMING SAFETY HELPER
=======================================================
*/

function assistantTextSafe(currentMessages, assistantId) {
  return currentMessages.some(
    (item) =>
      item.id === assistantId &&
      item.role === "assistant" &&
      item.content
  );
}
