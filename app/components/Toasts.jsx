"use client";

export function Toasts({ toasts }) {
  if (!toasts.length) return null;

  return (
    <div className="toast-container">
      {toasts.map((item) => (
        <div key={item.id} className={`toast ${item.type}`}>
          {item.text}
        </div>
      ))}
    </div>
  );
}
