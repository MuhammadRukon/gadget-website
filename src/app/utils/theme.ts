import { THEME_KEY } from "../constants";
import { Theme } from "../interface";

export function getSavedTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem(THEME_KEY) as Theme) || "light";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  localStorage.setItem(THEME_KEY, theme);
}

export function toggleTheme(): Theme {
  const current = getSavedTheme();
  const newTheme: Theme = current === "dark" ? "light" : "dark";
  applyTheme(newTheme);
  return newTheme;
}
