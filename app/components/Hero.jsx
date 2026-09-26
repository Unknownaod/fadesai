"use client";

import { SUGGESTIONS } from "../lib/constants";

export function Hero({ applySuggestion, user }) {
  return (
    <div className="hero-content">
      <div className="hero-status">
        <span className="hero-status-dot" />
        Fades AI is online
      </div>

      <h1>What can I help with?</h1>

      <p>Ask a question, work through a problem, write code, or turn an idea into something real.</p>

      <div className="suggestions">
        {SUGGESTIONS.map((item) => (
          <button
            key={item.title}
            className="suggestion"
            type="button"
            onClick={() => applySuggestion(item.prompt)}
          >
            <strong>{item.title}</strong>
            <span>{item.description}</span>
          </button>
        ))}

        <button
          type="button"
          className="suggestion"
          onClick={() => {
            window.location.href = "/pro";
          }}
        >
          <strong>{user?.plan === "pro" ? "Manage Pro" : "Upgrade to Pro"}</strong>
          <span>
            {user?.plan === "pro" ? "Manage your Fades Pro subscription" : "Unlock more with Fades Pro"}
          </span>
        </button>
      </div>
    </div>
  );
}
