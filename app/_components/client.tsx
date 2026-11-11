"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./ui";

/**
 * The console's few browser-side helpers. Everything else is server-rendered and works without JavaScript;
 * these only make it quicker (fresh list, "/" to search, copy a number, light or dark).
 */

const THEME_COOKIE = "ll-theme";

/** Light or dark for this browser, remembered in a cookie so the server renders it without a flash. */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    const set = document.documentElement.dataset.theme;
    setDark(set ? set === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  const flip = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setDark(!dark);
  };
  return (
    <button type="button" className="theme-toggle" onClick={flip} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"}>
      <Icon name={dark ? "sun" : "moon"} size={16} />
    </button>
  );
}

/** Re-reads the page every `seconds` while it's on screen, so a new caller shows up without a reload. */
export function LiveRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
      if (document.visibilityState === "visible" && !typing) router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds]);
  return null;
}

/** "/" jumps to the search box, the way most inboxes do. */
export function SearchHotkey({ inputId }: { inputId: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      const input = document.getElementById(inputId) as HTMLInputElement | null;
      if (!input) return;
      e.preventDefault();
      input.focus();
      input.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inputId]);
  return null;
}

/** Copies text (a phone number) and says so for a moment. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (older browser or no permission): nothing to undo; the number stays on screen.
    }
  };
  return (
    <button type="button" className="btn" onClick={copy} aria-live="polite">
      <Icon name={copied ? "check" : "copy"} size={16} /> {copied ? "Copied" : label}
    </button>
  );
}
