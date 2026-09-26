export function createId(prefix = "id") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function normalizeMessage(raw) {
  if (!raw || typeof raw !== "object") return null;

  const content = typeof raw.content === "string" ? raw.content : "";
  if (!content) return null;

  const role =
    raw.role === "user" ? "user" : raw.role === "assistant" ? "assistant" : null;
  if (!role) return null;

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : createId("message"),
    role,
    content,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
  };
}

export function normalizeChat(raw) {
  if (!raw || typeof raw !== "object") return null;

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : createId("chat"),
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title : "New chat",
    messages: Array.isArray(raw.messages)
      ? raw.messages.map(normalizeMessage).filter(Boolean)
      : [],
    pinned: Boolean(raw.pinned),
    favorite: Boolean(raw.favorite),
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };
}

export function generateTitle(text) {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "New chat";
  if (clean.length <= 48) return clean;
  return `${clean.slice(0, 48)}...`;
}
