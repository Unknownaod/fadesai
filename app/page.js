"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import "./globals.css";

/* =========================================================
CONFIG
========================================================= */

const STORAGE_KEY = "fades.chats.v2";
const SETTINGS_KEY = "fades.settings.v1";
const API_URL = "https://api.fades.lol";

const DEFAULT_SETTINGS = {
enterToSend: true,
soundEffects: false,
compactMode: false,
autoScroll: true,
};

const SUGGESTIONS = [
{
title: "Explain something",
text: "Explain a difficult topic to me in simple terms.",
},
{
title: "Write something",
text: "Help me write a professional message.",
},
{
title: "Build something",
text: "Help me build a website or application.",
},
{
title: "Brainstorm",
text: "Give me some creative ideas for a new project.",
},
];

/* =========================================================
HELPERS
========================================================= */

function createId(prefix = "id") {
return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function createChat(title = "New conversation") {
return {
id: createId("chat"),
title,
createdAt: Date.now(),
updatedAt: Date.now(),
messages: [],
};
}

function createMessage(role, content = "") {
return {
id: createId("msg"),
role,
content,
createdAt: Date.now(),
};
}

function getInitials(user) {
if (!user) return "G";

const value =
user.displayName ||
user.username ||
user.email ||
"Guest";

const parts = value.trim().split(/\s+/);

if (parts.length >= 2) {
return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

return value.slice(0, 2).toUpperCase();
}

function getUserName(user) {
if (!user) return "Guest";

return (
user.displayName ||
user.username ||
user.email?.split("@")[0] ||
"User"
);
}

function makeTitle(text) {
const clean = text
.replace(/\s+/g, " ")
.trim();

if (!clean) return "New conversation";

if (clean.length <= 42) {
return clean;
}

return `${clean.slice(0, 42).trim()}…`;
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

function downloadText(filename, content) {
const blob = new Blob([content], {
type: "text/plain;charset=utf-8",
});

const url = URL.createObjectURL(blob);

const link = document.createElement("a");

link.href = url;
link.download = filename;

document.body.appendChild(link);
link.click();
link.remove();

URL.revokeObjectURL(url);
}

/* =========================================================
PAGE
========================================================= */

export default function Home() {
/* =======================================================
CORE STATE
======================================================= */

const [chats, setChats] = useState([]);
const [activeChatId, setActiveChatId] = useState(null);

const [message, setMessage] = useState("");

const [loading, setLoading] = useState(false);
const [booting, setBooting] = useState(true);

const [user, setUser] = useState(null);

/* =======================================================
UI STATE
======================================================= */

const [sidebarOpen, setSidebarOpen] = useState(false);
const [profileOpen, setProfileOpen] = useState(false);

const [loginOpen, setLoginOpen] = useState(false);
const [settingsOpen, setSettingsOpen] = useState(false);
const [helpOpen, setHelpOpen] = useState(false);

const [search, setSearch] = useState("");

const [renameId, setRenameId] = useState(null);
const [renameValue, setRenameValue] = useState("");

const [copiedMessageId, setCopiedMessageId] = useState(null);

const [authMode, setAuthMode] = useState("login");

const [authForm, setAuthForm] = useState({
displayName: "",
username: "",
email: "",
password: "",
});

const [authError, setAuthError] = useState("");
const [authLoading, setAuthLoading] = useState(false);

const [settings, setSettings] = useState(DEFAULT_SETTINGS);

/* =======================================================
REFS
======================================================= */

const textareaRef = useRef(null);
const messagesRef = useRef(null);

const abortRef = useRef(null);

const profileRef = useRef(null);

/* =======================================================
INITIAL LOAD
======================================================= */

useEffect(() => {
try {
const savedChats = localStorage.getItem(STORAGE_KEY);


  if (savedChats) {
    const parsed = JSON.parse(savedChats);

    if (Array.isArray(parsed)) {
      setChats(parsed);

      if (parsed.length > 0) {
        setActiveChatId(parsed[0].id);
      }
    }
  }

  const savedSettings =
    localStorage.getItem(SETTINGS_KEY);

  if (savedSettings) {
    const parsedSettings = JSON.parse(savedSettings);

    setSettings({
      ...DEFAULT_SETTINGS,
      ...parsedSettings,
    });
  }
} catch (error) {
  console.error("Failed to restore local data:", error);
}

checkSession();


}, []);

/* =======================================================
SAVE CHATS
======================================================= */

useEffect(() => {
if (booting) return;


try {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(chats)
  );
} catch (error) {
  console.error("Failed to save chats:", error);
}


}, [chats, booting]);

/* =======================================================
SAVE SETTINGS
======================================================= */

useEffect(() => {
try {
localStorage.setItem(
SETTINGS_KEY,
JSON.stringify(settings)
);
} catch (error) {
console.error("Failed to save settings:", error);
}
}, [settings]);

/* =======================================================
SESSION
======================================================= */

async function checkSession() {
try {
const response = await fetch(
`${API_URL}/auth/me`,
{
method: "GET",
credentials: "include",
cache: "no-store",
}
);


  if (!response.ok) {
    setUser(null);
    return;
  }

  const data = await response.json();

  if (data?.user) {
    setUser(data.user);
  } else {
    setUser(null);
  }
} catch (error) {
  console.error("Session check failed:", error);
  setUser(null);
} finally {
  setBooting(false);
}


}

/* =======================================================
ACTIVE CHAT
======================================================= */

const activeChat =
chats.find(
(chat) => chat.id === activeChatId
) || null;

const activeMessages =
activeChat?.messages || [];

/* =======================================================
FILTERED CHATS
======================================================= */

const filteredChats = chats
.filter((chat) => {
if (!search.trim()) return true;


  return chat.title
    .toLowerCase()
    .includes(search.toLowerCase());
})
.sort(
  (a, b) =>
    (b.updatedAt || 0) -
    (a.updatedAt || 0)
);


/* =======================================================
AUTOSIZE COMPOSER
======================================================= */

useEffect(() => {
const textarea = textareaRef.current;


if (!textarea) return;

textarea.style.height = "auto";

textarea.style.height = `${Math.min(
  textarea.scrollHeight,
  160
)}px`;


}, [message]);

/* =======================================================
AUTO SCROLL
======================================================= */

useEffect(() => {
if (!settings.autoScroll) return;


const container = messagesRef.current;

if (!container) return;

requestAnimationFrame(() => {
  container.scrollTop =
    container.scrollHeight;
});


}, [
activeMessages.length,
activeMessages[
activeMessages.length - 1
]?.content,
loading,
]);

/* =======================================================
GLOBAL KEYBOARD SHORTCUTS
======================================================= */

useEffect(() => {
function handleKeyDown(event) {
const key = event.key.toLowerCase();


  /* New chat */

  if (
    (event.ctrlKey || event.metaKey) &&
    key === "n"
  ) {
    event.preventDefault();
    createNewChat();
    return;
  }

  /* Search */

  if (
    (event.ctrlKey || event.metaKey) &&
    key === "k"
  ) {
    event.preventDefault();

    const searchInput =
      document.querySelector(
        ".sidebar-search input"
      );

    searchInput?.focus();

    return;
  }

  /* Settings */

  if (
    (event.ctrlKey || event.metaKey) &&
    key === ","
  ) {
    event.preventDefault();

    setSettingsOpen(true);
    setProfileOpen(false);

    return;
  }

  /* Escape */

  if (event.key === "Escape") {
    setSidebarOpen(false);
    setProfileOpen(false);
    setSettingsOpen(false);
    setHelpOpen(false);
    setLoginOpen(false);

    return;
  }
}

window.addEventListener(
  "keydown",
  handleKeyDown
);

return () => {
  window.removeEventListener(
    "keydown",
    handleKeyDown
  );
};


}, []);

/* =======================================================
PROFILE OUTSIDE CLICK
======================================================= */

useEffect(() => {
function handleClick(event) {
if (
profileRef.current &&
!profileRef.current.contains(event.target)
) {
setProfileOpen(false);
}
}


document.addEventListener(
  "mousedown",
  handleClick
);

return () => {
  document.removeEventListener(
    "mousedown",
    handleClick
  );
};


}, []);

/* =======================================================
CREATE CHAT
======================================================= */

function createNewChat() {
