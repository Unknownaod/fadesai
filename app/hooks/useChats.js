"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_URL, MAX_TEXTAREA_HEIGHT } from "../lib/constants";
import { createId, generateTitle, normalizeChat, normalizeMessage } from "../lib/chat-helpers";
import { downloadFile, formatDate } from "../lib/format";

export function useChats({ user, showToast }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [cloudChatsLoading, setCloudChatsLoading] = useState(false);

  const [editingChatId, setEditingChatId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const stickToBottomRef = useRef(true);

  /* -------------------------------------------------------------- */
  /* Reset (called when the signed-in user changes)                  */
  /* -------------------------------------------------------------- */

  const resetForSessionChange = useCallback(() => {
    setChats([]);
    setMessages([]);
    setActiveChatId(null);
    setMessage("");
    setSearch("");
    setEditingChatId(null);
    setEditingTitle("");
    setLoading(false);
    setCloudChatsLoading(false);
  }, []);

  const abortActive = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  /* -------------------------------------------------------------- */
  /* Composer helpers                                                */
  /* -------------------------------------------------------------- */

  const focusComposer = useCallback(() => {
    window.setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, []);

  /* -------------------------------------------------------------- */
  /* Cloud chat helpers                                              */
  /* -------------------------------------------------------------- */

  const createCloudChat = useCallback(
    async (chat) => {
      if (!user) return chat;

      const response = await fetch(`${API_URL}/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: chat.title,
          pinned: chat.pinned,
          favorite: chat.favorite,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to create conversation.");
      }

      return normalizeChat(data?.chat || data);
    },
    [user]
  );

  const updateCloudChat = useCallback(
    async (chatId, updates) => {
      if (!user) return;

      try {
        const response = await fetch(`${API_URL}/chats/${encodeURIComponent(chatId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(updates),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error || "Unable to update conversation.");
        }
      } catch (error) {
        console.error("Cloud chat update failed:", error);
        showToast("Your chat could not be synced.", "error");
      }
    },
    [user, showToast]
  );

  const deleteCloudChat = useCallback(
    async (chatId) => {
      if (!user) return;

      try {
        const response = await fetch(`${API_URL}/chats/${encodeURIComponent(chatId)}`, {
          method: "DELETE",
          credentials: "include",
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error || "Unable to delete conversation.");
        }
      } catch (error) {
        console.error("Cloud chat delete failed:", error);
        showToast("The chat could not be deleted from your account.", "error");
      }
    },
    [user, showToast]
  );

  const saveCloudMessages = useCallback(
    async (chatId, nextMessages) => {
      if (!user) return;

      try {
        const response = await fetch(
          `${API_URL}/chats/${encodeURIComponent(chatId)}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              messages: nextMessages.map((item) => ({
                id: item.id,
                role: item.role,
                content: item.content,
                createdAt: item.createdAt,
              })),
            }),
          }
        );

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error || "Unable to save messages.");
        }
      } catch (error) {
        console.error("Cloud message save failed:", error);
        showToast("Your latest messages could not be saved.", "error");
      }
    },
    [user, showToast]
  );

  const loadCloudChats = useCallback(async () => {
    if (!user) return;

    setCloudChatsLoading(true);
    setChats([]);
    setMessages([]);
    setActiveChatId(null);

    try {
      const response = await fetch(`${API_URL}/chats`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load your conversations.");
      }

      const serverChats = Array.isArray(data) ? data : Array.isArray(data?.chats) ? data.chats : [];
      const normalized = serverChats.map(normalizeChat).filter(Boolean);

      setChats(normalized);

      if (normalized.length > 0) {
        setActiveChatId(normalized[0].id);
        setMessages(normalized[0].messages || []);
      }
    } catch (error) {
      console.error("Failed to load cloud chats:", error);
      setChats([]);
      setMessages([]);
      setActiveChatId(null);
      showToast("Unable to load your saved chats.", "error");
    } finally {
      setCloudChatsLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    if (!user) return;
    loadCloudChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
        console.error("Cloud chat creation failed:", error);
        showToast("Unable to create a saved chat.", "error");
        return;
      }
    }

    setChats((current) => [chat, ...current]);
    setActiveChatId(chat.id);
    setMessages([]);
    setMessage("");

    stickToBottomRef.current = true;
    focusComposer();

    return chat.id;
  }, [loading, user, createCloudChat, showToast, focusComposer]);

  const openChat = useCallback(
    (chat) => {
      if (loading) return;

      setActiveChatId(chat.id);
      setMessages(chat.messages || []);
      setMessage("");

      stickToBottomRef.current = true;
      focusComposer();
    },
    [loading, focusComposer]
  );

  const ensureChat = useCallback(
    async (text) => {
      const exists = chats.some((chat) => chat.id === activeChatId);
      if (activeChatId && exists) return activeChatId;

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
        const cloudChat = await createCloudChat(localChat);
        setChats((current) => [cloudChat, ...current]);
        setActiveChatId(cloudChat.id);
        return cloudChat.id;
      }

      setChats((current) => [localChat, ...current]);
      setActiveChatId(localChat.id);
      return localChat.id;
    },
    [activeChatId, chats, user, createCloudChat]
  );

  const commitMessages = useCallback((chatId, nextMessages, title) => {
    setMessages(nextMessages);

    setChats((current) =>
      current.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              title: title && chat.title === "New chat" ? title : chat.title,
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

      const text = (overrideMessage !== null ? overrideMessage : message).trim();
      if (!text || loading) return;

      setMessage("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      const baseline = baseMessages ?? messages;

      let currentChatId;
      try {
        currentChatId = await ensureChat(text);
      } catch (error) {
        showToast(error?.message || "Unable to create the conversation.", "error");
        return;
      }

      const userMessage = { id: createId("message"), role: "user", content: text, createdAt: Date.now() };
      const history = baseline.map((item) => ({ role: item.role, content: item.content }));
      const updatedMessages = [...baseline, userMessage];
      const assistantId = createId("message");

      stickToBottomRef.current = true;

      setMessages([
        ...updatedMessages,
        { id: assistantId, role: "assistant", content: "", streaming: true, createdAt: Date.now() },
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
              errorMessage = JSON.parse(errorText)?.error || errorMessage;
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

              if (data.error) {
                streamError = new Error(data.error);
                break;
              }

              const chunk = data.content ?? data.text ?? data.delta ?? data.message?.content ?? "";
              if (!chunk) continue;

              fullResponse += chunk;

              setMessages((current) =>
                current.map((item) => (item.id === assistantId ? { ...item, content: fullResponse } : item))
              );
            }

            if (streamError) break;
          }

          if (streamError) {
            await reader.cancel().catch(() => {});
            throw streamError;
          }
        }

        const finalMessages = [
          ...updatedMessages,
          {
            id: assistantId,
            role: "assistant",
            content: fullResponse || "I wasn't able to generate a response.",
            createdAt: Date.now(),
          },
        ];

        const title = generateTitle(text);
        commitMessages(currentChatId, finalMessages, title);

        if (user) {
          const chat = chats.find((item) => item.id === currentChatId);
          if (chat && chat.title === "New chat") {
            await updateCloudChat(currentChatId, { title });
          }
          await saveCloudMessages(currentChatId, finalMessages);
        }
      } catch (error) {
        if (error?.name === "AbortError") {
          const stoppedMessages = [
            ...updatedMessages,
            { id: assistantId, role: "assistant", content: "Generation stopped.", stopped: true, createdAt: Date.now() },
          ];

          commitMessages(currentChatId, stoppedMessages);
          if (user) await saveCloudMessages(currentChatId, stoppedMessages);
          showToast("Generation stopped.");
        } else {
          console.error("Fades AI error:", error);

          const errorMessages = [
            ...updatedMessages,
            {
              id: assistantId,
              role: "assistant",
              content: error?.message || "Something went wrong while connecting to Fades AI.",
              error: true,
              createdAt: Date.now(),
            },
          ];

          commitMessages(currentChatId, errorMessages);
          if (user) await saveCloudMessages(currentChatId, errorMessages);
          showToast("Fades couldn't complete that request.", "error");
        }
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
        focusComposer();
      }
    },
    [message, messages, loading, ensureChat, commitMessages, showToast, focusComposer, user, chats, updateCloudChat, saveCloudMessages]
  );

  function stopGeneration() {
    abortControllerRef.current?.abort();
  }

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

    if (user) deleteCloudChat(chatId);
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
      current.map((chat) => (chat.id === chatId ? { ...chat, title, updatedAt: Date.now() } : chat))
    );

    if (user) updateCloudChat(chatId, { title });

    setEditingChatId(null);
    setEditingTitle("");
    showToast("Chat renamed.");
  }

  function togglePin(chatId) {
    setChats((current) =>
      current.map((chat) => (chat.id === chatId ? { ...chat, pinned: !chat.pinned, updatedAt: Date.now() } : chat))
    );

    const chat = chats.find((item) => item.id === chatId);
    if (user && chat) updateCloudChat(chatId, { pinned: !chat.pinned });
  }

  function toggleFavorite(chatId) {
    setChats((current) =>
      current.map((chat) => (chat.id === chatId ? { ...chat, favorite: !chat.favorite, updatedAt: Date.now() } : chat))
    );

    const chat = chats.find((item) => item.id === chatId);
    if (user && chat) updateCloudChat(chatId, { favorite: !chat.favorite });
  }

  function clearAllChats() {
    if (loading) return;

    if (user) {
      Promise.all(chats.map((chat) => deleteCloudChat(chat.id))).catch((error) =>
        console.error("Failed clearing cloud chats:", error)
      );
    }

    setChats([]);
    setMessages([]);
    setActiveChatId(null);
    setMessage("");
    showToast("All chats cleared.");
  }

  /* -------------------------------------------------------------- */
  /* Import / export                                                 */
  /* -------------------------------------------------------------- */

  function exportCurrentChat() {
    if (!messages.length) {
      showToast("There is no conversation to export.", "error");
      return;
    }

    const chat = chats.find((item) => item.id === activeChatId);

    const lines = [
      "Fades AI",
      chat?.title || "Fades conversation",
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

    downloadFile("fades-conversation.txt", lines.join("\n"), "text/plain;charset=utf-8");
    showToast("Conversation exported.");
  }

  function exportAllChats() {
    downloadFile(
      "fades-chats.json",
      JSON.stringify({ app: "Fades AI", version: 2, exportedAt: new Date().toISOString(), chats }, null, 2),
      "application/json"
    );
    showToast("All chats exported.");
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
          title: typeof chat.title === "string" && chat.title.trim() ? chat.title : "Imported chat",
          messages: Array.isArray(chat.messages)
            ? chat.messages.map(normalizeMessage).filter(Boolean)
            : [],
          pinned: Boolean(chat.pinned),
          favorite: Boolean(chat.favorite),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }));

      if (user) {
        for (const imported of sanitized) {
          try {
            const created = await createCloudChat(imported);
            await saveCloudMessages(created.id, imported.messages);
            imported.id = created.id;
          } catch (error) {
            console.error("Imported cloud chat failed:", error);
          }
        }
      }

      setChats((current) => [...sanitized, ...current]);
      showToast(`${sanitized.length} chat${sanitized.length === 1 ? "" : "s"} imported.`);
    } catch (error) {
      console.error("Import failed:", error);
      showToast("That file could not be imported.", "error");
    }
  }

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

    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    stickToBottomRef.current = distance < 80;
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
          chat.messages?.some((item) => item.content?.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [chats, search]);

  const pinnedChats = filteredChats.filter((chat) => chat.pinned);
  const otherChats = filteredChats.filter((chat) => !chat.pinned);
  const hasMessages = messages.length > 0;

  const totalMessages = useMemo(
    () => chats.reduce((total, chat) => total + (chat.messages?.length || 0), 0),
    [chats]
  );

  return {
    // state
    message,
    setMessage,
    messages,
    chats,
    activeChatId,
    loading,
    search,
    setSearch,
    cloudChatsLoading,
    editingChatId,
    setEditingChatId,
    editingTitle,
    setEditingTitle,

    // refs
    textareaRef,
    messagesEndRef,
    messagesContainerRef,
    fileInputRef,

    // derived
    filteredChats,
    pinnedChats,
    otherChats,
    hasMessages,
    totalMessages,

    // actions
    createChat,
    openChat,
    sendMessage,
    stopGeneration,
    resendFrom,
    applySuggestion,
    deleteChat,
    startRename,
    saveRename,
    togglePin,
    toggleFavorite,
    clearAllChats,
    exportCurrentChat,
    exportAllChats,
    handleImport,
    resizeTextarea,
    handleMessagesScroll,
    resetForSessionChange,
    abortActive,
  };
}
