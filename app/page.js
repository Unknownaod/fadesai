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
const MODEL_NAME = "Qwen 3 4B";

const DEFAULT_SETTINGS = {
  theme: "dark",
  compactMode: false,
  enterToSend: true,
  showTimestamps: false,
  soundEffects: false,
};

const SUGGESTIONS = [
  {
    title: "Explain something",
    description: "Break down a complicated topic",
    prompt: "Explain something complicated to me in a simple way.",
  },
  {
    title: "Build something",
    description: "Create code, websites, and more",
    prompt: "Help me build something from scratch.",
  },
  {
    title: "Get creative",
    description: "Brainstorm ideas and possibilities",
    prompt: "Give me some creative ideas for a project.",
  },
  {
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

  const content =
    typeof raw.content === "string" ? raw.content : "";

  if (!content) return null;

  return {
    id: raw.id || createId("message"),
    role: raw.role === "user" ? "user" : "assistant",
    content,
    createdAt:
      typeof raw.createdAt === "number"
        ? raw.createdAt
        : Date.now(),
  };
}

function normalizeChat(raw) {
  if (!raw || typeof raw !== "object") return null;

  return {
    id: raw.id || createId("chat"),
    title:
      typeof raw.title === "string" && raw.title.trim()
        ? raw.title
        : "New chat",
    messages: Array.isArray(raw.messages)
      ? raw.messages.map(normalizeMessage).filter(Boolean)
      : [],
    pinned: Boolean(raw.pinned),
    favorite: Boolean(raw.favorite),
    createdAt:
      typeof raw.createdAt === "number"
        ? raw.createdAt
        : Date.now(),
    updatedAt:
      typeof raw.updatedAt === "number"
        ? raw.updatedAt
        : Date.now(),
  };
}

const MARKDOWN_COMPONENTS = {
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

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

  /* Account chat loading */
  const [cloudChatsLoading, setCloudChatsLoading] = useState(false);

  /* UI state */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

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
  const stickToBottomRef = useRef(true);
  const toastTimersRef = useRef(new Map());

  /* -------------------------------------------------------------- */
  /* Toasts                                                          */
  /* -------------------------------------------------------------- */

  const showToast = useCallback((text, type = "success") => {
    const id = createId("toast");

    setToasts((current) => [
      ...current.slice(-2),
      { id, text, type },
    ]);

    const timer = setTimeout(() => {
      setToasts((current) =>
        current.filter((item) => item.id !== id)
      );

      toastTimersRef.current.delete(id);
    }, 2800);

    toastTimersRef.current.set(id, timer);
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

      setUser(
        data?.success && data?.user
          ? data.user
          : null
      );
    } catch (error) {
      console.error("Session check failed:", error);
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  /* -------------------------------------------------------------- */
  /* Local storage                                                   */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    try {
      const savedChats =
        localStorage.getItem(STORAGE_KEY);

      if (savedChats) {
        const parsed = JSON.parse(savedChats);

        if (Array.isArray(parsed)) {
          setChats(
            parsed
              .map(normalizeChat)
              .filter(Boolean)
          );
        }
      }

      const savedSettings =
        localStorage.getItem(SETTINGS_KEY);

      if (savedSettings) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...JSON.parse(savedSettings),
        });
      }
    } catch (error) {
      console.error(
        "Failed to load Fades data:",
        error
      );
    } finally {
      setHydrated(true);
    }

    checkSession();
  }, [checkSession]);

  /*
   * Local storage is intentionally kept for guests.
   * Signed-in users are synced to the backend instead.
   */
  useEffect(() => {
    if (!hydrated || user) return;

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(chats)
      );
    } catch (error) {
      console.error(
        "Failed to save local chats:",
        error
      );
    }
  }, [chats, hydrated, user]);

  useEffect(() => {
    if (!hydrated) return;

    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(settings)
      );
    } catch (error) {
      console.error(
        "Failed to save settings:",
        error
      );
    }
  }, [settings, hydrated]);

  /* -------------------------------------------------------------- */
  /* Load account chats                                              */
  /* -------------------------------------------------------------- */

  const loadCloudChats = useCallback(async () => {
    if (!user) return;

    setCloudChatsLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/chats`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await response.json().catch(
        () => null
      );

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to load your conversations."
        );
      }

      const serverChats = Array.isArray(data)
        ? data
        : Array.isArray(data?.chats)
        ? data.chats
        : [];

      const normalized = serverChats
        .map(normalizeChat)
        .filter(Boolean);

      setChats(normalized);

      if (activeChatId) {
        const active = normalized.find(
          (chat) => chat.id === activeChatId
        );

        if (active) {
          setMessages(active.messages || []);
        } else {
          setActiveChatId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error(
        "Failed to load cloud chats:",
        error
      );

      showToast(
        "Unable to load your saved chats.",
        "error"
      );
    } finally {
      setCloudChatsLoading(false);
    }
  }, [user, activeChatId, showToast]);

  useEffect(() => {
    if (!user) return;

    loadCloudChats();
  }, [user]); // intentionally only when account changes

  /* -------------------------------------------------------------- */
  /* Theme                                                           */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    const root = document.documentElement;

    root.dataset.compact =
      settings.compactMode ? "true" : "false";

    if (settings.theme !== "system") {
      root.dataset.theme = settings.theme;
      return;
    }

    const query = window.matchMedia(
      "(prefers-color-scheme: dark)"
    );

    const apply = () => {
      root.dataset.theme = query.matches
        ? "dark"
        : "light";
    };

    apply();

    query.addEventListener("change", apply);

    return () =>
      query.removeEventListener("change", apply);
  }, [
    settings.theme,
    settings.compactMode,
  ]);

  useEffect(() => {
    const timers = toastTimersRef.current;

    return () => {
      abortControllerRef.current?.abort();

      timers.forEach((timer) =>
        clearTimeout(timer)
      );

      timers.clear();
    };
  }, []);

  /* -------------------------------------------------------------- */
  /* Composer                                                        */
  /* -------------------------------------------------------------- */

  const focusComposer = useCallback(() => {
    window.setTimeout(
      () => textareaRef.current?.focus(),
      50
    );
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

  /* -------------------------------------------------------------- */
  /* Cloud chat helpers                                              */
  /* -------------------------------------------------------------- */

  const createCloudChat = useCallback(
    async (chat) => {
      if (!user) return chat;

      const response = await fetch(
        `${API_URL}/chats`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            title: chat.title,
            pinned: chat.pinned,
            favorite: chat.favorite,
          }),
        }
      );

      const data = await response.json().catch(
        () => null
      );

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to create conversation."
        );
      }

      return normalizeChat(
        data?.chat || data
      );
    },
    [user]
  );

  const updateCloudChat = useCallback(
    async (chatId, updates) => {
      if (!user) return;

      try {
        const response = await fetch(
          `${API_URL}/chats/${encodeURIComponent(
            chatId
          )}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(updates),
          }
        );

        const data = await response.json().catch(
          () => null
        );

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Unable to update conversation."
          );
        }
      } catch (error) {
        console.error(
          "Cloud chat update failed:",
          error
        );

        showToast(
          "Your chat could not be synced.",
          "error"
        );
      }
    },
    [user, showToast]
  );

  const deleteCloudChat = useCallback(
    async (chatId) => {
      if (!user) return;

      try {
        const response = await fetch(
          `${API_URL}/chats/${encodeURIComponent(
            chatId
          )}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );

        const data = await response.json().catch(
          () => null
        );

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Unable to delete conversation."
          );
        }
      } catch (error) {
        console.error(
          "Cloud chat delete failed:",
          error
        );

        showToast(
          "The chat could not be deleted from your account.",
          "error"
        );
      }
    },
    [user, showToast]
  );

  const saveCloudMessages = useCallback(
    async (chatId, nextMessages) => {
      if (!user) return;

      try {
        const response = await fetch(
          `${API_URL}/chats/${encodeURIComponent(
            chatId
          )}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              messages: nextMessages.map(
                (item) => ({
                  id: item.id,
                  role: item.role,
                  content: item.content,
                  createdAt: item.createdAt,
                })
              ),
            }),
          }
        );

        const data = await response.json().catch(
          () => null
        );

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Unable to save messages."
          );
        }
      } catch (error) {
        console.error(
          "Cloud message save failed:",
          error
        );

        showToast(
          "Your latest messages could not be saved.",
          "error"
        );
      }
    },
    [user, showToast]
  );

  /* -------------------------------------------------------------- */
  /* Chats                                                           */
  /* -------------------------------------------------------------- */

  const createChat = useCallback(async () => {
    if (loading) return;

    const localChat = {
      id: createId("chat"),
      title: "New chat",
      messages: [],
      pinned: false,
      favorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    let chat = localChat;

    if (user) {
      try {
        chat = await createCloudChat(localChat);
      } catch (error) {
        console.error(
          "Cloud chat creation failed:",
          error
        );

        showToast(
          "Unable to create a saved chat.",
          "error"
        );

        return;
      }
    }

    setChats((current) => [
      chat,
      ...current,
    ]);

    setActiveChatId(chat.id);
    setMessages([]);
    setMessage("");
    setSidebarOpen(false);
    stickToBottomRef.current = true;

    focusComposer();
  }, [
    loading,
    user,
    createCloudChat,
    showToast,
    focusComposer,
  ]);

  const openChat = useCallback(
    (chat) => {
      if (loading) return;

      setActiveChatId(chat.id);
      setMessages(chat.messages || []);
      setMessage("");
      setSidebarOpen(false);
      setProfileOpen(false);
      stickToBottomRef.current = true;

      focusComposer();
    },
    [loading, focusComposer]
  );

  function generateTitle(text) {
    const clean = text
      .trim()
      .replace(/\s+/g, " ");

    if (!clean) return "New chat";

    if (clean.length <= 48) {
      return clean;
    }

    return `${clean.slice(0, 48)}...`;
  }

  const ensureChat = useCallback(
    async (text) => {
      const exists = chats.some(
        (chat) => chat.id === activeChatId
      );

      if (activeChatId && exists) {
        return activeChatId;
      }

      const localChat = {
        id: createId("chat"),
        title: generateTitle(text),
        messages: [],
        pinned: false,
        favorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (user) {
        try {
          const cloudChat =
            await createCloudChat(localChat);

          setChats((current) => [
            cloudChat,
            ...current,
          ]);

          setActiveChatId(cloudChat.id);

          return cloudChat.id;
        } catch (error) {
          console.error(
            "Failed to create cloud chat:",
            error
          );

          throw error;
        }
      }

      setChats((current) => [
        localChat,
        ...current,
      ]);

      setActiveChatId(localChat.id);

      return localChat.id;
    },
    [
      activeChatId,
      chats,
      user,
      createCloudChat,
    ]
  );

  const commitMessages = useCallback(
    (
      chatId,
      nextMessages,
      title
    ) => {
      setMessages(nextMessages);

      setChats((current) =>
        current.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                title:
                  title &&
                  chat.title === "New chat"
                    ? title
                    : chat.title,
                messages: nextMessages,
                updatedAt: Date.now(),
              }
            : chat
        )
      );
    },
    []
  );

  /* -------------------------------------------------------------- */
  /* Send                                                            */
  /* -------------------------------------------------------------- */

  const sendMessage = useCallback(
    async (
      event,
      overrideMessage = null,
      baseMessages = null
    ) => {
      event?.preventDefault?.();

      const text = (
        overrideMessage !== null
          ? overrideMessage
          : message
      ).trim();

      if (!text || loading) return;

      setMessage("");

      if (textareaRef.current) {
        textareaRef.current.style.height =
          "auto";
      }

      const baseline =
        baseMessages ?? messages;

      let currentChatId;

      try {
        currentChatId =
          await ensureChat(text);
      } catch (error) {
        showToast(
          error?.message ||
            "Unable to create the conversation.",
          "error"
        );

        return;
      }

      const userMessage = {
        id: createId("message"),
        role: "user",
        content: text,
        createdAt: Date.now(),
      };

      const history = baseline.map(
        (item) => ({
          role: item.role,
          content: item.content,
        })
      );

      const updatedMessages = [
        ...baseline,
        userMessage,
      ];

      const assistantId =
        createId("message");

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

      const controller =
        new AbortController();

      abortControllerRef.current =
        controller;

      try {
        const response = await fetch(
          "/api/chat",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            signal: controller.signal,
            body: JSON.stringify({
              message: text,
              history,
            }),
          }
        );

        if (!response.ok) {
          let errorMessage =
            "Fades could not process the request.";

          try {
            const errorText =
              await response.text();

            try {
              errorMessage =
                JSON.parse(errorText)?.error ||
                errorMessage;
            } catch {
              if (errorText) {
                errorMessage =
                  errorText;
              }
            }
          } catch {
            /* ignore */
          }

          throw new Error(errorMessage);
        }

        if (!response.body) {
          throw new Error(
            "Fades returned an empty response."
          );
        }

        const reader =
          response.body.getReader();

        const decoder =
          new TextDecoder();

        let buffer = "";
        let fullResponse = "";
        let streamError = null;

        while (true) {
          const {
            value,
            done,
          } = await reader.read();

          if (done) break;

          buffer += decoder.decode(
            value,
            { stream: true }
          );

          const events =
            buffer.split("\n\n");

          buffer =
            events.pop() || "";

          for (const sseEvent of events) {
            for (const line of sseEvent.split(
              "\n"
            )) {
              if (
                !line.startsWith("data:")
              ) {
                continue;
              }

              const rawData =
                line.slice(5).trim();

              if (
                !rawData ||
                rawData === "[DONE]"
              ) {
                continue;
              }

              let data;

              try {
                data =
                  JSON.parse(rawData);
              } catch (
                parseError
              ) {
                console.warn(
                  "Stream parsing warning:",
                  parseError
                );

                continue;
              }

              if (data.error) {
                streamError =
                  new Error(
                    data.error
                  );

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

              setMessages(
                (current) =>
                  current.map(
                    (item) =>
                      item.id ===
                      assistantId
                        ? {
                            ...item,
                            content:
                              fullResponse,
                          }
                        : item
                  )
              );
            }

            if (streamError) break;
          }

          if (streamError) {
            await reader
              .cancel()
              .catch(() => {});

            throw streamError;
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
            createdAt: Date.now(),
          },
        ];

        const title =
          generateTitle(text);

        commitMessages(
          currentChatId,
          finalMessages,
          title
        );

        if (user) {
          const chat =
            chats.find(
              (item) =>
                item.id ===
                currentChatId
            );

          if (
            chat &&
            chat.title === "New chat"
          ) {
            await updateCloudChat(
              currentChatId,
              {
                title,
              }
            );
          }

          await saveCloudMessages(
            currentChatId,
            finalMessages
          );
        }
      } catch (error) {
        if (
          error?.name ===
          "AbortError"
        ) {
          const stoppedMessages = [
            ...updatedMessages,
            {
              id: assistantId,
              role: "assistant",
              content:
                "Generation stopped.",
              stopped: true,
              createdAt: Date.now(),
            },
          ];

          commitMessages(
            currentChatId,
            stoppedMessages
          );

          if (user) {
            await saveCloudMessages(
              currentChatId,
              stoppedMessages
            );
          }

          showToast(
            "Generation stopped."
          );
        } else {
          console.error(
            "Fades AI error:",
            error
          );

          const errorMessages = [
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
          ];

          commitMessages(
            currentChatId,
            errorMessages
          );

          showToast(
            "Fades couldn't complete that request.",
            "error"
          );
        }
      } finally {
        setLoading(false);
        abortControllerRef.current =
          null;

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
      user,
      chats,
      updateCloudChat,
      saveCloudMessages,
    ]
  );

  function stopGeneration() {
    abortControllerRef.current?.abort();
  }

  /* -------------------------------------------------------------- */
  /* Regenerate                                                      */
  /* -------------------------------------------------------------- */

  const resendFrom = useCallback(
    async (index) => {
      if (loading) return;

      let userIndex = -1;

      for (
        let i = index - 1;
        i >= 0;
        i -= 1
      ) {
        if (
          messages[i].role ===
          "user"
        ) {
          userIndex = i;
          break;
        }
      }

      if (userIndex === -1) return;

      const base =
        messages.slice(
          0,
          userIndex
        );

      const prompt =
        messages[userIndex].content;

      setMessages(base);

      await sendMessage(
        null,
        prompt,
        base
      );
    },
    [
      loading,
      messages,
      sendMessage,
    ]
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

    setChats((current) =>
      current.filter(
        (chat) =>
          chat.id !== chatId
      )
    );

    if (
      activeChatId === chatId
    ) {
      setActiveChatId(null);
      setMessages([]);
      setMessage("");
    }

    if (user) {
      deleteCloudChat(chatId);
    }

    showToast("Chat deleted.");
  }

  function startRename(chat) {
    setEditingChatId(chat.id);
    setEditingTitle(chat.title);
  }

  function saveRename(chatId) {
    const title =
      editingTitle.trim();

    if (!title) {
      setEditingChatId(null);
      setEditingTitle("");
      return;
    }

    setChats((current) =>
      current.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              title,
              updatedAt:
                Date.now(),
            }
          : chat
      )
    );

    if (user) {
      updateCloudChat(
        chatId,
        { title }
      );
    }

    setEditingChatId(null);
    setEditingTitle("");

    showToast("Chat renamed.");
  }

  function togglePin(chatId) {
    setChats((current) =>
      current.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              pinned:
                !chat.pinned,
              updatedAt:
                Date.now(),
            }
          : chat
      )
    );

    const chat =
      chats.find(
        (item) =>
          item.id === chatId
      );

    if (user && chat) {
      updateCloudChat(
        chatId,
        {
          pinned:
            !chat.pinned,
        }
      );
    }
  }

  function toggleFavorite(chatId) {
    setChats((current) =>
      current.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              favorite:
                !chat.favorite,
              updatedAt:
                Date.now(),
            }
          : chat
      )
    );

    const chat =
      chats.find(
        (item) =>
          item.id === chatId
      );

    if (user && chat) {
      updateCloudChat(
        chatId,
        {
          favorite:
            !chat.favorite,
        }
      );
    }
  }

  function clearAllChats() {
    if (loading) return;

    if (user) {
      /*
       * Account chats are deleted individually
       * so the backend remains the source of truth.
       */
      Promise.all(
        chats.map((chat) =>
          deleteCloudChat(chat.id)
        )
      ).catch((error) =>
        console.error(
          "Failed clearing cloud chats:",
          error
        )
      );
    }

    setChats([]);
    setMessages([]);
    setActiveChatId(null);
    setMessage("");
    setClearConfirmOpen(false);
    setSettingsOpen(false);

    if (!user) {
      try {
        localStorage.removeItem(
          STORAGE_KEY
        );
      } catch {
        /* ignore */
      }
    }

    showToast("All chats cleared.");
  }

  const copyText = useCallback(
    async (content) => {
      try {
        await navigator.clipboard.writeText(
          content
        );

        showToast("Copied.");
      } catch (error) {
        console.error(
          "Copy failed:",
          error
        );

        showToast(
          "Unable to copy. Check clipboard permissions.",
          "error"
        );
      }
    },
    [showToast]
  );

  /* -------------------------------------------------------------- */
  /* Import / export                                                 */
  /* -------------------------------------------------------------- */

  function exportCurrentChat() {
    if (!messages.length) {
      showToast(
        "There is no conversation to export.",
        "error"
      );

      return;
    }

    const chat = chats.find(
      (item) =>
        item.id === activeChatId
    );

    const lines = [
      "Fades AI",
      chat?.title ||
        "Fades conversation",
      `Exported ${formatDate(
        Date.now()
      )}`,
      "",
      "--------------------------------",
      "",
    ];

    messages.forEach((item) => {
      lines.push(
        `${
          item.role === "user"
            ? "You"
            : "Fades"
        }:`
      );

      lines.push(item.content);
      lines.push("");
    });

    downloadFile(
      "fades-conversation.txt",
      lines.join("\n"),
      "text/plain;charset=utf-8"
    );

    showToast(
      "Conversation exported."
    );
  }

  function exportAllChats() {
    downloadFile(
      "fades-chats.json",
      JSON.stringify(
        {
          app: "Fades AI",
          version: 2,
          exportedAt:
            new Date().toISOString(),
          chats,
        },
        null,
        2
      ),
      "application/json"
    );

    showToast(
      "All chats exported."
    );
  }

  async function handleImport(
    event
  ) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    try {
      const parsed =
        JSON.parse(
          await file.text()
        );

      const importedChats =
        Array.isArray(parsed)
          ? parsed
          : parsed?.chats;

      if (
        !Array.isArray(
          importedChats
        )
      ) {
        throw new Error(
          "This file does not contain valid Fades chats."
        );
      }

      const sanitized =
        importedChats
          .filter(
            (chat) =>
              chat &&
              typeof chat ===
                "object"
          )
          .map((chat) => ({
            id: createId("chat"),
            title:
              typeof chat.title ===
                "string" &&
              chat.title.trim()
                ? chat.title
                : "Imported chat",
            messages:
              Array.isArray(
                chat.messages
              )
                ? chat.messages
                    .map(
                      normalizeMessage
                    )
                    .filter(Boolean)
                : [],
            pinned: Boolean(
              chat.pinned
            ),
            favorite: Boolean(
              chat.favorite
            ),
            createdAt:
              Date.now(),
            updatedAt:
              Date.now(),
          }));

      if (user) {
        for (
          const imported of sanitized
        ) {
          try {
            const created =
              await createCloudChat(
                imported
              );

            await saveCloudMessages(
              created.id,
              imported.messages
            );

            imported.id =
              created.id;
          } catch (
            error
          ) {
            console.error(
              "Imported cloud chat failed:",
              error
            );
          }
        }
      }

      setChats((current) => [
        ...sanitized,
        ...current,
      ]);

      showToast(
        `${sanitized.length} chat${
          sanitized.length === 1
            ? ""
            : "s"
        } imported.`
      );
    } catch (error) {
      console.error(
        "Import failed:",
        error
      );

      showToast(
        "That file could not be imported.",
        "error"
      );
    }
  }

  function updateSetting(
    key,
    value
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  /* -------------------------------------------------------------- */
  /* Auth                                                            */
  /* -------------------------------------------------------------- */

  function openAuth(
    mode = "login"
  ) {
    setAuthMode(mode);
    setAuthError("");
    setAuthEmail("");
    setAuthUsername("");
    setAuthPassword("");
    setAuthDisplayName("");
    setAuthOpen(true);
    setProfileOpen(false);
  }

  async function submitAuth(
    event
  ) {
    event.preventDefault();

    if (authSubmitting) return;

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
              email:
                authEmail.trim(),
              password:
                authPassword,
            }
          : {
              email:
                authEmail.trim(),
              username:
                authUsername.trim(),
              password:
                authPassword,
              displayName:
                authDisplayName.trim() ||
                authUsername.trim(),
            };

      const response =
        await fetch(
          `${API_URL}${endpoint}`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials:
              "include",
            body: JSON.stringify(
              body
            ),
          }
        );

      const data =
        await response
          .json()
          .catch(
            () => null
          );

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.error ||
            "Authentication failed."
        );
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
      console.error(
        "Authentication error:",
        error
      );

      setAuthError(
        error?.message ||
          "Unable to connect to the Fades account service."
      );
    } finally {
      setAuthSubmitting(
        false
      );
    }
  }

  async function logout() {
    try {
      await fetch(
        `${API_URL}/auth/logout`,
        {
          method: "POST",
          credentials:
            "include",
        }
      );
    } catch (error) {
      console.error(
        "Logout failed:",
        error
      );
    }

    /*
     * When signing out, keep the current
     * chats in localStorage so the user
     * doesn't suddenly lose the UI state.
     */
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(chats)
      );
    } catch {
      /* ignore */
    }

    setUser(null);
    setProfileOpen(false);

    showToast(
      "You've been signed out."
    );
  }

  /* -------------------------------------------------------------- */
  /* Keyboard shortcuts                                              */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    function handleKeyboard(
      event
    ) {
      if (
        typeof event.key !==
        "string"
      ) {
        return;
      }

      const modifier =
        event.metaKey ||
        event.ctrlKey;

      const key =
        event.key.toLowerCase();

      if (
        modifier &&
        event.shiftKey &&
        key === "f"
      ) {
        event.preventDefault();

        setSidebarOpen(true);

        window.setTimeout(
          () =>
            searchInputRef.current?.focus(),
          60
        );

        return;
      }

      if (
        modifier &&
        !event.shiftKey &&
        key === "k"
      ) {
        event.preventDefault();

        createChat();

        return;
      }

      if (
        event.key ===
        "Escape"
      ) {
        setSidebarOpen(false);
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

    window.addEventListener(
      "keydown",
      handleKeyboard
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyboard
      );
  }, [
    authSubmitting,
    createChat,
  ]);

  /* -------------------------------------------------------------- */
  /* Scrolling                                                       */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    if (
      !stickToBottomRef.current
    ) {
      return;
    }

    messagesEndRef.current?.scrollIntoView(
      {
        behavior: "smooth",
      }
    );
  }, [
    messages,
    loading,
  ]);

  function handleMessagesScroll() {
    const element =
      messagesContainerRef.current;

    if (!element) return;

    const distance =
      element.scrollHeight -
      element.scrollTop -
      element.clientHeight;

    stickToBottomRef.current =
      distance < 80;
  }

  /* -------------------------------------------------------------- */
  /* Derived                                                         */
  /* -------------------------------------------------------------- */

  const filteredChats =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return [...chats]
        .filter((chat) => {
          if (!query) return true;

          return (
            chat.title
              ?.toLowerCase()
              .includes(query) ||
            chat.messages?.some(
              (item) =>
                item.content
                  ?.toLowerCase()
                  .includes(query)
            )
          );
        })
        .sort(
          (a, b) =>
            (b.updatedAt || 0) -
            (a.updatedAt || 0)
        );
    }, [chats, search]);

  const pinnedChats =
    filteredChats.filter(
      (chat) => chat.pinned
    );

  const otherChats =
    filteredChats.filter(
      (chat) => !chat.pinned
    );

  const hasMessages =
    messages.length > 0;

  const totalMessages =
    useMemo(
      () =>
        chats.reduce(
          (total, chat) =>
            total +
            (chat.messages
              ?.length || 0),
          0
        ),
      [chats]
    );

  const avatarLetter =
    user?.displayName
      ?.charAt(0)
      ?.toUpperCase() ||
    user?.username
      ?.charAt(0)
      ?.toUpperCase() ||
    "F";

  /* -------------------------------------------------------------- */
  /* Chat list                                                       */
  /* -------------------------------------------------------------- */

  function renderChat(chat) {
    return (
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
              saveRename(chat.id)
            }
            onKeyDown={(event) => {
              if (
                event.key ===
                "Enter"
              ) {
                event.preventDefault();

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

                setEditingTitle(
                  ""
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
              {chat.favorite
                ? "★"
                : "◌"}
            </span>

            <span className="chat-title">
              {chat.title}
            </span>
          </button>
        )}

        {editingChatId !==
          chat.id && (
          <div className="chat-actions">
            <button
              type="button"
              title={
                chat.pinned
                  ? "Unpin"
                  : "Pin"
              }
              aria-label={
                chat.pinned
                  ? "Unpin chat"
                  : "Pin chat"
              }
              onClick={() =>
                togglePin(
                  chat.id
                )
              }
            >
              {chat.pinned
                ? "◆"
                : "◇"}
            </button>

            <button
              type="button"
              title="Favorite"
              aria-label="Favorite chat"
              onClick={() =>
                toggleFavorite(
                  chat.id
                )
              }
            >
              {chat.favorite
                ? "★"
                : "☆"}
            </button>

            <button
              type="button"
              title="Rename"
              aria-label="Rename chat"
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
              aria-label="Delete chat"
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
    );
  }

  /* -------------------------------------------------------------- */
  /* Render                                                          */
  /* -------------------------------------------------------------- */

  return (
    <main className="app">
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

      {/* Sidebar */}
      <aside
        className={`sidebar ${
          sidebarOpen ? "open" : ""
        }`}
      >
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <div className="brand-mark">
              f
            </div>

            <div className="brand-name">
              Fades
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
          onClick={createChat}
          disabled={
            loading ||
            cloudChatsLoading
          }
        >
          <span>+</span>
          <strong>
            New chat
          </strong>
          <kbd>⌘K</kbd>
        </button>

        <div className="sidebar-search">
          <span>⌕</span>

          <input
            ref={searchInputRef}
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search chats"
            aria-label="Search chats"
          />
        </div>

        <div className="chat-list">
          {cloudChatsLoading ? (
            <div className="empty-chats">
              <span className="empty-icon">
                ◌
              </span>

              <p>
                Loading chats
              </p>

              <small>
                Syncing your Fades account.
              </small>
            </div>
          ) : filteredChats.length ===
            0 ? (
            <div className="empty-chats">
              <span className="empty-icon">
                ◌
              </span>

              <p>
                {search
                  ? "No matches"
                  : "No chats yet"}
              </p>

              <small>
                {search
                  ? "Try another search."
                  : "Start a conversation and it will appear here."}
              </small>
            </div>
          ) : (
            <>
              {pinnedChats.length >
                0 && (
                <div className="chat-group">
                  <div className="chat-group-title">
                    Pinned
                  </div>

                  {pinnedChats.map(
                    renderChat
                  )}
                </div>
              )}

              {otherChats.length >
                0 && (
                <div className="chat-group">
                  <div className="chat-group-title">
                    {pinnedChats.length >
                    0
                      ? "Recent"
                      : "Chats"}
                  </div>

                  {otherChats.map(
                    renderChat
                  )}
                </div>
              )}
            </>
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
                openAuth(
                  "login"
                );
              }
            }}
          >
            <div className="user-avatar">
              {user
                ? avatarLetter
                : "?"}
            </div>

            <div className="user-info">
              <strong>
                {user
                  ? user.displayName ||
                    user.username
                  : "Guest"}
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

          {profileOpen &&
            user && (
              <div className="profile-menu">
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(
                      true
                    );

                    setProfileOpen(
                      false
                    );
                  }}
                >
                  Settings
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAboutOpen(
                      true
                    );

                    setProfileOpen(
                      false
                    );
                  }}
                >
                  About Fades
                </button>

                <button
                  type="button"
                  className="danger"
                  onClick={
                    logout
                  }
                >
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
            onClick={() =>
              setSidebarOpen(true)
            }
            aria-label="Open sidebar"
          >
            ☰
          </button>

          <div className="mobile-brand">
            <div className="brand-mark">
              f
            </div>

            <div className="brand-name">
              Fades
              <small>AI</small>
            </div>
          </div>

          <div className="topbar-spacer" />

          <div className="header-controls">
            {hasMessages && (
              <button
                className="header-control"
                type="button"
                onClick={
                  exportCurrentChat
                }
              >
                Export
              </button>
            )}

            <button
              className="header-control"
              type="button"
              onClick={() =>
                setSettingsOpen(
                  true
                )
              }
            >
              Settings
            </button>
          </div>

          {!authLoading &&
            (!user ? (
              <button
                className="login-button"
                type="button"
                onClick={() =>
                  openAuth(
                    "login"
                  )
                }
              >
                Sign in
              </button>
            ) : (
              <button
                className="header-avatar"
                type="button"
                aria-label="Open account menu"
                onClick={() => {
                  setSidebarOpen(
                    true
                  );

                  setProfileOpen(
                    true
                  );
                }}
              >
                {avatarLetter}
              </button>
            ))}

          <button
            className="new-chat"
            type="button"
            onClick={createChat}
            disabled={
              loading ||
              cloudChatsLoading
            }
          >
            <span className="plus">
              +
            </span>

            <span>
              New chat
            </span>
          </button>
        </header>

        <section
          className={`hero ${
            hasMessages
              ? "chat-active"
              : ""
          }`}
        >
          {!hasMessages ? (
            <div className="hero-content">
              <div className="hero-status">
                <span className="hero-status-dot" />
                Fades AI is online
              </div>

              <h1>
                What can I help with?
              </h1>

              <p>
                Ask a question, work
                through a problem, write
                code, or turn an idea into
                something real.
              </p>

              <div className="suggestions">
                {SUGGESTIONS.map(
                  (item) => (
                    <button
                      key={
                        item.title
                      }
                      className="suggestion"
                      type="button"
                      onClick={() =>
                        applySuggestion(
                          item.prompt
                        )
                      }
                    >
                      <strong>
                        {
                          item.title
                        }
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
              ref={
                messagesContainerRef
              }
              onScroll={
                handleMessagesScroll
              }
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
                        ? user?.displayName ||
                          user?.username ||
                          "You"
                        : "Fades"}

                      {settings.showTimestamps &&
                      item.createdAt
                        ? ` · ${formatTime(
                            item.createdAt
                          )}`
                        : ""}
                    </div>

                    {item.role ===
                      "assistant" &&
                    item.streaming &&
                    !item.content ? (
                      <div className="thinking">
                        <span />
                        <span />
                        <span />
                      </div>
                    ) : (
                      <div className="message-content">
                        {item.role ===
                        "assistant" ? (
                          <>
                            <ReactMarkdown
                              components={
                                MARKDOWN_COMPONENTS
                              }
                            >
                              {
                                item.content
                              }
                            </ReactMarkdown>

                            {item.streaming && (
                              <span className="streaming-cursor" />
                            )}
                          </>
                        ) : (
                          item.content
                        )}
                      </div>
                    )}

                    {item.role ===
                      "assistant" &&
                      !item.streaming && (
                        <div className="message-actions">
                          <button
                            type="button"
                            onClick={() =>
                              copyText(
                                item.content
                              )
                            }
                          >
                            Copy
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              resendFrom(
                                index
                              )
                            }
                            disabled={
                              loading
                            }
                          >
                            {item.error
                              ? "Retry"
                              : "Regenerate"}
                          </button>
                        </div>
                      )}
                  </div>
                )
              )}

              <div
                ref={
                  messagesEndRef
                }
              />
            </div>
          )}
        </section>

        {/* Composer */}
        <div className="composer-container">
          <form
            className="composer"
            onSubmit={
              sendMessage
            }
          >
            <div className="composer-row">
              <button
                type="button"
                className="composer-add"
                aria-label="Add an attachment"
                onClick={() =>
                  showToast(
                    "Attachments are coming soon."
                  )
                }
              >
                +
              </button>

              <textarea
                ref={
                  textareaRef
                }
                value={message}
                onChange={(event) => {
                  setMessage(
                    event.target.value
                  );

                  resizeTextarea();
                }}
                onKeyDown={(event) => {
                  const send =
                    settings.enterToSend
                      ? event.key ===
                          "Enter" &&
                        !event.shiftKey
                      : event.key ===
                          "Enter" &&
                        (event.metaKey ||
                          event.ctrlKey);

                  if (send) {
                    event.preventDefault();

                    sendMessage(
                      event
                    );
                  }
                }}
                placeholder="Message Fades..."
                rows={1}
                disabled={loading}
              />

              {loading ? (
                <button
                  type="button"
                  className="send"
                  onClick={
                    stopGeneration
                  }
                  aria-label="Stop generating"
                >
                  ■
                </button>
              ) : (
                <button
                  type="submit"
                  className={`send ${
                    message.trim()
                      ? "active"
                      : ""
                  }`}
                  aria-label="Send message"
                  disabled={
                    !message.trim()
                  }
                >
                  ↑
                </button>
              )}
            </div>

            <div className="composer-tools">
              <button
                type="button"
                className="model-selector"
                onClick={() =>
                  setModelOpen(
                    (current) =>
                      !current
                  )
                }
              >
                <span className="model-dot" />

                {MODEL_NAME}

                <span>⌄</span>
              </button>

              <button
                type="button"
                className={`composer-tool ${
                  settings.showTimestamps
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  updateSetting(
                    "showTimestamps",
                    !settings.showTimestamps
                  )
                }
              >
                <span className="composer-tool-icon">
                  ◷
                </span>

                Timestamps
              </button>

              {hasMessages && (
                <button
                  type="button"
                  className="composer-tool"
                  onClick={() =>
                    setClearConfirmOpen(
                      true
                    )
                  }
                >
                  <span className="composer-tool-icon">
                    ×
                  </span>

                  Clear chats
                </button>
              )}
            </div>

            {modelOpen && (
              <div
                className="dropdown"
                style={{
                  left: 8,
                  bottom: 46,
                }}
              >
                <button
                  type="button"
                  className="dropdown-item active"
                  onClick={() =>
                    setModelOpen(
                      false
                    )
                  }
                >
                  {MODEL_NAME}
                </button>

                <div className="dropdown-divider" />

                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setModelOpen(
                      false
                    );

                    setAboutOpen(
                      true
                    );
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

            <span className="model-label">
              {MODEL_NAME}
            </span>
          </div>
        </div>
      </div>

      {/* Auth */}
      {authOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={() => {
            if (!authSubmitting) {
              setAuthOpen(false);
            }
          }}
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
              aria-label="Close"
              onClick={() =>
                !authSubmitting &&
                setAuthOpen(false)
              }
            >
              ×
            </button>

            <div className="modal-logo">
              f
            </div>

            <h2>
              {authMode ===
              "login"
                ? "Welcome back"
                : "Create your Fades account"}
            </h2>

            <p>
              {authMode ===
              "login"
                ? "Sign in to continue using Fades."
                : "Create an account to keep your Fades experience connected."}
            </p>

            <form
              className="auth-form"
              onSubmit={
                submitAuth
              }
            >
              {authError && (
                <div className="auth-error">
                  {authError}
                </div>
              )}

              {authMode ===
                "signup" && (
                <>
                  <div className="auth-field">
                    <label htmlFor="fades-name">
                      Display name
                    </label>

                    <input
                      id="fades-name"
                      type="text"
                      value={
                        authDisplayName
                      }
                      onChange={(
                        event
                      ) =>
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
                  </div>

                  <div className="auth-field">
                    <label htmlFor="fades-username">
                      Username
                    </label>

                    <input
                      id="fades-username"
                      type="text"
                      value={
                        authUsername
                      }
                      onChange={(
                        event
                      ) =>
                        setAuthUsername(
                          event.target
                            .value
                        )
                      }
                      placeholder="fadesuser"
                      minLength={
                        3
                      }
                      maxLength={
                        24
                      }
                      required
                      autoComplete="username"
                      disabled={
                        authSubmitting
                      }
                    />
                  </div>
                </>
              )}

              <div className="auth-field">
                <label htmlFor="fades-email">
                  Email
                </label>

                <input
                  id="fades-email"
                  type="email"
                  value={
                    authEmail
                  }
                  onChange={(
                    event
                  ) =>
                    setAuthEmail(
                      event.target
                        .value
                    )
                  }
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  disabled={
                    authSubmitting
                  }
                />
              </div>

              <div className="auth-field">
                <label htmlFor="fades-password">
                  Password
                </label>

                <input
                  id="fades-password"
                  type="password"
                  value={
                    authPassword
                  }
                  onChange={(
                    event
                  ) =>
                    setAuthPassword(
                      event.target
                        .value
                    )
                  }
                  placeholder="••••••••"
                  minLength={
                    8
                  }
                  required
                  autoComplete={
                    authMode ===
                    "login"
                      ? "current-password"
                      : "new-password"
                  }
                  disabled={
                    authSubmitting
                  }
                />
              </div>

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
              {authMode ===
              "login"
                ? "Don't have an account? "
                : "Already have an account? "}

              <button
                type="button"
                disabled={
                  authSubmitting
                }
                onClick={() =>
                  openAuth(
                    authMode ===
                      "login"
                      ? "signup"
                      : "login"
                  )
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
              disabled={
                authSubmitting
              }
              onClick={() =>
                setAuthOpen(
                  false
                )
              }
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
          onMouseDown={() =>
            setSettingsOpen(
              false
            )
          }
        >
          <div
            className="login-modal settings-panel"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={() =>
                setSettingsOpen(
                  false
                )
              }
            >
              ×
            </button>

            <div className="settings-section">
              <h3 className="settings-title">
                Appearance
              </h3>

              <p className="settings-description">
                How Fades looks on this device.
              </p>

              <div className="settings-row">
                <div className="settings-row-label">
                  <strong>
                    Theme
                  </strong>

                  <span>
                    Dark, light, or follow your system.
                  </span>
                </div>

                <select
                  className="settings-select"
                  value={
                    settings.theme
                  }
                  onChange={(
                    event
                  ) =>
                    updateSetting(
                      "theme",
                      event.target
                        .value
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

              <div className="settings-row">
                <div className="settings-row-label">
                  <strong>
                    Compact mode
                  </strong>

                  <span>
                    Fit more messages on screen.
                  </span>
                </div>

                <button
                  type="button"
                  aria-label="Compact mode"
                  aria-pressed={
                    settings.compactMode
                  }
                  className={`toggle ${
                    settings.compactMode
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    updateSetting(
                      "compactMode",
                      !settings.compactMode
                    )
                  }
                />
              </div>
            </div>

            <div className="settings-section">
              <h3 className="settings-title">
                Chat
              </h3>

              <p className="settings-description">
                How the composer and messages behave.
              </p>

              <div className="settings-row">
                <div className="settings-row-label">
                  <strong>
                    Enter to send
                  </strong>

                  <span>
                    Otherwise, send with ⌘ + Enter.
                  </span>
                </div>

                <button
                  type="button"
                  aria-label="Enter to send"
                  aria-pressed={
                    settings.enterToSend
                  }
                  className={`toggle ${
                    settings.enterToSend
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    updateSetting(
                      "enterToSend",
                      !settings.enterToSend
                    )
                  }
                />
              </div>

              <div className="settings-row">
                <div className="settings-row-label">
                  <strong>
                    Message timestamps
                  </strong>

                  <span>
                    Show the time beside each message.
                  </span>
                </div>

                <button
                  type="button"
                  aria-label="Message timestamps"
                  aria-pressed={
                    settings.showTimestamps
                  }
                  className={`toggle ${
                    settings.showTimestamps
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    updateSetting(
                      "showTimestamps",
                      !settings.showTimestamps
                    )
                  }
                />
              </div>
            </div>

            <div className="settings-section">
              <h3 className="settings-title">
                Data
              </h3>

              <p className="settings-description">
                {user
                  ? "Your chats are synced to your Fades account."
                  : "Chats are stored in this browser."}
              </p>

              <div className="settings-row">
                <div className="settings-row-label">
                  <strong>
                    Export chats
                  </strong>

                  <span>
                    Download every conversation as JSON.
                  </span>
                </div>

                <button
                  className="header-control"
                  type="button"
                  onClick={
                    exportAllChats
                  }
                >
                  Export
                </button>
              </div>

              <div className="settings-row">
                <div className="settings-row-label">
                  <strong>
                    Import chats
                  </strong>

                  <span>
                    Restore a Fades chat export.
                  </span>
                </div>

                <button
                  className="header-control"
                  type="button"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                >
                  Import
                </button>
              </div>

              <div className="settings-row">
                <div className="settings-row-label">
                  <strong>
                    Clear all chats
                  </strong>

                  <span>
                    Remove every conversation.
                  </span>
                </div>

                <button
                  className="header-control"
                  type="button"
                  onClick={() =>
                    setClearConfirmOpen(
                      true
                    )
                  }
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="settings-section">
              <h3 className="settings-title">
                About
              </h3>

              <p className="settings-description">
                {chats.length} chats ·{" "}
                {totalMessages} messages ·{" "}
                {MODEL_NAME}
              </p>

              <button
                className="guest-button"
                type="button"
                onClick={() => {
                  setSettingsOpen(
                    false
                  );

                  setAboutOpen(
                    true
                  );
                }}
              >
                About Fades
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About */}
      {aboutOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={() =>
            setAboutOpen(false)
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
              aria-label="Close"
              onClick={() =>
                setAboutOpen(
                  false
                )
              }
            >
              ×
            </button>

            <div className="modal-logo">
              f
            </div>

            <h2>
              Fades AI
            </h2>

            <p>
              Running{" "}
              {MODEL_NAME} on
              your own inference
              infrastructure.{" "}
              {user
                ? "Your conversations are synced to your Fades account."
                : "Your conversations are stored in this browser."}
            </p>

            <button
              className="guest-button"
              type="button"
              onClick={() =>
                setAboutOpen(
                  false
                )
              }
            >
              Close
            </button>

            <small className="login-note">
              Fades AI · v1.0
            </small>
          </div>
        </div>
      )}

      {/* Clear confirmation */}
      {clearConfirmOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={() =>
            setClearConfirmOpen(
              false
            )
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
              aria-label="Close"
              onClick={() =>
                setClearConfirmOpen(
                  false
                )
              }
            >
              ×
            </button>

            <h2>
              Clear all chats?
            </h2>

            <p>
              Every conversation
              {user
                ? " in your Fades account"
                : " stored in this browser"}{" "}
              will be removed. This
              cannot be undone.
            </p>

            <button
              className="auth-submit"
              type="button"
              onClick={
                clearAllChats
              }
            >
              Clear everything
            </button>

            <button
              className="guest-button"
              type="button"
              onClick={() =>
                setClearConfirmOpen(
                  false
                )
              }
            >
              Keep my chats
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={
          handleImport
        }
      />

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(
            (item) => (
              <div
                key={item.id}
                className={`toast ${item.type}`}
              >
                {item.text}
              </div>
            )
          )}
        </div>
      )}
    </main>
  );
}
