"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import "./globals.css";

const STORAGE_KEY = "fades.chats.v2";
const SETTINGS_KEY = "fades.settings.v1";
const API_URL = "https://api.fades.lol";
const MAX_TEXTAREA_HEIGHT = 180;

const DEFAULT_SETTINGS = {
  theme: "dark",
  compactMode: false,
  enterToSend: true,
  showTimestamps: false,
  soundEffects: false,
};

const SUGGESTIONS = [
  {
    icon: "✦",
    title: "Explain something",
    description: "Break down a complicated topic",
    prompt: "Explain something complicated to me in a simple way.",
  },
  {
    icon: "⌘",
    title: "Build something",
    description: "Create code, websites, and more",
    prompt: "Help me build something from scratch.",
  },
  {
    icon: "✧",
    title: "Get creative",
    description: "Brainstorm ideas and possibilities",
    prompt: "Give me some creative ideas for a project.",
  },
  {
    icon: "◎",
    title: "Learn something",
    description: "Understand something new",
    prompt: "Teach me something interesting that I probably don't know.",
  },
];

/* ---------------------------------------------------------------- */
/* Helpers                                                           */
/* ---------------------------------------------------------------- */

function createId(prefix = "id") {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function formatDate(timestamp) {
  if (!timestamp) return "";

  try {
    return new Intl.DateTimeFormat("en", {
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
    return new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function normalizeMessage(raw) {
  if (!raw || typeof raw !== "object") return null;

  const role = raw.role === "user" ? "user" : "assistant";
  const content = typeof raw.content === "string" ? raw.content : "";

  if (!content) return null;

  return {
    id: createId("message"),
    role,
    content,
    createdAt:
      typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
  };
}

/* ---------------------------------------------------------------- */
/* Code block (module scope so it isn't remounted every render)      */
/* ---------------------------------------------------------------- */

function CodeBlock({ className, children, onCopy, ...props }) {
  const code = String(children ?? "").replace(/\n$/, "");
  const match = /language-([\w-]+)/.exec(className || "");
  const isBlock = Boolean(match) || code.includes("\n");

  if (!isBlock) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  return (
    <div className="code-block">
      <div className="code-toolbar">
        <span>{match ? match[1] : "code"}</span>

        <button type="button" onClick={() => onCopy(code)}>
          Copy
        </button>
      </div>

      <pre>
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Page                                                              */
/* ---------------------------------------------------------------- */

export default function Home() {
  /* Core chat state */
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  /* Hydration */
  const [hydrated, setHydrated] = useState(false);

  /* UI state */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [toast, setToast] = useState(null);

  /* Auth state */
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

  /* Chat editing */
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  /* Settings */
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  /* Refs */
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const searchInputRef = useRef(null);
  const toastTimerRef = useRef(null);
  const stickToBottomRef = useRef(true);

  /* -------------------------------------------------------------- */
  /* Toast                                                           */
  /* -------------------------------------------------------------- */

  const showToast = useCallback((text, type = "normal") => {
    setToast({ id: createId("toast"), text, type });

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = setTimeout(() => setToast(null), 2800);
  }, []);

  /* -------------------------------------------------------------- */
  /* Session                                                         */
  /* -------------------------------------------------------------- */

  const checkSession = useCallback(async () => {
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

      setUser(data?.success && data?.user ? data.user : null);
    } catch (error) {
      console.error("Session check failed:", error);
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  /* -------------------------------------------------------------- */
  /* Load local data                                                 */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    try {
      const savedChats = localStorage.getItem(STORAGE_KEY);

      if (savedChats) {
        const parsed = JSON.parse(savedChats);

        if (Array.isArray(parsed)) {
          setChats(parsed);
        }
      }

      const savedSettings = localStorage.getItem(SETTINGS_KEY);

      if (savedSettings) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...JSON.parse(savedSettings),
        });
      }
    } catch (error) {
      console.error("Failed to load Fades data:", error);
    } finally {
      setHydrated(true);
    }

    checkSession();
  }, [checkSession]);

  /* Persist chats — only after hydration, so we never clobber storage */
  useEffect(() => {
    if (!hydrated) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch (error) {
      console.error("Failed to save chats:", error);
    }
  }, [chats, hydrated]);

  /* Persist settings */
  useEffect(() => {
    if (!hydrated) return;

    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }, [settings, hydrated]);

  /* Apply theme (resolving "system" against the OS preference) */
  useEffect(() => {
    const root = document.documentElement;

    root.dataset.compact = settings.compactMode ? "true" : "false";

    if (settings.theme !== "system") {
      root.dataset.theme = settings.theme;
      return;
    }

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      root.dataset.theme = query.matches ? "dark" : "light";
    };

    apply();
    query.addEventListener("change", apply);

    return () => query.removeEventListener("change", apply);
  }, [settings.theme, settings.compactMode]);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  /* -------------------------------------------------------------- */
  /* Chats                                                           */
  /* -------------------------------------------------------------- */

  const focusComposer = useCallback(() => {
    window.setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(
      textarea.scrollHeight,
      MAX_TEXTAREA_HEIGHT
    )}px`;
  }, []);

  const createChat = useCallback(() => {
    if (loading) return;

    const chat = {
      id: createId("chat"),
      title: "New chat",
      messages: [],
      pinned: false,
      favorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setChats((current) => [chat, ...current]);
    setActiveChatId(chat.id);
    setMessages([]);
    setMessage("");
    setSidebarOpen(false);
    setSearchOpen(false);
    stickToBottomRef.current = true;

    focusComposer();
  }, [loading, focusComposer]);

  const openChat = useCallback(
    (chat) => {
      if (loading) return;

      setActiveChatId(chat.id);
      setMessages(chat.messages || []);
      setMessage("");
      setSidebarOpen(false);
      setSearchOpen(false);
      setProfileOpen(false);
      stickToBottomRef.current = true;

      focusComposer();
    },
    [loading, focusComposer]
  );

  function generateTitle(text) {
    const clean = text.trim().replace(/\s+/g, " ");

    if (!clean) return "New chat";
    if (clean.length <= 48) return clean;

    return `${clean.slice(0, 48)}...`;
  }

  /* Returns the id of the chat the message belongs to, creating one
     if there is no valid active chat. */
  const ensureChat = useCallback(
    (text) => {
      const existing = chats.some((chat) => chat.id === activeChatId);

      if (activeChatId && existing) {
        return activeChatId;
      }

      const newChat = {
        id: createId("chat"),
        title: generateTitle(text),
        messages: [],
        pinned: false,
        favorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setChats((current) => [newChat, ...current]);
      setActiveChatId(newChat.id);

      return newChat.id;
    },
    [activeChatId, chats]
  );

  const commitMessages = useCallback((chatId, nextMessages, title) => {
    setMessages(nextMessages);

    setChats((current) =>
      current.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              title:
                title && chat.title === "New chat" ? title : chat.title,
              messages: nextMessages,
              updatedAt: Date.now(),
            }
          : chat
      )
    );
  }, []);

  /* -------------------------------------------------------------- */
  /* Send                                                            */
  /* -------------------------------------------------------------- */

  const sendMessage = useCallback(
    async (event, overrideMessage = null, baseMessages = null) => {
      event?.preventDefault?.();

      const text = (
        overrideMessage !== null ? overrideMessage : message
      ).trim();

      if (!text || loading) return;

      setMessage("");

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      const baseline = baseMessages ?? messages;
      const currentChatId = ensureChat(text);

      const userMessage = {
        id: createId("message"),
        role: "user",
        content: text,
        createdAt: Date.now(),
      };

      const history = baseline.map((item) => ({
        role: item.role,
        content: item.content,
      }));

      const updatedMessages = [...baseline, userMessage];
      const assistantId = createId("message");

      stickToBottomRef.current = true;

      setMessages([
        ...updatedMessages,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          streaming: true,
          createdAt: Date.now(),
        },
      ]);

      setLoading(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ message: text, history }),
        });

        if (!response.ok) {
          let errorMessage = "Fades could not process the request.";

          try {
            const errorText = await response.text();

            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData?.error || errorMessage;
            } catch {
              if (errorText) errorMessage = errorText;
            }
          } catch {
            /* ignore */
          }

          throw new Error(errorMessage);
        }

        if (!response.body) {
          throw new Error("Fades returned an empty response.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = "";
        let fullResponse = "";
        let streamError = null;

        while (true) {
          const { value, done } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const sseEvent of events) {
            for (const line of sseEvent.split("\n")) {
              if (!line.startsWith("data:")) continue;

              const rawData = line.slice(5).trim();

              if (!rawData || rawData === "[DONE]") continue;

              let data;

              try {
                data = JSON.parse(rawData);
              } catch (parseError) {
                console.warn("Stream parsing warning:", parseError);
                continue;
              }

              /* Server-reported errors must escape the parse guard. */
              if (data.error) {
                streamError = new Error(data.error);
                break;
              }

              const chunk =
                data.content ??
                data.text ??
                data.delta ??
                data.message?.content ??
                "";

              if (!chunk) continue;

              fullResponse += chunk;

              setMessages((current) =>
                current.map((item) =>
                  item.id === assistantId
                    ? { ...item, content: fullResponse }
                    : item
                )
              );
            }

            if (streamError) break;
          }

          if (streamError) {
            await reader.cancel().catch(() => {});
            throw streamError;
          }
        }

        commitMessages(
          currentChatId,
          [
            ...updatedMessages,
            {
              id: assistantId,
              role: "assistant",
              content:
                fullResponse || "I wasn't able to generate a response.",
              createdAt: Date.now(),
            },
          ],
          generateTitle(text)
        );
      } catch (error) {
        if (error?.name === "AbortError") {
          commitMessages(currentChatId, [
            ...updatedMessages,
            {
              id: assistantId,
              role: "assistant",
              content: "Generation stopped.",
              stopped: true,
              createdAt: Date.now(),
            },
          ]);

          showToast("Generation stopped.");
        } else {
          console.error("Fades AI error:", error);

          commitMessages(currentChatId, [
            ...updatedMessages,
            {
              id: assistantId,
              role: "assistant",
              content:
                error?.message ||
                "Something went wrong while connecting to Fades AI.",
              error: true,
              createdAt: Date.now(),
            },
          ]);

          showToast("Fades couldn't complete that request.", "error");
        }
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
        focusComposer();
      }
    },
    [
      message,
      messages,
      loading,
      ensureChat,
      commitMessages,
      showToast,
      focusComposer,
    ]
  );

  function stopGeneration() {
    abortControllerRef.current?.abort();
  }

  /* Regenerate / retry: rewind to the prompt and resend it with the
     correct history instead of whatever state the closure captured. */
  const resendFrom = useCallback(
    async (index) => {
      if (loading) return;

      let userIndex = -1;

      for (let i = index - 1; i >= 0; i -= 1) {
        if (messages[i].role === "user") {
          userIndex = i;
          break;
        }
      }

      if (userIndex === -1) return;

      const base = messages.slice(0, userIndex);
      const prompt = messages[userIndex].content;

      setMessages(base);

      await sendMessage(null, prompt, base);
    },
    [loading, messages, sendMessage]
  );

  function applySuggestion(prompt) {
    setMessage(prompt);

    window.setTimeout(() => {
      textareaRef.current?.focus();
      resizeTextarea();
    }, 50);
  }

  /* -------------------------------------------------------------- */
  /* Chat management                                                 */
  /* -------------------------------------------------------------- */

  function deleteChat(chatId) {
    if (loading) return;

    setChats((current) => current.filter((chat) => chat.id !== chatId));

    if (activeChatId === chatId) {
      setActiveChatId(null);
      setMessages([]);
      setMessage("");
    }

    showToast("Chat deleted.");
  }

  function startRename(chat) {
    setEditingChatId(chat.id);
    setEditingTitle(chat.title);
  }

  function saveRename(chatId) {
    const title = editingTitle.trim();

    if (!title) {
      setEditingChatId(null);
      setEditingTitle("");
      return;
    }

    setChats((current) =>
      current.map((chat) =>
        chat.id === chatId
          ? { ...chat, title, updatedAt: Date.now() }
          : chat
      )
    );

    setEditingChatId(null);
    setEditingTitle("");

    showToast("Chat renamed.");
  }

  function togglePin(chatId) {
    setChats((current) =>
      current.map((chat) =>
        chat.id === chatId
          ? { ...chat, pinned: !chat.pinned, updatedAt: Date.now() }
          : chat
      )
    );

    showToast("Chat pin updated.");
  }

  function toggleFavorite(chatId) {
    setChats((current) =>
      current.map((chat) =>
        chat.id === chatId
          ? { ...chat, favorite: !chat.favorite, updatedAt: Date.now() }
          : chat
      )
    );

    showToast("Favorites updated.");
  }

  function clearAllChats() {
    if (loading) return;

    setChats([]);
    setMessages([]);
    setActiveChatId(null);
    setMessage("");
    setClearConfirmOpen(false);

    showToast("All chats cleared.");
  }

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

  /* -------------------------------------------------------------- */
  /* Import / export                                                 */
  /* -------------------------------------------------------------- */

  function exportCurrentChat() {
    if (!messages.length) {
      showToast("There is no conversation to export.", "error");
      return;
    }

    const chat = chats.find((item) => item.id === activeChatId);
    const title = chat?.title || "Fades conversation";

    const lines = [
      "Fades AI",
      title,
      `Exported ${formatDate(Date.now())}`,
      "",
      "--------------------------------",
      "",
    ];

    messages.forEach((item) => {
      lines.push(`${item.role === "user" ? "You" : "Fades"}:`);
      lines.push(item.content);
      lines.push("");
    });

    downloadFile(
      "fades-conversation.txt",
      lines.join("\n"),
      "text/plain;charset=utf-8"
    );

    showToast("Conversation exported.");
  }

  function exportAllChats() {
    downloadFile(
      "fades-chats.json",
      JSON.stringify(
        {
          app: "Fades AI",
          version: 2,
          exportedAt: new Date().toISOString(),
          chats,
        },
        null,
        2
      ),
      "application/json"
    );

    showToast("All chats exported.");
  }

  function importChats() {
    fileInputRef.current?.click();
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      const importedChats = Array.isArray(parsed) ? parsed : parsed?.chats;

      if (!Array.isArray(importedChats)) {
        throw new Error("This file does not contain valid Fades chats.");
      }

      const sanitized = importedChats
        .filter((chat) => chat && typeof chat === "object")
        .map((chat) => ({
          id: createId("chat"),
          title:
            typeof chat.title === "string" && chat.title.trim()
              ? chat.title
              : "Imported chat",
          messages: Array.isArray(chat.messages)
            ? chat.messages.map(normalizeMessage).filter(Boolean)
            : [],
          pinned: Boolean(chat.pinned),
          favorite: Boolean(chat.favorite),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }));

      setChats((current) => [...sanitized, ...current]);

      showToast(
        `${sanitized.length} chat${
          sanitized.length === 1 ? "" : "s"
        } imported.`
      );
    } catch (error) {
      console.error("Import failed:", error);
      showToast("That file could not be imported.", "error");
    }
  }

  function updateSetting(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  /* -------------------------------------------------------------- */
  /* Auth                                                            */
  /* -------------------------------------------------------------- */

  function openAuth(mode = "login") {
    setAuthMode(mode);
    setAuthError("");
    setAuthEmail("");
    setAuthUsername("");
    setAuthPassword("");
    setAuthDisplayName("");
    setAuthOpen(true);
    setProfileOpen(false);
  }

  async function submitAuth(event) {
    event.preventDefault();

    if (authSubmitting) return;

    setAuthError("");
    setAuthSubmitting(true);

    try {
      const endpoint =
        authMode === "login" ? "/auth/login" : "/auth/signup";

      const body =
        authMode === "login"
          ? { email: authEmail.trim(), password: authPassword }
          : {
              email: authEmail.trim(),
              username: authUsername.trim(),
              password: authPassword,
              displayName:
                authDisplayName.trim() || authUsername.trim(),
            };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Authentication failed.");
      }

      setUser(data.user);
      setAuthOpen(false);
      setAuthEmail("");
      setAuthUsername("");
      setAuthPassword("");
      setAuthDisplayName("");

      showToast(
        authMode === "login"
          ? "Welcome back."
          : "Your Fades account is ready."
      );
    } catch (error) {
      console.error("Authentication error:", error);

      setAuthError(
        error?.message ||
          "Unable to connect to the Fades account service."
      );
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function logout() {
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

    showToast("You've been signed out.");
  }

  /* -------------------------------------------------------------- */
  /* Keyboard shortcuts                                              */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    function handleKeyboard(event) {
      if (typeof event.key !== "string") return;

      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (modifier && event.shiftKey && key === "f") {
        event.preventDefault();
        setSearchOpen(true);
        window.setTimeout(() => searchInputRef.current?.focus(), 50);
        return;
      }

      if (modifier && !event.shiftKey && key === "k") {
        event.preventDefault();
        createChat();
        return;
      }

      if (event.key === "Escape") {
        setSidebarOpen(false);
        setSearchOpen(false);
        setProfileOpen(false);
        setSettingsOpen(false);
        setAboutOpen(false);
        setModelOpen(false);
        setClearConfirmOpen(false);

        if (!authSubmitting) {
          setAuthOpen(false);
        }
      }
    }

    window.addEventListener("keydown", handleKeyboard);

    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [authSubmitting, createChat]);

  /* -------------------------------------------------------------- */
  /* Scrolling                                                       */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    if (!stickToBottomRef.current) return;

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function handleMessagesScroll() {
    const element = messagesContainerRef.current;

    if (!element) return;

    const distance =
      element.scrollHeight - element.scrollTop - element.clientHeight;

    stickToBottomRef.current = distance < 80;
    setShowScrollButton(distance > 500);
  }

  function scrollToBottom() {
    stickToBottomRef.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollButton(false);
  }

  /* -------------------------------------------------------------- */
  /* Derived                                                         */
  /* -------------------------------------------------------------- */

  const filteredChats = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...chats]
      .filter((chat) => {
        if (!query) return true;

        return (
          chat.title?.toLowerCase().includes(query) ||
          chat.messages?.some((item) =>
            item.content?.toLowerCase().includes(query)
          )
        );
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
  }, [chats, search]);

  const hasMessages = messages.length > 0;
  const currentChat = chats.find((chat) => chat.id === activeChatId);
  const messageCount = messages.length;

  const totalMessages = useMemo(
    () =>
      chats.reduce(
        (total, chat) => total + (chat.messages?.length || 0),
        0
      ),
    [chats]
  );

  const avatarLetter =
    user?.displayName?.charAt(0)?.toUpperCase() ||
    user?.username?.charAt(0)?.toUpperCase() ||
    "F";

  const markdownComponents = useMemo(
    () => ({
      h1: ({ children }) => <h2>{children}</h2>,
      h2: ({ children }) => <h3>{children}</h3>,
      h3: ({ children }) => <h4>{children}</h4>,
      a: ({ children, href }) => (
        <a href={href} target="_blank" rel="noreferrer">
          {children}
        </a>
      ),
      code: (props) => <CodeBlock {...props} onCopy={copyText} />,
    }),
    [copyText]
  );

  /* -------------------------------------------------------------- */
  /* Render                                                          */
  /* -------------------------------------------------------------- */

  return (
    <main className="app">
      <div className="ambient" />
      <div className="noise" />

      {sidebarOpen && (
        <button
          className="sidebar-overlay"
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
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
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            ×
          </button>
        </div>

        <button
          className="sidebar-new-chat"
          type="button"
          onClick={createChat}
          disabled={loading}
        >
          <span>+</span>
          <strong>New chat</strong>
          <kbd>⌘ K</kbd>
        </button>

        <button
          className="sidebar-search-button"
          type="button"
          onClick={() => {
            setSearchOpen(true);
            window.setTimeout(() => searchInputRef.current?.focus(), 50);
          }}
        >
          <span>⌕</span>
          <span>Search chats</span>
          <kbd>⌘ ⇧ F</kbd>
        </button>

        <div className="sidebar-section">
          <div className="sidebar-section-title">
            <span>Your chats</span>
            {chats.length > 0 && <span>{chats.length}</span>}
          </div>

          <div className="chat-list">
            {filteredChats.length === 0 ? (
              <div className="empty-chats">
                <span className="empty-icon">◌</span>
                <p>{search ? "No matches" : "No chats yet"}</p>
                <small>
                  {search
                    ? "Try another search."
                    : "Start a conversation and it will appear here."}
                </small>
              </div>
            ) : (
              filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  className={`chat-item ${
                    activeChatId === chat.id ? "active" : ""
                  }`}
                >
                  {editingChatId === chat.id ? (
                    <input
                      className="chat-rename"
                      value={editingTitle}
                      autoFocus
                      onChange={(event) =>
                        setEditingTitle(event.target.value)
                      }
                      onBlur={() => saveRename(chat.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          saveRename(chat.id);
                        }

                        if (event.key === "Escape") {
                          setEditingChatId(null);
                          setEditingTitle("");
                        }
                      }}
                    />
                  ) : (
                    <button
                      className="chat-item-main"
                      type="button"
                      onClick={() => openChat(chat)}
                    >
                      <span className="chat-icon">
                        {chat.favorite ? "★" : "◌"}
                      </span>

                      <span className="chat-title">{chat.title}</span>

                      {chat.pinned && <span className="chat-pin">◆</span>}
                    </button>
                  )}

                  {editingChatId !== chat.id && (
                    <div className="chat-actions">
                      <button
                        type="button"
                        title="Pin"
                        aria-label="Pin chat"
                        onClick={() => togglePin(chat.id)}
                      >
                        {chat.pinned ? "◆" : "◇"}
                      </button>

                      <button
                        type="button"
                        title="Favorite"
                        aria-label="Favorite chat"
                        onClick={() => toggleFavorite(chat.id)}
                      >
                        {chat.favorite ? "★" : "☆"}
                      </button>

                      <button
                        type="button"
                        title="Rename"
                        aria-label="Rename chat"
                        onClick={() => startRename(chat)}
                      >
                        ···
                      </button>

                      <button
                        type="button"
                        title="Delete"
                        aria-label="Delete chat"
                        onClick={() => deleteChat(chat.id)}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="sidebar-bottom">
          <button
            className="sidebar-user"
            type="button"
            onClick={() => {
              if (user) {
                setProfileOpen((current) => !current);
              } else {
                openAuth("login");
              }
            }}
          >
            <div className="user-avatar">{user ? avatarLetter : "?"}</div>

            <div className="user-info">
              <strong>
                {user ? user.displayName || user.username : "Guest"}
              </strong>

              <span>{user ? user.email : "Sign in to Fades"}</span>
            </div>

            <span className="user-arrow">⌄</span>
          </button>

          {profileOpen && user && (
            <div className="profile-menu">
              <div className="profile-header">
                <div className="profile-avatar">{avatarLetter}</div>

                <div>
                  <strong>{user.displayName || user.username}</strong>
                  <span>@{user.username}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(true);
                  setProfileOpen(false);
                }}
              >
                <span>⚙</span>
                Settings
              </button>

              <button
                type="button"
                onClick={() => {
                  setAboutOpen(true);
                  setProfileOpen(false);
                }}
              >
                <span>ⓘ</span>
                About Fades
              </button>

              <button type="button" className="danger" onClick={logout}>
                <span>↪</span>
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="main-shell">
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
              <span>f</span>
            </div>

            <div className="brand-name">
              <span>Fades</span>
              <small>AI</small>
            </div>
          </div>

          {hasMessages && (
            <div className="current-chat-name">
              <span>{currentChat?.title || "New chat"}</span>
            </div>
          )}

          <div className="topbar-spacer" />

          <button
            className="model-button"
            type="button"
            onClick={() => setModelOpen((current) => !current)}
          >
            <span className="status-dot" />
            <span>Qwen 3 4B</span>
            <span>⌄</span>
          </button>

          {!authLoading &&
            (!user ? (
              <button
                className="login-button"
                type="button"
                onClick={() => openAuth("login")}
              >
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

          <button
            className="new-chat"
            type="button"
            onClick={createChat}
            disabled={loading}
          >
            <span className="plus">+</span>
            <span>New chat</span>
          </button>

          {modelOpen && (
            <div className="model-menu">
              <div className="model-menu-title">Current model</div>

              <button type="button" className="model-option active">
                <div>
                  <strong>Qwen 3 4B</strong>
                  <span>Fades AI · Local GPU</span>
                </div>

                <span>✓</span>
              </button>

              <div className="model-info">
                Running on your Fades inference infrastructure.
              </div>
            </div>
          )}
        </header>

        <section className={`hero ${hasMessages ? "chat-active" : ""}`}>
          {!hasMessages ? (
            <div className="hero-content">
              <div className="hero-badge">
                <span className="status-dot" />
                Fades AI is online
              </div>

              <div className="fade-rule" aria-hidden="true" />

              <h1>What can I help with?</h1>

              <p>
                Ask a question, work through a problem, write code, or turn
                an idea into something real.
              </p>

              <div className="suggestions">
                {SUGGESTIONS.map((item) => (
                  <button
                    key={item.title}
                    className="suggestion"
                    type="button"
                    onClick={() => applySuggestion(item.prompt)}
                  >
                    <span className="suggestion-icon">{item.icon}</span>

                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                    </div>

                    <span className="suggestion-arrow">→</span>
                  </button>
                ))}
              </div>

              <div className="hero-meta">
                <span>Private infrastructure</span>
                <span>•</span>
                <span>Qwen 3 4B</span>
                <span>•</span>
                <span>Fades AI</span>
              </div>
            </div>
          ) : (
            <div
              className={`messages ${
                settings.compactMode ? "compact" : ""
              }`}
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
              role="log"
              aria-live="polite"
            >
              <div className="conversation-header">
                <div>
                  <span>Conversation</span>
                  <strong>{messageCount} messages</strong>
                </div>

                <div className="conversation-tools">
                  <button type="button" onClick={exportCurrentChat}>
                    Export
                  </button>

                  <button
                    type="button"
                    onClick={() => setClearConfirmOpen(true)}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {messages.map((item, index) => (
                <div
                  key={item.id}
                  className={`message-row ${item.role} ${
                    item.error ? "error" : ""
                  } ${item.stopped ? "stopped" : ""}`}
                >
                  <div className="message-avatar">
                    {item.role === "user" ? avatarLetter : "f"}
                  </div>

                  <div className="message-main">
                    <div className="message-header">
                      <div className="message-label">
                        {item.role === "user"
                          ? user?.displayName || user?.username || "You"
                          : "Fades"}

                        {settings.showTimestamps && item.createdAt && (
                          <span>{formatTime(item.createdAt)}</span>
                        )}
                      </div>
                    </div>

                    <div className="message-content">
                      {item.role === "assistant" ? (
                        <ReactMarkdown components={markdownComponents}>
                          {item.content}
                        </ReactMarkdown>
                      ) : (
                        <p>{item.content}</p>
                      )}
                    </div>

                    {item.streaming && !item.content && (
                      <div className="streaming-placeholder">
                        <span />
                        <span />
                        <span />
                      </div>
                    )}

                    {item.role === "assistant" && !item.streaming && (
                      <div className="message-actions">
                        <button
                          type="button"
                          onClick={() => copyText(item.content)}
                        >
                          Copy
                        </button>

                        <button
                          type="button"
                          onClick={() => resendFrom(index)}
                          disabled={loading}
                        >
                          {item.error ? "Retry" : "Regenerate"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="generation-status">
                  <div className="message-avatar">f</div>

                  <div>
                    <span>Fades is thinking</span>

                    <div className="thinking">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>

                  <button type="button" onClick={stopGeneration}>
                    Stop
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </section>

        {showScrollButton && (
          <button
            className="scroll-bottom"
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
          >
            ↓
          </button>
        )}

        {/* Composer */}
        <div className="composer-container">
          <form className="composer" onSubmit={sendMessage}>
            <button
              type="button"
              className="composer-add"
              aria-label="Attachments"
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
                  : event.key === "Enter" &&
                    (event.metaKey || event.ctrlKey);

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
              <button
                type="button"
                className="send stop"
                onClick={stopGeneration}
                aria-label="Stop generation"
              >
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
          </form>

          <div className="composer-footer">
            <span>
              {settings.enterToSend
                ? "Enter to send · Shift + Enter for a new line"
                : "⌘ + Enter to send · Enter for a new line"}
            </span>

            <span className="model-label">
              <span className="status-dot" />
              Qwen 3 4B · Fades AI
            </span>
          </div>
        </div>
      </div>

      {/* Search */}
      {searchOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setSearchOpen(false)}
        >
          <div
            className="search-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="search-modal-top">
              <span>⌕</span>

              <input
                ref={searchInputRef}
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search your conversations..."
              />

              <kbd>ESC</kbd>
            </div>

            <div className="search-results">
              {filteredChats.length === 0 ? (
                <div className="search-empty">
                  <span>⌕</span>
                  <strong>No conversations found</strong>
                  <small>Try a different search.</small>
                </div>
              ) : (
                filteredChats.slice(0, 12).map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => openChat(chat)}
                  >
                    <span>{chat.favorite ? "★" : "◌"}</span>

                    <div>
                      <strong>{chat.title}</strong>

                      <small>
                        {chat.messages?.length || 0} messages ·{" "}
                        {formatDate(chat.updatedAt)}
                      </small>
                    </div>

                    <span>→</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Auth */}
      {authOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={() => {
            if (!authSubmitting) setAuthOpen(false);
          }}
        >
          <div
            className="auth-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={() => !authSubmitting && setAuthOpen(false)}
            >
              ×
            </button>

            <div className="modal-logo">f</div>

            <h2>
              {authMode === "login"
                ? "Welcome back"
                : "Create your Fades account"}
            </h2>

            <p>
              {authMode === "login"
                ? "Sign in to continue using Fades."
                : "Create an account to keep your Fades experience connected."}
            </p>

            {authError && <div className="auth-error">{authError}</div>}

            <form className="auth-form" onSubmit={submitAuth}>
              {authMode === "signup" && (
                <>
                  <label>
                    Display name
                    <input
                      type="text"
                      value={authDisplayName}
                      onChange={(event) =>
                        setAuthDisplayName(event.target.value)
                      }
                      placeholder="Fades User"
                      autoComplete="name"
                      disabled={authSubmitting}
                    />
                  </label>

                  <label>
                    Username
                    <input
                      type="text"
                      value={authUsername}
                      onChange={(event) =>
                        setAuthUsername(event.target.value)
                      }
                      placeholder="fadesuser"
                      minLength={3}
                      maxLength={24}
                      required
                      autoComplete="username"
                      disabled={authSubmitting}
                    />
                  </label>
                </>
              )}

              <label>
                Email
                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  disabled={authSubmitting}
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  required
                  autoComplete={
                    authMode === "login"
                      ? "current-password"
                      : "new-password"
                  }
                  disabled={authSubmitting}
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
              <span>
                {authMode === "login"
                  ? "Don't have an account?"
                  : "Already have an account?"}
              </span>

              <button
                type="button"
                disabled={authSubmitting}
                onClick={() =>
                  openAuth(authMode === "login" ? "signup" : "login")
                }
              >
                {authMode === "login" ? "Create one" : "Sign in"}
              </button>
            </div>

            <div className="login-divider">
              <span>or</span>
            </div>

            <button
              className="guest-button"
              type="button"
              disabled={authSubmitting}
              onClick={() => setAuthOpen(false)}
            >
              Continue as guest
            </button>

            <small className="login-note">
              Guest chats stay on this device.
            </small>
          </div>
        </div>
      )}

      {/* Settings */}
      {settingsOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setSettingsOpen(false)}
        >
          <div
            className="settings-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span>Preferences</span>
                <h2>Settings</h2>
              </div>

              <button
                className="modal-close"
                type="button"
                aria-label="Close"
                onClick={() => setSettingsOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="settings-group">
              <div className="settings-group-title">Appearance</div>

              <div className="setting-row">
                <div>
                  <strong>Theme</strong>
                  <span>Choose how Fades looks.</span>
                </div>

                <select
                  value={settings.theme}
                  onChange={(event) =>
                    updateSetting("theme", event.target.value)
                  }
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div className="setting-row">
                <div>
                  <strong>Compact mode</strong>
                  <span>Fit more messages on screen.</span>
                </div>

                <button
                  type="button"
                  aria-pressed={settings.compactMode}
                  className={`toggle ${settings.compactMode ? "on" : ""}`}
                  onClick={() =>
                    updateSetting("compactMode", !settings.compactMode)
                  }
                >
                  <span />
                </button>
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group-title">Chat</div>

              <div className="setting-row">
                <div>
                  <strong>Enter to send</strong>
                  <span>Press Enter to send messages.</span>
                </div>

                <button
                  type="button"
                  aria-pressed={settings.enterToSend}
                  className={`toggle ${settings.enterToSend ? "on" : ""}`}
                  onClick={() =>
                    updateSetting("enterToSend", !settings.enterToSend)
                  }
                >
                  <span />
                </button>
              </div>

              <div className="setting-row">
                <div>
                  <strong>Message timestamps</strong>
                  <span>Show the time beside messages.</span>
                </div>

                <button
                  type="button"
                  aria-pressed={settings.showTimestamps}
                  className={`toggle ${
                    settings.showTimestamps ? "on" : ""
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
                  <strong>Sound effects</strong>
                  <span>Play subtle interface sounds.</span>
                </div>

                <button
                  type="button"
                  aria-pressed={settings.soundEffects}
                  className={`toggle ${settings.soundEffects ? "on" : ""}`}
                  onClick={() =>
                    updateSetting("soundEffects", !settings.soundEffects)
                  }
                >
                  <span />
                </button>
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group-title">Data</div>

              <button
                className="settings-action"
                type="button"
                onClick={exportAllChats}
              >
                <div>
                  <strong>Export chats</strong>
                  <span>Download your conversations as JSON.</span>
                </div>

                <span>↓</span>
              </button>

              <button
                className="settings-action"
                type="button"
                onClick={importChats}
              >
                <div>
                  <strong>Import chats</strong>
                  <span>Restore a Fades chat export.</span>
                </div>

                <span>↑</span>
              </button>

              <button
                className="settings-action danger"
                type="button"
                onClick={() => setClearConfirmOpen(true)}
              >
                <div>
                  <strong>Clear all chats</strong>
                  <span>Permanently remove local conversations.</span>
                </div>

                <span>×</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About */}
      {aboutOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setAboutOpen(false)}
        >
          <div
            className="about-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={() => setAboutOpen(false)}
            >
              ×
            </button>

            <div className="about-logo">f</div>

            <h2>Fades AI</h2>

            <p>Your own AI infrastructure, powered by Fades.</p>

            <div className="about-stats">
              <div>
                <strong>{chats.length}</strong>
                <span>Chats</span>
              </div>

              <div>
                <strong>{totalMessages}</strong>
                <span>Messages</span>
              </div>

              <div>
                <strong>Qwen</strong>
                <span>Model</span>
              </div>
            </div>

            <div className="about-card">
              <span className="status-dot" />

              <div>
                <strong>Fades AI online</strong>
                <span>Local inference infrastructure connected.</span>
              </div>
            </div>

            <div className="about-footer">
              <span>Fades AI</span>
              <span>v1.0</span>
            </div>
          </div>
        </div>
      )}

      {/* Clear confirmation */}
      {clearConfirmOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setClearConfirmOpen(false)}
        >
          <div
            className="confirm-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="confirm-icon">!</div>

            <h2>Clear all chats?</h2>

            <p>
              This will remove all locally stored conversations from this
              browser.
            </p>

            <div className="confirm-actions">
              <button
                type="button"
                onClick={() => setClearConfirmOpen(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="danger-button"
                onClick={clearAllChats}
              >
                Clear everything
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={handleImport}
      />

      {toast && (
        <div className={`toast ${toast.type === "error" ? "error" : ""}`}>
          <span>{toast.type === "error" ? "!" : "✓"}</span>
          <strong>{toast.text}</strong>
        </div>
      )}
    </main>
  );
}
