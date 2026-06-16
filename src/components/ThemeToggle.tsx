"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "raaste_theme";

type Theme = "light" | "dark";

function apply(theme: Theme) {
  const el = document.documentElement;
  if (theme === "light") el.setAttribute("data-theme", "light");
  else el.removeAttribute("data-theme");
}

export default function ThemeToggle() {
  // Default to dark; the real value is read from localStorage on mount so we
  // never read storage during render (and so SSR stays consistent).
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    let stored: Theme = "dark";
    try {
      stored = localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
    } catch {
      // Storage blocked (private mode) — fall back to the dark default.
    }
    setTheme(stored);
    apply(stored);
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore — switching the theme in-session is what matters.
    }
  }

  const isLight = theme === "light";

  return (
    <button
      onClick={toggle}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      title={isLight ? "Switch to dark theme" : "Switch to light theme"}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[var(--text-muted)] transition-colors hover:text-[var(--text)] lg:h-7 lg:w-7"
    >
      {isLight ? (
        // Moon — clicking switches to dark.
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        // Sun — clicking switches to light.
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )}
    </button>
  );
}
