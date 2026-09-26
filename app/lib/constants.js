export const SETTINGS_KEY = "fades.settings.v1";
export const API_URL = "https://api.fades.lol";
export const MAX_TEXTAREA_HEIGHT = 180;
export const MODEL_NAME = "Qwen 3 4B";

export const DEFAULT_SETTINGS = {
  theme: "dark",
  compactMode: false,
  enterToSend: true,
  showTimestamps: false,
  soundEffects: false,
};

export const SUGGESTIONS = [
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
