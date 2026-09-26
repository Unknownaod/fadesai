"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createId } from "../lib/chat-helpers";

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const toastTimersRef = useRef(new Map());

  const showToast = useCallback((text, type = "success") => {
    const id = createId("toast");

    setToasts((current) => [...current.slice(-2), { id, text, type }]);

    const timer = setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
      toastTimersRef.current.delete(id);
    }, 2800);

    toastTimersRef.current.set(id, timer);
  }, []);

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return { toasts, showToast };
}
