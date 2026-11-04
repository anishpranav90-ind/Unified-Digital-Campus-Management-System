"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Globe2, Moon, Sun } from "lucide-react";
import { LANGUAGES, translate, type LanguageCode } from "@/lib/i18n";

const THEME_STORAGE_KEY = "unisync-theme";

function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function PreferencesControls({
  language,
  onLanguageChange,
}: {
  language: LanguageCode;
  onLanguageChange: (language: LanguageCode) => void;
}) {
  const router = useRouter();

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
      document.documentElement.style.colorScheme = savedTheme;
    }
  }, []);

  function changeLanguage(value: string) {
    const nextLanguage = LANGUAGES.find((item) => item.code === value)?.code;
    if (!nextLanguage) return;

    document.cookie = `unisync-language=${nextLanguage}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = LANGUAGES.find((item) => item.code === nextLanguage)?.locale ?? "en-IN";
    onLanguageChange(nextLanguage);
    router.refresh();
  }

  function toggleTheme() {
    const nextTheme = document.documentElement.classList.contains("dark") ? "light" : "dark";
    applyTheme(nextTheme);
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <label className="sr-only" htmlFor="language-select">
        {translate(language, "Language")}
      </label>
      <span className="hidden text-slate-500 sm:block">
        <Globe2 className="h-4 w-4" aria-hidden="true" />
      </span>
      <select
        id="language-select"
        value={language}
        onChange={(event) => changeLanguage(event.target.value)}
        className="focus-ring h-9 w-20 rounded-lg border border-line bg-white px-2 text-xs font-medium text-ink sm:w-32"
        aria-label={translate(language, "Language")}
      >
        {LANGUAGES.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={toggleTheme}
        className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-ink"
        aria-label={translate(language, "Toggle color theme")}
        title={translate(language, "Toggle color theme")}
      >
        <Moon className="theme-icon-light h-4 w-4" aria-hidden="true" />
        <Sun className="theme-icon-dark h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
