import { useState, useEffect } from "react";

// localStorage-backed React state for user PREFERENCES only (never secrets).
const LS = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (err) {
      console.warn("[persist] read failed", key, err);
      return fallback;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (err) {
      console.warn("[persist] write failed", key, err);
    }
  },
};

export function usePersistentState(key, fallback) {
  const [value, setValue] = useState(() => LS.get(key, fallback));
  useEffect(() => LS.set(key, value), [key, value]);
  return [value, setValue];
}
