"use client";

import { useEffect, useState } from "react";

/**
 * ChatGPT-style "Thinking" block.
 *
 *   active   true while the model is still thinking (no answer text yet)
 *   thinking the reasoning text (hidden until the user clicks)
 *   seconds  how long it thought, once finished
 */
export function ThinkingBlock({ thinking = "", active = false, seconds = null }) {
  const [open, setOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) return undefined;

    const start = Date.now();
    setElapsed(0);

    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    return () => window.clearInterval(id);
  }, [active]);

  const hasText = Boolean(thinking && thinking.trim());

  let label;
  if (active) {
    label = elapsed > 0 ? `Thinking… ${elapsed}s` : "Thinking…";
  } else if (seconds != null) {
    label = `Thought for ${seconds}s`;
  } else {
    label = "Thought process";
  }

  return (
    <div className={`thinking-block ${active ? "is-active" : ""} ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="thinking-toggle"
        onClick={() => hasText && setOpen((current) => !current)}
        aria-expanded={open}
        disabled={!hasText}
      >
        <span className="thinking-label">{label}</span>
        {hasText && <span className="thinking-chevron" aria-hidden="true">›</span>}
      </button>

      {open && hasText && (
        <div className="thinking-content" role="region" aria-label="Model reasoning">
          {thinking.trim()}
        </div>
      )}
    </div>
  );
}
